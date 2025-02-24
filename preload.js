const { contextBridge, ipcRenderer } = require('electron');
const { shell } = require('electron');

// Add a console log to confirm the preload script is running
console.log('Preload script is running');

// Expose any required APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
    sendLog: (level, data) => {
        ipcRenderer.send('log', level, data);
    },
    openFile: async (filePath) => {
        try {
            await shell.openPath(filePath);
            console.log('File opened successfully:', filePath);
        } catch (error) {
            console.error('Error opening file:', error);
            throw error;
        }
    },
    showDirectoryPicker: () => ipcRenderer.invoke('show-directory-picker')
});

// Log that the API has been exposed
console.log('Electron API exposed to renderer'); 