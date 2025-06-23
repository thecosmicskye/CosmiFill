import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform detection
  getPlatform: () => ipcRenderer.invoke('platform:get'),
  
  // Dependency checks
  checkNode: () => ipcRenderer.invoke('node:check'),
  checkClaude: () => ipcRenderer.invoke('claude:check'),
  
  // File operations
  openFileDialog: () => ipcRenderer.invoke('dialog:openFiles'),
  
  // Sandbox operations
  createSandbox: () => ipcRenderer.invoke('sandbox:create'),
  
  // Claude operations (to be implemented)
  installNode: () => ipcRenderer.invoke('deps:installNode'),
  installClaude: () => ipcRenderer.invoke('deps:installClaude'),
  launchClaude: (config: any) => ipcRenderer.invoke('claude:launch', config),
  
  // Listen to events
  onClaudeOutput: (callback: (data: string) => void) => {
    ipcRenderer.on('claude:output', (_, data) => callback(data));
  },
  
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type declarations for TypeScript
export interface ElectronAPI {
  getPlatform: () => Promise<'darwin' | 'linux' | 'win32'>;
  checkNode: () => Promise<boolean>;
  checkClaude: () => Promise<boolean>;
  openFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  createSandbox: () => Promise<{ sessionId: string; path: string }>;
  installNode: () => Promise<void>;
  installClaude: () => Promise<void>;
  launchClaude: (config: any) => Promise<void>;
  onClaudeOutput: (callback: (data: string) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}