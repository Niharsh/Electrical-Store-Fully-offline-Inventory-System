# Inventory Management System - Setup & Usage Guide

## ✅ Project Status: COMPLETE

The full-stack inventory management system is **complete and fully functional** with:
- ✅ React frontend with three-price model and editable billing prices
- ✅ Django REST Framework backend with complete API
- ✅ Sample data pre-loaded for testing
- ✅ Admin panel configured
- ✅ CORS enabled for frontend-backend communication

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js and npm
- Virtual environment already set up

### Start Both Services

**Terminal 1 - Start Backend (Django)**
```bash
cd /home/niharsh/Desktop/Inventory/backend
source venv/bin/activate
python manage.py runserver
```

**Terminal 2 - Start Frontend (React)**
```bash
cd /home/niharsh/Desktop/Inventory/frontend
npm run dev
```

Access:
- **Frontend**: http://localhost:5173
- **Backend API**: http://127.0.0.1:8000/api/
- **Django Admin**: http://127.0.0.1:8000/admin/
  - Username: `admin`
  - Password: `admin123`

---

## 📊 Database & Sample Data

### Sample Products Pre-Loaded
1. **Aspirin 500mg** - Tablet (100 + 150 units)
2. **Cough Syrup** - Syrup (80 units)
3. **Vitamin C Powder** - Sachet (500 + 300 units)
4. **Antiseptic Cream** - Cream (60 units)
5. **Baby Diapers (Size M)** - Diaper (45 units)

Each product includes:
- Multiple batches with different expiry dates
- Three-price model: MRP (display), Selling Rate (billing), Cost Price (internal)
- Full stock details

### Load More Sample Data
```bash
cd /home/niharsh/Desktop/Inventory/backend
source venv/bin/activate
python manage.py load_sample_data
```

---

## 🔌 API Endpoints

All endpoints are available at `http://127.0.0.1:8000/api/`

### Products & Inventory
- `GET /api/products/` - List all products with batches
- `GET /api/products/{id}/` - Get specific product
- `POST /api/products/` - Create new product
- `GET /api/batches/` - List all batches
- `POST /api/batches/` - Create batch for product
- `GET /api/batches/?product={id}` - Get batches for product
- `GET /api/batches/?expiry_date__lt=2026-12-31` - Get expiring batches

### Invoices (Billing)
- `GET /api/invoices/` - List all invoices
- `POST /api/invoices/` - Create new invoice (with items)
- `GET /api/invoices/{id}/` - Get specific invoice
- `GET /api/invoice-items/` - List all line items
- `PATCH /api/invoice-items/{id}/` - Update item selling rate

### Payment Tracking
- `GET /api/sales-bills/` - List sales bills
- `PATCH /api/sales-bills/{id}/` - Update payment status
- `GET /api/purchase-bills/` - List purchase bills
- `PATCH /api/purchase-bills/{id}/` - Update payment status

### Filters & Search
```
# Search products by name
GET /api/products/?search=aspirin

# Filter batches by product
GET /api/batches/?product=1

# Filter bills by payment status
GET /api/sales-bills/?payment_status=unpaid

# Order by expiry date (FIFO)
GET /api/batches/?ordering=expiry_date
```

---

## 📋 Three-Price Model Implementation

### MRP (Maximum Retail Price)
- **Usage**: Display only, shown in product list
- **In Invoice**: Yes, for reference
- **For Billing**: No, never used in calculations

### Selling Rate
- **Usage**: Primary billing price
- **In Invoice**: Yes, main calculation
- **Editable**: Yes, during invoice creation
- **For Billing**: Yes, all invoice totals use this

### Cost Price
- **Usage**: Internal cost tracking only
- **In Invoice**: No, never included
- **Visible**: Only in admin panel
- **For Billing**: No, hidden from customers

### Invoice Calculation
```
Item Subtotal = Quantity × Selling Rate (NOT MRP)
Invoice Total = Sum of all Item Subtotals
```

---

## 🧪 Testing the System

### Test 1: Get All Products
```bash
curl http://127.0.0.1:8000/api/products/ | python -m json.tool
```

### Test 2: Create an Invoice
```bash
curl -X POST http://127.0.0.1:8000/api/invoices/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Pharmacy",
    "customer_phone": "9876543210",
    "items": [
      {
        "batch_id": 1,
        "quantity": 10,
        "selling_rate": 40
      }
    ]
  }'
```

### Test 3: Update Invoice Item Selling Rate
```bash
curl -X PATCH http://127.0.0.1:8000/api/invoice-items/1/ \
  -H "Content-Type: application/json" \
  -d '{"selling_rate": "35"}'
```

### Test 4: Track Sales Payment
```bash
curl -X PATCH http://127.0.0.1:8000/api/sales-bills/1/ \
  -H "Content-Type: application/json" \
  -d '{"amount_paid": "3500"}'
```

---

## 🗂️ Project Structure

```
Inventory/
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── context/            # Context for state management
│   │   ├── services/           # API client services
│   │   └── App.jsx
│   └── package.json
│
└── backend/                     # Django + DRF
    ├── config/                  # Django settings & URLs
    │   ├── settings.py          # Configuration
    │   ├── urls.py              # API routing
    │   └── wsgi.py
    │
    ├── inventory/               # Main app
    │   ├── models.py            # 7 data models
    │   ├── serializers.py       # DRF serializers
    │   ├── views.py             # ViewSets & logic
    │   ├── urls.py              # Router configuration
    │   ├── management/
    │   │   └── commands/
    │   │       └── load_sample_data.py  # Sample data loader
    │   └── migrations/          # Database migrations
    │
    ├── db.sqlite3               # Database (with sample data)
    ├── manage.py                # Django management
    ├── requirements.txt         # Python dependencies
    └── venv/                    # Virtual environment
```

---

## 📦 Dependencies

### Backend (Django)
- Django 6.0.1
- djangorestframework 3.14.0
- django-cors-headers 4.3.1
- django-filter 25.2
- asgiref 3.11.0
- sqlparse 0.5.5

### Frontend (React)
- React 18
- Vite 7
- Axios (for API calls)

All installed in virtual environment.

---

## 👤 Admin Access

### Login
- URL: http://127.0.0.1:8000/admin/
- Username: `admin`
- Password: `admin123`

### Admin Features
- View/edit all products, batches, invoices
- View cost prices (not shown to customers)
- Manage user accounts
- View payment history

---

## 🔒 Security Notes

**For Production Deployment**:
1. Change admin password from default
2. Set `DEBUG = False` in settings.py
3. Generate new `SECRET_KEY`
4. Configure `ALLOWED_HOSTS`
5. Use HTTPS instead of HTTP
6. Set up proper CORS origins
7. Use environment variables for secrets

---

## 🐛 Troubleshooting

### Backend Not Starting
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill existing process if needed
pkill -f "manage.py runserver"

# Restart with explicit host
python manage.py runserver 0.0.0.0:8000
```

### Frontend Not Connecting to Backend
- Verify backend is running: `curl http://127.0.0.1:8000/api/`
- Check CORS settings in `backend/config/settings.py`
- Check browser console for CORS errors
- Verify API URL in frontend: `src/services/api.js`

### Database Issues
```bash
# Reset migrations (careful - deletes all data)
python manage.py migrate inventory zero

# Reapply migrations
python manage.py migrate

# Reload sample data
python manage.py load_sample_data
```

---

## 📝 Next Steps

- [ ] Add more products via admin or API
- [ ] Test invoice creation and payment tracking
- [ ] Configure email notifications for low stock
- [ ] Set up automated backup system
- [ ] Deploy to production server
- [ ] Add user authentication for wholesalers
- [ ] Create billing reports and analytics

---

## 📞 Support

For issues or questions:
1. Check the API logs: `/tmp/backend.log`
2. Review Django error messages in terminal
3. Check browser console for frontend errors
4. Verify all dependencies are installed in venv

---

**Last Updated**: January 17, 2026  
**System Status**: ✅ Fully Operational
