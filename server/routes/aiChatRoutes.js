/**
 * RED MISSION — AI Assistant API Routes
 * Routes all chatbot requests strictly through backend validation, rate limiting,
 * verified RED MISSION knowledge retrieval, and configured LLM provider calls.
 */

import { getActiveAiConfig } from '../config/env.js';
import { buildAiSystemPrompt } from '../services/aiKnowledgeService.js';
import {
  generateAiReply,
  streamAiReply,
  AiProviderError,
} from '../services/aiProviderService.js';
import {
  rateLimitAiRequests,
  validateAiChatPayload,
  AI_LIMITS,
} from '../middleware/aiMiddleware.js';

function writeSseEvent(res, eventName, payload) {
  if (res.writableEnded) return;
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function setupAiChatRoutes(app) {
  /**
   * Public capability check — returns only provider name/model & limits, NEVER credentials.
   */
  app.get('/api/ai/status', (_req, res) => {
    const aiConfig = getActiveAiConfig();
    return res.status(200).json({
      success: true,
      configured: aiConfig.configured,
      provider: aiConfig.provider,
      model: aiConfig.configured ? aiConfig.model : null,
      streamingSupported: aiConfig.configured,
      limits: {
        maxMessageLength: AI_LIMITS.MAX_MESSAGE_LENGTH,
        maxHistoryMessages: AI_LIMITS.MAX_HISTORY_MESSAGES,
      },
    });
  });

  /**
   * Conversational AI chat endpoint (supports SSE streaming & standard JSON response).
   * Explicitly forbids executing database mutations or admin operations.
   */
  app.post(
    '/api/ai/chat',
    rateLimitAiRequests,
    validateAiChatPayload,
    async (req, res) => {
      const aiConfig = getActiveAiConfig();
      if (!aiConfig.configured) {
        return res.status(503).json({
          success: false,
          code: 'AI_NOT_CONFIGURED',
          provider: aiConfig.provider,
          error:
            'RED MISSION AI requires a configured backend AI provider and API key before live AI responses can start.',
        });
      }

      const messages = req.aiMessages;
      const latestQuery = req.aiLatestQuery;
      const systemPrompt = buildAiSystemPrompt(latestQuery, messages.slice(0, -1));

      if (req.aiStreamRequested) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        try {
          const result = await streamAiReply({
            messages,
            systemPrompt,
            onChunk: (delta) => {
              writeSseEvent(res, 'chunk', { delta });
            },
          });

          writeSseEvent(res, 'done', {
            reply: result.reply,
            provider: result.provider,
            model: result.model,
          });
          return res.end();
        } catch (err) {
          const code = err instanceof AiProviderError ? err.code : 'AI_STREAM_ERROR';
          const message =
            err instanceof AiProviderError
              ? err.message
              : 'Unable to generate AI response right now. Please try again.';
          writeSseEvent(res, 'error', { code, error: message });
          return res.end();
        }
      }

      try {
        const result = await generateAiReply({ messages, systemPrompt });
        return res.status(200).json({
          success: true,
          reply: result.reply,
          provider: result.provider,
          model: result.model,
        });
      } catch (err) {
        if (err instanceof AiProviderError) {
          return res.status(err.status).json({
            success: false,
            code: err.code,
            error: err.message,
          });
        }
        console.error('[RED MISSION AI] Unexpected route error:', err?.message);
        return res.status(500).json({
          success: false,
          code: 'AI_INTERNAL_ERROR',
          error: 'An unexpected error occurred while processing your question.',
        });
      }
    }
  );
}
