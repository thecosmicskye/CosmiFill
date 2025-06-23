import { ipcMain, BrowserWindow } from 'electron';
import { SecureSandbox } from './sandbox';

export interface ToolRequest {
  tool: string;
  args: any;
  sessionId: string;
}

export class SecureToolHandler {
  private sandbox: SecureSandbox;
  private mainWindow: BrowserWindow;
  
  constructor(sandbox: SecureSandbox, mainWindow: BrowserWindow) {
    this.sandbox = sandbox;
    this.mainWindow = mainWindow;
  }
  
  async handleBash(command: string, args: string[]): Promise<string> {
    try {
      const { stdout, stderr } = await this.sandbox.executeCommand(command, args);
      
      if (stderr) {
        console.warn('Command stderr:', stderr);
      }
      
      return stdout;
    } catch (error) {
      throw new Error(`Bash command failed: ${error}`);
    }
  }
  
  async handleRead(filePath: string): Promise<string> {
    try {
      return await this.sandbox.readFile(filePath);
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }
  
  async handleWrite(filePath: string, content: string): Promise<void> {
    try {
      await this.sandbox.writeFile(filePath, content);
    } catch (error) {
      throw new Error(`Failed to write file: ${error}`);
    }
  }
  
  async handleEdit(filePath: string, oldContent: string, newContent: string): Promise<void> {
    try {
      const currentContent = await this.sandbox.readFile(filePath);
      
      if (!currentContent.includes(oldContent)) {
        throw new Error('Old content not found in file');
      }
      
      const updatedContent = currentContent.replace(oldContent, newContent);
      await this.sandbox.writeFile(filePath, updatedContent);
    } catch (error) {
      throw new Error(`Failed to edit file: ${error}`);
    }
  }
}

export function setupSecureTools(sandboxManager: any) {
  // Handle secure tool requests from Claude
  ipcMain.handle('secure-tool', async (event, request: ToolRequest) => {
    const sandbox = sandboxManager.getSandbox(request.sessionId);
    if (!sandbox) {
      throw new Error('Invalid session');
    }
    
    const handler = new SecureToolHandler(sandbox, BrowserWindow.fromWebContents(event.sender)!);
    
    switch (request.tool) {
      case 'bash':
        return await handler.handleBash(request.args.command, request.args.args || []);
        
      case 'read':
        return await handler.handleRead(request.args.path);
        
      case 'write':
        return await handler.handleWrite(request.args.path, request.args.content);
        
      case 'edit':
        return await handler.handleEdit(
          request.args.path,
          request.args.oldContent,
          request.args.newContent
        );
        
      default:
        throw new Error(`Unknown tool: ${request.tool}`);
    }
  });
}