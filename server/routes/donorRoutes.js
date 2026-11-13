/**
 * RED MISSION — Donor API Routes
 * Manages authenticated donor profiles, visual selfies, and profile picture access.
 * Strict zero-dependency implementation using native Node.js and SQLite.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import { authenticateUser, authenticateAdmin, authenticateAny } from '../middleware/authMiddleware.js';
import { validateImagePayload } from '../utils/imageValidator.js';
import { logSecurityAudit, logUserActivity } from '../utils/auditLogger.js';
import {
  getDonorAvailabilityStatus,
  getBulkDonorAvailability,
  getDonorProfileColumns,
  tableExists
} from '../services/donorAvailabilityService.js';

// Ensure selfie storage directory exists
if (!fs.existsSync(config.SELFIE_STORAGE_DIR)) {
  fs.mkdirSync(config.SELFIE_STORAGE_DIR, { recursive: true });
}

// 128-bit Random Public Donor Reference Generator
export function generatePublicDonorReference() {
  return 'DNR-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

// Legacy helper preserved for backward compatibility / tests
export function formatDonorRef(userId) {
  if (!userId || typeof userId !== 'string') return '';
  return 'DNR-' + crypto.createHash('sha256').update(userId.trim()).digest('hex').substring(0, 8).toUpperCase();
}

// 128-bit Public Donor Reference Validation Regex: DNR- followed by exactly 32 hex chars (36 chars total)
export const DONOR_REF_REGEX = /^DNR-[0-9A-F]{32}$/i;

// In-memory cache kept for legacy imports if any, but not used in photo route lookup
export const donorRefCache = new Map();

/**
 * Resolves a stored selfie filename safely inside config.SELFIE_STORAGE_DIR,
 * blocking traversal and verifying the target is an existing regular file.
 */
export function resolveSafeSelfiePath(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') return null;
  const trimmed = storedPath.trim();
  if (!trimmed) return null;

  const safeFilename = path.basename(trimmed);
  if (!safeFilename || safeFilename === '.' || safeFilename === '..' || safeFilename.includes('\0')) {
    return null;
  }

  const baseDir = path.resolve(config.SELFIE_STORAGE_DIR);
  const fullPath = path.resolve(baseDir, safeFilename);
  const normalizedBase = baseDir.endsWith(path.sep) ? baseDir : `${baseDir}${path.sep}`;
  if (!fullPath.startsWith(normalizedBase)) {
    return null;
  }

  try {
    if (!fs.existsSync(fullPath)) return null;
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return null;
    return fullPath;
  } catch {
    return null;
  }
}

export function extractPhotoPayload(req) {
  const body = req.body || {};
  const files = req.files || {};
  return (
    body.selfieImage ||
    body.selfiePhoto ||
    body.profilePhoto ||
    files.selfieImage?.buffer ||
    files.selfiePhoto?.buffer ||
    files.profilePhoto?.buffer ||
    files.photo?.buffer ||
    null
  );
}

function assertOwnUserOwnership(req, res) {
  const body = req.body || {};
  const suppliedUserId = body.userId || body.donorUserId;
  if (suppliedUserId !== undefined && suppliedUserId !== null && String(suppliedUserId).trim() !== '' && String(suppliedUserId).trim() !== req.user.id) {
    res.status(403).json({
      success: false,
      code: 'FORBIDDEN_OWNERSHIP',
      error: 'Access Denied: You can only view or modify your own donor profile and photograph.'
    });
    return false;
  }
  return true;
}

function streamSelfieFile(res, filePath, mime) {
  res.setHeader('Content-Type', mime || 'image/jpeg');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to stream photograph.' });
    }
  });
  stream.pipe(res);
}

/**
 * Shared safe donor profile projection reused across /api/donor/profile, /api/user/login, and /api/user/me.
 * Never mutates donor_profiles or resets availability/donation history.
 */
export function buildDonorProfilePayload(db, userId) {
  const donor = db.prepare(`
    SELECT d.*, u.full_name, u.email, u.mobile_number, u.age, u.is_active, u.is_suspended
    FROM donor_profiles d
    JOIN users u ON d.user_id = u.id
    WHERE d.user_id = ?
  `).get(userId);

  const availability = getDonorAvailabilityStatus(db, userId);

  if (!donor) {
    return {
      isDonor: false,
      hasDonorProfile: false,
      hasPhoto: false,
      hasPhotoFile: false,
      needsDonorCompletion: true,
      needsDonorPhotoCompletion: true,
      legacyAccountState: 'LEGACY_USER_WITHOUT_DONOR_PROFILE',
      donor: null,
      availability
    };
  }

  const publicRef = donor.public_reference || null;
  const hasDbPhotoPath = Boolean(donor.profile_photo_path && String(donor.profile_photo_path).trim());
  const safeFilePath = hasDbPhotoPath ? resolveSafeSelfiePath(donor.profile_photo_path) : null;
  const hasPhotoFile = Boolean(safeFilePath);
  const photoUrl = hasDbPhotoPath
    ? (publicRef ? `/api/donor/photo/${publicRef}` : '/api/donor/me/photo')
    : null;

  return {
    isDonor: true,
    hasDonorProfile: true,
    hasPhoto: hasDbPhotoPath,
    hasPhotoFile,
    needsDonorCompletion: false,
    needsDonorPhotoCompletion: !hasDbPhotoPath || !hasPhotoFile,
    legacyAccountState: !hasDbPhotoPath || !hasPhotoFile ? 'LEGACY_DONOR_MISSING_PHOTO' : null,
    availability,
    donor: {
      userId: donor.user_id,
      isDonor: true,
      hasDonorProfile: true,
      publicReference: publicRef,
      fullName: donor.full_name,
      email: donor.email,
      mobileNumber: donor.mobile_number,
      bloodGroup: donor.blood_group,
      city: donor.city,
      pincode: donor.pincode,
      latitude: donor.latitude,
      longitude: donor.longitude,
      isAvailableForEmergency: Boolean(donor.is_available_for_emergency),
      isAvailable: availability.isAvailable,
      availability,
      consentEmergencyAlerts: Boolean(donor.consent_emergency_alerts),
      lastDonationDate: donor.last_donation_date,
      totalDonationsCount: donor.total_donations_count,
      hasPhoto: hasDbPhotoPath,
      hasPhotoFile,
      needsDonorPhotoCompletion: !hasDbPhotoPath || !hasPhotoFile,
      photoUrl,
      mimeType: donor.profile_photo_mime || null,
      photoUpdatedAt: donor.profile_photo_updated_at,
      selfieConsentGiven: Boolean(donor.selfie_consent_given),
      selfieConsentAt: donor.selfie_consent_at,
      isPhotoPublic: Boolean(donor.is_photo_public),
      consentDirectoryListing: Boolean(donor.consent_directory_listing),
      createdAt: donor.created_at,
      updatedAt: donor.updated_at
    }
  };
}

export function setupDonorRoutes(app) {

  // ==========================================
  // 1. REGISTER AS VOLUNTARY DONOR (WITH SELFIE)
  // ==========================================
  app.post('/api/donor/register', authenticateUser, async (req, res) => {
    if (!assertOwnUserOwnership(req, res)) return;
    const userId = req.user.id;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const db = getDatabase();

    // 1. Check if user is already registered as a donor
    const existing = db.prepare('SELECT user_id FROM donor_profiles WHERE user_id = ?').get(userId);
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'DONOR_ALREADY_EXISTS',
        error: 'An active voluntary donor profile already exists for this account.'
      });
    }

    const selfieImage = extractPhotoPayload(req);
    const selfieConsentGiven = req.body.selfieConsentGiven !== undefined ? req.body.selfieConsentGiven : (req.body.selfieConsent ?? req.body.photoConsent);
    const {
      pincode,
      latitude,
      longitude,
      isAvailableForEmergency,
      consentEmergencyAlerts,
      isPhotoPublic,
      consentDirectoryListing,
      lastDonationDate
    } = req.body;

    // 2. Validate mandatory selfie consent
    if (selfieConsentGiven !== true && selfieConsentGiven !== 1 && selfieConsentGiven !== 'true') {
      return res.status(400).json({
        success: false,
        code: 'CONSENT_REQUIRED',
        error: 'Explicit consent is mandatory to upload a donor visual profile photograph.'
      });
    }

    // 3. Validate selfie payload
    if (!selfieImage) {
      return res.status(400).json({
        success: false,
        code: 'SELFIE_REQUIRED',
        error: 'A valid selfie image is strictly required for donor registration.'
      });
    }

    const imgResult = validateImagePayload(selfieImage, {
      maxSize: config.MAX_SELFIE_SIZE_BYTES,
      requireDimensions: true
    });

    if (!imgResult.valid) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_IMAGE',
        error: imgResult.error
      });
    }

    // 4. Validate optional lastDonationDate
    let cleanLastDate = null;
    if (lastDonationDate && typeof lastDonationDate === 'string' && lastDonationDate.trim()) {
      const trimmedDate = lastDonationDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid last donation date format. Please use YYYY-MM-DD.'
        });
      }
      const parsedDate = new Date(trimmedDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid last donation date value.' });
      }
      if (parsedDate > new Date()) {
        return res.status(400).json({ success: false, error: 'Last donation date cannot be in the future.' });
      }
      cleanLastDate = trimmedDate;
    }

    // 5. Validate pincode (optional 6-digit numeric)
    let cleanPincode = null;
    if (pincode && typeof pincode === 'string' && pincode.trim()) {
      cleanPincode = pincode.trim();
      if (!/^\d{6}$/.test(cleanPincode)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 6-digit postal code (PIN code).'
        });
      }
    }

    // 6. Validate emergency availability & alert flags (Photo is PRIVATE by default in Stage 2.4, Directory is OPT-IN by default)
    const emergencyAvail = (isAvailableForEmergency === true || isAvailableForEmergency === 1 || isAvailableForEmergency === 'true') ? 1 : 0;
    const alertConsent = (consentEmergencyAlerts === true || consentEmergencyAlerts === 1 || consentEmergencyAlerts === 'true') ? 1 : 0;
    const photoPublic = (isPhotoPublic === true || isPhotoPublic === 1 || isPhotoPublic === 'true') ? 1 : 0;
    const directoryConsent = (consentDirectoryListing === true || consentDirectoryListing === 1 || consentDirectoryListing === 'true') ? 1 : 0;

    // 7. Write photo to disk atomically
    if (!fs.existsSync(config.SELFIE_STORAGE_DIR)) {
      fs.mkdirSync(config.SELFIE_STORAGE_DIR, { recursive: true });
    }
    const randomHex = crypto.randomBytes(12).toString('hex');
    const finalFilename = `selfie_${userId}_${randomHex}${imgResult.ext}`;
    const tempFilename = `temp_${userId}_${randomHex}${imgResult.ext}`;
    const tempPath = path.join(config.SELFIE_STORAGE_DIR, tempFilename);
    const finalPath = path.join(config.SELFIE_STORAGE_DIR, finalFilename);

    try {
      fs.writeFileSync(tempPath, imgResult.buffer);
      fs.renameSync(tempPath, finalPath);
    } catch (fsErr) {
      console.error('[SELFIE STORAGE ERROR]', fsErr);
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
      return res.status(500).json({
        success: false,
        error: 'Failed to securely store donor photograph. Please try again.'
      });
    }

    // 8. Insert into donor_profiles within database transaction with retry for unique public reference
    try {
      const tableCols = db.prepare('PRAGMA table_info(donor_profiles)').all().map(c => c.name);
      const hasDirectoryConsentCol = tableCols.includes('consent_directory_listing');
      const hasPublicReferenceCol = tableCols.includes('public_reference');

      let publicReference = null;
      let insertSuccess = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        publicReference = hasPublicReferenceCol ? generatePublicDonorReference() : null;
        try {
          db.exec('BEGIN TRANSACTION;');

          if (hasPublicReferenceCol && hasDirectoryConsentCol) {
            db.prepare(`
              INSERT INTO donor_profiles (
                user_id, blood_group, city, pincode, latitude, longitude,
                is_available_for_emergency, consent_emergency_alerts,
                last_donation_date, total_donations_count,
                profile_photo_path, profile_photo_mime, profile_photo_size_bytes,
                profile_photo_updated_at, selfie_consent_given, selfie_consent_at,
                is_photo_public, consent_directory_listing, public_reference
              ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, 0,
                ?, ?, ?,
                CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP,
                ?, ?, ?
              )
            `).run(
              userId,
              req.user.blood_group,
              req.user.city,
              cleanPincode,
              latitude ? parseFloat(latitude) : null,
              longitude ? parseFloat(longitude) : null,
              emergencyAvail,
              alertConsent,
              cleanLastDate,
              finalFilename,
              imgResult.mime,
              imgResult.sizeBytes,
              photoPublic,
              directoryConsent,
              publicReference
            );
          } else if (hasDirectoryConsentCol) {
            db.prepare(`
              INSERT INTO donor_profiles (
                user_id, blood_group, city, pincode, latitude, longitude,
                is_available_for_emergency, consent_emergency_alerts,
                last_donation_date, total_donations_count,
                profile_photo_path, profile_photo_mime, profile_photo_size_bytes,
                profile_photo_updated_at, selfie_consent_given, selfie_consent_at,
                is_photo_public, consent_directory_listing
              ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, 0,
                ?, ?, ?,
                CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP,
                ?, ?
              )
            `).run(
              userId,
              req.user.blood_group,
              req.user.city,
              cleanPincode,
              latitude ? parseFloat(latitude) : null,
              longitude ? parseFloat(longitude) : null,
              emergencyAvail,
              alertConsent,
              cleanLastDate,
              finalFilename,
              imgResult.mime,
              imgResult.sizeBytes,
              photoPublic,
              directoryConsent
            );
          } else {
            db.prepare(`
              INSERT INTO donor_profiles (
                user_id, blood_group, city, pincode, latitude, longitude,
                is_available_for_emergency, consent_emergency_alerts,
                last_donation_date, total_donations_count,
                profile_photo_path, profile_photo_mime, profile_photo_size_bytes,
                profile_photo_updated_at, selfie_consent_given, selfie_consent_at,
                is_photo_public
              ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, 0,
                ?, ?, ?,
                CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP,
                ?
              )
            `).run(
              userId,
              req.user.blood_group,
              req.user.city,
              cleanPincode,
              latitude ? parseFloat(latitude) : null,
              longitude ? parseFloat(longitude) : null,
              emergencyAvail,
              alertConsent,
              cleanLastDate,
              finalFilename,
              imgResult.mime,
              imgResult.sizeBytes,
              photoPublic
            );
          }

          db.exec('COMMIT;');
          insertSuccess = true;
          break;
        } catch (retryErr) {
          db.exec('ROLLBACK;');
          if (retryErr.message && retryErr.message.includes('UNIQUE constraint failed: donor_profiles.public_reference') && attempt < 2) {
            continue; // retry reference generation
          }
          throw retryErr;
        }
      }

      if (!insertSuccess) {
        throw new Error('Failed to generate unique public reference after 3 attempts.');
      }

      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'DONOR_REGISTERED_WITH_SELFIE',
        details: { bloodGroup: req.user.blood_group, city: req.user.city, format: imgResult.format, consentDirectoryListing: Boolean(directoryConsent) },
        ipAddress: clientIp
      });

      logUserActivity({
        userId,
        eventType: 'DONOR_REGISTRATION',
        description: `Registered as a voluntary blood donor (${req.user.blood_group}) with visual selfie profile.`,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent']
      });

      const photoUrl = publicReference ? `/api/donor/photo/${publicReference}` : '/api/donor/me/photo';

      return res.status(201).json({
        success: true,
        message: 'Congratulations! You have successfully registered as a verified voluntary blood donor.',
        donor: {
          userId,
          isDonor: true,
          hasDonorProfile: true,
          publicReference,
          fullName: req.user.full_name,
          email: req.user.email,
          mobileNumber: req.user.mobile_number,
          bloodGroup: req.user.blood_group,
          city: req.user.city,
          pincode: cleanPincode,
          isAvailableForEmergency: Boolean(emergencyAvail),
          consentEmergencyAlerts: Boolean(alertConsent),
          lastDonationDate: cleanLastDate,
          totalDonationsCount: 0,
          hasPhoto: true,
          hasPhotoFile: true,
          photoUrl,
          mimeType: imgResult.mime,
          isPhotoPublic: Boolean(photoPublic),
          consentDirectoryListing: Boolean(directoryConsent),
          selfieConsentGiven: true
        }
      });
    } catch (dbErr) {
      // Cleanup written photo on DB error
      try { if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath); } catch (e) {}
      console.error('[DONOR REGISTER DB ERROR]', dbErr);
      return res.status(500).json({
        success: false,
        error: 'Database error occurred during donor registration. Please try again.'
      });
    }
  });

  // ==========================================
  // 2. GET CURRENT DONOR PROFILE
  // ==========================================
  app.get('/api/donor/profile', authenticateUser, (req, res) => {
    const db = getDatabase();
    const payload = buildDonorProfilePayload(db, req.user.id);
    return res.json({
      success: true,
      ...payload
    });
  });

  // ==========================================
  // 3A. AUTHENTICATED OWNER DONOR PHOTO STREAMING
  // Works on both legacy and Stage 2.8 schemas using authenticated req.user.id only
  // ==========================================
  app.get('/api/donor/me/photo', authenticateUser, (req, res) => {
    const db = getDatabase();
    const donor = db.prepare(`
      SELECT profile_photo_path, profile_photo_mime
      FROM donor_profiles
      WHERE user_id = ?
    `).get(req.user.id);

    if (!donor || !donor.profile_photo_path) {
      return res.status(404).json({
        success: false,
        code: 'PHOTO_NOT_FOUND',
        error: 'No profile photograph found for your donor profile.'
      });
    }

    const filePath = resolveSafeSelfiePath(donor.profile_photo_path);
    if (!filePath) {
      return res.status(404).json({
        success: false,
        code: 'PHOTO_FILE_MISSING',
        error: 'The photograph file could not be located on the storage server.'
      });
    }

    return streamSelfieFile(res, filePath, donor.profile_photo_mime);
  });

  // ==========================================
  // 3. AUTHENTICATED DONOR PHOTO STREAMING
  // ==========================================
  app.get('/api/donor/photo/:identifier', authenticateAny, (req, res) => {
    const rawIdentifier = req.params.identifier;
    if (!rawIdentifier || typeof rawIdentifier !== 'string' || !DONOR_REF_REGEX.test(rawIdentifier.trim())) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_DONOR_IDENTIFIER',
        error: 'Invalid donor identifier format. Expected format: DNR- followed by 32 hexadecimal characters.'
      });
    }

    const normalizedRef = rawIdentifier.trim().toUpperCase();
    const db = getDatabase();

    // Check if Stage 2.8 public_reference column exists
    const tableCols = db.prepare('PRAGMA table_info(donor_profiles)').all().map(c => c.name);
    if (!tableCols.includes('public_reference')) {
      return res.status(503).json({
        success: false,
        code: 'MIGRATION_REQUIRED',
        error: 'Donor photo service requires Stage 2.8 database migration to be applied.'
      });
    }

    const hasDirConsentCol = tableCols.includes('consent_directory_listing');

    // Direct O(1) indexed lookup on donor_profiles.public_reference (no candidate loop, no in-memory cache)
    const targetDonor = db.prepare(`
      SELECT user_id, profile_photo_path, profile_photo_mime, is_photo_public, public_reference
      ${hasDirConsentCol ? ', consent_directory_listing' : ', 0 as consent_directory_listing'}
      FROM donor_profiles
      WHERE public_reference = ?
    `).get(normalizedRef);

    if (!targetDonor || !targetDonor.profile_photo_path) {
      return res.status(404).json({
        success: false,
        code: 'PHOTO_NOT_FOUND',
        error: 'No profile photograph found for this donor reference.'
      });
    }

    // Access authorization check:
    // 1. Owner can always view their own photo (even if private or unlisted)
    // 2. Verified administrative staff (SUPER_ADMIN, ADMIN, MODERATOR) can view all photos
    // 3. Other community members can view ONLY if BOTH consent_directory_listing = 1 AND is_photo_public = 1
    const isOwner = Boolean(req.user && req.user.id === targetDonor.user_id);
    const isAdmin = Boolean(req.admin);
    const isPubliclyAllowed = Boolean(
      req.user &&
      Number(targetDonor.consent_directory_listing) === 1 &&
      Number(targetDonor.is_photo_public) === 1
    );

    if (!isOwner && !isAdmin && !isPubliclyAllowed) {
      return res.status(403).json({
        success: false,
        code: 'PHOTO_ACCESS_DENIED',
        error: 'Access Denied: This donor photograph is not available for public viewing.'
      });
    }

    // Prevent directory traversal and stream safely
    const filePath = resolveSafeSelfiePath(targetDonor.profile_photo_path);
    if (!filePath) {
      return res.status(404).json({
        success: false,
        code: 'PHOTO_FILE_MISSING',
        error: 'The photograph file could not be located on the storage server.'
      });
    }

    return streamSelfieFile(res, filePath, targetDonor.profile_photo_mime);
  });

  // ==========================================
  // 4. UPDATE DONOR PROFILE PHOTO
  // ==========================================
  app.put('/api/donor/photo', authenticateUser, async (req, res) => {
    if (!assertOwnUserOwnership(req, res)) return;
    const userId = req.user.id;
    const db = getDatabase();

    const tableCols = getDonorProfileColumns(db);
    const hasPublicReferenceCol = tableCols.includes('public_reference');

    const donor = db.prepare(`
      SELECT user_id, profile_photo_path
      ${hasPublicReferenceCol ? ', public_reference' : ''}
      FROM donor_profiles WHERE user_id = ?
    `).get(userId);

    if (!donor) {
      return res.status(404).json({
        success: false,
        code: 'DONOR_NOT_FOUND',
        error: 'Donor profile not found. Please register as a donor first.'
      });
    }

    const selfieImage = extractPhotoPayload(req);
    if (!selfieImage) {
      return res.status(400).json({
        success: false,
        code: 'SELFIE_REQUIRED',
        error: 'New selfie image payload is required.'
      });
    }

    const imgResult = validateImagePayload(selfieImage, {
      maxSize: config.MAX_SELFIE_SIZE_BYTES,
      requireDimensions: true
    });

    if (!imgResult.valid) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_IMAGE',
        error: imgResult.error
      });
    }

    // Write new photo atomically into dynamic storage directory
    const storageDir = config.SELFIE_STORAGE_DIR;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const randomHex = crypto.randomBytes(12).toString('hex');
    const newFilename = `selfie_${userId}_${randomHex}${imgResult.ext}`;
    const tempFilename = `temp_${userId}_${randomHex}${imgResult.ext}`;
    const tempPath = path.join(storageDir, tempFilename);
    const newPath = path.join(storageDir, newFilename);

    try {
      fs.writeFileSync(tempPath, imgResult.buffer);
      fs.renameSync(tempPath, newPath);
    } catch (fsErr) {
      console.error('[PHOTO UPDATE STORAGE ERROR]', fsErr);
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
      return res.status(500).json({
        success: false,
        error: 'Failed to write updated photograph to storage.'
      });
    }

    // Update DB transactionally (preserve existing public_reference & donation history)
    const oldFilename = donor.profile_photo_path;
    let txActive = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      txActive = true;

      db.prepare(`
        UPDATE donor_profiles 
        SET profile_photo_path = ?,
            profile_photo_mime = ?,
            profile_photo_size_bytes = ?,
            profile_photo_updated_at = CURRENT_TIMESTAMP,
            selfie_consent_given = 1,
            selfie_consent_at = COALESCE(selfie_consent_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newFilename, imgResult.mime, imgResult.sizeBytes, userId);

      db.exec('COMMIT');
      txActive = false;

      // Successfully updated DB; now remove old photo file from disk if different
      if (oldFilename && oldFilename !== newFilename) {
        const oldPath = path.join(storageDir, path.basename(oldFilename));
        try {
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (e) {
          console.warn('[CLEANUP WARNING] Failed to unlink old photo:', oldFilename);
        }
      }

      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'DONOR_SELFIE_UPDATED',
        details: { newFormat: imgResult.format, size: imgResult.sizeBytes },
        ipAddress: req.ip || '127.0.0.1'
      });

      const publicRef = donor.public_reference || null;
      const basePhotoUrl = publicRef ? `/api/donor/photo/${publicRef}` : '/api/donor/me/photo';
      const photoUrl = `${basePhotoUrl}?t=${Date.now()}`;

      return res.json({
        success: true,
        message: 'Donor profile photograph successfully updated.',
        photoUrl
      });
    } catch (dbErr) {
      if (txActive) {
        try { db.exec('ROLLBACK'); } catch (e) {}
      }
      // If DB update fails, clean up the newly written file and keep old file intact
      try { if (fs.existsSync(newPath)) fs.unlinkSync(newPath); } catch (e) {}
      console.error('[PHOTO UPDATE DB ERROR]', dbErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to update donor profile in database. Previous photo preserved.'
      });
    }
  });

  // ==========================================
  // 5. DELETE DONOR PROFILE PHOTO (DISALLOWED FOR REGISTERED DONORS)
  // ==========================================
  app.delete('/api/donor/photo', authenticateUser, (req, res) => {
    if (!assertOwnUserOwnership(req, res)) return;
    const userId = req.user.id;
    const db = getDatabase();

    const donor = db.prepare('SELECT user_id, profile_photo_path FROM donor_profiles WHERE user_id = ?').get(userId);
    if (!donor) {
      return res.status(404).json({
        success: false,
        code: 'DONOR_NOT_FOUND',
        error: 'Donor profile not found.'
      });
    }

    // Registered donors must always retain a validated profile photo; only replacement via PUT /api/donor/photo is allowed.
    return res.status(400).json({
      success: false,
      code: 'MANDATORY_PHOTO_REQUIRED',
      error: 'A registered donor profile must maintain a verified photograph. You can replace your photo, but cannot remove it completely.'
    });
  });

  // ==========================================
  // 6. UPDATE DONOR PHOTO PRIVACY SETTINGS
  // ==========================================
  const handlePrivacyUpdate = (req, res) => {
    if (!assertOwnUserOwnership(req, res)) return;
    const userId = req.user.id;
    const db = getDatabase();

    const donor = db.prepare('SELECT user_id, is_photo_public FROM donor_profiles WHERE user_id = ?').get(userId);
    if (!donor) {
      return res.status(404).json({
        success: false,
        code: 'DONOR_NOT_FOUND',
        error: 'Donor profile not found. Please register as a donor first.'
      });
    }

    const { isPhotoPublic } = req.body;
    if (typeof isPhotoPublic !== 'boolean' && isPhotoPublic !== 0 && isPhotoPublic !== 1 && isPhotoPublic !== 'true' && isPhotoPublic !== 'false') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PRIVACY_SETTING',
        error: 'isPhotoPublic must be a boolean (true or false).'
      });
    }

    const newPublicSetting = (isPhotoPublic === true || isPhotoPublic === 1 || isPhotoPublic === 'true') ? 1 : 0;

    try {
      db.prepare(`
        UPDATE donor_profiles 
        SET is_photo_public = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newPublicSetting, userId);

      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'DONOR_PHOTO_PRIVACY_UPDATED',
        details: { isPhotoPublic: Boolean(newPublicSetting) },
        ipAddress: req.ip || '127.0.0.1'
      });

      return res.json({
        success: true,
        message: newPublicSetting === 1
          ? 'Visual profile photo is now visible to community members in the voluntary donor directory.'
          : 'Visual profile photo is now private (visible only to you and verified hospital administrators).',
        isPhotoPublic: Boolean(newPublicSetting)
      });
    } catch (err) {
      console.error('[PRIVACY UPDATE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to update photo privacy preference.'
      });
    }
  };

  app.patch('/api/donor/privacy', authenticateUser, handlePrivacyUpdate);
  app.put('/api/donor/privacy', authenticateUser, handlePrivacyUpdate);

  // ==========================================
  // 7. UPDATE DONOR DIRECTORY LISTING CONSENT
  // ==========================================
  const handleDirectoryConsentUpdate = (req, res) => {
    if (!assertOwnUserOwnership(req, res)) return;
    const userId = req.user.id;
    const db = getDatabase();

    const donor = db.prepare('SELECT user_id FROM donor_profiles WHERE user_id = ?').get(userId);
    if (!donor) {
      return res.status(404).json({
        success: false,
        code: 'DONOR_NOT_FOUND',
        error: 'Donor profile not found. Please register as a donor first.'
      });
    }

    const { consent, consentDirectoryListing } = req.body;
    const val = consent !== undefined ? consent : consentDirectoryListing;
    if (typeof val !== 'boolean' && val !== 0 && val !== 1 && val !== 'true' && val !== 'false') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CONSENT_VALUE',
        error: 'consent must be a boolean (true or false).'
      });
    }

    const newConsent = (val === true || val === 1 || val === 'true') ? 1 : 0;

    try {
      const tableCols = db.prepare('PRAGMA table_info(donor_profiles)').all().map(c => c.name);
      if (!tableCols.includes('consent_directory_listing')) {
        return res.status(503).json({
          success: false,
          error: 'Directory consent feature requires Stage 2.7 migration to be executed.'
        });
      }

      db.prepare(`
        UPDATE donor_profiles 
        SET consent_directory_listing = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(newConsent, userId);

      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'DONOR_DIRECTORY_CONSENT_UPDATED',
        details: { consentDirectoryListing: Boolean(newConsent) },
        ipAddress: req.ip || '127.0.0.1'
      });

      return res.json({
        success: true,
        message: newConsent === 1
          ? 'Your profile is now listed in the public Voluntary Donor Directory for emergency assistance.'
          : 'Your profile has been unlisted from the public Voluntary Donor Directory.',
        consentDirectoryListing: Boolean(newConsent)
      });
    } catch (err) {
      console.error('[DIRECTORY CONSENT UPDATE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to update directory listing consent.'
      });
    }
  };

  app.patch('/api/donor/directory-consent', authenticateUser, handleDirectoryConsentUpdate);
  app.put('/api/donor/directory-consent', authenticateUser, handleDirectoryConsentUpdate);

  // Helper to format safe donor display name (e.g. "Rajesh S.")
  function formatDonorDisplayName(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'Anonymous Donor';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first} ${lastInitial}.`;
  }

  // ==========================================
  // 8. GET PUBLIC VOLUNTARY DONOR DIRECTORY
  // ==========================================
  app.get('/api/donors', (req, res) => {
    const db = getDatabase();

    // Check if columns exist
    const tableCols = db.prepare('PRAGMA table_info(donor_profiles)').all().map(c => c.name);
    if (!tableCols.includes('consent_directory_listing')) {
      return res.json({
        success: true,
        donors: [],
        totalCount: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
        message: 'Voluntary donor directory is awaiting Stage 2.7 schema migration.'
      });
    }

    if (!tableCols.includes('public_reference')) {
      return res.json({
        success: true,
        donors: [],
        totalCount: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
        message: 'Voluntary donor directory is awaiting Stage 2.8 schema migration.'
      });
    }

    const { bloodGroup, city, search } = req.query;
    const availableOnly = req.query.availableOnly === 'true' || req.query.availableOnly === '1';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;

    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const whereClauses = [
      'u.is_active = 1',
      'u.is_suspended = 0',
      'd.is_available_for_emergency = 1',
      'd.consent_directory_listing = 1'
    ];
    const params = [];

    if (bloodGroup && bloodGroup !== 'All' && bloodGroup !== 'ALL') {
      const cleanBg = bloodGroup.trim().toUpperCase();
      if (validBloodGroups.includes(cleanBg)) {
        whereClauses.push('d.blood_group = ?');
        params.push(cleanBg);
      }
    }

    if (city && city !== 'All' && city !== 'ALL' && city.trim()) {
      whereClauses.push('LOWER(d.city) LIKE ?');
      params.push(`%${city.trim().toLowerCase()}%`);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(u.full_name) LIKE ? OR LOWER(d.city) LIKE ? OR LOWER(d.blood_group) LIKE ?)');
      params.push(term, term, term);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    try {
      const hasLegacyPledgesTable = tableExists(db, 'pledges');
      const completedPledgesExpr = hasLegacyPledgesTable
        ? "(SELECT COUNT(*) FROM pledges p WHERE p.user_id = d.user_id AND p.status = 'COMPLETED')"
        : '0';

      const allRows = db.prepare(`
        SELECT 
          d.user_id,
          d.public_reference,
          d.blood_group,
          d.city,
          d.total_donations_count,
          d.last_donation_date,
          d.is_available_for_emergency,
          d.profile_photo_path,
          d.is_photo_public,
          d.consent_directory_listing,
          d.created_at,
          u.full_name,
          u.is_active,
          u.is_suspended,
          u.age,
          ${completedPledgesExpr} AS completed_pledges_count
        FROM donor_profiles d
        JOIN users u ON d.user_id = u.id
        ${whereSql}
        ORDER BY d.total_donations_count DESC, d.created_at ASC
      `).all(...params);

      const availabilityMap = getBulkDonorAvailability(db, allRows);

      const filteredRows = availableOnly
        ? allRows.filter((r) => {
            const av = availabilityMap.get(r.user_id);
            return Boolean(av && av.isAvailable);
          })
        : allRows;

      const totalCount = filteredRows.length;
      const pageRows = filteredRows.slice(offset, offset + limit);

      const donors = pageRows.map(r => {
        const displayName = formatDonorDisplayName(r.full_name);
        const totalDonations = (r.total_donations_count || 0) + (r.completed_pledges_count || 0);
        const av = availabilityMap.get(r.user_id);

        const badges = ['Verified Voluntary Donor'];
        if (totalDonations >= 5) badges.push('Frequent Donor');
        if (r.blood_group === 'O-') badges.push('Universal Donor');
        badges.push(`${r.blood_group} On-Call`);

        const hasPhoto = Boolean(
          r.profile_photo_path &&
          Number(r.is_photo_public) === 1 &&
          Number(r.consent_directory_listing) === 1
        );
        const photoUrl = hasPhoto ? `/api/donor/photo/${r.public_reference}` : null;

        return {
          id: r.public_reference,
          displayName,
          bloodGroup: r.blood_group,
          city: r.city,
          isAvailable: Boolean(av && av.isAvailable),
          availabilityStatus: av ? av.status : 'AVAILABLE',
          availabilityLabel: av ? av.label : 'Available',
          isInCooldown: Boolean(av && av.isInCooldown),
          cooldownReason: av && av.isInCooldown ? av.reason : null,
          reavailableDate: av ? av.reavailableDate : null,
          daysRemaining: av ? av.daysRemaining : 0,
          lastVerifiedDonationDate: av ? av.lastVerifiedDonationDate : null,
          isEligibleForEmergencySelection: Boolean(av && av.isEligibleForEmergencySelection),
          medicalDisclaimer: av ? av.medicalDisclaimer : null,
          availability: av ? {
            status: av.status,
            label: av.label,
            isAvailable: av.isAvailable,
            isInCooldown: av.isInCooldown,
            isEligibleForEmergencySelection: av.isEligibleForEmergencySelection,
            lastVerifiedDonationDate: av.lastVerifiedDonationDate,
            reavailableDate: av.reavailableDate,
            daysRemaining: av.daysRemaining,
            reasonCode: av.reasonCode,
            reason: av.reason,
            badgeText: av.badgeText,
            medicalDisclaimer: av.medicalDisclaimer
          } : null,
          totalDonations,
          hasPhoto,
          photoUrl,
          badges,
          memberSince: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null
        };
      });

      return res.json({
        success: true,
        donors,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      });
    } catch (err) {
      console.error('[DONOR DIRECTORY SEARCH ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve voluntary donor directory.'
      });
    }
  });

  // ==========================================
  // 9. ADMIN: GET DONOR REGISTRY WITH COOLDOWN STATUS
  // ==========================================
  app.get('/api/admin/donors', authenticateAdmin, (req, res) => {
    const perms = req.admin?.permissions || [];
    const allowed =
      req.admin?.role_id === 'SUPER_ADMIN' ||
      req.admin?.role_name === 'SUPER_ADMIN' ||
      perms.includes('FULL_ADMINISTRATION') ||
      perms.includes('MANAGE_USERS') ||
      perms.includes('MANAGE_REQUESTS') ||
      perms.includes('MONITOR_REQUESTS');

    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Administrative permissions are required to view the donor availability registry.'
      });
    }

    const db = getDatabase();
    const { bloodGroup, city, search } = req.query;
    const availableOnly = req.query.availableOnly === 'true' || req.query.availableOnly === '1';

    try {
      const tableCols = getDonorProfileColumns(db);
      const hasPublicRefCol = tableCols.includes('public_reference');
      const hasConsentCol = tableCols.includes('consent_directory_listing');

      const whereClauses = ['1=1'];
      const params = [];

      if (bloodGroup && bloodGroup !== 'All' && bloodGroup !== 'ALL') {
        whereClauses.push('UPPER(d.blood_group) = ?');
        params.push(bloodGroup.trim().toUpperCase());
      }

      if (city && city !== 'All' && city !== 'ALL' && city.trim()) {
        whereClauses.push('LOWER(d.city) LIKE ?');
        params.push(`%${city.trim().toLowerCase()}%`);
      }

      if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        whereClauses.push('(LOWER(u.full_name) LIKE ? OR LOWER(d.city) LIKE ? OR LOWER(d.blood_group) LIKE ?)');
        params.push(term, term, term);
      }

      const rows = db.prepare(`
        SELECT
          d.user_id,
          ${hasPublicRefCol ? 'd.public_reference' : 'NULL AS public_reference'},
          ${hasConsentCol ? 'd.consent_directory_listing' : '0 AS consent_directory_listing'},
          d.blood_group,
          d.city,
          d.total_donations_count,
          d.last_donation_date,
          d.is_available_for_emergency,
          d.created_at,
          u.full_name,
          u.age,
          u.is_active,
          u.is_suspended
        FROM donor_profiles d
        JOIN users u ON d.user_id = u.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY d.total_donations_count DESC, d.created_at DESC
      `).all(...params);

      const availabilityMap = getBulkDonorAvailability(db, rows);

      const donors = rows
        .map((r) => {
          const av = availabilityMap.get(r.user_id);
          return {
            userId: r.user_id,
            publicReference: r.public_reference || null,
            fullName: r.full_name,
            bloodGroup: r.blood_group,
            city: r.city,
            age: r.age,
            isActive: r.is_active === 1,
            isSuspended: r.is_suspended === 1,
            isAvailableForEmergency: r.is_available_for_emergency === 1,
            consentDirectoryListing: Number(r.consent_directory_listing) === 1,
            totalDonationsCount: r.total_donations_count || 0,
            lastDonationDate: r.last_donation_date || null,
            isAvailable: Boolean(av && av.isAvailable),
            availabilityStatus: av ? av.status : 'UNAVAILABLE',
            availabilityLabel: av ? av.label : 'Unavailable',
            isInCooldown: Boolean(av && av.isInCooldown),
            cooldownReason: av && av.isInCooldown ? av.reason : null,
            reavailableDate: av ? av.reavailableDate : null,
            daysRemaining: av ? av.daysRemaining : 0,
            lastVerifiedDonationDate: av ? av.lastVerifiedDonationDate : null,
            isEligibleForEmergencySelection: Boolean(av && av.isEligibleForEmergencySelection),
            medicalDisclaimer: av ? av.medicalDisclaimer : null,
            availability: av || null
          };
        })
        .filter((d) => (!availableOnly ? true : d.isAvailable));

      return res.json({
        success: true,
        count: donors.length,
        donors
      });
    } catch (err) {
      console.error('[ADMIN DONOR REGISTRY ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve donor availability registry.'
      });
    }
  });

}
