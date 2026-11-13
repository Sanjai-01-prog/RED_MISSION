import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { getDatabase as defaultGetDatabase } from '../database/connection.js';
import { authenticateAdmin as defaultAuthenticateAdmin } from '../middleware/authMiddleware.js';
import {
  BLOOD_GROUPS,
  isValidDonorId,
  getSuperAdminDonorDirectory,
  getSuperAdminDonorDetail
} from '../services/superAdminDonorService.js';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VALID_AVAILABILITY_FILTERS = new Set(['ALL', 'AVAILABLE', 'UNAVAILABLE', 'PENDING_VERIFICATION']);

/**
 * Middleware: Strictly permits only authenticated SUPER_ADMIN accounts.
 * Rejects ADMIN, MODERATOR, and unauthenticated callers.
 */
export function requireSuperAdminRole(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      code: 'ADMIN_AUTH_REQUIRED',
      error: 'Administrator authentication required.'
    });
  }

  const role = req.admin.role_id || req.admin.roleId;
  const isSuspended = req.admin.is_suspended === 1 || req.admin.is_suspended === true;
  const isActive = req.admin.is_active === undefined || req.admin.is_active === 1 || req.admin.is_active === true;

  if (role !== 'SUPER_ADMIN' || isSuspended || !isActive) {
    return res.status(403).json({
      success: false,
      code: 'SUPER_ADMIN_REQUIRED',
      error: 'Access Denied: Only an active Super Administrator can access the donor directory and donor profiles.'
    });
  }

  next();
}

/**
 * Resolves a stored selfie filename safely within the configured photo storage root.
 */
export function resolveSafeDonorPhotoFile(storedPath, photoStorageDir = config.SELFIE_STORAGE_DIR) {
  if (!storedPath || typeof storedPath !== 'string') return null;

  const trimmed = storedPath.trim();
  if (!trimmed) return null;

  // Reject explicit traversal or absolute paths; take strictly the leaf filename
  const fileName = path.basename(trimmed);
  if (!fileName || fileName === '.' || fileName === '..' || fileName.includes('\0')) {
    return null;
  }

  const baseDir = path.resolve(photoStorageDir);
  const fullPath = path.resolve(baseDir, fileName);
  const normalizedBase = baseDir.endsWith(path.sep) ? baseDir : `${baseDir}${path.sep}`;

  if (!fullPath.startsWith(normalizedBase)) {
    return null;
  }

  try {
    if (!fs.existsSync(fullPath)) return null;
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return null;
    return { fullPath, size: stat.size };
  } catch {
    return null;
  }
}

export function setupSuperAdminDonorRoutes(app, deps = {}) {
  const getDb = deps.getDatabase || defaultGetDatabase;
  const authAdmin = deps.authenticateAdmin || defaultAuthenticateAdmin;
  const photoStorageDir = deps.photoStorageDir || config.SELFIE_STORAGE_DIR;
  const getReferenceDate = typeof deps.getReferenceDate === 'function' ? deps.getReferenceDate : () => null;

  // ==========================================
  // 1. SUPER_ADMIN: BLOOD GROUP-WISE DONOR DIRECTORY
  // ==========================================
  app.get('/api/superadmin/donors', authAdmin, requireSuperAdminRole, (req, res) => {
    try {
      const { bloodGroup = 'ALL', availability = 'ALL', search = '', city = '' } = req.query || {};

      const normalizedBg = typeof bloodGroup === 'string' && bloodGroup.trim() ? bloodGroup.trim().toUpperCase() : 'ALL';
      if (normalizedBg !== 'ALL' && !BLOOD_GROUPS.includes(normalizedBg)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_BLOOD_GROUP',
          error: 'Invalid blood group filter.'
        });
      }

      const normalizedAvailability =
        typeof availability === 'string' && availability.trim() ? availability.trim().toUpperCase() : 'ALL';
      if (!VALID_AVAILABILITY_FILTERS.has(normalizedAvailability)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_AVAILABILITY_FILTER',
          error: 'Invalid availability status filter.'
        });
      }

      const db = getDb();
      const result = getSuperAdminDonorDirectory(db, {
        bloodGroup: normalizedBg,
        availability: normalizedAvailability,
        search: typeof search === 'string' ? search : '',
        city: typeof city === 'string' ? city : '',
        referenceDate: getReferenceDate(req)
      });

      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[SUPERADMIN DONOR DIRECTORY ERROR]', err);
      return res.status(500).json({
        success: false,
        code: 'DIRECTORY_LOAD_FAILED',
        error: 'Unable to retrieve the donor directory at this time.'
      });
    }
  });

  // ==========================================
  // 2. SUPER_ADMIN: DETAILED DONOR PROFILE & HISTORIES
  // ==========================================
  app.get('/api/superadmin/donors/:userId', authAdmin, requireSuperAdminRole, (req, res) => {
    try {
      const rawUserId = req.params?.userId;
      if (!isValidDonorId(rawUserId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DONOR_ID',
          error: 'Invalid donor identifier format.'
        });
      }

      const db = getDb();
      const detail = getSuperAdminDonorDetail(db, rawUserId, {
        referenceDate: getReferenceDate(req)
      });

      if (detail.errorCode === 'INVALID_DONOR_ID') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DONOR_ID',
          error: 'Invalid donor identifier format.'
        });
      }

      if (detail.errorCode === 'DONOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'DONOR_NOT_FOUND',
          error: 'Registered donor profile not found.'
        });
      }

      return res.json({
        success: true,
        ...detail
      });
    } catch (err) {
      console.error('[SUPERADMIN DONOR DETAIL ERROR]', err);
      return res.status(500).json({
        success: false,
        code: 'DONOR_DETAIL_FAILED',
        error: 'Unable to retrieve the donor profile at this time.'
      });
    }
  });

  // ==========================================
  // 3. SUPER_ADMIN: SAFE REGISTERED DONOR PHOTO STREAM
  // ==========================================
  app.get('/api/superadmin/donors/:userId/photo', authAdmin, requireSuperAdminRole, (req, res) => {
    try {
      const rawUserId = req.params?.userId;
      if (!isValidDonorId(rawUserId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DONOR_ID',
          error: 'Invalid donor identifier format.'
        });
      }

      const db = getDb();
      const targetDonor = db.prepare(`
        SELECT d.user_id, d.profile_photo_path, d.profile_photo_mime
        FROM donor_profiles d
        INNER JOIN users u ON d.user_id = u.id
        WHERE d.user_id = ?
        LIMIT 1
      `).get(rawUserId.trim());

      if (!targetDonor || !targetDonor.profile_photo_path) {
        return res.status(404).json({
          success: false,
          code: 'DONOR_PHOTO_NOT_FOUND',
          error: 'Donor profile photograph not found.'
        });
      }

      const safeFile = resolveSafeDonorPhotoFile(targetDonor.profile_photo_path, photoStorageDir);
      if (!safeFile) {
        return res.status(404).json({
          success: false,
          code: 'DONOR_PHOTO_NOT_FOUND',
          error: 'Donor profile photograph file is unavailable.'
        });
      }

      const contentType = ALLOWED_IMAGE_MIME_TYPES.has(targetDonor.profile_photo_mime)
        ? targetDonor.profile_photo_mime
        : 'application/octet-stream';

      const fileBuffer = fs.readFileSync(safeFile.fullPath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Security-Policy': "default-src 'none'",
        'Cross-Origin-Resource-Policy': 'same-origin'
      });
      return res.end(fileBuffer);
    } catch (err) {
      console.error('[SUPERADMIN DONOR PHOTO ERROR]', err);
      return res.status(500).json({
        success: false,
        code: 'DONOR_PHOTO_ERROR',
        error: 'Unable to load donor photograph.'
      });
    }
  });
}
