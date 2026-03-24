import { describe, it, expect, vi, beforeEach } from 'vitest';

const NUL = '\x00';

vi.mock('child_process', () => ({
  execFileSync: vi.fn()
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../lib/fileUtils.js', () => ({
  readJSONFile: vi.fn(),
  PATHS: { data: '/mock/data' },
  DAY: 86400000
}));

import { execFileSync } from 'child_process';
import { writeFile } from 'fs/promises';
import { readJSONFile } from '../lib/fileUtils.js';
import { getRecentChanges, markBriefed, getState } from './portosChangelog.js';

beforeEach(() => {
  vi.clearAllMocks();
  readJSONFile.mockResolvedValue({ lastBriefedAt: null, lastBriefedCommit: null });
});

describe('getRecentChanges', () => {
  it('returns empty arrays when no commits found', async () => {
    execFileSync.mockReturnValue('');
    const result = await getRecentChanges();
    expect(result.features).toEqual([]);
    expect(result.fixes).toEqual([]);
    expect(result.other).toEqual([]);
  });

  it('parses feature commits correctly', async () => {
    execFileSync.mockReturnValue(
      `abc12345${NUL}feat(cos): add new briefing section${NUL}2026-03-23 10:00:00 -0700\n` +
      `def67890${NUL}feat(ui): add dark mode toggle${NUL}2026-03-23 09:00:00 -0700`
    );
    const result = await getRecentChanges();
    expect(result.features).toHaveLength(2);
    expect(result.features[0].parsed.type).toBe('feat');
    expect(result.features[0].parsed.scope).toBe('cos');
    expect(result.features[0].parsed.description).toBe('add new briefing section');
    expect(result.features[0].hash).toBe('abc12345');
  });

  it('separates features from fixes', async () => {
    execFileSync.mockReturnValue(
      `abc12345${NUL}feat(cos): add feature${NUL}2026-03-23 10:00:00 -0700\n` +
      `def67890${NUL}fix(ui): broken button${NUL}2026-03-23 09:00:00 -0700`
    );
    const result = await getRecentChanges();
    expect(result.features).toHaveLength(1);
    expect(result.fixes).toHaveLength(1);
    expect(result.fixes[0].parsed.type).toBe('fix');
  });

  it('categorizes refactor/chore/docs as other', async () => {
    execFileSync.mockReturnValue(
      `abc12345${NUL}refactor(api): clean up routes${NUL}2026-03-23 10:00:00 -0700\n` +
      `def67890${NUL}chore: update deps${NUL}2026-03-23 09:00:00 -0700`
    );
    const result = await getRecentChanges();
    expect(result.features).toHaveLength(0);
    expect(result.fixes).toHaveLength(0);
    expect(result.other).toHaveLength(2);
  });

  it('uses lastBriefedAt from state when no since param provided', async () => {
    readJSONFile.mockResolvedValue({ lastBriefedAt: '2026-03-22T00:00:00Z', lastBriefedCommit: 'aaa' });
    execFileSync.mockReturnValue('');
    const result = await getRecentChanges();
    expect(result.since).toBe('2026-03-22T00:00:00Z');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['--since=2026-03-22T00:00:00Z']),
      expect.any(Object)
    );
  });

  it('skips state file read when since param is provided', async () => {
    execFileSync.mockReturnValue('');
    const result = await getRecentChanges('2026-03-20T00:00:00Z');
    expect(result.since).toBe('2026-03-20T00:00:00Z');
    expect(readJSONFile).not.toHaveBeenCalled();
  });

  it('handles commits without conventional format', async () => {
    execFileSync.mockReturnValue(
      `abc12345${NUL}feat(cos): add feature${NUL}2026-03-23 10:00:00 -0700\n` +
      `bbb22222${NUL}Merge branch main${NUL}2026-03-23 08:00:00 -0700`
    );
    const result = await getRecentChanges();
    expect(result.features).toHaveLength(1);
    expect(result.fixes).toHaveLength(0);
    expect(result.other).toHaveLength(0);
  });

  it('handles feat commits without scope', async () => {
    execFileSync.mockReturnValue(`abc12345${NUL}feat: global feature${NUL}2026-03-23 10:00:00 -0700`);
    const result = await getRecentChanges();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].parsed.scope).toBeNull();
    expect(result.features[0].parsed.description).toBe('global feature');
  });
});

describe('markBriefed', () => {
  it('writes state file with current commit hash', async () => {
    execFileSync.mockReturnValue('abc1234\n');
    const result = await markBriefed();
    expect(result.lastBriefedCommit).toBe('abc1234');
    expect(result.lastBriefedAt).toBeDefined();
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('portos-changelog.json'),
      expect.any(String)
    );
  });
});

describe('getState', () => {
  it('returns default state when no file exists', async () => {
    readJSONFile.mockResolvedValue({ lastBriefedAt: null, lastBriefedCommit: null });
    const state = await getState();
    expect(state.lastBriefedAt).toBeNull();
    expect(state.lastBriefedCommit).toBeNull();
  });
});
