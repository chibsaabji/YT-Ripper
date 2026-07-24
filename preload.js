const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),
  downloadVideo: (options) => ipcRenderer.send('download-video', options),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (event, code) => callback(code));
  },
  // We need to allow unregistering the listener so we don't get duplicates if they download multiple times
  removeListeners: () => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-complete');
  },
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
