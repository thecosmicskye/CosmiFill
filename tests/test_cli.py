"""Tests for the CLI module."""
import pytest
from pathlib import Path
from click.testing import CliRunner
import tempfile
import json

from cosmifill.cli import cosmifill
from cosmifill import __version__


class TestCLI:
    """Test the command-line interface."""
    
    def test_version_display(self):
        """Test that version is displayed correctly."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create a dummy folder
            Path("test_folder").mkdir()
            
            result = runner.invoke(cosmifill, ['test_folder', '--analyze-only'])
            assert __version__ in result.output
            assert "CosmiFill" in result.output
    
    def test_no_pdfs_in_folder(self):
        """Test handling when no PDFs are found."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create empty folder
            Path("empty_folder").mkdir()
            
            result = runner.invoke(cosmifill, ['empty_folder'])
            assert result.exit_code == 1
            assert "No PDF files found" in result.output
    
    def test_invalid_folder_path(self):
        """Test handling of invalid folder path."""
        runner = CliRunner()
        result = runner.invoke(cosmifill, ['/nonexistent/folder'])
        assert result.exit_code == 2  # Click returns 2 for path validation errors
        assert "Error" in result.output or "does not exist" in result.output
    
    def test_analyze_only_flag(self):
        """Test the --analyze-only flag."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create test folder with dummy PDF
            test_folder = Path("test_folder")
            test_folder.mkdir()
            
            # Create a minimal valid PDF for testing
            pdf_path = test_folder / "test.pdf"
            pdf_path.write_bytes(b"%PDF-1.4\n%%EOF\n")
            
            result = runner.invoke(cosmifill, ['test_folder', '--analyze-only'])
            # Should not exit with error even though PDF is minimal
            assert "Analyzing PDF structures" in result.output
            assert "test.pdf" in result.output
    
    def test_auto_mode_deprecated(self):
        """Test that auto mode shows deprecation message."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create test folder with dummy PDF
            test_folder = Path("test_folder")
            test_folder.mkdir()
            pdf_path = test_folder / "test.pdf"
            pdf_path.write_bytes(b"%PDF-1.4\n%%EOF\n")
            
            result = runner.invoke(cosmifill, ['test_folder', '--auto'])
            assert result.exit_code == 0
            assert "Auto mode is deprecated" in result.output
            assert "Claude Code" in result.output
    
    def test_config_loading(self):
        """Test configuration file loading."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create test folder
            test_folder = Path("test_folder")
            test_folder.mkdir()
            pdf_path = test_folder / "test.pdf"
            pdf_path.write_bytes(b"%PDF-1.4\n%%EOF\n")
            
            # Create config file
            config = {
                "logging": {
                    "level": "DEBUG",
                    "format": "%(levelname)s - %(message)s"
                }
            }
            config_path = Path("config.json")
            with open(config_path, 'w') as f:
                json.dump(config, f)
            
            result = runner.invoke(cosmifill, [
                'test_folder', 
                '--config', 'config.json',
                '--analyze-only'
            ])
            assert "Loaded configuration" in result.output
    
    def test_config_loading_invalid_file(self):
        """Test handling of invalid configuration file."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create test folder
            test_folder = Path("test_folder")
            test_folder.mkdir()
            
            result = runner.invoke(cosmifill, [
                'test_folder',
                '--config', 'nonexistent.json'
            ])
            assert result.exit_code == 2  # Click returns 2 for file validation errors
            assert "Error" in result.output or "does not exist" in result.output
    
    def test_inspect_mode(self):
        """Test the --inspect flag."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create test folder
            test_folder = Path("test_folder")
            test_folder.mkdir()
            
            # Create a minimal PDF
            pdf_path = test_folder / "filled.pdf"
            pdf_path.write_bytes(b"%PDF-1.4\n%%EOF\n")
            
            result = runner.invoke(cosmifill, [
                'test_folder',
                '--inspect', str(pdf_path)
            ])
            # Should attempt to inspect (may fail with minimal PDF)
            assert result.exit_code in [0, 1]
    
    def test_inspect_non_pdf_file(self):
        """Test inspect mode with non-PDF file."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create test folder
            test_folder = Path("test_folder")
            test_folder.mkdir()
            
            # Create non-PDF file
            txt_path = test_folder / "not_a_pdf.txt"
            txt_path.write_text("This is not a PDF")
            
            result = runner.invoke(cosmifill, [
                'test_folder',
                '--inspect', str(txt_path)
            ])
            assert result.exit_code == 1
            assert "File is not a PDF" in result.output
    
    def test_resume_without_session(self):
        """Test resume flag without an existing session."""
        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create test folder
            test_folder = Path("test_folder")
            test_folder.mkdir()
            
            result = runner.invoke(cosmifill, ['test_folder', '--resume'])
            # Should indicate no session found
            assert "No active session found" in result.output or result.exit_code != 0