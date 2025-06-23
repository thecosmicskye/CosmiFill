import { spawn, ChildProcess, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { BrowserWindow } from 'electron';
import { SecureSandbox } from '../security/sandbox';
import { WSLInstaller } from '../installer/wsl-installer';

export interface ClaudeConfig {
  sessionId: string;
  workDir: string;
  prompt: string;
  analysisData: any;
}

export class ClaudeLauncher {
  private process: ChildProcess | null = null;
  private mainWindow: BrowserWindow;
  private wslInstaller: WSLInstaller;
  
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.wslInstaller = new WSLInstaller();
  }
  
  async launch(config: ClaudeConfig, sandbox: SecureSandbox): Promise<void> {
    // Create Claude settings for restricted permissions
    await this.createClaudeSettings(config.workDir);
    
    // Create analysis file
    await this.createAnalysisFile(config.workDir, config.analysisData);
    
    // Create setup script
    await this.createSetupScript(config.workDir);
    
    // Launch Claude based on platform
    if (process.platform === 'win32') {
      await this.launchInWSL(config);
    } else {
      await this.launchNative(config);
    }
  }
  
  private async createClaudeSettings(workDir: string): Promise<void> {
    const claudeDir = path.join(workDir, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    
    const settings = {
      permissions: {
        allow: [],
        customTools: {
          SecureBash: 'ipc://secure-bash',
          SecureRead: 'ipc://secure-read', 
          SecureWrite: 'ipc://secure-write',
          SecureEdit: 'ipc://secure-edit',
        },
        additionalDirectories: [workDir],
      },
      env: {
        COSMIFILL_SESSION: 'true',
        WORKING_DIR: workDir,
      },
    };
    
    await fs.writeFile(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify(settings, null, 2)
    );
  }
  
  private async createAnalysisFile(workDir: string, analysisData: any): Promise<void> {
    const data = {
      ...analysisData,
      sessionInfo: {
        workDir,
        timestamp: new Date().toISOString(),
        platform: process.platform,
      },
    };
    
    await fs.writeFile(
      path.join(workDir, 'COSMIFILL_ANALYSIS.json'),
      JSON.stringify(data, null, 2)
    );
  }
  
  private async createSetupScript(workDir: string): Promise<void> {
    const script = `#!/usr/bin/env python3
import json
import sys

# Load analysis data
with open('COSMIFILL_ANALYSIS.json', 'r') as f:
    context = json.load(f)

print("CosmiFill session loaded!")
print(f"Working directory: {context['sessionInfo']['workDir']}")
print(f"PDF forms found: {len(context.get('formFiles', []))}")
print(f"Data files found: {len(context.get('dataFiles', []))}")

# Import mock modules that use secure tools
class SecurePDFAnalyzer:
    def analyze(self, pdf_path):
        # This would use secure tools instead of direct file access
        return {"mock": "analysis"}

class SecurePDFFiller:
    def fill_form(self, pdf_path, data):
        # This would use secure tools instead of direct file access
        return "filled_" + pdf_path

# Make modules available
PDFAnalyzer = SecurePDFAnalyzer
PDFFiller = SecurePDFFiller

print("\\nSecure modules loaded. Use PDFAnalyzer and PDFFiller to work with PDFs.")
`;

    await fs.writeFile(path.join(workDir, 'cosmifill_setup.py'), script);
    await fs.chmod(path.join(workDir, 'cosmifill_setup.py'), 0o755);
  }
  
  private async launchNative(config: ClaudeConfig): Promise<void> {
    // Find the correct claude path
    let claudePath = 'claude';
    if (process.platform === 'darwin') {
      // Try common paths
      try {
        execSync('/opt/homebrew/bin/claude --version');
        claudePath = '/opt/homebrew/bin/claude';
      } catch {
        try {
          execSync('/usr/local/bin/claude --version');
          claudePath = '/usr/local/bin/claude';
        } catch {
          // Use default
        }
      }
    }
    
    this.process = spawn(claudePath, [config.prompt], {
      cwd: config.workDir,
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
        COSMIFILL_SESSION: config.sessionId,
      },
    });
    
    this.setupProcessHandlers();
  }
  
  private async launchInWSL(config: ClaudeConfig): Promise<void> {
    const wslPath = this.wslInstaller.convertToWSLPath(config.workDir);
    
    this.process = spawn('wsl', ['-e', 'bash', '-c', `cd ${wslPath} && claude "${config.prompt}"`], {
      cwd: config.workDir,
    });
    
    this.setupProcessHandlers();
  }
  
  private setupProcessHandlers(): void {
    if (!this.process) return;
    
    this.process.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('Claude output:', output);
      
      // Send to renderer
      this.mainWindow.webContents.send('claude:output', output);
    });
    
    this.process.stderr?.on('data', (data) => {
      const error = data.toString();
      console.error('Claude error:', error);
      
      // Send to renderer
      this.mainWindow.webContents.send('claude:error', error);
    });
    
    this.process.on('close', (code) => {
      console.log(`Claude process exited with code ${code}`);
      this.mainWindow.webContents.send('claude:exit', code);
      this.process = null;
    });
  }
  
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}