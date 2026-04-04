# Unreleased Changes

## Added

## Changed

## Fixed

- Feature-ideas prompt included "you are working in a git worktree on a feature branch" even when worktree was not configured — worktree context is now only injected by `agentPromptBuilder` when actually using a worktree
- `app-improve-` task IDs were getting `task-` prefix added by `taskParser.js`, causing `updateTask` lookups to fail — tasks were never marked in_progress or completed after agent runs
- Recovered `app-improve-` agents after server restart now correctly infer `taskType: 'internal'` instead of `'user'`
- Extracted `hasKnownPrefix()` and `isInternalTaskId()` helpers to eliminate prefix check drift across 8 locations

## Removed
