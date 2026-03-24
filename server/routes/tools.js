/**
 * Tools Registry Routes
 *
 * CRUD endpoints for managing onboard tools available to CoS agents.
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errorHandler.js';
import { validateRequest } from '../lib/validation.js';
import * as toolsService from '../services/tools.js';

const router = Router();

const registerToolSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  promptHints: z.string().max(1000).optional()
});

const updateToolSchema = registerToolSchema.partial();

// GET /api/tools - List all tools
router.get('/', asyncHandler(async (req, res) => {
  const tools = await toolsService.getTools();
  res.json(tools);
}));

// GET /api/tools/enabled - List enabled tools
router.get('/enabled', asyncHandler(async (req, res) => {
  const tools = await toolsService.getEnabledTools();
  res.json(tools);
}));

// GET /api/tools/summary - Get prompt-ready summary for agents
router.get('/summary', asyncHandler(async (req, res) => {
  const summary = await toolsService.getToolsSummaryForPrompt();
  res.json({ summary });
}));

// GET /api/tools/:id - Get single tool
router.get('/:id', asyncHandler(async (req, res) => {
  const tool = await toolsService.getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  res.json(tool);
}));

// POST /api/tools - Register a new tool
router.post('/', asyncHandler(async (req, res) => {
  const data = validateRequest(registerToolSchema, req.body);
  const tool = await toolsService.registerTool(data);
  res.status(201).json(tool);
}));

// PUT /api/tools/:id - Update a tool
router.put('/:id', asyncHandler(async (req, res) => {
  const data = validateRequest(updateToolSchema, req.body);
  const tool = await toolsService.updateTool(req.params.id, data);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  res.json(tool);
}));

// DELETE /api/tools/:id - Delete a tool
router.delete('/:id', asyncHandler(async (req, res) => {
  await toolsService.deleteTool(req.params.id);
  res.status(204).end();
}));

export default router;
