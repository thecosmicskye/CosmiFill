import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, ChildProcess } from 'node:child_process';
import os from 'node:os';
import { logger, logSecurityEvent, logError } from '../../utils/logger';

export interface SandboxConfig {
  sessionId: string;
  workDir: string;
  allowedPaths: string[];
  timeout: number;
}

export class SecureSandbox {
  private config: SandboxConfig;
  private processes: Map<string, ChildProcess> = new Map();
  
  constructor(config: SandboxConfig) {
    this.config = config;
  }
  
  get workDir(): string {
    return this.config.workDir;
  }
  
  async validatePath(requestedPath: string): Promise<boolean> {
    const resolved = path.resolve(this.config.workDir, requestedPath);
    
    // Check if path is within allowed directories
    for (const allowedPath of this.config.allowedPaths) {
      if (resolved.startsWith(allowedPath)) {
        return true;
      }
    }
    
    return false;
  }
  
  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.config.workDir, filePath);
    
    if (!await this.validatePath(fullPath)) {
      logSecurityEvent('file_access_denied', {
        sessionId: this.config.sessionId,
        path: filePath,
        operation: 'read',
      });
      throw new Error(`Access denied: ${filePath} is outside sandbox`);
    }
    
    logger.debug('File read allowed', { sessionId: this.config.sessionId, path: filePath });
    return await fs.readFile(fullPath, 'utf-8');
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.config.workDir, filePath);
    
    if (!await this.validatePath(fullPath)) {
      throw new Error(`Access denied: ${filePath} is outside sandbox`);
    }
    
    // Additional validation for file types
    const ext = path.extname(filePath).toLowerCase();
    const allowedExtensions = ['.pdf', '.json', '.txt', '.py', '.log'];
    
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`File type not allowed: ${ext}`);
    }
    
    await fs.writeFile(fullPath, content);
  }
  
  async executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    // Whitelist of allowed commands
    const allowedCommands = ['ls', 'pwd', 'echo', 'python', 'python3'];
    
    if (!allowedCommands.includes(command)) {
      logSecurityEvent('command_blocked', {
        sessionId: this.config.sessionId,
        command,
        args,
      });
      throw new Error(`Command not allowed: ${command}`);
    }
    
    logger.debug('Command execution allowed', {
      sessionId: this.config.sessionId,
      command,
      args,
    });
    
    return new Promise((resolve, reject) => {
      const processId = `${Date.now()}-${Math.random()}`;
      
      // Set up restricted environment
      const env = {
        HOME: this.config.workDir,
        PATH: '/usr/bin:/bin',
        PYTHONPATH: path.join(this.config.workDir, 'modules'),
        // Minimal environment variables
      };
      
      const child = spawn(command, args, {
        cwd: this.config.workDir,
        env,
        timeout: this.config.timeout,
      });
      
      this.processes.set(processId, child);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        this.processes.delete(processId);
        reject(error);
      });
      
      child.on('close', (code) => {
        this.processes.delete(processId);
        
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      // Kill process after timeout
      setTimeout(() => {
        if (this.processes.has(processId)) {
          child.kill();
          this.processes.delete(processId);
          reject(new Error('Command timed out'));
        }
      }, this.config.timeout);
    });
  }
  
  async cleanup(): Promise<void> {
    // Kill all running processes
    for (const [id, process] of this.processes) {
      process.kill();
      this.processes.delete(id);
    }
    
    // Remove sandbox directory
    try {
      await fs.rm(this.config.workDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup sandbox:', error);
    }
  }
  
  async copyFiles(files: Array<{ source: string; destination: string }>): Promise<void> {
    for (const { source, destination } of files) {
      const destPath = path.join(this.config.workDir, destination);
      
      if (!await this.validatePath(destPath)) {
        throw new Error(`Cannot copy to ${destination}: outside sandbox`);
      }
      
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Copy file
      await fs.copyFile(source, destPath);
    }
  }
}

export class SandboxManager {
  private sandboxes: Map<string, SecureSandbox> = new Map();
  
  async createSandbox(sessionId: string): Promise<SecureSandbox> {
    const workDir = path.join(os.tmpdir(), `cosmifill_${sessionId}`);
    
    // Create sandbox directory
    await fs.mkdir(workDir, { recursive: true });
    
    const config: SandboxConfig = {
      sessionId,
      workDir,
      allowedPaths: [workDir],
      timeout: 30000, // 30 seconds
    };
    
    const sandbox = new SecureSandbox(config);
    this.sandboxes.set(sessionId, sandbox);
    
    return sandbox;
  }
  
  getSandbox(sessionId: string): SecureSandbox | undefined {
    return this.sandboxes.get(sessionId);
  }
  
  async destroySandbox(sessionId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sessionId);
    if (sandbox) {
      await sandbox.cleanup();
      this.sandboxes.delete(sessionId);
    }
  }
  
  async destroyAllSandboxes(): Promise<void> {
    for (const [sessionId, sandbox] of this.sandboxes) {
      await sandbox.cleanup();
    }
    this.sandboxes.clear();
  }
}