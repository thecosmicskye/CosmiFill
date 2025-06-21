"""Utility functions and custom exceptions for CosmiFill."""
import os
from pathlib import Path
from typing import Union, Optional
import re

# Constants for security and validation
RESTRICTED_PREFIXES = ['/etc', '/sys', '/proc', '/root', '/dev', '/private/etc']
RESTRICTED_FILES = [
    '/etc/passwd', '/etc/shadow', '/etc/hosts',
    '/private/etc/passwd', '/private/etc/shadow', '/private/etc/hosts'
]
MAX_FIELD_LENGTH = 1000
MAX_FILENAME_LENGTH = 255


class CosmiFillError(Exception):
    """Base exception for CosmiFill errors."""
    pass


class CosmiFillFileNotFoundError(CosmiFillError):
    """Raised when a required file is not found."""
    pass


class InvalidPathError(CosmiFillError):
    """Raised when a path is invalid or potentially malicious."""
    pass


class PDFAnalysisError(CosmiFillError):
    """Raised when PDF analysis fails."""
    pass


class DataExtractionError(CosmiFillError):
    """Raised when data extraction fails."""
    pass


class PDFFillError(CosmiFillError):
    """Raised when PDF filling fails."""
    pass


class ClaudeIntegrationError(CosmiFillError):
    """Raised when Claude CLI integration fails."""
    pass


def validate_path(path: Union[str, Path], must_exist: bool = True) -> Path:
    """
    Validate and sanitize a file path to prevent path traversal attacks.
    
    Args:
        path: The path to validate
        must_exist: Whether the path must exist
        
    Returns:
        A validated Path object
        
    Raises:
        InvalidPathError: If the path is invalid or potentially malicious
        FileNotFoundError: If must_exist is True and the path doesn't exist
    """
    # Check for path traversal attempts BEFORE resolving
    if ".." in str(path):
        raise InvalidPathError(f"Path traversal detected in: {path}")
    
    # Check restricted paths BEFORE resolving (to catch symlinks)
    path_str = str(Path(path))
    
    # Be strict about system paths - deny access even if they exist
    
    # Check for specific restricted files first
    if path_str in RESTRICTED_FILES:
        raise InvalidPathError(f"Access to system file denied: {path}")
    
    # Check if path starts with any restricted prefix
    for restricted in RESTRICTED_PREFIXES:
        if path_str == restricted or path_str.startswith(restricted + '/'):
            raise InvalidPathError(f"Access to system path denied: {path}")
    
    try:
        # Now resolve to absolute path
        path_obj = Path(path).resolve()
        
        # Check again after resolution (in case of symlinks)
        resolved_str = str(path_obj)
        if resolved_str in RESTRICTED_FILES:
            raise InvalidPathError(f"Access to system file denied: {path}")
        
        for restricted in RESTRICTED_PREFIXES:
            if resolved_str == restricted or resolved_str.startswith(restricted + '/'):
                raise InvalidPathError(f"Access to system path denied: {path}")
        
        # Additional check: ensure path is not a symlink to restricted location
        if path_obj.is_symlink():
            real_path = path_obj.resolve(strict=True)
            real_str = str(real_path)
            if real_str in RESTRICTED_FILES:
                raise InvalidPathError(f"Symlink points to system file: {path}")
            for restricted in RESTRICTED_PREFIXES:
                if real_str == restricted or real_str.startswith(restricted + '/'):
                    raise InvalidPathError(f"Symlink points to system path: {path}")
        
        # Check existence if required
        if must_exist and not path_obj.exists():
            raise CosmiFillFileNotFoundError(f"Path does not exist: {path}")
        
        return path_obj
        
    except (ValueError, OSError) as e:
        raise InvalidPathError(f"Invalid path: {path} - {str(e)}")


def sanitize_error_message(message: str) -> str:
    """Sanitize error messages to avoid exposing sensitive paths.
    
    Args:
        message: The error message to sanitize
        
    Returns:
        Sanitized error message
    """
    # Replace absolute paths with relative indicators
    import re
    
    # Pattern to match absolute paths
    path_pattern = r'(/[^\s"]+|[A-Z]:\\[^\s"]+)'
    
    def replace_path(match):
        path = match.group(0)
        # Keep only the filename if it's a file
        if '.' in path.split('/')[-1]:
            return f"<file:{path.split('/')[-1]}>"
        else:
            return "<path>"
    
    sanitized = re.sub(path_pattern, replace_path, message)
    
    # Remove any remaining sensitive patterns
    sanitized = re.sub(r'/Users/[^/]+/', '<user>/', sanitized)
    sanitized = re.sub(r'C:\\Users\\[^\\]+\\', r'<user>\\', sanitized)
    
    return sanitized


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to remove potentially dangerous characters.
    
    Args:
        filename: The filename to sanitize
        
    Returns:
        A sanitized filename safe for filesystem use
    """
    # Remove path separators and null bytes
    filename = filename.replace('/', '_').replace('\\', '_').replace('\0', '')
    
    # Remove other potentially problematic characters
    filename = re.sub(r'[<>:"|?*]', '_', filename)
    
    # Limit length to prevent filesystem issues
    if len(filename) > MAX_FILENAME_LENGTH:
        # Keep extension if present
        name, ext = os.path.splitext(filename)
        if ext:
            max_name_length = MAX_FILENAME_LENGTH - len(ext)
            filename = name[:max_name_length] + ext
        else:
            filename = filename[:MAX_FILENAME_LENGTH]
    
    # Ensure filename is not empty
    if not filename or filename.strip() == '':
        filename = 'unnamed_file'
    
    return filename


def sanitize_data(data: str) -> str:
    """
    Sanitize data to prevent injection attacks when filling PDFs.
    
    Args:
        data: The data to sanitize
        
    Returns:
        Sanitized data safe for PDF forms
    """
    if not isinstance(data, str):
        return str(data)
    
    # Remove null bytes
    data = data.replace('\0', '')
    
    # Limit length to prevent buffer overflows
    if len(data) > MAX_FIELD_LENGTH:
        data = data[:MAX_FIELD_LENGTH]
    
    # Remove control characters except newlines and tabs
    data = ''.join(char for char in data if char == '\n' or char == '\t' or 
                   (ord(char) >= 32 and ord(char) <= 126) or ord(char) >= 128)
    
    return data


def create_safe_directory(directory: Union[str, Path]) -> Path:
    """
    Create a directory safely with proper permissions.
    
    Args:
        directory: The directory path to create
        
    Returns:
        The created directory path
        
    Raises:
        InvalidPathError: If the directory path is invalid
    """
    dir_path = validate_path(directory, must_exist=False)
    
    try:
        # Create directory with safe permissions (755)
        dir_path.mkdir(parents=True, exist_ok=True, mode=0o755)
        return dir_path
    except OSError as e:
        raise InvalidPathError(f"Failed to create directory: {directory} - {str(e)}")