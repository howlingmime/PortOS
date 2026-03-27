# Unreleased Changes

## Added

## Changed

## Fixed

- Character avatar image now synced between instances alongside character metadata
- Snapshot sync status no longer shows false "behind" when remote doesn't report checksums
- Agent worktree branches now cleaned up even when worktree directory is already gone (fixes lingering branches after server restarts)
- Instance names like "null", "void", "NaN", "undefined" are now accepted as valid hostnames
- Peer renames no longer revert when remote peer re-announces (handleAnnounce now preserves user-set names)
- Self instance card now shows sync status for all categories (Goals, Character, Digital Twin, Meatspace), not just Brain and Memory
- CoS task evaluation now blocks tasks that exceeded max spawn limit before reaching spawn logic
- Metadata count fields (totalSpawnCount, failureCount, orphanRetryCount) use Number() coercion to prevent string comparison bugs
- jira-status-report task now runs in PortOS context (not the app's directory) and uses the correct PortOS API endpoint
- jira-status-report agents no longer attempt to commit, push, or modify files (readOnly metadata flag)
- readOnly tasks skip unnecessary git pull, JIRA branch creation, and worktree setup
- Added `PORTOS_API_URL` constant to `ports.js` for dynamic API URL resolution in task prompts

## Removed
