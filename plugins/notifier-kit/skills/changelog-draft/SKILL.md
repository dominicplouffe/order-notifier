---
description: Drafts a changelog entry from the recent git history. Use when the user asks for a changelog entry, release notes, or a summary of what changed since the last release.
---

## Recent commits

!`git log --oneline -10`

## Instructions

Write a changelog entry for the commits above: a heading "Changelog", then one bullet per user-visible change in plain words. Skip commits that only touch tests or docs. End with a line "Commits covered: N".
