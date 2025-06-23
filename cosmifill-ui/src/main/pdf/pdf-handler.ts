import { ipcMain } from 'electron';
import { PDFAnalyzer } from './pdf-analyzer';
import { PDFFiller } from './pdf-filler';
import { DataExtractor } from './data-extractor';
import { logger, logUserAction } from '../../utils/logger';
import { SecureSandbox } from '../security/sandbox';
import path from 'node:path';

export interface ProcessingConfig {
  sessionId: string;
  formFiles: string[];
  dataFiles: string[];
  outputDir?: string;
  options?: {
    highlightFields?: boolean;
    addTimestamp?: boolean;
    autoMap?: boolean;
  };
}

export interface ProcessingResult {
  success: boolean;
  filledPDFs: string[];
  errors: string[];
  analysis: any;
  extractedData: any;
  mappings: any;
}

export class PDFHandler {
  private analyzer: PDFAnalyzer;
  private filler: PDFFiller;
  private extractor: DataExtractor;
  
  constructor() {
    this.analyzer = new PDFAnalyzer();
    this.filler = new PDFFiller();
    this.extractor = new DataExtractor();
  }
  
  async processFiles(config: ProcessingConfig, sandbox: SecureSandbox): Promise<ProcessingResult> {
    logger.info('Processing PDF files', {
      sessionId: config.sessionId,
      formCount: config.formFiles.length,
      dataCount: config.dataFiles.length,
    });
    
    logUserAction('process_pdfs', {
      sessionId: config.sessionId,
      formCount: config.formFiles.length,
      dataCount: config.dataFiles.length,
    });
    
    const result: ProcessingResult = {
      success: false,
      filledPDFs: [],
      errors: [],
      analysis: {},
      extractedData: {},
      mappings: {},
    };
    
    try {
      // Copy files to sandbox
      const sandboxFormFiles: string[] = [];
      const sandboxDataFiles: string[] = [];
      
      for (const formFile of config.formFiles) {
        const destPath = path.join('forms', path.basename(formFile));
        await sandbox.copyFiles([{ source: formFile, destination: destPath }]);
        sandboxFormFiles.push(destPath);
      }
      
      for (const dataFile of config.dataFiles) {
        const destPath = path.join('data', path.basename(dataFile));
        await sandbox.copyFiles([{ source: dataFile, destination: destPath }]);
        sandboxDataFiles.push(destPath);
      }
      
      // Analyze PDFs
      logger.info('Analyzing PDF forms');
      const analysisResults = await this.analyzer.analyzeBatch(sandboxFormFiles);
      result.analysis = analysisResults;
      
      // Extract data
      logger.info('Extracting data from files');
      const extractedData = await this.extractor.extractBatch(sandboxDataFiles);
      result.extractedData = extractedData;
      
      // Process each form
      for (const analysis of analysisResults) {
        try {
          let fillData: Record<string, any> = {};
          
          if (config.options?.autoMap && analysis.formFields.length > 0) {
            // Intelligent field mapping
            fillData = await this.extractor.intelligentFieldMapping(
              analysis.formFields,
              extractedData
            );
            result.mappings[analysis.filename] = fillData;
          }
          
          // Fill the form
          const outputPath = await this.filler.fillForm(
            analysis.path,
            fillData,
            {
              outputDir: config.outputDir || path.join(sandbox.workDir, 'output'),
              highlightFields: config.options?.highlightFields,
              addTimestamp: config.options?.addTimestamp,
              prefix: 'filled',
            }
          );
          
          result.filledPDFs.push(outputPath);
        } catch (error) {
          const errorMsg = `Failed to process ${analysis.filename}: ${error}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
      
      result.success = result.filledPDFs.length > 0;
      
      logger.info('PDF processing complete', {
        sessionId: config.sessionId,
        filled: result.filledPDFs.length,
        errors: result.errors.length,
      });
      
      return result;
    } catch (error) {
      logger.error('PDF processing failed', { error, config });
      result.errors.push(`Processing failed: ${error}`);
      return result;
    }
  }
  
  setupIPCHandlers() {
    ipcMain.handle('pdf:analyze', async (event, filePaths: string[]) => {
      try {
        return await this.analyzer.analyzeBatch(filePaths);
      } catch (error) {
        logger.error('IPC pdf:analyze failed', { error });
        throw error;
      }
    });
    
    ipcMain.handle('pdf:extract', async (event, filePaths: string[]) => {
      try {
        return await this.extractor.extractBatch(filePaths);
      } catch (error) {
        logger.error('IPC pdf:extract failed', { error });
        throw error;
      }
    });
    
    ipcMain.handle('pdf:fill', async (event, pdfPath: string, data: any, options: any) => {
      try {
        return await this.filler.fillForm(pdfPath, data, options);
      } catch (error) {
        logger.error('IPC pdf:fill failed', { error });
        throw error;
      }
    });
  }
}