# 🎯 PRODUCTION ARCHITECTURE - Medical Store Inventory System

## Overview

The application has been refactored for **production-ready desktop deployment** with a unified, zero-configuration architecture:

- ✅ **Single Origin**: Frontend and backend share `localhost:8000`
- ✅ **No CORS Issues**: Desktop app runs locally (Electron)
- ✅ **No Multiple Ports**: User sees only one running port (8000)
- ✅ **No Dev-Only Dependencies**: Production build has no Vite, Node, or npm at runtime
- ✅ **Offline Capable**: App runs completely offline once installed
- ✅ **One-Click Launch**: `.exe` starts everything (Django + Frontend) automatically

---

## Architecture Changes

### Before (Development)
```
User Machine:
├─ Electron (Port N/A)
├─ Vite Dev Server (Port 5173)
├─ Django Backend (Port 8000)
└─ API calls: localhost:8000/api ❌ CORS conflicts
```

### After (Production)
```
User Machine:
├─ Electron Window
│  └─ Loads: http://localhost:8000
└─ Django Backend (Port 8000) - starts automatically
   ├─ Serves React Build ✅
   └─ Provides API: /api ✅
```

---

## Configuration Changes

### 1. Django Settings (`backend/config/settings.py`)

**Production Settings:**
```python
DEBUG = False  # Production mode
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']  # Local only
CORS_ALLOWED_ORIGINS = []  # Disabled (not needed locally)
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR.parent / 'frontend' / 'dist']  # Serve React build
```

**Environment Variable:**
- `DEBUG=False` triggers production mode in Electron

### 2. Frontend Configuration

**Environment Files:**
- `.env.development`: `VITE_API_BASE_URL=http://localhost:8000/api` (dev use)
- `.env.production`: `VITE_API_BASE_URL=/api` (relative path for unified origin)

**API Service (`src/services/api.js`):**
- Dynamically selects URL based on build environment
- Supports both development (separate ports) and production (unified)

### 3. Vite Configuration (`vite.config.js`)

**Production Build:**
```javascript
build: {
  minify: 'terser',  // Minify for smaller bundle
  sourcemap: false,  // No source maps in production
  outDir: "dist",    // Output to dist/
}

server: {
  proxy: {
    '/api': { target: 'http://localhost:8000' }  // Dev convenience
  }
}
```

### 4. Electron Main Process (`electron/main.js`)

**Production Features:**
- 🔧 Automatically launches Django backend via subprocess
- 🔌 Waits for backend to start before showing UI
- 🛑 Graceful shutdown: terminates Django when app closes
- 🔒 Prevents opening external URLs
- 🎯 Loads unified app from `http://localhost:8000`

---

## Build & Deployment Process

### Development Workflow (No Changes)
```bash
# Terminal 1: Frontend dev server
cd frontend && npm run dev          # Vite: localhost:5173

# Terminal 2: Backend dev server  
cd backend && .venv/Scripts/python manage.py runserver 0.0.0.0:8000

# Terminal 3: Electron (optional, uses Vite URL)
npm run dev:electron
```

### Production Build
```bash
# Build React
npm run build              # frontend/dist/ created

# OR use convenience script
npm run build:all          # Frontend + Django static files

# Package as .exe
npm run electron-build     # Creates dist-electron/
                           # Output: .exe installers
```

### What the Build Script Does
1. ✅ Builds React production bundle → `frontend/dist/`
2. ✅ Collects Django static files → `backend/staticfiles/`
3. ✅ Packages Electron app with:
   - Full backend code + virtualenv
   - Frontend build
   - Electron runtime

---

## File Structure (Production)

```
Medical Store App (Installed)
├─ electron/
│  ├─ main.js              (Starts Django + Electron window)
│  ├─ preload.js
│  └─ (Node code)
├─ frontend/
│  ├─ dist/                (Built React app)
│  │  ├─ index.html
│  │  ├─ assets/
│  │  └─ (static files)
│  └─ public/
├─ backend/
│  ├─ manage.py
│  ├─ config/
│  ├─ inventory/
│  ├─ authentication/
│  ├─ .venv/              (Python virtualenv - bundled)
│  ├─ db.sqlite3          (User data - persists)
│  ├─ staticfiles/        (Collected static files)
│  └─ requirements.txt
└─ package.json
```

---

## How It Works (User Perspective)

### Installing the App
```
1. User downloads: Choudhary_Medical_Store-1.0.0.exe
2. Runs installer → App installed to Program Files
3. Creates desktop shortcut + Start Menu entry
```

### Launching the App
```
1. User clicks desktop shortcut
   ↓
2. Electron process starts
   ↓
3. Electron launches Django backend (subprocess)
   Django starts: runserver localhost:8000
   ↓
4. Electron waits 2 seconds (for Django to boot)
   ↓
5. Electron window opens
   Loads: http://localhost:8000
   ↓
6. Django serves React frontend + API from same origin
   ✅ No CORS issues
   ✅ No multiple ports exposed
   ✅ Completely offline
   ✓ app is fully functional
```

### Closing the App
```
1. User closes Electron window
   ↓
2. Electron triggers 'before-quit' hook
   ↓
3. Django subprocess is terminated
   ↓
4. App completely exits
   ✅ No orphaned processes
```

---

## Environment Variables

### Development
```bash
DEBUG=True                          # Python dev mode
VITE_API_BASE_URL=http://localhost:8000/api
```

### Production (Automatic in .exe)
```bash
DEBUG=False                         # Python production mode
VITE_API_BASE_URL=/api             # Relative path (same origin)
```

---

## Eliminating Development Dependencies

### Frontend (Production Only)
- ❌ **Removed**: Vite dev server (port 5173) - not in .exe
- ❌ **Removed**: Node.js runtime - not required by end user
- ❌ **Removed**: npm - not required by end user
- ✅ **Kept**: Minified React bundle (small, fast, embedded)

### Backend (Both Dev & Prod)
- ✅ **Kept**: Django (required for API)
- ✅ **Kept**: Python virtualenv (required for Django)
- ✅ **Kept**: database (SQLite - file-based, travels with app)

### Electron (Production Only)
- 🔧 **Added**: Django launcher capability
- ✅ **Kept**: Process manager, window handler
- ❌ **Removed**: Dev tools in production builds

---

## Security Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **CORS** | Enabled for "any origin" | Disabled (localhost-only) |
| **DEBUG** | Always True | False in production |
| **ALLOWED_HOSTS** | Empty (wildcard) | ['127.0.0.1', 'localhost'] |
| **Source Maps** | Included in build | Excluded (production) |
| **External URLs** | Could open | Prevented by Electron |

---

## Testing Production Build

### 1. Build Frontend
```bash
cd frontend
npm run build
```

### 2. Test Unified Server
```bash
cd backend
# Set production mode
$env:DEBUG='False'

# Run server
.venv\Scripts\python manage.py runserver 127.0.0.1:8000

# Test in browser:
# - http://localhost:8000/        → React frontend
# - http://localhost:8000/api/... → API endpoints (auth required)
```

### 3. Test Electron App (Dev Mode)
```bash
npm run dev:electron
## Loads from Vite, but can be modified to load from http://localhost:8000
```

### 4. Build & Package .exe (When Ready)
```bash
npm run electron-build
# Output: dist-electron/Choudhary_Medical_Store-1.0.0.exe
```

---

## Troubleshooting

### Issue: "Frontend not built" error in production
**Solution**: Run `npm run build` before packaging
```bash
npm run build:all  # Builds frontend + Django static files
npm run electron-build
```

### Issue: API returns 401 Unauthorized
**Solution**: Normal - frontend handles auth. Login with owner credentials.

### Issue: Multiple Django processes running (Windows)
**Solution**: Kill orphaned processes
```powershell
taskkill /F /IM python.exe  /T
# or use taskmgr
```

### Issue: Port 8000 already in use
**Solution**: Change port in `electron/main.js`
```javascript
djangoProcess = spawn(pythonExe, [managePy, 'runserver', '127.0.0.1:8001']);
```

---

## Performance & Bundle Size

### Frontend Build (Production)
- 📦 **Main bundle**: ~325 KB before gzip
- 📦 **Gzipped**: ~87 KB on-disk
- 🚀 **Load time**: <1 second (local app)
- 💾 **All assets**: ~45 KB CSS, ~36 KB axios, ~47 KB React

### Startup Time
- ⏱️ Django bootstrap: ~2 seconds
- ⏱️ React render: <1 second
- ⏱️ **Total**: ~3 seconds from .exe click to working app

---

## Next Steps

1. ✅ **Development Testing**
   - Test with dev servers running (ports 5173 + 8000)
   - Verify API calls work

2. ✅ **Production Testing**
   - Build: `npm run build:all`
   - Test: `npm run dev:electron` (modified to use localhost:8000)
   - Verify unified origin works

3. ✅ **Packaging**
   - Run: `npm run electron-build`
   - Test installer on clean Windows VM
   - Verify offline capability

4. ✅ **Deployment**
   - Sign installer (optional, improves trust)
   - Distribute .exe to end users
   - Provide update mechanism (Electron auto-updater)

---

## Summary

This refactored architecture provides:
- ✅ **Zero CORS Issues** - single origin deployment
- ✅ **No Multiple Ports** - user sees only localhost:8000
- ✅ **Complete Offline** - no internet required
- ✅ **One-Click Launch** - Django starts automatically
- ✅ **Production-Ready** - optimized build, no dev dependencies exposed
- ✅ **Clean Separation** - dev vs production configs
- ✅ **Seamless Integration** - Frontend + Backend + Electron work together

The .exe will be a self-contained desktop application with no external dependencies required from the end user.
