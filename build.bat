@echo off
REM 🎯 Production Build Script for Windows (.bat)
REM Builds frontend and prepares for Electron packaging

setlocal enabledelayedexpansion

echo 🔨 STEP 1: Building React frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo ❌ Frontend build failed
    exit /b 1
)
echo ✅ Frontend built: dist/

echo.
echo 🔨 STEP 2: Collecting Django static files...
cd ..\backend
call .venv\Scripts\python manage.py collectstatic --noinput
if errorlevel 1 (
    echo ❌ Static file collection failed
    exit /b 1
)
echo ✅ Static files collected

echo.
echo 🎉 BUILD COMPLETE!
echo Next: Use 'npm run electron-build' to package .exe
