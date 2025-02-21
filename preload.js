const { contextBridge, ipcRenderer } = require('electron');

// Expose any required APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
    sendLog: (level, data) => {
        ipcRenderer.send('log', level, data);
    }
}); 