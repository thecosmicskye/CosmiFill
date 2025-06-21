"""Tests for utility functions and custom exceptions."""
import pytest
from pathlib import Path
import tempfile
import os

from cosmifill.utils import (
    validate_path, sanitize_filename, sanitize_data, create_safe_directory,
    CosmiFillError, InvalidPathError, CosmiFillFileNotFoundError
)


class TestPathValidation:
    """Test path validation functions."""
    
    def test_valid_path(self, tmp_path):
        """Test validation of a valid path."""
        test_file = tmp_path / "test.pdf"
        test_file.write_text("test content")
        
        validated = validate_path(str(test_file))
        assert validated == test_file
        assert validated.is_absolute()
    
    def test_nonexistent_path_must_exist(self):
        """Test validation fails for non-existent path when must_exist=True."""
        with pytest.raises(CosmiFillFileNotFoundError):
            validate_path("/nonexistent/path.pdf", must_exist=True)
    
    def test_nonexistent_path_no_must_exist(self):
        """Test validation succeeds for non-existent path when must_exist=False."""
        path = validate_path("/tmp/future_file.pdf", must_exist=False)
        assert path.is_absolute()
    
    def test_path_traversal_detection(self):
        """Test detection of path traversal attempts."""
        with pytest.raises(InvalidPathError) as excinfo:
            validate_path("../../../etc/passwd")
        assert "Path traversal detected" in str(excinfo.value)
    
    def test_system_path_restriction(self):
        """Test restriction of system paths."""
        # Test specific restricted files
        restricted_files = ['/etc/passwd', '/etc/shadow', '/etc/hosts']
        for path in restricted_files:
            with pytest.raises(InvalidPathError) as excinfo:
                validate_path(path, must_exist=False)
            assert "Access to system file denied" in str(excinfo.value)
        
        # Test restricted directories
        restricted_dirs = ['/sys/test', '/proc/1/maps', '/root/secret']
        for path in restricted_dirs:
            with pytest.raises(InvalidPathError) as excinfo:
                validate_path(path, must_exist=False)
            assert "Access to system path denied" in str(excinfo.value)


class TestSanitization:
    """Test data sanitization functions."""
    
    def test_sanitize_filename_basic(self):
        """Test basic filename sanitization."""
        assert sanitize_filename("normal_file.pdf") == "normal_file.pdf"
        assert sanitize_filename("file with spaces.pdf") == "file with spaces.pdf"
    
    def test_sanitize_filename_dangerous_chars(self):
        """Test removal of dangerous characters."""
        assert sanitize_filename("file/with/slashes.pdf") == "file_with_slashes.pdf"
        assert sanitize_filename("file\\with\\backslashes.pdf") == "file_with_backslashes.pdf"
        assert sanitize_filename("file:with:colons.pdf") == "file_with_colons.pdf"
        assert sanitize_filename("file<>pipes|?.pdf") == "file__pipes__.pdf"
    
    def test_sanitize_filename_null_bytes(self):
        """Test removal of null bytes."""
        assert sanitize_filename("file\x00with\x00nulls.pdf") == "filewithnulls.pdf"
    
    def test_sanitize_filename_length_limit(self):
        """Test filename length limiting."""
        long_name = "a" * 300 + ".pdf"
        sanitized = sanitize_filename(long_name)
        assert len(sanitized) <= 255
        assert sanitized.endswith(".pdf")
    
    def test_sanitize_filename_empty(self):
        """Test handling of empty filenames."""
        assert sanitize_filename("") == "unnamed_file"
        assert sanitize_filename("   ") == "unnamed_file"
    
    def test_sanitize_data_basic(self):
        """Test basic data sanitization."""
        assert sanitize_data("Normal text") == "Normal text"
        assert sanitize_data("Text with\nnewlines") == "Text with\nnewlines"
        assert sanitize_data("Text with\ttabs") == "Text with\ttabs"
    
    def test_sanitize_data_null_bytes(self):
        """Test removal of null bytes from data."""
        assert sanitize_data("data\x00with\x00nulls") == "datawithnulls"
    
    def test_sanitize_data_control_chars(self):
        """Test removal of control characters."""
        # Control characters (except newline and tab) should be removed
        assert sanitize_data("text\x01with\x02control\x03chars") == "textwithcontrolchars"
        # But newlines and tabs should be preserved
        assert sanitize_data("text\nwith\nnewlines\tand\ttabs") == "text\nwith\nnewlines\tand\ttabs"
    
    def test_sanitize_data_length_limit(self):
        """Test data length limiting."""
        long_data = "a" * 2000
        sanitized = sanitize_data(long_data)
        assert len(sanitized) <= 1000
    
    def test_sanitize_data_non_string(self):
        """Test sanitization of non-string data."""
        assert sanitize_data(123) == "123"
        assert sanitize_data(True) == "True"
        assert sanitize_data(None) == "None"


class TestDirectoryCreation:
    """Test safe directory creation."""
    
    def test_create_safe_directory(self, tmp_path):
        """Test creation of a safe directory."""
        new_dir = tmp_path / "new_directory"
        created = create_safe_directory(str(new_dir))
        
        assert created.exists()
        assert created.is_dir()
        # Check that directory was created (permissions may vary by OS)
        assert created.stat().st_mode > 0
    
    def test_create_nested_directories(self, tmp_path):
        """Test creation of nested directories."""
        nested_dir = tmp_path / "parent" / "child" / "grandchild"
        created = create_safe_directory(str(nested_dir))
        
        assert created.exists()
        assert created.is_dir()
        assert (tmp_path / "parent").exists()
        assert (tmp_path / "parent" / "child").exists()
    
    def test_create_existing_directory(self, tmp_path):
        """Test handling of existing directory."""
        existing_dir = tmp_path / "existing"
        existing_dir.mkdir()
        
        # Should not raise an error
        created = create_safe_directory(str(existing_dir))
        assert created == existing_dir
    
    def test_create_directory_invalid_path(self):
        """Test creation fails with invalid path."""
        with pytest.raises(InvalidPathError):
            create_safe_directory("../../../etc/new_dir")


class TestCustomExceptions:
    """Test custom exception hierarchy."""
    
    def test_exception_hierarchy(self):
        """Test that all custom exceptions inherit from CosmiFillError."""
        from cosmifill.utils import (
            PDFAnalysisError, DataExtractionError, 
            PDFFillError, ClaudeIntegrationError
        )
        
        exceptions = [
            InvalidPathError("test"),
            CosmiFillFileNotFoundError("test"),
            PDFAnalysisError("test"),
            DataExtractionError("test"),
            PDFFillError("test"),
            ClaudeIntegrationError("test")
        ]
        
        for exc in exceptions:
            assert isinstance(exc, CosmiFillError)
            assert isinstance(exc, Exception)