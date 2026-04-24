/**
 *   GET    /api/dashboard/layouts           → { activeLayoutId, layouts }
 *   PUT    /api/dashboard/layouts/active    → { activeLayoutId }  (body: { id })
 *   PUT    /api/dashboard/layouts/:id       → saves/updates a single layout
 *   DELETE /api/dashboard/layouts/:id       → deletes a user-created layout
 */

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ServerError } from '../lib/errorHandler.js';
import { validateRequest } from '../lib/validation.js';
import * as svc from '../services/dashboardLayouts.js';

const router = Router();

const layoutSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'id must be lowercase kebab'),
  name: z.string().min(1).max(80),
  widgets: z.array(z.string().min(1).max(80)).max(50),
});

const setActiveSchema = z.object({
  id: z.string().min(1).max(60),
});

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await svc.getState());
}));

router.put('/active', asyncHandler(async (req, res) => {
  const { id } = validateRequest(setActiveSchema, req.body ?? {});
  const state = await svc.setActiveLayout(id).catch((err) => {
    throw new ServerError(err.message, { status: 404 });
  });
  res.json(state);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const body = validateRequest(layoutSchema, { ...req.body, id: req.params.id });
  res.json(await svc.saveLayout(body));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const state = await svc.deleteLayout(String(req.params.id)).catch((err) => {
    throw new ServerError(err.message, { status: err.message.includes('Cannot delete') ? 400 : 404 });
  });
  res.json(state);
}));

export default router;
