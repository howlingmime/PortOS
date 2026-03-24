/**
 * Image Generation Service
 *
 * Handles communication with Stable Diffusion API (AUTOMATIC1111 / Forge WebUI).
 * Generated images are stored in data/images/.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ensureDir, PATHS } from '../lib/fileUtils.js';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.js';
import { getSettings } from './settings.js';

async function getSdApiUrl() {
  const settings = await getSettings();
  return settings.imageGen?.sdapiUrl || null;
}

export async function checkConnection() {
  const baseUrl = await getSdApiUrl();
  if (!baseUrl) return { connected: false, reason: 'No SD API URL configured' };

  const res = await fetchWithTimeout(`${baseUrl}/sdapi/v1/options`, {}, 10000).catch(() => null);
  if (!res?.ok) return { connected: false, reason: 'SD API unreachable' };

  const options = await res.json().catch(() => null);
  return {
    connected: true,
    model: options?.sd_model_checkpoint || 'unknown'
  };
}

export async function generateImage({ prompt, negativePrompt, width, height, steps, cfgScale, seed }) {
  const baseUrl = await getSdApiUrl();
  if (!baseUrl) throw new Error('No SD API URL configured — set it in Settings > Image Gen');

  // Auto-detect model for Flux-specific parameters
  const status = await checkConnection();
  const isFlux = status.model?.toLowerCase().includes('flux');

  const payload = {
    prompt,
    negative_prompt: negativePrompt || 'blurry, low quality, distorted, deformed, ugly, watermark, text, signature',
    steps: steps || (isFlux ? 15 : 25),
    width: width || (isFlux ? 832 : 512),
    height: height || (isFlux ? 1216 : 768),
    cfg_scale: cfgScale ?? (isFlux ? 1 : 7),
    sampler_name: isFlux ? 'Euler' : 'Euler a',
    ...(isFlux && { scheduler: 'simple' }),
    batch_size: 1,
    ...(seed != null && seed >= 0 && { seed })
  };

  console.log(`🎨 Generating image: ${prompt.slice(0, 80)}... (${payload.width}x${payload.height}, ${payload.steps} steps)`);

  const res = await fetchWithTimeout(
    `${baseUrl}/sdapi/v1/txt2img`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    300000 // 5 min timeout for generation
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SD API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.images?.length) throw new Error('SD API returned no images');

  // Save base64 image to disk
  await ensureDir(PATHS.images);
  const filename = `${randomUUID()}.png`;
  const filePath = join(PATHS.images, filename);
  await writeFile(filePath, Buffer.from(data.images[0], 'base64'));

  console.log(`🖼️ Image saved: ${filename}`);
  return { filename, path: `/data/images/${filename}` };
}

export async function generateAvatar({ name, characterClass, prompt }) {
  const defaultPrompt = `fantasy portrait of ${name || 'an adventurer'}, ${characterClass || 'warrior'} class, D&D character art, detailed, dramatic lighting, painterly style`;
  return generateImage({
    prompt: prompt || defaultPrompt,
    width: 512,
    height: 512,
    negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, signature, nude, nsfw'
  });
}
