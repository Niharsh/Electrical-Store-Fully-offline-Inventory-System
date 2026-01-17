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
        indexes = [
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"Invoice #{self.id} - {self.customer_name}"

    def save(self, *args, **kwargs):
        """Calculate total_amount before saving"""
        self.total_amount = self.calculate_total()
        super().save(*args, **kwargs)

    def calculate_total(self):
        """Calculate total from all invoice items using SELLING RATE ONLY"""
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
        help_text="Batch number for traceability"
    )
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['invoice', '-created_at']
        indexes = [
            models.Index(fields=['invoice']),
        ]

    def __str__(self):
        return f"InvoiceItem #{self.id} - {self.product.name} x{self.quantity}"

    def get_subtotal(self):
        """Calculate subtotal using SELLING RATE ONLY (NOT mrp)"""
        return Decimal(str(self.quantity)) * self.selling_rate


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
    
    wholesaler = models.CharField(max_length=255)
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
        self.amount_due = self.total_amount - self.amount_paid
        
        # Update payment status based on amounts
        if self.amount_paid >= self.total_amount:
            self.payment_status = 'paid'
        elif self.amount_paid > 0:
            self.payment_status = 'partial'
        else:
            self.payment_status = 'unpaid'
        
        super().save(*args, **kwargs)
