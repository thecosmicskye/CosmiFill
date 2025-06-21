"""CosmiFill - Automated PDF form filling tool.

A generic PDF form filling tool that pre-analyzes PDFs and documents,
then launches Claude Code to intelligently fill forms.
"""

__version__ = "1.0.0"
__author__ = "CosmiFill"

from cosmifill.pdf_analyzer import PDFAnalyzer
from cosmifill.data_extractor import DataExtractor
from cosmifill.pdf_filler import PDFFiller
from cosmifill.inspector import PDFInspector
from cosmifill.interactive_session import InteractiveSession

# Custom exceptions
from cosmifill.utils import (
    CosmiFillError,
    CosmiFillFileNotFoundError,
    InvalidPathError,
    PDFAnalysisError,
    DataExtractionError,
    PDFFillError,
    ClaudeIntegrationError
)

__all__ = [
    # Main classes
    'PDFAnalyzer',
    'DataExtractor',
    'PDFFiller',
    'PDFInspector',
    'InteractiveSession',
    
    # Exceptions
    'CosmiFillError',
    'CosmiFillFileNotFoundError',
    'InvalidPathError',
    'PDFAnalysisError',
    'DataExtractionError',
    'PDFFillError',
    'ClaudeIntegrationError',
    
    # Version info
    '__version__',
    '__author__'
]