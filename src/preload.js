const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
	stage: () => ipcRenderer.invoke("stage"),
	queue: () => ipcRenderer.invoke("queue"),
	distributedMode: () => ipcRenderer.invoke("distributedMode"),
	benchmark: () => ipcRenderer.invoke("benchmark"),
	onStats: (cb) => ipcRenderer.on("stats", (_, value) => cb(value)),
	onSavings: (cb) => ipcRenderer.on("savings", (_, value) => cb(value)),
	onQueue: (cb) => ipcRenderer.on("queue", (_, value) => cb(value)),
	onTerminal: (cb) => ipcRenderer.on("terminal", (_, value) => cb(value)),
	onResetUpload: (cb) => ipcRenderer.on("resetUpload", cb)
});
