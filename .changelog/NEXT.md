# Unreleased Changes

## Added

- GitHub repos management page under Dev Tools > GitHub
  - Sync repos from GitHub via `gh repo list`
  - Toggle repos as NPM projects (auto-manages NPM_TOKEN secret)
  - Manage secrets and push to repos via `gh secret set`
  - Archive/unarchive repos directly from the UI
  - Private repo visibility badge
  - Fork source badge linking to upstream repo
  - Filter by All / NPM Projects / Has Secrets / Archived
  - Search repos by name or description
- Updated CoS github-repo-maintenance job to cross-reference PortOS repo flags
