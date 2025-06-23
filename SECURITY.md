# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Model

CosmiFill implements a multi-layered security approach to protect user data and system integrity:

### 1. Sandbox Isolation
- Each Claude Code session runs in an isolated temporary directory
- File operations are restricted to the sandbox environment
- Path validation prevents directory traversal attacks
- Sessions are automatically cleaned up after use

### 2. Command Execution Security
- Only whitelisted commands can be executed (ls, pwd, echo, python, python3)
- Command execution happens with restricted environment variables
- Process timeouts prevent runaway operations
- All command attempts are logged for audit trails

### 3. File Access Control
- File type restrictions (only .pdf, .json, .txt, .py, .log allowed for writing)
- Read/write operations are validated against sandbox boundaries
- All file access attempts are logged with security events

### 4. Electron Security
- Context isolation enabled
- Node integration disabled
- Sandbox mode enabled for renderer processes
- Secure IPC communication via contextBridge
- Electron Fuses configured to disable dangerous features

### 5. Tool Mediation
- Claude Code tools are replaced with secure proxies
- All tool operations go through security validation
- Custom tools use IPC for controlled execution

### 6. Logging and Monitoring
- Comprehensive security event logging
- Separate logs for security events, application events, and errors
- Structured logging with winston for analysis
- Audit trails for all security-relevant operations

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly:

1. **DO NOT** open a public issue
2. Create a security advisory on GitHub: https://github.com/CosmicHazel/CosmiFill/security/advisories/new
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes

We will acknowledge receipt within 48 hours and provide updates on the resolution timeline.

## Security Best Practices for Users

1. **Keep CosmiFill Updated**: Always run the latest version for security patches
2. **Review Permissions**: Be cautious about what files you provide to the application
3. **Sandbox Awareness**: Understand that Claude Code runs in a restricted environment
4. **Data Privacy**: Sensitive data is only processed locally in your sandbox

## Security Features

### Data Protection
- All processing happens locally - no data sent to external servers
- Temporary files are securely deleted after processing
- PDF forms are filled without storing personal information

### Update Security
- Automatic update checks (can be disabled)
- Signed releases for authenticity
- Secure download over HTTPS

### Audit Logging
- Security events logged with timestamps and session IDs
- Failed access attempts recorded
- Command execution history maintained

## Third-Party Dependencies

We regularly audit our dependencies for vulnerabilities:
- Automated security scanning with npm audit
- Snyk integration for continuous monitoring
- Regular dependency updates

## Incident Response

In case of a security incident:
1. Affected versions will be immediately deprecated
2. Security patch will be released ASAP
3. Users will be notified through the auto-update system
4. Detailed disclosure after patch deployment

## Contact

For security concerns: Use GitHub Security Advisories at https://github.com/CosmicHazel/CosmiFill/security/advisories/new
For general issues: Use GitHub Issues at https://github.com/CosmicHazel/CosmiFill/issues