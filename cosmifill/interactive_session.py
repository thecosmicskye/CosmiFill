import subprocess
import sys
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint
import json
import shutil
import logging
import time

# Import CosmiFill modules
from cosmifill.pdf_analyzer import PDFAnalyzer
from cosmifill.data_extractor import DataExtractor
from cosmifill.pdf_filler import PDFFiller
from cosmifill.inspector import PDFInspector
from cosmifill.utils import (
    validate_path, create_safe_directory, sanitize_filename,
    ClaudeIntegrationError, PDFAnalysisError, DataExtractionError
)

class InteractiveSession:
    """Manages interactive Claude Code session for PDF filling."""
    
    def __init__(self, folder_path: str):
        """Initialize interactive session with validation.
        
        Args:
            folder_path: Path to the working folder
            
        Raises:
            ClaudeIntegrationError: If initialization fails
        """
        try:
            self.folder_path = validate_path(folder_path, must_exist=True)
            if not self.folder_path.is_dir():
                raise ClaudeIntegrationError(f"Path is not a directory: {folder_path}")
        except Exception as e:
            raise ClaudeIntegrationError(f"Invalid folder path: {folder_path} - {str(e)}")
            
        self.console = Console()
        self.data_store = {}
        self.filled_pdfs = []
        self.logger = logging.getLogger('cosmifill.InteractiveSession')
        self.session_file = self.folder_path / ".cosmifill_session.json"
        
    def start(self):
        """Start the interactive CosmiFill session with error recovery."""
        try:
            self.console.print(Panel.fit(
                "[bold cyan]CosmiFill Interactive Session[/bold cyan]\n"
                f"Working with folder: {self.folder_path}",
                border_style="cyan"
            ))
            
            # Create a session file to track progress
            session_data = {
                "folder": str(self.folder_path),
                "status": "active",
                "filled_pdfs": [],
                "extracted_data": {},
                "started_at": time.time()
            }
            
            with open(self.session_file, 'w') as f:
                json.dump(session_data, f, indent=2)
            
            # Check Claude CLI availability first
            if not self._check_claude_cli():
                self._handle_missing_claude()
                return
            
            # Launch Claude Code with the session context
            success = self._launch_claude_session()
            
            # Update session status
            session_data["status"] = "completed" if success else "failed"
            session_data["ended_at"] = time.time()
            
            with open(self.session_file, 'w') as f:
                json.dump(session_data, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Session start failed: {str(e)}")
            self.console.print(f"[red]Error starting session: {str(e)}[/red]")
            raise ClaudeIntegrationError(f"Failed to start interactive session: {str(e)}")
        
    def _check_claude_cli(self) -> bool:
        """Check if Claude CLI is installed.
        
        Returns:
            True if Claude CLI is available, False otherwise
        """
        claude_path = shutil.which('claude')
        if claude_path:
            self.logger.info(f"Claude CLI found at: {claude_path}")
            return True
        else:
            self.logger.warning("Claude CLI not found in PATH")
            return False
    
    def _handle_missing_claude(self):
        """Handle the case when Claude CLI is not installed."""
        self.console.print("[red]Claude CLI not found![/red]\n")
        self.console.print("CosmiFill requires Claude Code to be installed.")
        self.console.print("\nPlease install Claude Code from:")
        self.console.print("[cyan]https://claude.ai/download[/cyan]\n")
        
        # Save analysis results for manual use
        self.console.print("[yellow]Performing pre-analysis anyway...[/yellow]")
        try:
            context_data = self._pre_analyze_folder()
            self.console.print("\n[green]✓ Analysis saved to COSMIFILL_ANALYSIS.json[/green]")
            self.console.print("\nYou can manually use this data with Claude Code by:")
            self.console.print(f"1. Installing Claude Code")
            self.console.print(f"2. Running: cd {self.folder_path}")
            self.console.print(f"3. Running: claude")
            self.console.print(f"4. Loading the analysis: python cosmifill_setup.py")
        except Exception as e:
            self.logger.error(f"Pre-analysis failed: {str(e)}")
            self.console.print(f"[red]Pre-analysis failed: {str(e)}[/red]")
    
    def _setup_claude_permissions(self):
        """Create .claude/settings.local.json with necessary permissions."""
        claude_dir = self.folder_path / ".claude"
        claude_dir.mkdir(exist_ok=True)
        
        settings_file = claude_dir / "settings.local.json"
        
        # Define permissions for CosmiFill operations
        python_path = sys.executable
        settings = {
            "permissions": {
                "allow": [
                    # Allow Python execution with cosmifill modules - more restrictive
                    f"Bash({python_path}:cosmifill_setup.py)",
                    f"Bash({python_path}:*.py)",
                    # Allow reading/writing in working directory only
                    f"Read({str(self.folder_path)}/*)",
                    f"Write({str(self.folder_path)}/*)",
                    f"Edit({str(self.folder_path)}/*)",
                    # Allow specific file operations
                    f"Bash(ls:{str(self.folder_path)}/*)",
                    "Bash(pwd)",
                ],
                "additionalDirectories": [
                    str(self.folder_path)  # Working directory only
                ]
            },
            "env": {
                "PYTHONPATH": str(Path(__file__).parent.parent),
                "COSMIFILL_WORKING_DIR": str(self.folder_path)
            }
        }
        
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        # Add to .gitignore if it exists
        gitignore = self.folder_path / ".gitignore"
        if gitignore.exists():
            with open(gitignore, 'r') as f:
                content = f.read()
            if '.claude/settings.local.json' not in content:
                with open(gitignore, 'a') as f:
                    f.write('\n.claude/settings.local.json\n')
        
        self.console.print("[green]✓ Created Claude permissions file[/green]")
        return settings_file
    
    def _pre_analyze_folder(self):
        """Pre-analyze PDFs and extract data before launching Claude."""
        self.console.print("[yellow]Pre-analyzing PDFs and extracting data...[/yellow]")
        
        # Set up permissions first
        try:
            self._setup_claude_permissions()
        except Exception as e:
            self.logger.error(f"Failed to set up Claude permissions: {str(e)}")
            self.console.print(f"[yellow]Warning: Could not set up Claude permissions: {str(e)}[/yellow]")
        
        analysis_results = {}
        errors = []
        
        # Analyze all PDFs with progress indication
        pdf_files = list(self.folder_path.glob("*.pdf"))
        self.console.print(f"\n[cyan]Analyzing {len(pdf_files)} PDF files...[/cyan]")
        
        with self.console.status("[bold green]Analyzing PDFs...") as status:
            for idx, pdf_file in enumerate(pdf_files, 1):
                status.update(f"[bold green]Analyzing {pdf_file.name} ({idx}/{len(pdf_files)})...")
                try:
                    analyzer = PDFAnalyzer(str(pdf_file))
                    analysis = analyzer.analyze()
                    analysis_results[pdf_file.name] = analysis
                    self.console.print(f"  ✓ {pdf_file.name}: {analysis['field_count']} fields found")
                except Exception as e:
                    error_msg = f"Failed to analyze {pdf_file.name}: {str(e)}"
                    self.logger.error(error_msg)
                    errors.append(error_msg)
                    analysis_results[pdf_file.name] = {"error": str(e)}
                    self.console.print(f"  ✗ {pdf_file.name}: [red]{str(e)}[/red]")
        
        # Extract data from folder with error handling
        self.console.print("\n[cyan]Extracting data from documents...[/cyan]")
        try:
            extractor = DataExtractor(str(self.folder_path))
            extracted_data = extractor.extract_all()
            structured_data = extractor.get_structured_data()
            self.console.print("  ✓ Data extraction complete")
        except Exception as e:
            error_msg = f"Data extraction failed: {str(e)}"
            self.logger.error(error_msg)
            errors.append(error_msg)
            extracted_data = {"error": str(e)}
            structured_data = {"error": str(e)}
            self.console.print(f"  ✗ Data extraction: [red]{str(e)}[/red]")
        
        # Create context file with results
        context_file = self.folder_path / "COSMIFILL_ANALYSIS.json"
        context_data = {
            "pdf_analysis": analysis_results,
            "extracted_data": extracted_data,
            "structured_data": structured_data,
            "python_path": sys.executable,
            "cosmifill_path": str(Path(__file__).parent.parent),
            "working_directory": str(self.folder_path),
            "analysis_timestamp": time.time(),
            "errors": errors
        }
        
        with open(context_file, 'w') as f:
            json.dump(context_data, f, indent=2)
        
        if errors:
            self.console.print(f"\n[yellow]⚠ Analysis completed with {len(errors)} warnings[/yellow]")
        else:
            self.console.print("\n[green]✓ Analysis completed successfully[/green]")
        
        return context_data
    
    def _launch_claude_session(self) -> bool:
        """Launch Claude Code with appropriate context.
        
        Returns:
            True if launch was successful, False otherwise
        """
        try:
            # Pre-analyze the folder
            self.logger.info("Starting pre-analysis...")
            context_data = self._pre_analyze_folder()
            
            # Check for critical errors
            if context_data.get("errors") and len(context_data["errors"]) > 5:
                if not Confirm.ask("\n[yellow]Multiple errors occurred during analysis. Continue anyway?[/yellow]"):
                    return False
            
            # Create setup script for Claude to use
            setup_script = self.folder_path / "cosmifill_setup.py"
            with open(setup_script, 'w') as f:
                f.write(f"""#!{context_data['python_path']}
# CosmiFill Setup Script - Run this to use CosmiFill modules

import sys
import json

# CosmiFill is already installed in the environment
# Just import the modules directly

# Import CosmiFill modules
from cosmifill.pdf_analyzer import PDFAnalyzer
from cosmifill.data_extractor import DataExtractor
from cosmifill.pdf_filler import PDFFiller
from cosmifill.inspector import PDFInspector

# Load pre-analyzed data
with open('COSMIFILL_ANALYSIS.json', 'r') as f:
    context = json.load(f)

print("CosmiFill modules loaded successfully!")
print("\\nPre-analyzed data available in 'context' variable")
print("\\nIMPORTANT: Modules are already imported. Use them directly:")
print("  - PDFAnalyzer")
print("  - DataExtractor") 
print("  - PDFFiller")
print("  - PDFInspector")
print("\\nExample usage:")
print("  filler = PDFFiller('your_form.pdf')")
print("  data = {{'Field Name': 'Value', 'Another Field': 'Another Value'}}")
print("  output = filler.fill_form(data)")
print("  inspector = PDFInspector(output)")
print("  inspector.display_inspection()")
print("\\nDO NOT import from 'cosmifill' - the modules are already available!")
""")
            
            # Make script executable
            os.chmod(setup_script, 0o755)
            
            # Create the prompt for Claude
            prompt = f"""You are now in a CosmiFill session to help fill PDF forms intelligently.

I've pre-analyzed the PDFs and extracted data for you. The results are in COSMIFILL_ANALYSIS.json.

To use CosmiFill modules, run: {context_data['python_path']} cosmifill_setup.py

Analysis Summary:
"""
            
            # Add PDF analysis summary
            for pdf_name, analysis in context_data['pdf_analysis'].items():
                if 'error' not in analysis:
                    prompt += f"\n{pdf_name}:"
                    prompt += f"\n  - Fillable: {'Yes' if analysis.get('is_fillable') else 'No'}"
                    prompt += f"\n  - Fields: {analysis.get('field_count', 0)}"
                    if analysis.get('form_fields'):
                        prompt += "\n  - Key fields: " + ", ".join(list(analysis['form_fields'].keys())[:5])
            
            # Add extracted data summary
            if 'personal_info' in context_data['structured_data']:
                info = context_data['structured_data']['personal_info']
                prompt += f"\n\nExtracted Personal Info:"
                prompt += f"\n  - Name: {info.get('first_name', '')} {info.get('last_name', '')}"
                prompt += f"\n  - Email: {info.get('email', '')}"
            
            # Add order details if found in extracted data
            # Add any extracted data summary
            extracted_summary = ""
            if context_data['extracted_data'].get('amounts'):
                extracted_summary += f"\n\nExtracted Information:"
                extracted_summary += f"\n  - Found {len(context_data['extracted_data']['amounts'])} amount(s)"
                extracted_summary += f"\n  - Found {len(context_data['extracted_data']['emails'])} email(s)"
                extracted_summary += f"\n  - Found {len(context_data['extracted_data']['dates'])} date(s)"
            
            prompt += extracted_summary
            
            prompt += f"""

Your task:
1. Load the pre-analyzed data: {context_data['python_path']} cosmifill_setup.py
2. Review the extracted data in context['extracted_data'] and context['structured_data']
3. Match extracted data to form fields intelligently
4. Ask for any missing required information
5. Fill the form(s) with the available data
6. Handle multiple forms if needed when data exceeds form capacity

Python interpreter: {context_data['python_path']}"""
            
            # Launch Claude Code
            self.console.print("\n[bold green]Launching Claude Code...[/bold green]")
            
            # Save prompt to a file for reference
            prompt_file = self.folder_path / ".cosmifill_prompt.txt"
            with open(prompt_file, 'w') as f:
                f.write(prompt)
        
            try:
                # Change to the target directory
                original_dir = os.getcwd()
                os.chdir(self.folder_path)
                
                self.logger.info("Launching Claude Code...")
                # Launch Claude Code in interactive mode with the prompt
                result = subprocess.run(['claude', prompt], check=False, capture_output=False)
                
                # Return to original directory
                os.chdir(original_dir)
                
                if result.returncode == 0:
                    self.logger.info("Claude Code session completed successfully")
                    return True
                else:
                    self.logger.warning(f"Claude Code exited with code: {result.returncode}")
                    return False
                    
            except FileNotFoundError:
                self._handle_missing_claude()
                return False
            except KeyboardInterrupt:
                self.console.print("\n[yellow]Session interrupted by user[/yellow]")
                return False
            except Exception as e:
                self.logger.error(f"Failed to launch Claude: {str(e)}")
                self.console.print(f"[red]Error: {e}[/red]")
                self.console.print("\n[yellow]You can manually start Claude Code with:[/yellow]")
                self.console.print(f"  cd {self.folder_path}")
                self.console.print("  claude")
                self.console.print("\n[yellow]The prompt has been saved to:[/yellow]")
                self.console.print(f"  {prompt_file}")
                return False
                
        except Exception as e:
            self.logger.error(f"Session launch failed: {str(e)}")
            self.console.print(f"[red]Failed to launch session: {str(e)}[/red]")
            return False
    
    def resume(self):
        """Resume a previous CosmiFill session."""
        session_file = self.folder_path / ".cosmifill_session.json"
        if not session_file.exists():
            self.console.print("[red]No active session found in this folder.[/red]")
            return
        
        with open(session_file, 'r') as f:
            session_data = json.load(f)
        
        self.console.print(Panel.fit(
            "[bold cyan]Resuming CosmiFill Session[/bold cyan]\n"
            f"Folder: {session_data['folder']}\n"
            f"Filled PDFs: {len(session_data['filled_pdfs'])}",
            border_style="cyan"
        ))
        
        self._launch_claude_session()