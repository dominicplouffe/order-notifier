#!/bin/bash
# Review a git diff with Claude in headless mode and print one finding per line.
# usage: scripts/review-diff.sh BASE_REF [extra claude flags, e.g. --bare]
# Exit codes: 0 reviewed and nothing found, 1 the run itself failed, 2 reviewed and found problems.
set -uo pipefail
base=${1:?usage: review-diff.sh BASE_REF [claude flags]}; shift
schema='{"type":"object","properties":{"problems":{"type":"array","items":{"type":"object","properties":{"file":{"type":"string"},"problem":{"type":"string"}},"required":["file","problem"]}}},"required":["problems"]}'
git diff "$base" -- . ':(exclude)*package-lock.json' | claude -p \
  "You review a diff for a small Node service. List at most 3 concrete problems a maintainer would want fixed. Report none if there are none." \
  --model haiku --max-turns 3 --max-budget-usd 0.25 \
  --output-format json --json-schema "$schema" "$@" > review.json || exit 1
jq -e '.is_error == false and has("structured_output")' review.json > /dev/null || { jq -r '.subtype + ": " + (.result // "")' review.json >&2; exit 1; }
jq -r '.structured_output.problems[] | "\(.file): \(.problem)"' review.json
jq -r '"cost $\(.total_cost_usd), \(.num_turns) turns, \(.subtype)"' review.json >&2
test "$(jq '.structured_output.problems | length' review.json)" -eq 0 || exit 2
