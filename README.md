# ⚡ Ojashwai Electrical Store - Desktop Billing & Inventory System

> **A complete, production-ready offline desktop application for electrical store billing and inventory management.** Built with Electron, React, and SQLite—designed for small to medium electrical retailers who need fast, reliable invoicing without internet dependency.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [Features In Detail](#features-in-detail)
- [Development](#development)
- [Building & Distribution](#building--distribution)
- [Security & Licensing](#security--licensing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## 🎯 Overview

**Ojashwai Electrical Store** is a complete desktop billing and inventory management system purpose-built for electrical retailers. It operates fully offline, stores all data locally, and provides professional invoicing capabilities with GST support.

### Why Choose This System?

✅ **Completely Offline** — No internet required, works without connectivity  
✅ **Hardware-Locked Security** — License tied to machine hardware ID  
✅ **Fast Performance** — Synchronous SQLite ensures quick operations  
✅ **Professional Invoices** — Multiple print layouts, GST support, batch pricing  
✅ **Complete Inventory** — Track stock, batches, pricing, and expiry dates  
✅ **Easy Recovery** — Built-in backup/restore and password recovery tools  
✅ **Cross-Platform Ready** — Built with Electron (Windows builds available)  

---

## ✨ Key Features

### 🔐 **Authentication & Security**

- **Owner Registration** — One-time secure setup with email and password
- **Session Management** — Persistent offline sessions with auto-logout
- **Password Recovery** — Admin code-based recovery system (works offline)
- **Hardware-Locked Licensing** — License tied to device architecture and hardware ID
- **Encrypted Storage** — Sensitive data encrypted at rest
- **License Validation** — Automatic validation on startup with expiry checking
- **Clock Skew Detection** — Prevents license tampering via system clock manipulation

### 📦 **Inventory Management**

- **Product Management** — Create, edit, delete, and search products
- **Multi-Batch Support** — Track multiple batches per product with independent:
  - **Batch Numbers** — Unique identifier per production batch
  - **Pricing Tiers** — Cost price, selling rate, and MRP per batch
  - **Stock Tracking** — Real-time quantity management
  - **Expiry Dates** — Track batch expiration (optional)
- **HSN Code Management** — Configure and manage HSN codes for GST taxation
- **Low Stock Alerts** — Dashboard warnings for depleted inventory
- **Quick Search** — Lightning-fast product search and filtering
- **Product Categories** — Organize by electrical item types

### 💰 **Billing & Invoicing**

- **Professional Invoice Creation** — Multi-line item invoices with item-level calculations
- **Customer Tracking** — Save customer details for repeat business and history
- **Flexible Discounts** — Item-level and invoice-level discounts
- **GST Support** — HSN-based automatic tax calculation with rates
- **Payment Tracking** — Record paid vs. pending amounts
- **Invoice Status** — Track draft, finalized, and payment status
- **Multiple Print Layouts** — Thermal (58mm) and A4 printer support
- **Invoice History** — Search and retrieve past invoices by customer, date, or amount
- **Invoice Editing** — Modify invoices before finalization
- **Digital Invoice Storage** — All invoices stored locally for historical reference

### 🛒 **Purchase & Supplier Management**

- **Purchase Bill Recording** — Log purchases from wholesalers with full details
- **Automatic Stock Update** — Stock increases automatically when bills are created
- **Wholesaler Database** — Maintain supplier contact and transaction history
- **Payment Tracking** — Record advance vs. pending amounts per purchase
- **Purchase History** — Filter and retrieve past purchase records
- **Bulk Operations** — Handle multiple purchases efficiently

### 🏪 **Shop Configuration & Management**

- **Shop Profile** — Configure shop name, logo, address, phone, email
- **Database Backup** — Create encrypted backups to file system
- **Database Restore** — Recover full database from backup (with confirmation)
- **Admin Recovery Codes** — Set recovery codes for emergency access
- **HSN Code Configuration** — Manage all tax code settings
- **User Settings** — Control application behavior and preferences

### 📊 **Dashboard & Reporting**

- **Sales Overview** — Total revenue, invoice count, and trends
- **Purchase Overview** — Supplier spending and stock received
- **Low Stock Monitor** — Visual alerts for products needing reorder
- **Recent Activity** — Latest invoices and purchases at a glance
- **Period Summaries** — Monthly or custom date range analytics
- **Paid vs. Pending** — Quick view of outstanding balances
- **Stock Valuation** — Inventory value calculations

---

## 🛠 Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend Framework** | React | 19.2.0 |
| **Build Tool** | Vite | 7.2.4 |
| **Desktop Framework** | Electron | 32.2.7+ |
| **Backend (IPC)** | Node.js + Electron main process | — |
| **Database** | SQLite3 | — |
| **DB Driver** | better-sqlite3 | (synchronous, fast) |
| **UI Framework** | Tailwind CSS | 4.1.18 |
| **Routing** | React Router | 7.12.0 |
| **Icons** | Lucide React | 0.575.0 |
| **Bundler** | Electron Builder | 25.1.8 |
| **Back-End Build** | Electron Builder (NSIS + Portable) | — |
| **State Management** | React Context API | — |
| **Styling** | PostCSS + Tailwind | — |

---

## 📁 Project Structure

```
Electrical-Store-Fully-offline-Inventory-System/
│
├── 📂 frontend/                               # React Vite application
│   ├── src/
│   │   ├── App.jsx                           # Main router and layout wrapper
│   │   ├── main.jsx                          # React entry point
│   │   ├── index.css                         # Global styles
│   │   ├── App.css                           # App-specific styles
│   │   │
│   │   ├── 📂 pages/                         # Page components
│   │   │   ├── Dashboard.jsx                 # Main dashboard view
│   │   │   ├── Inventory.jsx                 # Product inventory page
│   │   │   ├── Billing.jsx                   # Billing page
│   │   │   ├── InvoiceDetail.jsx             # Single invoice view
│   │   │   ├── ProductSearch.jsx             # Advanced product search
│   │   │   ├── Settings.jsx                  # Settings & admin panel
│   │   │   │
│   │   │   ├── Authentication Pages:
│   │   │   ├── LoginPage.jsx                 # User login
│   │   │   ├── SignupPage.jsx                # Owner registration
│   │   │   ├── ForgotPasswordPage.jsx        # Password reset request
│   │   │   ├── AdminPasswordReset.jsx        # Password reset with admin code
│   │   │   ├── AdminRecoveryIntro.jsx        # Recovery intro screen
│   │   │   ├── AdminCodeVerify.jsx           # Recovery code verification
│   │   │   ├── RecoveryMethodSelection.jsx   # Choose recovery method
│   │   │   ├── ResetPasswordPage.jsx         # Final password reset
│   │   │   └── ActivationPage.jsx            # License activation
│   │   │
│   │   ├── 📂 components/                    # Reusable UI components
│   │   │   ├── Common/
│   │   │   │   ├── Header.jsx                # Top navigation bar
│   │   │   │   ├── Navigation.jsx            # Sidebar menu
│   │   │   │   ├── ProtectedRoute.jsx        # Auth-gated routes
│   │   │   │   └── ErrorBoundary.jsx         # Error handling
│   │   │   │
│   │   │   ├── Billing/
│   │   │   │   ├── BillingForm.jsx           # Invoice creation form
│   │   │   │   ├── InvoiceHistory.jsx        # Invoice list & search
│   │   │   │   └── InvoicePrint.jsx          # Print layout component
│   │   │   │
│   │   │   ├── Product/
│   │   │   │   ├── AddProductForm.jsx        # Product creation/edit
│   │   │   │   ├── ProductList.jsx           # Product table view
│   │   │   │   ├── ProductSearchBar.jsx      # Search component
│   │   │   │   ├── ProductAutocomplete.jsx   # Autocomplete for billing
│   │   │   │   └── HSNManager.jsx            # HSN code management
│   │   │   │
│   │   │   ├── SalesAndPurchases/
│   │   │   │   ├── SalesSummary.jsx          # Sales statistics
│   │   │   │   ├── PurchaseSummary.jsx       # Purchase statistics
│   │   │   │   └── PurchaseBillForm.jsx      # Purchase bill entry
│   │   │   │
│   │   │   ├── Settings/
│   │   │   │   ├── ShopDetails.jsx           # Shop profile editor
│   │   │   │   ├── HSNGSTReport.jsx          # HSN-GST tax report
│   │   │   │   └── AdminRecovery.jsx         # Recovery code setup
│   │   │   │
│   │   │   └── Wholesalers/
│   │   │       └── WholesalerList.jsx        # Supplier management
│   │   │
│   │   ├── 📂 context/                       # React Context API
│   │   │   ├── AuthContext.jsx               # Authentication state
│   │   │   ├── ProductContext.jsx            # Product & inventory state
│   │   │   ├── InvoiceContext.jsx            # Invoice creation state
│   │   │   ├── SalesBillsContext.jsx         # Sales bill state
│   │   │   ├── PurchaseBillsContext.jsx      # Purchase bill state
│   │   │   ├── WholesalersContext.jsx        # Supplier state
│   │   │   └── ShopDetailsContext.jsx        # Shop configuration state
│   │   │
│   │   ├── 📂 services/
│   │   │   └── api.js                        # API client (IPC bridge to electron)
│   │   │
│   │   ├── 📂 assets/                        # Static images, icons
│   │   └── 📂 tests/
│   │       └── admin_recovery_test.js        # Admin recovery flow tests
│   │
│   ├── public/                               # Static public files
│   ├── index.html                            # HTML template
│   ├── vite.config.js                        # Vite configuration
│   ├── tailwind.config.js                    # Tailwind CSS config
│   ├── postcss.config.js                     # PostCSS config
│   ├── package.json                          # Frontend dependencies
│   └── eslint.config.js                      # Linting rules
│
├── 📂 electron/                              # Electron main process
│   ├── main.js                               # Electron app entry point
│   ├── preload.js                            # IPC context bridge
│   ├── preload-print.js                      # Print preview preload
│   │
│   └── 📂 licensing/                         # License system
│       ├── licenseValidator.js               # License validation logic
│       ├── hardwareId.js                     # Hardware ID generation
│       └── encryption.js                     # Encryption/decryption utilities
│
├── 📂 database/                              # Database layer
│   ├── db.js                                 # SQLite wrapper (better-sqlite3)
│   └── db-schema.sql                         # Database schema initialization
│
├── 📂 tools/                                 # Utility scripts
│   ├── generateLicense.js                    # License key generator
│   └── showHardwareId.js                     # Display device hardware ID
│
├── 📂 build/                                 # Build assets
│   └── icon.png                              # App icon
│
├── 📂 dist-electron/                         # Build output (generated)
│   ├── latest.yml                            # Update metadata
│   ├── Ojashwai Electrical Store Setup       # Installer executable
│   └── win-unpacked/                         # Unpacked app files
│
├── package.json                              # Root dependencies
├── build.sh                                  # Linux/Mac build script
├── build.bat                                 # Windows build script
├── setup-electron.sh                         # Electron setup script
│
└── README.md                                 # This file
```

---

## 💻 Installation & Setup

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Windows 10+** (for installer builds)
- **Git** (for cloning repository)

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/Electrical-Store-Fully-offline-Inventory-System.git
   cd Electrical-Store-Fully-offline-Inventory-System
   ```

2. **Install root dependencies**:
   ```bash
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd frontend && npm install && cd ..
   ```

4. **Start development environment**:
   ```bash
   npm run dev
   ```
   This runs Vite dev server on `http://localhost:5173` and launches Electron app.

5. **View hardware ID** (needed for license generation):
   ```bash
   node tools/showHardwareId.js
   ```

### Production Build

```bash
npm run dist
```

This creates:
- **NSIS Installer**: `dist-electron/Ojashwai Electrical Store Setup 1.0.0.exe`
- **Portable Version**: Available via electron-builder

---

## 📖 Usage Guide

### First Time Setup

1. **Launch Application**
   - Extract and run the installer or portable executable
   - App launches with License Activation screen

2. **Activate License**
   - Enter your license key
   - Hardware ID automatically detected and verified
   - License valid for configured expiry date

3. **Create Owner Account**
   - Register with email and password
   - This becomes admin account (single-user model)
   - Password recoverable via admin codes

4. **Configure Shop**
   - Fill in shop details (name, address, phone, email)
   - These appear on all invoices
   - Editable anytime in Settings

### Daily Operations

#### Creating Invoices  
1. Navigate to **Billing** → **New Invoice**
2. Select or create customer
3. Add items (auto-complete from inventory)
4. System automatically calculates:
   - Item subtotals
   - Discounts
   - GST taxes (per HSN code)
   - Invoice total
5. Review and print
6. Finalize when payment received
7. Invoice saved automatically

#### Managing Inventory  
1. Go to **Inventory**
2. **Add Product**:
   - Fill product details
   - Add batch with pricing and quantity
   - Can add multiple batches later
3. **Edit Product**:
   - Update prices, quantities, expiry dates
   - Add new batches anytime
4. **Search Products**:
   - Quick search by name
   - Filter by low stock
   - Advanced filters available

#### Recording Purchases  
1. Go to **Sales & Purchases** → **Purchase Bills**
2. Select or create wholesaler
3. Enter purchase bill number and date
4. Add items with quantities and amounts
5. Record partial or full payment
6. Save bill (stock updates automatically)

#### Password Recovery  
1. On login screen, click "Can't log in?"
2. Choose recovery method:
   - **Admin Code** (if previously set)
   - **Email** (future feature)
3. Enter recovery code
4. Reset password
5. Log back in

#### Database Backup/Restore  
1. Go to **Settings** → **Database Management**
2. **Backup**: Click to create encrypted backup file
3. **Restore**: Click and confirm to restore from backup
4. App automatically restarts after restore

---

## 🎨 Features In Detail

### Billing System

**Multi-Item Invoices**
- Add unlimited line items per invoice
- Each item shows: product name, batch, quantity, rate, discount, amount
- Real-time total calculation
- Automatic GST calculation per HSN code

**Discount Handling**
- Item-level discounts (fixed amount or percentage)
- Invoice-level discounts
- Applied before tax calculation

**GST/Tax Support**
- HSN-code-based tax rates
- Automatic tax calculation
- Tax amount shown per item and total
- Tax-inclusive and exclusive options

**Invoice Status Tracking**
- Draft (unsaved)
- Finalized (saved, can't edit)
- Paid (payment received)
- Pending (awaiting payment)

**Print Options**
- Thermal printer format (58mm)
- A4 printer format (standard)
- Print preview before printing
- Can reprint any past invoice

---

### Inventory Management

**Product Batches**
- Multiple batches per product (independent stock)
- Each batch has its own:
  - Batch number (e.g., LOT-2024-001)
  - Pricing (cost, selling, MRP)
  - Quantity
  - Expiry date
- Total stock = sum of all batch quantities
- When billing, system suggests cheapest batch first

**Stock Tracking**
- Real-time quantity updates
- Automatic updates on:
  - New invoices (decreases stock)
  - Purchase bills (increases stock)
- Low stock warnings (configurable threshold)
- Critical stock alerts on dashboard

**Product Search**
- Global search across all products
- Filter by category, price range, stock level
- Search by batch number
- Show stock availability

---

### Security & Licensing

**Hardware Locking**
- License tied to physical machine hardware
- Hardware ID includes: CPU info, motherboard serial, OS info
- License won't work if moved to different hardware
- Prevents unauthorized copying

**License Validation**
- Checked on every app startup
- Validates:
  - Hardware ID match
  - Expiry date
  - License signature
  - System clock (prevents manipulation)
- If invalid, shows activation screen

**Password Security**
- Passwords hashed and salted before storage
- Never transmitted anywhere (fully offline)
- Recovery via admin codes (stored securely)
- Session expires after 24 hours inactivity

**Data Encryption**
- License file encrypted
- Database backups encrypted
- Sensitive data encrypted at rest
- All encryption uses industry-standard algorithms

---

### Admin Tools

**Database Backup**
- Creates encrypted backup file
- Includes all products, invoices, purchases, customers
- Can be stored on USB or cloud
- Timestamped for version tracking

**Database Restore**
- Requires confirmation (irreversible action)
- Restores entire database from backup
- App restarts automatically
- All data reverted to backup time

**Admin Recovery Codes**
- Set optional recovery codes in Settings
- Used if password forgotten
- Works completely offline
- Can be updated anytime

**Shop Profile**
- Configure shop name, logo, address, phone, email
- Shop details printed on all invoices
- Editable anytime
- Multiple shops not supported (single-instance app)

---

## 🔨 Development

### Development Scripts

```bash
# Start Vite dev server + Electron
npm run dev

# Only start Vite frontend dev server (port 5173)
npm run dev:frontend

# Only start Electron (requires Vite running)
npm run dev:electron

# Production build frontend
npm run build

# Run frontend tests
npm run test

# Build Electron installer
npm run dist

# Portable version (no installer)
npm run dist:portable

# Pack for distribution
npm run pack
```

### IPC Communication

Frontend communicates with Electron main process via **IPC (Inter-Process Communication)**:

**Example: Save Invoice**
```javascript
// In React Component
const response = await window.api.saveInvoice(invoiceData);

// In Electron preload.js
electronAPI.saveInvoice = (data) => {
  return ipcRenderer.invoke('save-invoice', data);
}

// In Electron main.js
ipcMain.handle('save-invoice', async (event, invoiceData) => {
  // Business logic here
  return result;
});
```

### Database Integration

All database operations go through `database/db.js` which uses `better-sqlite3`:

```javascript
// Synchronous operations (no async/await needed)
const result = db.run(
  'INSERT INTO invoices (customer_id, total) VALUES (?, ?)',
  [customerId, total]
);
console.log('Inserted invoice ID:', result.lastID);

// Query
const invoices = db.all(
  'SELECT * FROM invoices WHERE customer_id = ? ORDER BY date DESC',
  [customerId]
);

// Single result
const invoice = db.get(
  'SELECT * FROM invoices WHERE id = ?',
  [invoiceId]
);
```

### State Management with Context API

Product Context Example:
```javascript
// In useProducts hook
const [products, setProducts] = useState([]);

// Fetch products
const fetchProducts = async () => {
  const data = await window.api.getProducts();
  setProducts(data);
};

// Update product
const updateProduct = async (id, updates) => {
  const result = await window.api.updateProduct(id, updates);
  await fetchProducts(); // Refresh
  return result;
};
```

### Styling with Tailwind

Uses Tailwind CSS v4 with custom configuration:

```jsx
{/* Responsive layout */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

{/* Custom card component */}
<div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">

{/* Status badge */}
<span className={`px-3 py-1 rounded text-sm ${
  status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
}`}>
  {status}
</span>
```

---

## 🏗️ Building & Distribution

### Windows Installer Build

```bash
# Full build with NSIS Installer
npm run dist

# Outputs:
# - dist-electron/Ojashwai Electrical Store Setup 1.0.0.exe (Installer)
# - dist-electron/latest.yml (Update metadata)
```

### Portable Version

```bash
# Portable executable (no installation needed)
npm run dist:portable
```

### Electron Builder Configuration

Settings in `package.json`:

```json
{
  "build": {
    "appId": "com.ojashwai.electrical.billing",
    "productName": "Ojashwai Electrical Store",
    "win": {
      "target": ["nsis", "portable"]
    }
  }
}
```

### Code Signing (Production)

For production, configure code signing in `package.json`:

```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password"
}
```

---

## 🔒 Security & Licensing

### License System Architecture

1. **Hardware ID Generation**
   - Collects: CPU info, motherboard serial, Windows installation ID
   - Creates SHA-256 hash (unique per device)
   - Never changes unless hardware is replaced

2. **License Key Generation** (Admin)
   ```bash
   node tools/generateLicense.js
   ```
   Creates signed, encrypted license file with:
   - Hardware ID
   - Customer ID
   - Expiry date
   - Cryptographic signature

3. **License Validation**
   - On each startup
   - Verifies hardware ID matches
   - Checks expiry date
   - Validates signature
   - Detects system clock manipulation

### Encryption Details

- **License File**: AES-256 encryption
- **Database Backups**: AES-256 encryption
- **Passwords**: bcrypt hashing
- **Keys**: Stored in secure memory

### Offline Security

- **No Phone-Home**: App never contacts external servers
- **Local Validation**: All checks done locally
- **Encrypted Storage**: All data encrypted at rest
- **Air-Gapped**: Can run on disconnected machine

---

## 🆘 Troubleshooting

### App won't start

**License error on startup:**
- Check license file exists at `AppData/Roaming/com.ojashwai.electrical.billing/license.dat`
- Reactivate license if corrupted
- Check hardware hasn't changed significantly

**Database error:**
- Check database file at `AppData/Roaming/com.ojashwai.electrical.billing/store.db`
- Restore from backup if corrupted
- Delete `store.db` to reinitialize (loses all data)

### Performance issues

**Slow invoice creation:**
- Check for low disk space
- Restart application
- Optimize database: Settings → Database → Defragment

**Memory leaks:**
- Clear browser cache: Settings → Data → Clear Cache
- Restart application after long sessions

### Printing issues

**Thermal printer not responding:**
- Check printer connection in Windows settings
- Verify thermal printer driver installed
- Try printing test page from Windows

**Formatting issues:**
- Use provided print templates (don't modify)
- Check printer paper width settings
- Save as PDF if printer incompatible

### License problems

**"License not valid":**
- Reactivate with valid license key
- Check license hasn't expired
- Ensure hardware ID hasn't changed

**"Hardware ID mismatch":**
- License tied to original hardware
- Cannot transfer to different PC
- Generate new license for new hardware

### Data backup issues

**Backup fails:**
- Check disk space available
- Verify write permissions
- Try backing up to USB drive

**Restore fails:**
- Backup file might be corrupted
- Try different backup file
- Reinstall application and restore

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Code Style

- Use ESLint configuration provided
- Follow React best practices
- Use meaningful variable names
- Add comments for complex logic
- Test before submitting PR

```bash
# Run linter
cd frontend && npm run lint
```

---

## 📝 License

This project is proprietary software for Ojashwai Electrical Store. Unauthorized copying, modification, or distribution is prohibited.

**License**: See LICENSE.md file

---

## 📞 Support & Contact

For issues, feature requests, or support:

- **Email**: support@ojashwaistore.com
- **Phone**: [Your Contact Number]
- **Address**: [Shop Address]

---

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI by [React](https://react.dev/) & [Tailwind CSS](https://tailwindcss.com/)
- Database: [SQLite](https://www.sqlite.org/) & [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- Icons by [Lucide React](https://lucide.dev/)


│   │   │   ├── Common/               # Header, nav, error handling
│   │   │   └── Wholesalers/          # Supplier management
│   │   ├── pages/                    # Page components
│   │   │   ├── Dashboard.jsx         # Overview and statistics
│   │   │   ├── Inventory.jsx         # Product management interface
│   │   │   ├── Billing.jsx           # Invoice creation
│   │   │   ├── Settings.jsx          # Configuration
│   │   │   ├── LoginPage.jsx         # User login
│   │   │   ├── SignupPage.jsx        # Initial setup
│   │   │   ├── ActivationPage.jsx    # License activation
│   │   │   └── ForgotPasswordPage.jsx # Password recovery
│   │   ├── context/                  # State management
│   │   │   ├── AuthContext.jsx       # User authentication
│   │   │   ├── ProductContext.jsx    # Product data
│   │   │   ├── InvoiceContext.jsx    # Invoice data
│   │   │   ├── SalesBillsContext.jsx # Sales tracking
│   │   │   ├── PurchaseBillsContext.jsx
│   │   │   └── WholesalersContext.jsx
│   │   └── services/                 # API calls and utilities
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── electron/                          # Electron main process
│   ├── main.js                       # App initialization and IPC handlers
│   ├── preload.js                    # Secure IPC bridge
│   └── licensing/                    # License validation system
│       ├── licenseValidator.js       # License validation logic
│       ├── encryption.js             # Encryption/decryption utilities
│       ├── hardwareId.js             # Hardware ID generation
│       └── ...
│
├── database/                          # SQLite database layer
│   └── db.js                         # Database initialization and queries
│
├── tools/                             # Utility scripts
│   ├── generateLicense.js            # License generation tool
│   └── showHardwareId.js             # Display hardware ID
│
├── package.json                       # Electron app packages
├── build.bat / build.sh              # Build scripts
└── README.md                          # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (included with Node.js)
- **Git** (optional, for cloning)
- **Windows 7+ or Linux** (Electron packaged for Windows)

### Installation & Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/Niharsh/Electrical-Store-Fully-offline-Inventory-System.git
   cd Electrical-Store-Fully-offline-Inventory-System
   ```

2. **Install dependencies**

   ```bash
   # Install root-level dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

3. **Run in development mode**

   ```bash
   npm run dev
   ```

   This starts:
   - React dev server on `http://localhost:5173`
   - Electron app pointing to the dev server
   - Vite HMR for instant code updates

4. **Verify installation**

   - Electron window should open
   - You'll see the signup page (first-time setup)
   - Create your account and start using the system

### Building for Production

1. **Build the desktop application**

   ```bash
   npm run electron-build
   ```

   This:
   - Compiles the React frontend
   - Bundles everything with Electron
   - Creates a Windows installer `.exe` file
   - Creates a portable version

2. **Output files** are in `dist-electron/`:
   - `Choudhary Electrical Store Setup 1.0.0.exe` — Installer
   - `.exe.blockmap` — Update metadata
   - `latest.yml` — Version information
   - `win-unpacked/` — Unpacked files (for debugging)

### Other useful commands

```bash
# Frontend development only
npm run dev:frontend

# Electron without building frontend
npm run dev:electron

# Build frontend only
npm run build

# Pack for distribution (no installer)
npm run dist:portable
```

---

## 📖 Usage Guide

### Initial Setup (First Time)

1. **Application starts** → Signup page appears
2. **Create owner account** → Enter username, email, password
3. **License activation** → May require license activation
4. **Shop setup** → Configure shop name and details in Settings
5. **Ready to use** → Dashboard is now accessible

### Common Workflows

#### **Create an Invoice**

1. Go to **Billing** section
2. Click **Create New Invoice**
3. Select or add customer details
4. Add items:
   - Search product by name
   - Select batch
   - Enter quantity
   - Unit rate auto-populated
5. Apply discount if needed
6. Click **Save Invoice**
7. **Print** or **Download**

#### **Add New Product**

1. Go to **Inventory** section
2. Scroll to **Add Product** form
3. Fill in:
   - Product name
   - Manufacturer
   - Description
   - Min stock level
4. In batches section:
   - Add batch number, quantity
   - Enter cost price, selling rate, MRP
   - Set expiry date (if applicable)
5. Click **Save Product**
6. Product now appears in billing

#### **Record a Purchase**

1. Go to **Dashboard** (has purchase form)
2. Enter:
   - Bill number from supplier
   - Purchase date
   - Wholesaler name and contact
   - Total amount and paid amount
   - Notes (optional)
3. Click **Save Purchase**
4. Check **Purchase History** to view past records

#### **Manage Shop Details**

1. Go to **Settings**
2. Update:
   - Shop name, address, contact
   - Email, GSTIN
3. Configure **HSN codes** for taxation
4. Create **database backup** for security

#### **Password Recovery**

1. At login, click **Forgot Password?**
2. Enter recovery code (if configured)
3. Set new password
4. Login with new password

---

## 🔒 Security Features

### Data Protection
- **Local-only storage** — All data stays on your machine
- **SQLite encryption** — Database file is local to user directory
- **Session management** — Automatic logout for security

### License System
- **Hardware-locked licenses** — License tied to specific machine
- **Signature verification** — Tamper detection
- **Clock skew detection** — Prevents system time exploitation
- **Offline validation** — License checks work without internet

### Authentication
- **Password hashing** — Bcrypt for password security
- **Admin recovery codes** — Offline-capable password reset
- **Session tokens** — Secure session handling

---

## 🐛 Troubleshooting

### App won't start

**Error: "License invalid"**
- Solution: Go to `/activate` page or restart the app
- If persists: Delete `license.dat` from app user data folder

**Error: "Database locked"**
- Solution: Close all instances of the app and restart
- Ensure no other process is accessing the database

### Products not showing in billing

**Issue: Empty product list**
- Solution 1: Go to Inventory and add some products
- Solution 2: Refresh page (F5)
- Solution 3: Check browser console for errors

### Invoice print looks wrong

**Issue: Layout broken on thermal printer**
- Use 80mm thermal printer - already configured
- Try A4 layout option if available
- Adjust margins in print settings

### Forgotten password

**No recovery code available:**
- Contact the system administrator
- Access database directly (advanced)
- Reinstall app and setup new account

---

## 📝 System Requirements

- **Operating System** — Windows 7 or later (64-bit)
- **RAM** — 512 MB minimum (2 GB recommended)
- **Disk Space** — 200 MB for installation
- **Internet** — Not required (offline-capable)

---

## 🔄 Data Backup & Recovery

### Creating Backups

1. Go to **Settings**
2. Click **Create Database Backup**
3. Choose location to save backup
4. Backup file created as `.backup`

### Restoring from Backup

1. Go to **Settings**
2. Click **Restore from Backup**
3. Select `.backup` file
4. Confirm restoration
5. App restarts with restored data

---

## 🤝 Contributing

This is a specialized retail management system. For bug reports or feature requests:

1. Document the issue clearly
2. Include reproduction steps
3. Attach screenshots if relevant
4. Contact project maintainers

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 👨‍💼 About

**Choudhary Electrical Store** — Professional billing and inventory solution built with modern web technologies, designed for reliability and offline capability.

**Built with:**
- Electron for cross-platform desktop
- React for responsive UI
- SQLite for reliable local data
- Tailwind CSS for professional styling

---

## 📞 Support & Contact

For questions, issues, or feature requests:

- 📧 Email: support@choudharyelectrical.com
- 🌐 Website: [choudharyelectrical.com](https://choudharyelectrical.com)
- 🐛 Issues: [GitHub Issues](https://github.com/Niharsh/Electrical-Store-Fully-offline-Inventory-System/issues)

---

**Last Updated:** March 2026
**Version:** 1.0.0
**Status:** Production Ready ✅
   ```

3. **Run in development mode**

   ```bash
   npm run dev
   ```

   This command starts the Vite dev server (default `http://localhost:5173`) and launches
   the Electron desktop application. Changes to frontend or backend code reload automatically.

4. **Build for distribution**

   ```bash
   npm run build
   ```

   Outputs packaged desktop binaries under `dist-electron/` (Windows, macOS, Linux builds
   depending on configuration).

---

## 🛠 Features overview

- **Offline-first billing & inventory** tailored for single Electrical shops
- Batch-based quantity tracking with expiry alerts
- Invoice creation, printing (thermal/A4) with tax calculations
- Purchase entry form with automatic stock updates
- Shop settings and local admin recovery codes

The application runs entirely locally using SQLite; no network or cloud services are
required once installed.

---

## 🧩 Technical stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | React 18, Vite, Tailwind CSS |
| Backend   | Electron main process (Node.js) |
| Database  | SQLite (local file)     |
| Packaging | Electron                |

---

## 💡 Troubleshooting

- **Port 5173 occupied** – dev script automatically switches to the next available port.
- **Electron shows blank window** – ensure the Vite server is running (`npm run dev`).
- **SQLite locked** – close all instances of the app before restarting.

---

## 📄 License

This project is released under the MIT License.

---

## 🙋‍♂️ Author

Niharsh

