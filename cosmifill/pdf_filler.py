from fillpdf import fillpdfs
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import shutil
from datetime import datetime
import logging

from cosmifill.utils import validate_path, sanitize_data, sanitize_filename, PDFFillError, MAX_FIELD_LENGTH

class PDFFiller:
    """Fills PDF forms with provided data."""
    
    def __init__(self, pdf_path: str) -> None:
        """Initialize PDF filler with validation.
        
        Args:
            pdf_path: Path to the PDF file to fill
            
        Raises:
            PDFFillError: If the PDF path is invalid
        """
        try:
            self.pdf_path = validate_path(pdf_path, must_exist=True)
            if not self.pdf_path.suffix.lower() == '.pdf':
                raise PDFFillError(f"File is not a PDF: {pdf_path}")
        except Exception as e:
            raise PDFFillError(f"Invalid PDF path: {pdf_path} - {str(e)}")
            
        self.output_path = None
        self.logger = logging.getLogger(f'cosmifill.PDFFiller.{self.pdf_path.name}')
        
    def fill_form(self, data: Dict[str, Any], output_suffix: str = "_filled") -> str:
        """Fill the PDF form with provided data.
        
        Args:
            data: Dictionary mapping field names to values
            output_suffix: Suffix to add to the output filename
            
        Returns:
            Path to the filled PDF file
            
        Raises:
            PDFFillError: If filling fails
        """
        # Validate and sanitize all data values
        sanitized_data = {}
        for field, value in data.items():
            if not isinstance(field, str) or not field.strip():
                raise PDFFillError(f"Invalid field name: {field}")
            
            if value is not None:
                str_value = str(value)
                if len(str_value) > MAX_FIELD_LENGTH:
                    self.logger.warning(
                        f"Field '{field}' value truncated from {len(str_value)} to {MAX_FIELD_LENGTH} characters"
                    )
                sanitized_data[field] = sanitize_data(str_value)
            else:
                sanitized_data[field] = ""
        
        # Create output filename with sanitization
        stem = sanitize_filename(self.pdf_path.stem)
        suffix = self.pdf_path.suffix
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_name = f"{stem}{output_suffix}_{timestamp}{suffix}"
        self.output_path = self.pdf_path.parent / output_name
        
        try:
            self.logger.info(f"Filling PDF with {len(sanitized_data)} fields")
            
            # Fill the PDF
            fillpdfs.write_fillable_pdf(
                str(self.pdf_path),
                str(self.output_path),
                sanitized_data,
                flatten=False  # Keep form fields editable
            )
            
            # Verify the output was created
            if not self.output_path.exists():
                raise PDFFillError("Output PDF was not created")
            
            self.logger.info(f"PDF filled successfully: {self.output_path.name}")
            print(f"✓ PDF filled successfully: {self.output_path.name}")
            return str(self.output_path)
            
        except Exception as e:
            error_msg = f"Error filling PDF: {str(e)}"
            self.logger.error(error_msg)
            print(f"✗ {error_msg}")
            
            # Clean up failed output
            if self.output_path and self.output_path.exists():
                try:
                    self.output_path.unlink()
                except Exception:
                    pass
                    
            raise PDFFillError(error_msg)
    
    def fill_with_mappings(self, data: Dict[str, Any], mappings: Dict[str, str]) -> str:
        """Fill PDF using field mappings."""
        # Transform data according to mappings
        filled_data = {}
        for pdf_field, data_key in mappings.items():
            if data_key in data:
                filled_data[pdf_field] = data[data_key]
        
        return self.fill_form(filled_data)
    
    def preview_fill(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Preview what will be filled without actually filling the PDF.
        
        Args:
            data: Dictionary mapping field names to values
            
        Returns:
            Preview of changes that will be made
            
        Raises:
            PDFFillError: If preview generation fails
        """
        try:
            form_fields = fillpdfs.get_form_fields(str(self.pdf_path))
            preview = {}
            
            # Sanitize data for preview
            sanitized_data = {}
            for field, value in data.items():
                if value is not None:
                    sanitized_data[field] = sanitize_data(str(value))
            
            for field_name in form_fields:
                if field_name in sanitized_data:
                    preview[field_name] = {
                        'current_value': form_fields[field_name] or '[EMPTY]',
                        'new_value': sanitized_data[field_name]
                    }
                else:
                    preview[field_name] = {
                        'current_value': form_fields[field_name] or '[EMPTY]',
                        'new_value': '[NO CHANGE]'
                    }
            
            return preview
            
        except Exception as e:
            raise PDFFillError(f"Failed to generate preview: {str(e)}")
    
    def verify_filled_pdf(self, filled_pdf_path: str) -> Dict[str, Any]:
        """Verify the filled PDF by reading back the values.
        
        Args:
            filled_pdf_path: Path to the filled PDF to verify
            
        Returns:
            Verification results including filled and empty fields
        """
        try:
            verified_path = validate_path(filled_pdf_path, must_exist=True)
            filled_fields = fillpdfs.get_form_fields(str(verified_path))
            
            filled_count = sum(1 for v in filled_fields.values() if v)
            empty_fields = [k for k, v in filled_fields.items() if not v]
            
            return {
                'success': True,
                'filled_fields': filled_fields,
                'empty_fields': empty_fields,
                'filled_count': filled_count,
                'total_fields': len(filled_fields),
                'completion_percentage': (filled_count / len(filled_fields) * 100) if filled_fields else 0
            }
        except Exception as e:
            self.logger.error(f"Verification failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }