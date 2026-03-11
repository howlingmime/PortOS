# Versioning & Release Process

## Version Format

PortOS uses semantic versioning: **Major.Minor.Patch**

| Component | Description | When Incremented |
|-----------|-------------|------------------|
| **Major** | Breaking changes | Manual — in commit |
| **Minor** | New features | Manual — in commit |
| **Patch** | Bug fixes, refactors | Manual — in commit |

Example progression: `0.22.0` → `0.22.1` (fix) → `0.23.0` (feature) → `1.0.0` (breaking)

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Active development |
| `release` | Push `main` to `release` to trigger GitHub Release workflow |

## Workflow

### Version Bumping

Version is managed by the `/release` slash command. Do not bump `package.json` version manually during development.

### On Push/PR to `main`

CI runs tests and linting. No version changes.

### On Push `main` → `release`

1. Release workflow triggers
2. Creates git tag with current version (e.g., `v1.31.0`)
3. Generates GitHub release with changelog from `.changelog/v{major}.{minor}.x.md`
4. Archives the changelog (renames `v1.31.x.md` → `v1.31.0.md`) on `main`
5. Fast-forwards `release` to match `main`

### Regular Development

```bash
# Work on main or feature branches
git checkout main
git pull

# Make changes, commit, push
git add [changed files]
git commit -m "fix: resolve issue"
git pull --rebase --autostash && git push
```

### Creating a Release

Use the `/release` slash command from `main`. It handles version bumping, changelog finalization, and pushing to the `release` branch.

## CI Skip

Use `[skip ci]` in commit messages to prevent CI from running (used by automation for changelog archives).
