# 🏥 Medical Store Inventory & Billing Management System

> A desktop-first, offline-capable medical store billing and inventory system designed for single-shop operators. Reliable in low- or no-network environments and packaged for desktop via Electron.

---

## ❓ Why this project exists

Small medical shops need a simple, dependable system that works even when internet connectivity is unreliable. This project provides a compact, offline-first billing and inventory workflow tailored to shop owners who need:

- Fast billing and invoice generation
- Batch-based inventory and expiry management
- Offline password recovery for local access when email is unavailable

---

## ✨ Key features

### Inventory Management

- **Add / edit / remove products** with flexible product types
- **Batch tracking** with quantities and per-batch expiry dates
- **Search & filter** by name, type, or batch
- **Low stock indicators** to highlight replenishment needs

### Expiry Management

- **3-month and 1-month pre-expiry alerts** per batch
- **Expiry dashboard** to review soon-to-expire stock
- **Actions** to view or remove expired batches

### Billing System

- **Create invoices** with multiple line items
- **Quantity shown before product name** (prints clearly on thermal/A4 receipts)
- **Paid / pending amount handling** with clear invoice state
- **₹NaN handling** guarded so invoices display correctly even when amounts are zero
- **Print-friendly layouts** for thermal and A4 printing modes

### Purchase Management

- **Record supplier purchases** (supplier name, bill number, date, contact)
- **Automatic stock updates** when purchase entries are created
- **Purchase history** with search and filtering

### Shop Profile Management

- **Shop details** (name, address, contact) used across invoices and reports
- **Local Admin Recovery Code** (optional) stored in browser for offline password recovery

---

## 🛠 Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Python, Django, Django REST Framework |
| Database | SQLite (development) |
| Packaging | Electron (desktop builds) |
| Testing | Playwright (acceptance test) |

---

## 📁 Project folder structure

```
project-root/
├── backend/                     # Django project, apps, migrations
├── frontend/                    # React + Vite app (UI, pages, components)
├── electron/                    # Electron packaging and preload scripts
├── DOCUMENTATION_AND_GUIDES/    # Detailed docs, testing guides, QA checklists
└── README.md                    # This file
```

---

## ✅ Step-by-step setup

Follow these steps to run the project locally (development mode):

### 1) Clone repository

```bash
git clone https://github.com/Niharsh/medical-store-inventory-system.git
cd medical-store-inventory-system
```

### 2) Backend setup (Django)

```bash
# Create and activate a Python virtual environment (example uses .venv)
cd backend
python -m venv .venv
source .venv/bin/activate    # Linux / macOS
# For Windows use: .venv\Scripts\activate

# Install dependencies and apply migrations
pip install -r requirements.txt
python manage.py migrate

# Start the backend server
python manage.py runserver
# Backend API base: http://127.0.0.1:8000/api/
```

Notes:
- Use `python manage.py createsuperuser` to create an admin if needed for testing.
- Database: SQLite is used by default for development.

### 3) Frontend setup (React)

```bash
cd ../frontend
npm install
npm run dev
# Frontend dev server: http://localhost:5173
```

Notes:
- If your backend API is running on a different host or port, set `VITE_API_URL` in `frontend/.env.local`.
- Playwright is used only for the automated acceptance test and downloads browser binaries on first install.

---

## 🔗 URLs (default development)

- Frontend: http://localhost:5173
- Backend API base: http://127.0.0.1:8000/api/

---

## 🧠 Common commands (brief)

| Command | Purpose |
|---|---|
| `git clone <repo>` | Clone repository |
| `cd backend && python -m venv .venv && source .venv/bin/activate` | Create & activate Python venv |
| `pip install -r requirements.txt` | Install backend dependencies |
| `python manage.py migrate` | Apply migrations |
| `python manage.py runserver` | Start Django dev server |
| `cd frontend && npm install` | Install frontend dependencies |
| `npm run dev` | Start Vite dev server |
| `cd frontend && npm run test:admin-recovery` | Run Admin Recovery acceptance test (Playwright) |

---

## 🐞 Common issues & fixes

- **Port already in use**: start Django on another port:

```bash
python manage.py runserver 8001
```

- **Missing Python package**: install it in the active venv:
```bash
pip install <package-name>
```

- **CORS errors**: enable or configure CORS in Django settings for the frontend origin during development (see `django-cors-headers`).

- **Playwright download fails**: ensure network access for initial `npm install` (or install Playwright browsers manually).

---

## 🔮 Roadmap & future improvements

- Multi-user roles (Admin / Staff) and per-user permissions
- Cloud sync with optional encryption and backup
- Barcode scanner integration for quick billing
- GST reporting and finance exports
- Sales analytics & dashboards
- Mobile client / PWA support

---

## 📌 Intended usage

- Single-shop medical stores (owner/operator focused)
- Local system deployment (desktop-first)
- Situations where network connectivity is unreliable

---

## 📄 License & usage notice

This project is provided under the **MIT License**. It is intended for educational and personal use; commercial terms can be discussed separately.

---

For additional developer documentation, testing guides, and QA checklists see `DOCUMENTATION_AND_GUIDES/`.


Extensive documentation is available under `DOCUMENTATION_AND_GUIDES/` (setup, architecture, testing guides, and developer notes).

---

## 🤝 Contributing
- See `DOCUMENTATION_AND_GUIDES/DEVELOPER_GUIDE.md` for contribution guidelines and workflows
- Please open issues or PRs for bugs or enhancements

---

## 📄 License
MIT

---
