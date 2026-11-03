#!/bin/bash
# run-tests.sh: after Claude edits a .js file under src/ or test/, run the tests.
# Failing tests go back to Claude on stderr with exit 2. A pass is silent.
FILE=$(jq -r '.tool_input.file_path // empty')
case "$FILE" in
  */src/*.js|*/test/*.js) ;;
  *) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
OUT=$(npm test -- --test-reporter=spec 2>&1)
if [ $? -ne 0 ]; then
  echo "$OUT" | tail -n 40 >&2
  exit 2
fi
exit 0
