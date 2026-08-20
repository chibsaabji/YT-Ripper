const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  fetchInfo: (payload) => ipcRenderer.invoke('fetch-info', payload),
  downloadVideo: (options) => ipcRenderer.send('download-video', options),
  cancelDownload: () => ipcRenderer.send('cancel-download'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (event, code) => callback(code));
  },
  onDownloadCancelled: (callback) => {
    ipcRenderer.on('download-cancelled', (event) => callback());
  },
  removeListeners: () => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-complete');
    ipcRenderer.removeAllListeners('download-cancelled');
  },
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
