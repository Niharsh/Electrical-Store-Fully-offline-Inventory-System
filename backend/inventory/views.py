from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from decimal import Decimal
from django.db.models import Q, Sum, F
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from .models import (
    ProductType, Product, Batch, Invoice, InvoiceItem,
    SalesBill, PurchaseBill, ShopProfile, Wholesaler, HSN
)
from .serializers import (
    ProductTypeSerializer, ProductSerializer, BatchSerializer, BatchExpiringSerializer,
    InvoiceSerializer, InvoiceItemSerializer, InvoiceCreateSerializer,
    SalesBillSerializer, SalesBillUpdateSerializer,
    PurchaseBillSerializer, PurchaseBillUpdateSerializer, PurchaseBillCreateSerializer, ShopProfileSerializer, WholesalerSerializer, HSNSerializer
)
from rest_framework import serializers
from rest_framework.decorators import api_view
from inventory.serializers import (
    InvoiceSerializer,
    InvoiceDetailSerializer,
    InvoiceCreateSerializer,
    InvoiceItemSerializer,
    
)
from inventory.models import (
    Invoice,
    InvoiceItem,
)
from django.db import transaction



class StandardPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductTypeViewSet(viewsets.ModelViewSet):
    """
    Product Types - manage custom and default product types
    """
    queryset = ProductType.objects.all()
    serializer_class = ProductTypeSerializer
    pagination_class = StandardPagination
    
    @action(detail=False, methods=['post'])
    def create_defaults(self, request):
        """Create default product types if they don't exist"""
        ProductType.create_defaults()
        return Response(
            {'message': 'Default product types created/verified'},
            status=status.HTTP_200_OK
        )


class HSNViewSet(viewsets.ModelViewSet):
    """
    HSN Codes - manage HSN (Harmonized System Nomenclature) codes for GST classification
    
    GET /api/hsn/
    - Returns all HSN codes with their GST rates
    
    POST /api/hsn/
    - Create a new HSN code
    
    GET /api/hsn/{hsn_code}/
    - Get specific HSN code details
    
    PUT/PATCH /api/hsn/{hsn_code}/
    - Update HSN code details
    
    DELETE /api/hsn/{hsn_code}/
    - Delete HSN code (only if not linked to any products)
    """
    queryset = HSN.objects.filter(is_active=True)
    serializer_class = HSNSerializer
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['hsn_code', 'description']
    ordering_fields = ['hsn_code', 'gst_rate', 'created_at']
    ordering = ['hsn_code']
    lookup_field = 'hsn_code'


class BatchViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Batches - read-only access to batches
    
    GET /api/batches/
    - Returns all batches ordered by expiry date (FIFO)
    
    GET /api/batches/expiring/?months=3
    - Returns batches expiring within specified months
    - Excludes zero-quantity batches
    - Orders by expiry date (nearest first)
    """
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product', 'expiry_date']
    ordering_fields = ['expiry_date', 'created_at']
    ordering = ['expiry_date']

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """
        Get batches expiring within specified number of months
        
        Query params:
        - months: Number of months to look ahead (default: 6)
        
        Returns:
        - Batches expiring within the range
        - Only non-zero quantity batches
        - Ordered by expiry date (nearest first)
        - With product details
        """
        months = int(request.GET.get('months', 6))
        
        today = timezone.now().date()
        future_date = today + timedelta(days=30 * months)
        
        # Get batches expiring within range, with quantity > 0
        batches = Batch.objects.filter(
            expiry_date__gte=today,
            expiry_date__lte=future_date,
            quantity__gt=0
        ).select_related('product').order_by('expiry_date')
        
        # Serialize with product details
        serializer = BatchExpiringSerializer(batches, many=True)
        
        return Response({
            'months': months,
            'today': today.isoformat(),
            'until': future_date.isoformat(),
            'count': batches.count(),
            'batches': serializer.data
        })

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.prefetch_related('batches').all()
    serializer_class = ProductSerializer
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'generic_name', 'manufacturer', 'salt_composition']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['-updated_at']

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()

        # Extract batches safely
        batches = data.pop('batches', [])

        serializer = self.get_serializer(
            data=data,
            context={'batches': batches}
        )
        serializer.is_valid(raise_exception=True)

        product = serializer.save()

        return Response(
            ProductSerializer(product).data,
            status=status.HTTP_201_CREATED
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Override update to handle batch processing"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        data = request.data.copy()
        
        # Extract batches from payload
        batches_data = data.pop('batches', [])
        
        print(f"🔄 ProductViewSet.update: Updating product {instance.id} - {instance.name}")
        print(f"   Received {len(batches_data)} batches in payload")
        
        # Update product fields (without batches)
        serializer = self.get_serializer(
            instance, 
            data=data, 
            partial=partial
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        print(f"   ✅ Product fields updated")
        
        # Handle batch updates
        if batches_data:
            # Delete existing batches for this product
            print(f"   Deleting {instance.batches.count()} existing batches...")
            instance.batches.all().delete()
            
            # Create new batches from payload
            for batch_data in batches_data:
                batch = Batch.objects.create(product=instance, **batch_data)
                print(f"   ✅ Batch created/updated: {batch.batch_number} with quantity {batch.quantity}")
        
        # Refresh from database to get updated batches
        instance.refresh_from_db()
        
        return Response(
            ProductSerializer(instance).data,
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """
        Get products with low stock levels
        Returns products where current_stock < min_stock_level
        
        Response includes:
        - product_id, product_name, product_type
        - current_stock (sum of all batch quantities)
        - min_stock_level (product's configured threshold)
        - severity (critical if current < min/2, otherwise warning)
        - units_below (how many units below minimum)
        - count (total low stock products)
        """
        # Get all products with their batches
        products = Product.objects.prefetch_related('batches').all()
        
        low_stock_items = []
        
        for product in products:
            # Calculate total current stock from all batches
            current_stock = sum(batch.quantity for batch in product.batches.all() if batch.quantity > 0)
            
            # Get the minimum stock level for this product (backwards-compatible fallback)
            min_stock_level = getattr(product, 'min_stock_level', 10)

            # Check if product is low stock (treat equal as low stock too)
            if current_stock <= min_stock_level:
                # Determine severity
                units_below = max(0, min_stock_level - current_stock)
                if current_stock <= (min_stock_level / 2):
                    severity = 'critical'
                else:
                    severity = 'warning'
                
                low_stock_items.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'product_type': product.product_type,
                    'current_stock': current_stock,
                    'min_stock_level': min_stock_level,
                    # also expose camelCase alias for some frontends
                    'minStockAlert': min_stock_level,
                    'severity': severity,
                    'units_below': units_below,
                })
        
        # Sort by severity (critical first) then by units_below
        low_stock_items.sort(key=lambda x: (x['severity'] != 'critical', -x['units_below']))
        
        # Log for debugging
        print(f"🚨 Low Stock Report: {len(low_stock_items)} products below minimum threshold")
        for item in low_stock_items:
            print(f"   • {item['product_name']}: {item['current_stock']} (min: {item['min_stock_level']}) - {item['severity'].upper()}")
        
        # Use LowStockSerializer for validation
        from .serializers import LowStockSerializer
        serializer = LowStockSerializer(low_stock_items, many=True)
        
        return Response({
            'count': len(low_stock_items),
            'low_stock_items': serializer.data,
        })


class WholesalerViewSet(viewsets.ModelViewSet):
    """
    Wholesalers - manage wholesalers for batch purchases
    """
    queryset = Wholesaler.objects.all()
    serializer_class = WholesalerSerializer
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'contact_number', 'gst_number']

    ordering_fields = ['name', 'created_at']
    ordering = ['name']

class InvoiceItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Invoice Items - individual items within invoices
    """
    queryset = InvoiceItem.objects.all()
    serializer_class = InvoiceItemSerializer
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['invoice', 'product']
    ordering_fields = ['created_at']
    ordering = ['-created_at']


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Invoices - bills/invoices for selling medicines
    
    GET /api/invoices/
    - Returns invoices with calculated totals
    - Total calculated using SELLING RATE ONLY (NOT mrp)
    - Includes all items for each invoice
    
    POST /api/invoices/
    - Create invoice with items
    - Automatically deducts quantity from batches
    - Calculates and stores total using selling rates
    - Stores both original_selling_rate and selling_rate for price history
    
    """
    queryset = Invoice.objects.prefetch_related('items').all()
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['customer_name', 'customer_phone']
    ordering_fields = ['created_at', 'total_amount']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer   
        if self.action == 'retrieve':
            return InvoiceDetailSerializer
        return InvoiceSerializer
    
    def create(self, request, *args, **kwargs):
        """Create invoice with items"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()

        invoice.refresh_from_db() # Ensure we have all related data
        
        # Return created invoice with full details
        output_serializer = InvoiceDetailSerializer(invoice)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def process_return(self, request):
        """
        Process product returns and update inventory
        
        Request body:
        {
            "invoice_items": [
                {
                    "id": <invoice_item_id>,
                    "product_id": <product_id>,
                    "batch_id": <batch_id>,
                    "quantity": <return_quantity>,
                    "return_reason": "Defective" | "Expired" | "Customer Request"
                }
            ]
        }
        
        Returns:
        {
            "message": "Returns processed successfully",
            "returned_items": count,
            "inventory_updated": count
        }
        """
        try:
            with transaction.atomic():
                items_to_return = request.data.get('invoice_items', [])
                returned_count = 0
                
                for item_data in items_to_return:
                    item_id = item_data.get('id')
                    batch_id = item_data.get('batch_id')
                    return_quantity = item_data.get('quantity', 0)
                    return_reason = item_data.get('return_reason', '')
                    
                    # Update InvoiceItem to mark as return
                    invoice_item = InvoiceItem.objects.get(id=item_id)
                    invoice_item.is_return = True
                    invoice_item.return_reason = return_reason
                    invoice_item.save(update_fields=['is_return', 'return_reason'])
                    
                    # Update batch quantity (add back returned quantity)
                    batch = Batch.objects.get(id=batch_id)
                    batch.quantity += return_quantity
                    batch.save(update_fields=['quantity'])
                    
                    returned_count += 1
                
                return Response({
                    "message": "Returns processed successfully",
                    "returned_items": returned_count,
                    "inventory_updated": returned_count
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            return Response({
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class SalesBillViewSet(viewsets.ModelViewSet):
    """
    Sales Bills - track payment status for sales invoices
    
    GET /api/sales-bills/
    - Returns all sales bills with payment status
    
    POST /api/sales-bills/
    - Create sales bill for an invoice
    
    PATCH /api/sales-bills/{id}/
    - Update amount paid and notes
    - Automatically recalculates amount_due and payment_status
    
    GET /api/sales-bills/summary/
    - Returns aggregated sales data:
      - total_sales: Sum of all Invoice.total_amount (NOT SalesBill)
      - total_paid: Sum of SalesBill.amount_paid
      - total_due: Sum of SalesBill.total_amount - amount_paid
      - bill_count: Count of SalesBill records
    """
    queryset = SalesBill.objects.select_related('invoice').all()
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['payment_status']
    ordering_fields = ['created_at', 'total_amount']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action in ['partial_update', 'update']:
            return SalesBillUpdateSerializer
        return SalesBillSerializer
    
    def perform_update(self, serializer):
        """Update and recalculate payment status"""
        serializer.save()
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Returns aggregated sales totals from both Invoice and SalesBill models
        
        Query params:
        - period: 'month' (default) or 'year' (currently unused, for future filtering)
        
        Returns:
        {
            "total_sales": sum of all Invoice.total_amount,
            "total_paid": sum of all SalesBill.amount_paid,
            "total_due": sum of (SalesBill.total_amount - amount_paid),
            "bill_count": count of SalesBill records
        }
        """
        period = request.GET.get("period", "month")

        # ✅ total_sales comes from Invoice model
        invoice_total = Invoice.objects.aggregate(
            total=Sum("total_amount")
        )["total"] or 0

        # ✅ total_paid comes from SalesBill model
        sales_bill_paid = self.queryset.aggregate(
            paid=Sum("amount_paid")
        )["paid"] or 0

        # ✅ total_due calculated from SalesBill records
        sales_bill_total = self.queryset.aggregate(
            total=Sum("total_amount")
        )["total"] or 0
        
        sales_bill_due = sales_bill_total - sales_bill_paid

        return Response({
            "period": period,
            "total_sales": float(invoice_total),
            "total_paid": float(sales_bill_paid),
            "total_due": float(sales_bill_due),
            "bill_count": self.queryset.count(),
        })




class PurchaseBillViewSet(viewsets.ModelViewSet):
    """
    Purchase Bills - track payment status for purchase invoices
    
    GET /api/purchase-bills/
    - Returns all purchase bills with payment status
    - Search by wholesaler name, contact number, or bill number
    
    POST /api/purchase-bills/
    - Create purchase bill for a wholesaler
    
    PATCH /api/purchase-bills/{id}/
    - Update amount paid and notes
    - Automatically recalculates amount_due and payment_status
    
    GET /api/purchase-bills/summary/
    - Returns aggregated purchase bill data (total_purchases, total_paid, total_due, bill_count)
    """
    queryset = PurchaseBill.objects.all()
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['payment_status']
    # ✅ FIX: Use JOIN syntax for ForeignKey search (wholesaler__field)
    # ✅ Only search text fields, not ForeignKey IDs
    search_fields = ['bill_number', 'wholesaler__name', 'wholesaler__contact_number']
    ordering_fields = ['created_at', 'total_amount']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PurchaseBillCreateSerializer
        elif self.action in ['partial_update', 'update']:
            return PurchaseBillUpdateSerializer
        return PurchaseBillSerializer
    
    def create(self, request, *args, **kwargs):
        """Override create to return PurchaseBillSerializer response"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_bill = serializer.save()
        
        # Return response using PurchaseBillSerializer
        output_serializer = PurchaseBillSerializer(purchase_bill)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)
    
    def perform_update(self, serializer):
        """Update and recalculate payment status"""
        serializer.save()

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Returns aggregated purchase totals from PurchaseBill model
        
        Query params:
        - period: 'month' (default) or 'year' (currently unused, for future filtering)
        
        Returns:
        {
            "total_purchases": sum of all PurchaseBill.total_amount,
            "total_paid": sum of all PurchaseBill.amount_paid,
            "total_due": sum of (PurchaseBill.total_amount - amount_paid),
            "bill_count": count of PurchaseBill records
        }
        """
        period = request.GET.get("period", "month")

        # ✅ total_purchases from PurchaseBill
        total_amount = self.queryset.aggregate(
            total=Sum("total_amount")
        )["total"] or 0

        # ✅ total_paid from PurchaseBill
        total_paid = self.queryset.aggregate(
            paid=Sum("amount_paid")
        )["paid"] or 0

        return Response({
            "period": period,
            "total_purchases": float(total_amount),
            "total_paid": float(total_paid),
            "total_due": float(total_amount - total_paid),
            "bill_count": self.queryset.count(),
        })


class ShopProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ShopProfileSerializer
    queryset = ShopProfile.objects.all()

    def list(self, request):
        profile = ShopProfile.objects.first()
        if not profile:
            return Response({})
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    def create(self, request):
        """Create or replace the singleton shop profile"""
        # If a profile already exists, update it instead of creating
        if ShopProfile.objects.exists():
            profile = ShopProfile.objects.first()
            # Use partial=True to allow partial updates
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        # Otherwise create a new one
        return super().create(request)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"error": "Delete not allowed"},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )