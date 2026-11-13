import { parseOfficialLaunchTimestamp } from '../utils/launchTimer.js';

/**
 * Persistent Website Launch Configuration
 *
 * 1. Set ONE fixed official launch timestamp (UTC ISO 8601, e.g. "2026-11-12T10:30:00Z")
 *    at the actual production go-live time via `VITE_OFFICIAL_LAUNCH_TIMESTAMP` (and
 *    `OFFICIAL_LAUNCH_TIMESTAMP` on the backend).
 * 2. Never generate this timestamp dynamically with `Date.now()` or `new Date()`, and never
 *    store it in React component state or `sessionStorage`.
 * 3. Keep `VITE_PRODUCTION_LAUNCH_ENABLED=false` (and `NODE_ENV=development`) during
 *    development and local preview so the production timer never starts prematurely.
 */

function readViteEnv() {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  } catch {
    return {};
  }
}

export function parseEnvBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return defaultValue;
}

export function getStaticLaunchConfig(envOverride = null) {
  const env = envOverride || readViteEnv();
  const mode = String(env.MODE || '').toLowerCase();
  // Note: If .env sets NODE_ENV=development for the backend, Vite sets env.DEV=true even
  // during `vite build` (where MODE==='production'). Only MODE==='development' indicates Vite dev server.
  const isDevBuild = mode === 'development' || (Boolean(env.DEV) && mode !== 'production');
  const isProdBuild = mode === 'production' || (Boolean(env.PROD) && !isDevBuild);

  const officialLaunchTimestamp = parseOfficialLaunchTimestamp(
    env.VITE_OFFICIAL_LAUNCH_TIMESTAMP || ''
  );

  const productionLaunchEnabled = parseEnvBoolean(env.VITE_PRODUCTION_LAUNCH_ENABLED, false);
  const explicitPreview = parseEnvBoolean(env.VITE_LAUNCH_PREVIEW, false);
  const allowPreviewPort = parseEnvBoolean(env.VITE_ALLOW_PREVIEW_TIMER, false);

  return {
    isDevBuild,
    isProdBuild,
    officialLaunchTimestamp,
    productionLaunchEnabled,
    explicitPreview,
    allowPreviewPort
  };
}

export function isDevelopmentPreviewContext({
  staticConfig = getStaticLaunchConfig(),
  backendConfig = null,
  locationPort = typeof window !== 'undefined' && window.location ? window.location.port : ''
} = {}) {
  if (staticConfig.isDevBuild || staticConfig.explicitPreview) {
    return true;
  }

  // `vite preview` defaults to port 4173; block production timer during local preview
  if (String(locationPort) === '4173' && !staticConfig.allowPreviewPort) {
    return true;
  }

  // If the backend responded with its environment state, trust its development flag
  if (backendConfig && backendConfig.success !== false && backendConfig.isProduction === false) {
    return true;
  }

  return false;
}

/**
 * Resolves the authoritative launch timer configuration by combining persistent backend
 * configuration (`/api/site/launch-config`) with persistent frontend build configuration.
 */
export function resolveLaunchRuntimeConfig({
  staticConfig = getStaticLaunchConfig(),
  backendConfig = null,
  clientReceiveEpochMs = Date.now(),
  locationPort = typeof window !== 'undefined' && window.location ? window.location.port : ''
} = {}) {
  const isDevPreview = isDevelopmentPreviewContext({
    staticConfig,
    backendConfig,
    locationPort
  });

  // Authoritative fixed launch timestamp: prefer backend persistent config when available,
  // falling back to persistent frontend build config.
  const backendTimestamp =
    backendConfig && backendConfig.success !== false
      ? parseOfficialLaunchTimestamp(backendConfig.launchTimestampUtc || '')
      : null;

  const launchTimestampUtc = backendTimestamp || staticConfig.officialLaunchTimestamp || null;

  let clockOffsetMs = 0;
  if (backendConfig && backendConfig.success !== false && backendConfig.serverNowUtc) {
    const serverNowMs = Date.parse(backendConfig.serverNowUtc);
    if (!Number.isNaN(serverNowMs) && Number.isFinite(clientReceiveEpochMs)) {
      clockOffsetMs = serverNowMs - clientReceiveEpochMs;
    }
  }

  // Development preview must NEVER start the production timer.
  if (isDevPreview) {
    return {
      status: 'standby-preview',
      isActive: false,
      isDevelopmentPreview: true,
      launchTimestampUtc,
      clockOffsetMs
    };
  }

  // Determine whether production launch timer is enabled:
  // 1) Backend explicitly confirms production + timerActive + valid timestamp, OR
  // 2) Static-only production build has VITE_PRODUCTION_LAUNCH_ENABLED=true + valid timestamp.
  const backendAllowsLaunch = Boolean(
    backendConfig &&
      backendConfig.success !== false &&
      backendConfig.isProduction === true &&
      backendConfig.timerActive === true &&
      launchTimestampUtc
  );

  const staticAllowsLaunch = Boolean(
    (!backendConfig || backendConfig.success === false) &&
      staticConfig.isProdBuild &&
      staticConfig.productionLaunchEnabled &&
      launchTimestampUtc
  );

  if (!backendAllowsLaunch && !staticAllowsLaunch) {
    return {
      status: 'standby-prelaunch',
      isActive: false,
      isDevelopmentPreview: false,
      launchTimestampUtc,
      clockOffsetMs
    };
  }

  return {
    status: 'live',
    isActive: true,
    isDevelopmentPreview: false,
    launchTimestampUtc,
    clockOffsetMs
  };
}
