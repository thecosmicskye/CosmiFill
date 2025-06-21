"""PDF inspection and verification tools"""
from pathlib import Path
from typing import Dict, Any, List, Tuple
from fillpdf import fillpdfs
import pdfplumber
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
import logging

from cosmifill.utils import validate_path, PDFAnalysisError

class PDFInspector:
    """Inspect and verify filled PDF forms."""
    
    def __init__(self, pdf_path: str):
        """Initialize PDF inspector with validation.
        
        Args:
            pdf_path: Path to the PDF file to inspect
            
        Raises:
            PDFAnalysisError: If the PDF path is invalid
        """
        try:
            self.pdf_path = validate_path(pdf_path, must_exist=True)
            if not self.pdf_path.suffix.lower() == '.pdf':
                raise PDFAnalysisError(f"File is not a PDF: {pdf_path}")
        except Exception as e:
            raise PDFAnalysisError(f"Invalid PDF path: {pdf_path} - {str(e)}")
            
        self.console = Console()
        self.logger = logging.getLogger(f'cosmifill.PDFInspector.{self.pdf_path.name}')
        
    def inspect(self) -> Dict[str, Any]:
        """Perform complete inspection of the PDF.
        
        Returns:
            Dictionary containing inspection results
            
        Raises:
            PDFAnalysisError: If inspection fails
        """
        try:
            self.logger.info(f"Starting inspection of {self.pdf_path.name}")
            form_fields = self._get_form_values()
            filled_fields = self._count_filled_fields(form_fields)
            
            result = {
                'file_name': self.pdf_path.name,
                'form_fields': form_fields,
                'total_fields': len(form_fields),
                'filled_fields': filled_fields,
                'empty_fields': len(form_fields) - filled_fields,
                'completion_percentage': (filled_fields / len(form_fields) * 100) if form_fields else 0
            }
            
            self.logger.info(f"Inspection complete: {result['filled_fields']}/{result['total_fields']} fields filled")
            return result
            
        except Exception as e:
            self.logger.error(f"Inspection failed: {str(e)}")
            raise PDFAnalysisError(f"Failed to inspect PDF: {str(e)}")
    
    def _get_form_values(self) -> Dict[str, Any]:
        """Get all form field values."""
        try:
            return fillpdfs.get_form_fields(str(self.pdf_path))
        except Exception as e:
            self.logger.warning(f"Could not get form values: {str(e)}")
            return {}
    
    def _count_filled_fields(self, fields: Dict[str, Any]) -> int:
        """Count how many fields have values."""
        return sum(1 for value in fields.values() if value)
    
    def display_inspection(self):
        """Display inspection results in a formatted table."""
        inspection = self.inspect()
        
        # Header panel
        self.console.print(Panel.fit(
            f"[bold cyan]PDF Inspection Report[/bold cyan]\n"
            f"File: {inspection['file_name']}",
            border_style="cyan"
        ))
        
        # Summary stats
        self.console.print(f"\n[bold]Summary:[/bold]")
        self.console.print(f"  Total fields: {inspection['total_fields']}")
        self.console.print(f"  Filled fields: {inspection['filled_fields']} "
                          f"({inspection['completion_percentage']:.1f}%)")
        self.console.print(f"  Empty fields: {inspection['empty_fields']}")
        
        # Field details table
        if inspection['form_fields']:
            self.console.print(f"\n[bold]Field Details:[/bold]")
            table = Table()
            table.add_column("Field Name", style="cyan", width=40)
            table.add_column("Value", style="green")
            table.add_column("Status", style="yellow")
            
            for field_name, value in inspection['form_fields'].items():
                status = "✓ Filled" if value else "✗ Empty"
                display_value = str(value)[:50] + "..." if len(str(value)) > 50 else str(value)
                table.add_row(field_name, display_value or "[empty]", status)
            
            self.console.print(table)
    
    def compare_pdfs(self, other_pdf_path: str) -> Dict[str, Any]:
        """Compare this PDF with another to see differences.
        
        Args:
            other_pdf_path: Path to the PDF to compare with
            
        Returns:
            Comparison results including differences
            
        Raises:
            PDFAnalysisError: If comparison fails
        """
        try:
            other_inspector = PDFInspector(other_pdf_path)
            
            this_fields = self._get_form_values()
            other_fields = other_inspector._get_form_values()
            
            if not this_fields and not other_fields:
                raise PDFAnalysisError("Both PDFs have no form fields to compare")
            
            differences = []
            for field_name in set(list(this_fields.keys()) + list(other_fields.keys())):
                this_value = this_fields.get(field_name, "")
                other_value = other_fields.get(field_name, "")
                
                if this_value != other_value:
                    differences.append({
                        'field': field_name,
                        'original': this_value,
                        'filled': other_value
                    })
        
            result = {
                'original_file': self.pdf_path.name,
                'filled_file': Path(other_pdf_path).name,
                'differences': differences,
                'fields_changed': len(differences),
                'total_fields': len(set(list(this_fields.keys()) + list(other_fields.keys())))
            }
            
            self.logger.info(f"Comparison complete: {result['fields_changed']} differences found")
            return result
            
        except Exception as e:
            self.logger.error(f"Comparison failed: {str(e)}")
            raise PDFAnalysisError(f"Failed to compare PDFs: {str(e)}")
    
    def validate_required_fields(self, required_fields: List[str]) -> Tuple[bool, List[str]]:
        """Check if all required fields are filled.
        
        Args:
            required_fields: List of field names that must be filled
            
        Returns:
            Tuple of (is_valid, missing_fields)
        """
        try:
            form_fields = self._get_form_values()
            missing_fields = []
            
            for field in required_fields:
                if field not in form_fields or not form_fields[field]:
                    missing_fields.append(field)
            
            is_valid = len(missing_fields) == 0
            self.logger.info(f"Validation complete: {'PASS' if is_valid else 'FAIL'} ({len(missing_fields)} missing)")
            
            return is_valid, missing_fields
            
        except Exception as e:
            self.logger.error(f"Validation failed: {str(e)}")
            return False, []