# CosmiFill UI API Documentation

## Overview

CosmiFill UI provides a secure Electron-based interface for intelligent PDF form filling using Claude Code. This document describes the internal APIs and IPC communication patterns.

## IPC API Reference

### Platform & Setup

#### `platform:get`
Get the current platform.
- **Returns**: `'darwin' | 'linux' | 'win32'`

#### `node:check`
Check if Node.js is installed.
- **Returns**: `boolean`

#### `claude:check`
Check if Claude Code is installed.
- **Returns**: `boolean`

### File Operations

#### `dialog:openFiles`
Open file selection dialog.
- **Returns**: `{ canceled: boolean; filePaths: string[] }`

### Sandbox Operations

#### `sandbox:create`
Create a new secure sandbox for a session.
- **Returns**: `{ sessionId: string; path: string }`

### Claude Integration

#### `claude:launch`
Launch Claude Code with sandbox restrictions.
- **Parameters**: 
  ```typescript
  {
    sessionId: string;
    workDir: string;
    prompt: string;
    analysisData: any;
  }
  ```

### PDF Processing

#### `pdf:analyze`
Analyze PDF files for form fields and metadata.
- **Parameters**: `string[]` (file paths)
- **Returns**: `PDFAnalysisResult[]`

#### `pdf:extract`
Extract data from various file types.
- **Parameters**: `string[]` (file paths)
- **Returns**: `ExtractedData[]`

#### `pdf:fill`
Fill a PDF form with data.
- **Parameters**: 
  ```typescript
  {
    pdfPath: string;
    data: Record<string, any>;
    options?: {
      highlightFields?: boolean;
      addTimestamp?: boolean;
      outputDir?: string;
    };
  }
  ```
- **Returns**: `string` (output path)

#### `pdf:process`
Process multiple PDFs with extracted data.
- **Parameters**: `ProcessingConfig`
- **Returns**: `ProcessingResult`

### Installation

#### `deps:installNode`
Install Node.js (with WSL support on Windows).
- **Returns**: `void`

#### `deps:installClaude`
Install Claude Code globally.
- **Returns**: `void`

## Security APIs

### Secure Tools

The following tools are exposed to Claude Code through secure proxies:

#### SecureBash
Execute whitelisted commands in sandbox.
- **Allowed commands**: ls, pwd, echo, python, python3

#### SecureRead
Read files within sandbox boundaries.

#### SecureWrite
Write files with type restrictions within sandbox.

#### SecureEdit
Edit files with content validation within sandbox.

## Event Emitters

### Claude Events

#### `claude:output`
Emitted when Claude produces output.
- **Data**: `string`

#### `claude:error`
Emitted on Claude errors.
- **Data**: `string`

#### `claude:exit`
Emitted when Claude process exits.
- **Data**: `number` (exit code)

### Update Events

#### `update:available`
New version available.
- **Data**: `UpdateInfo`

#### `update:progress`
Download progress.
- **Data**: `ProgressInfo`

#### `update:downloaded`
Update downloaded and ready.
- **Data**: `UpdateInfo`

#### `update:error`
Update error occurred.
- **Data**: `string`

## Data Types

### PDFAnalysisResult
```typescript
interface PDFAnalysisResult {
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
```

### FormField
```typescript
interface FormField {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'signature' | 'button' | 'unknown';
  value?: string | boolean;
  options?: string[];
  required?: boolean;
  page?: number;
}
```

### ExtractedData
```typescript
interface ExtractedData {
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
```

### ProcessingConfig
```typescript
interface ProcessingConfig {
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
```

### ProcessingResult
```typescript
interface ProcessingResult {
  success: boolean;
  filledPDFs: string[];
  errors: string[];
  analysis: any;
  extractedData: any;
  mappings: any;
}
```

## Security Considerations

1. All file operations are sandboxed
2. Commands are whitelisted and validated
3. File types are restricted for writes
4. Path traversal is prevented
5. All security events are logged
6. Sessions are isolated and temporary

## Usage Example

```typescript
// Renderer process
const { electronAPI } = window;

// Create sandbox
const { sessionId, path } = await electronAPI.createSandbox();

// Analyze PDFs
const analysis = await electronAPI.invoke('pdf:analyze', ['/path/to/form.pdf']);

// Extract data
const data = await electronAPI.invoke('pdf:extract', ['/path/to/data.csv']);

// Process PDFs
const result = await electronAPI.invoke('pdf:process', {
  sessionId,
  formFiles: ['/path/to/form.pdf'],
  dataFiles: ['/path/to/data.csv'],
  options: {
    autoMap: true,
    addTimestamp: true
  }
});
```