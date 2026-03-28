### Fixed

- Self-update failing with "exit code null" at npm-install step — PM2 watch restarted the server during `git checkout` (which changes `server/` files), breaking the stdout pipe to the update script. SIGPIPE killed the script before `|| true` could handle it, leaving the update incomplete. Added `trap '' PIPE` to ignore SIGPIPE so the script runs to completion.
- Improved update error messages to show signal name (e.g., "killed by SIGPIPE") instead of opaque "exit code null"
