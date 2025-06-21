"""Tests for the interactive session module."""
import pytest
from pathlib import Path
import tempfile
import json
import shutil
from unittest.mock import patch, MagicMock, call

from cosmifill.interactive_session import InteractiveSession
from cosmifill.utils import ClaudeIntegrationError


class TestInteractiveSession:
    """Test the interactive session functionality."""
    
    @pytest.fixture
    def temp_folder(self):
        """Create a temporary folder for testing."""
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir)
        # Cleanup
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def session_with_pdfs(self, temp_folder):
        """Create a session with test PDFs."""
        # Create test PDFs
        pdf1 = temp_folder / "test1.pdf"
        pdf2 = temp_folder / "test2.pdf"
        pdf1.write_bytes(b"%PDF-1.4\n%%EOF\n")
        pdf2.write_bytes(b"%PDF-1.4\n%%EOF\n")
        
        # Create test data file
        data_file = temp_folder / "data.txt"
        data_file.write_text("Test data content")
        
        return InteractiveSession(str(temp_folder))
    
    def test_init_valid_folder(self, temp_folder):
        """Test initialization with valid folder."""
        session = InteractiveSession(str(temp_folder))
        assert session.folder_path == temp_folder
        assert session.data_store == {}
        assert session.filled_pdfs == []
    
    def test_init_invalid_folder(self):
        """Test initialization with invalid folder."""
        with pytest.raises(ClaudeIntegrationError) as excinfo:
            InteractiveSession("/nonexistent/folder")
        assert "Invalid folder path" in str(excinfo.value)
    
    def test_init_file_instead_of_folder(self):
        """Test initialization with file instead of folder."""
        with tempfile.NamedTemporaryFile() as f:
            with pytest.raises(ClaudeIntegrationError) as excinfo:
                InteractiveSession(f.name)
            assert "Path is not a directory" in str(excinfo.value)
    
    def test_check_claude_cli_found(self):
        """Test Claude CLI detection when found."""
        session = InteractiveSession(tempfile.mkdtemp())
        
        with patch('shutil.which', return_value='/usr/local/bin/claude'):
            assert session._check_claude_cli() is True
    
    def test_check_claude_cli_not_found(self):
        """Test Claude CLI detection when not found."""
        session = InteractiveSession(tempfile.mkdtemp())
        
        with patch('shutil.which', return_value=None):
            assert session._check_claude_cli() is False
    
    def test_setup_claude_permissions(self, temp_folder):
        """Test Claude permissions file creation."""
        session = InteractiveSession(str(temp_folder))
        
        settings_file = session._setup_claude_permissions()
        
        # Check file was created
        assert settings_file.exists()
        assert settings_file.name == "settings.local.json"
        
        # Check content
        with open(settings_file, 'r') as f:
            settings = json.load(f)
        
        assert "permissions" in settings
        assert "allow" in settings["permissions"]
        assert "additionalDirectories" in settings["permissions"]
        assert "env" in settings
        
        # Check working directory is included
        assert str(temp_folder) in settings["permissions"]["additionalDirectories"]
    
    def test_setup_claude_permissions_with_gitignore(self, temp_folder):
        """Test permissions file is added to gitignore."""
        # Create gitignore
        gitignore = temp_folder / ".gitignore"
        gitignore.write_text("*.pyc\n__pycache__/\n")
        
        session = InteractiveSession(str(temp_folder))
        session._setup_claude_permissions()
        
        # Check gitignore was updated
        content = gitignore.read_text()
        assert ".claude/settings.local.json" in content
    
    @patch('cosmifill.interactive_session.PDFAnalyzer')
    @patch('cosmifill.interactive_session.DataExtractor')
    def test_pre_analyze_folder(self, mock_extractor, mock_analyzer, temp_folder):
        """Test pre-analysis of folder."""
        # Setup mocks
        mock_analyzer_instance = MagicMock()
        mock_analyzer_instance.analyze.return_value = {
            'file_name': 'test.pdf',
            'is_fillable': True,
            'field_count': 5,
            'form_fields': {'field1': '', 'field2': ''}
        }
        mock_analyzer.return_value = mock_analyzer_instance
        
        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract_all.return_value = {'raw_text': ['test data']}
        mock_extractor_instance.get_structured_data.return_value = {
            'personal_info': {'first_name': 'John', 'last_name': 'Doe'}
        }
        mock_extractor.return_value = mock_extractor_instance
        
        # Create test PDF
        pdf_file = temp_folder / "test.pdf"
        pdf_file.write_bytes(b"%PDF-1.4\n%%EOF\n")
        
        session = InteractiveSession(str(temp_folder))
        context_data = session._pre_analyze_folder()
        
        # Check analysis was performed
        assert 'pdf_analysis' in context_data
        assert 'extracted_data' in context_data
        assert 'structured_data' in context_data
        assert 'errors' in context_data
        
        # Check analysis file was created
        analysis_file = temp_folder / "COSMIFILL_ANALYSIS.json"
        assert analysis_file.exists()
    
    def test_pre_analyze_folder_with_errors(self, temp_folder):
        """Test pre-analysis handles errors gracefully."""
        # Create invalid PDF
        pdf_file = temp_folder / "invalid.pdf"
        pdf_file.write_text("Not a valid PDF")
        
        session = InteractiveSession(str(temp_folder))
        
        with patch('cosmifill.interactive_session.PDFAnalyzer') as mock_analyzer:
            mock_analyzer.side_effect = Exception("PDF analysis failed")
            
            context_data = session._pre_analyze_folder()
            
            # Should have recorded errors
            assert len(context_data['errors']) > 0
            assert "Failed to analyze invalid.pdf" in context_data['errors'][0]
    
    @patch('subprocess.run')
    @patch('os.chdir')
    def test_launch_claude_session(self, mock_chdir, mock_subprocess, session_with_pdfs):
        """Test launching Claude session."""
        # Mock successful Claude launch
        mock_subprocess.return_value = MagicMock(returncode=0)
        
        with patch.object(session_with_pdfs, '_pre_analyze_folder') as mock_analyze:
            mock_analyze.return_value = {
                'pdf_analysis': {},
                'extracted_data': {},
                'structured_data': {},
                'errors': [],
                'python_path': '/usr/bin/python3',
                'working_directory': str(session_with_pdfs.folder_path)
            }
            
            result = session_with_pdfs._launch_claude_session()
            
            assert result is True
            mock_subprocess.assert_called_once()
            # Check subprocess was called with correct arguments
            call_args = mock_subprocess.call_args[0][0]
            assert call_args[0] == 'claude'
    
    @patch('subprocess.run')
    def test_launch_claude_not_found(self, mock_subprocess, session_with_pdfs):
        """Test handling when Claude is not found."""
        # Mock Claude not found
        mock_subprocess.side_effect = FileNotFoundError()
        
        with patch.object(session_with_pdfs, '_pre_analyze_folder') as mock_analyze:
            mock_analyze.return_value = {'errors': [], 'python_path': '/usr/bin/python3'}
            
            with patch.object(session_with_pdfs, '_handle_missing_claude') as mock_handle:
                result = session_with_pdfs._launch_claude_session()
                
                assert result is False
                mock_handle.assert_called_once()
    
    def test_handle_missing_claude(self, session_with_pdfs, capsys):
        """Test handling when Claude CLI is missing."""
        with patch.object(session_with_pdfs, '_pre_analyze_folder') as mock_analyze:
            mock_analyze.return_value = {'errors': []}
            
            session_with_pdfs._handle_missing_claude()
            
            captured = capsys.readouterr()
            assert "Claude CLI not found" in captured.out
            assert "https://claude.ai/download" in captured.out
    
    def test_start_session_without_claude(self, session_with_pdfs):
        """Test starting session when Claude is not available."""
        with patch.object(session_with_pdfs, '_check_claude_cli', return_value=False):
            with patch.object(session_with_pdfs, '_handle_missing_claude') as mock_handle:
                session_with_pdfs.start()
                mock_handle.assert_called_once()
    
    def test_start_session_with_error(self, session_with_pdfs):
        """Test error handling in start method."""
        with patch.object(session_with_pdfs, '_check_claude_cli') as mock_check:
            mock_check.side_effect = Exception("Unexpected error")
            
            with pytest.raises(ClaudeIntegrationError) as excinfo:
                session_with_pdfs.start()
            
            assert "Failed to start interactive session" in str(excinfo.value)
    
    def test_resume_no_session(self, temp_folder):
        """Test resuming when no session exists."""
        session = InteractiveSession(str(temp_folder))
        
        with patch('cosmifill.interactive_session.Console') as mock_console:
            session.resume()
            
            # Should print error message
            mock_console.return_value.print.assert_called_with(
                "[red]No active session found in this folder.[/red]"
            )
    
    def test_resume_existing_session(self, temp_folder):
        """Test resuming existing session."""
        # Create session file
        session_data = {
            "folder": str(temp_folder),
            "status": "active",
            "filled_pdfs": ["test_filled.pdf"]
        }
        session_file = temp_folder / ".cosmifill_session.json"
        with open(session_file, 'w') as f:
            json.dump(session_data, f)
        
        session = InteractiveSession(str(temp_folder))
        
        with patch.object(session, '_launch_claude_session') as mock_launch:
            session.resume()
            mock_launch.assert_called_once()
    
    def test_session_file_creation(self, session_with_pdfs):
        """Test session file is created on start."""
        with patch.object(session_with_pdfs, '_check_claude_cli', return_value=True):
            with patch.object(session_with_pdfs, '_launch_claude_session', return_value=True):
                session_with_pdfs.start()
        
        session_file = session_with_pdfs.folder_path / ".cosmifill_session.json"
        assert session_file.exists()
        
        with open(session_file, 'r') as f:
            data = json.load(f)
        
        assert data["status"] == "completed"
        assert "started_at" in data
        assert "ended_at" in data
    
    def test_setup_script_creation(self, session_with_pdfs):
        """Test cosmifill_setup.py creation."""
        with patch.object(session_with_pdfs, '_pre_analyze_folder') as mock_analyze:
            mock_analyze.return_value = {
                'pdf_analysis': {},
                'extracted_data': {},
                'structured_data': {},
                'errors': [],
                'python_path': '/usr/bin/python3',
                'working_directory': str(session_with_pdfs.folder_path)
            }
            
            with patch('subprocess.run') as mock_run:
                mock_run.return_value = MagicMock(returncode=0)
                session_with_pdfs._launch_claude_session()
        
        setup_script = session_with_pdfs.folder_path / "cosmifill_setup.py"
        assert setup_script.exists()
        
        content = setup_script.read_text()
        assert "#!/usr/bin/python3" in content
        assert "from cosmifill.pdf_analyzer import PDFAnalyzer" in content
        assert "context = json.load(f)" in content