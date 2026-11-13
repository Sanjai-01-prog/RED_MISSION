import crypto from 'node:crypto';
import { config } from '../config/env.js';

/**
 * Hash a password using scrypt (memory-hard, resistant to brute-force and GPU cracking)
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return {
    salt,
    hash: derivedKey.toString('hex')
  };
}

/**
 * Verify a password against stored salt and hash using timing-safe comparison
 */
export function verifyPassword(password, storedSalt, storedHash) {
  try {
    const derivedKey = crypto.scryptSync(password, storedSalt, 64, { N: 16384, r: 8, p: 1 });
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (derivedKey.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, storedBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP before database storage so plain OTPs are never stored in plaintext
 */
export function hashOtp(otp) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHmac('sha256', config.SESSION_SECRET)
    .update(`${otp}:${salt}`)
    .digest('hex');
  return { salt, hash };
}

/**
 * Verify an entered OTP against stored hash
 */
export function verifyOtp(enteredOtp, storedSalt, storedHash) {
  try {
    const hash = crypto.createHmac('sha256', config.SESSION_SECRET)
      .update(`${enteredOtp}:${storedSalt}`)
      .digest('hex');
    const computedBuffer = Buffer.from(hash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (computedBuffer.length !== storedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedBuffer, storedBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token (e.g. for reset links, invites, sessions)
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Create a signed, tamper-proof session token (header.payload.signature)
 */
export function createSignedToken(payload, secret = config.SESSION_SECRET) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode a signed token with timing-safe signature comparison
 */
export function verifySignedToken(token, secret = config.SESSION_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expectedSignature = crypto.createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
}
