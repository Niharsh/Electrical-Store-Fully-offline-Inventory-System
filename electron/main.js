const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let djangoProcess = null;  // 👇 DESKTOP PRODUCTION: Track Django subprocess

// Ensure single instance (prevents multiple running instances)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Windows: set AppUserModelId for proper shortcuts & notifications
if (process.platform === "win32" && app.setAppUserModelId) {
  app.setAppUserModelId("com.choudharymedical.billing");
}

// 👇 DESKTOP PRODUCTION: Launch Django backend server
async function startDjangoServer() {
  if (app.isPackaged) {
    // Production: Django bundled with app
    const backendPath = path.join(process.resourcesPath, 'backend');
    const pythonExe = path.join(backendPath, '.venv', 'Scripts', 'python.exe');
    const managePy = path.join(backendPath, 'manage.py');
    
    if (!fs.existsSync(pythonExe) || !fs.existsSync(managePy)) {
      console.error('Backend files not found. Production build incomplete.');
      return;
    }

    const { spawn } = require('child_process');
    process.env.DEBUG = 'False';  // Production mode
    
    djangoProcess = spawn(pythonExe, [managePy, 'runserver', '127.0.0.1:8000'], {
      cwd: backendPath,
      detached: false,
      stdio: ['ignore', 'ignore', 'ignore'],  // Suppress output in production
    });

    djangoProcess.on('error', (err) => {
      console.error('Failed to start Django:', err);
    });

    // Give Django time to start
    await new Promise(r => setTimeout(r, 2000));
  } else {
    // Development: Django runs separately (user starts it manually)
    console.log('Development mode: assuming Django is running on localhost:8000');
  }
}

// 👇 DESKTOP PRODUCTION: Stop Django server on app quit
function stopDjangoServer() {
  if (djangoProcess) {
    try {
      if (process.platform === 'win32') {
        require('child_process').exec(`taskkill /PID ${djangoProcess.pid} /T /F`);
      } else {
        process.kill(-djangoProcess.pid);
      }
    } catch (e) {
      console.error('Error stopping Django:', e);
    }
  }
}

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../frontend/public/icon.png"),
  });

  // 👇 DESKTOP PRODUCTION: Load from Django backend (unified)
  if (!app.isPackaged) {
    // Development: Vite dev server OR Django (user choice)
    // Prefer Vite for faster dev iteration
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from Django (backend serves React build)
    mainWindow.loadURL("http://localhost:8000");
  }

  // React Router support (production): prevent external navigation
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (app.isPackaged && !url.startsWith("http://localhost:8000")) {
      event.preventDefault();
    }
  });

  // Prevent new windows / external popups by default
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC: handle print requests from renderer (safe channel)
ipcMain.handle("print", async (event, options = {}) => {
  try {
    const wc = event.sender;

    // Allow a short delay for DOM to render fully before printing
    await new Promise((r) => setTimeout(r, options.delay || 200));

    return new Promise((resolve) => {
      wc.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
          if (!success) console.error("Print failed:", failureReason);
          resolve({ success, failureReason });
        },
      );
    });
  } catch (err) {
    console.error("Print handler error:", err);
    return { success: false, failureReason: err.message };
  }
});

// App lifecycle
app.whenReady().then(async () => {
  // 👇 DESKTOP PRODUCTION: Start Django backend before UI
  await startDjangoServer();
  createWindow();
  createMenu();
});

app.on("window-all-closed", () => {
  // 👇 DESKTOP PRODUCTION: Clean up Django on exit
  stopDjangoServer();
  // On Windows & Linux quit fully when all windows closed
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 👇 DESKTOP PRODUCTION: Graceful shutdown
app.on('before-quit', () => {
  stopDjangoServer();
});

// App menu
function createMenu() {
  // In production keep menu minimal so app feels native. Devs still get tools in dev mode
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
  ];

  // In dev allow View menu for reload/devtools
  if (!app.isPackaged) {
    template.push({
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Safety
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
