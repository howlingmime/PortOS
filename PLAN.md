# PortOS — Development Plan

For project goals, see [GOALS.md](./GOALS.md). For completed work, see [DONE.md](./DONE.md).

---

## Next Up

1. **God file decomposition** — routes/cos.js ✅, routes/scaffold.js ✅, client/api.js ✅, services/digital-twin.js ✅ (split into 10 focused modules), services/subAgentSpawner.js ✅ (split into 9 focused modules). **All god files decomposed.**

## Backlog

- [ ] **Voice CoS tool expansion** — tools now include the original domain set plus `ui_navigate`, `ui_list_interactables`, `ui_click`, `ui_fill`, `ui_select`, `ui_check` for accessibility-style page driving. Remaining candidates:
  - `calendar_today` / `calendar_next` — surface today's Google Calendar events through the existing Google MCP integration
  - `meatspace_log_workout` — wrap `meatspaceHealth.js` workout/activity exports
  - `weather_now` — needs an external API choice (OpenWeather / Apple WeatherKit / NWS)
  - `timer_set` — set a voice-triggered reminder; likely reuses `agentActionExecutor.js` scheduled actions
  - `feeds_mark_read` — pair with `feeds_digest` for "mark that one read"

- [ ] **Voice agent — next power-ups** (follow-ons to the ui_* accessibility layer):
  - `ui_read` — extract visible page text (not just interactables) so "what does this say?" / "summarize this page" works without hand-navigation. Complements `ui_list_interactables`.
  - **Destructive-action confirmation gate** — when a `ui_click` target label matches `/delete|remove|discard|reset|clear/i`, pause and require spoken "confirm" / "cancel" before firing. Prevents voice mishaps.
  - **Vision fallback tool** (`ui_describe_visually`) — screenshot the current tab (or a named canvas/chart element) and send to a vision-capable model so "what's on this chart?" works on non-DOM content (CyberCity, graph views). Depends on whether `portos-ai-toolkit` wires a vision provider.
  - **Proactive CoS speech** — push-to-talk the other direction: a server event that makes the voice widget speak unprompted ("heads up: 3 things on your briefing" / "time to stretch"). Needs a quiet-hours policy and an interrupt-gracefully contract with the existing barge-in logic.
  - **Explicit long-term memory routing** — when the user says "remember that …", auto-route to `brain_capture` and inject top-N relevant memories into the voice turn's system prompt via `brain_search`. Some of this is ambiently possible today; make it explicit and self-improving.
- [x] **Test coverage** — cosRunnerClient.js ✅ (37 tests), agentActionExecutor.js ✅ (27 tests), CoS routes ✅ (170 tests across 6 test files, 83-100% route coverage). Remaining gap: cos.js service (~4% coverage)
- [ ] **CyberCity v2** — Transform from decorative scene to living systems dashboard. See [cybercity-v2.md](./docs/features/cybercity-v2.md) for full plan. Top priorities: system health atmosphere, richer billboards, brain inbox pulse, agent activity visualization, chronotype energy overlay.
- [ ] **M50 P9**: CoS Automation & Rules — Automated email classification, rule-based pre-filtering, email-to-task pipeline
- [ ] **M50 P10**: Auto-Send with AI Review Gate — Per-account trust level, second LLM reviews drafts. See [Messages Security](./docs/features/messages-security.md)
- [ ] **M34 P5-P7**: Digital Twin — Multi-modal capture, advanced testing, personas

**Known low-severity:** pm2 ReDoS (GHSA-x5gf-qvw8-r2rm) — no upstream fix, not exploitable via PortOS routes.

---

## Depfree Audit — 2026-03-31 (Heavy Mode) ✅ COMPLETE

**Summary:** Removed 13 of 15 targeted packages. 2 deferred (`@dnd-kit/*`, `recharts`) — replacement effort exceeds 300-line heavy-mode ceiling. ~1,100 lines of owned replacement code written across 9 new files.

### All Replacements (complete)

| Package | Replacement | Status |
|---------|-------------|--------|
| `uuid` | `server/lib/uuid.js` — `crypto.randomUUID()` shim | ✅ |
| `cors` | Inline `Access-Control-*` headers in `index.js` + scaffold | ✅ |
| `axios` | `server/lib/httpClient.js` — fetch + AbortSignal.timeout + self-signed TLS | ✅ |
| `multer` | `server/lib/multipart.js` — streaming multipart, no buffering | ✅ |
| `unzipper` | `server/lib/zipStream.js` — streaming ZIP via zlib.createInflateRaw | ✅ |
| `node-telegram-bot-api` | `server/lib/telegramClient.js` — fetch-based polling + EventEmitter | ✅ |
| `supertest` | `server/lib/testHelper.js` — HTTP server lifecycle + fetch request wrapper | ✅ |
| `geist` | Fonts self-hosted in `client/public/fonts/` | ✅ |
| `globals` | Inlined in `client/eslint.config.js` | ✅ |
| `fflate` | Native `DecompressionStream` + inline EOCD ZIP parser in `GenomeTab.jsx` | ✅ |
| `react-markdown` | Inline regex block/inline parser in `MarkdownOutput.jsx` | ✅ |
| `react-diff-viewer-continued` | Inline Myers LCS diff in `CrossDomainTab.jsx` | ✅ |
| `react-hot-toast` | `client/src/components/ui/Toast.jsx` — module-level store + Toaster | ✅ |
| `@dnd-kit/*` | **Deferred** — keyboard nav + ARIA puts replacement >300 lines | ⏸ |
| `recharts` | **Deferred** — 9-file rewrite exceeds ceiling | ⏸ |

**Note:** Validate `server/lib/zipStream.js` with a real Apple Health ZIP before next release.

### Dependencies Kept (with rationale)

| Package | Tier | Reason Kept |
|---------|------|-------------|
| `express` | 1 | Foundational web framework |
| `googleapis` | 1 | Large official Google API client — infeasible to replace |
| `node-pty` | 1 | Native PTY addon — no pure-JS equivalent |
| `pg` | 1 | PostgreSQL driver — foundational, widely audited |
| `pm2` (root + server) | 1 | Process manager SDK used throughout server for app lifecycle |
| `portos-ai-toolkit` | 1 | Internal project toolkit |
| `socket.io` + `socket.io-client` | 1 | WebSocket framework — foundational, handles transport negotiation |
| `zod` | 1 | Validation — used on every route via `lib/validation.js` |
| `vitest` + `@vitest/coverage-v8` | 1 | Test runner — build tooling |
| `sax` | 2 | Streaming XML parser for Apple Health 500MB+ exports; no native equivalent |
| `ws` | 2 | CDP protocol in 3 service files; `socket.io` transitively depends on it |
| `lucide-react` | 2 | 186 icons, 182 files — SVG replacement would be 1,000–1,500 lines |
| `@react-three/drei` | 1 | CyberCity 3D components — each alone is 200+ lines of Three.js |
| `@react-three/fiber` | 1 | React-Three.js integration — foundational for CyberCity 3D |
| `@xterm/xterm` + addons | 1 | Terminal emulator — no browser-native replacement |
| `react` + `react-dom` | 1 | Foundational |
| `react-router-dom` | 1 | Routing — foundational |
| `three` | 1 | 3D rendering engine — core to CyberCity feature |
| `@dnd-kit/*` | 2 | Deferred — accessibility (keyboard nav + ARIA) adds significant complexity |
| `recharts` | 2 | Deferred — 9-file rewrite exceeds 300-line ceiling |
| `eslint` + plugins + `tailwindcss` + `vite` | 1 | Build/lint tooling — org standard |
| `@eslint/js`, `@tailwindcss/postcss`, `@vitejs/plugin-react` | 1 | Build tooling |

---

## Future Ideas

- [x] **Chronotype-Aware Scheduling** — Genome sleep markers for peak-focus task scheduling
- **Identity Context Injection** — Per-task-type digital twin preamble toggle
- [x] **Agent Confidence & Autonomy Levels** — Dynamic tiers based on success rates
- **Content Calendar** — Unified calendar across platforms
- [x] **Proactive Insight Alerts** — Brain connections, success drops, goal stalls, cost spikes
- **Goal Decomposition Engine** — Auto-decompose goals into task sequences
- **Knowledge Graph Visualization** — Extend BrainGraph 3D to full knowledge graph
- [x] **Time Capsule Snapshots** — Periodic versioned digital twin archives
- **Autobiography Prompt Chains** — LLM follow-ups building on prior answers
- **Legacy Export Format** — Identity as portable Markdown/PDF
- **Dashboard Customization** — Drag-and-drop widgets, named layouts
- **Workspace Contexts** — Project context syncing across shell, git, tasks
- **Inline Code Review Annotations** — One-click fix from self-improvement findings
- **Major Dependency Upgrades** — React 19, Zod 4, PM2 6, Vite 8
- [x] **Voice Capture for Brain** — Microphone + Web Speech API transcription
- [x] **RSS/Feed Ingestion** — Passive feed ingestion classified by interests
- [x] **Ambient Dashboard Mode** — Live status board for wall-mounted displays
- **Dynamic Skill Marketplace** — Self-generating skill templates from task patterns
