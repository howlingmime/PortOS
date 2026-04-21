import { Router } from 'express';
import { existsSync, statSync, createReadStream } from 'fs';
import { join } from 'path';
import { PATHS } from '../lib/fileUtils.js';

const router = Router();
const AVATAR_PATH = join(PATHS.data, 'avatar', 'model.glb');

router.head('/model.glb', (req, res) => {
  if (!existsSync(AVATAR_PATH)) {
    return res.status(404).end();
  }
  const s = statSync(AVATAR_PATH);
  res.set('Content-Type', 'model/gltf-binary');
  res.set('Content-Length', String(s.size));
  res.set('Cache-Control', 'public, max-age=60');
  return res.status(200).end();
});

router.get('/model.glb', (req, res) => {
  if (!existsSync(AVATAR_PATH)) {
    return res.status(404).json({ error: 'No avatar model configured. Drop a GLB at data/avatar/model.glb' });
  }
  res.set('Content-Type', 'model/gltf-binary');
  res.set('Cache-Control', 'public, max-age=60');
  createReadStream(AVATAR_PATH).pipe(res);
});

export default router;
