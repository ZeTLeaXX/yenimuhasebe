const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true, // Security best practice
            webSecurity: false, // Allow cross-origin requests (Fixes Firebase Storage CORS)
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png') // If you have an icon
    });

    // Remove default menu bar
    win.setMenuBarVisibility(false);

    win.loadFile('index.html');

    // Optional: Open DevTools
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
