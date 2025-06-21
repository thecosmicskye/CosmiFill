#!/usr/bin/env python3
import click
from pathlib import Path
import sys
import logging
from rich.console import Console
from rich.panel import Panel
from rich import print as rprint

from cosmifill.pdf_analyzer import PDFAnalyzer
from cosmifill.data_extractor import DataExtractor
from cosmifill.pdf_filler import PDFFiller
from cosmifill.interactive_session import InteractiveSession
from cosmifill.inspector import PDFInspector
from cosmifill.utils import validate_path, InvalidPathError, CosmiFillFileNotFoundError
from cosmifill.config import load_config, get_config
from cosmifill import __version__

console = Console()

@click.command()
@click.argument('folder', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--analyze-only', is_flag=True, help='Only analyze PDFs without filling')
@click.option('--resume', is_flag=True, help='Resume a previous session')
@click.option('--auto', is_flag=True, help='Attempt automatic filling without interaction')
@click.option('--inspect', type=click.Path(exists=True), help='Inspect a specific filled PDF')
@click.option('--config', type=click.Path(exists=True), help='Path to configuration file (YAML or JSON)')
def cosmifill(folder, analyze_only, resume, auto, inspect, config):
    """CosmiFill - Automatically fill PDF forms based on provided information.
    
    FOLDER: Path to folder containing PDFs and source documents
    """
    # Load configuration if provided
    if config:
        try:
            load_config(config)
            console.print(f"[green]✓ Loaded configuration from {config}[/green]")
        except Exception as e:
            console.print(f"[red]Error loading configuration: {e}[/red]")
            sys.exit(1)
    else:
        # Apply default logging configuration
        get_config().apply_logging_config()
    
    logger = logging.getLogger('cosmifill')
    
    try:
        folder_path = validate_path(folder, must_exist=True)
        if not folder_path.is_dir():
            raise InvalidPathError(f"Path is not a directory: {folder}")
    except (InvalidPathError, CosmiFillFileNotFoundError) as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)
    
    console.print(Panel.fit(
        "[bold cyan]CosmiFill[/bold cyan] - PDF Form Automation Tool\n"
        f"Version {__version__}",
        border_style="cyan"
    ))
    
    if inspect:
        # Inspect mode - examine a filled PDF
        try:
            inspect_path = validate_path(inspect, must_exist=True)
            if not inspect_path.suffix.lower() == '.pdf':
                raise InvalidPathError(f"File is not a PDF: {inspect}")
            inspector = PDFInspector(str(inspect_path))
            inspector.display_inspection()
        except (InvalidPathError, CosmiFillFileNotFoundError) as e:
            console.print(f"[red]Error: {e}[/red]")
            sys.exit(1)
        return
    
    if resume:
        session = InteractiveSession(folder_path)
        session.resume()
        return
    
    # Find PDFs in the folder
    pdf_files = list(folder_path.glob("*.pdf"))
    if not pdf_files:
        console.print("[red]No PDF files found in the specified folder![/red]")
        sys.exit(1)
    
    console.print(f"\n[green]Found {len(pdf_files)} PDF file(s):[/green]")
    for pdf in pdf_files:
        console.print(f"  • {pdf.name}")
    
    if analyze_only:
        # Just analyze the PDFs
        console.print("\n[yellow]Analyzing PDF structures...[/yellow]")
        for pdf_path in pdf_files:
            analyzer = PDFAnalyzer(str(pdf_path))
            analysis = analyzer.analyze()
            
            console.print(f"\n[bold]{analysis['file_name']}[/bold]")
            console.print(f"  Fillable: {'✓' if analysis['is_fillable'] else '✗'}")
            console.print(f"  Pages: {analysis['total_pages']}")
            console.print(f"  Form fields: {analysis['field_count']}")
            
            if analysis['form_fields']:
                console.print("  Fields:")
                for field_name in list(analysis['form_fields'].keys())[:5]:
                    console.print(f"    - {field_name}")
                if len(analysis['form_fields']) > 5:
                    console.print(f"    ... and {len(analysis['form_fields']) - 5} more")
        return
    
    if auto:
        console.print("\n[red]Auto mode is deprecated.[/red]")
        console.print("[yellow]Please use the interactive mode for intelligent PDF filling.[/yellow]")
        console.print("[cyan]CosmiFill now connects to Claude Code for smart form analysis and filling.[/cyan]")
        return
    
    # Interactive mode (default)
    session = InteractiveSession(folder_path)
    session.start()

if __name__ == '__main__':
    cosmifill()