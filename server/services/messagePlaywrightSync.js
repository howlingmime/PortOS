import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { ensureDir, PATHS, safeJSONParse } from '../lib/fileUtils.js';

const SELECTORS_FILE = join(PATHS.messages, 'selectors.json');

export async function getSelectors() {
  const content = await readFile(SELECTORS_FILE, 'utf-8').catch(() => null);
  if (!content) return {};
  return safeJSONParse(content, {}, { context: 'messageSelectors' });
}

export async function updateSelectors(provider, selectors) {
  const all = await getSelectors();
  all[provider] = selectors;
  await ensureDir(PATHS.messages);
  await writeFile(SELECTORS_FILE, JSON.stringify(all, null, 2));
  return all[provider];
}

/**
 * Sync messages via Playwright CDP browser automation
 * Uses browser_snapshot (accessibility tree) as primary extraction
 */
export async function syncPlaywright(account, cache, io) {
  console.log(`📧 Playwright sync for ${account.email} (${account.type}) — automation pending`);
  io?.emit('messages:sync:progress', { accountId: account.id, current: 0, total: 0 });
  // TODO: Connect to CDP browser on port 5556
  // 1. Navigate to Outlook/Teams
  // 2. Check for Okta login page → emit messages:sync:auth-required if detected
  // 3. Use browser_snapshot for accessibility tree extraction
  // 4. Fall back to CSS selectors from selectors.json
  // 5. Extract messages and return array
  return [];
}

/**
 * Send message via Playwright browser automation
 */
export async function sendPlaywright(account, draft) {
  console.log(`📧 Playwright send for ${account.email} (${account.type}) — automation pending`);
  // TODO: Connect to CDP browser, fill compose form, send
  return { success: false, error: 'Playwright send not configured' };
}

/**
 * Test selectors against the current page
 */
export async function testSelectors(provider) {
  console.log(`📧 Testing ${provider} selectors — automation pending`);
  // TODO: Connect to CDP, run selector tests, return results
  return { provider, results: {}, status: 'pending' };
}
