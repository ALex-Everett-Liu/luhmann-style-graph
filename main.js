const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { logger, categoryLogger } = require('./utils/logger');
const appLogger = categoryLogger('app');

// Keep a global reference of the window object
let mainWindow;

// Import your Express app factory function
const createServer = require('./server');

// Create Express app with Electron app
let server;

function startServer() {
    const expressApp = createServer(app);
    server = expressApp.listen(3060, () => {
        appLogger.info('Express server started on port 3060');
    });
}

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load the app
    mainWindow.loadURL('http://localhost:3060');

    // Open the DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    appLogger.info('Electron app ready');
    startServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Graceful shutdown
app.on('before-quit', (event) => {
    appLogger.info('Application shutting down');
    if (server) {
        server.close(() => {
            appLogger.info('Express server closed');
        });
    }
});

// Add IPC handler for logs
ipcMain.on('log', (event, level, data) => {
    switch (level) {
        case 'error':
            appLogger.error(data.message, data);
            break;
        case 'warn':
            appLogger.warn(data.message, data);
            break;
        case 'info':
            appLogger.info(data.message, data);
            break;
        default:
            appLogger.info(data.message, data);
    }
}); 