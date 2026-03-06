import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { ensureDir, PATHS, safeJSONParse } from '../lib/fileUtils.js';
import { getAccount, updateSyncStatus } from './messageAccounts.js';

const CACHE_DIR = join(PATHS.messages, 'cache');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const syncLocks = new Map();

function safeDate(d) {
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

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

async function loadCache(accountId) {
  if (!UUID_RE.test(accountId)) throw new Error(`Invalid accountId: ${accountId}`);
  await ensureDir(CACHE_DIR);
  const filePath = join(CACHE_DIR, `${accountId}.json`);
  const content = await readFile(filePath, 'utf-8').catch(() => null);
  if (!content) return { syncCursor: null, messages: [] };
  const parsed = safeJSONParse(content, { syncCursor: null, messages: [] }, { context: `messageCache:${accountId}` });
  if (!parsed || !Array.isArray(parsed.messages)) return { syncCursor: null, messages: [] };
  return parsed;
}

async function saveCache(accountId, cache) {
  await ensureDir(CACHE_DIR);
  const filePath = join(CACHE_DIR, `${accountId}.json`);
  await writeFile(filePath, JSON.stringify(cache, null, 2));
}

export async function getMessages(options = {}) {
  const { accountId, search, limit = 50, offset = 0 } = options;
  // If specific account, just load that cache
  if (accountId) {
    const cache = await loadCache(accountId);
    let messages = cache.messages.map(m => ({ ...m, accountId: m.accountId || accountId }));
    messages = filterBySearch(messages, search);
    return {
      messages: messages.sort((a, b) => safeDate(b.date) - safeDate(a.date)).slice(offset, offset + limit),
      total: messages.length
    };
  }

  // Otherwise aggregate across all account caches
  await ensureDir(CACHE_DIR);
  const { readdir } = await import('fs/promises');
  const files = await readdir(CACHE_DIR).catch(() => []);
  let allMessages = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const fileAccountId = file.replace('.json', '');
    if (!UUID_RE.test(fileAccountId)) continue;
    const cache = await loadCache(fileAccountId);
    allMessages.push(...cache.messages.map(m => ({ ...m, accountId: m.accountId || fileAccountId })));
  }
  allMessages = filterBySearch(allMessages, search);
  allMessages.sort((a, b) => safeDate(b.date) - safeDate(a.date));
  return {
    messages: allMessages.slice(offset, offset + limit),
    total: allMessages.length
  };
}

export async function deleteCache(accountId) {
  if (!UUID_RE.test(accountId)) return;
  const { unlink } = await import('fs/promises');
  const filePath = join(CACHE_DIR, `${accountId}.json`);
  try {
    await unlink(filePath);
    console.log(`🗑️ Message cache deleted for account ${accountId}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`🗑️ No message cache to delete for account ${accountId}`);
    } else {
      console.error(`❌ Failed to delete message cache for account ${accountId}: ${err.message}`);
    }
  }
}

export async function getMessage(accountId, messageId) {
  const cache = await loadCache(accountId);
  const msg = cache.messages.find(m => m.id === messageId);
  if (!msg) return null;
  return { ...msg, accountId: msg.accountId || accountId };
}

export async function syncAccount(accountId, io, options = {}) {
  if (syncLocks.has(accountId)) return { error: 'Sync already in progress', status: 409 };

  const account = await getAccount(accountId);
  if (!account) return { error: 'Account not found' };
  if (!account.enabled) return { error: 'Account is disabled', status: 400 };

  syncLocks.set(accountId, true);
  const mode = options.mode || 'unread';
  io?.emit('messages:sync:started', { accountId, mode });
  console.log(`📧 Starting ${mode} sync for ${account.name} (${account.type})`);

  const providerSync = async () => {
    const cache = await loadCache(accountId);
    let providerResult;
    if (account.type === 'gmail') {
      const { syncGmail } = await import('./messageGmailSync.js');
      providerResult = await syncGmail(account, cache, io);
    } else if (account.type === 'outlook' || account.type === 'teams') {
      const { syncPlaywright } = await import('./messagePlaywrightSync.js');
      providerResult = await syncPlaywright(account, cache, io, { mode });
    } else {
      throw new Error(`Unsupported account type: ${account.type}`);
    }

    // Support structured result { messages, status } or plain array
    const newMessages = Array.isArray(providerResult) ? providerResult : providerResult?.messages ?? [];
    const providerStatus = Array.isArray(providerResult) ? 'success' : providerResult?.status ?? 'success';

    // Deduplicate by externalId; update flags on existing messages
    const existingMap = new Map(cache.messages.filter(m => m.externalId).map(m => [m.externalId, m]));
    const uniqueNew = [];
    for (const msg of newMessages) {
      if (!msg.externalId || !existingMap.has(msg.externalId)) {
        uniqueNew.push(msg);
      } else {
        // Update flags on existing message
        const existing = existingMap.get(msg.externalId);
        if (msg.isUnread !== undefined) existing.isUnread = msg.isUnread;
        if (msg.isRead !== undefined) existing.isRead = msg.isRead;
        if (msg.isPinned !== undefined) existing.isPinned = msg.isPinned;
        if (msg.isFlagged !== undefined) existing.isFlagged = msg.isFlagged;
        if (msg.isReplied !== undefined) existing.isReplied = msg.isReplied;
        if (msg.hasMeetingInvite !== undefined) existing.hasMeetingInvite = msg.hasMeetingInvite;
      }
    }
    cache.messages.push(...uniqueNew);

    // Trim to maxMessages
    if (account.syncConfig?.maxMessages && cache.messages.length > account.syncConfig.maxMessages) {
      cache.messages.sort((a, b) => safeDate(b.date) - safeDate(a.date));
      cache.messages = cache.messages.slice(0, account.syncConfig.maxMessages);
    }

    await saveCache(accountId, cache);
    await updateSyncStatus(accountId, providerStatus === 'success' ? 'success' : providerStatus);

    io?.emit('messages:sync:completed', { accountId, newMessages: uniqueNew.length, status: providerStatus });
    if (providerStatus === 'success') {
      io?.emit('messages:changed', {});
    }
    console.log(`📧 Sync complete for ${account.name}: ${uniqueNew.length} new, status=${providerStatus}`);

    return { newMessages: uniqueNew.length, total: cache.messages.length, status: providerStatus };
  };

  const result = await providerSync().catch(async (error) => {
    console.error(`📧 Sync failed for ${account.name} (${account.type}): ${error.message}`);
    await updateSyncStatus(accountId, 'error').catch(() => {});
    io?.emit('messages:sync:failed', { accountId, error: error.message });
    return { error: error.message, status: 502 };
  }).finally(() => {
    syncLocks.delete(accountId);
  });

  return result;
}

export async function updateMessageEvaluations(evaluations) {
  await ensureDir(CACHE_DIR);
  const { readdir } = await import('fs/promises');
  const files = await readdir(CACHE_DIR).catch(() => []);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const accountId = file.replace('.json', '');
    if (!UUID_RE.test(accountId)) continue;
    const cache = await loadCache(accountId);
    let changed = false;
    for (const msg of cache.messages) {
      if (evaluations[msg.id]) {
        msg.evaluation = evaluations[msg.id];
        changed = true;
      }
    }
    if (changed) await saveCache(accountId, cache);
  }
}

export async function getSyncStatus(accountId) {
  const account = await getAccount(accountId);
  if (!account) return null;
  return {
    accountId,
    lastSyncAt: account.lastSyncAt,
    lastSyncStatus: account.lastSyncStatus
  };
}
