"""Configuration management for CosmiFill."""
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
import logging

from cosmifill.utils import validate_path, CosmiFillError


class ConfigurationError(CosmiFillError):
    """Raised when configuration loading or parsing fails."""
    pass


class Config:
    """Manages CosmiFill configuration."""
    
    # Default configuration
    DEFAULT_CONFIG = {
        'extraction_patterns': {
            'dates': [
                r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
                r'\b\d{1,2}-\d{1,2}-\d{2,4}\b',
                r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b',
                r'\b\d{4}-\d{2}-\d{2}\b'
            ],
            'emails': [r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'],
            'phones': [
                r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
                r'\(\d{3}\)\s*\d{3}[-.]?\d{4}',
                r'\b\d{10}\b'
            ],
            'amounts': [r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)']
        },
        'field_mappings': {
            'common_variations': {
                'first_name': ['first_name', 'firstname', 'fname', 'given_name'],
                'last_name': ['last_name', 'lastname', 'lname', 'surname', 'family_name'],
                'email': ['email', 'email_address', 'e-mail', 'mail'],
                'phone': ['phone', 'telephone', 'tel', 'phone_number', 'mobile'],
                'date_of_birth': ['dob', 'birthdate', 'birth_date', 'date_of_birth']
            }
        },
        'pdf_settings': {
            'flatten_forms': False,
            'max_field_length': 1000,
            'timestamp_format': '%Y%m%d_%H%M%S'
        },
        'logging': {
            'level': 'INFO',
            'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        },
        'claude_integration': {
            'timeout_seconds': 300,
            'max_retries': 3,
            'permissions': {
                'allow_patterns': [
                    'Bash(python*)',
                    'Read(*)',
                    'Write(*)',
                    'Edit(*)'
                ]
            }
        }
    }
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration.
        
        Args:
            config_path: Optional path to custom configuration file
        """
        self.logger = logging.getLogger('cosmifill.Config')
        self.config = self.DEFAULT_CONFIG.copy()
        
        if config_path:
            self.load_from_file(config_path)
    
    def load_from_file(self, config_path: str):
        """Load configuration from a file.
        
        Args:
            config_path: Path to configuration file (JSON or YAML)
            
        Raises:
            ConfigurationError: If loading or parsing fails
        """
        try:
            path = validate_path(config_path, must_exist=True)
            
            with open(path, 'r') as f:
                if path.suffix.lower() in ['.yaml', '.yml']:
                    custom_config = yaml.safe_load(f)
                elif path.suffix.lower() == '.json':
                    custom_config = json.load(f)
                else:
                    raise ConfigurationError(f"Unsupported config format: {path.suffix}")
            
            # Merge with defaults
            self._merge_config(custom_config)
            self.logger.info(f"Loaded configuration from {path}")
            
        except Exception as e:
            raise ConfigurationError(f"Failed to load configuration: {str(e)}")
    
    def _merge_config(self, custom_config: Dict[str, Any]):
        """Merge custom configuration with defaults.
        
        Args:
            custom_config: Custom configuration to merge
        """
        def deep_merge(base: dict, custom: dict) -> dict:
            """Recursively merge dictionaries."""
            for key, value in custom.items():
                if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                    base[key] = deep_merge(base[key], value)
                else:
                    base[key] = value
            return base
        
        self.config = deep_merge(self.config, custom_config)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key.
        
        Args:
            key: Dot-separated key path (e.g., 'pdf_settings.flatten_forms')
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def set(self, key: str, value: Any):
        """Set configuration value.
        
        Args:
            key: Dot-separated key path
            value: Value to set
        """
        keys = key.split('.')
        config = self.config
        
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        config[keys[-1]] = value
    
    def save_to_file(self, config_path: str):
        """Save current configuration to file.
        
        Args:
            config_path: Path to save configuration to
            
        Raises:
            ConfigurationError: If saving fails
        """
        try:
            path = Path(config_path)
            
            with open(path, 'w') as f:
                if path.suffix.lower() in ['.yaml', '.yml']:
                    yaml.dump(self.config, f, default_flow_style=False)
                else:
                    json.dump(self.config, f, indent=2)
            
            self.logger.info(f"Saved configuration to {path}")
            
        except Exception as e:
            raise ConfigurationError(f"Failed to save configuration: {str(e)}")
    
    def get_extraction_patterns(self) -> Dict[str, list]:
        """Get extraction patterns for data extractor."""
        return self.get('extraction_patterns', {})
    
    def get_field_mappings(self) -> Dict[str, dict]:
        """Get field mapping configurations."""
        return self.get('field_mappings', {})
    
    def get_pdf_settings(self) -> Dict[str, Any]:
        """Get PDF processing settings."""
        return self.get('pdf_settings', {})
    
    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging configuration."""
        return self.get('logging', {})
    
    def apply_logging_config(self):
        """Apply logging configuration to the logging system."""
        log_config = self.get_logging_config()
        
        logging.basicConfig(
            level=getattr(logging, log_config.get('level', 'INFO')),
            format=log_config.get('format', '%(message)s')
        )


# Global configuration instance
_config: Optional[Config] = None


def get_config() -> Config:
    """Get the global configuration instance."""
    global _config
    if _config is None:
        _config = Config()
    return _config


def load_config(config_path: str):
    """Load configuration from file.
    
    Args:
        config_path: Path to configuration file
    """
    global _config
    _config = Config(config_path)
    _config.apply_logging_config()