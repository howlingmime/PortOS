# Unreleased Changes

## Added

## Changed

## Fixed

- CoS task evaluation now blocks tasks that exceeded max spawn limit before reaching spawn logic
- Metadata count fields (totalSpawnCount, failureCount, orphanRetryCount) use Number() coercion to prevent string comparison bugs
- jira-status-report task now runs in PortOS context (not the app's directory) and uses the correct PortOS API endpoint
- jira-status-report agents no longer attempt to commit, push, or modify files (readOnly metadata flag)
- readOnly tasks skip unnecessary git pull, JIRA branch creation, and worktree setup
- Added `PORTOS_API_URL` constant to `ports.js` for dynamic API URL resolution in task prompts

## Removed
