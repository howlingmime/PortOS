/**
 * PortOS Changelog Service
 *
 * Extracts recent PortOS feature commits from git history.
 * Used by the daily briefing to highlight new features for the user.
 */

import { execFileSync } from 'child_process';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { readJSONFile, ensureDir, PATHS, DAY } from '../lib/fileUtils.js';

const STATE_FILE = join(PATHS.data, 'portos-changelog.json');
const NUL = '\x00';

const DEFAULT_STATE = { lastBriefedAt: null, lastBriefedCommit: null };

function parseConventionalCommit(message) {
  const match = message.match(/^(feat|fix|refactor|perf|docs|chore|style|test)(?:\(([^)]+)\))?:\s*(.+)/);
  if (!match) return null;
  return { type: match[1], scope: match[2] || null, description: match[3] };
}

/**
 * @param {string} [since] - ISO date string. Defaults to last briefed time or 24h ago.
 * @returns {{ features: Array, fixes: Array, other: Array, since: string }}
 */
export async function getRecentChanges(since) {
  let sinceDate = since;
  if (!sinceDate) {
    const state = await readJSONFile(STATE_FILE, DEFAULT_STATE);
    sinceDate = state.lastBriefedAt || new Date(Date.now() - DAY).toISOString();
  }

  let raw;
  try {
    // NUL delimiter avoids breakage from | in commit messages
    raw = execFileSync('git', [
      'log', `--since=${sinceDate}`, '--no-merges', `--format=%H${NUL}%s${NUL}%ai`
    ], { cwd: process.cwd(), encoding: 'utf-8', windowsHide: true }).trim();
  } catch {
    console.log('📋 PortOS changelog: git not available, skipping');
    return { features: [], fixes: [], other: [], since: sinceDate };
  }

  if (!raw) {
    return { features: [], fixes: [], other: [], since: sinceDate };
  }

  const features = [];
  const fixes = [];
  const other = [];

  for (const line of raw.split('\n')) {
    const [hash, message, date] = line.split(NUL);
    const parsed = parseConventionalCommit(message);
    const commit = { hash: hash?.slice(0, 8), message, date, parsed };
    if (parsed?.type === 'feat') features.push(commit);
    else if (parsed?.type === 'fix') fixes.push(commit);
    else if (parsed) other.push(commit);
  }

  return { features, fixes, other, since: sinceDate };
}

export async function markBriefed() {
  let headCommit;
  try {
    headCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: process.cwd(), encoding: 'utf-8', windowsHide: true
    }).trim();
  } catch {
    console.log('📋 PortOS changelog: git not available, skipping markBriefed');
    return DEFAULT_STATE;
  }

  const state = {
    lastBriefedAt: new Date().toISOString(),
    lastBriefedCommit: headCommit
  };

  await ensureDir(dirname(STATE_FILE));
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`📋 PortOS changelog briefed at ${headCommit}`);
  return state;
}

export async function getState() {
  return readJSONFile(STATE_FILE, DEFAULT_STATE);
}
