import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { logger, logUserAction } from '../../utils/logger';
import { FormField } from './pdf-analyzer';

export interface FillData {
  [fieldName: string]: string | boolean | string[];
}

export interface FillOptions {
  highlightFields?: boolean;
  addTimestamp?: boolean;
  outputDir?: string;
  prefix?: string;
}

export class PDFFiller {
  async fillForm(
    pdfPath: string,
    data: FillData,
    options: FillOptions = {}
  ): Promise<string> {
    try {
      logger.info('Filling PDF form', { pdfPath, fieldCount: Object.keys(data).length });
      logUserAction('fill_pdf', { pdfPath });
      
      // Read PDF
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const form = pdfDoc.getForm();
      
      // Fill fields
      let filledCount = 0;
      for (const [fieldName, value] of Object.entries(data)) {
        try {
          const field = form.getField(fieldName);
          
          if (field.constructor.name === 'PDFTextField') {
            const textField = field as any;
            textField.setText(String(value));
            
            if (options.highlightFields) {
              textField.updateAppearances();
            }
          } else if (field.constructor.name === 'PDFCheckBox') {
            const checkBox = field as any;
            if (value === true || value === 'true' || value === 'yes') {
              checkBox.check();
            } else {
              checkBox.uncheck();
            }
          } else if (field.constructor.name === 'PDFDropdown') {
            const dropdown = field as any;
            dropdown.select(String(value));
          } else if (field.constructor.name === 'PDFRadioGroup') {
            const radioGroup = field as any;
            radioGroup.select(String(value));
          } else if (field.constructor.name === 'PDFOptionList') {
            const optionList = field as any;
            if (Array.isArray(value)) {
              optionList.select(value.map(String));
            } else {
              optionList.select([String(value)]);
            }
          }
          
          filledCount++;
        } catch (error) {
          logger.warn('Failed to fill field', { fieldName, error });
        }
      }
      
      // Add timestamp if requested
      if (options.addTimestamp) {
        await this.addTimestamp(pdfDoc);
      }
      
      // Save filled PDF
      const outputPath = this.generateOutputPath(pdfPath, options);
      const filledPdfBytes = await pdfDoc.save();
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      await fs.writeFile(outputPath, filledPdfBytes);
      
      logger.info('PDF form filled successfully', {
        pdfPath,
        outputPath,
        filledCount,
        totalFields: Object.keys(data).length,
      });
      
      return outputPath;
    } catch (error) {
      logger.error('Failed to fill PDF form', { error, pdfPath });
      throw new Error(`Failed to fill PDF form: ${error}`);
    }
  }
  
  private generateOutputPath(originalPath: string, options: FillOptions): string {
    const dir = options.outputDir || path.dirname(originalPath);
    const basename = path.basename(originalPath, '.pdf');
    const prefix = options.prefix || 'filled';
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    
    return path.join(dir, `${prefix}_${basename}_${timestamp}.pdf`);
  }
  
  private async addTimestamp(pdfDoc: PDFDocument): Promise<void> {
    try {
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { height } = firstPage.getSize();
      
      const timestamp = `Filled on: ${new Date().toLocaleString()}`;
      
      firstPage.drawText(timestamp, {
        x: 10,
        y: height - 10,
        size: 8,
        color: rgb(0.5, 0.5, 0.5),
      });
    } catch (error) {
      logger.warn('Failed to add timestamp', { error });
    }
  }
  
  async fillBatch(
    pdfPaths: string[],
    dataArray: FillData[],
    options: FillOptions = {}
  ): Promise<string[]> {
    const results: string[] = [];
    
    for (let i = 0; i < pdfPaths.length; i++) {
      try {
        const pdfPath = pdfPaths[i];
        const data = dataArray[i] || {};
        
        const outputPath = await this.fillForm(pdfPath, data, options);
        results.push(outputPath);
      } catch (error) {
        logger.error('Failed to fill PDF in batch', { error, index: i });
        // Continue with other files
      }
    }
    
    return results;
  }
  
  async mergeFilledPDFs(pdfPaths: string[], outputPath: string): Promise<void> {
    try {
      logger.info('Merging filled PDFs', { count: pdfPaths.length });
      
      const mergedPdf = await PDFDocument.create();
      
      for (const pdfPath of pdfPaths) {
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdf = await PDFDocument.load(pdfBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        
        for (const page of pages) {
          mergedPdf.addPage(page);
        }
      }
      
      const mergedPdfBytes = await mergedPdf.save();
      await fs.writeFile(outputPath, mergedPdfBytes);
      
      logger.info('PDFs merged successfully', { outputPath, count: pdfPaths.length });
    } catch (error) {
      logger.error('Failed to merge PDFs', { error });
      throw new Error(`Failed to merge PDFs: ${error}`);
    }
  }
}