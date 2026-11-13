/**
 * RED MISSION — Backend AI Provider Adapter (Zero External Dependencies)
 * Supports Google Gemini and OpenAI-compatible Chat Completions (OpenAI, Groq, OpenRouter)
 * with both standard JSON responses and Server-Sent Events (SSE) streaming.
 */

import { getActiveAiConfig } from '../config/env.js';

export class AiProviderError extends Error {
  constructor(message, { status = 502, code = 'AI_PROVIDER_ERROR' } = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Redacts any configured API key from log or error strings before returning to callers.
 */
function sanitizeErrorText(rawText, apiKey) {
  let msg = String(rawText || 'AI service error');
  if (apiKey && apiKey.length >= 6) {
    msg = msg.split(apiKey).join('[REDACTED]');
  }
  return msg;
}

function normalizeMessagesForProvider(messages = []) {
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }))
    .filter((m) => m.content.length > 0);
}

function buildGeminiPayload(messages, systemPrompt, aiConfig) {
  return {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxTokens,
    },
  };
}

function buildOpenAiPayload(messages, systemPrompt, aiConfig, stream) {
  return {
    model: aiConfig.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: aiConfig.temperature,
    max_tokens: aiConfig.maxTokens,
    stream: Boolean(stream),
  };
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  const retryDelays = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    const retryable =
      response.status === 429 ||
      response.status === 503 ||
      (response.status >= 500 && response.status <= 599);

    if (!retryable || attempt === maxRetries) {
      return response;
    }

    const retryAfter = response.headers.get('retry-after');
    const retryAfterMs = retryAfter
      ? Number.isNaN(Number(retryAfter))
        ? Math.max(0, new Date(retryAfter).getTime() - Date.now())
        : Number(retryAfter) * 1000
      : 0;

    const delay = Math.max(retryDelays[attempt], retryAfterMs);

    console.warn(
      `[RED MISSION AI] HTTP ${response.status}. Retry ${attempt + 1}/${maxRetries} after ${delay}ms.`
    );

    await response.body?.cancel().catch(() => {});
    await sleep(delay);
  }
}

function mapHttpError(status, providerName, rawBody, apiKey) {
  const safeBody = sanitizeErrorText(rawBody, apiKey);
  console.error(`[RED MISSION AI] Provider ${providerName} HTTP ${status}:`, safeBody.slice(0, 400));

  if (status === 401 || status === 403) {
    return new AiProviderError(
      'AI provider authentication failed. Please verify the backend AI API credentials.',
      { status: 502, code: 'AI_PROVIDER_AUTH_ERROR' }
    );
  }
  if (status === 429) {
    return new AiProviderError(
      'The AI service is temporarily busy. Please try again in a few moments.',
      { status: 429, code: 'AI_PROVIDER_RATE_LIMIT' }
    );
  }
  return new AiProviderError(
    'Unable to reach the AI assistant right now. Please try again shortly.',
    { status: 502, code: 'AI_UPSTREAM_ERROR' }
  );
}

async function parseSseStream(readableStream, onJsonEvent) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx;
    while ((sepIdx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const rawBlock = buffer.slice(0, sepIdx);
      const match = buffer.slice(sepIdx).match(/^\r?\n\r?\n/);
      buffer = buffer.slice(sepIdx + (match ? match[0].length : 2));

      const dataLines = rawBlock
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) continue;
      const payloadStr = dataLines.join('\n').trim();
      if (!payloadStr || payloadStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payloadStr);
        onJsonEvent(parsed);
      } catch {
        // Skip partial or keepalive non-JSON SSE lines safely
      }
    }
  }
}

/**
 * Generates a full (non-streaming) AI response from the configured LLM provider.
 */
export async function generateAiReply({ messages, systemPrompt, envOverrides } = {}) {
  const aiConfig = getActiveAiConfig(envOverrides);
  if (!aiConfig.configured) {
    throw new AiProviderError(
      'RED MISSION AI is waiting for backend provider configuration (AI_PROVIDER and API key).',
      { status: 503, code: 'AI_NOT_CONFIGURED' }
    );
  }

  const normalized = normalizeMessagesForProvider(messages);
  if (normalized.length === 0) {
    throw new AiProviderError('Message content cannot be empty.', { status: 400, code: 'EMPTY_MESSAGE' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiConfig.timeoutMs);

  try {
    if (aiConfig.provider === 'GEMINI') {
      const baseRoot = aiConfig.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const url = `${baseRoot.replace(/\/+$/, '')}/models/${encodeURIComponent(aiConfig.model)}:generateContent?key=${encodeURIComponent(aiConfig.apiKey)}`;
      const res = await fetchWithRetry(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(buildGeminiPayload(normalized, systemPrompt, aiConfig)),
  signal: controller.signal,
});

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw mapHttpError(res.status, 'GEMINI', errText, aiConfig.apiKey);
      }

      const data = await res.json();
      const reply = (data?.candidates?.[0]?.content?.parts || [])
        .map((p) => p?.text || '')
        .join('')
        .trim();

      if (!reply) {
        throw new AiProviderError('AI provider returned an empty response.', { status: 502, code: 'AI_EMPTY_RESPONSE' });
      }

      return { reply, provider: aiConfig.provider, model: aiConfig.model };
    }

    // OpenAI / Groq / OpenRouter (Chat Completions API)
    const endpoint = `${aiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey}`,
    };
    if (aiConfig.provider === 'OPENROUTER') {
      headers['HTTP-Referer'] = 'https://redmission.org';
      headers['X-Title'] = 'RED MISSION AI';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildOpenAiPayload(normalized, systemPrompt, aiConfig, false)),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw mapHttpError(res.status, aiConfig.provider, errText, aiConfig.apiKey);
    }

    const data = await res.json();
    const reply = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!reply) {
      throw new AiProviderError('AI provider returned an empty response.', { status: 502, code: 'AI_EMPTY_RESPONSE' });
    }

    return { reply, provider: aiConfig.provider, model: aiConfig.model };
  } catch (err) {
    if (err instanceof AiProviderError) throw err;
    if (err?.name === 'AbortError') {
      throw new AiProviderError('AI response timed out. Please try again.', { status: 504, code: 'AI_TIMEOUT' });
    }
    console.error('[RED MISSION AI] Request failure:', sanitizeErrorText(err?.message, aiConfig.apiKey));
    throw new AiProviderError('Unable to connect to the AI provider right now.', { status: 502, code: 'AI_NETWORK_ERROR' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Streams incremental AI response chunks via callback onChunk(deltaText).
 */
export async function streamAiReply({ messages, systemPrompt, onChunk, envOverrides } = {}) {
  const aiConfig = getActiveAiConfig(envOverrides);
  if (!aiConfig.configured) {
    throw new AiProviderError(
      'RED MISSION AI is waiting for backend provider configuration (AI_PROVIDER and API key).',
      { status: 503, code: 'AI_NOT_CONFIGURED' }
    );
  }

  const normalized = normalizeMessagesForProvider(messages);
  if (normalized.length === 0) {
    throw new AiProviderError('Message content cannot be empty.', { status: 400, code: 'EMPTY_MESSAGE' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiConfig.timeoutMs);

  try {
    let fullReply = '';

    if (aiConfig.provider === 'GEMINI') {
      const baseRoot = aiConfig.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const url = `${baseRoot.replace(/\/+$/, '')}/models/${encodeURIComponent(aiConfig.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(aiConfig.apiKey)}`;
      const res = await fetchWithRetry(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(buildGeminiPayload(normalized, systemPrompt, aiConfig)),
  signal: controller.signal,
});

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw mapHttpError(res.status, 'GEMINI', errText, aiConfig.apiKey);
      }

      if (!res.body) {
        const data = await res.json();
        const reply = (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('');
        if (reply) {
          fullReply += reply;
          onChunk?.(reply);
        }
        return { reply: fullReply.trim(), provider: aiConfig.provider, model: aiConfig.model };
      }

      await parseSseStream(res.body, (json) => {
        const delta = (json?.candidates?.[0]?.content?.parts || [])
          .map((p) => p?.text || '')
          .join('');
        if (delta) {
          fullReply += delta;
          onChunk?.(delta);
        }
      });

      if (!fullReply.trim()) {
        throw new AiProviderError('AI provider returned an empty stream.', { status: 502, code: 'AI_EMPTY_RESPONSE' });
      }
      return { reply: fullReply.trim(), provider: aiConfig.provider, model: aiConfig.model };
    }

    // OpenAI / Groq / OpenRouter SSE stream
    const endpoint = `${aiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey}`,
    };
    if (aiConfig.provider === 'OPENROUTER') {
      headers['HTTP-Referer'] = 'https://redmission.org';
      headers['X-Title'] = 'RED MISSION AI';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildOpenAiPayload(normalized, systemPrompt, aiConfig, true)),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw mapHttpError(res.status, aiConfig.provider, errText, aiConfig.apiKey);
    }

    if (!res.body) {
      throw new AiProviderError('Streaming body unavailable from AI provider.', { status: 502, code: 'AI_EMPTY_RESPONSE' });
    }

    await parseSseStream(res.body, (json) => {
      const delta = json?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        fullReply += delta;
        onChunk?.(delta);
      }
    });

    if (!fullReply.trim()) {
      throw new AiProviderError('AI provider returned an empty stream.', { status: 502, code: 'AI_EMPTY_RESPONSE' });
    }
    return { reply: fullReply.trim(), provider: aiConfig.provider, model: aiConfig.model };
  } catch (err) {
    if (err instanceof AiProviderError) throw err;
    if (err?.name === 'AbortError') {
      throw new AiProviderError('AI response timed out. Please try again.', { status: 504, code: 'AI_TIMEOUT' });
    }
    console.error('[RED MISSION AI] Stream failure:', sanitizeErrorText(err?.message, aiConfig.apiKey));
    throw new AiProviderError('Unable to stream AI response right now.', { status: 502, code: 'AI_NETWORK_ERROR' });
  } finally {
    clearTimeout(timer);
  }
}
