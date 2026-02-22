import os
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
# Ensure project root (backend) is on path for imports when run directly
ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
import django
django.setup()
from inventory.models import Product, Batch
from django.test import Client
import json

# Create test product
p, created = Product.objects.get_or_create(name='TEST_MIN_STOCK_5', defaults={'product_type':'tablet','min_stock_level':5})
if not created:
    p.min_stock_level = 5
    p.save()
# Remove existing batches for test product
p.batches.all().delete()
# Add a batch with quantity 2 (below 5)
Batch.objects.create(product=p, batch_number='TESTB1', mrp=10, selling_rate=8, cost_price=7, quantity=2, expiry_date='2030-01-01')

# Use test client to call view (no auth)
from inventory.models import Product

# Compute low stock items using same logic as the API (no HTTP call)
low_stock_items = []
for product in Product.objects.prefetch_related('batches').all():
    current_stock = sum(b.quantity for b in product.batches.all() if b.quantity > 0)
    min_stock_level = getattr(product, 'min_stock_level', 10)
    if current_stock <= min_stock_level:
        units_below = max(0, min_stock_level - current_stock)
        severity = 'critical' if current_stock <= (min_stock_level / 2) else 'warning'
        low_stock_items.append({
            'product_id': product.id,
            'product_name': product.name,
            'current_stock': current_stock,
            'min_stock_level': min_stock_level,
            'minStockAlert': min_stock_level,
            'severity': severity,
            'units_below': units_below,
        })

import json
print(json.dumps({'count': len(low_stock_items), 'low_stock_items': low_stock_items}, indent=2))
