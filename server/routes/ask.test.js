import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { request } from '../lib/testHelper.js';
import { errorMiddleware } from '../lib/errorHandler.js';

vi.mock('../services/askConversations.js', () => ({
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  createConversation: vi.fn(),
  appendTurn: vi.fn(),
  deleteConversation: vi.fn(),
  setPromoted: vi.fn(),
}));

vi.mock('../services/askService.js', () => ({
  // The route imports the literal Set and spreads it for zod — keep the real
  // type so zod validation matches what production sees.
  VALID_MODES: new Set(['ask', 'advise', 'draft']),
  runAsk: vi.fn(),
}));

const convs = await import('../services/askConversations.js');
const svc = await import('../services/askService.js');
const { default: routes } = await import('./ask.js');

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ask', routes);
  app.use(errorMiddleware);
  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/ask', () => {
  it('returns a list of conversation summaries', async () => {
    convs.listConversations.mockResolvedValue([
      { id: 'ask_a_b', title: 'Old', mode: 'ask', turnCount: 2, createdAt: 'x', updatedAt: 'x', promoted: false },
    ]);
    const res = await request(makeApp()).get('/api/ask');
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
  });
});

describe('GET /api/ask/:id', () => {
  it('404s for missing conversation', async () => {
    convs.getConversation.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/ask/ask_x_dead');
    expect(res.status).toBe(404);
  });

  it('returns the conversation', async () => {
    convs.getConversation.mockResolvedValue({ id: 'ask_x_a1', turns: [], mode: 'ask' });
    const res = await request(makeApp()).get('/api/ask/ask_x_a1');
    expect(res.status).toBe(200);
    expect(res.body.conversation.id).toBe('ask_x_a1');
  });
});

describe('DELETE /api/ask/:id', () => {
  it('deletes when the service confirms', async () => {
    convs.deleteConversation.mockResolvedValue(true);
    const res = await request(makeApp()).delete('/api/ask/ask_x_a1');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('404s when nothing was removed', async () => {
    convs.deleteConversation.mockResolvedValue(false);
    const res = await request(makeApp()).delete('/api/ask/ask_x_a1');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/ask/:id/promote', () => {
  it('promotes the conversation', async () => {
    convs.setPromoted.mockResolvedValue({ id: 'ask_x_a1', promoted: true });
    const res = await request(makeApp())
      .post('/api/ask/ask_x_a1/promote')
      .send({ promoted: true });
    expect(res.status).toBe(200);
    expect(convs.setPromoted).toHaveBeenCalledWith('ask_x_a1', true);
  });

  it('404s when the conversation does not exist', async () => {
    convs.setPromoted.mockResolvedValue(null);
    const res = await request(makeApp())
      .post('/api/ask/ask_x_a1/promote')
      .send({ promoted: true });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/ask (validation)', () => {
  it('rejects empty questions', async () => {
    const res = await request(makeApp())
      .post('/api/ask')
      .send({ question: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown modes', async () => {
    const res = await request(makeApp())
      .post('/api/ask')
      .send({ question: 'hi', mode: 'shout' });
    expect(res.status).toBe(400);
  });

  it('rejects malformed conversationIds', async () => {
    const res = await request(makeApp())
      .post('/api/ask')
      .send({ question: 'hi', conversationId: 'not-an-id' });
    expect(res.status).toBe(400);
  });

  it('404s when conversationId is well-formed but unknown', async () => {
    convs.getConversation.mockResolvedValue(null);
    const res = await request(makeApp())
      .post('/api/ask')
      .send({ question: 'hi', conversationId: 'ask_x_aaaaaa' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/ask (streaming happy path)', () => {
  it('streams open → sources → delta → done as SSE', async () => {
    convs.createConversation.mockResolvedValue({ id: 'ask_new_abcdef', mode: 'ask', turns: [] });
    convs.appendTurn.mockImplementation((id, turn) => Promise.resolve({
      conversation: { id, mode: 'ask', turns: [{ ...turn, id: 'tid' }] },
      turn: { ...turn, id: 'tid' },
    }));
    // runAsk is async-iterable — emit a deterministic event sequence.
    svc.runAsk.mockImplementation(async function* () {
      yield { type: 'sources', sources: [{ kind: 'memory', id: 'memory:1', title: 'a', snippet: 'b' }] };
      yield { type: 'delta', text: 'Hi ' };
      yield { type: 'delta', text: 'there.' };
      yield { type: 'done', answer: 'Hi there.', sources: [], providerId: 'fake', model: 'm' };
    });

    const res = await request(makeApp())
      .post('/api/ask')
      .send({ question: 'hello' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type'] || '').toMatch(/text\/event-stream/);
    // testHelper buffers the whole body — assert event ordering and payloads
    // by string matching rather than parsing each frame.
    const body = res.text || '';
    expect(body).toContain('event: open');
    expect(body).toContain('"conversationId":"ask_new_abcdef"');
    expect(body).toContain('event: sources');
    expect(body).toContain('event: delta');
    expect(body).toContain('"text":"Hi "');
    expect(body).toContain('event: done');

    // The user turn must be persisted before streaming begins, and the
    // assistant turn after the stream closes — assert both happened.
    const roles = convs.appendTurn.mock.calls.map((c) => c[1].role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });
});
