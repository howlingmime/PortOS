import { request, API_BASE } from './apiCore.js';

export const listAskConversations = () => request('/ask');
export const getAskConversation = (id) => request(`/ask/${encodeURIComponent(id)}`);
export const deleteAskConversation = (id) => request(`/ask/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const promoteAskConversation = (id, promoted = true) => request(`/ask/${encodeURIComponent(id)}/promote`, {
  method: 'POST',
  body: JSON.stringify({ promoted }),
});

/**
 * Stream an Ask turn via Server-Sent Events. Consumes the event-stream
 * response from POST /api/ask manually because EventSource only supports GET.
 *
 * Returns an AbortController.signal-aware Promise that resolves when the
 * server closes the stream. Each event is delivered to `onEvent({ event, data })`.
 *
 * Events: 'open' | 'sources' | 'delta' | 'error' | 'done'
 */
export async function streamAskTurn(payload, { onEvent, signal } = {}) {
  const response = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    let message = `HTTP ${response.status}`;
    try { message = JSON.parse(text)?.error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let frameEnd;
    while ((frameEnd = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);
      currentEvent = 'message';
      let dataLine = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      let data = null;
      try { data = JSON.parse(dataLine); } catch { data = { raw: dataLine }; }
      onEvent?.({ event: currentEvent, data });
    }
  }
}
