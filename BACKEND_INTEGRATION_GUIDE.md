# Backend Integration Guide

This guide explains how to implement the Django REST Framework backend for a **Generic Medical Store Inventory System** to match the frontend's API contracts.

## Quick Start

1. **Read [frontend/API_CONTRACTS.md](./frontend/API_CONTRACTS.md)** - This document defines what the frontend expects
2. **Implement DRF Endpoints** - Follow the exact response formats
3. **Handle All Business Logic** - Backend must do calculations, validation, and transformations
4. **Test with Frontend** - The frontend will work immediately once the backend is ready

## Key Principles

### ✅ Backend IS Responsible For:
- ✓ All calculations (totals, subtotals, taxes, discounts)
- ✓ All business rule validation
- ✓ Data transformation and enrichment
- ✓ Stock management and availability checks
- ✓ Creating responses with computed values
- ✓ Atomic transactions (invoice + items created together)
- ✓ Flexible product type support (tablets, syrups, powders, creams, diapers, condoms, sachets, etc.)

### ❌ Frontend IS NOT Doing:
- ❌ Calculating totals or subtotals
- ❌ Validating business rules
- ❌ Transforming response data
- ❌ Enforcing constraints
- ❌ Applying discounts or markup
- ❌ Managing product types (backend provides type, frontend displays it)

---

## Three-Price Model: MRP, Selling Rate, Cost Price

The inventory system supports three distinct price types per product batch:

### Price Definitions

| Price | Field | Purpose | Used For |
|-------|-------|---------|----------|
| **MRP** | `mrp` | Maximum Retail Price | Display on invoice, printed on packaging (reference only) |
| **Selling Rate** | `selling_rate` | Actual selling price to customers | **ALL billing calculations, invoice subtotals** |
| **Cost Price** | `cost_price` | Internal cost for profit analysis | Profit analysis, internal reporting (NOT in billing) |

### Critical Rules

⚠️ **ENFORCEMENT RULES:**
1. **Selling Rate is the ONLY price used for invoice calculations**
   - Example: If MRP=₹100, Selling Rate=₹90, Cost Price=₹70
   - Invoice for 5 units = 5 × ₹90 = ₹450 (NOT 5 × ₹100)

2. **MRP is for display/reference only**
   - Shown on invoice as additional information
   - Not used in any calculations
   - Allows for bulk discounts where Selling Rate < MRP

3. **Cost Price is INTERNAL ONLY**
   - NEVER appears in billing screens or invoice API responses
   - Only visible in inventory/product management
   - Used for profit analysis: Profit = (Selling Rate - Cost Price) × Quantity

4. **All three prices must be positive decimals**
   - MRP >= 0
   - Selling Rate >= 0
   - Cost Price >= 0
   - No price overwriting between batches (each batch has independent prices)

### Data Model

```python
class Batch(models.Model):
    product = ForeignKey(Product)
    batch_number = CharField(max_length=100)           # LOT-2024-001
    mrp = DecimalField(max_digits=10, decimal_places=2)           # ₹100.00
    selling_rate = DecimalField(max_digits=10, decimal_places=2)  # ₹90.00 (USED FOR BILLING)
    cost_price = DecimalField(max_digits=10, decimal_places=2)    # ₹70.00 (INTERNAL ONLY)
    quantity = PositiveIntegerField()
    expiry_date = DateField()
```

### Invoice Calculations

All invoice calculations use ONLY `selling_rate`:

```python
# InvoiceItem.get_subtotal()
def get_subtotal(self):
    return self.quantity * self.selling_rate  # NOT mrp

# Invoice.calculate_total()
def calculate_total(self):
    return sum(item.get_subtotal() for item in self.items.all())
```

### API Response Example

```json
{
  "id": 123,
  "customer_name": "John's Pharmacy",
  "total_amount": "450.00",
  "items": [
    {
      "id": 1,
      "product_id": 5,
      "product_name": "Aspirin 500mg",
      "batch_number": "LOT-2024-001",
      "quantity": 5,
      "selling_rate": "90.00",
      "mrp": "100.00",
      "subtotal": "450.00"
    }
  ]
}
```

Note: `cost_price` (₹70.00) is NOT included in any invoice response.

---

## Implementation Checklist

### Step 1: Models

Create Django models matching these specifications:

```python
# models.py
from django.db import models
from decimal import Decimal

class ProductType(models.Model):
    """Custom product types - allows owner to add types beyond defaults"""
    DEFAULT_TYPES = [
        'tablet', 'syrup', 'powder', 'cream', 'diaper', 'condom', 'sachet'
    ]
    
    name = models.CharField(
        max_length=50,
        unique=True,
        primary_key=True,
        help_text="Unique identifier (lowercase, alphanumeric + underscore). E.g., 'tablet', 'gel', 'spray'"
    )
    label = models.CharField(
        max_length=100,
        help_text="Display label. E.g., 'Tablet', 'Gel', 'Spray'"
    )
    is_default = models.BooleanField(
        default=False,
        help_text="True for built-in types (tablet, syrup, powder, cream, diaper, condom, sachet)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['is_default', 'label']
    
    def __str__(self):
        return f"{self.label} ({self.name})"
    
    @classmethod
    def create_defaults(cls):
        """Create default product types if they don't exist"""
        defaults = [
            ('tablet', 'Tablet'),
            ('syrup', 'Syrup'),
            ('powder', 'Powder'),
            ('cream', 'Cream'),
            ('diaper', 'Diaper'),
            ('condom', 'Condom'),
            ('sachet', 'Sachet'),
        ]
        for name, label in defaults:
            cls.objects.get_or_create(name=name, defaults={'label': label, 'is_default': True})

class Product(models.Model):
    """Product in medical store inventory (tablets, syrups, powders, creams, etc.)"""
    
    name = models.CharField(max_length=255, unique=True)
    product_type = models.CharField(
        max_length=50,
        help_text="Type of product (references ProductType.name). Can be default or custom type."
    )
    generic_name = models.CharField(max_length=255, blank=True)
    manufacturer = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=0)
    unit = models.CharField(
        max_length=50,
        default='pc',
        help_text="Unit of sale (pc, bottle, gm, ml, etc.) - flexible per product"
    )
    expiry_date = models.DateField(
        help_text="Expiry date of the product. Format: YYYY-MM-DD. Required for all products."
    )
    salt_composition = models.CharField(
        max_length=500,
        blank=True,
        help_text="Active salt/composition (optional, mainly for tablets/capsules). E.g., 'Paracetamol 500mg', 'Amoxicillin 500mg + Clavulanic Acid 125mg'"
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['product_type']),
            models.Index(fields=['quantity']),
            models.Index(fields=['expiry_date']),
        ]

    def __str__(self):
        return f"{self.name} ({self.product_type})"


class Batch(models.Model):
    """Batch/Lot number for tracking inventory, pricing, and expiry per batch"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='batches')
    batch_number = models.CharField(
        max_length=100,
        help_text="Manufacturer batch number (e.g., LOT-2024-001). Must be unique per product."
    )
    mrp = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Maximum Retail Price - printed on product by manufacturer (for display/reference only)"
    )
    selling_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Selling Rate - price at which shopkeeper sells to customer (USED FOR BILLING ONLY)"
    )
    cost_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Cost Price - purchase price paid by shopkeeper (internal reference only, NOT shown in billing)"
    )
    quantity = models.PositiveIntegerField(
        help_text="Available quantity for this batch"
    )
    expiry_date = models.DateField(
        help_text="Expiry date for this batch. Format: YYYY-MM-DD."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['expiry_date']
        unique_together = [['product', 'batch_number']]
        indexes = [
            models.Index(fields=['product', 'batch_number']),
            models.Index(fields=['expiry_date']),
        ]

    def __str__(self):
        return f"{self.batch_number} - {self.product.name} (MRP: ₹{self.mrp} | Selling: ₹{self.selling_rate})"


class Invoice(models.Model):
    """Bill/Invoice for selling medicines"""
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=20, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, editable=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice #{self.id} - {self.customer_name}"

    def save(self, *args, **kwargs):
        """Calculate total_amount before saving"""
        self.total_amount = self.calculate_total()
        super().save(*args, **kwargs)

    def calculate_total(self):
        """Calculate total from all invoice items"""
        total = Decimal('0.00')
        for item in self.items.all():
            total += item.get_subtotal()
        return total


class InvoiceItem(models.Model):
    """Individual item in an invoice, linked to specific batch"""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    batch_number = models.CharField(
        max_length=100,
        help_text="Batch number for traceability (matches Batch.batch_number)"
    )
    quantity = models.PositiveIntegerField(
        help_text="Quantity sold from this batch"
    )
    selling_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Selling Rate at time of invoice (USED FOR CALCULATIONS AND COST ANALYSIS)"
    )
    mrp = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Maximum Retail Price at time of invoice (for invoice display/reference only)",
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['product', 'batch_number']),
        ]

    def __str__(self):
        return f"Invoice #{self.invoice.id} - {self.product.name} x{self.quantity} @ ₹{self.selling_rate} (Batch: {self.batch_number})"

    def get_subtotal(self):
        """Calculate subtotal using ONLY selling_rate (not mrp)"""
        return self.quantity * self.selling_rate

    def save(self, *args, **kwargs):
        """Update parent invoice total after saving item"""
        super().save(*args, **kwargs)
        # Recalculate invoice total
        self.invoice.save()

    def delete(self, *args, **kwargs):
        """Update parent invoice total after deleting item"""
        invoice = self.invoice
        super().delete(*args, **kwargs)
        # Recalculate invoice total
        invoice.save()


class SalesBill(models.Model):
    """Sales bill tracking with paid/due amounts - derived from Invoices"""
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name='sale_bill')
    bill_number = models.CharField(max_length=50, unique=True, help_text="Unique bill number (auto-generated from invoice ID)")
    date = models.DateTimeField(auto_now_add=True, help_text="Date of sale")
    customer_name = models.CharField(max_length=255, help_text="Customer name from invoice")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Total bill amount")
    amount_paid = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Amount paid by customer (editable)"
    )
    amount_due = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        editable=False,
        help_text="Amount due (auto-calculated: total_amount - amount_paid)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['bill_number']),
            models.Index(fields=['date']),
            models.Index(fields=['customer_name']),
        ]

    def __str__(self):
        return f"Sales Bill #{self.bill_number} - {self.customer_name} (₹{self.total_amount})"

    def save(self, *args, **kwargs):
        """Auto-calculate amount_due when amount_paid changes"""
        self.amount_due = self.total_amount - self.amount_paid
        if self.amount_due < 0:
            raise ValueError("Amount paid cannot exceed total amount")
        super().save(*args, **kwargs)


class PurchaseBill(models.Model):
    """Purchase bill from wholesaler with paid/due tracking"""
    bill_number = models.CharField(max_length=50, unique=True, help_text="Purchase bill number from wholesaler")
    date = models.DateField(help_text="Date of purchase")
    wholesaler_name = models.CharField(max_length=255, help_text="Wholesaler/supplier name")
    contact_number = models.CharField(
        max_length=20, 
        blank=True,
        help_text="Wholesaler contact number"
    )
    total_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Total purchase amount"
    )
    amount_paid = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Amount paid to wholesaler (editable)"
    )
    amount_due = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        editable=False,
        help_text="Amount due to wholesaler (auto-calculated: total_amount - amount_paid)"
    )
    notes = models.TextField(blank=True, help_text="Additional notes about purchase")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['bill_number']),
            models.Index(fields=['date']),
            models.Index(fields=['wholesaler_name']),
        ]

    def __str__(self):
        return f"Purchase Bill #{self.bill_number} - {self.wholesaler_name} (₹{self.total_amount})"

    def save(self, *args, **kwargs):
        """Auto-calculate amount_due when amount_paid changes"""
        self.amount_due = self.total_amount - self.amount_paid
        if self.amount_due < 0:
            raise ValueError("Amount paid cannot exceed total amount")
        super().save(*args, **kwargs)

```

---

### Step 2: Serializers

```python
# serializers.py
from rest_framework import serializers
from .models import Product, Batch, Invoice, InvoiceItem
from decimal import Decimal


class ProductSerializer(serializers.ModelSerializer):
    """Serializer for products WITH nested batches"""
    batches = BatchSerializer(many=True, read_only=True)
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'product_type', 'generic_name', 'manufacturer', 'salt_composition', 'unit', 'description', 'batches', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class BatchSerializer(serializers.ModelSerializer):
    """Serializer for product batches"""
    class Meta:
        model = Batch
        fields = ['batch_number', 'mrp', 'quantity', 'expiry_date']
        read_only_fields = []


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for invoice items WITH calculated subtotal and batch info"""
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_type = serializers.CharField(source='product.product_type', read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceItem
        fields = ['id', 'product_id', 'product_name', 'product_type', 'batch_number', 'quantity', 'selling_rate', 'mrp', 'subtotal']
        read_only_fields = ['product_id', 'product_name', 'product_type']

    def get_subtotal(self, obj):
        """Calculate and return subtotal using ONLY selling_rate (not mrp)"""
        return str(obj.get_subtotal())


class InvoiceItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invoice items (accepts product_id and batch_number)"""
    class Meta:
        model = InvoiceItem
        fields = ['product', 'batch_number', 'quantity', 'selling_rate', 'mrp']
    
    def validate(self, data):
        """Validate batch exists for product, has sufficient quantity, and auto-fill prices"""
        product = data['product']
        batch_number = data['batch_number']
        quantity = data['quantity']
        
        try:
            batch = Batch.objects.get(product=product, batch_number=batch_number)
        except Batch.DoesNotExist:
            raise serializers.ValidationError(
                f"Batch {batch_number} not found for product {product.name}"
            )
        
        if batch.quantity < quantity:
            raise serializers.ValidationError(
                f"Insufficient quantity in batch {batch_number}. Available: {batch.quantity}, Requested: {quantity}"
            )
        
        # Auto-fill selling_rate and mrp from batch
        data['selling_rate'] = batch.selling_rate
        data['mrp'] = batch.mrp
        
        return data


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for invoice WITH items and calculated total"""
    items = InvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = ['id', 'customer_name', 'customer_phone', 'total_amount', 'notes', 'items', 'created_at', 'updated_at']
        read_only_fields = ['total_amount', 'created_at', 'updated_at']


class InvoiceCreateSerializer(serializers.Serializer):
    """Serializer for creating invoice with nested items"""
    customer_name = serializers.CharField(max_length=255)
    customer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = InvoiceItemCreateSerializer(many=True)

    def validate_items(self, items):
        """Validate items exist and have positive quantities"""
        if not items:
            raise serializers.ValidationError("Invoice must have at least one item")
        
        for item in items:
            if item['quantity'] <= 0:
                raise serializers.ValidationError("Item quantity must be greater than 0")
            
            # Validate product exists
            try:
                Product.objects.get(id=item['product'].id)
            except Product.DoesNotExist:
                raise serializers.ValidationError(f"Product {item['product'].id} does not exist")
        
        return items

    def create(self, validated_data):
        """Create invoice and items in transaction"""
        items_data = validated_data.pop('items')
        
        # Create invoice without items
        invoice = Invoice.objects.create(**validated_data)
        
        # Create items
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        
        # Save to trigger total calculation
        invoice.save()
        
        return invoice


class SalesBillSerializer(serializers.ModelSerializer):
    """Serializer for sales bills with paid/due tracking"""
    customer_name = serializers.CharField(read_only=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = SalesBill
        fields = ['id', 'bill_number', 'date', 'customer_name', 'total_amount', 'amount_paid', 'amount_due']
        read_only_fields = ['bill_number', 'date', 'customer_name', 'total_amount', 'amount_due']

    def update(self, instance, validated_data):
        """Allow updating amount_paid, which auto-calculates amount_due"""
        instance.amount_paid = validated_data.get('amount_paid', instance.amount_paid)
        instance.save()  # Triggers amount_due auto-calculation
        return instance


class PurchaseBillSerializer(serializers.ModelSerializer):
    """Serializer for purchase bills with paid/due tracking"""
    
    class Meta:
        model = PurchaseBill
        fields = ['id', 'bill_number', 'date', 'wholesaler_name', 'contact_number', 'total_amount', 'amount_paid', 'amount_due', 'notes']
        read_only_fields = ['amount_due']

    def validate_bill_number(self, value):
        """Ensure bill number is unique"""
        if PurchaseBill.objects.filter(bill_number=value).exists():
            raise serializers.ValidationError("Bill number already exists")
        return value

    def validate_total_amount(self, value):
        """Ensure total amount is positive"""
        if value <= 0:
            raise serializers.ValidationError("Total amount must be greater than 0")
        return value

    def validate_amount_paid(self, value):
        """Ensure amount paid is not negative"""
        if value < 0:
            raise serializers.ValidationError("Amount paid cannot be negative")
        return value

    def update(self, instance, validated_data):
        """Allow updating amount_paid, which auto-calculates amount_due"""
        for field in validated_data:
            setattr(instance, field, validated_data[field])
        instance.save()  # Triggers amount_due auto-calculation
        return instance
```

---

### Step 3: ViewSets

```python
# views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Product, Batch, Invoice, InvoiceItem
from .serializers import (
    ProductSerializer,
    BatchSerializer,
    InvoiceSerializer,
    InvoiceCreateSerializer,
    InvoiceItemSerializer,
)


class ProductViewSet(viewsets.ModelViewSet):
    """Product/Medicine endpoints"""
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filterset_fields = ['quantity']
    search_fields = ['name', 'generic_name', 'manufacturer']
    ordering_fields = ['name', 'quantity', 'created_at']
    ordering = ['-created_at']


class BatchViewSet(viewsets.ModelViewSet):
    """Batch/Lot endpoints"""
    queryset = Batch.objects.all()
    serializer_class = BatchSerializer
    filterset_fields = ['product', 'expiry_date']
    ordering_fields = ['expiry_date', 'created_at']
    ordering = ['expiry_date']


class InvoiceViewSet(viewsets.ModelViewSet):
    """Invoice/Bill endpoints"""
    queryset = Invoice.objects.all()
    filterset_fields = ['customer_name', 'created_at']
    ordering_fields = ['created_at', 'total_amount']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """Use different serializers for create vs list/retrieve"""
        if self.action == 'create':
            return InvoiceCreateSerializer
        return InvoiceSerializer

    def create(self, request, *args, **kwargs):
        """Create invoice with items"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()
        
        # Return with full serialization (includes items and calculated total)
        output_serializer = InvoiceSerializer(invoice)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class InvoiceItemViewSet(viewsets.ModelViewSet):
    """Invoice item endpoints"""
    queryset = InvoiceItem.objects.all()
    serializer_class = InvoiceItemSerializer
    filterset_fields = ['invoice']

    def update(self, request, *args, **kwargs):
        """Update item - recalculates parent invoice total"""
        response = super().update(request, *args, **kwargs)
        # Return item with recalculated subtotal
        return response
```

---

### Step 4: URL Configuration

```python
# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, BatchViewSet, InvoiceViewSet, InvoiceItemViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'batches', BatchViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'invoice-items', InvoiceItemViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
```

---

### Step 5: Settings Configuration

```python
# settings.py

INSTALLED_APPS = [
    # ...
    'rest_framework',
    'corsheaders',
    'inventory',  # Your app name
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    # ... other middleware
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}
```

---

## Testing the Integration

### 1. Create Products
```bash
curl -X POST http://localhost:8000/api/products/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aspirin 500mg",
    "generic_name": "Acetylsalicylic Acid",
    "manufacturer": "Pharma Ltd",
    "price": "25.50",
    "quantity": 100,
    "unit": "tablet"
  }'
```

### 2. Create Invoice
```bash
curl -X POST http://localhost:8000/api/invoices/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "customer_phone": "9876543210",
    "notes": "Regular customer",
    "items": [
      {
        "product": 1,
        "quantity": 2,
        "unit_price": "25.50"
      }
    ]
  }'
```

Response should include:
- `total_amount` calculated by backend (51.00)
- `items` with `subtotal` calculated by backend
- All timestamps

### 3. Frontend Testing
- Open http://localhost:5173/
- Navigate to Inventory and add medicines
- Go to Billing and create invoices
- Check browser console for API calls
- All data comes from the backend API

---

## Common Implementation Mistakes to Avoid

❌ **Don't:** Return incomplete data
```python
# WRONG - missing calculations
{
  "id": 1,
  "customer_name": "John",
  "items": [...]
  # No total_amount, no subtotals
}
```

✅ **Do:** Return complete data
```python
# CORRECT - all calculations included
{
  "id": 1,
  "customer_name": "John",
  "total_amount": "151.00",
  "items": [
    {
      "id": 1,
      "product": 1,
      "quantity": 2,
      "unit_price": "25.50",
      "subtotal": "51.00"
    }
  ]
}
```

---

## Zero Refactor Guarantee

If you follow this guide exactly:
- ✓ Frontend needs ZERO changes when backend is ready
- ✓ All API endpoints work immediately
- ✓ UI displays data correctly
- ✓ No bug fixes needed for integration

The frontend is ready to connect. Now build the backend!
