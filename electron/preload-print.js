// preload-print.js
// Minimal preload for the invoice print popup window
// No IPC needed - popup only displays HTML content

const { contextBridge } = require("electron");

// Expose nothing - print window is isolated HTML only
contextBridge.exposeInMainWorld("electronAPI", {});
