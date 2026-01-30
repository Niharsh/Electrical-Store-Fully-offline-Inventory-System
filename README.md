# Medical Store Inventory & Billing System

A desktop-first, offline-capable Medical Store Inventory and Billing app built with React (Vite) + Django REST Framework and packaged with Electron.

This repository contains frontend and backend code, documentation, and tests. For full developer documentation see the `DOCUMENTATION_AND_GUIDES/` directory.

---

## Quick start (development)

1. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

2. Backend

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver
# Backend API at http://localhost:8000/api
```

## Admin Recovery (Offline)

This project supports an offline Admin Recovery Code flow that allows shop owners to reset their password without internet access. The full flow is documented in `DOCUMENTATION_AND_GUIDES/ADMIN_RECOVERY_OFFLINE.md`.

Quick summary:
- Configure a local Admin Recovery Code in **Settings → Shop Details** (stored in `localStorage.admin_recovery_code`).
- From Login → **Forgot Password** → **Choose Recovery Method** → **Admin Code (Offline)** → Verify Code → **Set New Password**
- The Set New Password screen stores a SHA-256 hashed local override in `localStorage.offline_passwords` allowing immediate login on this device.
- This flow is local-only and does not change server-side credentials automatically.

## Run the acceptance test (Admin Recovery)

1. In `frontend` install dev deps (once):
```bash
cd frontend
npm install
```

2. Start the frontend dev server:
```bash
npm run dev
```

3. In another terminal run the acceptance test:
```bash
npm run test:admin-recovery
```

This test uses Playwright to walk the full offline Admin recovery flow and exits with status 0 on success.

---

## Contributing
See `DOCUMENTATION_AND_GUIDES/DEVELOPER_GUIDE.md` for contribution guidelines and development workflows.

## License
MIT
