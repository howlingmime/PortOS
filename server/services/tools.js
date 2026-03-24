/**
 * Tools Registry Service
 *
 * Manages onboard tools (image generation, etc.) that CoS agents can discover and use.
 * Tools are stored as individual JSON files in data/tools/.
 */

import { readFile, writeFile, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ensureDir, PATHS } from '../lib/fileUtils.js';

const toolPath = (id) => join(PATHS.tools, `${id}.json`);

export async function getTools() {
  await ensureDir(PATHS.tools);
  const files = await readdir(PATHS.tools);
  const tools = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const raw = await readFile(join(PATHS.tools, f), 'utf-8').catch(() => null);
    if (raw) tools.push(JSON.parse(raw));
  }
  return tools;
}

export async function getTool(id) {
  const raw = await readFile(toolPath(id), 'utf-8').catch(() => null);
  return raw ? JSON.parse(raw) : null;
}

export async function getEnabledTools() {
  const all = await getTools();
  return all.filter(t => t.enabled);
}

export async function getToolsByCategory(category) {
  const all = await getTools();
  return all.filter(t => t.category === category);
}

export async function registerTool(config) {
  await ensureDir(PATHS.tools);
  const now = new Date().toISOString();
  const tool = {
    id: config.id || randomUUID(),
    name: config.name,
    category: config.category,
    description: config.description || '',
    enabled: config.enabled ?? true,
    config: config.config || {},
    promptHints: config.promptHints || '',
    createdAt: now,
    updatedAt: now
  };
  await writeFile(toolPath(tool.id), JSON.stringify(tool, null, 2) + '\n');
  console.log(`🔧 Tool registered: ${tool.name} (${tool.id})`);
  return tool;
}

export async function updateTool(id, updates) {
  const existing = await getTool(id);
  if (!existing) return null;
  const merged = {
    ...existing,
    ...updates,
    id, // prevent id override
    updatedAt: new Date().toISOString()
  };
  await writeFile(toolPath(id), JSON.stringify(merged, null, 2) + '\n');
  console.log(`🔧 Tool updated: ${merged.name} (${id})`);
  return merged;
}

export async function deleteTool(id) {
  await unlink(toolPath(id)).catch(() => null);
  console.log(`🗑️ Tool deleted: ${id}`);
}

export function getToolsSummaryForPrompt() {
  return getEnabledTools().then(tools => {
    if (tools.length === 0) return '';
    const lines = tools.map(t => {
      const hint = t.promptHints ? ` — ${t.promptHints}` : '';
      return `- **${t.name}** (${t.category}): ${t.description}${hint}`;
    });
    return `## Available Tools\nThe following onboard tools are available for this instance:\n\n${lines.join('\n')}\n`;
  });
}
