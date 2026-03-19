# PortOS — Development Plan

For project goals, see [GOALS.md](./GOALS.md). For completed work, see [DONE.md](./DONE.md).

---

## Next Up

1. **M50 P8**: Messages — Digital Twin voice drafting for email responses (reads COMMUNICATION.md, PERSONALITY.md, VALUES.md + thread context)
2. **M42 P5**: Cross-Insights Engine — connect genome + taste + personality + goals into derived insights. See [Identity System](./docs/features/identity-system.md)
3. **M34 P5-P7**: Digital Twin — Multi-modal capture, advanced testing, personas

## Backlog

- [ ] **God file decomposition** — Split cos.js (3,952 lines), subAgentSpawner.js (3,307 lines), digital-twin.js (2,823 lines), routes/scaffold.js (1,668 lines), routes/cos.js (1,355 lines), client/api.js (1,853 lines) into focused modules. Resolve cos.js ↔ subAgentSpawner.js circular dependency
- [ ] **M50 P9**: CoS Automation & Rules — Automated email classification, rule-based pre-filtering, email-to-task pipeline, priority notifications
- [ ] **M50 P10**: Auto-Send with AI Review Gate — Configurable per-account trust level, second LLM reviews drafts for prompt injection/tone drift. See [Messages Security](./docs/features/messages-security.md)

## Outstanding Audit Findings (2026-03-05)

**Known low-severity:** pm2 ReDoS (GHSA-x5gf-qvw8-r2rm) — no upstream fix, not exploitable via PortOS routes.

### Bugs & Code Quality
_All bug items from 2026-03-05 audit resolved — see [DONE.md](./DONE.md)_

### DRY (still present)
- [ ] Duplicate DATA_DIR/path constants in ~84 files
- [ ] ~100 instances of `mkdir({recursive:true})` vs centralized `ensureDir()`

### Test Coverage
- ~29% service coverage, ~12% route coverage
- Critical gaps: `cos.js`, `cosRunnerClient.js`, `agentActionExecutor.js`
- Inconsistent pagination patterns and error response envelope

---

## Future Ideas

### Tier 1: Identity Integration
- **Chronotype-Aware Scheduling** — Use genome sleep markers for peak-focus task scheduling
- **Identity Context Injection** — Per-task-type toggle for digital twin preamble injection

### Tier 2: Deeper Autonomy
- **Agent Confidence & Autonomy Levels** — Graduate from static presets to dynamic tiers based on success rates
- **Content Calendar** — Unified calendar view of planned content across platforms
- **Proactive Insight Alerts** — Notifications for brain connections, success drops, goal stalls, cost spikes
- **Goal Decomposition Engine** — Auto-decompose goals into task sequences with dependencies

### Tier 3: Knowledge & Legacy
- **Knowledge Graph Visualization** — Extend existing BrainGraph 3D view to full knowledge graph
- **Time Capsule Snapshots** — Periodic versioned archives of digital twin state
- **Autobiography Prompt Chains** — LLM-generated follow-ups building on prior autobiography answers
- **Legacy Export Format** — Compile identity into portable Markdown/PDF document

### Tier 4: Developer Experience
- **Dashboard Customization** — Drag-and-drop widget reordering, show/hide toggles, named layouts
- **Workspace Contexts** — Active project context syncing across shell, git, tasks, browser
- **Inline Code Review Annotations** — Surface self-improvement findings as inline annotations with one-click fix
- **Major Dependency Upgrades** — React 19, Zod 4, PM2 6, Vite 8

### Tier 5: Multi-Modal & Future
- **Voice Capture for Brain** — Microphone + Web Speech API transcription to brain pipeline
- **RSS/Feed Ingestion** — Passive feed ingestion classified by interests
- **Ambient Dashboard Mode** — Live status board for wall-mounted displays
- **Dynamic Skill Marketplace** — Self-generating skill templates from task patterns
