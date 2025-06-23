import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app } from 'electron';

const execAsync = promisify(exec);

export class NodeInstaller {
  private platform: NodeJS.Platform;
  
  constructor() {
    this.platform = process.platform;
  }
  
  async checkInstalled(): Promise<boolean> {
    try {
      // On macOS, try common paths first
      if (this.platform === 'darwin') {
        const paths = [
          '/opt/homebrew/bin/node',
          '/usr/local/bin/node',
          'node'
        ];
        
        for (const nodePath of paths) {
          try {
            const { stdout } = await execAsync(`${nodePath} --version`);
            const version = stdout.trim();
            console.log(`Node.js version found at ${nodePath}: ${version}`);
            
            // Check if version is 18 or higher
            const majorVersion = parseInt(version.split('.')[0].substring(1));
            if (majorVersion >= 18) {
              return true;
            }
          } catch {
            // Try next path
          }
        }
        return false;
      }
      
      // For other platforms, use standard check
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      console.log(`Node.js version found: ${version}`);
      
      // Check if version is 18 or higher
      const majorVersion = parseInt(version.split('.')[0].substring(1));
      return majorVersion >= 18;
    } catch {
      return false;
    }
  }
  
  async install(): Promise<void> {
    switch (this.platform) {
      case 'darwin':
        await this.installMacOS();
        break;
      case 'linux':
        await this.installLinux();
        break;
      case 'win32':
        await this.installWindows();
        break;
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }
  
  private async installMacOS(): Promise<void> {
    // Check if Homebrew is installed
    try {
      await execAsync('which brew');
      // Install Node via Homebrew
      await execAsync('brew install node@20');
    } catch {
      // Download and install Node directly
      const nodeUrl = 'https://nodejs.org/dist/v20.11.0/node-v20.11.0.pkg';
      const installerPath = path.join(app.getPath('temp'), 'node-installer.pkg');
      
      await this.downloadFile(nodeUrl, installerPath);
      await execAsync(`open ${installerPath}`);
      
      // Wait for user to complete installation
      throw new Error('Please complete the Node.js installation and restart the app');
    }
  }
  
  private async installLinux(): Promise<void> {
    // Try to detect package manager
    const hasApt = await this.commandExists('apt-get');
    const hasYum = await this.commandExists('yum');
    const hasDnf = await this.commandExists('dnf');
    
    if (hasApt) {
      // Ubuntu/Debian
      await execAsync('curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -');
      await execAsync('sudo apt-get install -y nodejs');
    } else if (hasDnf || hasYum) {
      // Fedora/RHEL
      await execAsync('curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -');
      await execAsync('sudo dnf install -y nodejs || sudo yum install -y nodejs');
    } else {
      throw new Error('Unable to detect package manager. Please install Node.js manually.');
    }
  }
  
  private async installWindows(): Promise<void> {
    // For Windows, we'll use the MSI installer
    const nodeUrl = 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi';
    const installerPath = path.join(app.getPath('temp'), 'node-installer.msi');
    
    await this.downloadFile(nodeUrl, installerPath);
    
    // Run MSI installer silently
    await execAsync(`msiexec /i "${installerPath}" /quiet /norestart`);
    
    // Add Node to PATH
    const nodePath = 'C:\\Program Files\\nodejs';
    const currentPath = process.env.PATH || '';
    if (!currentPath.includes(nodePath)) {
      process.env.PATH = `${nodePath};${currentPath}`;
    }
  }
  
  private async commandExists(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }
  
  private downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          this.downloadFile(response.headers.location!, destination)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });
  }
}