import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple env file loader without external dependencies
export function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          const val = values.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    });
  }
}

loadEnv();

// Persistent Data Directory (optional unified root for Railway/Render volume mounts)
const persistentDataDir = (process.env.PERSISTENT_DATA_DIR || '').trim();
const baseStorageDir = persistentDataDir
  ? path.resolve(persistentDataDir, 'storage')
  : path.resolve(__dirname, '../storage');

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
  JWT_SECRET: process.env.JWT_SECRET || 'red_mission_super_secret_jwt_key_2026_blood_network',
  SESSION_SECRET: process.env.SESSION_SECRET || 'red_mission_session_secret_hmac_key_9948',
  
  // Production CORS Configuration (comma-separated allowed origins, e.g. "https://redmission.org,https://www.redmission.org")
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || '').trim(),

  // Security parameters
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
  USER_SESSION_INACTIVITY_MINUTES: 30,
  USER_SESSION_MAX_HOURS: 24,
  ADMIN_SESSION_INACTIVITY_MINUTES: 30,
  ADMIN_SESSION_MAX_HOURS: 8,
  OTP_EXPIRY_MINUTES: 10,
  INVITATION_EXPIRY_DAYS: 7,

  // SMS & Email Providers
  // Reversible Feature Flag: OTP Verification System (Defaults to false unless explicitly enabled)
  OTP_ENABLED: process.env.OTP_ENABLED === 'true',
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'DEMO', // 'DEMO' | 'FAST2SMS' | 'TWILIO' | 'AWS_SNS' | 'DISABLED'
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'DEMO', // 'DEMO' | 'SMTP' | 'SENDGRID'
  
  // Fast2SMS Configuration (Smart OTP for Indian Mobile Numbers)
  FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY || '',
  FAST2SMS_OTP_ID: process.env.FAST2SMS_OTP_ID || '',
  FAST2SMS_CUSTOM_OTP: process.env.FAST2SMS_CUSTOM_OTP === 'true',
  FAST2SMS_SEND_URL: process.env.FAST2SMS_SEND_URL || 'https://www.fast2sms.com/dev/otp/send',
  FAST2SMS_VERIFY_URL: process.env.FAST2SMS_VERIFY_URL || 'https://www.fast2sms.com/dev/otp/verify',
  
  // Unified Persistent Data Root (optional; null by default in local development)
  PERSISTENT_DATA_DIR: persistentDataDir || null,

  // Database Path:
  // 1. Explicit custom DB_PATH (overrides persistent volume)
  // 2. PERSISTENT_DATA_DIR/red_mission.db (when persistent root configured)
  // 3. Local default server/data/red_mission.db
  DB_PATH: (process.env.DB_PATH && path.resolve(process.env.DB_PATH) !== path.resolve(__dirname, '../data/red_mission.db'))
    ? path.resolve(process.env.DB_PATH)
    : (persistentDataDir
        ? path.resolve(persistentDataDir, 'red_mission.db')
        : (process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve(__dirname, '../data/red_mission.db'))),

  // Storage Paths & Limits for Stage 2.2 Donor Selfies, Stage 2.5 Proofs & Rotaract Directory
  // Priority: 1. Explicit env override, 2. Persistent volume subdirectory, 3. Local default
  SELFIE_STORAGE_DIR: process.env.SELFIE_STORAGE_DIR
    ? path.resolve(process.env.SELFIE_STORAGE_DIR)
    : path.resolve(baseStorageDir, 'selfies'),
  MAX_SELFIE_SIZE_BYTES: 3 * 1024 * 1024, // 3 MiB

  PROOF_STORAGE_DIR: process.env.PROOF_STORAGE_DIR
    ? path.resolve(process.env.PROOF_STORAGE_DIR)
    : path.resolve(baseStorageDir, 'proofs'),
  MAX_PROOF_SIZE_BYTES: 5 * 1024 * 1024, // 5 MiB

  ROTARACT_STORAGE_DIR: process.env.ROTARACT_STORAGE_DIR
    ? path.resolve(process.env.ROTARACT_STORAGE_DIR)
    : path.resolve(baseStorageDir, 'rotaract'),
  MAX_ROTARACT_PHOTO_SIZE_BYTES: 3 * 1024 * 1024, // 3 MiB

  REPORTS_STORAGE_DIR: process.env.REPORTS_STORAGE_DIR
    ? path.resolve(process.env.REPORTS_STORAGE_DIR)
    : path.resolve(baseStorageDir, 'reports'),

  BACKUP_DIR: process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : (persistentDataDir
        ? path.resolve(persistentDataDir, 'backups')
        : path.resolve(__dirname, '../../backups')),

  MAX_REQUEST_BODY_BYTES: 10 * 1024 * 1024, // 10 MiB to accommodate proof image uploads
  
  // Initial Super Admin Provisioning credentials (used strictly on first initialization if database is empty)
  // In production (NODE_ENV=production), NEVER use a hardcoded default password.
  INIT_SUPER_ADMIN_EMAIL: process.env.INIT_SUPER_ADMIN_EMAIL || 'superadmin@redmission.org',
  INIT_SUPER_ADMIN_USERNAME: process.env.INIT_SUPER_ADMIN_USERNAME || 'superadmin',
  INIT_SUPER_ADMIN_PASSWORD: process.env.INIT_SUPER_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'RedMission@Admin2026!'),
  INIT_SUPER_ADMIN_MOBILE: process.env.INIT_SUPER_ADMIN_MOBILE || '+919999900001',
  INIT_SUPER_ADMIN_NAME: process.env.INIT_SUPER_ADMIN_NAME || 'Super Administrator',

  // Persistent Official Website Launch Timestamp (fixed ISO 8601 UTC / offset-qualified string)
  // Set once at actual production go-live time; never auto-generated at runtime.
  OFFICIAL_LAUNCH_TIMESTAMP: (process.env.OFFICIAL_LAUNCH_TIMESTAMP || '').trim() || null,
  LAUNCH_TIMER_ENABLED: process.env.NODE_ENV === 'production' && process.env.LAUNCH_TIMER_ENABLED !== 'false',

  // AI Chatbot Provider Configuration (Backend-only; never exposed to client bundle)
  AI_PROVIDER: (process.env.AI_PROVIDER || 'NONE').trim().toUpperCase(),
  AI_API_KEY: (process.env.AI_API_KEY || '').trim(),
  AI_MODEL: (process.env.AI_MODEL || '').trim(),
  AI_BASE_URL: (process.env.AI_BASE_URL || '').trim(),
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  OPENAI_API_KEY: (process.env.OPENAI_API_KEY || '').trim(),
  GROQ_API_KEY: (process.env.GROQ_API_KEY || '').trim(),
  OPENROUTER_API_KEY: (process.env.OPENROUTER_API_KEY || '').trim(),
  AI_MAX_TOKENS: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS, 10) : 900,
  AI_TEMPERATURE: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.4,
  AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : 25000,
  AI_RATE_LIMIT_WINDOW_MS: process.env.AI_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 10) : 60000,
  AI_RATE_LIMIT_MAX_REQUESTS: process.env.AI_RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS, 10) : 20
};

export const EXAMPLE_SUPER_ADMIN_PASSWORD = 'RedMission@Admin2026!';

/**
 * Validates Super Admin provisioning configuration.
 * - In production: rejects missing password and rejects the example password.
 * - In development: permits development default.
 * - If Super Admin is already provisioned in the database, credentials are not required.
 */
export function validateSuperAdminConfig({
  isProd = config.IS_PROD,
  password = config.INIT_SUPER_ADMIN_PASSWORD,
  hasExistingAdmin = false
} = {}) {
  // If Super Admin account already exists in database, no provisioning credentials needed
  if (hasExistingAdmin) {
    return { valid: true, message: 'Super Admin already exists in database.' };
  }

  if (isProd) {
    if (!password || typeof password !== 'string' || !password.trim()) {
      throw new Error(
        '[FATAL SECURITY CONFIGURATION] Initial Super Admin provisioning failed: ' +
        'In production mode (NODE_ENV=production), INIT_SUPER_ADMIN_PASSWORD environment variable ' +
        'is required but missing. A strong, high-entropy password must be provided.'
      );
    }

    if (password.trim() === EXAMPLE_SUPER_ADMIN_PASSWORD) {
      throw new Error(
        '[FATAL SECURITY CONFIGURATION] Initial Super Admin provisioning rejected: ' +
        'In production mode, INIT_SUPER_ADMIN_PASSWORD must not match the sample/example password ' +
        '(\'RedMission@Admin2026!\') from .env.example. Please specify a unique, secure production password.'
      );
    }

    if (password.length < 12) {
      throw new Error(
        '[FATAL SECURITY CONFIGURATION] Initial Super Admin provisioning rejected: ' +
        'In production mode, INIT_SUPER_ADMIN_PASSWORD must be at least 12 characters long.'
      );
    }
  }

  return { valid: true };
}

/**
 * Validates SMS Provider configuration.
 * - If OTP_ENABLED is false, relaxes check so server starts cleanly without external credentials.
 * - In production mode with OTP enabled: rejects DEMO provider, and requires provider credentials.
 */
export function validateSmsConfig({ isProd = config.IS_PROD, provider = config.SMS_PROVIDER, otpEnabled = config.OTP_ENABLED } = {}) {
  if (!otpEnabled) {
    console.log('[RED MISSION SECURITY] OTP verification is temporarily disabled (OTP_ENABLED=false). Running in direct authentication mode.');
    return { valid: true, otpDisabled: true };
  }

  if (isProd) {
    if (provider === 'DEMO') {
      throw new Error(
        '[FATAL SECURITY CONFIGURATION] In production mode (NODE_ENV=production), SMS_PROVIDER cannot be set to "DEMO". ' +
        'Please configure a production-ready SMS gateway such as FAST2SMS, or set OTP_ENABLED=false for direct authentication mode.'
      );
    }
    if (provider === 'FAST2SMS') {
      if (!config.FAST2SMS_API_KEY || !config.FAST2SMS_API_KEY.trim()) {
        throw new Error(
          '[FATAL SECURITY CONFIGURATION] In production mode with SMS_PROVIDER=FAST2SMS, FAST2SMS_API_KEY is required but missing.'
        );
      }
      if (!config.FAST2SMS_OTP_ID || !config.FAST2SMS_OTP_ID.trim()) {
        throw new Error(
          '[FATAL SECURITY CONFIGURATION] In production mode with SMS_PROVIDER=FAST2SMS, FAST2SMS_OTP_ID is required but missing.'
        );
      }
    }
  }
  return { valid: true };
}

const DEFAULT_AI_MODELS = {
  GEMINI: 'gemini-2.5-flash',
  OPENAI: 'gpt-4o-mini',
  GROQ: 'llama-3.3-70b-versatile',
  OPENROUTER: 'openai/gpt-4o-mini',
};

const DEFAULT_AI_BASE_URLS = {
  OPENAI: 'https://api.openai.com/v1',
  GROQ: 'https://api.groq.com/openai/v1',
  OPENROUTER: 'https://openrouter.ai/api/v1',
};

/**
 * Resolves the active backend AI provider configuration safely without exposing credentials.
 */
export function getActiveAiConfig(envOverrides = process.env) {
  const providerRaw = (envOverrides.AI_PROVIDER ?? config.AI_PROVIDER ?? 'NONE').toString().trim().toUpperCase();
  const genericKey = (envOverrides.AI_API_KEY ?? config.AI_API_KEY ?? '').toString().trim();

  const keyByProvider = {
    GEMINI: genericKey || (envOverrides.GEMINI_API_KEY ?? config.GEMINI_API_KEY ?? '').toString().trim(),
    OPENAI: genericKey || (envOverrides.OPENAI_API_KEY ?? config.OPENAI_API_KEY ?? '').toString().trim(),
    GROQ: genericKey || (envOverrides.GROQ_API_KEY ?? config.GROQ_API_KEY ?? '').toString().trim(),
    OPENROUTER: genericKey || (envOverrides.OPENROUTER_API_KEY ?? config.OPENROUTER_API_KEY ?? '').toString().trim(),
  };

  let provider = providerRaw;
  if (provider === 'NONE') {
    if (keyByProvider.GEMINI) provider = 'GEMINI';
    else if (keyByProvider.OPENAI) provider = 'OPENAI';
    else if (keyByProvider.GROQ) provider = 'GROQ';
    else if (keyByProvider.OPENROUTER) provider = 'OPENROUTER';
  }

  const supported = ['GEMINI', 'OPENAI', 'GROQ', 'OPENROUTER'];
  const isSupported = supported.includes(provider);
  const apiKey = isSupported ? (keyByProvider[provider] || '') : '';
  const model =
    (envOverrides.AI_MODEL ?? config.AI_MODEL ?? '').toString().trim() ||
    DEFAULT_AI_MODELS[provider] ||
    '';
  const baseUrl =
    (envOverrides.AI_BASE_URL ?? config.AI_BASE_URL ?? '').toString().trim() ||
    DEFAULT_AI_BASE_URLS[provider] ||
    '';

  const configured = Boolean(isSupported && apiKey);

  return {
    provider: isSupported ? provider : 'NONE',
    configured,
    apiKey,
    model,
    baseUrl,
    maxTokens: Number.isFinite(config.AI_MAX_TOKENS) && config.AI_MAX_TOKENS > 0 ? config.AI_MAX_TOKENS : 900,
    temperature: Number.isFinite(config.AI_TEMPERATURE) ? config.AI_TEMPERATURE : 0.4,
    timeoutMs: Number.isFinite(config.AI_TIMEOUT_MS) && config.AI_TIMEOUT_MS > 0 ? config.AI_TIMEOUT_MS : 25000,
    rateLimitWindowMs: Number.isFinite(config.AI_RATE_LIMIT_WINDOW_MS) && config.AI_RATE_LIMIT_WINDOW_MS > 0 ? config.AI_RATE_LIMIT_WINDOW_MS : 60000,
    rateLimitMaxRequests: Number.isFinite(config.AI_RATE_LIMIT_MAX_REQUESTS) && config.AI_RATE_LIMIT_MAX_REQUESTS > 0 ? config.AI_RATE_LIMIT_MAX_REQUESTS : 20,
  };
}

/**
 * Safely ensures all persistent storage directories exist on startup.
 * Non-destructive and idempotent: never overwrites or modifies existing data.
 */
export function ensureStorageDirectories(cfg = config) {
  const dirs = [
    path.dirname(cfg.DB_PATH),
    cfg.SELFIE_STORAGE_DIR,
    cfg.PROOF_STORAGE_DIR,
    cfg.ROTARACT_STORAGE_DIR,
    path.join(cfg.ROTARACT_STORAGE_DIR, 'photos'),
    cfg.REPORTS_STORAGE_DIR,
    cfg.BACKUP_DIR
  ];
  for (const d of dirs) {
    if (d && !fs.existsSync(d)) {
      try {
        fs.mkdirSync(d, { recursive: true });
      } catch (err) {
        console.warn(`[STORAGE INIT WARNING] Could not create directory '${d}':`, err.message);
      }
    }
  }
}

// Automatically ensure configured storage directories exist
ensureStorageDirectories(config);

