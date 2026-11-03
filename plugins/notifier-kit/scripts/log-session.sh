#!/bin/bash
# Append one line per session start to the plugin's own data folder.
mkdir -p "$CLAUDE_PLUGIN_DATA"
echo "$(date -u +%FT%TZ) session started in $(jq -r .cwd)" >> "$CLAUDE_PLUGIN_DATA/sessions.log"
exit 0
