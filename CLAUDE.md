# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CosmiFill is a generic PDF form filling tool that pre-analyzes PDFs and documents, then launches Claude Code to intelligently fill forms. It acts as a bridge between raw PDF files and Claude's capabilities.

## Development Commands

### Installation
```bash
# Using pipx (recommended for CLI tools)
pipx install .

# For development
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

### Running CosmiFill
```bash
# Main command - launches Claude Code session
cosmifill <folder_path>

# Analyze PDFs without filling
cosmifill <folder_path> --analyze-only

# Inspect filled PDFs
cosmifill <folder_path> --inspect filled.pdf
```

### Testing
```bash
# Test with sample PDFs
cosmifill Test/
```

## Architecture

### Core Flow
1. **Pre-analysis Phase** (`interactive_session.py`):
   - Creates `.claude/settings.local.json` with permissions
   - Analyzes all PDFs using `PDFAnalyzer`
   - Extracts data using `DataExtractor`
   - Saves results to `COSMIFILL_ANALYSIS.json`
   - Creates `cosmifill_setup.py` for Claude to load modules

2. **Claude Integration**:
   - Launches `claude` CLI with initial prompt
   - Provides pre-analyzed data to avoid re-extraction
   - Claude uses CosmiFill modules via the setup script

### Key Modules

- `cli.py`: Entry point, handles command-line arguments
- `interactive_session.py`: Manages Claude Code integration and pre-analysis
- `pdf_analyzer.py`: Extracts form fields and PDF metadata
- `data_extractor.py`: Extracts data from documents (PDFs, text files)
- `pdf_filler.py`: Fills PDF forms with provided data
- `inspector.py`: Verifies filled PDFs

### Important Design Decisions

1. **Pre-analysis**: CosmiFill analyzes PDFs BEFORE launching Claude to avoid import/permission issues
2. **Permissions**: Automatically creates `.claude/settings.local.json` with required permissions
3. **Module Loading**: `cosmifill_setup.py` is generated with correct Python path from pipx
4. **Generic Tool**: No hardcoded personal information - works with any PDF form

### Common Issues & Solutions

1. **"Module not found" errors**: Ensure Claude runs `cosmifill_setup.py` first
2. **"Python not found"**: Use the Python path from `context['python_path']` in COSMIFILL_ANALYSIS.json
3. **Import errors**: Don't import from 'cosmifill' package directly - modules are pre-imported by setup script

### PDF Filling Workflow

When filling PDFs:
1. Load pre-analyzed data from `COSMIFILL_ANALYSIS.json`
2. Match extracted data to form fields intelligently
3. Handle multi-form scenarios (e.g., 8 items but only 4 rows per form)
4. Use `PDFFiller` to create filled PDFs with timestamps
5. Verify with `PDFInspector`

### Key Dependencies

- `fillpdf`: Core PDF form filling functionality
- `pdfplumber`: PDF text extraction
- `PyPDF2`: PDF structure analysis
- `click`: CLI framework
- `rich`: Terminal formatting