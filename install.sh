#!/usr/bin/env bash
# CosmiFill Installer for macOS and Linux
# One-click installation script

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "     CosmiFill Quick Installer"
echo "======================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3.8+ first."
    exit 1
fi

echo "✅ Python $(python3 --version | cut -d' ' -f2) found"

# Install pipx if not present
if ! command -v pipx &> /dev/null; then
    echo -e "${YELLOW}Installing pipx...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
        brew install pipx
    else
        python3 -m pip install --user pipx
    fi
    
    python3 -m pipx ensurepath
    
    # Add to current session
    export PATH="$HOME/.local/bin:$PATH"
fi

# Install CosmiFill
echo -e "${YELLOW}Installing CosmiFill...${NC}"
pipx install . --force

echo ""
echo -e "${GREEN}✨ CosmiFill installed successfully! ✨${NC}"
echo ""
echo "You may need to restart your terminal or run:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "Usage:"
echo "  cosmifill <folder>  # Start filling PDFs"
echo ""
echo "Try it now:"
echo "  cosmifill ."