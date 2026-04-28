import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPR, extractAgentSummary, parseGitHubOwnerFromRemote, pickGhAccountForOwner } from './git.js';

describe('parseGitHubOwnerFromRemote', () => {
  it('parses SSH urls (with and without .git suffix)', () => {
    expect(parseGitHubOwnerFromRemote('git@github.com:atomantic/PortOS.git')).toBe('atomantic');
    expect(parseGitHubOwnerFromRemote('git@github.com:atomantic/PortOS')).toBe('atomantic');
  });

  it('parses HTTPS urls (with and without .git suffix)', () => {
    expect(parseGitHubOwnerFromRemote('https://github.com/atomantic/PortOS.git')).toBe('atomantic');
    expect(parseGitHubOwnerFromRemote('https://github.com/atomantic/PortOS')).toBe('atomantic');
    expect(parseGitHubOwnerFromRemote('http://github.com/atomantic/PortOS')).toBe('atomantic');
  });

  it('returns null for non-github hosts', () => {
    expect(parseGitHubOwnerFromRemote('git@gitlab.com:foo/bar.git')).toBeNull();
    expect(parseGitHubOwnerFromRemote('https://bitbucket.org/foo/bar')).toBeNull();
  });

  it('returns null for empty or null input', () => {
    expect(parseGitHubOwnerFromRemote('')).toBeNull();
    expect(parseGitHubOwnerFromRemote(null)).toBeNull();
    expect(parseGitHubOwnerFromRemote(undefined)).toBeNull();
  });

  it('returns null for malformed urls', () => {
    expect(parseGitHubOwnerFromRemote('github.com:atomantic/PortOS')).toBeNull();
    expect(parseGitHubOwnerFromRemote('git@github.com:noslash')).toBeNull();
  });
});

describe('pickGhAccountForOwner', () => {
  it('matches owner to account case-insensitively', () => {
    expect(pickGhAccountForOwner('atomantic', ['atomantic', 'ClawedCode'])).toBe('atomantic');
    expect(pickGhAccountForOwner('Atomantic', ['atomantic', 'ClawedCode'])).toBe('atomantic');
    expect(pickGhAccountForOwner('clawedcode', ['atomantic', 'ClawedCode'])).toBe('ClawedCode');
    expect(pickGhAccountForOwner('CLAWEDCODE', ['atomantic', 'ClawedCode'])).toBe('ClawedCode');
  });

  it('returns null when no account matches the owner', () => {
    expect(pickGhAccountForOwner('someorg', ['atomantic', 'ClawedCode'])).toBeNull();
  });

  it('returns null with empty inputs', () => {
    expect(pickGhAccountForOwner('atomantic', [])).toBeNull();
    expect(pickGhAccountForOwner('atomantic', null)).toBeNull();
    expect(pickGhAccountForOwner(null, ['atomantic'])).toBeNull();
    expect(pickGhAccountForOwner('', ['atomantic'])).toBeNull();
  });
});

describe('createPR', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression: `spawn` was previously used inside createPR but the
  // `import { spawn } from 'child_process'` line was dropped during a refactor,
  // causing every CoS-agent PR to fail with "spawn is not defined" and falling
  // back to the recovery-task path. The check below ensures a real call into
  // createPR doesn't throw a ReferenceError before completing.
  it('does not throw ReferenceError when spawn is invoked (regression: missing spawn import)', async () => {
    // Use a non-existent cwd; gh will simply fail to launch ("ENOENT") which
    // is the desired failure mode — it must surface as a structured
    // { success: false, error: ... } object, not a thrown ReferenceError.
    const result = await createPR('/nonexistent-path-for-test', {
      title: 'test',
      body: 'test',
      base: 'main',
      head: 'test-branch'
    });

    expect(result).toHaveProperty('success', false);
    expect(typeof result.error).toBe('string');
    // The error must come from gh/spawn behavior, NOT from a missing-import bug.
    expect(result.error).not.toMatch(/spawn is not defined/);
  });
});

describe('extractAgentSummary', () => {
  it('returns null for short output', () => {
    expect(extractAgentSummary(null)).toBeNull();
    expect(extractAgentSummary('')).toBeNull();
    expect(extractAgentSummary('too short')).toBeNull();
  });

  it('extracts trailing summary after last tool-call line', () => {
    const output = [
      'Investigating the bug.',
      '🔧 Using Read tool',
      '  → /path/to/file.js',
      '',
      'Implemented the fix by adding the missing null check on line 42.',
      'All tests pass: 187/187.'
    ].join('\n');

    const summary = extractAgentSummary(output);
    expect(summary).toContain('Implemented the fix');
    expect(summary).toContain('All tests pass');
    expect(summary).not.toContain('🔧');
  });
});
