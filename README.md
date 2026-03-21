# ⚡ Choudhary Electrical Store - Desktop Billing & Inventory System

> A powerful, offline-capable desktop billing and inventory management system designed for electrical stores. Works seamlessly without internet connectivity and features comprehensive product management, billing, and purchase tracking—all packed into a lightweight Electron application.

---

## 🎯 Why This Project Exists

Small electrical and retail shops need a reliable, fast, and easy-to-use billing system that doesn't depend on internet connectivity. This project provides:

- **Offline-first design** — No internet required, works anywhere
- **Lightning-fast billing** — Quick invoice generation and printing
- **Complete inventory control** — Track products with batch pricing and expiry management
- **Professional invoicing** — GST support, custom discount handling, multiple print layouts
- **Data security** — Hardware-locked licensing, encrypted credentials, local SQLite storage
- **Shop admin tools** — Database backup/restore, password recovery, shop profile management

Perfect for single-shop operators who need simplicity, reliability, and security.

---

## ✨ Key Features

### 🔐 **User Authentication & Access Control**
- **One-time owner registration** — Secure account creation with email and password
- **Session management** — Login/logout with offline session persistence
- **Password recovery** — Admin code-based recovery for offline environments
- **License activation** — Hardware-locked license validation on startup
- **Single-user model** — Designed for shop owner or admin use

### 📦 **Inventory Management**
- **Product creation & modification** — Add, edit, delete products with detailed information
- **Flexible product types** — Support for various electrical items (cables, switches, fixtures, etc.)
- **Batch tracking** — Manage multiple batches per product with individual:
  - Batch numbers
  - Quantities
  - Cost price, selling rate, and MRP
  - Expiry dates (if applicable)
- **Low stock alerts** — Dashboard displays critical and warning-level low stock items
- **HSN code management** — Configure HSN (Harmonized System of Nomenclature) codes for taxation
- **Quick product search** — Fast search and filter across all products

### 💰 **Professional Billing System**
- **Invoice creation** — Create detailed invoices with multiple line items
- **Customer management** — Save and retrieve customer information for repeat sales
- **Invoice editing** — Modify existing invoices before finalization
- **Flexible pricing** — Support for discounts, tax types (GST), and custom notes
- **Payment tracking** — Record paid and pending amounts with invoice status
- **Invoice history** — Search and filter past invoices by date, customer, or amount
- **Print-friendly layouts** — Optimized for both thermal and A4 printers
- **Digital storage** — All invoices stored locally for offline access

### 🛒 **Purchase & Supplier Management**
- **Purchase bill recording** — Log supplier purchases with bill number, date, and contact
- **Automatic stock updates** — Stock increases automatically when purchase bills are created
- **Wholesaler tracking** — Maintain supplier information and contact details
- **Purchase history** — View and filter past purchases
- **Amount tracking** — Record total amount and paid amount with pending balance calculation

### 🏪 **Shop Profile & Configuration**
- **Shop details setup** — Configure shop name, address, phone, email for invoices
- **Database backup** — Create encrypted backups of all data
- **Database restore** — Recover from backups when needed
- **Admin recovery codes** — Set optional recovery codes for offline password access
- **Settings management** — Control HSN codes and shop configuration

### 📊 **Dashboard & Analytics**
- **Quick overview** — Total products, recent invoices, and sales summary at a glance
- **Low stock monitoring** — Identify products needing replenishment
- **Sales & purchase tracking** — View monthly or custom period summaries
- **Sales/purchase summaries** — Track paid, pending, and total amounts

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite, Tailwind CSS, React Router v6 |
| **Desktop Framework** | Electron 32+ with IPC communication |
| **Backend** | Node.js (Electron main process) |
| **Database** | SQLite with better-sqlite3 (synchronous) |
| **Build & Packaging** | Electron Builder (Windows NSIS + Portable) |
| **Styling** | Tailwind CSS with custom components |
| **State Management** | React Context API |

---

## 📁 Project Structure

```
Electrical-Store-Fully-offline-Inventory-System/
├── frontend/                          # React application (Vite + Tailwind)
│   ├── src/
│   │   ├── App.jsx                   # Main router and layout
│   │   ├── components/               # Reusable UI components
│   │   │   ├── Billing/              # Invoice and billing forms
│   │   │   ├── Product/              # Product management
│   │   │   ├── SalesAndPurchases/    # Purchase tracking
│   │   │   ├── Settings/             # Configuration
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

- **Offline-first billing & inventory** tailored for single medical shops
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

