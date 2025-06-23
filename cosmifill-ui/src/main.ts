import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'node:path';
import { spawn, exec } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import started from 'electron-squirrel-startup';
import { logger, logSecurityEvent, logUserAction, logError } from './utils/logger';

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Process the Vite environment - these get injected by Vite at build time
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const VITE_NAME = 'main_window';

// Import installers
import { NodeInstaller } from './main/installer/node-installer';
import { ClaudeInstaller } from './main/installer/claude-installer';
import { WSLInstaller } from './main/installer/wsl-installer';

// Import security and Claude modules
import { SandboxManager } from './main/security/sandbox';
import { setupSecureTools } from './main/security/secure-tools';
import { ClaudeLauncher } from './main/claude/claude-launcher';

// Import PDF processing
import { PDFHandler } from './main/pdf/pdf-handler';

// Import auto-updater
import { AutoUpdater } from './main/updater';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#f8fafc',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    logger.info('Window ready to show');
    mainWindow?.show();
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logError(new Error(`Failed to load: ${errorDescription}`), { errorCode });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Window loaded successfully');
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
          "style-src 'self' 'unsafe-inline';",
          "img-src 'self' data: blob:;",
          "font-src 'self' data:;",
          "connect-src 'self';",
          "media-src 'self';",
          "object-src 'none';",
          "base-uri 'self';",
          "form-action 'self';",
          "frame-ancestors 'none';",
          "upgrade-insecure-requests;"
        ].join(' ')
      }
    });
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('Loading from Vite dev server:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else if (VITE_DEV_SERVER_URL) {
    console.log('Loading from env Vite dev server:', VITE_DEV_SERVER_URL);
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else if (process.env.NODE_ENV === 'development') {
    console.log('Loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    console.log('Loading production build');
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME || VITE_NAME}/index.html`));
  }

  // DevTools should only be opened manually by the user
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  setupSecureTools(sandboxManager);
  pdfHandler.setupIPCHandlers();
  
  // Set up auto-updater
  if (mainWindow) {
    autoUpdater.setMainWindow(mainWindow);
    autoUpdater.checkForUpdates();
  }
  
  // Create application menu
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Session', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('new-session') },
        { type: 'separator' },
        { label: 'Open Files...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('open-files') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About CosmiFill',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About CosmiFill',
              message: 'CosmiFill',
              detail: 'Intelligent PDF Form Filling with Claude Code\n\nVersion 1.0.0\n\nSecurely fill PDF forms using AI assistance.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Learn More',
          click: () => shell.openExternal('https://github.com/anthropics/claude-code')
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => autoUpdater.checkForUpdatesManual()
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  mainWindow = null;
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Platform detection
function getPlatform(): 'darwin' | 'linux' | 'win32' {
  return process.platform as 'darwin' | 'linux' | 'win32';
}

// Check if command exists
async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // For macOS, check common installation paths directly
    if (process.platform === 'darwin' && (command === 'node' || command === 'npm')) {
      logger.info('Checking for Node in common macOS paths', { command });
      const commonPaths = [
        '/opt/homebrew/bin/node',  // Homebrew on Apple Silicon
        '/usr/local/bin/node',      // Homebrew on Intel or standard install
        '/usr/bin/node',            // System install
        '~/.nvm/versions/node/*/bin/node', // NVM
      ];
      
      // Try to execute node directly with version check
      exec(`/opt/homebrew/bin/node --version`, (error1, stdout1) => {
        if (!error1) {
          logger.info('Found Node at /opt/homebrew/bin/node', { version: stdout1?.trim() });
          resolve(true);
          return;
        }
        logger.debug('Node not found at /opt/homebrew/bin/node', { error: error1?.message });
        
        exec(`/usr/local/bin/node --version`, (error2, stdout2) => {
          if (!error2) {
            logger.info('Found Node at /usr/local/bin/node', { version: stdout2?.trim() });
            resolve(true);
            return;
          }
          logger.debug('Node not found at /usr/local/bin/node', { error: error2?.message });
          
          // Fallback to which command
          exec(`which ${command}`, (error3, stdout3) => {
            if (!error3) {
              logger.info('Found Node via which', { path: stdout3?.trim() });
            } else {
              logger.warn('Node not found via which', { error: error3?.message });
            }
            resolve(!error3);
          });
        });
      });
      return;
    }
    
    // For other platforms or commands, use standard which/where
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    exec(`${cmd} ${command}`, (error) => {
      resolve(!error);
    });
  });
}

// IPC Handlers
ipcMain.handle('platform:get', () => {
  return getPlatform();
});

ipcMain.handle('node:check', async () => {
  logger.info('Checking for Node.js installation');
  const result = await commandExists('node');
  logger.info('Node.js check result', { found: result });
  return result;
});

ipcMain.handle('claude:check', async () => {
  logger.info('Checking for Claude installation');
  
  // For Claude, also check common installation paths on macOS
  if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      // Set PATH to include node location for Claude execution
      const env = {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
      };
      
      exec(`/opt/homebrew/bin/claude --version`, { env }, (error1, stdout1) => {
        if (!error1) {
          logger.info('Found Claude at /opt/homebrew/bin/claude', { version: stdout1?.trim() });
          resolve(true);
          return;
        }
        logger.debug('Claude not found at /opt/homebrew/bin/claude', { error: error1?.message });
        
        exec(`/usr/local/bin/claude --version`, { env }, (error2, stdout2) => {
          if (!error2) {
            logger.info('Found Claude at /usr/local/bin/claude', { version: stdout2?.trim() });
            resolve(true);
            return;
          }
          logger.debug('Claude not found at /usr/local/bin/claude', { error: error2?.message });
          
          // Check global npm bin paths
          exec(`/opt/homebrew/bin/npm bin -g`, { env }, (error3, stdout) => {
            if (!error3) {
              const globalBin = stdout.trim();
              logger.debug('Checking npm global bin', { path: globalBin });
              exec(`${globalBin}/claude --version`, { env }, (error4, stdout4) => {
                if (!error4) {
                  logger.info('Found Claude in npm global bin', { path: globalBin, version: stdout4?.trim() });
                } else {
                  logger.debug('Claude not found in npm global bin', { error: error4?.message });
                }
                resolve(!error4);
              });
            } else {
              logger.debug('npm bin -g failed', { error: error3?.message });
              // Final fallback
              exec(`which claude`, { env }, (error5, stdout5) => {
                if (!error5) {
                  logger.info('Found Claude via which', { path: stdout5?.trim() });
                } else {
                  logger.warn('Claude not found via which', { error: error5?.message });
                }
                resolve(!error5);
              });
            }
          });
        });
      });
    });
  }
  
  const result = await commandExists('claude');
  logger.info('Claude check result', { found: result });
  return result;
});

ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'txt', 'csv', 'json'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Text Files', extensions: ['txt', 'csv', 'json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

// Create secure sandbox for session
ipcMain.handle('sandbox:create', async () => {
  const sessionId = `cosmifill_${Date.now()}`;
  
  logSecurityEvent('sandbox_created', { sessionId });
  logger.info('Creating sandbox', { sessionId });
  
  const sandbox = await sandboxManager.createSandbox(sessionId);
  return { sessionId, path: sandbox.workDir };
});

// Launch Claude with sandbox
ipcMain.handle('claude:launch', async (event, config) => {
  const sandbox = sandboxManager.getSandbox(config.sessionId);
  if (!sandbox) {
    throw new Error('Invalid session ID');
  }
  
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  if (!mainWindow) {
    throw new Error('Could not find main window');
  }
  
  claudeLauncher = new ClaudeLauncher(mainWindow);
  await claudeLauncher.launch(config, sandbox);
});

// Process PDFs
ipcMain.handle('pdf:process', async (event, config) => {
  const sandbox = sandboxManager.getSandbox(config.sessionId);
  if (!sandbox) {
    throw new Error('Invalid session ID');
  }
  
  logUserAction('process_pdfs_requested', { sessionId: config.sessionId });
  return await pdfHandler.processFiles(config, sandbox);
});

// Clean up on app quit
app.on('before-quit', async () => {
  await sandboxManager.destroyAllSandboxes();
  if (claudeLauncher) {
    await claudeLauncher.stop();
  }
});

const nodeInstaller = new NodeInstaller();
const claudeInstaller = new ClaudeInstaller();
const wslInstaller = new WSLInstaller();
const sandboxManager = new SandboxManager();
const pdfHandler = new PDFHandler();
const autoUpdater = new AutoUpdater();

let claudeLauncher: ClaudeLauncher | null = null;

// Installation handlers
ipcMain.handle('deps:installNode', async () => {
  try {
    // Check WSL first on Windows
    if (process.platform === 'win32') {
      const hasWSL = await wslInstaller.checkWSL();
      if (!hasWSL) {
        await wslInstaller.installWSL();
      }
      await wslInstaller.setupNodeInWSL();
    } else {
      await nodeInstaller.install();
    }
  } catch (error) {
    console.error('Node installation error:', error);
    throw error;
  }
});

ipcMain.handle('deps:installClaude', async () => {
  try {
    if (process.platform === 'win32') {
      await wslInstaller.installClaudeInWSL();
    } else {
      await claudeInstaller.install();
    }
  } catch (error) {
    console.error('Claude installation error:', error);
    throw error;
  }
});
