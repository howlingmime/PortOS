/**
 * Dashboard Layouts
 *
 * Named, user-customizable dashboard layouts. Each layout stores an ordered
 * list of widget ids; the client's widget registry decides how to render
 * each id. Persisted to data/dashboard-layouts.json.
 *
 * Seeded on first read with a "Default" layout (mirrors the current hardcoded
 * layout) plus "Focus", "Morning Review", and "Ops" starter layouts so the
 * feature has value out of the box.
 */

import { join } from 'path';
import { PATHS, atomicWrite, readJSONFile, ensureDir } from '../lib/fileUtils.js';

const STATE_PATH = join(PATHS.data, 'dashboard-layouts.json');

// Widget ids are the contract between this file and the client registry —
// see client/src/components/dashboard/widgetRegistry.js. If a layout refers
// to an unknown id, the client skips it gracefully.
const DEFAULT_LAYOUTS = [
  {
    id: 'default',
    name: 'Everything',
    builtIn: true,
    widgets: [
      'quick-brain', 'quick-task',
      'apps',
      'cos', 'goal-progress', 'upcoming-tasks',
      'proactive-alerts', 'review-hub', 'system-health', 'backup', 'death-clock', 'quick-stats', 'decision-log',
      'activity-streak', 'hourly-activity',
    ],
  },
  {
    id: 'focus',
    name: 'Focus',
    builtIn: true,
    widgets: ['quick-task', 'upcoming-tasks', 'cos'],
  },
  {
    id: 'morning-review',
    name: 'Morning Review',
    builtIn: true,
    widgets: ['proactive-alerts', 'upcoming-tasks', 'review-hub', 'goal-progress', 'death-clock'],
  },
  {
    id: 'ops',
    name: 'Ops',
    builtIn: true,
    widgets: ['system-health', 'cos', 'backup', 'apps', 'quick-stats'],
  },
];

const DEFAULT_STATE = {
  activeLayoutId: 'default',
  layouts: DEFAULT_LAYOUTS,
};

export async function getState() {
  await ensureDir(PATHS.data);
  const raw = await readJSONFile(STATE_PATH, DEFAULT_STATE, { logError: false });
  // If the file exists but has drifted (missing fields, or user deleted all
  // layouts), merge in defaults conservatively rather than returning junk.
  const layouts = Array.isArray(raw.layouts) && raw.layouts.length > 0
    ? raw.layouts
    : DEFAULT_LAYOUTS;
  const activeLayoutId = layouts.find((l) => l.id === raw.activeLayoutId)
    ? raw.activeLayoutId
    : layouts[0].id;
  return { activeLayoutId, layouts };
}

export async function setActiveLayout(id) {
  const state = await getState();
  if (!state.layouts.find((l) => l.id === id)) {
    throw new Error(`Unknown layout id: ${id}`);
  }
  const next = { ...state, activeLayoutId: id };
  await atomicWrite(STATE_PATH, next);
  return next;
}

export async function saveLayout(layout) {
  const state = await getState();
  const idx = state.layouts.findIndex((l) => l.id === layout.id);
  const merged = idx >= 0
    ? state.layouts.map((l, i) => i === idx ? { ...l, ...layout, builtIn: l.builtIn } : l)
    : [...state.layouts, { ...layout, builtIn: false }];
  const next = { ...state, layouts: merged };
  await atomicWrite(STATE_PATH, next);
  return next;
}

export async function deleteLayout(id) {
  const state = await getState();
  const target = state.layouts.find((l) => l.id === id);
  if (!target) throw new Error(`Unknown layout id: ${id}`);
  if (target.builtIn) throw new Error(`Cannot delete built-in layout: ${id}`);
  const remaining = state.layouts.filter((l) => l.id !== id);
  const activeLayoutId = state.activeLayoutId === id ? remaining[0].id : state.activeLayoutId;
  const next = { activeLayoutId, layouts: remaining };
  await atomicWrite(STATE_PATH, next);
  return next;
}
