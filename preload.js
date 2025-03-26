const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Model management
  checkModel: () => ipcRenderer.invoke('check-model'),
  downloadModel: () => ipcRenderer.invoke('download-model'),
  initModel: () => ipcRenderer.invoke('init-model'),
  selectLocalModel: () => ipcRenderer.invoke('select-local-model'),
  
  // Chat functionality
  sendMessage: (message, history) => ipcRenderer.invoke('chat-message', { message, history }),
  
  // Event listeners
  onModelStatus: (callback) => {
    ipcRenderer.on('model-status', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('model-status');
    };
  },
  
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_, progress) => callback(progress));
    return () => {
      ipcRenderer.removeAllListeners('download-progress');
    };
  },

  // Streaming functionality
  onStreamingToken: (callback) => {
    ipcRenderer.on('streaming-token', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('streaming-token');
    };
  }
}); 