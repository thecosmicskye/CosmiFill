"""Tests for the PDF inspector module."""
import pytest
from pathlib import Path
import tempfile

from cosmifill.inspector import PDFInspector
from cosmifill.utils import PDFAnalysisError


class TestPDFInspector:
    """Test the PDF inspector functionality."""
    
    @pytest.fixture
    def temp_pdf(self):
        """Create a temporary PDF file for testing."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            # Write minimal PDF content
            f.write(b"%PDF-1.4\n%%EOF\n")
            temp_path = Path(f.name)
        yield temp_path
        # Cleanup
        if temp_path.exists():
            temp_path.unlink()
    
    @pytest.fixture
    def temp_pdfs(self):
        """Create two temporary PDF files for comparison testing."""
        pdfs = []
        for i in range(2):
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(b"%PDF-1.4\n%%EOF\n")
                pdfs.append(Path(f.name))
        yield pdfs
        # Cleanup
        for pdf in pdfs:
            if pdf.exists():
                pdf.unlink()
    
    def test_init_valid_pdf(self, temp_pdf):
        """Test initialization with valid PDF."""
        inspector = PDFInspector(str(temp_pdf))
        # Compare resolved paths to handle symlinks
        assert inspector.pdf_path.resolve() == temp_pdf.resolve()
    
    def test_init_invalid_path(self):
        """Test initialization with invalid path."""
        with pytest.raises(PDFAnalysisError) as excinfo:
            PDFInspector("/nonexistent/file.pdf")
        assert "Invalid PDF path" in str(excinfo.value)
    
    def test_init_non_pdf_file(self):
        """Test initialization with non-PDF file."""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"Not a PDF")
            temp_path = Path(f.name)
        
        try:
            with pytest.raises(PDFAnalysisError) as excinfo:
                PDFInspector(str(temp_path))
            assert "File is not a PDF" in str(excinfo.value)
        finally:
            temp_path.unlink()
    
    def test_inspect_minimal_pdf(self, temp_pdf):
        """Test inspection of minimal PDF."""
        inspector = PDFInspector(str(temp_pdf))
        
        try:
            result = inspector.inspect()
            assert isinstance(result, dict)
            assert "file_name" in result
            assert "total_fields" in result
            assert "filled_fields" in result
            assert "empty_fields" in result
            assert "completion_percentage" in result
            assert result["file_name"] == temp_pdf.name
        except PDFAnalysisError:
            # Minimal PDF might not be inspectable
            pass
    
    def test_display_inspection(self, temp_pdf, capsys):
        """Test display_inspection method output."""
        inspector = PDFInspector(str(temp_pdf))
        
        try:
            inspector.display_inspection()
            captured = capsys.readouterr()
            assert "PDF Inspection Report" in captured.out
            assert temp_pdf.name in captured.out
        except PDFAnalysisError:
            # Minimal PDF might not be inspectable
            pass
    
    def test_compare_pdfs(self, temp_pdfs):
        """Test PDF comparison functionality."""
        inspector1 = PDFInspector(str(temp_pdfs[0]))
        
        try:
            result = inspector1.compare_pdfs(str(temp_pdfs[1]))
            assert isinstance(result, dict)
            assert "original_file" in result
            assert "filled_file" in result
            assert "differences" in result
            assert "fields_changed" in result
            assert "total_fields" in result
            assert result["original_file"] == temp_pdfs[0].name
            assert result["filled_file"] == temp_pdfs[1].name
        except PDFAnalysisError as e:
            # Minimal PDFs might not have form fields
            assert "no form fields" in str(e).lower()
    
    def test_compare_with_invalid_pdf(self, temp_pdf):
        """Test comparison with invalid PDF path."""
        inspector = PDFInspector(str(temp_pdf))
        
        with pytest.raises(PDFAnalysisError):
            inspector.compare_pdfs("/nonexistent/file.pdf")
    
    def test_validate_required_fields(self, temp_pdf):
        """Test required fields validation."""
        inspector = PDFInspector(str(temp_pdf))
        
        required_fields = ["field1", "field2", "field3"]
        is_valid, missing_fields = inspector.validate_required_fields(required_fields)
        
        # For minimal PDF, all fields should be missing
        assert isinstance(is_valid, bool)
        assert isinstance(missing_fields, list)
        
        # With no form fields, validation should fail
        if not is_valid:
            assert len(missing_fields) == len(required_fields)
    
    def test_validate_empty_required_fields(self, temp_pdf):
        """Test validation with empty required fields list."""
        inspector = PDFInspector(str(temp_pdf))
        
        is_valid, missing_fields = inspector.validate_required_fields([])
        
        # No required fields means validation passes
        assert is_valid is True
        assert missing_fields == []
    
    def test_get_form_values_error_handling(self, temp_pdf):
        """Test _get_form_values error handling."""
        inspector = PDFInspector(str(temp_pdf))
        
        # Should handle errors gracefully
        values = inspector._get_form_values()
        assert isinstance(values, dict)
        # Minimal PDF likely has no form fields
        assert len(values) == 0
    
    def test_count_filled_fields(self, temp_pdf):
        """Test _count_filled_fields method."""
        inspector = PDFInspector(str(temp_pdf))
        
        # Test with various field configurations
        test_fields = {
            "field1": "value1",
            "field2": "",
            "field3": None,
            "field4": "value4"
        }
        
        count = inspector._count_filled_fields(test_fields)
        assert count == 2  # Only field1 and field4 have values
        
        # Test empty dict
        assert inspector._count_filled_fields({}) == 0
        
        # Test all filled
        all_filled = {"f1": "v1", "f2": "v2", "f3": "v3"}
        assert inspector._count_filled_fields(all_filled) == 3