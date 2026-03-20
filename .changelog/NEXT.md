# Unreleased Changes

## Added
- Nicotine tracking tab in MeatSpace with consumption logging, daily totals, rolling averages, custom product quick-add buttons, inline editing, and entry history
- Nicotine chart (7d/30d/90d bar chart) and nicotine vs heart rate correlation visualization
- Nicotine data integrated into health correlation endpoint (HR, resting HR alongside nicotine mg)
- Server-side nicotine service with daily log persistence, custom product management, and caching

## Changed
- Extracted shared `dayOfWeek` utility and `DAY_LABELS` constant to meatspace constants (deduplicated from AlcoholTab)
- Health correlation endpoint now includes heart rate, resting heart rate, and nicotine data alongside existing HRV/alcohol/steps
- NicotineHealthCorrelation tooltip uses Tailwind classes instead of inline styles for consistency

## Fixed
- Stokes Pick default nicotine amount corrected from 3mg to 5mg

## Removed
