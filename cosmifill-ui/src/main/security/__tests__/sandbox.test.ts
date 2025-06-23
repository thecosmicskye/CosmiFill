import { SecureSandbox, SandboxManager } from '../sandbox';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

jest.mock('node:fs/promises');
jest.mock('node:child_process');

describe('SecureSandbox', () => {
  let sandbox: SecureSandbox;
  const mockWorkDir = '/tmp/test-sandbox';
  
  beforeEach(() => {
    sandbox = new SecureSandbox({
      sessionId: 'test-session',
      workDir: mockWorkDir,
      allowedPaths: [mockWorkDir],
      timeout: 5000,
    });
    
    (fs.readFile as jest.Mock).mockClear();
    (fs.writeFile as jest.Mock).mockClear();
  });

  describe('validatePath', () => {
    it('should allow paths within sandbox', async () => {
      const result = await sandbox.validatePath(path.join(mockWorkDir, 'test.txt'));
      expect(result).toBe(true);
    });

    it('should deny paths outside sandbox', async () => {
      const result = await sandbox.validatePath('/etc/passwd');
      expect(result).toBe(false);
    });

    it('should prevent directory traversal', async () => {
      const result = await sandbox.validatePath(path.join(mockWorkDir, '../../../etc/passwd'));
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read allowed files', async () => {
      const testContent = 'test content';
      (fs.readFile as jest.Mock).mockResolvedValue(testContent);
      
      const result = await sandbox.readFile('test.txt');
      
      expect(result).toBe(testContent);
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockWorkDir, 'test.txt'),
        'utf-8'
      );
    });

    it('should throw for files outside sandbox', async () => {
      await expect(sandbox.readFile('../../../etc/passwd'))
        .rejects.toThrow('Access denied');
    });
  });

  describe('writeFile', () => {
    it('should write allowed file types', async () => {
      await sandbox.writeFile('test.pdf', 'content');
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockWorkDir, 'test.pdf'),
        'content'
      );
    });

    it('should reject disallowed file types', async () => {
      await expect(sandbox.writeFile('test.exe', 'content'))
        .rejects.toThrow('File type not allowed: .exe');
    });

    it('should reject files outside sandbox', async () => {
      await expect(sandbox.writeFile('../../../tmp/test.pdf', 'content'))
        .rejects.toThrow('Access denied');
    });
  });

  describe('executeCommand', () => {
    it('should allow whitelisted commands', async () => {
      const execMock = require('node:child_process').spawn as jest.Mock;
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'close') handler(0);
        }),
        kill: jest.fn(),
      };
      execMock.mockReturnValue(mockProcess);
      
      await sandbox.executeCommand('python', ['test.py']);
      
      expect(execMock).toHaveBeenCalledWith('python', ['test.py'], expect.objectContaining({
        cwd: mockWorkDir,
        timeout: 5000,
      }));
    });

    it('should reject non-whitelisted commands', async () => {
      await expect(sandbox.executeCommand('rm', ['-rf', '/']))
        .rejects.toThrow('Command not allowed: rm');
    });
  });
});

describe('SandboxManager', () => {
  let manager: SandboxManager;
  
  beforeEach(() => {
    manager = new SandboxManager();
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
  });

  it('should create sandbox with unique session', async () => {
    const sessionId = 'test-session-123';
    const sandbox = await manager.createSandbox(sessionId);
    
    expect(sandbox).toBeDefined();
    expect(sandbox.workDir).toContain(sessionId);
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining(sessionId),
      { recursive: true }
    );
  });

  it('should retrieve existing sandbox', async () => {
    const sessionId = 'test-session-456';
    const sandbox1 = await manager.createSandbox(sessionId);
    const sandbox2 = manager.getSandbox(sessionId);
    
    expect(sandbox2).toBe(sandbox1);
  });

  it('should destroy sandbox and cleanup', async () => {
    const sessionId = 'test-session-789';
    await manager.createSandbox(sessionId);
    await manager.destroySandbox(sessionId);
    
    expect(manager.getSandbox(sessionId)).toBeUndefined();
    expect(fs.rm).toHaveBeenCalled();
  });
});