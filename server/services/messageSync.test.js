import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises before importing the module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn()
}));

vi.mock('../lib/fileUtils.js', () => ({
  ensureDir: vi.fn(),
  PATHS: { messages: '/mock/data/messages' },
  safeJSONParse: vi.fn((content, fallback) => {
    if (!content) return fallback;
    const parsed = JSON.parse(content);
    return parsed;
  })
}));

vi.mock('./messageAccounts.js', () => ({
  getAccount: vi.fn(),
  updateSyncStatus: vi.fn()
}));

vi.mock('./messageGmailSync.js', () => ({
  syncGmail: vi.fn()
}));

vi.mock('./messagePlaywrightSync.js', () => ({
  syncPlaywright: vi.fn()
}));

import { readFile, writeFile, readdir, unlink } from 'fs/promises';
import { getMessages, getMessage, syncAccount, deleteCache, getSyncStatus } from './messageSync.js';
import { getAccount, updateSyncStatus } from './messageAccounts.js';
import { syncGmail } from './messageGmailSync.js';
import { syncPlaywright } from './messagePlaywrightSync.js';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const VALID_UUID_2 = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: cache file not found
  readFile.mockRejectedValue(new Error('ENOENT'));
  writeFile.mockResolvedValue();
});

// ─── Pure logic: inline copies for unit testing ───

describe('safeDate (inline)', () => {
  function safeDate(d) {
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  it('should return timestamp for valid date string', () => {
    expect(safeDate('2026-01-15T10:00:00Z')).toBe(new Date('2026-01-15T10:00:00Z').getTime());
  });

  it('should return 0 for invalid date', () => {
    expect(safeDate('not-a-date')).toBe(0);
  });

  it('should return 0 for null/undefined', () => {
    expect(safeDate(null)).toBe(0);
    expect(safeDate(undefined)).toBe(0);
  });
});

describe('filterBySearch (inline)', () => {
  function filterBySearch(messages, search) {
    if (!search) return messages;
    const q = search.toLowerCase();
    return messages.filter(m =>
      m.subject?.toLowerCase().includes(q) ||
      m.from?.name?.toLowerCase().includes(q) ||
      m.from?.email?.toLowerCase().includes(q) ||
      m.bodyText?.toLowerCase().includes(q)
    );
  }

  it('should return all messages when no search term', () => {
    const msgs = [{ subject: 'A' }, { subject: 'B' }];
    expect(filterBySearch(msgs, '')).toHaveLength(2);
    expect(filterBySearch(msgs, null)).toHaveLength(2);
  });

  it('should filter by subject', () => {
    const msgs = [{ subject: 'Meeting Notes' }, { subject: 'Invoice' }];
    expect(filterBySearch(msgs, 'meeting')).toHaveLength(1);
    expect(filterBySearch(msgs, 'meeting')[0].subject).toBe('Meeting Notes');
  });

  it('should filter by from.name', () => {
    const msgs = [{ from: { name: 'Alice' } }, { from: { name: 'Bob' } }];
    expect(filterBySearch(msgs, 'alice')).toHaveLength(1);
  });

  it('should filter by from.email', () => {
    const msgs = [{ from: { email: 'alice@test.com' } }, { from: { email: 'bob@test.com' } }];
    expect(filterBySearch(msgs, 'alice@')).toHaveLength(1);
  });

  it('should filter by bodyText', () => {
    const msgs = [{ bodyText: 'Hello world' }, { bodyText: 'Goodbye' }];
    expect(filterBySearch(msgs, 'hello')).toHaveLength(1);
  });

  it('should handle messages with missing fields', () => {
    const msgs = [{ id: '1' }, { subject: 'Test' }];
    expect(filterBySearch(msgs, 'test')).toHaveLength(1);
  });
});

// ─── Dedup logic (inline) ───

describe('dedup by externalId (inline)', () => {
  function dedup(existing, incoming) {
    const existingIds = new Set(existing.map(m => m.externalId).filter(Boolean));
    return incoming.filter(m => !m.externalId || !existingIds.has(m.externalId));
  }

  it('should filter out messages with duplicate externalId', () => {
    const existing = [{ externalId: 'ext-1' }, { externalId: 'ext-2' }];
    const incoming = [{ externalId: 'ext-2' }, { externalId: 'ext-3' }];
    const result = dedup(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe('ext-3');
  });

  it('should keep incoming messages without externalId (no dedup)', () => {
    const existing = [{ externalId: 'ext-1' }];
    const incoming = [{ id: 'local-1' }, { id: 'local-2' }];
    const result = dedup(existing, incoming);
    expect(result).toHaveLength(2);
  });

  it('should keep all messages when no overlap', () => {
    const existing = [{ externalId: 'ext-1' }];
    const incoming = [{ externalId: 'ext-2' }, { externalId: 'ext-3' }];
    expect(dedup(existing, incoming)).toHaveLength(2);
  });

  it('should handle empty existing cache', () => {
    const existing = [];
    const incoming = [{ externalId: 'ext-1' }];
    expect(dedup(existing, incoming)).toHaveLength(1);
  });
});

// ─── Trimming logic (inline) ───

describe('message trimming (inline)', () => {
  function trimMessages(messages, maxMessages) {
    if (!maxMessages || messages.length <= maxMessages) return messages;
    // Sort newest first, then slice
    const sorted = [...messages].sort((a, b) => {
      const ta = new Date(b.date).getTime();
      const tb = new Date(a.date).getTime();
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });
    return sorted.slice(0, maxMessages);
  }

  it('should not trim when under limit', () => {
    const msgs = [{ date: '2026-01-01' }, { date: '2026-01-02' }];
    expect(trimMessages(msgs, 10)).toHaveLength(2);
  });

  it('should trim oldest messages when over limit', () => {
    const msgs = [
      { date: '2026-01-01', id: 'old' },
      { date: '2026-01-03', id: 'new' },
      { date: '2026-01-02', id: 'mid' }
    ];
    const result = trimMessages(msgs, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('new');
    expect(result[1].id).toBe('mid');
  });

  it('should not trim when maxMessages is falsy', () => {
    const msgs = [{ date: '2026-01-01' }];
    expect(trimMessages(msgs, 0)).toHaveLength(1);
    expect(trimMessages(msgs, undefined)).toHaveLength(1);
  });
});

// ─── Cache I/O: getMessages ───

describe('getMessages', () => {
  it('should return empty messages when cache file does not exist', async () => {
    const result = await getMessages({ accountId: VALID_UUID });
    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should load and return messages from cache for a specific account', async () => {
    const cache = {
      syncCursor: 'cur-1',
      messages: [
        { id: 'msg-1', subject: 'Hello', date: '2026-01-02T00:00:00Z', externalId: 'ext-1' },
        { id: 'msg-2', subject: 'World', date: '2026-01-01T00:00:00Z', externalId: 'ext-2' }
      ]
    };
    readFile.mockResolvedValue(JSON.stringify(cache));

    const result = await getMessages({ accountId: VALID_UUID });

    expect(result.messages).toHaveLength(2);
    expect(result.total).toBe(2);
    // Should be sorted newest first
    expect(result.messages[0].subject).toBe('Hello');
    expect(result.messages[1].subject).toBe('World');
  });

  it('should stamp accountId onto messages', async () => {
    const cache = { messages: [{ id: 'msg-1', subject: 'Test' }] };
    readFile.mockResolvedValue(JSON.stringify(cache));

    const result = await getMessages({ accountId: VALID_UUID });
    expect(result.messages[0].accountId).toBe(VALID_UUID);
  });

  it('should apply search filter', async () => {
    const cache = {
      messages: [
        { id: 'msg-1', subject: 'Meeting Notes', date: '2026-01-01' },
        { id: 'msg-2', subject: 'Invoice', date: '2026-01-01' }
      ]
    };
    readFile.mockResolvedValue(JSON.stringify(cache));

    const result = await getMessages({ accountId: VALID_UUID, search: 'meeting' });
    expect(result.messages).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should apply offset and limit', async () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      id: `msg-${i}`, subject: `Msg ${i}`, date: `2026-01-${String(i + 1).padStart(2, '0')}`
    }));
    readFile.mockResolvedValue(JSON.stringify({ messages: msgs }));

    const result = await getMessages({ accountId: VALID_UUID, limit: 3, offset: 2 });
    expect(result.messages).toHaveLength(3);
    expect(result.total).toBe(10);
  });

  it('should aggregate across all account caches when no accountId', async () => {
    readdir.mockResolvedValue([`${VALID_UUID}.json`, `${VALID_UUID_2}.json`, 'not-uuid.json']);
    readFile.mockImplementation((filePath) => {
      if (filePath.includes(VALID_UUID_2)) {
        return Promise.resolve(JSON.stringify({
          messages: [{ id: 'msg-b', subject: 'From B', date: '2026-01-02' }]
        }));
      }
      return Promise.resolve(JSON.stringify({
        messages: [{ id: 'msg-a', subject: 'From A', date: '2026-01-01' }]
      }));
    });

    const result = await getMessages({});
    expect(result.total).toBe(2);
    // Newest first
    expect(result.messages[0].id).toBe('msg-b');
  });

  it('should return empty when readdir fails (no cache dir)', async () => {
    readdir.mockRejectedValue(new Error('ENOENT'));

    const result = await getMessages({});
    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ─── getMessage ───

describe('getMessage', () => {
  it('should return a specific message by id', async () => {
    const cache = {
      messages: [
        { id: 'msg-1', subject: 'Hello' },
        { id: 'msg-2', subject: 'World' }
      ]
    };
    readFile.mockResolvedValue(JSON.stringify(cache));

    const result = await getMessage(VALID_UUID, 'msg-2');
    expect(result.subject).toBe('World');
    expect(result.accountId).toBe(VALID_UUID);
  });

  it('should return null when message not found', async () => {
    readFile.mockResolvedValue(JSON.stringify({ messages: [] }));
    const result = await getMessage(VALID_UUID, 'nonexistent');
    expect(result).toBeNull();
  });
});

// ─── deleteCache ───

describe('deleteCache', () => {
  it('should call unlink for valid accountId', async () => {
    unlink.mockResolvedValue();
    await deleteCache(VALID_UUID);
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining(`${VALID_UUID}.json`));
  });

  it('should silently skip invalid accountId', async () => {
    await deleteCache('not-a-uuid');
    expect(unlink).not.toHaveBeenCalled();
  });
});

// ─── syncAccount ───

describe('syncAccount', () => {
  const mockIo = { emit: vi.fn() };

  beforeEach(() => {
    mockIo.emit.mockClear();
  });

  it('should return 400 when account is disabled', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Test', type: 'gmail', enabled: false });

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(result).toEqual({ error: 'Account is disabled', status: 400 });
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  it('should return error when account not found', async () => {
    getAccount.mockResolvedValue(null);

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(result).toEqual({ error: 'Account not found' });
  });

  it('should call syncGmail for gmail accounts and save cache', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ syncCursor: null, messages: [] }));
    syncGmail.mockResolvedValue([{ id: 'msg-1', externalId: 'ext-1', date: '2026-01-01' }]);
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(syncGmail).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(result.newMessages).toBe(1);
    expect(result.total).toBe(1);
    expect(result.status).toBe('success');
    expect(updateSyncStatus).toHaveBeenCalledWith(VALID_UUID, 'success');
    expect(mockIo.emit).toHaveBeenCalledWith('messages:sync:started', { accountId: VALID_UUID });
    expect(mockIo.emit).toHaveBeenCalledWith('messages:sync:completed', expect.objectContaining({ accountId: VALID_UUID, newMessages: 1 }));
    expect(mockIo.emit).toHaveBeenCalledWith('messages:changed', {});
  });

  it('should call syncPlaywright for outlook accounts', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Outlook', type: 'outlook', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ syncCursor: null, messages: [] }));
    syncPlaywright.mockResolvedValue([]);
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(syncPlaywright).toHaveBeenCalled();
    expect(result.newMessages).toBe(0);
  });

  it('should call syncPlaywright for teams accounts', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Teams', type: 'teams', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ syncCursor: null, messages: [] }));
    syncPlaywright.mockResolvedValue([]);
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(syncPlaywright).toHaveBeenCalled();
  });

  it('should deduplicate by externalId during sync', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true });
    const existingCache = {
      syncCursor: 'cur-1',
      messages: [{ id: 'msg-1', externalId: 'ext-1', date: '2026-01-01' }]
    };
    readFile.mockResolvedValue(JSON.stringify(existingCache));
    // Provider returns one duplicate and one new
    syncGmail.mockResolvedValue([
      { id: 'msg-1-dup', externalId: 'ext-1', date: '2026-01-01' },
      { id: 'msg-2', externalId: 'ext-2', date: '2026-01-02' }
    ]);
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(result.newMessages).toBe(1);
    expect(result.total).toBe(2); // 1 existing + 1 new
    // Verify saved cache has 2 messages
    const savedData = JSON.parse(writeFile.mock.calls[0][1]);
    expect(savedData.messages).toHaveLength(2);
  });

  it('should keep messages without externalId (no dedup for those)', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ messages: [{ id: 'msg-1' }] }));
    syncGmail.mockResolvedValue([{ id: 'msg-2' }]); // no externalId
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(result.newMessages).toBe(1);
    expect(result.total).toBe(2);
  });

  it('should trim messages when exceeding maxMessages', async () => {
    getAccount.mockResolvedValue({
      id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true,
      syncConfig: { maxMessages: 2 }
    });
    const existingCache = {
      messages: [
        { id: 'msg-old', externalId: 'ext-old', date: '2026-01-01' },
        { id: 'msg-mid', externalId: 'ext-mid', date: '2026-01-02' }
      ]
    };
    readFile.mockResolvedValue(JSON.stringify(existingCache));
    syncGmail.mockResolvedValue([
      { id: 'msg-new', externalId: 'ext-new', date: '2026-01-03' }
    ]);
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(result.total).toBe(2); // trimmed from 3 to 2
    const savedData = JSON.parse(writeFile.mock.calls[0][1]);
    expect(savedData.messages).toHaveLength(2);
    // Oldest message should have been trimmed
    const ids = savedData.messages.map(m => m.id);
    expect(ids).toContain('msg-new');
    expect(ids).toContain('msg-mid');
    expect(ids).not.toContain('msg-old');
  });

  it('should handle structured provider result with status', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ messages: [] }));
    syncGmail.mockResolvedValue({ messages: [{ id: 'msg-1', externalId: 'ext-1' }], status: 'partial' });
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, mockIo);

    expect(result.status).toBe('partial');
    expect(result.newMessages).toBe(1);
    expect(updateSyncStatus).toHaveBeenCalledWith(VALID_UUID, 'partial');
    // Should NOT emit messages:changed for non-success status
    expect(mockIo.emit).not.toHaveBeenCalledWith('messages:changed', {});
    expect(mockIo.emit).toHaveBeenCalledWith('messages:sync:completed', expect.objectContaining({ status: 'partial' }));
  });

  it('should return 409 when sync is already in progress (lock)', async () => {
    // Use a deferred promise to keep loadCache hanging so the lock stays held
    let resolveReadFile;
    getAccount.mockResolvedValue({ id: VALID_UUID_2, name: 'Gmail', type: 'gmail', enabled: true });
    // First readFile call (loadCache inside providerSync) hangs; subsequent calls resolve
    let callCount = 0;
    readFile.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return new Promise(resolve => { resolveReadFile = resolve; });
      }
      return Promise.resolve(JSON.stringify({ messages: [] }));
    });
    updateSyncStatus.mockResolvedValue();

    // Start first sync (don't await — it will hang on loadCache)
    const firstSync = syncAccount(VALID_UUID_2, mockIo);
    // Yield to let the first sync reach the lock point
    await new Promise(r => setTimeout(r, 10));

    // Second sync should be rejected with 409
    const secondResult = await syncAccount(VALID_UUID_2, mockIo);
    expect(secondResult).toEqual({ error: 'Sync already in progress', status: 409 });

    // Clean up: resolve the hanging readFile so firstSync completes
    resolveReadFile(JSON.stringify({ messages: [] }));
    await firstSync;
  });

  it('should release lock after sync completes', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ messages: [] }));
    syncGmail.mockResolvedValue([]);
    updateSyncStatus.mockResolvedValue();

    await syncAccount(VALID_UUID, mockIo);
    // Second sync should work (lock released)
    const result = await syncAccount(VALID_UUID, mockIo);
    expect(result).not.toHaveProperty('status', 409);
  });

  it('should release lock and emit failed on provider error', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Err', type: 'badtype', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ messages: [] }));
    updateSyncStatus.mockResolvedValue();

    // 'badtype' triggers throw new Error('Unsupported account type: badtype')
    const result = await syncAccount(VALID_UUID, mockIo);

    expect(result).toEqual({ error: 'Unsupported account type: badtype', status: 502 });
    expect(updateSyncStatus).toHaveBeenCalledWith(VALID_UUID, 'error');
    expect(mockIo.emit).toHaveBeenCalledWith('messages:sync:failed', {
      accountId: VALID_UUID,
      error: 'Unsupported account type: badtype'
    });

    // Lock should be released — next sync should not get 409
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true });
    const result2 = await syncAccount(VALID_UUID, mockIo);
    expect(result2).not.toHaveProperty('status', 409);
  });

  it('should work when io is null/undefined', async () => {
    getAccount.mockResolvedValue({ id: VALID_UUID, name: 'Gmail', type: 'gmail', enabled: true });
    readFile.mockResolvedValue(JSON.stringify({ messages: [] }));
    syncGmail.mockResolvedValue([]);
    updateSyncStatus.mockResolvedValue();

    const result = await syncAccount(VALID_UUID, null);
    expect(result.newMessages).toBe(0);
  });
});

// ─── getSyncStatus ───

describe('getSyncStatus', () => {
  it('should return sync status for existing account', async () => {
    getAccount.mockResolvedValue({
      id: VALID_UUID, lastSyncAt: '2026-01-01T00:00:00Z', lastSyncStatus: 'success'
    });

    const result = await getSyncStatus(VALID_UUID);

    expect(result).toEqual({
      accountId: VALID_UUID,
      lastSyncAt: '2026-01-01T00:00:00Z',
      lastSyncStatus: 'success'
    });
  });

  it('should return null for nonexistent account', async () => {
    getAccount.mockResolvedValue(null);
    expect(await getSyncStatus(VALID_UUID)).toBeNull();
  });
});
