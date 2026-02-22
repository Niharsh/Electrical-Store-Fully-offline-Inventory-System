# 🚀 QUICK START - Development & Production

## 🛠️ Development (5 minutes)

### Prerequisites
- ✅ Python 3.10+ [installed](https://python.org)
- ✅ Node.js LTS [installed](https://nodejs.org)
- ✅ Project cloned

### Start Development Servers

**Terminal 1 - Frontend (Vite)**
```bash
cd frontend
npm install                    # (if not done yet)
npm run dev                    # Runs on http://localhost:5173
```

**Terminal 2 - Backend (Django)**
```bash
cd backend
python -m venv .venv           # (if not done yet)
.venv\Scripts\activate         # (Windows)
pip install -r requirements.txt # (if not done yet)
python manage.py migrate       # (if not done yet)
python manage.py runserver 0.0.0.0:8000   # Runs on http://localhost:8000
```

**Terminal 3 - Electron (Optional)**
```bash
npm run dev:electron
# Or combined dev mode:
npm run dev                    # Starts all 3 (frontend, backend, electron)
```

### Access App
- **Vite UI**: http://localhost:5173
- **Django Backend**: http://localhost:8000
- **Electron**: Launches automatically in dev mode

### Typical Workflow
```bash
# Edit React components → See live changes in Vite
# Edit Django code → Auto-reload on save
# Both run simultaneously, completely independent

# CORS is enabled in dev mode for localhost:5173 ↔ localhost:8000
```

---

## 🏗️ Production Build (5 minutes)

### Build Complete Package

```bash
# Step 1: Build everything
npm run build:all

# Output:
# ✅ frontend/dist/         - Minified React app
# ✅ backend/staticfiles/   - Django static files
```

### Test Production Locally

```bash
# Terminal 1: Set production mode and run backend
$env:DEBUG='False'
cd backend
python manage.py runserver 127.0.0.1:8000

# Open browser: http://localhost:8000
# Frontend loads from single origin ✅
# API available at /api ✅
# No CORS issues ✅
```

### Package as .exe

```bash
# Create Windows installers
npm run electron-build

# Output: dist-electron/
# ├── Choudhary_Medical_Store-1.0.0.exe        (NSIS installer)
# ├── Choudhary_Medical_Store-1.0.0-portable.exe (Standalone)
# └── ... (other build artifacts)
```

### Distribute

```bash
# Users download .exe
# Run installer (or portable)
# App starts with one click
# Django launches automatically
# No external dependencies needed
```

---

## 📊 Architecture Summary

### Development
```
Your Machine:
├─ Vite Dev Server (5173)     ← Change React → See instant updates
├─ Django Dev Server (8000)   ← Change Python → Auto-reload
└─ Electron (Dev Mode)        ← Loads Vite, dev tools open
   └─ CORS: Enabled (localhost:5173 ↔ 8000)
```

### Production
```
User Machine:
├─ Electron App (.exe)
│  └─ URL: http://localhost:8000
└─ Django Server (8000) - starts automatically
   ├─ Serves React build
   └─ Provides /api
   
   ✓ No CORS needed (single origin)
   ✓ No Vite dev server
   ✓ No Node.js runtime needed
   ✓ Completely offline
   ✓ One visible port (8000)
```

---

## 📁 File Structure

```
Medical Store Inventory System/
├─ frontend/
│  ├─ src/                  (React components)
│  ├─ dist/                 (Built production app)
│  ├─ .env.development      (Dev API URL)
│  ├─ .env.production       (Prod API URL)
│  ├─ vite.config.js        (Build config)
│  └─ package.json
│
├─ backend/
│  ├─ config/               (Django settings)
│  ├─ inventory/            (App logic)
│  ├─ authentication/       (Auth logic)
│  ├─ manage.py
│  ├─ .venv/                (Python env)
│  ├─ requirements.txt
│  └─ db.sqlite3            (Database)
│
├─ electron/
│  ├─ main.js               (App entry + Django launcher)
│  ├─ preload.js
│  └─ (Electron code)
│
├─ package.json             (Root npm config + build tasks)
├─ PRODUCTION_ARCHITECTURE.md
├─ PRODUCTION_CHECKLIST.md
└─ (Documentation files)
```

---

## 🔧 Common Commands

### Frontend
```bash
cd frontend
npm run dev         # Start Vite dev server (5173)
npm run build       # Production build → dist/
npm run lint        # Check code quality
npm run preview     # Preview production build locally
```

### Backend
```bash
cd backend
python manage.py runserver
python manage.py migrate
python manage.py createsuperuser
python manage.py shell
```

### Electron
```bash
npm run dev:electron           # Launch Electron (dev)
npm run electron-build         # Package .exe
npm run build:all              # Build all (frontend + backend + statics)
```

### Root (Project-Level)
```bash
npm run build:all              # Frontend + Backend static collection
npm run dev                    # Start everything (Vite + Django + Electron)
npm run electron-build         # Package for Windows
npm install                    # Install all deps (frontend + root)
```

---

## 🔐 Login Credentials (Development)

When you start the app for the first time:
1. Create a superuser (database admin):
   ```bash
   cd backend
   python manage.py createsuperuser
   ```

2. Login with created credentials
3. Dashboard displays inventory + billing

---

## ⚠️ Troubleshooting

### Issue: "Port already in use"
```bash
# Find process on port 8000
netstat -ano | findstr :8000

# Kill process
taskkill /PID <PID> /F
```

### Issue: "Database locked"
```bash
# Remove lock file
cd backend
rm db.sqlite3-shm db.sqlite3-wal
```

### Issue: "Module not found" (Frontend)
```bash
cd frontend
npm install
```

### Issue: "Requirements not met" (Backend)
```bash
cd backend
.venv\Scripts\pip install -r requirements.txt
```

### Issue: CORS errors in dev
- Ensure Vite is running on 5173
- Ensure Django is running on 8000
- Django should have CORS enabled for development (default in refactored config)

---

## 🎯 What's Changed for Production

| Aspect | Development | Production |
|--------|-------------|------------|
| API URL | http://localhost:8000/api | /api (relative) |
| Frontend Server | Vite (5173) | Django (8000) |
| CORS | Enabled | Disabled |
| DEBUG | True | False |
| Minification | None | Terser |
| Source Maps | Yes | No |
| Visible Ports | 5173 + 8000 | 8000 only |

---

## ✅ Verification Checklist

**Before deploying .exe:**

- [ ] `npm run build:all` completes without errors
- [ ] `http://localhost:8000/` loads React UI
- [ ] `http://localhost:8000/api/...` returns (401 is OK, means auth working)
- [ ] Login works → token generated → API calls authenticate
- [ ] Database operations work (create/read/update/delete)
- [ ] Offline test: disconnect internet, app still works
- [ ] Clean shutdown: close app, no orphaned processes

---

## 📞 Support Resources

- **Backend API**: [Django REST Framework](https://www.django-rest-framework.org/)
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Desktop**: [Electron](https://www.electronjs.org/)
- **Build**: [Electron Builder](https://www.electron.build/)

---

**Version**: 1.0.0 (Production Ready)  
**Last Updated**: 2026-02-21  
**Status**: ✅ Ready for .exe Distribution
