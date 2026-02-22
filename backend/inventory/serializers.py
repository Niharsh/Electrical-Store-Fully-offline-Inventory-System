from rest_framework import serializers
from django.db import transaction
from django.db import models
from decimal import Decimal, ROUND_HALF_UP
from .models import (
    ProductType, Product, Batch, Invoice, InvoiceItem,
    SalesBill, PurchaseBill, ShopProfile, Wholesaler, HSN
)


class ProductTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductType
        fields = ['name', 'label', 'is_default', 'created_at']
        read_only_fields = ['created_at']


class HSNSerializer(serializers.ModelSerializer):
    class Meta:
        model = HSN
        fields = ['hsn_code', 'description', 'gst_rate', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class BatchSerializer(serializers.ModelSerializer):
    wholesaler_id = serializers.PrimaryKeyRelatedField(
        source='wholesaler',
        queryset=Wholesaler.objects.all(),
        required=False,
        allow_null=True
    )

    expiry_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Batch
        fields = [
            'id',
            'batch_number',
            'mrp',
            'selling_rate',
            'cost_price',
            'quantity',
            'expiry_date',
            'wholesaler_id',
        ]


class BatchExpiringSerializer(serializers.ModelSerializer):
    """
    Serializer for expiring batches with product details
    Used for dashboard expiry overview
    """
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_type = serializers.CharField(source='product.product_type', read_only=True)
    
    class Meta:
        model = Batch
        fields = [
            'id',
            'product_id',
            'product_name',
            'product_type',
            'batch_number',
            'quantity',
            'expiry_date',
            'mrp',
            'selling_rate',
            'cost_price',
        ]
        read_only_fields = fields


class LowStockSerializer(serializers.Serializer):
    """
    Serializer for low stock alert data
    Returns product with current stock, min level, and severity
    Used for dashboard low stock alerts
    """
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    product_type = serializers.CharField()
    current_stock = serializers.IntegerField()
    min_stock_level = serializers.IntegerField()
    severity = serializers.CharField()  # 'critical' or 'warning'
    units_below = serializers.IntegerField()  # How many units below minimum


class ProductSerializer(serializers.ModelSerializer):
    batches = BatchSerializer(many=True, read_only=True)
    total_stock = serializers.SerializerMethodField()
    cost_price = serializers.SerializerMethodField()
    selling_price = serializers.SerializerMethodField()
    nearest_expiry = serializers.SerializerMethodField()
    hsn_code = serializers.CharField(source='hsn.hsn_code', read_only=True, allow_null=True)
    gst_rate = serializers.DecimalField(source='hsn.gst_rate', max_digits=5, decimal_places=2, read_only=True, allow_null=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'product_type', 'generic_name', 'manufacturer',
            'salt_composition', 'unit', 'description', 'batches', 'hsn',
            'min_stock_level',
            # Expose camelCase alias for frontend consumers and backward-compatibility
            'minStockAlert',
            'created_at', 'updated_at',
            'total_stock', 'cost_price', 'selling_price', 'nearest_expiry',
            'hsn_code', 'gst_rate'
        ]
        read_only_fields = ['created_at', 'updated_at', 'hsn_code', 'gst_rate']
    
    def get_total_stock(self, obj):
        """Calculate total stock from all batches"""
        return obj.batches.aggregate(total=models.Sum('quantity'))['total'] or 0
    
    def get_cost_price(self, obj):
        """Get cost price from latest batch (by creation)"""
        latest_batch = obj.batches.order_by('-id').first()
        if latest_batch:
            return float(latest_batch.cost_price) if latest_batch.cost_price else 0.0
        return 0.0
    
    def get_selling_price(self, obj):
        """Get selling price from latest batch (by creation)"""
        latest_batch = obj.batches.order_by('-id').first()
        if latest_batch:
            return float(latest_batch.selling_rate) if latest_batch.selling_rate else 0.0
        return 0.0
    
    def get_nearest_expiry(self, obj):
        """Get nearest expiry date from all batches"""
        earliest_batch = obj.batches.exclude(expiry_date__isnull=True).order_by('expiry_date').first()
        if earliest_batch and earliest_batch.expiry_date:
            return earliest_batch.expiry_date.isoformat()
        return None

    # Map camelCase field to model field for API consumers
    minStockAlert = serializers.IntegerField(source='min_stock_level', required=False)
    
    @transaction.atomic
    def create(self, validated_data):
        """Create product and associated batches if provided"""
        # Extract batches from the request context (passed via view)
        batches_data = self.context.get('batches', [])
        print(f"📦 ProductSerializer.create: Creating product with {len(batches_data)} batches")
        
        # Create the product first
        product = Product.objects.create(**validated_data)
        print(f"✅ Product created: {product.id} - {product.name}")
        
        # Create batches if provided
        for batch_data in batches_data:
            Batch.objects.create(product=product, **batch_data)
            print(f"   ✅ Batch created: {batch_data.get('batch_number')} for Product ID {product.id}")
        return product


class WholesalerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wholesaler
        fields = [
            'id',
            'name',
            'contact_number',
            'gst_number',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class InvoiceItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    taxable_amount = serializers.SerializerMethodField()
    cgst = serializers.SerializerMethodField()
    sgst = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()


    class Meta:
        model = InvoiceItem
        fields = [
            'id',
            'product_name',
            'batch_number',
            'quantity',
            'original_selling_rate',
            'selling_rate',
            'mrp',

            # ➕ NEW FIELDS
            'expiry_date',
            'hsn_code',
            'discount_percent',
            'gst_percent',
            
            # Return fields
            'is_return',
            'return_reason',

            # calculated
            'subtotal',
            'discount_amount',
            'taxable_amount',
            'cgst',
            'sgst',
            'total_amount',

            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'subtotal', 'discount_amount', 'taxable_amount', 'cgst', 'sgst', 'total_amount']

    def get_subtotal(self, obj):
        return str(obj.get_subtotal())
    
    def get_discount_amount(self, obj):
        return str(obj.get_subtotal() - obj.get_taxable_amount())

    def get_taxable_amount(self, obj):
        return str(obj.get_taxable_amount())

    def get_cgst(self, obj):
        return str(obj.get_cgst())

    def get_sgst(self, obj):
        return str(obj.get_sgst())

    def get_total_amount(self, obj):
        return str(obj.get_total_amount())


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Invoice
        fields = [
            'id',
            'customer_name',
            'customer_phone',
            'customer_dl_number',
            'customer_address',
            'gst_percent',
            'discount_percent',
            'total_amount',
            'notes',
            'created_at',
            'updated_at',
            'items',
        ]
        read_only_fields = ['total_amount', 'created_at', 'updated_at']


class InvoiceDetailSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)

    subtotal = serializers.SerializerMethodField()
    total_discount = serializers.SerializerMethodField()
    total_taxable = serializers.SerializerMethodField()
    total_cgst = serializers.SerializerMethodField()
    total_sgst = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id',
            'customer_name',
            'customer_phone',
            'customer_address',
            'notes',
            'created_at',
            'items',

            # calculated totals
            'subtotal',
            'total_discount',
            'total_taxable',
            'total_cgst',
            'total_sgst',
            'grand_total',
        ]

    def get_subtotal(self, obj):
        return sum(item.get_subtotal() for item in obj.items.all())

    def get_total_discount(self, obj):
        return sum(
            (item.get_subtotal() - item.get_taxable_amount())
            for item in obj.items.all()
        )

    def get_total_taxable(self, obj):
        return sum(item.get_taxable_amount() for item in obj.items.all())

    def get_total_cgst(self, obj):
        return sum(item.get_cgst() for item in obj.items.all())

    def get_total_sgst(self, obj):
        return sum(item.get_sgst() for item in obj.items.all())

    def get_grand_total(self, obj):
        return sum(item.get_total_amount() for item in obj.items.all())

class InvoiceCreateSerializer(serializers.Serializer):
    """Serializer for creating invoices with items"""
    customer_name = serializers.CharField(max_length=255)
    customer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    customer_dl_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    customer_address = serializers.CharField(required=False, allow_blank=True)
    gst_percent = serializers.DecimalField(
    max_digits=5, decimal_places=2, required=False, default=0
    )
    discount_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=0
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )
    
    def validate_items(self, items):
        """Validate invoice items"""
        print(f"💳 InvoiceCreateSerializer.validate_items: Validating {len(items)} items")
        
        # Dictionary to track total quantity requested per product
        product_quantities = {}
        
        for i, item in enumerate(items):
            # Check required fields
            required_fields = [
                'product_id',
                'batch_number',
                'quantity',
                'selling_rate'
            ]

            for field in required_fields:
                if field not in item:
                    raise serializers.ValidationError(
                        f"Item {i+1} missing required field: {field}"
                    )
            
            # Validate positive values
            if int(item['quantity']) <= 0:
                raise serializers.ValidationError(
                    f"Item {i+1} quantity must be greater than 0"
                )
            
            if Decimal(str(item['selling_rate'])) <= 0:
                raise serializers.ValidationError(
                    f"Item {i+1} selling_rate must be greater than 0"
                )
            
            # Check product exists
            product_id = int(item['product_id'])
            try:
                product = Product.objects.get(id=product_id)
            except Product.DoesNotExist:
                raise serializers.ValidationError(
                    f"Item {i+1} references non-existent product (ID: {product_id})"
                )
            
            # Track total quantity per product for stock validation
            product_quantities[product_id] = product_quantities.get(product_id, 0) + int(item['quantity'])
            
            # Check batch exists (but don't validate quantity per batch yet - we'll do FIFO)
            try:
                batch = Batch.objects.select_for_update().get(
                    product_id=product_id,
                    batch_number=item['batch_number']
                )

            except Batch.DoesNotExist:
                raise serializers.ValidationError(
                    f"Item {i+1} references non-existent batch: {item['batch_number']}"
                )
            
            # Reject zero-quantity batches
            if batch.quantity <= 0:
                raise serializers.ValidationError(
                    f"Item {i+1} batch {batch.batch_number} has no stock available (quantity: {batch.quantity})"
                )
        
        # ✅ STEP 1: Check total available stock per product
        print(f"   Checking total available stock per product...")
        for product_id, requested_qty in product_quantities.items():
            product = Product.objects.get(id=product_id)
            available_batches = product.batches.filter(quantity__gt=0).aggregate(total=models.Sum('quantity'))
            available_qty = available_batches['total'] or 0
            
            print(f"   Product {product.name} (ID:{product_id}): Requested={requested_qty}, Available={available_qty}")
            
            if requested_qty > available_qty:
                raise serializers.ValidationError(
                    f"🚨 Insufficient stock for {product.name}. "
                    f"Requested: {requested_qty} units, Available: {available_qty} units. "
                    f"Please reduce quantity or select fewer items."
                )
        
        print(f"   ✅ All stock validations passed")
        return items
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        print(f"💳 InvoiceCreateSerializer.create: Creating invoice with {len(items_data)} items")

        with transaction.atomic():
            invoice = Invoice.objects.create(
                customer_name=validated_data['customer_name'],
                customer_phone=validated_data.get('customer_phone', ''),
                customer_dl_number=validated_data.get('customer_dl_number', ''),
                customer_address=validated_data.get('customer_address', ''),
                notes=validated_data.get('notes', ''),
                total_amount=Decimal('0.00'),
                gst_percent=validated_data.get('gst_percent') or Decimal('0.00'),
                discount_percent=validated_data.get('discount_percent') or Decimal('0.00'),
            )
            print(f"   ✅ Invoice created (ID: {invoice.id})")

            # ✅ STEP 2: FIFO batch deduction per requested item
            for item_idx, item in enumerate(items_data):
                product_id = int(item['product_id'])
                requested_qty = int(item['quantity'])
                batch_number = item['batch_number']
                
                print(f"\n   📦 Item {item_idx + 1}: {requested_qty} units of product {product_id}")
                
                # Get the product and sort batches by expiry_date (FIFO - earliest expiry first)
                product = Product.objects.get(id=product_id)
                available_batches = product.batches.filter(quantity__gt=0).order_by('expiry_date').select_for_update()
                
                print(f"      Available batches (FIFO order): {list(available_batches.values_list('batch_number', 'quantity', 'expiry_date'))}")
                
                remaining_qty = requested_qty
                batches_used = []
                
                # Deduct from batches in FIFO order
                for batch in available_batches:
                    if remaining_qty <= 0:
                        break
                    
                    deduct_qty = min(remaining_qty, batch.quantity)
                    batch.quantity -= deduct_qty
                    batch.save(update_fields=['quantity'])
                    remaining_qty -= deduct_qty
                    
                    print(f"      - Deducted {deduct_qty} from batch {batch.batch_number} (remaining: {remaining_qty})")
                    batches_used.append({
                        'batch_number': batch.batch_number,
                        'quantity_deducted': deduct_qty
                    })
                
                if remaining_qty > 0:
                    raise serializers.ValidationError(
                        f"❌ Failed to deduct all quantity for item {item_idx + 1}. "
                        f"Remaining: {remaining_qty} units could not be fulfilled."
                    )
                
                # Create InvoiceItem from the FIRST batch (for invoice record)
                # This maintains the original behavior while using FIFO for deduction
                first_batch = available_batches.first()
                if first_batch is None:
                    raise serializers.ValidationError(
                        f"No available batches found for product {product_id}"
                    )
                
                selling_rate = Decimal(item.get('selling_rate', '0')).quantize(
                    Decimal('0.01'),
                    rounding=ROUND_HALF_UP
                )
                
                # 🆕 Fetch HSN code and GST rate from Product's HSN field
                hsn_code = product.hsn.hsn_code if product.hsn else ''
                gst_rate = product.hsn.gst_rate if product.hsn else Decimal('0')

                # ✅ CREATE SNAPSHOT (NO product FK)
                InvoiceItem.objects.create(
                    invoice=invoice,
                    product_name=product.name,
                    batch_number=first_batch.batch_number,
                    expiry_date=first_batch.expiry_date,
                    hsn_code=hsn_code,
                    quantity=requested_qty,
                    original_selling_rate=first_batch.selling_rate,
                    selling_rate=selling_rate,
                    mrp=first_batch.mrp,
                    discount_percent=Decimal(str(item.get('discount_percent', 0))).quantize(
                        Decimal('0.01'),
                        rounding=ROUND_HALF_UP
                    ),
                    gst_percent=Decimal(str(item.get('gst_percent', gst_rate))).quantize(
                        Decimal('0.01'),
                        rounding=ROUND_HALF_UP
                    ),
                    is_return=item.get('is_return', False),
                    return_reason=item.get('return_reason', ''),
                )
                print(f"      ✅ InvoiceItem created for {requested_qty} units")
                
            invoice.calculate_totals()
            print(f"   ✅ Invoice totals calculated")

        print(f"✅ Invoice {invoice.id} created successfully\n")
        return invoice




class SalesBillSerializer(serializers.ModelSerializer):
    invoice = InvoiceSerializer(read_only=True)
    
    class Meta:
        model = SalesBill
        fields = [
            'id', 'invoice', 'total_amount', 'amount_paid', 'amount_due',
            'payment_status', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['amount_due', 'payment_status', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        """Override to convert Decimal('NaN') to null for JSON safety"""
        data = super().to_representation(instance)
        # Convert NaN to null (JSON-safe)
        if 'amount_due' in data and data['amount_due'] is not None:
            try:
                # Check if it's NaN (works for both float and Decimal)
                if str(data['amount_due']).lower() == 'nan':
                    data['amount_due'] = None
            except:
                pass
        return data


class SalesBillUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesBill
        fields = ['amount_paid', 'notes']


class PurchaseBillCreateSerializer(serializers.Serializer):
    """Serializer for creating purchase bills with wholesaler_name"""
    bill_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    purchase_date = serializers.DateField(required=False, allow_null=True)
    wholesaler_name = serializers.CharField(max_length=255, required=True)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        from .models import PurchaseBill, Wholesaler
        
        # Get or create wholesaler
        wholesaler_name = validated_data.pop('wholesaler_name')
        contact_number = validated_data.pop('contact_number', '')
        bill_number = validated_data.pop('bill_number', None)
        purchase_date = validated_data.pop('purchase_date', None)
        
        wholesaler, _ = Wholesaler.objects.get_or_create(
            name=wholesaler_name,
            defaults={'contact_number': contact_number}
        )
        
        # Create purchase bill with optional bill_number and purchase_date
        purchase_bill = PurchaseBill.objects.create(
            wholesaler=wholesaler,
            bill_number=bill_number or '',
            purchase_date=purchase_date,
            **validated_data
        )
        
        return purchase_bill


class PurchaseBillSerializer(serializers.ModelSerializer):
    wholesaler_name = serializers.CharField(source='wholesaler.name', read_only=True)
    wholesaler_contact = serializers.CharField(
        source='wholesaler.contact_number',
        read_only=True
    )

    
    class Meta:
        model = PurchaseBill
        fields = [
            'id', 'bill_number', 'purchase_date', 'wholesaler', 'wholesaler_name', 'wholesaler_contact', 'total_amount', 'amount_paid', 'amount_due',
            'payment_status', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['amount_due', 'payment_status', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        """Override to convert Decimal('NaN') to null for JSON safety"""
        data = super().to_representation(instance)
        # Convert NaN to null (JSON-safe)
        if 'amount_due' in data and data['amount_due'] is not None:
            try:
                # Check if it's NaN (works for both float and Decimal)
                if str(data['amount_due']).lower() == 'nan':
                    data['amount_due'] = None
            except:
                pass
        return data


class PurchaseBillUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseBill
        fields = ['bill_number', 'purchase_date', 'amount_paid', 'notes']


class ShopProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopProfile
        fields = [
            "id",
            "shop_name",
            "owner_name",
            "phone",
            "address",
            "gst_number",
            "dl_number",
        ]
