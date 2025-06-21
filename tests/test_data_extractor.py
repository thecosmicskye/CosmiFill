"""Tests for data extractor module."""
import pytest
from pathlib import Path
import tempfile
from unittest.mock import Mock, patch

from cosmifill.data_extractor import DataExtractor
from cosmifill.utils import DataExtractionError


class TestDataExtractor:
    """Test data extraction functionality."""
    
    @pytest.fixture
    def sample_folder(self, tmp_path):
        """Create a sample folder with test files."""
        # Create test text file
        txt_file = tmp_path / "info.txt"
        txt_file.write_text("""
        Customer Information:
        Name: John Doe
        Email: john.doe@example.com
        Phone: 555-123-4567
        Order ID: ORD123456789
        
        Order placed on: Aug 15, 2024
        Total amount: $150.00
        Reference: REF2024081501
        """)
        
        # Create test email file
        email_file = tmp_path / "order.email"
        email_file.write_text("""
        From: support@company.com
        To: jane.smith@example.com
        Date: 2024-08-20
        
        Dear Jane Smith,
        
        Your order for $2,150.00 has been confirmed.
        Order date: August 20, 2024
        """)
        
        return tmp_path
    
    def test_init_valid_folder(self, sample_folder):
        """Test initialization with valid folder."""
        extractor = DataExtractor(str(sample_folder))
        assert extractor.folder_path == sample_folder
        assert extractor.extracted_data == {}
    
    def test_init_nonexistent_folder(self):
        """Test initialization with non-existent folder."""
        with pytest.raises(DataExtractionError) as excinfo:
            DataExtractor("/nonexistent/folder")
        assert "Invalid folder path" in str(excinfo.value)
    
    def test_init_file_instead_of_folder(self, tmp_path):
        """Test initialization with file instead of folder."""
        file_path = tmp_path / "file.txt"
        file_path.write_text("test")
        
        with pytest.raises(DataExtractionError) as excinfo:
            DataExtractor(str(file_path))
        assert "Path is not a directory" in str(excinfo.value)
    
    def test_extract_all_basic(self, sample_folder):
        """Test basic extraction from all files."""
        extractor = DataExtractor(str(sample_folder))
        data = extractor.extract_all()
        
        # Check structure
        assert 'dates' in data
        assert 'potential_names' in data
        assert 'emails' in data
        assert 'phone_numbers' in data
        assert 'amounts' in data
        assert 'key_value_pairs' in data
        assert 'numbers' in data
        assert 'raw_text' in data
        
        # Check extracted data
        assert len(data['emails']) > 0
        assert 'john.doe@example.com' in data['emails']
        assert 'jane.smith@example.com' in data['emails']
        
        assert len(data['phone_numbers']) > 0
        assert '555-123-4567' in data['phone_numbers']
        
        assert len(data['amounts']) > 0
        assert '150.00' in data['amounts']
        assert '2,150.00' in data['amounts']
        
        assert len(data['dates']) > 0
        
        # Check key-value pairs were extracted
        assert 'key_value_pairs' in data
        assert 'Customer Information' in data['key_value_pairs'] or 'Name' in data['key_value_pairs']
        
        # Check numbers were extracted (like order ID)
        assert len(data['numbers']) > 0
        assert any('123456789' in num for num in data['numbers'])
    
    def test_extract_names_from_email(self, sample_folder):
        """Test name extraction from email addresses."""
        extractor = DataExtractor(str(sample_folder))
        data = extractor.extract_all()
        
        # Should extract potential names
        assert len(data['potential_names']) > 0
        # Should extract names from the content
        assert any('John Doe' in name for name in data['potential_names'])
        assert any('Jane Smith' in name for name in data['potential_names'])
    
    def test_custom_patterns(self, sample_folder):
        """Test extraction with custom patterns."""
        custom_patterns = {
            'dates': [r'\b\d{4}-\d{2}-\d{2}\b'],  # Only ISO dates
            'emails': [r'\b[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}\b'],
            'phones': [r'\b\d{3}-\d{3}-\d{4}\b'],  # Only XXX-XXX-XXXX format
            'amounts': [r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)']}
        
        extractor = DataExtractor(str(sample_folder), patterns=custom_patterns)
        data = extractor.extract_all()
        
        # Check that we found the expected date format (2024-08-20)
        assert '2024-08-20' in data['dates']
        # And that we only found phone numbers in the specific format
        assert '555-123-4567' in data['phone_numbers']
    
    def test_sanitization(self, tmp_path):
        """Test that extracted data is sanitized."""
        # Create file with problematic content
        bad_file = tmp_path / "bad_data.txt"
        bad_file.write_text("Email: test\\x00user@example.com\\x00")
        
        extractor = DataExtractor(str(tmp_path))
        data = extractor.extract_all()
        
        # Null bytes should be removed
        for email in data['emails']:
            assert '\\x00' not in email
    
    @patch('pdfplumber.open')
    def test_pdf_extraction(self, mock_pdfplumber, sample_folder):
        """Test extraction from PDF files."""
        # Create a fake PDF file
        pdf_file = sample_folder / "document.pdf"
        pdf_file.write_bytes(b"%PDF-1.4")
        
        # Mock pdfplumber
        mock_page = Mock()
        mock_page.extract_text.return_value = "PDF Content: Amount $500.00"
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=None)
        mock_pdfplumber.return_value = mock_pdf
        
        extractor = DataExtractor(str(sample_folder))
        data = extractor.extract_all()
        
        # Should extract from PDF
        assert '500.00' in data['amounts']
    
    def test_get_structured_data(self, sample_folder):
        """Test structured data output."""
        extractor = DataExtractor(str(sample_folder))
        extractor.extract_all()
        
        structured = extractor.get_structured_data()
        
        assert 'potential_names' in structured
        assert 'emails' in structured
        assert 'phone_numbers' in structured
        assert 'dates' in structured
        assert 'amounts' in structured
        assert 'numbers' in structured
        assert 'key_value_pairs' in structured
        assert 'tables' in structured
        assert 'raw_text_snippets' in structured
    
    def test_add_custom_data(self, sample_folder):
        """Test adding custom data."""
        extractor = DataExtractor(str(sample_folder))
        extractor.extract_all()
        
        # Add custom data
        custom_dates = ['2024-09-01', '2024-09-08', '2024-09-15', '2024-09-22']
        extractor.add_custom_data('service_dates', custom_dates)
        
        assert extractor.extracted_data['service_dates'] == custom_dates
        
        # Add another custom field
        extractor.add_custom_data('reference_number', 'REF123456')
        assert extractor.extracted_data['reference_number'] == 'REF123456'
    
    def test_error_handling(self, tmp_path):
        """Test error handling during extraction."""
        # Create a file that will cause read errors
        bad_file = tmp_path / "unreadable.txt"
        bad_file.write_text("test")
        bad_file.chmod(0o000)  # Remove all permissions
        
        extractor = DataExtractor(str(tmp_path))
        # Should handle error gracefully
        data = extractor.extract_all()
        
        # Restore permissions for cleanup
        bad_file.chmod(0o644)