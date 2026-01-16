# API Contracts & Specifications

This document defines the expected API contracts for the Django REST Framework backend for a **Generic Medical Store Inventory System**. These are requirements the frontend expects the backend to fulfill. **No assumptions are made beyond what is explicitly documented here.**

Supports multiple product types: tablets, syrups, powders, creams, diapers, condoms, sachets, and more.

---

## ⚠️ Important Rules

1. **Frontend does NOT**:
   - Calculate totals, subtotals, or taxes
   - Validate business rules
   - Transform data structures
   - Enforce constraints (e.g., expiry dates)
   - Apply discounts or markup

2. **Backend MUST**:
   - Handle all calculations and validations
   - Return complete, ready-to-display data
   - Ensure data consistency
   - Apply all business rules

3. **Frontend WILL**:
   - Display exactly what the API returns
   - Validate only form input (required fields, data types)
   - Pass raw user input to the backend
   - Let the backend decide what's valid

---

## Base URL

```
http://localhost:8000/api
```

All endpoints are relative to this base URL.

---

## 1. Products Endpoint

### GET /products/

List all products with filtering support.

**Query Parameters**:
- `search` (optional): Search by name or generic_name
- `quantity__lt` (optional): Filter products where quantity is less than value (for low stock)
- `page` (optional): Pagination

**Expected Response**:
```json
{
  "count": 50,
  "next": "http://localhost:8000/api/products/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Aspirin 500mg",
      "product_type": "tablet",
      "generic_name": "Acetylsalicylic Acid",
      "manufacturer": "Pharma Ltd",
      "salt_composition": "Paracetamol 500mg",
      "unit": "pc",
      "description": "Pain reliever and fever reducer",
      "batches": [
        {
          "batch_number": "LOT-2024-001",
          "mrp": "25.50",
          "quantity": 100,
          "expiry_date": "2026-12-31"
        },
        {
          "batch_number": "LOT-2024-002",
          "mrp": "26.00",
          "quantity": 50,
          "expiry_date": "2027-06-30"
        }
      ],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "name": "Cough Syrup",
      "product_type": "syrup",
      "generic_name": "Dextromethorphan",
      "manufacturer": "Pharma Ltd",
      "salt_composition": null,
      "unit": "bottle",
      "description": "Cough suppressant syrup",
      "batches": [
        {
          "batch_number": "SYR-2024-001",
          "mrp": "150.00",
          "quantity": 50,
          "expiry_date": "2026-06-30"
        }
      ],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Notes**:
- `product_type` is one of: tablet, syrup, powder, cream, diaper, condom, sachet (extensible)
- **`batches` array**: Each product has one or more batches with independent batch numbers, MRPs, quantities, and expiry dates
- Each batch contains:
  - `batch_number` (string, unique per product): Manufacturer batch identifier (e.g., LOT-2024-001)
  - `mrp` (numeric, decimal): Manufacturing Recommended Price for this batch
  - `quantity` (numeric): Available quantity for this batch
  - `expiry_date` (date, format YYYY-MM-DD): Batch expiry date
- Total stock for a product is the sum of all batch quantities
- `unit` indicates the unit of sale (pc, bottle, gm, ml, etc.) - flexible per product
- Pagination is handled by DRF defaults

---

### POST /products/

Create a new product with batches.

**Request Body**:
```json
{
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
      "mrp": "25.50",
      "quantity": 100,
      "expiry_date": "2026-12-31"
    }
  ]
}
```

**Expected Response**: 201 Created
```json
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
      "mrp": "25.50",
      "quantity": 100,
      "expiry_date": "2026-12-31"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Validation** (Backend):
- `name` is required, unique, max 255 chars
- `product_type` is required, must be one of: tablet, syrup, powder, cream, diaper, condom, sachet
- `unit` should be flexible per product (pc, bottle, gm, ml, etc.)
- `salt_composition` is optional, mainly for tablets/capsules (max 500 chars)
- **`batches` is required, must contain at least one batch**:
  - `batch_number` is required, must be unique within this product (max 100 chars)
  - `mrp` is required, must be >= 0 (Manufacturing Recommended Price)
  - `quantity` is required, must be >= 0
  - `expiry_date` is required, format: YYYY-MM-DD, must be today or in the future
- Create product with all batch records in one transaction

---

### GET /products/{id}/

Get a single product by ID with all batches.

**Expected Response**: 200 OK
```json
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
      "mrp": "25.50",
      "quantity": 100,
      "expiry_date": "2026-12-31"
    },
    {
      "batch_number": "LOT-2024-002",
      "mrp": "26.00",
      "quantity": 50,
      "expiry_date": "2027-06-30"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### PATCH /products/{id}/

Update a product and/or add/update batches.

**Request Body** (all fields optional):
```json
{
  "name": "Aspirin 500mg",
  "description": "Updated description",
  "batches": [
    {
      "batch_number": "LOT-2024-003",
      "mrp": "27.00",
      "quantity": 75,
      "expiry_date": "2027-12-31"
    }
  ]
}
```

**Expected Response**: 200 OK
Same as GET response with updated fields and all batches.

**Notes**:
- Batch updates are handled as additions or replacements (backend determines strategy)
- To remove a batch, provide empty batches array or specific batch removal mechanism (TBD based on backend implementation)

---

### DELETE /products/{id}/

Delete a product.

**Expected Response**: 204 No Content

---

## 2. Product Types Endpoint

### GET /product-types/

List all available product types (default + custom).

**Expected Response**:
```json
[
  {
    "id": "tablet",
    "label": "Tablet",
    "is_default": true
  },
  {
    "id": "syrup",
    "label": "Syrup",
    "is_default": true
  },
  {
    "id": "powder",
    "label": "Powder",
    "is_default": true
  },
  {
    "id": "cream",
    "label": "Cream",
    "is_default": true
  },
  {
    "id": "diaper",
    "label": "Diaper",
    "is_default": true
  },
  {
    "id": "condom",
    "label": "Condom",
    "is_default": true
  },
  {
    "id": "sachet",
    "label": "Sachet",
    "is_default": true
  },
  {
    "id": "gel",
    "label": "Gel",
    "is_default": false
  }
]
```

**Notes**:
- Returns both default product types and custom types added by the owner
- Default types have `is_default: true`
- Custom types have `is_default: false`
- Owner cannot delete default types

---

### POST /product-types/

Create a new custom product type.

**Request Body**:
```json
{
  "name": "gel",
  "label": "Gel"
}
```

**Expected Response**: 201 Created
```json
{
  "id": "gel",
  "label": "Gel",
  "is_default": false
}
```

**Validation** (Backend):
- `name` is required, unique, lowercase, alphanumeric + underscores (max 50 chars)
- `label` is required, readable display name (max 100 chars)
- Cannot have same name as default type

**Error Handling**:
- 400 Bad Request if `name` already exists: `{"name": ["Product type with this name already exists"]}`
- 400 Bad Request if invalid characters in `name`

---

### DELETE /product-types/{id}/

Delete a custom product type.

**Expected Response**: 204 No Content

**Validation** (Backend):
- Cannot delete default types (tablet, syrup, powder, cream, diaper, condom, sachet)
- 403 Forbidden if attempting to delete default type
- 404 Not Found if product type doesn't exist

---

## 2. Batches Endpoint

### GET /batches/

List all batches with filtering.

**Query Parameters**:
- `product` (optional): Filter by product ID
- `expiry_date__lt` (optional): Filter batches expiring before date

**Expected Response**:
```json
{
  "count": 100,
  "results": [
    {
      "id": 1,
      "product": 1,
      "batch_number": "LOT-2024-001",
      "quantity": 500,
      "expiry_date": "2026-12-31",
      "manufactured_date": "2024-01-15",
      "price": "20.00",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /batches/

Create a new batch.

**Request Body**:
```json
{
  "product": 1,
  "batch_number": "LOT-2024-001",
  "quantity": 500,
  "expiry_date": "2026-12-31",
  "manufactured_date": "2024-01-15",
  "price": "20.00"
}
```

**Backend Validation**:
- `batch_number` is required, unique
- `quantity` must be > 0
- `expiry_date` must be >= `manufactured_date`
- `price` must be >= 0

**Expected Response**: 201 Created (same as GET response)

---

### PATCH /batches/{id}/

Update batch (quantity, expiry_date, etc.).

**Request Body** (all optional):
```json
{
  "quantity": 450,
  "expiry_date": "2026-12-31"
}
```

---

### DELETE /batches/{id}/

Delete a batch.

**Expected Response**: 204 No Content

---

## 3. Invoices Endpoint

### GET /invoices/

List all invoices.

**Query Parameters**:
- `customer_name` (optional): Filter by customer
- `date_after` (optional): Filter by date range
- `ordering` (optional): `-created_at` for newest first

**Expected Response**:
```json
{
  "count": 50,
  "results": [
    {
      "id": 1,
      "customer_name": "John Doe",
      "customer_phone": "9876543210",
      "total_amount": "500.00",
      "notes": "Paid in cash",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Notes**:
- `total_amount` is calculated by backend from invoice items
- Frontend does NOT calculate this

---

### POST /invoices/

Create a new invoice with batch-specific items.

**Request Body**:
```json
{
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "notes": "Regular customer",
  "items": [
    {
      "product_id": 1,
      "batch_number": "LOT-2024-001",
      "quantity": 2,
      "mrp": "25.50"
    },
    {
      "product_id": 2,
      "batch_number": "SYR-2024-001",
      "quantity": 1,
      "mrp": "150.00"
    }
  ]
}
```

**Backend Responsibilities**:
- Validate product IDs exist
- Validate batch numbers exist for each product
- Validate quantities are > 0 and available in specified batch
- Check batch stock availability
- Deduct quantity from specified batch only (no cross-batch deductions)
- Calculate `total_amount` from items (quantity × mrp per item)
- Create invoice and all associated items in one transaction
- Return full invoice with calculated total

**Expected Response**: 201 Created
```json
{
  "id": 1,
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "total_amount": "351.00",
  "notes": "Regular customer",
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Aspirin 500mg",
      "batch_number": "LOT-2024-001",
      "quantity": 2,
      "mrp": "25.50",
      "subtotal": "51.00"
    },
    {
      "id": 2,
      "product_id": 2,
      "product_name": "Cough Syrup",
      "batch_number": "SYR-2024-001",
      "quantity": 1,
      "mrp": "150.00",
      "subtotal": "150.00"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Key Differences from Old Contract**:
- Changed `product` to `product_id` (numeric)
- Added `batch_number` (string): Must reference an existing batch for the product
- Changed `unit_price` to `mrp` (numeric): Manufacturing Recommended Price from the selected batch
- Subtotal calculation: `quantity × mrp`
- Total calculation: Sum of all item subtotals

---

### GET /invoices/{id}/

Get a single invoice with all items and batch information.

**Expected Response**:
```json
{
  "id": 1,
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "total_amount": "351.00",
  "notes": "Regular customer",
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Aspirin 500mg",
      "product_type": "tablet",
      "batch_number": "LOT-2024-001",
      "quantity": 2,
      "mrp": "25.50",
      "subtotal": "51.00"
    },
    {
      "id": 2,
      "product_id": 2,
      "product_name": "Cough Syrup",
      "product_type": "syrup",
      "batch_number": "SYR-2024-001",
      "quantity": 1,
      "mrp": "150.00",
      "subtotal": "150.00"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Notes**:
- Include `product_name` and `product_type` for display and categorization
- Include `batch_number` to trace which batch was used for invoice
- Include `mrp` (MRP for that batch at time of invoice)
- Include calculated `subtotal` for each item (quantity × mrp)
- Include calculated `total_amount` (sum of all subtotals)
- All these values are calculated and provided by backend

---

### PATCH /invoices/{id}/

Update invoice metadata (not items).

**Request Body**:
```json
{
  "customer_name": "Jane Doe",
  "notes": "Updated notes"
}
```

**Expected Response**: 200 OK

---

### DELETE /invoices/{id}/

Delete an invoice.

**Expected Response**: 204 No Content

---

## 4. Invoice Items Endpoint

### GET /invoice-items/

List invoice items with batch information.

**Query Parameters**:
- `invoice` (optional): Filter by invoice ID

**Expected Response**:
```json
{
  "count": 200,
  "results": [
    {
      "id": 1,
      "invoice": 1,
      "product_id": 1,
      "product_name": "Aspirin 500mg",
      "product_type": "tablet",
      "batch_number": "LOT-2024-001",
      "quantity": 2,
      "mrp": "25.50",
      "subtotal": "51.00"
    }
  ]
}
```

**Notes**:
- `batch_number` indicates which batch was used for this invoice item
- `mrp` is the Manufacturing Recommended Price from that batch
- This allows tracing invoice items back to their source batch

---

### PATCH /invoice-items/{id}/

Update an invoice item (quantity only, batch and MRP are immutable).

**Request Body**:
```json
{
  "quantity": 3
}
```

**Backend Responsibility**:
- Update quantity for the specific batch
- Recalculate invoice `total_amount`
- Return updated item with new `subtotal`

**Expected Response**: 200 OK
```json
{
  "id": 1,
  "invoice": 1,
  "product_id": 1,
  "product_name": "Aspirin 500mg",
  "product_type": "tablet",
  "batch_number": "LOT-2024-001",
  "quantity": 3,
  "mrp": "25.50",
  "subtotal": "76.50"
}
```

**Notes**:
- `batch_number` and `mrp` are immutable - they represent what was used at invoice creation time
- To change batch or MRP, delete this item and add a new item with the desired batch

---

### DELETE /invoice-items/{id}/

Delete an invoice item.

**Backend Responsibility**:
- Recalculate invoice `total_amount`

**Expected Response**: 204 No Content

---

## 5. Error Responses

All endpoints should return appropriate error codes:

### 400 Bad Request
```json
{
  "detail": "Field validation failed",
  "errors": {
    "name": ["This field is required."],
    "price": ["Ensure this value is greater than or equal to 0."]
  }
}
```

### 404 Not Found
```json
{
  "detail": "Not found."
}
```

### 500 Internal Server Error
```json
{
  "detail": "An internal server error occurred."
}
```

---

## Frontend Expectations Summary

| Responsibility | Frontend | Backend |
|---|---|---|
| Form input validation (required, type) | ✅ | ✅ |
| Business rule validation | ❌ | ✅ |
| Calculations (totals, subtotals) | ❌ | ✅ |
| Data transformation | ❌ | ✅ |
| Stock availability check | ❌ | ✅ |
| Expiry date validation | ❌ | ✅ |
| Data display/rendering | ✅ | ❌ |
| Form building | ✅ | ❌ |

---

## Notes for Backend Developers

1. **CORS**: Configure `django-cors-headers` to allow `http://localhost:5173`
2. **Pagination**: Use DRF's default pagination (results under "results" key)
3. **Timestamps**: Always include `created_at` and `updated_at`
4. **Calculations**: ALL calculations (totals, subtotals) must be done by the backend
5. **Validation**: ALL business logic validation must be on the backend
6. **Responses**: Always return complete data that the frontend can display immediately

---

## Frontend Assumptions (Explicit & Removable)

- API returns paginated results with `count`, `next`, `previous`, `results`
- All timestamps are ISO 8601 format
- Prices are returned as strings (Decimal fields)
- IDs are integers
- All responses include full object data (not just IDs)

These can be changed without frontend refactoring if the API response structure changes.
