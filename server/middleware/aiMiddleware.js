/**
 * RED MISSION — AI Chat Validation & Rate Limiting Middleware
 * Reuses the backend sliding-window rateLimiter and enforces strict
 * input sanitation, length bounds, and conversation history limits.
 */

import crypto from 'node:crypto';
import { getActiveAiConfig } from '../config/env.js';
import { rateLimiter } from '../utils/rateLimiter.js';

export const AI_LIMITS = {
  MAX_MESSAGE_LENGTH: 1500,
  MAX_HISTORY_MESSAGES: 20,
  MAX_TOTAL_CHARACTERS: 12000,
};

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function getSessionRateKey(req) {
  const authHeader = String(req.headers['authorization'] || '');
  const cookieHeader = String(req.headers['cookie'] || '');
  const tokenHint = authHeader || cookieHeader;
  if (!tokenHint) return 'anon';
  return crypto.createHash('sha256').update(tokenHint).digest('hex').slice(0, 12);
}

/**
 * Strips disallowed ASCII control characters while preserving tabs and newlines (and all Tamil/Unicode text).
 */
function sanitizeText(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function rateLimitAiRequests(req, res, next) {
  const aiConfig = getActiveAiConfig();
  const ip = getClientIp(req);
  const sessionScope = getSessionRateKey(req);
  const key = `ai_chat:${ip}:${sessionScope}`;

  const result = rateLimiter.check(
    key,
    aiConfig.rateLimitMaxRequests,
    aiConfig.rateLimitWindowMs
  );

  res.setHeader('X-RateLimit-Limit', String(aiConfig.rateLimitMaxRequests));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining ?? 0)));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds || 60));
    return res.status(429).json({
      success: false,
      code: 'AI_RATE_LIMITED',
      retryAfterSeconds: result.retryAfterSeconds,
      error: result.error,
    });
  }

  return next();
}

export function validateAiChatPayload(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PAYLOAD',
      error: 'Request body must be a JSON object.',
    });
  }

  let rawMessages = [];
  if (Array.isArray(body.messages)) {
    rawMessages = body.messages;
  } else if (typeof body.message === 'string') {
    rawMessages = [{ role: 'user', content: body.message }];
  } else {
    return res.status(400).json({
      success: false,
      code: 'MISSING_MESSAGE',
      error: 'Please enter a message to ask RED MISSION AI.',
    });
  }

  if (rawMessages.length === 0) {
    return res.status(400).json({
      success: false,
      code: 'EMPTY_MESSAGES',
      error: 'At least one message is required.',
    });
  }

  if (rawMessages.length > AI_LIMITS.MAX_HISTORY_MESSAGES) {
    rawMessages = rawMessages.slice(-AI_LIMITS.MAX_HISTORY_MESSAGES);
  }

  const sanitizedMessages = [];
  let totalChars = 0;

  for (let i = 0; i < rawMessages.length; i++) {
    const item = rawMessages[i];
    if (!item || typeof item !== 'object') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_MESSAGE_ITEM',
        error: 'Each conversation turn must include role and content.',
      });
    }

    const role = String(item.role || '').trim().toLowerCase();
    if (role !== 'user' && role !== 'assistant') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_ROLE',
        error: 'Message role must be user or assistant.',
      });
    }

    if (typeof item.content !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CONTENT',
        error: 'Message content must be text.',
      });
    }

    const cleanContent = sanitizeText(item.content);
    if (!cleanContent) {
      if (i === rawMessages.length - 1) {
        return res.status(400).json({
          success: false,
          code: 'EMPTY_MESSAGE',
          error: 'Message cannot be empty.',
        });
      }
      continue;
    }

    if (cleanContent.length > AI_LIMITS.MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        code: 'MESSAGE_TOO_LONG',
        error: `Message exceeds maximum length of ${AI_LIMITS.MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    totalChars += cleanContent.length;
    sanitizedMessages.push({ role, content: cleanContent });
  }

  // Ensure combined context stays within bounds while keeping the newest turn
  while (totalChars > AI_LIMITS.MAX_TOTAL_CHARACTERS && sanitizedMessages.length > 1) {
    const removed = sanitizedMessages.shift();
    totalChars -= removed.content.length;
  }

  const latest = sanitizedMessages[sanitizedMessages.length - 1];
  if (!latest || latest.role !== 'user') {
    return res.status(400).json({
      success: false,
      code: 'LATEST_MUST_BE_USER',
      error: 'The latest message must be sent by the user.',
    });
  }

  req.aiMessages = sanitizedMessages;
  req.aiLatestQuery = latest.content;
  req.aiStreamRequested =
    body.stream === true ||
    req.query?.stream === 'true' ||
    String(req.headers['accept'] || '').includes('text/event-stream');

  return next();
}
