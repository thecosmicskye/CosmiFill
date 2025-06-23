import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import { logger, logUserAction } from '../utils/logger';

export class AutoUpdater {
  private mainWindow: BrowserWindow | null = null;
  
  constructor() {
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }
  
  private setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      logger.info('Checking for updates...');
    });
    
    autoUpdater.on('update-available', (info) => {
      logger.info('Update available', { version: info.version });
      logUserAction('update_available', { version: info.version });
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update:available', info);
        
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Update Available',
          message: `A new version (${info.version}) is available. Would you like to download it now?`,
          buttons: ['Download', 'Later'],
          defaultId: 0,
        }).then((result) => {
          if (result.response === 0) {
            autoUpdater.downloadUpdate();
          }
        });
      }
    });
    
    autoUpdater.on('update-not-available', () => {
      logger.info('No updates available');
    });
    
    autoUpdater.on('error', (error) => {
      logger.error('Update error', { error });
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update:error', error.message);
      }
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
      logger.info(logMessage, { progress: progressObj });
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update:progress', progressObj);
      }
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded', { version: info.version });
      logUserAction('update_downloaded', { version: info.version });
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update:downloaded', info);
        
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Update Ready',
          message: 'Update downloaded. The application will restart to apply the update.',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
        }).then((result) => {
          if (result.response === 0) {
            setImmediate(() => {
              app.removeAllListeners('window-all-closed');
              if (this.mainWindow) {
                this.mainWindow.close();
              }
              autoUpdater.quitAndInstall(false, true);
            });
          }
        });
      }
    });
  }
  
  async checkForUpdates() {
    try {
      if (app.isPackaged) {
        logger.info('Checking for updates (packaged app)');
        await autoUpdater.checkForUpdates();
      } else {
        logger.info('Skipping update check in development');
      }
    } catch (error) {
      logger.error('Failed to check for updates', { error });
    }
  }
  
  async checkForUpdatesManual() {
    try {
      logger.info('Manual update check requested');
      logUserAction('manual_update_check');
      
      const result = await autoUpdater.checkForUpdates();
      
      if (!result || !result.updateInfo || result.updateInfo.version === app.getVersion()) {
        if (this.mainWindow) {
          dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'No Updates',
            message: 'You are running the latest version.',
            buttons: ['OK'],
          });
        }
      }
    } catch (error) {
      logger.error('Manual update check failed', { error });
      
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'error',
          title: 'Update Check Failed',
          message: 'Unable to check for updates. Please check your internet connection.',
          buttons: ['OK'],
        });
      }
    }
  }
}