/**
 * Shared AI provider utilities for LLM calls.
 * Used by insightsService, identity, goalCheckIn, taste-questionnaire, etc.
 */

import { getAllProviders } from '../services/providers.js';

const isAPI = (p) => p && p.type === 'api' && p.enabled !== false;

/**
 * Resolve an API-type provider for features that can only run against an API
 * endpoint (CLI providers don't support the simple chat-completions call path).
 *
 * Resolution order:
 *   1. The requested provider (if API-type)
 *   2. The user's active provider (if API-type)
 *   3. The first enabled API provider configured
 *
 * Returns null when no API provider is configured — callers should surface a
 * "configure an API provider" hint rather than re-throwing.
 */
export async function resolveAPIProvider(requestedProviderId) {
  // One read of providers.json — getAllProviders returns both the active id
  // and the full list, so we don't need separate getProviderById/getActiveProvider
  // round-trips for each step of the fallback chain.
  const all = await getAllProviders().catch(() => null);
  const providers = Array.isArray(all?.providers)
    ? all.providers
    : Object.values(all?.providers || {});

  if (requestedProviderId) {
    const requested = providers.find(p => p.id === requestedProviderId);
    if (isAPI(requested)) return requested;
  }
  if (all?.activeProvider) {
    const active = providers.find(p => p.id === all.activeProvider);
    if (isAPI(active)) return active;
  }
  return providers.find(isAPI) || null;
}

/**
 * Call an API-based AI provider with a simple prompt.
 * Returns { text } on success, { error } on failure.
 */
export async function callProviderAISimple(provider, model, prompt, { temperature = 0.3, max_tokens = 1000 } = {}) {
  const timeout = provider.timeout || 300000;

  if (provider.type === 'api') {
    const headers = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response;
    try {
      response = await fetch(`${provider.endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens
        })
      });
    } catch (err) {
      clearTimeout(timer);
      return { error: `Provider request failed: ${err.message}` };
    }

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { error: `Provider returned ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || '' };
  }

  return { error: 'This operation requires an API-based provider' };
}

/**
 * Strip markdown code fences from LLM output before JSON.parse.
 */
export function stripCodeFences(raw) {
  return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

/**
 * Parse JSON from LLM output, stripping code fences first.
 * Throws a descriptive error on parse failure.
 */
export function parseLLMJSON(raw) {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Invalid JSON from AI: ${e.message}`);
  }
}
