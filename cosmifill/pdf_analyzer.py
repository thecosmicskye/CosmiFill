import PyPDF2
import pdfplumber
from fillpdf import fillpdfs
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
import json
import logging

from cosmifill.utils import validate_path, PDFAnalysisError, sanitize_error_message

class PDFAnalyzer:
    """Analyzes PDF files to extract form fields and content."""
    
    def __init__(self, pdf_path: str) -> None:
        """Initialize PDF analyzer with validation.
        
        Args:
            pdf_path: Path to the PDF file to analyze
            
        Raises:
            PDFAnalysisError: If the PDF path is invalid
        """
        try:
            self.pdf_path = validate_path(pdf_path, must_exist=True)
            if not self.pdf_path.suffix.lower() == '.pdf':
                raise PDFAnalysisError(f"File is not a PDF: {pdf_path}")
        except Exception as e:
            raise PDFAnalysisError(sanitize_error_message(f"Invalid PDF path: {pdf_path} - {str(e)}"))
        self.form_fields = {}
        self.text_content = []
        self.is_fillable = False
        self.total_pages = 0
        self.logger = logging.getLogger(f'cosmifill.PDFAnalyzer.{self.pdf_path.name}')
        
    def analyze(self) -> Dict[str, Any]:
        """Perform complete analysis of the PDF.
        
        Returns:
            Dictionary containing analysis results
            
        Raises:
            PDFAnalysisError: If analysis fails
        """
        try:
            self.logger.info(f"Starting analysis of {self.pdf_path.name}")
            self._extract_form_fields()
            self._extract_text_content()
            self._check_fillable_status()
            
            result = {
                'file_name': self.pdf_path.name,
                'is_fillable': self.is_fillable,
                'total_pages': self.total_pages,
                'form_fields': self.form_fields,
                'text_preview': self.text_content[:5] if self.text_content else [],
                'field_count': len(self.form_fields)
            }
            
            self.logger.info(f"Analysis complete: {result['field_count']} fields found")
            return result
            
        except Exception as e:
            self.logger.error(f"Analysis failed: {str(e)}")
            raise PDFAnalysisError(sanitize_error_message(f"Failed to analyze PDF: {str(e)}"))
    
    def _extract_form_fields(self) -> None:
        """Extract form fields using fillpdfs library."""
        try:
            self.form_fields = fillpdfs.get_form_fields(str(self.pdf_path))
            if not self.form_fields:
                self.form_fields = {}
        except Exception as e:
            self.logger.warning(f"Could not extract form fields: {e}")
            self.form_fields = {}
    
    def _extract_text_content(self) -> None:
        """Extract text content from PDF for context."""
        try:
            with pdfplumber.open(str(self.pdf_path)) as pdf:
                self.total_pages = len(pdf.pages)
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        lines = [line.strip() for line in text.split('\n') if line.strip()]
                        self.text_content.extend(lines)
        except Exception as e:
            self.logger.warning(f"Could not extract text content: {e}")
    
    def _check_fillable_status(self) -> None:
        """Check if PDF has fillable form fields."""
        try:
            with open(self.pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                if '/AcroForm' in pdf_reader.trailer.get('/Root', {}):
                    self.is_fillable = True
                else:
                    self.is_fillable = False
        except Exception as e:
            self.logger.warning(f"Could not check fillable status: {e}")
            self.is_fillable = bool(self.form_fields)
    
    def get_required_fields(self) -> List[str]:
        """Get list of form field names that need to be filled."""
        return list(self.form_fields.keys())
    
    def suggest_field_mappings(self, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest mappings between form fields and available data."""
        mappings = {}
        field_names_lower = {field.lower(): field for field in self.form_fields.keys()}
        
        # Common field mappings
        common_mappings = {
            'first name': ['first_name', 'firstname', 'fname'],
            'last name': ['last_name', 'lastname', 'lname'],
            'middle initial': ['middle_initial', 'mi'],
            'date of birth': ['dob', 'birthdate', 'birth_date'],
            'id': ['id', 'id_number', 'reference_number', 'identifier'],
            'date': ['date', 'event_date', 'transaction_date']
        }
        
        for field in self.form_fields:
            field_lower = field.lower()
            
            # Check exact matches first
            if field_lower in context_data:
                mappings[field] = context_data[field_lower]
                continue
            
            # Check common mappings
            for common_name, variations in common_mappings.items():
                if common_name in field_lower:
                    for variation in variations:
                        if variation in context_data:
                            mappings[field] = context_data[variation]
                            break
        
        return mappings