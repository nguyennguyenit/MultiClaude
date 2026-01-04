#!/bin/bash
# Post-installation script for MultiClaude
# Fixes chrome-sandbox permissions (required for Electron apps on Linux)

SANDBOX_PATH="/opt/MultiClaude/chrome-sandbox"

if [ -f "$SANDBOX_PATH" ]; then
    chown root:root "$SANDBOX_PATH"
    chmod 4755 "$SANDBOX_PATH"
fi

exit 0
