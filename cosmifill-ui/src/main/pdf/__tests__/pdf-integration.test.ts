import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { PDFAnalyzer } from '../pdf-analyzer';
import { DataExtractor } from '../data-extractor';
import { PDFFiller } from '../pdf-filler';
import { PDFHandler } from '../pdf-handler';
import { SecureSandbox } from '../../security/sandbox';

describe('PDF Processing Integration', () => {
  let tempDir: string;
  let sandbox: SecureSandbox;
  
  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cosmifill-test-'));
    
    // Create sandbox
    sandbox = new SecureSandbox({
      sessionId: 'test-session',
      workDir: tempDir,
      allowedPaths: [tempDir],
      timeout: 30000,
    });
  });
  
  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  
  describe('End-to-end PDF workflow', () => {
    it('should analyze, extract, and fill a PDF form', async () => {
      // Create a mock PDF with form fields (base64 encoded simple PDF)
      const mockPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihUZXN0IFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgo';
      const mockPdfBuffer = Buffer.from(mockPdfBase64, 'base64');
      
      const pdfPath = path.join(tempDir, 'test-form.pdf');
      await fs.writeFile(pdfPath, mockPdfBuffer);
      
      // Create mock data file
      const dataPath = path.join(tempDir, 'data.json');
      const mockData = {
        name: 'John Doe',
        email: 'john@example.com',
        date: '2025-06-23',
      };
      await fs.writeFile(dataPath, JSON.stringify(mockData, null, 2));
      
      // Test PDF analysis
      const analyzer = new PDFAnalyzer();
      const analysis = await analyzer.analyze(pdfPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.path).toBe(pdfPath);
      expect(analysis.pageCount).toBeGreaterThan(0);
      
      // Test data extraction
      const extractor = new DataExtractor();
      const extractedData = await extractor.extractFromFile(dataPath);
      
      expect(extractedData).toBeDefined();
      expect(extractedData.data).toEqual(mockData);
      
      // Test PDF filling (will create a new PDF)
      const filler = new PDFFiller();
      const outputPath = await filler.fillPDF(pdfPath, mockData, {
        outputDir: tempDir,
        addTimestamp: true,
      });
      
      expect(outputPath).toBeDefined();
      expect(await fs.access(outputPath).then(() => true).catch(() => false)).toBe(true);
      
      // Test PDFHandler orchestration
      const handler = new PDFHandler();
      const processingResult = await handler.processFiles({
        sessionId: 'test-session',
        dataFiles: [dataPath],
        formFiles: [pdfPath],
      }, sandbox);
      
      expect(processingResult).toBeDefined();
      expect(processingResult.filled).toHaveLength(1);
      expect(processingResult.errors).toHaveLength(0);
    });
    
    it('should handle multiple data files for batch processing', async () => {
      // Create multiple data entries
      const dataPath = path.join(tempDir, 'batch-data.json');
      const batchData = [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Charlie', email: 'charlie@example.com' },
      ];
      await fs.writeFile(dataPath, JSON.stringify(batchData, null, 2));
      
      // Extract data
      const extractor = new DataExtractor();
      const extracted = await extractor.extractFromFile(dataPath);
      
      expect(extracted.data).toEqual(batchData);
      expect(Array.isArray(extracted.data)).toBe(true);
      expect(extracted.data).toHaveLength(3);
    });
    
    it('should handle errors gracefully', async () => {
      const analyzer = new PDFAnalyzer();
      
      // Test with non-existent file
      await expect(analyzer.analyze('/non/existent/file.pdf')).rejects.toThrow();
      
      // Test with invalid PDF
      const invalidPdfPath = path.join(tempDir, 'invalid.pdf');
      await fs.writeFile(invalidPdfPath, 'Not a valid PDF content');
      
      await expect(analyzer.analyze(invalidPdfPath)).rejects.toThrow();
    });
  });
  
  describe('Security sandbox integration', () => {
    it('should respect sandbox boundaries', async () => {
      // Try to access file outside sandbox
      const outsidePath = '/etc/passwd';
      
      await expect(sandbox.readFile(outsidePath)).rejects.toThrow(/outside sandbox/);
    });
    
    it('should only allow whitelisted file types for writing', async () => {
      // Try to write an executable file
      await expect(sandbox.writeFile('test.exe', 'content')).rejects.toThrow(/not allowed/);
      
      // Should allow PDF files
      await expect(sandbox.writeFile('test.pdf', 'content')).resolves.not.toThrow();
    });
  });
});