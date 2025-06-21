import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Pattern
import json
import logging

from cosmifill.utils import validate_path, sanitize_data, DataExtractionError
from cosmifill.config import get_config


# Module-level compiled patterns for performance
_COMPILED_PATTERNS_CACHE = {}


def _get_compiled_patterns(patterns_dict: Dict[str, List[str]]) -> Dict[str, List[Pattern]]:
    """Get compiled regex patterns with caching."""
    # Create a cache key from the patterns
    cache_key = json.dumps(patterns_dict, sort_keys=True)
    
    if cache_key not in _COMPILED_PATTERNS_CACHE:
        compiled = {}
        for key, patterns in patterns_dict.items():
            compiled[key] = [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
        _COMPILED_PATTERNS_CACHE[cache_key] = compiled
    
    return _COMPILED_PATTERNS_CACHE[cache_key]


class DataExtractor:
    """Extracts structured data from various file types."""
    
    # Default patterns - can be overridden via configuration
    DEFAULT_PATTERNS = {
        'dates': [
            r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
            r'\b\d{1,2}-\d{1,2}-\d{2,4}\b',
            r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b',
            r'\b\d{4}-\d{2}-\d{2}\b'
        ],
        'emails': [r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'],
        'phones': [
            r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            r'\(\d{3}\)\s*\d{3}[-.]?\d{4}',
            r'\b\d{10}\b'
        ],
        'amounts': [r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)']
    }
    
    def __init__(self, folder_path: str, patterns: Optional[Dict[str, List[str]]] = None) -> None:
        """Initialize data extractor with validation.
        
        Args:
            folder_path: Path to the folder to extract data from
            patterns: Optional custom extraction patterns
            
        Raises:
            DataExtractionError: If the folder path is invalid
        """
        try:
            self.folder_path = validate_path(folder_path, must_exist=True)
            if not self.folder_path.is_dir():
                raise DataExtractionError(f"Path is not a directory: {folder_path}")
        except Exception as e:
            raise DataExtractionError(f"Invalid folder path: {folder_path} - {str(e)}")
            
        self.extracted_data = {}
        # Use patterns from config if not provided
        if patterns:
            self.patterns = patterns
        else:
            config = get_config()
            self.patterns = config.get_extraction_patterns() or self.DEFAULT_PATTERNS
        self.logger = logging.getLogger(f'cosmifill.DataExtractor')
        # Use module-level compiled patterns for performance
        self._compiled_patterns = _get_compiled_patterns(self.patterns)
        
    def extract_all(self) -> Dict[str, Any]:
        """Extract data from all files in the folder."""
        self.extracted_data = {
            'dates': [],
            'emails': [],
            'phone_numbers': [],
            'amounts': [],
            'key_value_pairs': {},  # Generic field: value extraction
            'potential_names': [],  # All potential names found
            'numbers': [],  # Any standalone numbers that might be IDs, codes, etc
            'raw_text': [],
            'tables': []  # For structured data from PDFs/CSVs
        }
        
        # Process each file in the folder
        for file_path in self.folder_path.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in ['.txt', '.email', '.pdf']:
                self._process_file(file_path)
        
        # Remove duplicates from lists
        for key in ['dates', 'emails', 'phone_numbers', 'amounts', 'potential_names', 'numbers']:
            if key in self.extracted_data and isinstance(self.extracted_data[key], list):
                self.extracted_data[key] = list(set(self.extracted_data[key]))
        
        return self.extracted_data
    
    def _process_file(self, file_path: Path) -> None:
        """Process a single file to extract data."""
        try:
            if file_path.suffix.lower() == '.pdf':
                # Extract text from PDFs that aren't fillable forms
                # Skip files that are likely blank forms based on common naming patterns
                form_indicators = ['form', 'template', 'blank', 'fillable', 'editable']
                if not any(indicator in file_path.name.lower() for indicator in form_indicators):
                    try:
                        import pdfplumber
                        with pdfplumber.open(file_path) as pdf:
                            for page in pdf.pages:
                                text = page.extract_text()
                                if text:
                                    # Sanitize the extracted text
                                    sanitized_text = sanitize_data(text)
                                    self.extracted_data['raw_text'].append(sanitized_text)
                                    self._extract_all_from_text(sanitized_text)
                    except Exception as e:
                        self.logger.warning(f"Could not extract text from PDF {file_path}: {e}")
                return
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                # Sanitize the content
                sanitized_content = sanitize_data(content)
                self.extracted_data['raw_text'].append(sanitized_content)
                self._extract_all_from_text(sanitized_content)
                
        except Exception as e:
            self.logger.warning(f"Could not process {file_path}: {e}")
    
    def _extract_all_from_text(self, text: str) -> None:
        """Extract all data types from text."""
        self._extract_dates(text)
        self._extract_names(text)
        self._extract_emails(text)
        self._extract_phone_numbers(text)
        self._extract_key_value_pairs(text)
        self._extract_standalone_numbers(text)
        self._extract_amounts(text)
    
    
    def _extract_dates(self, text: str) -> None:
        """Extract dates from text."""
        for pattern in self._compiled_patterns.get('dates', []):
            matches = pattern.findall(text)
            self.extracted_data['dates'].extend(matches)
    
    def _extract_names(self, text: str) -> None:
        """Extract potential names from text."""
        # Look for capitalized words that might be names
        # Pattern for consecutive capitalized words (likely names)
        name_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b'
        matches = re.findall(name_pattern, text)
        
        # Add all potential names
        for match in matches:
            # Filter out common non-name phrases
            if not any(word in match.lower() for word in ['january', 'february', 'march', 'april', 'may', 'june', 
                                                          'july', 'august', 'september', 'october', 'november', 'december',
                                                          'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']):
                self.extracted_data['potential_names'].append(sanitize_data(match))
        
        # Also extract from email addresses
        email_matches = re.findall(self._compiled_patterns['emails'][0], text)
        for email in email_matches:
            prefix = email.split('@')[0]
            # Handle common email formats
            if '.' in prefix:
                parts = prefix.split('.')
                if all(part.isalpha() for part in parts):
                    name = ' '.join(part.capitalize() for part in parts)
                    self.extracted_data['potential_names'].append(name)
            elif '_' in prefix:
                parts = prefix.split('_')
                if all(part.isalpha() for part in parts):
                    name = ' '.join(part.capitalize() for part in parts)
                    self.extracted_data['potential_names'].append(name)
    
    def _extract_emails(self, text: str) -> None:
        """Extract email addresses from text."""
        for pattern in self._compiled_patterns.get('emails', []):
            emails = pattern.findall(text)
            # Sanitize emails
            self.extracted_data['emails'].extend([sanitize_data(email) for email in emails])
    
    def _extract_phone_numbers(self, text: str) -> None:
        """Extract phone numbers from text."""
        for pattern in self._compiled_patterns.get('phones', []):
            phones = pattern.findall(text)
            self.extracted_data['phone_numbers'].extend(phones)
    
    def _extract_key_value_pairs(self, text: str) -> None:
        """Extract generic key-value pairs from text."""
        # Pattern for field: value or field - value
        patterns = [
            r'([A-Za-z][A-Za-z\s]{2,30}):\s*([^\n:]{1,100})',  # Field: Value
            r'([A-Za-z][A-Za-z\s]{2,30})\s*[-–—]\s*([^\n:]{1,100})',  # Field - Value
            r'([A-Za-z][A-Za-z\s]{2,30})\s*=\s*([^\n:]{1,100})',  # Field = Value
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for field, value in matches:
                # Clean up the field name and value
                field = field.strip().title()
                value = value.strip()
                
                # Skip if value is too short or looks like another field name
                if len(value) > 1 and not value.endswith(':'):
                    # Store all values for each field (might have duplicates)
                    if field not in self.extracted_data['key_value_pairs']:
                        self.extracted_data['key_value_pairs'][field] = []
                    self.extracted_data['key_value_pairs'][field].append(sanitize_data(value))
    
    def _extract_standalone_numbers(self, text: str) -> None:
        """Extract standalone numbers that might be IDs, codes, etc."""
        # Look for standalone numbers that might be important
        patterns = [
            r'\b(\d{4,20})\b',  # Numbers 4-20 digits long
            r'\b([A-Z]{1,3}\d{3,15})\b',  # Alphanumeric codes
            r'\b(\d{3}-\d{2}-\d{4})\b',  # SSN format
            r'\b([A-Z0-9]{6,20})\b',  # General alphanumeric codes
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            self.extracted_data['numbers'].extend(matches)
    
    def _extract_amounts(self, text: str) -> None:
        """Extract monetary amounts from text."""
        for pattern in self._compiled_patterns.get('amounts', []):
            amounts = pattern.findall(text)
            self.extracted_data['amounts'].extend(amounts)
    
    def add_custom_data(self, key: str, value: Any) -> None:
        """Add custom data to the extracted data."""
        self.extracted_data[key] = value
    
    def get_structured_data(self) -> Dict[str, Any]:
        """Return all extracted data in a generic format."""
        # Return all extracted data - let Claude figure out what maps to what
        return {
            'potential_names': self.extracted_data['potential_names'],
            'emails': self.extracted_data['emails'],
            'phone_numbers': self.extracted_data['phone_numbers'],
            'dates': self.extracted_data['dates'],
            'amounts': self.extracted_data['amounts'],
            'numbers': self.extracted_data['numbers'],
            'key_value_pairs': self.extracted_data['key_value_pairs'],
            'tables': self.extracted_data['tables'],
            'raw_text_snippets': self.extracted_data['raw_text'][:5] if self.extracted_data['raw_text'] else []  # First 5 text snippets
        }