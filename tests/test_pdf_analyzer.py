"""Tests for PDF analyzer module."""
import pytest
from pathlib import Path
import tempfile
from unittest.mock import Mock, patch

from cosmifill.pdf_analyzer import PDFAnalyzer
from cosmifill.utils import PDFAnalysisError


class TestPDFAnalyzer:
    """Test PDF analyzer functionality."""
    
    @pytest.fixture
    def sample_pdf(self, tmp_path):
        """Create a sample PDF file for testing."""
        pdf_file = tmp_path / "test_form.pdf"
        # Create a minimal PDF content (PDF header)
        pdf_file.write_bytes(b"%PDF-1.4\n")
        return pdf_file
    
    def test_init_valid_pdf(self, sample_pdf):
        """Test initialization with valid PDF."""
        analyzer = PDFAnalyzer(str(sample_pdf))
        assert analyzer.pdf_path == sample_pdf
        assert analyzer.form_fields == {}
        assert analyzer.text_content == []
        assert analyzer.is_fillable is False
        assert analyzer.total_pages == 0
    
    def test_init_nonexistent_pdf(self):
        """Test initialization with non-existent PDF."""
        with pytest.raises(PDFAnalysisError) as excinfo:
            PDFAnalyzer("/nonexistent/file.pdf")
        assert "Invalid PDF path" in str(excinfo.value)
    
    def test_init_non_pdf_file(self, tmp_path):
        """Test initialization with non-PDF file."""
        txt_file = tmp_path / "not_a_pdf.txt"
        txt_file.write_text("This is not a PDF")
        
        with pytest.raises(PDFAnalysisError) as excinfo:
            PDFAnalyzer(str(txt_file))
        assert "File is not a PDF" in str(excinfo.value)
    
    @patch('cosmifill.pdf_analyzer.fillpdfs.get_form_fields')
    @patch('cosmifill.pdf_analyzer.pdfplumber.open')
    @patch('cosmifill.pdf_analyzer.PyPDF2.PdfReader')
    def test_analyze_fillable_pdf(self, mock_reader, mock_pdfplumber, mock_get_fields, sample_pdf):
        """Test analysis of a fillable PDF."""
        # Mock form fields
        mock_get_fields.return_value = {
            "Name": "",
            "Email": "",
            "Date": ""
        }
        
        # Mock PDF reader for fillable check
        mock_pdf_reader = Mock()
        mock_pdf_reader.trailer = {'/Root': {'/AcroForm': {}}}
        mock_reader.return_value = mock_pdf_reader
        
        # Mock pdfplumber for text extraction
        mock_page = Mock()
        mock_page.extract_text.return_value = "Sample PDF Content\nWith multiple lines"
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=None)
        mock_pdfplumber.return_value = mock_pdf
        
        analyzer = PDFAnalyzer(str(sample_pdf))
        result = analyzer.analyze()
        
        assert result['file_name'] == 'test_form.pdf'
        assert result['is_fillable'] is True
        assert result['field_count'] == 3
        assert 'Name' in result['form_fields']
        assert result['total_pages'] == 1
        assert len(result['text_preview']) > 0
    
    @patch('cosmifill.pdf_analyzer.fillpdfs.get_form_fields')
    def test_analyze_with_extraction_error(self, mock_get_fields, sample_pdf):
        """Test analysis handles extraction errors gracefully."""
        # Make form field extraction fail
        mock_get_fields.side_effect = Exception("Extraction failed")
        
        analyzer = PDFAnalyzer(str(sample_pdf))
        # Should log warning but not crash
        analyzer._extract_form_fields()
        assert analyzer.form_fields == {}
    
    def test_get_required_fields(self, sample_pdf):
        """Test getting list of required fields."""
        analyzer = PDFAnalyzer(str(sample_pdf))
        analyzer.form_fields = {
            "Name": "",
            "Email": "",
            "Phone": ""
        }
        
        required = analyzer.get_required_fields()
        assert len(required) == 3
        assert "Name" in required
        assert "Email" in required
        assert "Phone" in required
    
    def test_suggest_field_mappings(self, sample_pdf):
        """Test field mapping suggestions."""
        analyzer = PDFAnalyzer(str(sample_pdf))
        analyzer.form_fields = {
            "First Name": "",
            "Last Name": "",
            "Date of Birth": "",
            "ID Number": ""
        }
        
        context_data = {
            "first_name": "John",
            "last_name": "Doe",
            "dob": "01/01/1990",
            "id_number": "12345"
        }
        
        mappings = analyzer.suggest_field_mappings(context_data)
        
        # Should match based on common variations
        assert mappings.get("First Name") == "John"
        assert mappings.get("Last Name") == "Doe"
        assert mappings.get("Date of Birth") == "01/01/1990"
        assert mappings.get("ID Number") == "12345"
    
    def test_suggest_field_mappings_case_insensitive(self, sample_pdf):
        """Test field mapping is case insensitive."""
        analyzer = PDFAnalyzer(str(sample_pdf))
        analyzer.form_fields = {
            "FIRST NAME": "",
            "last name": ""
        }
        
        context_data = {
            "first_name": "Jane",
            "LAST_NAME": "Smith"
        }
        
        mappings = analyzer.suggest_field_mappings(context_data)
        
        # Should handle case variations
        assert len(mappings) > 0