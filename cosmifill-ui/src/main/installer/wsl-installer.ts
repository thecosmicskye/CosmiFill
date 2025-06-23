import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class WSLInstaller {
  async checkWSL(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return true; // Not needed on non-Windows
    }
    
    try {
      await execAsync('wsl --list');
      return true;
    } catch {
      return false;
    }
  }
  
  async installWSL(): Promise<void> {
    if (process.platform !== 'win32') {
      return; // Not needed on non-Windows
    }
    
    console.log('Installing WSL...');
    
    try {
      // Enable WSL feature
      await execAsync('wsl --install -d Ubuntu', {
        shell: 'powershell.exe',
      });
      
      // Note: This requires a restart
      throw new Error('WSL installation complete. Please restart your computer and run CosmiFill again.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('restart')) {
        throw error;
      }
      throw new Error(`Failed to install WSL: ${error}`);
    }
  }
  
  async checkUbuntu(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return true;
    }
    
    try {
      const { stdout } = await execAsync('wsl --list');
      return stdout.toLowerCase().includes('ubuntu');
    } catch {
      return false;
    }
  }
  
  async setupNodeInWSL(): Promise<void> {
    if (process.platform !== 'win32') {
      return;
    }
    
    console.log('Setting up Node.js in WSL...');
    
    // Install Node.js in WSL
    const commands = [
      'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -',
      'sudo apt-get install -y nodejs',
    ];
    
    for (const cmd of commands) {
      await this.execInWSL(cmd);
    }
  }
  
  async installClaudeInWSL(): Promise<void> {
    if (process.platform !== 'win32') {
      return;
    }
    
    console.log('Installing Claude Code in WSL...');
    await this.execInWSL('npm install -g @anthropic-ai/claude-code');
  }
  
  async execInWSL(command: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(`wsl -e bash -c "${command}"`);
  }
  
  convertToWSLPath(windowsPath: string): string {
    // Convert C:\path\to\file to /mnt/c/path/to/file
    const drive = windowsPath[0].toLowerCase();
    const path = windowsPath.substring(2).replace(/\\/g, '/');
    return `/mnt/${drive}${path}`;
  }
}