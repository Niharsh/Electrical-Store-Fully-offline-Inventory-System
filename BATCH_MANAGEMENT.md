# Batch & MRP Management

## Overview

The inventory system supports **multiple batches per product** with **three independent price points** (MRP, Selling Rate, Cost Price) and batch-specific quantities and expiry dates. This enables tracking pharmaceutical products by batch for:

- **Batch-specific pricing**: Different batches of the same product can have different prices
- **Multi-price model**: 
  - **MRP (Maximum Retail Price)**: For display/reference on invoices
  - **Selling Rate**: The actual price used for ALL billing calculations
  - **Cost Price**: Internal reference for profit analysis
- **Inventory segregation**: Manage stock separately for each batch
- **Expiry tracking**: Each batch has independent expiry dates
- **Traceability**: Invoices link to specific batches for compliance and recalls

---

## Data Model

### Product Structure

Products no longer have a single `price` and `quantity`. Instead, pricing and inventory are managed at the **batch level** with **three independent prices per batch**:

```javascript
{
  "id": 1,
  "name": "Aspirin 500mg",
  "product_type": "tablet",
  "generic_name": "Acetylsalicylic Acid",
  "manufacturer": "Pharma Ltd",
  "salt_composition": "Paracetamol 500mg",
  "unit": "pc",
  "description": "Pain reliever",
  "batches": [
    {
      "batch_number": "LOT-2024-001",
      "mrp": 25.50,
      "selling_rate": 25.00,
      "cost_price": 18.00,
      "quantity": 100,
      "expiry_date": "2026-12-31"
    },
    {
      "batch_number": "LOT-2024-002",
      "mrp": 26.00,
      "selling_rate": 25.50,
      "cost_price": 19.00,
      "quantity": 50,
      "expiry_date": "2027-06-30"
    }
  ]
}
```

### Three-Price Model

Each batch has three independent prices:

| Price | Field | Purpose | Visibility | Used In |
|-------|-------|---------|------------|----------|
| **MRP** | `mrp` | Maximum Retail Price | Display on invoice (reference) | Invoice printing, product display |
| **Selling Rate** | `selling_rate` | Actual selling price to customers | Billing screens, auto-filled | **ALL billing calculations** |
| **Cost Price** | `cost_price` | Internal cost for profit analysis | Inventory/reports only | Profit margin calculation (NOT billing) |

### Key Concepts

**Batch (Lot)**: A shipment or manufacturing unit of a product
- **batch_number** (string, unique per product): Manufacturer identifier (e.g., "LOT-2024-001")
- **mrp** (decimal): Manufacturing Recommended Price (reference, display only)
- **selling_rate** (decimal): Actual selling price (USED FOR ALL CALCULATIONS)
- **cost_price** (decimal): Cost to acquire (internal reference only)
- **quantity** (integer): Available stock of this batch
- **expiry_date** (date, format YYYY-MM-DD): When this batch expires

**Product Total Stock**: Sum of all batch quantities
```
Total Stock = Sum(batch.quantity for all batches)
```

**MRP Range**: Lowest to highest MRP across all batches
```
MRP Min = Min(batch.mrp for all batches)
MRP Max = Max(batch.mrp for all batches)
```

**Cost Price (Internal)**: NOT aggregated or shown, only visible per-batch in inventory

---

## Price Usage Rules (CRITICAL)

### ✅ Selling Rate (Used for Billing)
```
Invoice Subtotal = Quantity × Selling Rate (NOT MRP)

Example:
- MRP: ₹100
- Selling Rate: ₹90 (bulk discount)
- Cost Price: ₹70
- Quantity: 5

Invoice Total = 5 × ₹90 = ₹450 (NOT 5 × ₹100 = ₹500)
Profit = (₹90 - ₹70) × 5 = ₹100
```

### ✅ MRP (Reference/Display)
```
Shown on invoice as:
"Selling Rate: ₹90 | MRP: ₹100 (Reference)"

MRP indicates the official maximum price but actual billing uses Selling Rate.
```

### ✅ Cost Price (Internal Only)
```
Used for profit analysis:
Profit Margin = (Selling Rate - Cost Price) / Selling Rate
Profit Margin = (₹90 - ₹70) / ₹90 = 22.2%

NOT shown in any billing screens or invoices.
NEVER used in customer-facing calculations.
```

---

## Frontend Behavior

### Product Creation (AddProductForm)

1. User enters product details (name, type, generic_name, manufacturer, etc.)
2. User adds one or more batches with **three independent prices**:
   - Batch number (required, must be unique within product)
   - MRP (required, must be > 0)
   - Selling Rate (required, must be > 0)
   - Cost Price (required, must be >= 0)
   - Quantity (required, must be >= 0)
   - Expiry date (required, must be today or future)
3. Form validates:
   - ✅ At least one batch required
   - ✅ No duplicate batch numbers
   - ✅ All batch fields filled
   - ✅ MRP > 0, Selling Rate > 0, Cost Price >= 0
4. Submit creates product with all batches in one request

**Example Form Input**:
```javascript
{
  "name": "Aspirin 500mg",
  "product_type": "tablet",
  "generic_name": "Acetylsalicylic Acid",
  "manufacturer": "Pharma Ltd",
  "batches": [
    {
      "batch_number": "LOT-2024-001",
      "mrp": 25.50,
      "selling_rate": 25.00,
      "cost_price": 18.00,
      "quantity": 100,
      "expiry_date": "2026-12-31"
    }
  ]
}
```

### Product Display (ProductList)

For each product, the list shows:
- **Product name, type, generic name**
- **Total Quantity**: Sum of all batch quantities
- **MRP Range**: "₹25.50 - ₹26.00" (or single value if one batch)
- **Batch Count**: "2 batches" (clickable badge)
- **Expandable Details**: Click to see all batches with:
  - Batch number
  - **All three prices**: MRP | Selling Rate | Cost Price
  - Quantity for that batch
  - Expiry date

**Example Display**:
```
Product: Aspirin 500mg (Tablet)
Generic: Acetylsalicylic Acid
Total Qty: 150 | MRP: ₹25.50 - ₹26.00 | [Batches: 2]

[Click to expand batches]
├─ LOT-2024-001: MRP ₹25.50 | Selling ₹25.00 | Cost ₹18.00 | Qty 100 | Expires 2026-12-31
└─ LOT-2024-002: MRP ₹26.00 | Selling ₹25.50 | Cost ₹19.00 | Qty 50 | Expires 2027-06-30
```

### Billing (BillingForm)

1. User selects product
2. **Batch dropdown auto-populates** with available batches:
   ```
   ├─ LOT-2024-001 (Qty: 100)
   └─ LOT-2024-002 (Qty: 50)
   ```
3. **Selecting batch auto-fills BOTH prices**:
   - **Selling Rate field** (primary, disabled): ₹25.00 (used for calculations)
   - **MRP field** (reference, lighter gray, disabled): ₹25.50
   - **Cost Price**: Hidden (internal only)
4. User enters quantity (validated against selected batch's available quantity)
5. **Total calculation uses ONLY Selling Rate**: Quantity × Selling Rate (shown in bold green)
6. Submit creates invoice with batch_number, selling_rate, and mrp preserved

**Example Invoice Item**:
```javascript
{
  "product_id": 1,
  "batch_number": "LOT-2024-001",
  "quantity": 5,
  "selling_rate": 25.00,
  "mrp": 25.50
}
```

**Billing Screen Info Box**:
```
ℹ️ Selling Rate (₹25.00) is used for billing calculations
   MRP (₹25.50) is shown for reference only
   Cost Price is internal only (not visible in billing)
```

---

## Backend Implementation Guide

### Database Model

**Batch Model** (new, related to Product):
```python
class Batch(models.Model):
    product = ForeignKey(Product, on_delete=CASCADE, related_name='batches')
    batch_number = CharField(max_length=100)  # Unique per product
    mrp = DecimalField(max_digits=10, decimal_places=2)
    quantity = PositiveIntegerField()
    expiry_date = DateField()
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['product', 'batch_number']]
        indexes = [
            Index(fields=['product', 'batch_number']),
            Index(fields=['expiry_date']),
        ]
```

**Product Model** (updated):
- ❌ Remove: `price` field
- ❌ Remove: `quantity` field
- ❌ Remove: `expiry_date` field (moved to Batch)
- ✅ Add: `batches` reverse relationship from Batch model
- Frontend calculates totals from batches

**InvoiceItem Model** (updated):
```python
class InvoiceItem(models.Model):
    invoice = ForeignKey(Invoice, on_delete=CASCADE, related_name='items')
    product = ForeignKey(Product, on_delete=PROTECT)
    batch_number = CharField(max_length=100)  # Traceability
    quantity = PositiveIntegerField()
    mrp = DecimalField(max_digits=10, decimal_places=2)  # Snapshot of price
    created_at = DateTimeField(auto_now_add=True)
    
    def get_subtotal(self):
        return self.quantity * self.mrp
```

**Key Points**:
- `batch_number` is stored as string (not FK) for invoice immutability
- `mrp` is stored as snapshot (what price was at invoice time)
- Quantity deductions happen from the specific batch only

### API Endpoints

**POST /products/** - Create product with batches

Request:
```json
{
  "name": "Aspirin 500mg",
  "product_type": "tablet",
  "generic_name": "Acetylsalicylic Acid",
  "manufacturer": "Pharma Ltd",
  "batches": [
    {
      "batch_number": "LOT-2024-001",
      "mrp": "25.50",
      "quantity": 100,
      "expiry_date": "2026-12-31"
    }
  ]
}
```

Response: 201 Created with all batches

---

**GET /products/** - List all products with batches

Response includes:
```json
{
  "id": 1,
  "name": "Aspirin 500mg",
  "batches": [
    {
      "batch_number": "LOT-2024-001",
      "mrp": "25.50",
      "quantity": 100,
      "expiry_date": "2026-12-31"
    }
  ]
}
```

---

**POST /invoices/** - Create invoice with batch-specific items

Request:
```json
{
  "customer_name": "John Doe",
  "items": [
    {
      "product_id": 1,
      "batch_number": "LOT-2024-001",
      "quantity": 5,
      "mrp": "25.50"
    }
  ]
}
```

Backend must:
1. ✅ Validate product exists
2. ✅ Validate batch exists for product
3. ✅ Validate batch has sufficient quantity
4. ✅ Deduct from specified batch only
5. ✅ Calculate total (sum of quantity × mrp per item)
6. ✅ Create invoice and items in transaction

---

## Workflow Examples

### Scenario 1: Multiple Batches, Different MRPs

**Inventory**:
- Aspirin 500mg:
  - Batch LOT-2024-001: 100 units @ ₹25.50
  - Batch LOT-2024-002: 50 units @ ₹26.00

**Customer 1 Purchase**: 5 units from LOT-2024-001
- Invoice item: quantity=5, mrp=25.50, subtotal=127.50
- Backend deducts 5 from LOT-2024-001 → 95 remaining

**Customer 2 Purchase**: 3 units from LOT-2024-002
- Invoice item: quantity=3, mrp=26.00, subtotal=78.00
- Backend deducts 3 from LOT-2024-002 → 47 remaining

**Final Inventory**:
- LOT-2024-001: 95 units @ ₹25.50
- LOT-2024-002: 47 units @ ₹26.00
- Total: 142 units, MRP range: ₹25.50 - ₹26.00

---

### Scenario 2: Adding New Batch

**Current Inventory**: Aspirin 500mg with 1 batch

**Action**: Add new batch to same product
- Product ID: 1
- New batch LOT-2024-003: 75 units @ ₹25.00
- Expiry: 2028-01-31

**POST /batches/** or **PATCH /products/1/add-batch/**: Create batch record

**Result**: Product now has 2 batches:
- LOT-2024-001: 100 units @ ₹25.50
- LOT-2024-003: 75 units @ ₹25.00
- Total: 175 units, MRP range: ₹25.00 - ₹25.50

---

### Scenario 3: Batch Expiry

**Daily Task**: Filter expiring batches
```
GET /batches/?expiry_date__lte=2024-02-01  # Expires in 30 days
```

**Display**: Dashboard shows batches expiring soon with warning badges:
- LOT-2024-001 expires in 3 days ⚠️ (Red)
- LOT-2024-002 expires in 15 days ⚠️ (Yellow)
- LOT-2024-003 expires in 45 days ✓ (Green)

---

## Validation Rules

### Batch Creation

**batch_number**:
- ✅ Required
- ✅ Max 100 characters
- ✅ Unique per product (can repeat across products)
- ✅ Format: Alphanumeric with hyphens/underscores (e.g., LOT-2024-001)

**mrp**:
- ✅ Required
- ✅ Must be >= 0 (allow free samples with MRP=0)
- ✅ Decimal precision: 2 places (₹25.50)

**quantity**:
- ✅ Required
- ✅ Must be >= 0
- ✅ Integer only

**expiry_date**:
- ✅ Required
- ✅ Format: YYYY-MM-DD
- ✅ Must be today or in future (no past dates)

### Invoice Item Validation

**product_id**:
- ✅ Must exist in Product table

**batch_number**:
- ✅ Must exist for the selected product
- ✅ Batch must not be expired (optional backend check)

**quantity**:
- ✅ Must be > 0
- ✅ Cannot exceed available batch quantity
- ✅ Must be integer

**mrp**:
- ✅ Must match the batch's MRP (backend validates)

---

## Key Differences from Old Model

| Aspect | Old Model | New Model (Batch) |
|--------|-----------|-------------------|
| Product price | Single field | Multiple per batch |
| Product quantity | Single field | Multiple per batch |
| Product expiry | Single field | Multiple per batch |
| Invoice pricing | `unit_price` field | `mrp` from batch |
| Stock deduction | From product total | From specific batch |
| Traceability | Product only | Batch-level traceability |
| Same product, different prices | ❌ Not possible | ✅ Possible per batch |

---

## Frontend Components Updated

### AddProductForm.jsx
- Removed: Individual price, quantity, expiry_date fields
- Added: Batch form with batch_number, mrp, quantity, expiry_date inputs
- Added: Batch list display with remove buttons
- Validation: Requires at least one batch, no duplicates

### ProductList.jsx
- Removed: Price, quantity, expiry_date columns
- Added: Total Qty column (sum of batches)
- Added: MRP Range column (min-max)
- Added: Expandable batch details row
- Display: Click to see all batch details

### BillingForm.jsx
- Removed: Direct product pricing
- Added: Batch selection dropdown (populated from product.batches)
- Added: Auto-populate MRP from selected batch
- Added: Quantity validation against batch stock
- Display: Total calculation per item (qty × mrp)

---

## Testing Checklist

- [ ] Create product with multiple batches
- [ ] Verify ProductList shows total quantity
- [ ] Verify ProductList shows MRP range
- [ ] Click to expand batches
- [ ] Create invoice and select batch
- [ ] Verify MRP auto-populates
- [ ] Verify quantity validates against batch stock
- [ ] Create invoice and verify batch deduction
- [ ] Check remaining batch quantity after invoice
- [ ] Add new batch to existing product
- [ ] Verify invoice history shows batch numbers
- [ ] Test expiry filtering (6/3/1 months as per EXPIRY_MANAGEMENT.md)
- [ ] Test low stock alerts with batch details

---

## Future Enhancements

1. **Batch editing**: Allow updating MRP/quantity for unsold batches
2. **Batch transfers**: Move stock between batches of same product
3. **Automatic low stock alerts**: Per batch, not just product
4. **Batch history**: Track changes to batch quantity/mrp
5. **FIFO/LIFO selection**: Automatic batch selection based on expiry/FIFO rules
6. **Batch serial numbers**: For high-value pharmaceuticals
7. **GRN (Goods Receipt Note) tracking**: Link batches to purchases

---

## Migration Notes (if needed)

If migrating from single-price model to batch model:

1. Create Batch records from existing Product data
2. Set initial batch_number from product ID (e.g., "INIT-001")
3. Set MRP from product.price
4. Set quantity from product.quantity
5. Set expiry_date from product.expiry_date
6. Update InvoiceItem records to include batch_number
7. Drop old price/quantity/expiry_date columns from Product

See `./MIGRATION_GUIDE.md` for detailed steps.
