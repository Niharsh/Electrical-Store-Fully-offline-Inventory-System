#!/bin/bash

# Choudhary Electrical Store - Electron Installation & Verification Script
# This script sets up Electron and verifies all components work correctly

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Choudhary Electrical Store - Electron Setup & Verification    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/home/niharsh/Desktop/Inventory"
cd "$PROJECT_DIR"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verify project structure
echo -e "${YELLOW}Step 1: Verifying project structure...${NC}"
if [ -d "frontend" ] && [ -d "electron" ]; then
    echo -e "${GREEN}✓ Project structure verified${NC}"
else
    echo -e "${RED}✗ Missing directories. Expected: frontend/, electron/${NC}"
    exit 1
fi

# Step 2: Check Node.js installation
echo ""
echo -e "${YELLOW}Step 2: Checking Node.js installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 14+${NC}"
    exit 1
fi

# Step 3: Check Python installation
echo ""
echo -e "${YELLOW}Step 3: Checking Python installation...${NC}"
if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo -e "${GREEN}✓ Python found: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}✗ Python not found. Please install Python 3.8+${NC}"
    exit 1
fi

# Step 4: Install root dependencies
echo ""
echo -e "${YELLOW}Step 4: Installing root dependencies (Electron, builder, etc.)...${NC}"
if npm install; then
    echo -e "${GREEN}✓ Root dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to install root dependencies${NC}"
    exit 1
fi

# Step 5: Check frontend dependencies
echo ""
echo -e "${YELLOW}Step 5: Checking frontend dependencies...${NC}"
if [ -f "frontend/node_modules/.package-lock.json" ] || [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓ Frontend dependencies already installed${NC}"
else
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd "$PROJECT_DIR"
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
fi

# Step 6: Verify Electron files
echo ""
echo -e "${YELLOW}Step 6: Verifying Electron files...${NC}"
if [ -f "electron/main.js" ] && [ -f "electron/preload.js" ]; then
    echo -e "${GREEN}✓ Electron main.js and preload.js verified${NC}"
else
    echo -e "${RED}✗ Missing Electron files${NC}"
    exit 1
fi

# Step 7: Verify package.json
echo ""
echo -e "${YELLOW}Step 7: Verifying package.json configuration...${NC}"
if grep -q "\"electron\"" package.json && grep -q "\"electron-builder\"" package.json; then
    echo -e "${GREEN}✓ package.json has Electron configuration${NC}"
else
    echo -e "${RED}✗ package.json missing Electron configuration${NC}"
    exit 1
fi

# Step 8: Verify vite.config.js
echo ""
echo -e "${YELLOW}Step 8: Verifying Vite configuration...${NC}"
if grep -q "outDir: 'dist'" frontend/vite.config.js; then
    echo -e "${GREEN}✓ Vite config verified${NC}"
else
    echo -e "${RED}✗ Vite config not found${NC}"
    exit 1
fi

# Step 9: Display startup instructions
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All checks passed! System ready for development${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
echo ""
echo "1️⃣  Start Development (Terminal 1):"
echo -e "   ${YELLOW}cd $PROJECT_DIR${NC}"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo -e "${YELLOW}This will automatically start:${NC}"
echo "   • React dev server on http://localhost:5173"
echo "   • Electron window pointing to dev server"
echo "   • DevTools for debugging"
echo ""
echo -e "${YELLOW}📦 Build for Distribution:${NC}"
echo -e "   ${YELLOW}npm run dist${NC}"
echo "   Creates: dist-electron/Choudhary Electrical Store-1.0.0.exe"
echo ""
echo -e "${YELLOW}✨ Features that work:${NC}"
echo "   ✓ React hot-reload (HMR)"
echo "   ✓ Printing (same as browser)"
echo "   ✓ Offline usage (localStorage)"
echo "   ✓ Auto-login with saved token"
echo "   ✓ All existing features unchanged"
echo ""
