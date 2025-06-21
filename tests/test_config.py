"""Tests for the configuration module."""
import pytest
from pathlib import Path
import tempfile
import json
import yaml

from cosmifill.config import Config, ConfigurationError, get_config, load_config
from cosmifill import config as config_module


class TestConfig:
    """Test configuration management."""
    
    @pytest.fixture
    def temp_json_config(self):
        """Create a temporary JSON config file."""
        config_data = {
            "pdf_settings": {
                "flatten_forms": True,
                "max_field_length": 500
            },
            "logging": {
                "level": "DEBUG"
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            temp_path = Path(f.name)
        
        yield temp_path, config_data
        temp_path.unlink()
    
    @pytest.fixture
    def temp_yaml_config(self):
        """Create a temporary YAML config file."""
        config_data = {
            "extraction_patterns": {
                "emails": [r"\b[\w\.-]+@[\w\.-]+\.\w+\b"],
                "phones": [r"\d{3}-\d{3}-\d{4}"]
            },
            "field_mappings": {
                "common_variations": {
                    "email": ["email", "e-mail", "mail"]
                }
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(config_data, f)
            temp_path = Path(f.name)
        
        yield temp_path, config_data
        temp_path.unlink()
    
    def test_default_config(self):
        """Test default configuration values."""
        config = Config()
        
        # Check some default values
        assert config.get('pdf_settings.flatten_forms') is False
        assert config.get('logging.level') == 'INFO'
        assert isinstance(config.get('extraction_patterns'), dict)
        assert isinstance(config.get('field_mappings'), dict)
    
    def test_load_json_config(self, temp_json_config):
        """Test loading JSON configuration."""
        config_path, expected_data = temp_json_config
        config = Config(str(config_path))
        
        # Check that custom values override defaults
        assert config.get('pdf_settings.flatten_forms') is True
        assert config.get('pdf_settings.max_field_length') == 500
        assert config.get('logging.level') == 'DEBUG'
    
    def test_load_yaml_config(self, temp_yaml_config):
        """Test loading YAML configuration."""
        config_path, expected_data = temp_yaml_config
        config = Config(str(config_path))
        
        # Check that custom values are loaded
        patterns = config.get_extraction_patterns()
        assert 'emails' in patterns
        assert len(patterns['emails']) == 1
        
        mappings = config.get_field_mappings()
        assert 'common_variations' in mappings
        assert 'email' in mappings['common_variations']
    
    def test_load_invalid_file(self):
        """Test loading non-existent configuration file."""
        with pytest.raises(ConfigurationError) as excinfo:
            Config("/nonexistent/config.json")
        assert "Failed to load configuration" in str(excinfo.value)
    
    def test_load_unsupported_format(self):
        """Test loading unsupported file format."""
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as f:
            f.write(b"Not a config file")
            temp_path = Path(f.name)
        
        try:
            with pytest.raises(ConfigurationError) as excinfo:
                Config(str(temp_path))
            assert "Unsupported config format" in str(excinfo.value)
        finally:
            temp_path.unlink()
    
    def test_get_nested_values(self):
        """Test getting nested configuration values."""
        config = Config()
        
        # Test nested access
        assert config.get('pdf_settings.flatten_forms') is False
        assert config.get('extraction_patterns.emails') is not None
        assert config.get('claude_integration.max_retries') == 3
        
        # Test non-existent keys
        assert config.get('nonexistent.key') is None
        assert config.get('nonexistent.key', 'default') == 'default'
    
    def test_set_values(self):
        """Test setting configuration values."""
        config = Config()
        
        # Set simple value
        config.set('test_value', 42)
        assert config.get('test_value') == 42
        
        # Set nested value
        config.set('new_section.subsection.value', 'test')
        assert config.get('new_section.subsection.value') == 'test'
        
        # Override existing value
        config.set('logging.level', 'ERROR')
        assert config.get('logging.level') == 'ERROR'
    
    def test_save_config(self):
        """Test saving configuration to file."""
        config = Config()
        config.set('custom_value', 'test')
        
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            temp_path = Path(f.name)
        
        try:
            config.save_to_file(str(temp_path))
            
            # Load the saved config
            with open(temp_path, 'r') as f:
                saved_data = json.load(f)
            
            assert saved_data['custom_value'] == 'test'
            assert 'pdf_settings' in saved_data
        finally:
            temp_path.unlink()
    
    def test_save_yaml_config(self):
        """Test saving configuration as YAML."""
        config = Config()
        config.set('yaml_test', True)
        
        with tempfile.NamedTemporaryFile(suffix='.yaml', delete=False) as f:
            temp_path = Path(f.name)
        
        try:
            config.save_to_file(str(temp_path))
            
            # Load the saved config
            with open(temp_path, 'r') as f:
                saved_data = yaml.safe_load(f)
            
            assert saved_data['yaml_test'] is True
        finally:
            temp_path.unlink()
    
    def test_merge_config(self):
        """Test configuration merging."""
        config = Config()
        
        # Get original value
        original_level = config.get('logging.level')
        
        # Merge custom config
        custom = {
            'logging': {'level': 'WARNING'},
            'new_section': {'value': 123}
        }
        config._merge_config(custom)
        
        # Check merged values
        assert config.get('logging.level') == 'WARNING'
        assert config.get('new_section.value') == 123
        # Original structure should still exist
        assert config.get('pdf_settings') is not None
    
    def test_get_config_singleton(self):
        """Test global config singleton."""
        # Reset the global config
        config_module._config = None
        
        config1 = get_config()
        config2 = get_config()
        
        # Should be the same instance
        assert config1 is config2
        
        # Set a value through one instance
        config1.set('singleton_test', 'value')
        
        # Should be visible through the other
        assert config2.get('singleton_test') == 'value'
    
    def test_load_config_global(self, temp_json_config):
        """Test loading config through global function."""
        config_path, _ = temp_json_config
        
        # Reset global config
        config_module._config = None
        
        load_config(str(config_path))
        
        # Get the loaded config
        config = get_config()
        assert config.get('pdf_settings.flatten_forms') is True
    
    def test_apply_logging_config(self, caplog):
        """Test applying logging configuration."""
        config = Config()
        config.set('logging.level', 'WARNING')
        
        # Apply the config
        config.apply_logging_config()
        
        # Logging should now be at WARNING level
        import logging
        logger = logging.getLogger('test')
        
        # These should not appear
        logger.debug("Debug message")
        logger.info("Info message")
        
        # This should appear
        logger.warning("Warning message")
        
        assert "Debug message" not in caplog.text
        assert "Info message" not in caplog.text
        assert "Warning message" in caplog.text
    
    def test_helper_methods(self):
        """Test configuration helper methods."""
        config = Config()
        
        # Test get_extraction_patterns
        patterns = config.get_extraction_patterns()
        assert isinstance(patterns, dict)
        assert 'dates' in patterns
        assert 'emails' in patterns
        
        # Test get_field_mappings
        mappings = config.get_field_mappings()
        assert isinstance(mappings, dict)
        assert 'common_variations' in mappings
        
        # Test get_pdf_settings
        pdf_settings = config.get_pdf_settings()
        assert isinstance(pdf_settings, dict)
        assert 'flatten_forms' in pdf_settings
        
        # Test get_logging_config
        log_config = config.get_logging_config()
        assert isinstance(log_config, dict)
        assert 'level' in log_config