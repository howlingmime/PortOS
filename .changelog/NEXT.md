# Unreleased

## Added

- **Image Generation Settings** — New Settings > Image Gen tab for configuring Stable Diffusion API (AUTOMATIC1111 / Forge WebUI). Auto-detects Flux models and adjusts parameters accordingly.
- **CoS Tools Registry** — New onboard tools system (`data/tools/`) that lets CoS agents discover and use instance-specific capabilities like image generation. Tools are exposed in agent prompts via `getToolsSummaryForPrompt()`.
- **Character Avatar Generation** — D&D Character Sheet now supports AI-generated avatars via the configured SD API. Hover over the avatar area to generate a new portrait.
- **Image serving** — Generated images stored in `data/images/` and served via `/data/images/` static route.
