from django.db import models
from decimal import Decimal
from django.db.models import F, Sum
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db import transaction
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
    hsn_code = models.CharField(
        max_length=20,
        blank=True,
        help_text="HSN code for this product type"
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


class HSN(models.Model):
    """HSN (Harmonized System Nomenclature) Codes for GST classification"""
    
    hsn_code = models.CharField(
        max_length=20,
        unique=True,
        primary_key=True,
        help_text="Unique HSN code (e.g., 3004, 3003)"
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        help_text="Description of HSN code (e.g., 'Medicaments - Antibiotics')"
    )
    gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="GST rate (%) for this HSN code (e.g., 5, 12, 18)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this HSN code is active for use"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['hsn_code']
        indexes = [
            models.Index(fields=['hsn_code']),
            models.Index(fields=['gst_rate']),
        ]
    
    def __str__(self):
        return f"{self.hsn_code} - {self.gst_rate}% GST"


class Product(models.Model):
    """Product in medical store inventory (tablets, syrups, powders, creams, etc.)"""
    
    name = models.CharField(max_length=255, unique=True)
    product_type = models.CharField(
        max_length=50,
        help_text="Type of product (references ProductType.name). Can be default or custom type."
    )
    hsn = models.ForeignKey(
        HSN,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        help_text="HSN code for this product (used for GST classification)"
    )
    generic_name = models.CharField(max_length=255, blank=True)
    manufacturer = models.CharField(max_length=255, blank=True)
    unit = models.CharField(
        max_length=50,
        default='pc',
        help_text="Unit of sale (pc, bottle, gm, ml, etc.) - flexible per product"
    )
    salt_composition = models.CharField(
        max_length=500,
        blank=True,
        help_text="Active salt/composition (optional, mainly for tablets/capsules). E.g., 'Paracetamol 500mg'"
    )
    description = models.TextField(blank=True)
    min_stock_level = models.PositiveIntegerField(
        default=10,
        help_text="Minimum stock level for this product. Alert triggered when total quantity falls below this. Default is 10 units."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['product_type']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.product_type})"


class Batch(models.Model):
    """Batch/Lot number for tracking inventory, pricing, and expiry per batch"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='batches')
    wholesaler = models.ForeignKey('Wholesaler', on_delete=models.SET_NULL, null=True, blank=True, related_name='batches')
    batch_number = models.CharField(
        max_length=100,
        help_text="Manufacturer batch number (e.g., LOT-2024-001)"
    )
    mrp = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Maximum Retail Price - printed on product (for display/reference only)"
    )
    selling_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Selling Rate - price at which customer buys (USED FOR BILLING ONLY)"
    )
    cost_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Cost Price - purchase price (internal reference only, NOT shown in billing)"
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
        return f"{self.batch_number} - {self.product.name}"

class Wholesaler(models.Model):
    name = models.CharField(max_length=255, unique=True)
    contact_number = models.CharField(max_length=20, blank=True)
    gst_number = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['gst_number']),
        ]

    def __str__(self):
        return self.name

class Invoice(models.Model):
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=20, blank=True)
    customer_dl_number = models.CharField(max_length=100, blank=True, null=True, help_text="Customer Drug License Number")
    customer_address = models.TextField(blank=True, null=True, help_text="Customer Address")

    gst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="GST applied to entire invoice"
    )

    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Discount applied to entire invoice"
    )
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
    
    def calculate_totals(self):
        subtotal = sum(item.get_subtotal() for item in self.items.all())
    
        discount_amount = subtotal * (self.discount_percent / 100)
        taxable_amount = subtotal - discount_amount
    
        gst_amount = taxable_amount * (self.gst_percent / 100)
    
        self.total_amount = taxable_amount + gst_amount
        self.save(update_fields=['total_amount'])



class InvoiceItem(models.Model):
    """Individual item in an invoice, linked to specific batch"""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    product_name = models.CharField(max_length=255)
    batch_number = models.CharField(max_length=100)

    expiry_date = models.DateField(null=True, blank=True)
    hsn_code = models.CharField(max_length=50, blank=True)

    quantity = models.PositiveIntegerField(
        help_text="Quantity sold from this batch"
    )
    original_selling_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Original selling rate from batch (for price history)"
    )
    selling_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Final selling rate (may be edited during billing)"
    )
    mrp = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="MRP for reference/display only (not used in calculations)"
    )
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Discount percentage applied to this item"
    )
    gst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="GST percentage applicable to this item"
    )
    
    # Return fields
    is_return = models.BooleanField(
        default=False,
        help_text="Mark this item as a return (inventory will be increased)"
    )
    return_reason = models.CharField(
        max_length=255,
        blank=True,
        help_text="Reason for return (e.g., Defective, Expired, Customer Request)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['invoice', '-created_at']
        indexes = [
            models.Index(fields=['invoice']),
        ]

    def __str__(self):
        return f"{self.product_name} | Batch {self.batch_number} x{self.quantity}"

    def get_subtotal(self):
        """Calculate subtotal using SELLING RATE ONLY (NOT mrp)"""
        return Decimal(str(self.quantity)) * self.selling_rate
    
    def get_taxable_amount(self):
        amount = Decimal(self.quantity) * self.selling_rate
        discount = (amount * self.discount_percent) / Decimal('100')
        return amount - discount

    def get_gst_amount(self):
        return (self.get_taxable_amount() * self.gst_percent) / Decimal('100')

    def get_cgst(self):
        return self.get_gst_amount() / Decimal('2')

    def get_sgst(self):
        return self.get_gst_amount() / Decimal('2')

    def get_total_amount(self):
        return self.get_taxable_amount() + self.get_gst_amount()



class SalesBill(models.Model):
    """Track payment status for sales invoices"""
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('partial', 'Partial Payment'),
        ('paid', 'Paid'),
    ]
    
    invoice = models.OneToOneField(Invoice, on_delete=models.CASCADE, related_name='sales_bill')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='unpaid'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Sales Bill #{self.id} - {self.payment_status}"

    def save(self, *args, **kwargs):
        """Calculate amount_due and update payment_status"""
        # ✅ STRICT RULE: amount_due = NaN only when amount_paid === 0
        # When no payment received yet, amount due is undefined/infinite
        # When payment started, calculate exact amount due
        if self.amount_paid == 0:
            # Use Decimal('NaN') to mark "amount due undefined when no payment received"
            # Serializer will convert this to null for JSON safety
            self.amount_due = Decimal('NaN')
        else:
            self.amount_due = self.total_amount - self.amount_paid
        
        # Update payment status based on amounts
        if self.amount_paid >= self.total_amount:
            self.payment_status = 'paid'
        elif self.amount_paid > 0:
            self.payment_status = 'partial'
        else:
            self.payment_status = 'unpaid'
        
        super().save(*args, **kwargs)


class PurchaseBill(models.Model):
    """Track payment status for purchase invoices"""
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('partial', 'Partial Payment'),
        ('paid', 'Paid'),
    ]
    
    bill_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Purchase bill number (assigned by user or system)"
    )
    purchase_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date of purchase"
    )
    wholesaler = models.ForeignKey('Wholesaler', on_delete=models.CASCADE, related_name='purchase_bills')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='unpaid'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Purchase Bill #{self.id} - {self.wholesaler}"

    def save(self, *args, **kwargs):
        """Calculate amount_due and update payment_status"""
        # ✅ STRICT RULE: amount_due = NaN only when amount_paid === 0
        # When no payment received yet, amount due is undefined/infinite
        # When payment started, calculate exact amount due
        if self.amount_paid == 0:
            # Use Decimal('NaN') to mark "amount due undefined when no payment received"
            # Serializer will convert this to null for JSON safety
            self.amount_due = Decimal('NaN')
        else:
            self.amount_due = self.total_amount - self.amount_paid
        
        # Update payment status based on amounts
        if self.amount_paid >= self.total_amount:
            self.payment_status = 'paid'
        elif self.amount_paid > 0:
            self.payment_status = 'partial'
        else:
            self.payment_status = 'unpaid'
        
        super().save(*args, **kwargs)


    
class StoreSettings(models.Model):
    store_name = models.CharField(max_length=255)
    gst_number = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Store Settings"
    
    def save(self, *args, **kwargs):
        self.pk = 1  # force single row
        super().save(*args, **kwargs)


class ShopProfile(models.Model):
    shop_name = models.CharField(max_length=200)
    owner_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField()
    gst_number = models.CharField(max_length=50, blank=True, null=True)
    dl_number = models.CharField(max_length=100, blank=True, null=True, help_text="Drug License Number")

    def __str__(self):
        return self.shop_name
