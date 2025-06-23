import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { NodeInstaller } from './node-installer';

const execAsync = promisify(exec);

export class ClaudeInstaller {
  private nodeInstaller: NodeInstaller;
  
  constructor() {
    this.nodeInstaller = new NodeInstaller();
  }
  
  async checkInstalled(): Promise<boolean> {
    try {
      // On macOS, check common paths
      if (process.platform === 'darwin') {
        const paths = [
          '/opt/homebrew/bin/claude',
          '/usr/local/bin/claude',
          'claude'
        ];
        
        for (const claudePath of paths) {
          try {
            await execAsync(`${claudePath} --version`);
            return true;
          } catch {
            // Try next path
          }
        }
        
        // Also check npm global bin
        try {
          const { stdout } = await execAsync('/opt/homebrew/bin/npm bin -g');
          const globalBin = stdout.trim();
          await execAsync(`${globalBin}/claude --version`);
          return true;
        } catch {
          // Continue to fallback
        }
        
        return false;
      }
      
      // For other platforms
      await execAsync('claude --version');
      return true;
    } catch {
      return false;
    }
  }
  
  async install(): Promise<void> {
    // First ensure Node.js is installed
    const hasNode = await this.nodeInstaller.checkInstalled();
    if (!hasNode) {
      throw new Error('Node.js must be installed first');
    }
    
    // Install Claude Code globally
    console.log('Installing Claude Code...');
    
    try {
      // On macOS, use the correct npm path
      let npmCommand = 'npm';
      if (process.platform === 'darwin') {
        // Try to find npm in common locations
        try {
          await execAsync('/opt/homebrew/bin/npm --version');
          npmCommand = '/opt/homebrew/bin/npm';
        } catch {
          try {
            await execAsync('/usr/local/bin/npm --version');
            npmCommand = '/usr/local/bin/npm';
          } catch {
            // Fallback to standard npm
          }
        }
      }
      
      // Install without sudo
      const { stdout, stderr } = await execAsync(`${npmCommand} install -g @anthropic-ai/claude-code`, {
        env: {
          ...process.env,
          // Ensure npm doesn't use sudo
          npm_config_unsafe_perm: 'true',
        },
      });
      
      console.log('Claude Code installation output:', stdout);
      if (stderr) {
        console.warn('Claude Code installation warnings:', stderr);
      }
      
      // Verify installation
      const installed = await this.checkInstalled();
      if (!installed) {
        throw new Error('Claude Code installation verification failed');
      }
      
      console.log('Claude Code installed successfully');
    } catch (error) {
      console.error('Failed to install Claude Code:', error);
      
      // Try alternative installation methods
      if (process.platform === 'darwin' || process.platform === 'linux') {
        // Try with different npm prefix
        const prefix = process.platform === 'darwin' 
          ? '/usr/local' 
          : `${process.env.HOME}/.npm-global`;
          
        try {
          await execAsync(`npm config set prefix ${prefix}`);
          await execAsync('npm install -g @anthropic-ai/claude-code');
          
          // Update PATH
          const binPath = `${prefix}/bin`;
          if (!process.env.PATH?.includes(binPath)) {
            process.env.PATH = `${binPath}:${process.env.PATH}`;
          }
        } catch (prefixError) {
          throw new Error(`Failed to install Claude Code: ${error}. Also tried with prefix: ${prefixError}`);
        }
      } else {
        throw error;
      }
    }
  }
  
  async checkNodeVersion(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      const majorVersion = parseInt(version.split('.')[0].substring(1));
      return majorVersion >= 18;
    } catch {
      return false;
    }
  }
}