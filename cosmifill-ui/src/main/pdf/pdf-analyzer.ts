import { PDFDocument, PDFField, PDFForm } from 'pdf-lib';
import fs from 'node:fs/promises';
import pdfParse from './pdf-parse-wrapper';
import { logger } from '../../utils/logger';

export interface FormField {
  name: string;
  type: string;
  value?: string | boolean;
  options?: string[];
  required?: boolean;
  page?: number;
}

export interface PDFAnalysisResult {
  path: string;
  filename: string;
  pageCount: number;
  hasForm: boolean;
  formFields: FormField[];
  textContent?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export class PDFAnalyzer {
  async analyzePDF(filePath: string): Promise<PDFAnalysisResult> {
    try {
      logger.info('Analyzing PDF', { filePath });
      
      // Read PDF buffer
      const pdfBuffer = await fs.readFile(filePath);
      
      // Load PDF document
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      // Get basic info
      const pageCount = pdfDoc.getPageCount();
      const form = pdfDoc.getForm();
      
      // Extract metadata
      const metadata = {
        title: pdfDoc.getTitle(),
        author: pdfDoc.getAuthor(),
        subject: pdfDoc.getSubject(),
        creator: pdfDoc.getCreator(),
        producer: pdfDoc.getProducer(),
        creationDate: pdfDoc.getCreationDate(),
        modificationDate: pdfDoc.getModificationDate(),
      };
      
      // Extract form fields
      const formFields: FormField[] = [];
      const fields = form.getFields();
      
      for (const field of fields) {
        const fieldData = this.extractFieldData(field);
        if (fieldData) {
          formFields.push(fieldData);
        }
      }
      
      // Extract text content
      let textContent = '';
      try {
        const parseResult = await pdfParse(pdfBuffer);
        textContent = parseResult.text;
      } catch (error) {
        logger.warn('Failed to extract text content', { error, filePath });
      }
      
      const result: PDFAnalysisResult = {
        path: filePath,
        filename: filePath.split('/').pop() || '',
        pageCount,
        hasForm: formFields.length > 0,
        formFields,
        textContent,
        metadata,
      };
      
      logger.info('PDF analysis complete', {
        filePath,
        pageCount,
        formFieldCount: formFields.length,
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to analyze PDF', { error, filePath });
      throw new Error(`Failed to analyze PDF: ${error}`);
    }
  }
  
  private extractFieldData(field: PDFField): FormField | null {
    try {
      const name = field.getName();
      if (!name) return null;
      
      const fieldData: FormField = {
        name,
        type: this.getFieldType(field),
      };
      
      // Extract field-specific data
      if (field.constructor.name === 'PDFTextField') {
        const textField = field as any;
        fieldData.value = textField.getText?.() || '';
        fieldData.required = textField.isRequired?.() || false;
      } else if (field.constructor.name === 'PDFCheckBox') {
        const checkBox = field as any;
        fieldData.value = checkBox.isChecked?.() || false;
      } else if (field.constructor.name === 'PDFDropdown' || field.constructor.name === 'PDFOptionList') {
        const dropdown = field as any;
        fieldData.options = dropdown.getOptions?.() || [];
        fieldData.value = dropdown.getSelected?.()?.join(', ') || '';
      } else if (field.constructor.name === 'PDFRadioGroup') {
        const radioGroup = field as any;
        fieldData.options = radioGroup.getOptions?.() || [];
        fieldData.value = radioGroup.getSelected?.() || '';
      }
      
      return fieldData;
    } catch (error) {
      logger.warn('Failed to extract field data', { error, fieldName: field.getName() });
      return null;
    }
  }
  
  private getFieldType(field: PDFField): string {
    const typeName = field.constructor.name;
    
    switch (typeName) {
      case 'PDFTextField':
        return 'text';
      case 'PDFCheckBox':
        return 'checkbox';
      case 'PDFDropdown':
        return 'dropdown';
      case 'PDFOptionList':
        return 'list';
      case 'PDFRadioGroup':
        return 'radio';
      case 'PDFSignature':
        return 'signature';
      case 'PDFButton':
        return 'button';
      default:
        return 'unknown';
    }
  }
  
  async analyzeBatch(filePaths: string[]): Promise<PDFAnalysisResult[]> {
    const results: PDFAnalysisResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.analyzePDF(filePath);
        results.push(result);
      } catch (error) {
        logger.error('Failed to analyze PDF in batch', { error, filePath });
        // Continue with other files
      }
    }
    
    return results;
  }
}