#!/bin/bash
# 🎯 Production Build Script for Electrical Store Inventory System
# Builds frontend and prepares for Electron packaging

set -e

echo "🔨 STEP 1: Building React frontend..."
cd frontend
npm run build
echo "✅ Frontend built: dist/"

echo ""
echo "🔨 STEP 2: Collecting Django static files..."
cd ../backend
.venv/Scripts/python manage.py collectstatic --noinput
echo "✅ Static files collected"

echo ""
echo "🎉 BUILD COMPLETE!"
echo "Next: Use 'npm run electron-build' to package .exe"
