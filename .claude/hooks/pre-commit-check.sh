#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

echo "Running npm run check before commit..." >&2
cd "$CLAUDE_PROJECT_DIR" || exit 1
npm run check

if [ $? -ne 0 ]; then
  echo "npm run check failed. Fix errors before committing." >&2
  exit 2
fi
exit 0
