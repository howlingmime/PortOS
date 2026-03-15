/**
 * Review Hub Service
 *
 * Manages review items: todos, alerts, briefing notes, and CoS action requests.
 * Aggregates items requiring user attention into a single hub.
 */

import { writeFile, rename, readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { ensureDir, PATHS, readJSONFile } from '../lib/fileUtils.js';
import { cosEvents } from './cosEvents.js';

const DATA_DIR = join(PATHS.data, 'review');
const ITEMS_FILE = join(DATA_DIR, 'items.json');

export const reviewEvents = new EventEmitter();

// Valid item types and statuses
const ITEM_TYPES = ['alert', 'todo', 'briefing', 'cos'];
const ITEM_STATUSES = ['pending', 'completed', 'dismissed'];

/**
 * Load all review items from file
 */
async function loadItems() {
  return readJSONFile(ITEMS_FILE, []);
}

/**
 * Save items to file atomically
 */
async function saveItems(items) {
  await ensureDir(DATA_DIR);
  const tmpFile = `${ITEMS_FILE}.tmp`;
  await writeFile(tmpFile, JSON.stringify(items, null, 2));
  await rename(tmpFile, ITEMS_FILE);
}

/**
 * Get all review items, sorted by type then creation date (newest first)
 */
export async function getItems({ status, type } = {}) {
  let items = await loadItems();
  if (status) items = items.filter(i => i.status === status);
  if (type) items = items.filter(i => i.type === type);
  return items.sort((a, b) => {
    const typeOrder = ITEM_TYPES.indexOf(a.type) - ITEM_TYPES.indexOf(b.type);
    if (typeOrder !== 0) return typeOrder;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/**
 * Get count of pending items by type
 */
export async function getPendingCounts() {
  const items = await loadItems();
  return items.reduce((acc, i) => {
    if (i.status !== 'pending') return acc;
    acc.total++;
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, { total: 0, alert: 0, todo: 0, briefing: 0, cos: 0 });
}

/**
 * Create a new review item
 */
export async function createItem({ type, title, description = '', metadata = {} }) {
  if (!ITEM_TYPES.includes(type)) {
    const err = new Error(`Invalid item type: ${type}`);
    err.status = 400;
    throw err;
  }

  const items = await loadItems();

  // Prevent duplicate alerts for same reference within 24 hours
  if (type === 'alert' && metadata?.referenceId) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const duplicate = items.find(i =>
      i.type === 'alert' &&
      i.metadata?.referenceId === metadata.referenceId &&
      new Date(i.createdAt).getTime() > oneDayAgo
    );
    if (duplicate) return duplicate;
  }

  const item = {
    id: uuidv4(),
    type,
    title,
    description,
    status: 'pending',
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  items.push(item);
  await saveItems(items);
  console.log(`📋 Review item created: ${type} — ${title}`);
  reviewEvents.emit('item:created', item);
  return item;
}

/**
 * Update an item's status
 */
async function updateItemStatus(id, status) {
  if (!ITEM_STATUSES.includes(status)) {
    const err = new Error(`Invalid status: ${status}`);
    err.status = 400;
    throw err;
  }

  const items = await loadItems();
  const item = items.find(i => i.id === id);
  if (!item) {
    const err = new Error(`Review item not found: ${id}`);
    err.status = 404;
    throw err;
  }

  item.status = status;
  item.updatedAt = new Date().toISOString();
  await saveItems(items);
  console.log(`📋 Review item ${status}: ${item.type} — ${item.title}`);
  reviewEvents.emit('item:updated', item);
  return item;
}

/**
 * Mark an item as completed
 */
export async function completeItem(id) {
  return updateItemStatus(id, 'completed');
}

/**
 * Dismiss an item
 */
export async function dismissItem(id) {
  return updateItemStatus(id, 'dismissed');
}

/**
 * Update a todo item's title and/or description
 */
export async function updateItem(id, { title, description }) {
  const items = await loadItems();
  const item = items.find(i => i.id === id);
  if (!item) {
    const err = new Error(`Review item not found: ${id}`);
    err.status = 404;
    throw err;
  }

  if (title !== undefined) item.title = title;
  if (description !== undefined) item.description = description;
  item.updatedAt = new Date().toISOString();
  await saveItems(items);
  reviewEvents.emit('item:updated', item);
  return item;
}

/**
 * Delete a review item
 */
export async function deleteItem(id) {
  const items = await loadItems();
  const index = items.findIndex(i => i.id === id);
  if (index === -1) {
    const err = new Error(`Review item not found: ${id}`);
    err.status = 404;
    throw err;
  }

  const [removed] = items.splice(index, 1);
  await saveItems(items);
  console.log(`📋 Review item deleted: ${removed.type} — ${removed.title}`);
  reviewEvents.emit('item:deleted', removed);
  return removed;
}

/**
 * Get daily briefing content from CoS briefing or PLAN.md
 */
export async function getBriefing() {
  // Try CoS briefing first
  const briefingFile = join(PATHS.cos, 'briefing.json');
  const briefing = await readJSONFile(briefingFile, null);
  if (briefing?.content) {
    return { source: 'cos', content: briefing.content, generatedAt: briefing.generatedAt };
  }

  // Fall back to PLAN.md
  const planFile = join(PATHS.root, 'PLAN.md');
  let planContent = null;
  try {
    planContent = await readFile(planFile, 'utf-8');
  } catch {
    // No PLAN.md
  }

  if (planContent) {
    return { source: 'plan', content: planContent, generatedAt: new Date().toISOString() };
  }

  return { source: 'none', content: 'No briefing or plan available.', generatedAt: new Date().toISOString() };
}

/**
 * Bridge CoS events into review items
 */
cosEvents.on('memory:approval-needed', (data) => {
  createItem({
    type: 'alert',
    title: `Memory approval: ${data?.title ?? 'New memory entry'}`,
    description: data?.content ?? '',
    metadata: { referenceId: data?.id, category: 'memory-approval' }
  }).catch(err => console.error(`❌ Failed to create review alert: ${err.message}`));
});

cosEvents.on('task:ready', (data) => {
  createItem({
    type: 'cos',
    title: data?.title ?? data?.description ?? 'CoS action requires review',
    description: data?.description ?? '',
    metadata: { taskId: data?.id, referenceId: data?.id }
  }).catch(err => console.error(`❌ Failed to create review item: ${err.message}`));
});
