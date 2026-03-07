# Unreleased Changes

## Added

## Changed

## Fixed
- Update scripts (update.sh/update.ps1) now build UI assets before restarting PM2, ensuring production serves the latest client build
- App refresh-config now correctly derives uiPort, devUiPort, and apiPort from ecosystem process labels (fixes apps showing dev UI port as Launch)
- App refresh-config and detection now auto-detect buildCommand from package.json, enabling Build button for apps with production builds

## Removed
