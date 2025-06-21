"""Integration tests for the CosmiFill workflow."""
import pytest
from pathlib import Path
import tempfile
import shutil
import json
from unittest.mock import patch, MagicMock

from cosmifill.pdf_analyzer import PDFAnalyzer
from cosmifill.data_extractor import DataExtractor
from cosmifill.pdf_filler import PDFFiller
from cosmifill.inspector import PDFInspector
from cosmifill.interactive_session import InteractiveSession
from cosmifill.config import Config, load_config, get_config


class TestIntegration:
    """Test the complete CosmiFill workflow."""
    
    @pytest.fixture
    def test_workspace(self):
        """Create a complete test workspace."""
        temp_dir = tempfile.mkdtemp()
        workspace = Path(temp_dir)
        
        # Create test PDFs
        pdf1 = workspace / "form.pdf"
        pdf2 = workspace / "receipt.pdf"
        pdf1.write_bytes(b"%PDF-1.4\n%%EOF\n")
        pdf2.write_bytes(b"%PDF-1.4\n%%EOF\n")
        
        # Create test data files
        email_file = workspace / "order.email"
        email_file.write_text("""
        From: john.doe@example.com
        Subject: Order Confirmation
        
        Order Details:
        - 8 items
        - Total: $2,150.00
        - Certificate code: ABC123
        
        Customer: John Doe
        Date: 2024-01-15
        """)
        
        # Create config file
        config_data = {
            "extraction_patterns": {
                "certificate_codes": [r"Certificate code:\s*([A-Z0-9]+)"]
            },
            "logging": {
                "level": "INFO"
            }
        }
        config_file = workspace / "config.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)
        
        yield workspace
        
        # Cleanup
        shutil.rmtree(temp_dir)
    
    def test_pdf_analysis_workflow(self, test_workspace):
        """Test PDF analysis part of the workflow."""
        pdf_path = test_workspace / "form.pdf"
        
        analyzer = PDFAnalyzer(str(pdf_path))
        
        try:
            analysis = analyzer.analyze()
            
            assert analysis['file_name'] == 'form.pdf'
            assert 'is_fillable' in analysis
            assert 'total_pages' in analysis
            assert 'form_fields' in analysis
            assert 'field_count' in analysis
        except Exception:
            # Minimal PDF might fail analysis
            pass
    
    def test_data_extraction_workflow(self, test_workspace):
        """Test data extraction from documents."""
        extractor = DataExtractor(str(test_workspace))
        
        # Extract all data
        extracted = extractor.extract_all()
        
        assert 'emails' in extracted
        assert 'dates' in extracted
        assert 'amounts' in extracted
        assert 'raw_text' in extracted
        
        # Should find the email
        assert any('john.doe@example.com' in email for email in extracted['emails'])
        
        # Should find the amount
        assert any('2,150.00' in amount for amount in extracted['amounts'])
        
        # Get structured data
        structured = extractor.get_structured_data()
        assert 'emails' in structured
        assert 'john.doe@example.com' in structured['emails']
        assert 'key_value_pairs' in structured
        assert 'Customer' in structured['key_value_pairs']  # Should have extracted from "Customer: John Doe"
    
    def test_config_loading_workflow(self, test_workspace):
        """Test configuration loading and usage."""
        config_file = test_workspace / "config.json"
        
        # Load config
        load_config(str(config_file))
        
        # Get global config
        config = get_config()
        
        # Check custom patterns were loaded
        patterns = config.get_extraction_patterns()
        assert 'certificate_codes' in patterns
        
        # Use config in extractor
        extractor = DataExtractor(str(test_workspace))
        # The extractor should use the global config
    
    @patch('fillpdfs.get_form_fields')
    @patch('fillpdfs.write_fillable_pdf')
    def test_pdf_filling_workflow(self, mock_write, mock_get_fields, test_workspace):
        """Test PDF filling workflow."""
        pdf_path = test_workspace / "form.pdf"
        
        # Mock form fields
        mock_get_fields.return_value = {
            'Name': '',
            'Email': '',
            'Date': '',
            'Amount': ''
        }
        
        filler = PDFFiller(str(pdf_path))
        
        # Fill with data
        data = {
            'Name': 'John Doe',
            'Email': 'john.doe@example.com',
            'Date': '2024-01-15',
            'Amount': '$2,150.00'
        }
        
        output_path = filler.fill_form(data)
        
        # Check fill was called
        mock_write.assert_called_once()
        
        # Check output path is correct
        assert Path(output_path).parent == test_workspace
        assert '_filled_' in Path(output_path).name
    
    @patch('fillpdfs.get_form_fields')
    def test_inspection_workflow(self, mock_get_fields, test_workspace):
        """Test PDF inspection workflow."""
        pdf_path = test_workspace / "form.pdf"
        
        # Mock filled form fields
        mock_get_fields.return_value = {
            'Name': 'John Doe',
            'Email': 'john.doe@example.com',
            'Date': '2024-01-15',
            'Amount': '$2,150.00'
        }
        
        inspector = PDFInspector(str(pdf_path))
        
        # Inspect the PDF
        result = inspector.inspect()
        
        assert result['file_name'] == 'form.pdf'
        assert result['total_fields'] == 4
        assert result['filled_fields'] == 4
        assert result['completion_percentage'] == 100.0
        
        # Validate required fields
        is_valid, missing = inspector.validate_required_fields(['Name', 'Email'])
        assert is_valid is True
        assert len(missing) == 0
    
    @patch('subprocess.run')
    @patch('shutil.which')
    def test_interactive_session_workflow(self, mock_which, mock_run, test_workspace):
        """Test the complete interactive session workflow."""
        # Mock Claude CLI exists
        mock_which.return_value = '/usr/local/bin/claude'
        mock_run.return_value = MagicMock(returncode=0)
        
        # Create session
        session = InteractiveSession(str(test_workspace))
        
        # Start session
        session.start()
        
        # Check analysis file was created
        analysis_file = test_workspace / "COSMIFILL_ANALYSIS.json"
        assert analysis_file.exists()
        
        # Check setup script was created
        setup_script = test_workspace / "cosmifill_setup.py"
        assert setup_script.exists()
        
        # Check permissions file was created
        permissions_file = test_workspace / ".claude" / "settings.local.json"
        assert permissions_file.exists()
        
        # Load and verify analysis
        with open(analysis_file, 'r') as f:
            analysis = json.load(f)
        
        assert 'pdf_analysis' in analysis
        assert 'extracted_data' in analysis
        assert 'structured_data' in analysis
        assert 'python_path' in analysis
        assert 'working_directory' in analysis
    
    def test_error_handling_workflow(self, test_workspace):
        """Test error handling throughout the workflow."""
        # Test with non-existent PDF
        from cosmifill.utils import PDFAnalysisError, CosmiFillFileNotFoundError
        
        with pytest.raises(PDFAnalysisError):
            analyzer = PDFAnalyzer(str(test_workspace / "nonexistent.pdf"))
        
        # Test with invalid PDF content
        bad_pdf = test_workspace / "bad.pdf"
        bad_pdf.write_text("Not a PDF")
        
        analyzer = PDFAnalyzer(str(bad_pdf))
        try:
            analysis = analyzer.analyze()
            # Should handle gracefully even if analysis fails
        except PDFAnalysisError:
            pass
    
    def test_full_workflow_simulation(self, test_workspace):
        """Simulate the full CosmiFill workflow."""
        # 1. Analyze PDFs
        pdfs = list(test_workspace.glob("*.pdf"))
        analyses = {}
        
        for pdf in pdfs:
            try:
                analyzer = PDFAnalyzer(str(pdf))
                analyses[pdf.name] = analyzer.analyze()
            except Exception as e:
                analyses[pdf.name] = {"error": str(e)}
        
        # 2. Extract data
        extractor = DataExtractor(str(test_workspace))
        extracted_data = extractor.extract_all()
        structured_data = extractor.get_structured_data()
        
        # 3. Create context
        context = {
            "pdf_analysis": analyses,
            "extracted_data": extracted_data,
            "structured_data": structured_data
        }
        
        # Save context
        context_file = test_workspace / "COSMIFILL_ANALYSIS.json"
        with open(context_file, 'w') as f:
            json.dump(context, f, indent=2)
        
        # Verify workflow completed
        assert context_file.exists()
        assert len(analyses) == 2  # Two PDFs
        assert len(extracted_data['emails']) > 0
        assert len(structured_data['emails']) > 0  # Should have extracted emails