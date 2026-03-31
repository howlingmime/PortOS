# Unreleased Changes

## Added
- AI-powered narrative summaries for JIRA weekly status reports (tries each API provider until one succeeds)

## Changed
- JIRA reports now filter to current user's tickets only via `currentUser()` JQL
- Status report UI simplified to personal weekly status format with copy-to-clipboard
- Ticket keys rendered as clickable JIRA links anywhere in report text

## Changed
- Pin all npm dependencies to exact versions across all packages (no more `^` or `~` ranges) to prevent supply chain attacks

## Fixed
- JIRA report provider discovery now tries all available API providers instead of failing on first unreachable one
