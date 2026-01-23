#!/bin/bash
# Test script to verify terminal remounting behavior
# Run MultiClaude in dev mode and watch for mount/unmount logs

echo "=== Terminal Remount Detection Test ==="
echo ""
echo "This script helps verify if terminals remount on project switch"
echo ""
echo "Steps:"
echo "1. Add temporary logging to use-terminal.ts initTerminal and cleanup"
echo "2. Run app in dev mode"
echo "3. Create 2 projects with terminals"
echo "4. Switch between projects multiple times"
echo "5. Watch console for MOUNT/UNMOUNT logs"
echo ""
echo "Expected if bug exists:"
echo "  - UNMOUNT logs when switching away from project"
echo "  - MOUNT logs when switching to project"
echo ""
echo "Expected if fixed:"
echo "  - MOUNT logs only on initial terminal creation"
echo "  - No UNMOUNT logs on project switches"
echo ""

cat << 'EOF'

=== TEMPORARY DEBUG CODE ===

Add to use-terminal.ts line 101 (inside initTerminal):

  console.log(`🟢 MOUNT: Terminal ${terminalId} - Creating new XTerm instance`)

Add to use-terminal.ts line 446 (inside cleanup return):

  console.log(`🔴 UNMOUNT: Terminal ${terminalId} - Destroying XTerm instance`)

Then run:
  npm run dev

And watch console output while switching projects.

EOF
