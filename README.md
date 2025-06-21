# CosmiFill

Generic PDF form filling tool that connects to Claude Code for intelligent form analysis and filling.

## What CosmiFill Does

CosmiFill is a command-line tool that:
1. **Analyzes** any PDF forms in your folder
2. **Extracts** data from documents, emails, and other files
3. **Connects to Claude Code** for intelligent form filling
4. **Handles complex scenarios** like calculations, multiple forms, and field matching

## Prerequisites

Before using CosmiFill, you'll need:

1. **Claude Code** - Install and set up Claude Code from [https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)
2. **Python 3.8+** - Required for running CosmiFill

## Installation

### Quick Install (Recommended)
```bash
# Clone the repository and run the installer
./install.sh
```

This will automatically install CosmiFill using pipx, which manages the virtual environment for you.

### Manual Installation
If you prefer to install manually:
```bash
# Using pipx (recommended)
pipx install .

# Or using pip in a virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

## Usage

### Interactive Mode (Recommended)
```bash
cosmifill <folder_path>
```

This creates a context file and launches an intelligent session where Claude Code will:
- Analyze your PDF forms
- Extract data from your documents  
- Intelligently match data to form fields
- Ask for missing information
- Fill and verify the forms

### Analyze PDFs Only
```bash
cosmifill <folder_path> --analyze-only
```

### Inspect Filled PDFs
```bash
cosmifill <folder_path> --inspect filled_form.pdf
```

## How It Works

1. **You run** `cosmifill /path/to/folder`
2. **CosmiFill creates** a context file explaining your PDF filling task
3. **Claude Code takes over** with intelligent analysis and filling capabilities
4. **You get perfectly filled PDFs** with smart data matching and calculations

## Features

- **Generic PDF support** - works with any fillable PDF
- **Intelligent data extraction** from emails, documents, etc.
- **Smart field matching** using context clues
- **Automatic calculations** (e.g., unit prices from totals)
- **Multi-form handling** when you have more data than form rows
- **PDF verification** and correction capabilities
- **Session management** for complex filling tasks

## Example Workflow

```bash
# Run in the current directory with your PDFs and documents
cosmifill .

# Or specify a folder:
# - fillable_form.pdf
# - order_receipt.pdf  
# - order_confirmations.txt

cosmifill ./my_folder

# CosmiFill will analyze everything and guide you through filling
```