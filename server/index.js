import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { config, validateSmsConfig } from './config/env.js';
import { initializeDatabaseSchema } from './database/schema.js';
import { provisionInitialSuperAdmin } from './database/seed.js';
import { setupUserAuthRoutes } from './routes/userAuthRoutes.js';
import { setupAdminAuthRoutes } from './routes/adminAuthRoutes.js';
import { setupAdminManagementRoutes } from './routes/adminManagementRoutes.js';
import { setupDonorRoutes } from './routes/donorRoutes.js';
import { setupEmergencyRequestRoutes } from './routes/emergencyRequestRoutes.js';
import { setupPledgeRoutes } from './routes/pledgeRoutes.js';
import { setupDonationProofRoutes } from './routes/donationProofRoutes.js';
import { setupCertificateRoutes } from './routes/certificateRoutes.js';
import { setupMonthlyReportRoutes } from './routes/monthlyReportRoutes.js';
import { setupRotaractMemberRoutes } from './routes/rotaractMemberRoutes.js';
import { initializeRotaractPersistentVolume } from './services/rotaractMemberService.js';
import { setupSuperAdminDonorRoutes } from './routes/superAdminDonorRoutes.js';
import { setupSiteConfigRoutes } from './routes/siteConfigRoutes.js';
import { setupAiChatRoutes } from './routes/aiChatRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

/**
 * Serves built frontend static assets from dist/ and provides SPA fallback
 * for valid client-side application routes.
 */
function serveStaticFile(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Method Not Allowed');
    return;
  }

  if (!fs.existsSync(DIST_DIR)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: false,
      error: 'Production frontend build directory (dist/) not found. In development, use Vite dev server on port 3000.'
    }));
    return;
  }

  // Safe path decoding and traversal prevention
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad Request');
    return;
  }

  const normalizedRelative = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  const candidateFilePath = path.resolve(DIST_DIR, '.' + normalizedRelative);

  // Security boundary check: candidate must be strictly within DIST_DIR
  const rel = path.relative(DIST_DIR, candidateFilePath);
  if (rel.startsWith('..') || path.isAbsolute(rel) || candidateFilePath.includes('\0')) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Forbidden');
    return;
  }

  // 1. Direct file match in dist/
  if (fs.existsSync(candidateFilePath)) {
    try {
      const stat = fs.statSync(candidateFilePath);
      if (stat.isFile()) {
        const ext = path.extname(candidateFilePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);

        if (pathname.startsWith('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        fs.createReadStream(candidateFilePath).pipe(res);
        return;
      }
    } catch (_) {
      // Fall through if file read fails
    }
  }

  // 2. Missing static asset detection:
  // If the path has a file extension or resides inside /assets/, return strict 404, NEVER SPA HTML.
  const hasExtension = path.extname(pathname) !== '';
  if (hasExtension || pathname.startsWith('/assets/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Static Asset Not Found');
    return;
  }

  // 3. SPA Fallback: Serve dist/index.html for valid client-side browser routes
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      const stat = fs.statSync(indexPath);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(indexPath).pipe(res);
      return;
    } catch (_) {
      // Fall through to 404 if index.html cannot be read
    }
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not Found');
}

/**
 * Production-hardened CORS evaluation:
 * - When CORS_ALLOWED_ORIGINS is configured, strictly enforce the allowlist.
 * - In production mode without explicit allowlist, reject cross-origin requests.
 * - In development mode, permit localhost/127.0.0.1 for local tooling & Vite proxy.
 * - Handle requests without Origin header (same-origin, curl, server-to-server) safely.
 */
function evaluateCors(req) {
  const originHeader = req.headers['origin'];
  const configuredOriginsRaw = config.CORS_ALLOWED_ORIGINS || '';
  const configuredOrigins = configuredOriginsRaw
    ? configuredOriginsRaw.split(',').map((o) => o.trim().toLowerCase().replace(/\/+$/, '')).filter(Boolean)
    : [];

  // No Origin header: same-origin, curl, health-check, internal requests
  if (!originHeader) {
    return { isAllowed: true, origin: null };
  }

  const normalizedOrigin = originHeader.trim().toLowerCase().replace(/\/+$/, '');
  let isAllowed = false;

  if (configuredOrigins.length > 0) {
    if (configuredOrigins.includes(normalizedOrigin)) {
      isAllowed = true;
    }
  } else if (!config.IS_PROD) {
    // Development mode fallback: allow localhost and 127.0.0.1 on any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin)) {
      isAllowed = true;
    }
  }

  return { isAllowed, origin: isAllowed ? originHeader : null };
}

// Initialize Database Schema, Super Admin Provisioning & Persistent Storage Volume
console.log('[RED MISSION BACKEND] Initializing relational database...');
initializeDatabaseSchema();
provisionInitialSuperAdmin();
initializeRotaractPersistentVolume();
validateSmsConfig();

// Zero-dependency binary-safe multipart/form-data parser
function parseMultipartFormData(rawBuffer, contentTypeHeader) {
  const boundaryMatch = String(contentTypeHeader || '').match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!boundaryMatch) {
    throw new Error('Missing multipart boundary');
  }
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryBuf = Buffer.from(`--${boundary}`, 'latin1');
  const fields = {};
  const files = {};

  let cursor = rawBuffer.indexOf(boundaryBuf);
  if (cursor === -1) {
    throw new Error('Invalid multipart body');
  }

  while (cursor !== -1) {
    cursor += boundaryBuf.length;
    // End boundary "--"
    if (rawBuffer[cursor] === 0x2d && rawBuffer[cursor + 1] === 0x2d) {
      break;
    }
    // Skip CRLF after boundary
    if (rawBuffer[cursor] === 0x0d && rawBuffer[cursor + 1] === 0x0a) {
      cursor += 2;
    } else if (rawBuffer[cursor] === 0x0a) {
      cursor += 1;
    }

    const nextBoundaryIdx = rawBuffer.indexOf(boundaryBuf, cursor);
    if (nextBoundaryIdx === -1) break;

    // Trim preceding CRLF or LF right before next boundary
    let partEnd = nextBoundaryIdx;
    if (partEnd >= 2 && rawBuffer[partEnd - 2] === 0x0d && rawBuffer[partEnd - 1] === 0x0a) {
      partEnd -= 2;
    } else if (partEnd >= 1 && rawBuffer[partEnd - 1] === 0x0a) {
      partEnd -= 1;
    }

    const headerEndCrlf = rawBuffer.indexOf('\r\n\r\n', cursor, 'latin1');
    const headerEndLf = headerEndCrlf === -1 ? rawBuffer.indexOf('\n\n', cursor, 'latin1') : -1;
    const headerEnd = headerEndCrlf !== -1 ? headerEndCrlf : headerEndLf;
    const sepLen = headerEndCrlf !== -1 ? 4 : 2;

    if (headerEnd !== -1 && headerEnd < partEnd) {
      const headerStr = rawBuffer.subarray(cursor, headerEnd).toString('utf8');
      const partBody = rawBuffer.subarray(headerEnd + sepLen, partEnd);

      const dispMatch = headerStr.match(/content-disposition:\s*form-data;([^\r\n]+)/i);
      if (dispMatch) {
        const nameMatch = dispMatch[1].match(/\bname="([^"]+)"/i);
        const filenameMatch = dispMatch[1].match(/\bfilename="([^"]*)"/i);
        const typeMatch = headerStr.match(/content-type:\s*([^\r\n;]+)/i);

        if (nameMatch) {
          const fieldName = nameMatch[1];
          if (filenameMatch && filenameMatch[1]) {
            files[fieldName] = {
              fieldname: fieldName,
              originalname: filenameMatch[1],
              mimetype: typeMatch ? typeMatch[1].trim().toLowerCase() : 'application/octet-stream',
              buffer: partBody,
              size: partBody.length
            };
          } else {
            fields[fieldName] = partBody.toString('utf8');
          }
        }
      }
    }

    cursor = nextBoundaryIdx;
  }

  return { fields, files };
}

// Lightweight, resilient HTTP router
class AppRouter {
  constructor() {
    this.routes = [];
  }

  get(path, ...handlers) {
    this.routes.push({ method: 'GET', path, handlers });
  }

  post(path, ...handlers) {
    this.routes.push({ method: 'POST', path, handlers });
  }

  put(path, ...handlers) {
    this.routes.push({ method: 'PUT', path, handlers });
  }

  patch(path, ...handlers) {
    this.routes.push({ method: 'PATCH', path, handlers });
  }

  delete(path, ...handlers) {
    this.routes.push({ method: 'DELETE', path, handlers });
  }

  async handle(req, res) {
    // Enhance response with helper methods
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };

    res.json = function(data) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(data));
      return this;
    };

    // 1. Production CORS Evaluation
    const cors = evaluateCors(req);

    // Handle preflight OPTIONS
    if (req.method === 'OPTIONS') {
      if (cors.isAllowed && cors.origin) {
        res.setHeader('Access-Control-Allow-Origin', cors.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.statusCode = 204;
        res.end();
        return;
      } else if (!cors.isAllowed) {
        return res.status(403).json({
          success: false,
          code: 'CORS_ORIGIN_DENIED',
          error: 'Origin not allowed by CORS policy.'
        });
      }
      res.statusCode = 204;
      res.end();
      return;
    }

    if (cors.origin) {
      res.setHeader('Access-Control-Allow-Origin', cors.origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    } else if (!cors.isAllowed) {
      return res.status(403).json({
        success: false,
        code: 'CORS_ORIGIN_DENIED',
        error: 'Origin not allowed by CORS policy.'
      });
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const rawPathname = parsedUrl.pathname || '/';
    const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '') : rawPathname;
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    // 2. Health check endpoint (supports GET and HEAD for Railway/cloud healthcheck probes)
    if (pathname === '/api/health') {
      if (req.method === 'HEAD') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end();
        return;
      }
      return res.status(200).json({
        status: 'UP',
        service: 'RED MISSION Medical Network API',
        environment: config.NODE_ENV,
        database: 'Relational SQLite (node:sqlite)',
        otpEnabled: config.OTP_ENABLED,
        timestamp: new Date().toISOString()
      });
    }

    // 3. Non-API Routes: Production static asset serving + SPA client fallback
    if (!pathname.startsWith('/api/') && pathname !== '/api') {
      serveStaticFile(req, res, parsedUrl.pathname);
      return;
    }

    // 4. API Routes: Match registered endpoints cleanly
    let matchingRoute = null;
    let params = {};

    for (const r of this.routes) {
      if (r.method !== req.method || r.path.includes(':')) continue;
      if (r.path === pathname) {
        matchingRoute = r;
        params = {};
        break;
      }
    }

    if (!matchingRoute) {
      for (const r of this.routes) {
        if (r.method !== req.method || !r.path.includes(':')) continue;
        const routeParts = r.path.split('/');
        const pathParts = pathname.split('/');
        if (routeParts.length === pathParts.length) {
          let matches = true;
          const extractedParams = {};
          for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
              extractedParams[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
            } else if (routeParts[i] !== pathParts[i]) {
              matches = false;
              break;
            }
          }
          if (matches) {
            matchingRoute = r;
            params = extractedParams;
            break;
          }
        }
      }
    }

    if (!matchingRoute) {
      return res.status(404).json({
        success: false,
        error: `Endpoint not found: [${req.method}] ${pathname}`
      });
    }

    req.params = params;

    // Read Body for POST/PUT/PATCH/DELETE with payload size boundary checks (supports JSON, multipart/form-data, and form-urlencoded)
    let body = {};
    let files = {};
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const MAX_PAYLOAD = config.MAX_REQUEST_BODY_BYTES || 10 * 1024 * 1024;
      const limitMiB = Math.round(MAX_PAYLOAD / (1024 * 1024));
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      if (contentLength > MAX_PAYLOAD) {
        return res.status(413).json({
          success: false,
          code: 'PAYLOAD_TOO_LARGE',
          error: `Payload Too Large: Request exceeds maximum allowed size of ${limitMiB} MiB.`
        });
      }

      let rawBuffer;
      try {
        const buffers = [];
        let bytesRead = 0;
        for await (const chunk of req) {
          bytesRead += chunk.length;
          if (bytesRead > MAX_PAYLOAD) {
            return res.status(413).json({
              success: false,
              code: 'PAYLOAD_TOO_LARGE',
              error: `Payload Too Large: Request exceeds maximum allowed size of ${limitMiB} MiB.`
            });
          }
          buffers.push(chunk);
        }
        rawBuffer = Buffer.concat(buffers);
      } catch (readErr) {
        return res.status(400).json({
          success: false,
          error: 'Failed to read request body stream.'
        });
      }

      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (contentType.startsWith('multipart/form-data')) {
        try {
          const parsedMp = parseMultipartFormData(rawBuffer, req.headers['content-type']);
          body = parsedMp.fields;
          files = parsedMp.files;
        } catch (mpErr) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_MULTIPART_PAYLOAD',
            error: 'Malformed multipart/form-data payload in request body.'
          });
        }
      } else if (contentType.startsWith('application/x-www-form-urlencoded')) {
        body = Object.fromEntries(new URLSearchParams(rawBuffer.toString('utf8')).entries());
      } else {
        try {
          const rawText = rawBuffer.toString('utf8');
          if (rawText.trim()) {
            body = JSON.parse(rawText);
          }
        } catch (err) {
          return res.status(400).json({
            success: false,
            error: 'Malformed JSON payload in request body.'
          });
        }
      }
    }
    req.body = body;
    req.files = files;

            // Execute handlers pipeline with sync and async error handling
    const handlers = matchingRoute.handlers;
    let index = 0;

    const next = (err) => {
      if (err) {
        console.error('[ROUTE ERROR]', err);

        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
          });
        }

        if (!res.writableEnded) {
          return res.end();
        }

        return;
      }

      if (res.writableEnded || index >= handlers.length) {
        return;
      }

      const currentHandler = handlers[index++];

      try {
        const result = currentHandler(req, res, next);

        // Catch rejected promises returned by async route handlers.
        if (result && typeof result.then === 'function') {
          result.catch(next);
        }
      } catch (handlerErr) {
        next(handlerErr);
      }
    };

    next();
  }
}

const app = new AppRouter();

// Mount API route modules
setupUserAuthRoutes(app);
setupAdminAuthRoutes(app);
setupAdminManagementRoutes(app);
setupDonorRoutes(app);
setupEmergencyRequestRoutes(app);
setupPledgeRoutes(app);
setupDonationProofRoutes(app);
setupCertificateRoutes(app);
setupMonthlyReportRoutes(app);
setupRotaractMemberRoutes(app);
setupSuperAdminDonorRoutes(app);
setupSiteConfigRoutes(app);
setupAiChatRoutes(app);

// Start HTTP Server
const server = http.createServer((req, res) => {
  app.handle(req, res).catch(err => {
    console.error('[UNCAUGHT SERVER ERROR]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Server error' }));
    }
  });
});

const PORT = config.PORT;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`RED MISSION BACKEND SERVER ONLINE ON PORT ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Relational Database: ${config.DB_PATH}`);
  console.log(`API Base: http://localhost:${PORT}/api`);
  console.log(`======================================================\n`);
});

export { app, server };
export default server;
