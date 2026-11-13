/**
 * In-memory sliding window rate limiter for brute-force protection
 */
class RateLimiter {
  constructor() {
    this.hits = new Map();
    // Cleanup stale entries every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000).unref();
  }

  /**
   * Check if an identifier (e.g. ip + action) has exceeded maximum requests in window
   */
  check(key, maxLimit = 10, windowMs = 60 * 1000) {
    const now = Date.now();
    const entry = this.hits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
      this.hits.set(key, entry);
      return { allowed: true, remaining: maxLimit - 1, resetAt: entry.resetAt };
    }

    entry.count += 1;
    this.hits.set(key, entry);

    if (entry.count > maxLimit) {
      const waitSeconds = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfterSeconds: waitSeconds,
        error: `Rate limit exceeded. Too many requests. Please wait ${waitSeconds} seconds.`
      };
    }

    return { allowed: true, remaining: maxLimit - entry.count, resetAt: entry.resetAt };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.hits.entries()) {
      if (now > entry.resetAt) {
        this.hits.delete(key);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();
