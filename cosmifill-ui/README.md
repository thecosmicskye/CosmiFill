# CosmiFill UI

A secure desktop application for intelligent PDF form filling using Claude Code.

## Features

- 🎯 **One-Click Installation**: Automatically installs Node.js and Claude Code
- 🔒 **Security Sandbox**: All operations run in isolated temporary directories
- 📁 **Drag & Drop Interface**: Easy file management for PDFs and data files
- 💬 **Integrated Chat**: Real-time interaction with Claude Code
- 🖥️ **Cross-Platform**: Works on macOS, Linux, and Windows (via WSL)

## Development

### Prerequisites

- Node.js 18+ (will be auto-installed if missing)
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run start

# Build for production
npm run make
```

### Architecture

The application consists of:

1. **Main Process** (`src/main.ts`): Handles system operations, security, and Claude integration
2. **Renderer Process** (`src/renderer.tsx`): React-based UI
3. **Security Layer** (`src/main/security/`): Sandboxed execution environment
4. **Installer Logic** (`src/main/installer/`): Auto-installation of dependencies

### Security Model

- All Claude Code operations run in isolated temp directories
- File access is restricted to session-specific sandboxes
- Commands are whitelisted and validated before execution
- 30-second timeout on all operations

## Usage

1. Launch the application
2. Complete the setup wizard (first run only)
3. Drag your data files to the "Data Files" zone
4. Drag your PDF forms to the "PDF Forms" zone
5. Click "Fill Forms" to start the intelligent filling process
6. Chat with Claude to guide the process

## Building

```bash
# Package for current platform
npm run package

# Create distributables
npm run make
```

## Troubleshooting

### App doesn't start

1. Check console for errors: `npm run start`
2. Verify Node.js version: `node --version` (should be 18+)
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Claude Code not found

The app will automatically install Claude Code on first run. If issues persist:

```bash
npm install -g @anthropic-ai/claude-code
```

### Windows Issues

Ensure WSL is installed and updated:
```powershell
wsl --install
wsl --update
```

## License

MIT