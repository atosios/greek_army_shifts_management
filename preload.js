const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Data persistence
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  saveDataAs: (data) => ipcRenderer.invoke('save-data-as', data),
  selectDataFile: () => ipcRenderer.invoke('select-data-file'),
  backupData: () => ipcRenderer.invoke('backup-data'),
  getDataFilePath: () => ipcRenderer.invoke('get-data-file-path'),

  // Export & Filesystem
  saveExcelFile: (buffer, defaultFilename) => ipcRenderer.invoke('save-excel-file', buffer, defaultFilename),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),

  // Printing & Window
  printWindow: () => ipcRenderer.invoke('print-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // Platform info
  getAppInfo: () => ipcRenderer.invoke('get-app-info')
});
