const { app, BrowserWindow, ipcMain, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_VERSION = '1.1.2';
const FIREBASE_DB_URL = 'https://muhasebe-86f40-default-rtdb.firebaseio.com/';

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png')
    });

    win.setMenuBarVisibility(false);
    win.loadFile('index.html');

    // Check for updates
    checkUpdate().then(config => {
        if (config) {
            createUpdateWindow(config);
        }
    });
}

async function checkUpdate() {
    try {
        const response = await fetch(`${FIREBASE_DB_URL}app_config.json`);
        if (response.ok) {
            const config = await response.json();
            if (config && config.latestVersion) {
                const remoteVer = config.latestVersion.replace('v', '').trim();
                const localVer = APP_VERSION.replace('v', '').trim();

                if (remoteVer !== localVer) {
                    return config;
                }
            }
        }
    } catch (e) {
        console.error("Update check failed:", e);
    }
    return null;
}

function createUpdateWindow(config) {
    const win = new BrowserWindow({
        width: 450,
        height: 400,
        resizable: false,
        title: 'Güncelleme Mevcut',
        icon: path.join(__dirname, 'icon.png'),
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('update.html');

    win.webContents.on('did-finish-load', () => {
        win.webContents.send('update-data', config);
    });
}

// Robust Download System (Using Electron net)
ipcMain.on('start-download', (event, downloadUrl) => {
    const tempPath = path.join(app.getPath('temp'), `muhasebe-update-${Date.now()}.exe`);
    let attempts = 0;
    const maxAttempts = 5;

    function attemptDownload(url) {
        attempts++;
        event.reply('download-log', `Bağlantı denemesi ${attempts}: ${url}`);

        const request = net.request({
            url: url,
            method: 'GET',
            redirect: 'follow'
        });

        request.on('response', (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400) {
                // Should be handled by 'follow', but just in case
                if (response.headers.location) {
                    return attemptDownload(response.headers.location);
                }
            }

            if (response.statusCode !== 200) {
                event.reply('download-log', `Hata: Sunucu ${response.statusCode} yanıtı verdi.`);
                if (attempts < maxAttempts) {
                    return setTimeout(() => attemptDownload(url), 2000);
                }
                return event.reply('download-error', `Sunucu Hatası: ${response.statusCode}`);
            }

            const contentLength = parseInt(response.headers['content-length'], 10);
            const totalBytes = isNaN(contentLength) ? 0 : contentLength;
            let downloadedBytes = 0;

            const file = fs.createWriteStream(tempPath);

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                file.write(chunk);
                if (totalBytes > 0) {
                    const percent = Math.round((downloadedBytes / totalBytes) * 100);
                    event.reply('download-progress', percent);
                } else {
                    event.reply('download-progress', -1);
                }
            });

            response.on('end', () => {
                file.end();
                event.reply('download-log', 'İndirme tamamlandı, dosya yazılıyor...');
            });

            file.on('finish', () => {
                event.reply('download-complete', tempPath);
            });

            file.on('error', (err) => {
                event.reply('download-error', 'Yazma Hatası: ' + err.message);
            });
        });

        request.on('error', (err) => {
            event.reply('download-log', `Hata: ${err.message}`);
            if (attempts < maxAttempts) {
                return setTimeout(() => attemptDownload(url), 2000);
            }
            event.reply('download-error', 'Bağlantı Hatası: ' + err.message);
        });

        request.end();
    }

    attemptDownload(downloadUrl);
});

ipcMain.handle('get-app-version', () => {
    return APP_VERSION;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
