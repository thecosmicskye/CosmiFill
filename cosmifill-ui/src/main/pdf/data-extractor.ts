import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from './pdf-parse-wrapper';
import { logger } from '../../utils/logger';

export interface ExtractedData {
  filename: string;
  type: 'text' | 'csv' | 'json' | 'pdf';
  content: string;
  structured?: any;
  metadata?: {
    size: number;
    modified: Date;
    extracted: Date;
  };
}

export class DataExtractor {
  async extractFromFile(filePath: string): Promise<ExtractedData> {
    try {
      logger.info('Extracting data from file', { filePath });
      
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const filename = path.basename(filePath);
      
      let content = '';
      let structured: any = null;
      let type: ExtractedData['type'] = 'text';
      
      switch (ext) {
        case '.txt':
          content = await fs.readFile(filePath, 'utf-8');
          type = 'text';
          break;
          
        case '.csv':
          content = await fs.readFile(filePath, 'utf-8');
          structured = this.parseCSV(content);
          type = 'csv';
          break;
          
        case '.json':
          content = await fs.readFile(filePath, 'utf-8');
          try {
            structured = JSON.parse(content);
          } catch (error) {
            logger.warn('Failed to parse JSON', { error, filePath });
          }
          type = 'json';
          break;
          
        case '.pdf':
          const pdfBuffer = await fs.readFile(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          content = pdfData.text;
          structured = {
            pages: pdfData.numpages,
            info: pdfData.info,
            metadata: pdfData.metadata,
          };
          type = 'pdf';
          break;
          
        default:
          // Try to read as text
          content = await fs.readFile(filePath, 'utf-8');
          type = 'text';
      }
      
      const result: ExtractedData = {
        filename,
        type,
        content,
        structured,
        metadata: {
          size: stats.size,
          modified: stats.mtime,
          extracted: new Date(),
        },
      };
      
      logger.info('Data extraction complete', {
        filePath,
        type,
        contentLength: content.length,
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to extract data', { error, filePath });
      throw new Error(`Failed to extract data from ${filePath}: ${error}`);
    }
  }
  
  private parseCSV(content: string): any[] {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return data;
  }
  
  async extractBatch(filePaths: string[]): Promise<ExtractedData[]> {
    const results: ExtractedData[] = [];
    
    for (const filePath of filePaths) {
      try {
        const data = await this.extractFromFile(filePath);
        results.push(data);
      } catch (error) {
        logger.error('Failed to extract data in batch', { error, filePath });
        // Continue with other files
      }
    }
    
    return results;
  }
  
  findDataByPattern(extractedData: ExtractedData[], patterns: string[]): Record<string, any> {
    const foundData: Record<string, any> = {};
    
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      
      for (const data of extractedData) {
        const matches = data.content.match(regex);
        if (matches && matches.length > 0) {
          foundData[pattern] = matches[0];
          logger.debug('Pattern matched', { pattern, match: matches[0], file: data.filename });
        }
        
        // Also search in structured data
        if (data.structured) {
          const structuredMatch = this.searchInObject(data.structured, pattern);
          if (structuredMatch) {
            foundData[pattern] = structuredMatch;
          }
        }
      }
    }
    
    return foundData;
  }
  
  private searchInObject(obj: any, pattern: string): any {
    const regex = new RegExp(pattern, 'gi');
    
    if (typeof obj === 'string') {
      const match = obj.match(regex);
      return match ? match[0] : null;
    }
    
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = this.searchInObject(item, pattern);
        if (result) return result;
      }
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        const result = this.searchInObject(value, pattern);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  async intelligentFieldMapping(
    formFields: Array<{ name: string; type: string }>,
    extractedData: ExtractedData[]
  ): Promise<Record<string, any>> {
    const mapping: Record<string, any> = {};
    
    // Common field patterns
    const fieldPatterns: Record<string, string[]> = {
      name: ['name', 'full.?name', 'first.?name.*last.?name'],
      email: ['email', 'e.?mail', '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'],
      phone: ['phone', 'tel', 'mobile', '\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}'],
      address: ['address', 'street', 'addr'],
      city: ['city', 'town'],
      state: ['state', 'province'],
      zip: ['zip', 'postal', '\\d{5}(-\\d{4})?'],
      date: ['date', '\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}'],
    };
    
    for (const field of formFields) {
      const fieldNameLower = field.name.toLowerCase();
      
      // Try to find matching pattern
      for (const [key, patterns] of Object.entries(fieldPatterns)) {
        if (fieldNameLower.includes(key)) {
          const foundData = this.findDataByPattern(extractedData, patterns);
          const firstMatch = Object.values(foundData)[0];
          if (firstMatch) {
            mapping[field.name] = firstMatch;
            logger.debug('Field mapped', { field: field.name, value: firstMatch });
            break;
          }
        }
      }
    }
    
    return mapping;
  }
}