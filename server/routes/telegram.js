import { Router } from 'express';
import { asyncHandler, ServerError } from '../lib/errorHandler.js';
import { telegramConfigSchema, telegramTestSchema } from '../lib/telegramValidation.js';
import { getSettings, updateSettings } from '../services/settings.js';
import * as telegram from '../services/telegram.js';

const router = Router();

// GET /api/telegram/status
router.get('/status', asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const status = telegram.getStatus();
  res.json({
    ...status,
    hasToken: !!settings.secrets?.telegram?.token,
    hasChatId: !!settings.telegram?.chatId,
    forwardTypes: settings.telegram?.forwardTypes || []
  });
}));

// PUT /api/telegram/config
router.put('/config', asyncHandler(async (req, res) => {
  const result = telegramConfigSchema.safeParse(req.body);
  if (!result.success) {
    throw new ServerError('Validation failed', {
      status: 400,
      code: 'VALIDATION_ERROR',
      context: { details: result.error.errors }
    });
  }

  const { token, chatId } = result.data;
  const settings = await getSettings();

  // Preserve existing token if a new one wasn't provided
  const finalToken = token || settings.secrets?.telegram?.token;

  if (!finalToken) {
    throw new ServerError('Bot token is required', {
      status: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  // Store token in secrets, chatId in telegram
  await updateSettings({
    secrets: {
      ...settings.secrets,
      telegram: { token: finalToken }
    },
    telegram: {
      ...settings.telegram,
      chatId: chatId || settings.telegram?.chatId || ''
    }
  });

  // Initialize bot — send test message only if chatId is configured
  const hasChatId = !!(chatId || settings.telegram?.chatId);
  await telegram.init(hasChatId);
  const status = telegram.getStatus();

  res.json({
    ...status,
    hasToken: true,
    hasChatId
  });
}));

// DELETE /api/telegram/config
router.delete('/config', asyncHandler(async (req, res) => {
  await telegram.cleanup();

  const settings = await getSettings();
  await updateSettings({
    telegram: null,
    secrets: { ...settings.secrets, telegram: undefined }
  });

  res.json({ success: true });
}));

// POST /api/telegram/test
router.post('/test', asyncHandler(async (req, res) => {
  const result = telegramTestSchema.safeParse(req.body);
  if (!result.success) {
    throw new ServerError('Validation failed', {
      status: 400,
      code: 'VALIDATION_ERROR',
      context: { details: result.error.errors }
    });
  }

  const message = result.data.message || '🧪 Test message from PortOS';
  const sendResult = await telegram.sendMessage(message);

  if (!sendResult.success) {
    throw new ServerError(sendResult.error || 'Failed to send test message', {
      status: 502,
      code: 'TELEGRAM_SEND_FAILED'
    });
  }

  res.json({ success: true });
}));

// PUT /api/telegram/forward-types
router.put('/forward-types', asyncHandler(async (req, res) => {
  const { forwardTypes } = req.body;
  if (!Array.isArray(forwardTypes)) {
    throw new ServerError('forwardTypes must be an array', {
      status: 400,
      code: 'VALIDATION_ERROR'
    });
  }

  const settings = await getSettings();
  await updateSettings({
    telegram: {
      ...settings.telegram,
      forwardTypes
    }
  });

  // Update in-memory cache
  telegram.updateCachedForwardTypes(forwardTypes);

  res.json({ success: true, forwardTypes });
}));

export default router;
