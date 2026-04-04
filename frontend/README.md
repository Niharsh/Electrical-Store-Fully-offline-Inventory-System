# Electrical Store Inventory & Billing System - Frontend

**Status**: ✅ Production-ready Electron + React + SQLite desktop application

A React application for managing Electrical store inventory and billing for any product type (tablets, syrups, powders, creams, diapers, condoms, sachets, etc.), built with **Vite**, **Tailwind CSS**, and **Electron IPC**. This frontend is fully integrated with the Electron desktop application and SQLite database.

## ⚠️ Important: Frontend-Backend Separation

This frontend is **API-driven and does NOT**:
- ❌ Calculate totals, subtotals, or any mathematical values
- ❌ Validate business rules
- ❌ Enforce constraints (stock, expiry dates, etc.)
- ❌ Transform or manipulate data
- ❌ Simulate backend behavior
- ❌ Enforce product type logic (backend provides types, frontend displays them)

**The backend MUST handle all of the above.** See [BACKEND_INTEGRATION_GUIDE.md](../BACKEND_INTEGRATION_GUIDE.md) for backend implementation details.

---

### 📦 Product Inventory (Generic Product Types)
- Add, update, and delete products (tablets, syrups, powders, creams, diapers, condoms, sachets)
- Each product has a type for flexible inventory management
- Track batch numbers, expiry dates, quantity, and prices
- Search and filter products by name or type
- Low stock indicators

### 📊 Stock Management
- Real-time stock levels
- Low stock alerts (threshold configurable)
- Batch-wise inventory tracking
- Expiry date management (coming soon)

### 💳 Billing & Invoices
- Create invoices with multiple items
- Calculate totals automatically
- View complete bill history
- Customer information tracking

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Common/              # Reusable components (Header, Nav, Alerts, Spinner)
│   │   ├── Product/             # Product/Inventory components (generic product types)
│   │   └── Billing/             # Billing/Invoice components
│   ├── context/                 # React Context for state management
│   │   ├── ProductContext.jsx
│   │   └── InvoiceContext.jsx
│   ├── pages/                   # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Inventory.jsx
│   │   └── Billing.jsx
│   ├── services/                # API service layer
│   │   ├── api.js              # Axios instance & interceptors
│   │   └── medicineService.js  # Business logic for API calls
│   ├── App.jsx                 # Main app with routing
│   ├── main.jsx
│   └── index.css               # Tailwind directives
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS configuration
├── .env.local                  # Environment variables
└── package.json
```

## Tech Stack

- **Framework**: React 18+ with Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Routing**: React Router DOM
- **State Management**: React Context API
- **Build Tool**: Vite

## Setup & Installation

### Prerequisites
- Node.js 16+ and npm
- Django backend running on `http://localhost:8000`

### Steps

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API endpoint** (if needed):
   - Edit `.env.local` to point to your Django backend:
   ```env
   VITE_API_URL=http://localhost:8000/api
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:5173/`

---

## Admin Recovery (Offline) acceptance test

An automated Playwright-based acceptance test exercises the full offline Admin recovery flow (verify code → set new password locally → login with new password).

- Install dev dependencies (once):
  - `cd frontend && npm install`
- Start the frontend dev server in one terminal:
  - `cd frontend && npm run dev`
- Run the acceptance test in another terminal:
  - `cd frontend && npm run test:admin-recovery`

Notes:
- The test sets a temporary admin code in `localStorage`, performs the flow, and exits with status 0 on success.
- Playwright will download browser binaries on first install; allow network access for initial installation.


5. **Build for production**:
   ```bash
   npm run build
   ```

## API Integration with Django REST Framework

### Architecture

The frontend is **API-driven** and expects a Django REST Framework backend with the following endpoints:

#### Products Endpoint
```
GET    /api/products/           - List all products
POST   /api/products/           - Create product
GET    /api/products/{id}/      - Get product details
PATCH  /api/products/{id}/      - Update product
DELETE /api/products/{id}/      - Delete product
GET    /api/products/?quantity__lt=10  - Get low stock items
```

#### Batches Endpoint
```
GET    /api/batches/            - List all batches
POST   /api/batches/            - Create batch
GET    /api/batches/{id}/       - Get batch details
PATCH  /api/batches/{id}/       - Update batch
DELETE /api/batches/{id}/       - Delete batch
```

#### Invoices Endpoint
```
GET    /api/invoices/           - List all invoices
POST   /api/invoices/           - Create invoice
GET    /api/invoices/{id}/      - Get invoice details
PATCH  /api/invoices/{id}/      - Update invoice
DELETE /api/invoices/{id}/      - Delete invoice
```

#### Invoice Items Endpoint
```
GET    /api/invoice-items/      - List invoice items
POST   /api/invoice-items/      - Create invoice item
PATCH  /api/invoice-items/{id}/ - Update invoice item
DELETE /api/invoice-items/{id}/ - Delete invoice item
```

### Expected Django Models & Serializers

#### Product Model
```python
class Product(models.Model):
    name = models.CharField(max_length=255)
    generic_name = models.CharField(max_length=255, blank=True)
    manufacturer = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.IntegerField()
    unit = models.CharField(max_length=50, default='tablet')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### Batch Model
```python
class Batch(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    batch_number = models.CharField(max_length=100)
    quantity = models.IntegerField()
    expiry_date = models.DateField()
    manufactured_date = models.DateField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
```

#### Invoice Model
```python
class Invoice(models.Model):
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=20, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### InvoiceItem Model
```python
class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
```

## Service Layer Documentation

All API interactions are centralized in `src/services/medicineService.js`:

### Product Service
```javascript
productService.getAll(params)          // Get all products with optional filters
productService.getById(id)             // Get single product
productService.create(data)            // Create new product
productService.update(id, data)        // Update product
productService.delete(id)              // Delete product
productService.getLowStock(threshold)  // Get products with low stock
```

### Invoice Service
```javascript
invoiceService.getAll(params)          // Get all invoices
invoiceService.getById(id)             // Get single invoice
invoiceService.create(data)            // Create invoice
invoiceService.update(id, data)        // Update invoice
invoiceService.delete(id)              // Delete invoice
invoiceService.addItem(invoiceId, itemData)     // Add item to invoice
invoiceService.removeItem(invoiceId, itemId)    // Remove item from invoice
```

## State Management

### ProductContext
Manages all product-related state:
- `products` - Array of all products
- `loading` - Loading state
- `error` - Error messages
- Methods: `fetchProducts`, `addProduct`, `updateProduct`, `deleteProduct`, `getLowStock`

### InvoiceContext
Manages all invoice-related state:
- `invoices` - Array of all invoices
- `currentInvoice` - Currently viewed invoice
- `loading` - Loading state
- `error` - Error messages
- Methods: `fetchInvoices`, `fetchInvoice`, `createInvoice`, `updateInvoice`, `deleteInvoice`

## Usage Examples

### Using ProductContext in a component
```jsx
import { useProducts } from '../context/ProductContext';

function MyComponent() {
  const { products, loading, error, fetchProducts, addProduct } = useProducts();

  useEffect(() => {
    fetchProducts();
  }, []);

  // ... rest of component
}
```

### Using InvoiceContext
```jsx
import { useInvoices } from '../context/InvoiceContext';

function InvoiceComponent() {
  const { invoices, createInvoice, fetchInvoices } = useInvoices();

  // ... use hooks and methods
}
```

## Troubleshooting

### CORS Issues
If you see CORS errors, ensure your Django backend has `django-cors-headers` configured:
```python
INSTALLED_APPS = [
    # ...
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    # ...
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]
```

### API Not Responding
1. Check that Django server is running: `python manage.py runserver`
2. Verify `VITE_API_URL` in `.env.local` matches your Django server URL
3. Check browser console for detailed error messages

## Development Workflow

1. **Keep components focused**: One concern per component
2. **Use Context API**: For shared state across multiple components
3. **Leverage services**: All API calls through `medicineService.js`
4. **Tailwind classes**: For styling, avoid custom CSS when possible
5. **No mock data**: Always fetch from backend API

## Next Steps

- [ ] Add authentication/login page
- [ ] Implement expiry date tracking and alerts
- [ ] Add analytics and reports
- [ ] Implement batch-wise billing
- [ ] Add print invoice functionality
- [ ] Implement payment status tracking
- [ ] Add customer management module
- [ ] Implement role-based access control

## License

MIT
