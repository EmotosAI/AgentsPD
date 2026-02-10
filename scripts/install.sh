#!/bin/bash
#
# Emotos CLI Installer
# 
# Usage:
#   curl -fsSL https://emotos.ai/v1/cli/install.sh | bash
#   
# Or with options:
#   curl -fsSL https://emotos.ai/v1/cli/install.sh | bash -s -- --dir ~/.local/bin
#
# Environment variables:
#   EMOTOS_INSTALL_DIR - Override installation directory
#   EMOTOS_API_URL     - Override API URL (default: https://emotos.ai)
#
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION="${EMOTOS_CLI_VERSION:-latest}"
API_URL="${EMOTOS_API_URL:-https://emotos.ai}"
INSTALL_DIR="${EMOTOS_INSTALL_DIR:-}"

# Print functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Print banner
print_banner() {
    echo ""
    echo -e "${BLUE}"
    echo "  ╔═══════════════════════════════════════╗"
    echo "  ║         Emotos CLI Installer          ║"
    echo "  ║   Security Infrastructure for AI      ║"
    echo "  ╚═══════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

# Check for required commands
check_requirements() {
    local missing=()
    
    for cmd in curl tar node npm; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing required commands: ${missing[*]}"
        echo ""
        echo "Please install the following before running this script:"
        for cmd in "${missing[@]}"; do
            case "$cmd" in
                node|npm)
                    echo "  - Node.js 20+: https://nodejs.org/"
                    ;;
                curl)
                    echo "  - curl: Use your package manager (apt, brew, etc.)"
                    ;;
                tar)
                    echo "  - tar: Use your package manager (apt, brew, etc.)"
                    ;;
            esac
        done
        exit 1
    fi
    
    # Check Node.js version
    local node_version
    node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt 20 ]; then
        error "Node.js 20 or higher is required (found v$node_version)"
        echo "Please upgrade Node.js: https://nodejs.org/"
        exit 1
    fi
}

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$OS" in
        linux)   OS="linux" ;;
        darwin)  OS="darwin" ;;
        mingw*|msys*|cygwin*) OS="windows" ;;
        *)
            error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
    
    case "$ARCH" in
        x86_64|amd64)  ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *)
            error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    
    info "Detected platform: $OS-$ARCH"
}

# Determine installation directory
determine_install_dir() {
    if [ -n "$INSTALL_DIR" ]; then
        info "Using custom install directory: $INSTALL_DIR"
        return
    fi
    
    # Try common locations in order of preference
    local candidates=(
        "$HOME/.local/bin"
        "$HOME/bin"
        "/usr/local/bin"
    )
    
    for dir in "${candidates[@]}"; do
        if [ -d "$dir" ] && [ -w "$dir" ]; then
            INSTALL_DIR="$dir"
            break
        fi
    done
    
    # If no writable directory found, use ~/.local/bin and create it
    if [ -z "$INSTALL_DIR" ]; then
        INSTALL_DIR="$HOME/.local/bin"
        mkdir -p "$INSTALL_DIR"
    fi
    
    info "Installation directory: $INSTALL_DIR"
}

# Check if directory is in PATH
check_path() {
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        warn "$INSTALL_DIR is not in your PATH"
        echo ""
        echo "Add it to your shell configuration:"
        echo ""
        
        local shell_name
        shell_name=$(basename "$SHELL")
        
        case "$shell_name" in
            bash)
                echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.bashrc"
                echo "  source ~/.bashrc"
                ;;
            zsh)
                echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc"
                echo "  source ~/.zshrc"
                ;;
            fish)
                echo "  fish_add_path $INSTALL_DIR"
                ;;
            *)
                echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
                ;;
        esac
        echo ""
    fi
}

# Download and install CLI from the API server tarball
install_cli() {
    local temp_dir
    temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT
    
    info "Downloading Emotos CLI..."
    
    local download_url="$API_URL/v1/cli/download"
    local tarball="$temp_dir/emotos-cli.tgz"
    
    if ! curl -fsSL "$download_url" -o "$tarball" 2>/dev/null; then
        # Fallback to npm if API tarball is not available
        warn "API download not available, falling back to npm registry..."
        install_via_npm
        return
    fi
    
    info "Installing from server tarball..."
    npm install -g "$tarball" 2>&1
    success "Installed from server"
    
    # Clean up temp dir
    rm -rf "$temp_dir"
    trap - EXIT
}

# Alternative: Install via npm (simpler and more reliable)
install_via_npm() {
    info "Installing Emotos CLI via npm..."
    
    if npm install -g agentspd 2>/dev/null; then
        success "Installed via npm"
    else
        # Try with sudo if permission denied
        warn "Permission denied, trying with sudo..."
        sudo npm install -g agentspd
    fi
}

# Verify installation
verify_installation() {
    if command -v agentspd &> /dev/null; then
        local version
        version=$(agentspd --version 2>/dev/null || echo "unknown")
        success "Emotos CLI installed successfully!"
        echo ""
        echo "  Version: $version"
        echo "  Path:    $(which agentspd)"
    else
        error "Installation verification failed"
        echo ""
        echo "Try installing manually:"
        echo "  npm install -g agentspd"
        exit 1
    fi
}

# Print next steps
print_next_steps() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}           Installation Complete!          ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    echo "Get started:"
    echo ""
    echo "  1. Sign up or log in:"
    echo "     ${BLUE}agentspd auth signup${NC}"
    echo "     ${BLUE}agentspd auth login${NC}"
    echo ""
    echo "  2. View available commands:"
    echo "     ${BLUE}agentspd --help${NC}"
    echo ""
    echo "  3. Register your first agent:"
    echo "     ${BLUE}agentspd agents create --name my-agent${NC}"
    echo ""
    echo "Documentation: https://docs.emotos.ai"
    echo "Dashboard:     https://app.emotos.ai"
    echo ""
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --help|-h)
                echo "Emotos CLI Installer"
                echo ""
                echo "Usage: curl -fsSL https://emotos.ai/v1/cli/install.sh | bash"
                echo ""
                echo "Options:"
                echo "  --dir <path>     Install to specific directory"
                echo "  --version <ver>  Install specific version"
                echo "  --help           Show this help"
                echo ""
                echo "Environment variables:"
                echo "  EMOTOS_INSTALL_DIR  Override installation directory"
                echo "  EMOTOS_API_URL      Override API URL"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Main installation flow
main() {
    parse_args "$@"
    
    print_banner
    
    info "Starting installation..."
    echo ""
    
    check_requirements
    detect_platform
    determine_install_dir
    
    echo ""
    install_cli
    
    echo ""
    verify_installation
    check_path
    print_next_steps
}

# Run main
main "$@"
