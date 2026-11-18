import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import { 
  hashPassword, 
  verifyPassword, 
  generateOtp, 
  hashOtp, 
  verifyOtp, 
  generateSecureToken,
  createSignedToken,
  verifySignedToken
} from '../utils/crypto.js';
import { sendSms, verifyMobileOtp, normalizeIndianMobile } from '../utils/sms.js';
import { sendEmail } from '../utils/mailer.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { logSecurityAudit, logUserActivity } from '../utils/auditLogger.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { validateImagePayload } from '../utils/imageValidator.js';
import {
  calculateAgeFromDob,
  getDonorProfileColumns,
  resolveEffectiveAge
} from '../services/donorAvailabilityService.js';
import {
  buildDonorProfilePayload,
  extractPhotoPayload,
  generatePublicDonorReference
} from './donorRoutes.js';

export const VALID_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const TOKEN_HASH_REGEX = /^[a-f0-9]{64}$/;

// Persistent Registration Helper Functions
function hashRegistrationToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

function getPendingPhotoDir() {
  return path.join(config.SELFIE_STORAGE_DIR, '_pending_registrations');
}

function isTruthyConsent(val) {
  return val === true || val === 1 || val === '1' || String(val).toLowerCase() === 'true';
}

function getStagedPhotoPaths(tokenHash) {
  if (!tokenHash || !TOKEN_HASH_REGEX.test(tokenHash)) return null;
  const dir = getPendingPhotoDir();
  return {
    dir,
    binPath: path.join(dir, `${tokenHash}.bin`),
    metaPath: path.join(dir, `${tokenHash}.meta.json`)
  };
}

function removeStagedPendingPhoto(tokenHash) {
  const paths = getStagedPhotoPaths(tokenHash);
  if (!paths) return;
  for (const p of [paths.binPath, paths.metaPath]) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }
}

function stagePendingRegistrationPhoto(tokenHash, imgResult, expiresAt) {
  const paths = getStagedPhotoPaths(tokenHash);
  if (!paths) {
    throw new Error('Invalid registration token hash for staging photo.');
  }
  if (!fs.existsSync(paths.dir)) {
    fs.mkdirSync(paths.dir, { recursive: true });
  }
  const tmpBin = `${paths.binPath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const tmpMeta = `${paths.metaPath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const metadata = {
    format: imgResult.format,
    mime: imgResult.mime,
    ext: imgResult.ext,
    sizeBytes: imgResult.sizeBytes,
    width: imgResult.width,
    height: imgResult.height,
    selfieConsentGiven: true,
    consentRecordedAt: new Date().toISOString(),
    expiresAt
  };
  try {
    fs.writeFileSync(tmpBin, imgResult.buffer);
    fs.renameSync(tmpBin, paths.binPath);
    fs.writeFileSync(tmpMeta, JSON.stringify(metadata));
    fs.renameSync(tmpMeta, paths.metaPath);
  } catch (err) {
    for (const p of [tmpBin, tmpMeta, paths.binPath, paths.metaPath]) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
    throw err;
  }
}

function loadAndValidateStagedPhoto(tokenHash) {
  const paths = getStagedPhotoPaths(tokenHash);
  if (!paths) return { valid: false, error: 'Invalid pending registration token.' };
  if (!fs.existsSync(paths.metaPath) || !fs.existsSync(paths.binPath)) {
    return { valid: false, error: 'Required donor profile photograph was not found for this registration session.' };
  }

  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(paths.metaPath, 'utf8'));
  } catch {
    return { valid: false, error: 'Staged donor photograph metadata is corrupted.' };
  }

  if (!metadata || metadata.selfieConsentGiven !== true) {
    return { valid: false, error: 'Explicit photo consent was not recorded for this registration.' };
  }

  let rawBuffer;
  try {
    rawBuffer = fs.readFileSync(paths.binPath);
  } catch {
    return { valid: false, error: 'Unable to read staged donor photograph.' };
  }

  const revalidated = validateImagePayload(rawBuffer, {
    maxSize: config.MAX_SELFIE_SIZE_BYTES,
    requireDimensions: true
  });
  if (!revalidated.valid) {
    return { valid: false, error: revalidated.error || 'Staged donor photograph failed validation.' };
  }

  return {
    valid: true,
    ...revalidated,
    consentRecordedAt: metadata.consentRecordedAt || null
  };
}

function cleanupExpiredRegistrations(db) {
  try {
    const expiredRows = db.prepare(`
      SELECT token_hash FROM pending_user_registrations 
      WHERE datetime(expires_at) < datetime('now')
    `).all();
    for (const row of expiredRows) {
      removeStagedPendingPhoto(row.token_hash);
    }
    db.prepare(`
      DELETE FROM pending_user_registrations 
      WHERE datetime(expires_at) < datetime('now')
    `).run();
  } catch (err) {
    // Gracefully handle if table not yet created
  }

  // Sweep orphaned or expired staged photos on disk
  try {
    const pendingDir = getPendingPhotoDir();
    if (!fs.existsSync(pendingDir)) return;
    const files = fs.readdirSync(pendingDir);
    const nowMs = Date.now();
    for (const file of files) {
      if (!file.endsWith('.meta.json')) continue;
      const tokenHash = file.slice(0, -'.meta.json'.length);
      if (!TOKEN_HASH_REGEX.test(tokenHash)) continue;
      const metaPath = path.join(pendingDir, file);
      let shouldRemove = false;
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (!meta?.expiresAt || Number.isNaN(Date.parse(meta.expiresAt)) || Date.parse(meta.expiresAt) < nowMs) {
          shouldRemove = true;
        }
      } catch {
        shouldRemove = true;
      }
      if (shouldRemove) {
        removeStagedPendingPhoto(tokenHash);
      }
    }
  } catch {}
}

export function setupUserAuthRoutes(app) {
  
  // ==========================================
  // DIRECT USER REGISTRATION (When OTP_ENABLED is false)
  // Atomic registration with password, photo validation, consent and terms
  // ==========================================
  app.post('/api/user/register/direct', async (req, res) => {
    const {
      fullName,
      mobileNumber,
      email,
      age,
      dob,
      dateOfBirth,
      gender,
      bloodGroup,
      city,
      password,
      confirmPassword
    } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Rate limiting per IP
    const limit = rateLimiter.check(`reg_direct_${clientIp}`, 10, 10 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ success: false, error: limit.error });
    }

    const rawDob = dob !== undefined && dob !== null && String(dob).trim() !== '' ? String(dob).trim() :
                   dateOfBirth !== undefined && dateOfBirth !== null && String(dateOfBirth).trim() !== '' ? String(dateOfBirth).trim() : null;

    // Input Validation
    if (
      !String(fullName || '').trim() ||
      !String(mobileNumber || '').trim() ||
      !String(email || '').trim() ||
      (!rawDob && (age === undefined || age === null || String(age).trim() === '')) ||
      !String(bloodGroup || '').trim() ||
      !String(city || '').trim()
    ) {
      return res.status(400).json({
        success: false,
        error: 'All registration details are required: Full Name, Mobile Number, Email, Date of Birth, Blood Group, and City.'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.'
      });
    }

    const cleanMobile = mobileNumber.replace(/\s+/g, '');
    const cleanEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    // Validate 10-digit Indian mobile format
    const normalizedMobile = normalizeIndianMobile(cleanMobile);
    if (!normalizedMobile) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 10-digit Indian mobile number (e.g. 9876543210).'
      });
    }

    // Per-mobile rate limit
    const mobileLimit = rateLimiter.check(`reg_mobile_${normalizedMobile}`, 5, 10 * 60 * 1000);
    if (!mobileLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many registration attempts for this mobile number. Please wait a few minutes before trying again.'
      });
    }

    // Validate DOB and calculate dynamic age (Asia/Kolkata)
    let numAge = null;
    let storedDob = null;
    if (rawDob) {
      const calculatedAge = calculateAgeFromDob(rawDob);
      if (calculatedAge === null) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid date of birth (YYYY-MM-DD).'
        });
      }
      if (calculatedAge === -1) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth cannot be in the future.'
        });
      }
      if (calculatedAge < 18 || calculatedAge > 65) {
        return res.status(400).json({
          success: false,
          error: 'Voluntary blood donors must be aged between 18 and 65 years.'
        });
      }
      numAge = calculatedAge;
      storedDob = rawDob;
    } else {
      const parsedAge = parseInt(age, 10);
      if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 65) {
        return res.status(400).json({
          success: false,
          error: 'Voluntary blood donors must be aged between 18 and 65 years.'
        });
      }
      numAge = parsedAge;
      storedDob = null;
    }

    // Validate Gender
    let storedGender = null;
    if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
      const trimmedGender = String(gender).trim();
      if (!VALID_GENDERS.includes(trimmedGender)) {
        return res.status(400).json({
          success: false,
          error: 'Please select a valid gender option (Male, Female, Other, Prefer not to say).'
        });
      }
      storedGender = trimmedGender;
    }

    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (!validBloodGroups.includes(String(bloodGroup).trim())) {
      return res.status(400).json({ success: false, error: 'Please select a valid blood group.' });
    }

    // Mandatory Terms & Conditions acceptance
    const rawTermsConsent = req.body.termsAccepted ?? req.body.termsConsent ?? req.body.termsAndConditionsAccepted;
    if (!isTruthyConsent(rawTermsConsent)) {
      return res.status(400).json({
        success: false,
        code: 'TERMS_ACCEPTANCE_REQUIRED',
        error: 'You must review and accept the RED MISSION Terms & Conditions to register.'
      });
    }

    const termsVersion = String(req.body.termsVersion || '1.0.0').trim();
    const privacyPolicyVersion = String(req.body.privacyPolicyVersion || req.body.privacyVersion || '1.0.0').trim();

    // Mandatory Donor Profile Photo & Consent validation
    const rawConsent = req.body.photoConsent ?? req.body.selfieConsent ?? req.body.selfieConsentGiven;
    if (!isTruthyConsent(rawConsent)) {
      return res.status(400).json({
        success: false,
        code: 'PHOTO_CONSENT_REQUIRED',
        error: 'Explicit consent for capturing and securely storing your donor verification photograph is required to register.'
      });
    }

    const rawPhotoPayload = extractPhotoPayload(req);
    if (!rawPhotoPayload) {
      return res.status(400).json({
        success: false,
        code: 'DONOR_PHOTO_REQUIRED',
        error: 'A genuine donor profile photograph is required before proceeding with registration.'
      });
    }

    const imgResult = validateImagePayload(rawPhotoPayload, {
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

    const db = getDatabase();
    const existingUser = db.prepare(`
      SELECT email, mobile_number FROM users
      WHERE email = ? OR mobile_number = ?
    `).get(cleanEmail, normalizedMobile);

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return res.status(409).json({
          success: false,
          error: 'An account is already registered with this email address. Please log in or reset your password.'
        });
      }
      if (existingUser.mobile_number === normalizedMobile) {
        return res.status(409).json({
          success: false,
          error: 'An account is already registered with this mobile number. Please log in or reset your password.'
        });
      }
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const { hash, salt } = hashPassword(password);

    // Promote validated photo into config.SELFIE_STORAGE_DIR
    const storageDir = config.SELFIE_STORAGE_DIR;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const randomHex = crypto.randomBytes(12).toString('hex');
    const finalPhotoFilename = `selfie_${userId}_${randomHex}${imgResult.ext}`;
    const tempPromoPath = path.join(storageDir, `temp_${userId}_${randomHex}${imgResult.ext}`);
    const finalPhotoPath = path.join(storageDir, finalPhotoFilename);

    try {
      fs.writeFileSync(tempPromoPath, imgResult.buffer);
      fs.renameSync(tempPromoPath, finalPhotoPath);
    } catch (fsErr) {
      try { if (fs.existsSync(tempPromoPath)) fs.unlinkSync(tempPromoPath); } catch {}
      try { if (fs.existsSync(finalPhotoPath)) fs.unlinkSync(finalPhotoPath); } catch {}
      console.error('[DIRECT REGISTRATION PHOTO ERROR]', fsErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to persist donor photograph securely. Please try again.'
      });
    }

    let txActive = false;
    try {
      const donorCols = getDonorProfileColumns(db);
      const hasPublicRefCol = donorCols.includes('public_reference');
      const hasDirConsentCol = donorCols.includes('consent_directory_listing');

      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      txActive = true;

      // 1. Insert User
      db.prepare(`
        INSERT INTO users (
          id, full_name, mobile_number, email, age, date_of_birth, gender, blood_group, city,
          password_hash, password_salt, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        userId,
        String(fullName).trim(),
        normalizedMobile,
        cleanEmail,
        numAge,
        storedDob,
        storedGender,
        String(bloodGroup).trim(),
        String(city).trim(),
        hash,
        salt
      );

      // 2. Insert Verification record: Do not falsely mark unverified contacts as verified!
      // In direct OTP-free registration, mobile_verified and email_verified are 0 with null timestamps.
      db.prepare(`
        INSERT INTO user_verifications (
          id, user_id, mobile_verified, mobile_verified_at, email_verified, email_verified_at
        ) VALUES (?, ?, 0, NULL, 0, NULL)
      `).run(`vrf_${crypto.randomUUID()}`, userId);

      // 3. Build dynamic 1:1 donor_profiles insert
      const insertCols = [
        'user_id', 'blood_group', 'city', 'pincode',
        'is_available_for_emergency', 'consent_emergency_alerts',
        'last_donation_date', 'total_donations_count',
        'profile_photo_path', 'profile_photo_mime', 'profile_photo_size_bytes'
      ];
      const insertVals = [
        userId, String(bloodGroup).trim(), String(city).trim(), null,
        1, 1,
        null, 0,
        finalPhotoFilename, imgResult.mime, imgResult.sizeBytes
      ];

      const colSql = [...insertCols];
      const valSql = insertVals.map(() => '?');

      colSql.push('profile_photo_updated_at');
      valSql.push('CURRENT_TIMESTAMP');

      colSql.push('selfie_consent_given');
      valSql.push('1');

      colSql.push('selfie_consent_at');
      valSql.push('CURRENT_TIMESTAMP');

      colSql.push('is_photo_public');
      valSql.push('0');

      if (hasDirConsentCol) {
        colSql.push('consent_directory_listing');
        valSql.push('1');
      }

      if (hasPublicRefCol) {
        colSql.push('public_reference');
        valSql.push('?');
        insertVals.push(generatePublicDonorReference());
      }

      db.prepare(`
        INSERT INTO donor_profiles (${colSql.join(', ')})
        VALUES (${valSql.join(', ')})
      `).run(...insertVals);

      // 4. Record User Consents
      db.prepare(`
        INSERT INTO user_consents (
          id, user_id, terms_accepted, terms_version, terms_accepted_at,
          privacy_accepted, privacy_version, privacy_accepted_at
        ) VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP, 1, ?, CURRENT_TIMESTAMP)
      `).run(`cns_${crypto.randomUUID()}`, userId, termsVersion, privacyPolicyVersion);

      // 5. Commit
      db.exec('COMMIT;');
      txActive = false;

      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'USER_REGISTERED_DIRECT',
        details: { bloodGroup, city, dob: storedDob, gender: storedGender, termsVersion, privacyPolicyVersion, photoConsent: true },
        ipAddress: clientIp
      });

      logUserActivity({
        userId,
        eventType: 'ACCOUNT_CREATED',
        description: 'Account successfully registered via direct registration mode.',
        ipAddress: clientIp,
        userAgent: req.headers['user-agent']
      });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully! You can now log in.',
        userId
      });
    } catch (err) {
      if (txActive) {
        try { db.exec('ROLLBACK;'); } catch {}
      }
      try { if (fs.existsSync(finalPhotoPath)) fs.unlinkSync(finalPhotoPath); } catch {}
      console.error('[DIRECT REGISTRATION DB ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to complete registration. Please try again.'
      });
    }
  });

  // ==========================================
  // 1. MULTI-STEP USER REGISTRATION
  // ==========================================

  // Step 1: Validate donor details, mandatory photo + consent & dispatch Mobile OTP
  app.post('/api/user/register/step1', async (req, res) => {
    const {
      fullName,
      mobileNumber,
      email,
      age,
      dob,
      dateOfBirth,
      gender,
      bloodGroup,
      city
    } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Rate limiting per IP
    const limit = rateLimiter.check(`reg_step1_${clientIp}`, 10, 10 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ success: false, error: limit.error });
    }

    const rawDob = dob !== undefined && dob !== null && String(dob).trim() !== '' ? String(dob).trim() :
                   dateOfBirth !== undefined && dateOfBirth !== null && String(dateOfBirth).trim() !== '' ? String(dateOfBirth).trim() : null;

    // Input Validation
    if (
      !String(fullName || '').trim() ||
      !String(mobileNumber || '').trim() ||
      !String(email || '').trim() ||
      (!rawDob && (age === undefined || age === null || String(age).trim() === '')) ||
      !String(bloodGroup || '').trim() ||
      !String(city || '').trim()
    ) {
      return res.status(400).json({
        success: false,
        error: 'All registration details are required: Full Name, Mobile Number, Email, Date of Birth, Blood Group, and City.'
      });
    }

    const cleanMobile = mobileNumber.replace(/\s+/g, '');
    const cleanEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    // Validate 10-digit Indian mobile format
    const normalizedMobile = normalizeIndianMobile(cleanMobile);
    if (!normalizedMobile) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 10-digit Indian mobile number (e.g. 9876543210).'
      });
    }

    // Per-mobile rate limit to prevent abuse/spam
    const mobileLimit = rateLimiter.check(`reg_mobile_${normalizedMobile}`, 5, 10 * 60 * 1000);
    if (!mobileLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many registration attempts for this mobile number. Please wait a few minutes before trying again.'
      });
    }

    // Validate DOB and calculate dynamic age (Asia/Kolkata)
    let numAge = null;
    let storedDob = null;
    if (rawDob) {
      const calculatedAge = calculateAgeFromDob(rawDob);
      if (calculatedAge === null) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid date of birth (YYYY-MM-DD).'
        });
      }
      if (calculatedAge === -1) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth cannot be in the future.'
        });
      }
      if (calculatedAge < 18 || calculatedAge > 65) {
        return res.status(400).json({
          success: false,
          error: 'Voluntary blood donors must be aged between 18 and 65 years.'
        });
      }
      numAge = calculatedAge;
      storedDob = rawDob;
    } else {
      const parsedAge = parseInt(age, 10);
      if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 65) {
        return res.status(400).json({
          success: false,
          error: 'Voluntary blood donors must be aged between 18 and 65 years.'
        });
      }
      numAge = parsedAge;
      storedDob = null;
    }

    // Validate Gender
    let storedGender = null;
    if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
      const trimmedGender = String(gender).trim();
      if (!VALID_GENDERS.includes(trimmedGender)) {
        return res.status(400).json({
          success: false,
          error: 'Please select a valid gender option (Male, Female, Other, Prefer not to say).'
        });
      }
      storedGender = trimmedGender;
    }

    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (!validBloodGroups.includes(String(bloodGroup).trim())) {
      return res.status(400).json({ success: false, error: 'Please select a valid blood group.' });
    }

    // Mandatory Terms & Conditions acceptance validation before proceeding
    const rawTermsConsent = req.body.termsAccepted ?? req.body.termsConsent ?? req.body.termsAndConditionsAccepted;
    if (!isTruthyConsent(rawTermsConsent)) {
      return res.status(400).json({
        success: false,
        code: 'TERMS_ACCEPTANCE_REQUIRED',
        error: 'You must review and accept the RED MISSION Terms & Conditions to register.'
      });
    }

    const termsVersion = String(req.body.termsVersion || '1.0.0').trim();
    const privacyPolicyVersion = String(req.body.privacyPolicyVersion || req.body.privacyVersion || '1.0.0').trim();

    // Mandatory Donor Profile Photo & Consent validation before sending OTPs
    const rawConsent = req.body.photoConsent ?? req.body.selfieConsent ?? req.body.selfieConsentGiven;
    if (!isTruthyConsent(rawConsent)) {
      return res.status(400).json({
        success: false,
        code: 'PHOTO_CONSENT_REQUIRED',
        error: 'Explicit consent for capturing and securely storing your donor verification photograph is required to register.'
      });
    }

    const rawPhotoPayload = extractPhotoPayload(req);
    if (!rawPhotoPayload) {
      return res.status(400).json({
        success: false,
        code: 'DONOR_PHOTO_REQUIRED',
        error: 'A genuine donor profile photograph is required before proceeding with registration.'
      });
    }

    const imgResult = validateImagePayload(rawPhotoPayload, {
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

    // Check for duplicate mobile or email
    const db = getDatabase();
    const existingUser = db.prepare(`
      SELECT email, mobile_number FROM users
      WHERE email = ? OR mobile_number = ?
    `).get(cleanEmail, normalizedMobile);

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return res.status(409).json({
          success: false,
          error: 'An account is already registered with this email address. Please log in or reset your password.'
        });
      }
      if (existingUser.mobile_number === normalizedMobile) {
        return res.status(409).json({
          success: false,
          error: 'An account is already registered with this mobile number. Please log in or reset your password.'
        });
      }
    }

    // Generate Mobile OTP:
    // In default FAST2SMS mode (FAST2SMS_CUSTOM_OTP=false), Fast2SMS generates the OTP.
    // In custom mode (FAST2SMS_CUSTOM_OTP=true) or DEMO mode, our server generates and hashes the OTP.
    const isCustomOrDemo = config.SMS_PROVIDER === 'DEMO' || Boolean(config.FAST2SMS_CUSTOM_OTP);
    const rawMobileOtp = isCustomOrDemo ? generateOtp() : null;
    const { hash, salt } = rawMobileOtp ? hashOtp(rawMobileOtp) : { hash: 'FAST2SMS_MANAGED', salt: 'FAST2SMS_MANAGED' };
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Dispatch SMS first: If SMS fails, do not create orphan registration or OTP records!
    const smsRes = await sendSms({
      mobileNumber: normalizedMobile,
      message: rawMobileOtp ? `Your RED MISSION mobile verification code is: ${rawMobileOtp}. Valid for ${config.OTP_EXPIRY_MINUTES} minutes.` : 'Your RED MISSION mobile verification code has been dispatched.',
      otp: rawMobileOtp
    });

    if (!smsRes.success) {
      return res.status(400).json({
        success: false,
        error: smsRes.error || 'Failed to dispatch mobile verification code. Please check your mobile number and try again.'
      });
    }

    const registrationToken = generateSecureToken(24);
    const tokenHash = hashRegistrationToken(registrationToken);
    const sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes session

    // Clean up expired registrations and any previous registration (plus staged photos) for this mobile/email
    cleanupExpiredRegistrations(db);
    let staged = false;
    try {
      const priorRows = db.prepare(`
        SELECT token_hash FROM pending_user_registrations
        WHERE mobile_number = ? OR email = ?
      `).all(normalizedMobile, cleanEmail);
      for (const row of priorRows) {
        removeStagedPendingPhoto(row.token_hash);
      }

      db.prepare(`
        DELETE FROM pending_user_registrations 
        WHERE mobile_number = ? OR email = ?
      `).run(normalizedMobile, cleanEmail);

      stagePendingRegistrationPhoto(tokenHash, imgResult, sessionExpiresAt);
      staged = true;

      db.prepare(`
        INSERT INTO pending_user_registrations (
          token_hash, full_name, mobile_number, email, age, date_of_birth, gender, blood_group, city,
          mobile_verified, email_verified,
          mobile_otp_hash, mobile_otp_salt, mobile_otp_expires_at,
          mobile_attempts, email_attempts,
          expires_at,
          terms_accepted, terms_version, terms_accepted_at,
          privacy_accepted, privacy_version, privacy_accepted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 0, 0, ?, 1, ?, CURRENT_TIMESTAMP, 1, ?, CURRENT_TIMESTAMP)
      `).run(
        tokenHash,
        String(fullName).trim(),
        normalizedMobile,
        cleanEmail,
        numAge,
        storedDob,
        storedGender,
        String(bloodGroup).trim(),
        String(city).trim(),
        hash,
        salt,
        expiresAt,
        sessionExpiresAt,
        termsVersion,
        privacyPolicyVersion
      );
    } catch (dbErr) {
      if (staged) {
        removeStagedPendingPhoto(tokenHash);
      }
      console.error('[REGISTRATION DB ERROR - STEP 1]', dbErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize registration session. Please try again.'
      });
    }

    // Record OTP in database (plain_demo_otp is NULL in production and FAST2SMS mode)
    db.prepare(`
      INSERT INTO otp_records (id, identifier, type, otp_hash, otp_salt, plain_demo_otp, expires_at, ip_address)
      VALUES (?, ?, 'MOBILE_VERIFICATION', ?, ?, ?, ?, ?)
    `).run(
      `otp_${crypto.randomUUID()}`,
      normalizedMobile,
      hash,
      salt,
      (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? rawMobileOtp : null,
      expiresAt,
      clientIp
    );

    res.json({
      success: true,
      message: `Mobile verification code sent to ${normalizedMobile}.`,
      registrationToken,
      mobileNumber: normalizedMobile,
      hasDonorPhoto: true,
      photoConsentRecorded: true,
      expiresInMinutes: config.OTP_EXPIRY_MINUTES,
      demoOtp: (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? smsRes.demoOtp : null
    });
  });

  // Step 2: Verify Mobile OTP & dispatch Email OTP
  app.post('/api/user/register/verify-mobile', async (req, res) => {
    const { registrationToken, otp } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!registrationToken || typeof registrationToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Registration session expired or invalid. Please start again.'
      });
    }

    const db = getDatabase();
    const tokenHash = hashRegistrationToken(registrationToken);
    let pending;
    try {
      pending = db.prepare('SELECT * FROM pending_user_registrations WHERE token_hash = ?').get(tokenHash);
    } catch (e) {
      console.error('[REGISTRATION DB ERROR - STEP 2]', e);
    }

    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'Registration session expired or invalid. Please start again.'
      });
    }

    if (new Date() > new Date(pending.expires_at)) {
      db.prepare('DELETE FROM pending_user_registrations WHERE token_hash = ?').run(tokenHash);
      removeStagedPendingPhoto(tokenHash);
      return res.status(400).json({ success: false, error: 'Registration session has expired. Please restart registration.' });
    }

    if (new Date() > new Date(pending.mobile_otp_expires_at)) {
      return res.status(400).json({ success: false, error: 'Mobile verification code has expired. Please request a new one.' });
    }

    const currentAttempts = (pending.mobile_attempts || 0) + 1;
    if (currentAttempts > 3) {
      db.prepare('DELETE FROM pending_user_registrations WHERE token_hash = ?').run(tokenHash);
      removeStagedPendingPhoto(tokenHash);
      return res.status(429).json({ success: false, error: 'Too many incorrect attempts. Please restart registration.' });
    }

    const verifyRes = await verifyMobileOtp({
      mobileNumber: pending.mobile_number,
      otp,
      salt: pending.mobile_otp_salt,
      hash: pending.mobile_otp_hash
    });

    if (!verifyRes.success) {
      db.prepare('UPDATE pending_user_registrations SET mobile_attempts = ? WHERE token_hash = ?').run(currentAttempts, tokenHash);
      const remainingAttempts = Math.max(0, 3 - currentAttempts);
      const msg = verifyRes.error && verifyRes.error !== 'Incorrect verification code.'
        ? `${verifyRes.error} (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining).`
        : `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`;

      return res.status(400).json({
        success: false,
        error: msg
      });
    }

    // Generate separate Email OTP
    const rawEmailOtp = generateOtp();
    const { hash, salt } = hashOtp(rawEmailOtp);
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE pending_user_registrations 
      SET mobile_verified = 1,
          email_otp_hash = ?,
          email_otp_salt = ?,
          email_otp_expires_at = ?,
          email_attempts = 0
      WHERE token_hash = ?
    `).run(hash, salt, expiresAt, tokenHash);

    db.prepare(`
      INSERT INTO otp_records (id, identifier, type, otp_hash, otp_salt, plain_demo_otp, expires_at, ip_address)
      VALUES (?, ?, 'EMAIL_VERIFICATION', ?, ?, ?, ?, ?)
    `).run(
      `otp_${crypto.randomUUID()}`,
      pending.email,
      hash,
      salt,
      config.IS_PROD ? null : rawEmailOtp,
      expiresAt,
      clientIp
    );

    const emailRes = await sendEmail({
      to: pending.email,
      subject: 'RED MISSION — Email Verification Code',
      text: `Hello ${pending.full_name},\n\nYour RED MISSION email verification code is: ${rawEmailOtp}\n\nValid for ${config.OTP_EXPIRY_MINUTES} minutes.`,
      otp: rawEmailOtp
    });

    res.json({
      success: true,
      message: `Mobile verified! Email verification code sent to ${pending.email}.`,
      registrationToken,
      email: pending.email,
      demoOtp: emailRes.demoOtp // only populated in development mode!
    });
  });

  // Step 3: Verify Email OTP
  app.post('/api/user/register/verify-email', async (req, res) => {
    const { registrationToken, otp } = req.body;

    if (!registrationToken || typeof registrationToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid registration sequence. Please verify mobile first.'
      });
    }

    const db = getDatabase();
    const tokenHash = hashRegistrationToken(registrationToken);
    let pending;
    try {
      pending = db.prepare('SELECT * FROM pending_user_registrations WHERE token_hash = ?').get(tokenHash);
    } catch (e) {
      console.error('[REGISTRATION DB ERROR - STEP 3]', e);
    }

    if (!pending || !pending.mobile_verified) {
      return res.status(400).json({
        success: false,
        error: 'Invalid registration sequence. Please verify mobile first.'
      });
    }

    if (new Date() > new Date(pending.expires_at)) {
      db.prepare('DELETE FROM pending_user_registrations WHERE token_hash = ?').run(tokenHash);
      removeStagedPendingPhoto(tokenHash);
      return res.status(400).json({ success: false, error: 'Registration session has expired. Please restart registration.' });
    }

    if (!pending.email_otp_expires_at || new Date() > new Date(pending.email_otp_expires_at)) {
      return res.status(400).json({ success: false, error: 'Email verification code has expired. Please request a new one.' });
    }

    const currentAttempts = (pending.email_attempts || 0) + 1;
    if (currentAttempts > 3) {
      db.prepare('DELETE FROM pending_user_registrations WHERE token_hash = ?').run(tokenHash);
      removeStagedPendingPhoto(tokenHash);
      return res.status(429).json({ success: false, error: 'Too many incorrect attempts. Please restart registration.' });
    }

    const isValid = verifyOtp(otp, pending.email_otp_salt, pending.email_otp_hash);
    if (!isValid) {
      db.prepare('UPDATE pending_user_registrations SET email_attempts = ? WHERE token_hash = ?').run(currentAttempts, tokenHash);
      return res.status(400).json({
        success: false,
        error: `Incorrect email code. ${3 - currentAttempts} attempts remaining.`
      });
    }

    db.prepare(`
      UPDATE pending_user_registrations 
      SET email_verified = 1
      WHERE token_hash = ?
    `).run(tokenHash);

    res.json({
      success: true,
      message: 'Both mobile and email successfully verified! Please create your password.',
      registrationToken,
      reviewData: {
        fullName: pending.full_name,
        mobileNumber: pending.mobile_number,
        email: pending.email,
        age: pending.age,
        bloodGroup: pending.blood_group,
        city: pending.city,
        hasDonorPhoto: true,
        photoConsentRecorded: true,
        termsAccepted: Boolean(pending.terms_accepted),
        termsVersion: pending.terms_version || '1.0.0',
        privacyPolicyAccepted: Boolean(pending.privacy_accepted),
        privacyPolicyVersion: pending.privacy_version || '1.0.0'
      }
    });
  });

  // Step 4: Password Creation & Atomic Account + Donor Profile Activation
  app.post('/api/user/register/complete', async (req, res) => {
    const { registrationToken, password, confirmPassword } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!registrationToken || typeof registrationToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Verification incomplete. Both mobile and email must be verified before account activation.'
      });
    }

    const db = getDatabase();
    const tokenHash = hashRegistrationToken(registrationToken);
    let pending;
    try {
      pending = db.prepare('SELECT * FROM pending_user_registrations WHERE token_hash = ?').get(tokenHash);
    } catch (e) {
      console.error('[REGISTRATION DB ERROR - STEP 4]', e);
    }

    if (!pending || !pending.mobile_verified || !pending.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Verification incomplete. Both mobile and email must be verified before account activation.'
      });
    }

    if (new Date() > new Date(pending.expires_at)) {
      db.prepare('DELETE FROM pending_user_registrations WHERE token_hash = ?').run(tokenHash);
      removeStagedPendingPhoto(tokenHash);
      return res.status(400).json({ success: false, error: 'Registration session expired. Please start again.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.'
      });
    }

    // Re-validate mandatory staged donor photograph and photo consent before persistence
    const stagedPhoto = loadAndValidateStagedPhoto(tokenHash);
    if (!stagedPhoto.valid) {
      return res.status(400).json({
        success: false,
        code: 'DONOR_PHOTO_REQUIRED',
        error: stagedPhoto.error || 'Validated donor profile photograph and consent are required to complete registration.'
      });
    }

    const existingDuplicate = db.prepare(`
      SELECT id FROM users WHERE email = ? OR mobile_number = ?
    `).get(pending.email, pending.mobile_number);
    if (existingDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'An account is already registered with this email address or mobile number.'
      });
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const { hash, salt } = hashPassword(password);

    // Promote validated photo into config.SELFIE_STORAGE_DIR (leaf filename only stored in DB)
    const storageDir = config.SELFIE_STORAGE_DIR;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const randomHex = crypto.randomBytes(12).toString('hex');
    const finalPhotoFilename = `selfie_${userId}_${randomHex}${stagedPhoto.ext}`;
    const tempPromoPath = path.join(storageDir, `temp_${userId}_${randomHex}${stagedPhoto.ext}`);
    const finalPhotoPath = path.join(storageDir, finalPhotoFilename);

    try {
      fs.writeFileSync(tempPromoPath, stagedPhoto.buffer);
      fs.renameSync(tempPromoPath, finalPhotoPath);
    } catch (fsErr) {
      try { if (fs.existsSync(tempPromoPath)) fs.unlinkSync(tempPromoPath); } catch {}
      try { if (fs.existsSync(finalPhotoPath)) fs.unlinkSync(finalPhotoPath); } catch {}
      console.error('[REGISTRATION PHOTO PROMOTE ERROR]', fsErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to persist donor photograph securely. Please try again.'
      });
    }

    let txActive = false;
    try {
      const donorCols = getDonorProfileColumns(db);
      const hasPublicRefCol = donorCols.includes('public_reference');
      const hasDirConsentCol = donorCols.includes('consent_directory_listing');

      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      txActive = true;

      // Insert User
      db.prepare(`
        INSERT INTO users (
          id, full_name, mobile_number, email, age, date_of_birth, gender, blood_group, city,
          password_hash, password_salt, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        userId,
        pending.full_name,
        pending.mobile_number,
        pending.email,
        pending.age,
        pending.date_of_birth || null,
        pending.gender || null,
        pending.blood_group,
        pending.city,
        hash,
        salt
      );

      // Insert Verification record
      db.prepare(`
        INSERT INTO user_verifications (
          id, user_id, mobile_verified, mobile_verified_at, email_verified, email_verified_at
        ) VALUES (?, ?, 1, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
      `).run(`vrf_${crypto.randomUUID()}`, userId);

      // Build dynamic 1:1 donor_profiles insert (registration never starts a donation cooldown)
      const insertCols = [
        'user_id', 'blood_group', 'city', 'pincode',
        'is_available_for_emergency', 'consent_emergency_alerts',
        'last_donation_date', 'total_donations_count',
        'profile_photo_path', 'profile_photo_mime', 'profile_photo_size_bytes',
        'profile_photo_updated_at', 'selfie_consent_given', 'selfie_consent_at',
        'is_photo_public'
      ];
      const insertVals = [
        userId, pending.blood_group, pending.city, null,
        1, 1,
        null, 0,
        finalPhotoFilename, stagedPhoto.mime, stagedPhoto.sizeBytes
      ];

      const colSql = [...insertCols];
      const valPlaceholders = [
        '?', '?', '?', '?',
        '?', '?',
        '?', '?',
        '?', '?', '?',
        'CURRENT_TIMESTAMP', '1', 'CURRENT_TIMESTAMP',
        '0'
      ];

      if (hasDirConsentCol) {
        colSql.push('consent_directory_listing');
        valPlaceholders.push('0');
      }

      if (hasPublicRefCol) {
        let publicRef = generatePublicDonorReference();
        for (let attempt = 0; attempt < 3; attempt++) {
          const exists = db.prepare('SELECT 1 FROM donor_profiles WHERE public_reference = ?').get(publicRef);
          if (!exists) break;
          publicRef = generatePublicDonorReference();
        }
        colSql.push('public_reference');
        valPlaceholders.push('?');
        insertVals.push(publicRef);
      }

      db.prepare(`
        INSERT INTO donor_profiles (${colSql.join(', ')})
        VALUES (${valPlaceholders.join(', ')})
      `).run(...insertVals);

      // Insert User Consent Record (Auditable, legally defensible)
      const consentId = `cst_${crypto.randomUUID()}`;
      const termsVer = pending.terms_version || '1.0.0';
      const privVer = pending.privacy_version || '1.0.0';
      const termsAcceptedAt = pending.terms_accepted_at || new Date().toISOString();
      const privacyAcceptedAt = pending.privacy_accepted_at || new Date().toISOString();

      db.prepare(`
        INSERT INTO user_consents (
          id, user_id, terms_accepted, terms_version, terms_accepted_at,
          privacy_accepted, privacy_version, privacy_accepted_at,
          ip_address, user_agent
        ) VALUES (?, ?, 1, ?, ?, 1, ?, ?, ?, ?)
      `).run(
        consentId,
        userId,
        termsVer,
        termsAcceptedAt,
        privVer,
        privacyAcceptedAt,
        clientIp,
        req.headers['user-agent'] || null
      );

      // Remove from pending
      db.prepare('DELETE FROM pending_user_registrations WHERE token_hash = ?').run(tokenHash);

      db.exec('COMMIT;');
      txActive = false;

      // Remove staged temporary registration photo once DB transaction commits cleanly
      removeStagedPendingPhoto(tokenHash);

      // Log Security Activity & Audit
      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'TERMS_AND_PRIVACY_ACCEPTED',
        details: { termsVersion: termsVer, privacyVersion: privVer },
        ipAddress: clientIp
      });

      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'USER_REGISTERED_AND_ACTIVATED',
        details: { email: pending.email, mobile: pending.mobile_number },
        ipAddress: clientIp
      });

      logSecurityAudit({
        actorType: 'USER',
        actorId: userId,
        action: 'DONOR_REGISTERED_WITH_SELFIE',
        details: { bloodGroup: pending.blood_group, city: pending.city, format: stagedPhoto.format },
        ipAddress: clientIp
      });

      logUserActivity({
        userId,
        eventType: 'ACCOUNT_ACTIVATION',
        description: 'Account and official donor profile successfully registered and dual-verified (Mobile + Email).',
        ipAddress: clientIp,
        userAgent: req.headers['user-agent']
      });

      const donorPayload = buildDonorProfilePayload(db, userId);

      // Send Welcome Confirmation Email
      sendEmail({
        to: pending.email,
        subject: 'Welcome to RED MISSION — Official Donor Account Activated',
        text: `Dear ${pending.full_name},\n\nYour RED MISSION account and official blood donor profile have been successfully activated. You can now log in using your registered mobile number or email address.`
      }).catch(() => {});

      res.status(201).json({
        success: true,
        message: 'Account and donor profile successfully created and activated! You can now log in.',
        user: {
          id: userId,
          fullName: pending.full_name,
          email: pending.email,
          mobileNumber: pending.mobile_number,
          age: pending.age,
          bloodGroup: pending.blood_group,
          city: pending.city
        },
        ...donorPayload,
        donorProfile: donorPayload.donor
      });
    } catch (err) {
      if (txActive) {
        try { db.exec('ROLLBACK;'); } catch {}
      }
      // Always delete promoted photo file if DB commit did not succeed (no orphan files)
      try { if (fs.existsSync(tempPromoPath)) fs.unlinkSync(tempPromoPath); } catch {}
      try { if (fs.existsSync(finalPhotoPath)) fs.unlinkSync(finalPhotoPath); } catch {}
      console.error('[REGISTRATION ERROR]', err);

      if (err && String(err.message || '').includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          success: false,
          error: 'An account is already registered with this email address or mobile number.'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'An unexpected error occurred during account creation. Please try again.'
      });
    }
  });

  // Resend Registration OTP
  app.post('/api/user/register/resend-otp', async (req, res) => {
    const { registrationToken, type } = req.body; // 'mobile' or 'email'
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!registrationToken || typeof registrationToken !== 'string') {
      return res.status(400).json({ success: false, error: 'Registration session expired.' });
    }

    const db = getDatabase();
    const tokenHash = hashRegistrationToken(registrationToken);
    let pending;
    try {
      pending = db.prepare('SELECT * FROM pending_user_registrations WHERE token_hash = ?').get(tokenHash);
    } catch (e) {
      console.error('[REGISTRATION DB ERROR - RESEND OTP]', e);
    }

    if (!pending) {
      return res.status(400).json({ success: false, error: 'Registration session expired.' });
    }

    if (new Date() > new Date(pending.expires_at)) {
      db.prepare('DELETE FROM pending_user_registrations WHERE token_hash = ?').run(tokenHash);
      removeStagedPendingPhoto(tokenHash);
      return res.status(400).json({ success: false, error: 'Registration session expired.' });
    }

    const limit = rateLimiter.check(`resend_${registrationToken}`, 3, 5 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ success: false, error: limit.error });
    }

    const rawOtp = generateOtp();
    const { hash, salt } = hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    if (type === 'email') {
      db.prepare(`
        UPDATE pending_user_registrations 
        SET email_otp_hash = ?,
            email_otp_salt = ?,
            email_otp_expires_at = ?,
            email_attempts = 0
        WHERE token_hash = ?
      `).run(hash, salt, expiresAt, tokenHash);

      db.prepare(`
        INSERT INTO otp_records (id, identifier, type, otp_hash, otp_salt, plain_demo_otp, expires_at, ip_address)
        VALUES (?, ?, 'EMAIL_VERIFICATION', ?, ?, ?, ?, ?)
      `).run(`otp_${crypto.randomUUID()}`, pending.email, hash, salt, config.IS_PROD ? null : rawOtp, expiresAt, clientIp);

      const emailRes = await sendEmail({
        to: pending.email,
        subject: 'RED MISSION — Resent Email Verification Code',
        text: `Your new email verification code is: ${rawOtp}`,
        otp: rawOtp
      });

      return res.json({
        success: true,
        message: `New email verification code sent to ${pending.email}.`,
        demoOtp: emailRes.demoOtp
      });
    } else {
      const isCustomOrDemo = config.SMS_PROVIDER === 'DEMO' || Boolean(config.FAST2SMS_CUSTOM_OTP);
      const rawMobileOtp = isCustomOrDemo ? generateOtp() : null;
      const { hash: mobHash, salt: mobSalt } = rawMobileOtp ? hashOtp(rawMobileOtp) : { hash: 'FAST2SMS_MANAGED', salt: 'FAST2SMS_MANAGED' };

      const smsRes = await sendSms({
        mobileNumber: pending.mobile_number,
        message: rawMobileOtp ? `Your new RED MISSION mobile verification code is: ${rawMobileOtp}` : 'Your new RED MISSION mobile verification code has been dispatched.',
        otp: rawMobileOtp
      });

      if (!smsRes.success) {
        return res.status(400).json({
          success: false,
          error: smsRes.error || 'Failed to dispatch new mobile verification code. Please try again.'
        });
      }

      db.prepare(`
        UPDATE pending_user_registrations 
        SET mobile_otp_hash = ?,
            mobile_otp_salt = ?,
            mobile_otp_expires_at = ?,
            mobile_attempts = 0
        WHERE token_hash = ?
      `).run(mobHash, mobSalt, expiresAt, tokenHash);

      db.prepare(`
        INSERT INTO otp_records (id, identifier, type, otp_hash, otp_salt, plain_demo_otp, expires_at, ip_address)
        VALUES (?, ?, 'MOBILE_VERIFICATION', ?, ?, ?, ?, ?)
      `).run(`otp_${crypto.randomUUID()}`, pending.mobile_number, mobHash, mobSalt, (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? rawMobileOtp : null, expiresAt, clientIp);

      return res.json({
        success: true,
        message: `New mobile verification code sent to ${pending.mobile_number}.`,
        demoOtp: (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? smsRes.demoOtp : null
      });
    }
  });

  // ==========================================
  // 2. USER LOGIN WITH 5-ATTEMPT LOCKOUT
  // ==========================================

  app.post('/api/user/login', async (req, res) => {
    const { identifier, password, rememberMe } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your registered mobile number or email address, and your password.'
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanMobile = identifier.replace(/\s+/g, '');

    // Server-side Rate Limiting per IP
    const ipLimit = rateLimiter.check(`login_ip_${clientIp}`, 15, 5 * 60 * 1000);
    if (!ipLimit.allowed) {
      return res.status(429).json({ success: false, error: ipLimit.error });
    }

    const db = getDatabase();

    // Find user by either email or mobile number
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE email = ? OR mobile_number = ?
    `).get(cleanIdentifier, cleanMobile);

    if (!user) {
      // Record failed attempt
      db.prepare(`
        INSERT INTO login_attempts (id, identifier, account_type, ip_address, user_agent, success, failure_reason)
        VALUES (?, ?, 'USER', ?, ?, 0, 'USER_NOT_FOUND')
      `).run(`att_${crypto.randomUUID()}`, cleanIdentifier, clientIp, userAgent);

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your identifier and password.'
      });
    }

    // Check if account is suspended
    if (user.is_suspended) {
      return res.status(403).json({
        success: false,
        error: 'Your account is suspended. Please contact RED MISSION administration.'
      });
    }

    // Check if account is locked out (30-minute lockout after 5 failed attempts)
    const now = new Date();
    if (user.lockout_until) {
      const lockoutExpiry = new Date(user.lockout_until);
      if (now < lockoutExpiry) {
        const remainingMinutes = Math.ceil((lockoutExpiry.getTime() - now.getTime()) / (60 * 1000));
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          error: `Account temporarily locked due to 5 consecutive failed login attempts. For security, please try again in ${remainingMinutes} minutes.`
        });
      } else {
        // Lockout period has elapsed; reset
        db.prepare('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?').run(user.id);
        user.failed_login_attempts = 0;
        user.lockout_until = null;
      }
    }

    // Verify Password
    const passwordValid = verifyPassword(password, user.password_salt, user.password_hash);
    if (!passwordValid) {
      const updatedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockoutDate = null;
      let isNowLocked = false;

      if (updatedAttempts >= config.MAX_FAILED_LOGIN_ATTEMPTS) {
        lockoutDate = new Date(now.getTime() + config.LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
        isNowLocked = true;

        // Security Notification: Email user about temporary lockout
        sendEmail({
          to: user.email,
          subject: 'Security Alert: Temporary Lockout on RED MISSION Account',
          text: `Dear ${user.full_name},\n\nYour RED MISSION account was temporarily locked for ${config.LOCKOUT_DURATION_MINUTES} minutes following 5 incorrect password attempts from IP ${clientIp}.\n\nIf this was not you, please reset your password once the lockout expires.`
        }).catch(() => {});

        logSecurityAudit({
          actorType: 'USER',
          actorId: user.id,
          action: 'USER_ACCOUNT_LOCKED_OUT',
          details: { ip: clientIp, attempts: updatedAttempts },
          ipAddress: clientIp
        });
      }

      db.prepare(`
        UPDATE users 
        SET failed_login_attempts = ?, lockout_until = ?
        WHERE id = ?
      `).run(updatedAttempts, lockoutDate, user.id);

      // Record failed attempt
      db.prepare(`
        INSERT INTO login_attempts (id, identifier, account_type, ip_address, user_agent, success, failure_reason)
        VALUES (?, ?, 'USER', ?, ?, 0, 'INCORRECT_PASSWORD')
      `).run(`att_${crypto.randomUUID()}`, cleanIdentifier, clientIp, userAgent);

      logUserActivity({
        userId: user.id,
        eventType: 'LOGIN_FAILED',
        description: `Failed login attempt with incorrect password (Attempt ${updatedAttempts}/${config.MAX_FAILED_LOGIN_ATTEMPTS}).`,
        ipAddress: clientIp,
        userAgent
      });

      if (isNowLocked) {
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          error: `Maximum 5 incorrect attempts reached. Your account has been temporarily locked for ${config.LOCKOUT_DURATION_MINUTES} minutes for security.`
        });
      }

      const remaining = config.MAX_FAILED_LOGIN_ATTEMPTS - updatedAttempts;
      return res.status(401).json({
        success: false,
        error: `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout.`
      });
    }

    // Success: Reset failed attempts & lockout
    db.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    // Create session (24 hours max duration, 30 min inactivity)
    const sessionToken = generateSecureToken(32);
    const sessionTokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(sessionToken).digest('hex');
    const sessionExpiresAt = new Date(Date.now() + config.USER_SESSION_MAX_HOURS * 60 * 60 * 1000).toISOString();

    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_sessions (
        id, user_id, session_token_hash, ip_address, user_agent, 
        device_info, remember_me, last_activity_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionToken,
      user.id,
      sessionTokenHash,
      clientIp,
      userAgent,
      extractDeviceSummary(userAgent),
      rememberMe ? 1 : 0,
      nowIso,
      sessionExpiresAt
    );

    // Record successful login
    db.prepare(`
      INSERT INTO login_attempts (id, identifier, account_type, ip_address, user_agent, success)
      VALUES (?, ?, 'USER', ?, ?, 1)
    `).run(`att_${crypto.randomUUID()}`, cleanIdentifier, clientIp, userAgent);

    logUserActivity({
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      description: `Successful login from ${extractDeviceSummary(userAgent)}.`,
      ipAddress: clientIp,
      userAgent
    });

    // Send successful login email notification
    sendEmail({
      to: user.email,
      subject: 'RED MISSION — Successful Login Notification',
      text: `Hello ${user.full_name},\n\nA successful login was detected on your RED MISSION account on ${new Date().toLocaleString()} from device: ${extractDeviceSummary(userAgent)} (IP: ${clientIp}).\n\nIf this was not you, please log in immediately to revoke all active sessions and change your password.`
    }).catch(() => {});

    // Set HTTP-only Cookie
    res.setHeader('Set-Cookie', [
      `red_mission_user_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.USER_SESSION_MAX_HOURS * 3600}${config.IS_PROD ? '; Secure' : ''}`
    ]);

    const donorPayload = buildDonorProfilePayload(db, user.id);
    const requiresProfileCompletion = Boolean(!user.date_of_birth || !user.gender);

    res.json({
      success: true,
      message: 'Login successful! Welcome back to RED MISSION.',
      token: sessionToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        mobileNumber: user.mobile_number,
        bloodGroup: user.blood_group,
        city: user.city,
        age: resolveEffectiveAge(user.age, user.date_of_birth),
        dateOfBirth: user.date_of_birth || null,
        gender: user.gender || null,
        requiresProfileCompletion
      },
      requiresProfileCompletion,
      isDonor: donorPayload.isDonor,
      hasDonorProfile: donorPayload.hasDonorProfile,
      hasPhoto: donorPayload.hasPhoto,
      hasPhotoFile: donorPayload.hasPhotoFile,
      needsDonorCompletion: donorPayload.needsDonorCompletion,
      needsDonorPhotoCompletion: donorPayload.needsDonorPhotoCompletion,
      legacyAccountState: donorPayload.legacyAccountState,
      availability: donorPayload.availability,
      donorProfile: donorPayload.donor
    });
  });

  // ==========================================
  // 3. CURRENT USER & LOGOUT
  // ==========================================

  app.get('/api/user/me', authenticateUser, (req, res) => {
    const db = getDatabase();
    const donorPayload = buildDonorProfilePayload(db, req.user.id);
    const requiresProfileCompletion = Boolean(!req.user.date_of_birth || !req.user.gender);

    res.json({
      success: true,
      user: {
        ...req.user,
        fullName: req.user.full_name || req.user.fullName,
        mobileNumber: req.user.mobile_number || req.user.mobileNumber,
        bloodGroup: req.user.blood_group || req.user.bloodGroup,
        dateOfBirth: req.user.date_of_birth || req.user.dateOfBirth || null,
        gender: req.user.gender || null,
        requiresProfileCompletion
      },
      requiresProfileCompletion,
      isDonor: donorPayload.isDonor,
      hasDonorProfile: donorPayload.hasDonorProfile,
      hasPhoto: donorPayload.hasPhoto,
      hasPhotoFile: donorPayload.hasPhotoFile,
      needsDonorCompletion: donorPayload.needsDonorCompletion,
      needsDonorPhotoCompletion: donorPayload.needsDonorPhotoCompletion,
      legacyAccountState: donorPayload.legacyAccountState,
      availability: donorPayload.availability,
      donorProfile: donorPayload.donor
    });
  });

  // ==========================================
  // USER PROFILE EDITING (PUT /api/user/profile)
  // ==========================================
  app.put('/api/user/profile', authenticateUser, async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    // Rate limiting per user: max 10 updates per 5 minutes
    const limit = rateLimiter.check(`prof_update_${req.user.id}`, 10, 5 * 60 * 1000);
    if (!limit.allowed) {
      return res.status(429).json({ success: false, error: limit.error });
    }

    // 1. Strict Ownership Enforcement & Privilege Escalation Guard
    // IDOR check: if an ID is passed in body, it MUST match authenticated user ID
    if (req.body.id && req.body.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized profile update attempt. You can only modify your own profile.'
      });
    }
    if (req.body.userId && req.body.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized profile update attempt. You can only modify your own profile.'
      });
    }

    // Forbidden privilege/security fields guard
    const forbiddenFields = [
      'role', 'roles', 'isAdmin', 'is_admin', 'is_super_admin',
      'isSuspended', 'is_suspended', 'isActive', 'is_active',
      'password_hash', 'password_salt', 'requires_password_change',
      'permissions', 'email_verified', 'mobile_verified'
    ];
    for (const key of forbiddenFields) {
      if (req.body[key] !== undefined) {
        return res.status(403).json({
          success: false,
          error: `Modifying security field '${key}' is strictly forbidden.`
        });
      }
    }

    const db = getDatabase();
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const {
      fullName,
      mobileNumber,
      email,
      dob,
      dateOfBirth,
      gender,
      bloodGroup,
      city,
      pincode
    } = req.body;

    // 2. CONTACT SECURITY GUARD
    // When OTP_ENABLED=false, never mark changed mobile/email as verified.
    // Do not replace a trusted password-recovery contact with an unverified address.
    // If safe pending-contact verification is not supported, block mobile/email changes.
    const requestedMobile = mobileNumber !== undefined ? String(mobileNumber).replace(/\s+/g, '') : null;
    const normalizedMobile = requestedMobile ? normalizeIndianMobile(requestedMobile) : null;
    if (requestedMobile && !normalizedMobile) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 10-digit Indian mobile number.'
      });
    }

    const requestedEmail = email !== undefined ? String(email).trim().toLowerCase() : null;
    if (requestedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(requestedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid email address.'
        });
      }
    }

    const mobileChanged = normalizedMobile && normalizedMobile !== currentUser.mobile_number;
    const emailChanged = requestedEmail && requestedEmail !== currentUser.email;

    if (mobileChanged || emailChanged) {
      if (!config.OTP_ENABLED) {
        return res.status(400).json({
          success: false,
          code: 'CONTACT_UPDATE_OTP_REQUIRED',
          error: 'Email and mobile number updates require two-factor OTP verification, which is currently disabled. Please contact Medical Command administration to update your trusted recovery channels.'
        });
      }
      return res.status(400).json({
        success: false,
        code: 'CONTACT_UPDATE_VERIFICATION_REQUIRED',
        error: 'Updating email or mobile number requires two-factor verification.'
      });
    }

    // 3. Field Validations
    let finalFullName = currentUser.full_name;
    if (fullName !== undefined) {
      const trimmed = String(fullName).trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Full Name must be between 2 and 100 characters.'
        });
      }
      finalFullName = trimmed;
    }

    let finalBloodGroup = currentUser.blood_group;
    if (bloodGroup !== undefined) {
      const trimmedBg = String(bloodGroup).trim();
      const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      if (!validBloodGroups.includes(trimmedBg)) {
        return res.status(400).json({
          success: false,
          error: 'Please select a valid blood group.'
        });
      }
      finalBloodGroup = trimmedBg;
    }

    let finalCity = currentUser.city;
    if (city !== undefined) {
      const trimmedCity = String(city).trim();
      if (!trimmedCity || trimmedCity.length < 2 || trimmedCity.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'City must be between 2 and 100 characters.'
        });
      }
      finalCity = trimmedCity;
    }

    let finalPincode = null;
    const currentDonor = db.prepare('SELECT pincode FROM donor_profiles WHERE user_id = ?').get(req.user.id);
    if (currentDonor) {
      finalPincode = currentDonor.pincode;
    }
    if (pincode !== undefined) {
      const trimmedPin = String(pincode || '').trim();
      if (trimmedPin) {
        if (!/^\d{6}$/.test(trimmedPin)) {
          return res.status(400).json({
            success: false,
            error: 'PIN code must be exactly 6 digits.'
          });
        }
        finalPincode = trimmedPin;
      } else {
        finalPincode = null;
      }
    }

    let finalDob = currentUser.date_of_birth;
    let finalAge = currentUser.age;
    const rawDob = dob !== undefined ? dob : dateOfBirth;
    if (rawDob !== undefined && rawDob !== null && String(rawDob).trim() !== '') {
      const trimmedDob = String(rawDob).trim();
      const calculatedAge = calculateAgeFromDob(trimmedDob);
      if (calculatedAge === null) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid date of birth (YYYY-MM-DD).'
        });
      }
      if (calculatedAge === -1) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth cannot be in the future.'
        });
      }
      if (calculatedAge < 18 || calculatedAge > 65) {
        return res.status(400).json({
          success: false,
          error: 'Voluntary blood donors must be aged between 18 and 65 years.'
        });
      }
      finalDob = trimmedDob;
      finalAge = calculatedAge;
    }

    let finalGender = currentUser.gender;
    if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
      const trimmedGender = String(gender).trim();
      if (!VALID_GENDERS.includes(trimmedGender)) {
        return res.status(400).json({
          success: false,
          error: 'Please select a valid gender option (Male, Female, Other, Prefer not to say).'
        });
      }
      finalGender = trimmedGender;
    }

    // 4. Photo Upload Handling (if provided)
    let newPhotoFilename = null;
    let newPhotoMime = null;
    let newPhotoSize = null;
    const rawPhotoPayload = extractPhotoPayload(req);
    if (rawPhotoPayload) {
      const imgResult = validateImagePayload(rawPhotoPayload, {
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

      const storageDir = config.SELFIE_STORAGE_DIR;
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      const randomHex = crypto.randomBytes(12).toString('hex');
      newPhotoFilename = `selfie_${req.user.id}_${randomHex}${imgResult.ext}`;
      const tempPath = path.join(storageDir, `temp_${req.user.id}_${randomHex}${imgResult.ext}`);
      const finalPath = path.join(storageDir, newPhotoFilename);

      try {
        fs.writeFileSync(tempPath, imgResult.buffer);
        fs.renameSync(tempPath, finalPath);
        newPhotoMime = imgResult.mime;
        newPhotoSize = imgResult.sizeBytes;
      } catch (fsErr) {
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
        try { if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath); } catch {}
        console.error('[PROFILE PHOTO UPLOAD ERROR]', fsErr);
        return res.status(500).json({
          success: false,
          error: 'Failed to persist profile photograph. Please try again.'
        });
      }
    }

    // 5. Database Transaction: Update users and sync donor_profiles
    let txActive = false;
    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      txActive = true;

      // Update users table
      db.prepare(`
        UPDATE users
        SET full_name = ?,
            blood_group = ?,
            city = ?,
            date_of_birth = ?,
            gender = ?,
            age = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        finalFullName,
        finalBloodGroup,
        finalCity,
        finalDob,
        finalGender,
        finalAge,
        req.user.id
      );

      // Sync donor_profiles table
      const donorCols = getDonorProfileColumns(db);
      const donorExists = db.prepare('SELECT user_id, profile_photo_path FROM donor_profiles WHERE user_id = ?').get(req.user.id);

      if (donorExists) {
        let updateDonorSql = `
          UPDATE donor_profiles
          SET blood_group = ?,
              city = ?,
              pincode = ?,
              updated_at = CURRENT_TIMESTAMP
        `;
        const updateParams = [finalBloodGroup, finalCity, finalPincode];

        if (newPhotoFilename) {
          updateDonorSql += `,
            profile_photo_path = ?,
            profile_photo_mime = ?,
            profile_photo_size_bytes = ?,
            profile_photo_updated_at = CURRENT_TIMESTAMP
          `;
          updateParams.push(newPhotoFilename, newPhotoMime, newPhotoSize);
        }

        updateDonorSql += ' WHERE user_id = ?';
        updateParams.push(req.user.id);

        db.prepare(updateDonorSql).run(...updateParams);
      } else {
        // Create donor_profiles entry if missing
        db.prepare(`
          INSERT INTO donor_profiles (
            user_id, blood_group, city, pincode,
            is_available_for_emergency, consent_emergency_alerts,
            last_donation_date, total_donations_count,
            profile_photo_path, profile_photo_mime, profile_photo_size_bytes,
            profile_photo_updated_at, selfie_consent_given, selfie_consent_at,
            is_photo_public
          ) VALUES (?, ?, ?, ?, 1, 1, NULL, 0, ?, ?, ?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, 0)
        `).run(
          req.user.id,
          finalBloodGroup,
          finalCity,
          finalPincode,
          newPhotoFilename,
          newPhotoMime,
          newPhotoSize
        );
      }

      db.exec('COMMIT;');
      txActive = false;

      // 6. Security Audit & User Activity Logging
      logSecurityAudit({
        actorType: 'USER',
        actorId: req.user.id,
        action: 'USER_PROFILE_UPDATED',
        details: {
          fullNameChanged: finalFullName !== currentUser.full_name,
          bloodGroupChanged: finalBloodGroup !== currentUser.blood_group,
          cityChanged: finalCity !== currentUser.city,
          dobChanged: finalDob !== currentUser.date_of_birth,
          genderChanged: finalGender !== currentUser.gender,
          photoUploaded: Boolean(newPhotoFilename)
        },
        ipAddress: clientIp
      });

      logUserActivity({
        userId: req.user.id,
        eventType: 'PROFILE_UPDATED',
        description: 'Profile details updated successfully.',
        ipAddress: clientIp,
        userAgent
      });

      // 7. Fetch updated user & donor profile payload
      const updatedUserRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
      const effectiveAge = resolveEffectiveAge(updatedUserRow.age, updatedUserRow.date_of_birth);
      const donorPayload = buildDonorProfilePayload(db, req.user.id);
      const requiresProfileCompletion = Boolean(!updatedUserRow.date_of_birth || !updatedUserRow.gender);

      return res.json({
        success: true,
        message: 'Profile updated successfully.',
        user: {
          id: updatedUserRow.id,
          fullName: updatedUserRow.full_name,
          mobileNumber: updatedUserRow.mobile_number,
          email: updatedUserRow.email,
          bloodGroup: updatedUserRow.blood_group,
          city: updatedUserRow.city,
          pincode: finalPincode,
          age: effectiveAge,
          dateOfBirth: updatedUserRow.date_of_birth || null,
          gender: updatedUserRow.gender || null,
          requiresProfileCompletion
        },
        requiresProfileCompletion,
        donorProfile: donorPayload.donor
      });
    } catch (err) {
      if (txActive) {
        try { db.exec('ROLLBACK;'); } catch {}
      }
      console.error('[PROFILE UPDATE ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to update profile. Please try again.'
      });
    }
  });

  app.get('/api/user/consent', authenticateUser, (req, res) => {
    const db = getDatabase();
    const consent = db.prepare(`
      SELECT id, user_id, terms_accepted, terms_version, terms_accepted_at,
             privacy_accepted, privacy_version, privacy_accepted_at, created_at
      FROM user_consents 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(req.user.id);

    res.json({
      success: true,
      consent: consent || null
    });
  });

  app.post('/api/user/logout', authenticateUser, (req, res) => {
    const db = getDatabase();
    db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(req.session.id);

    logUserActivity({
      userId: req.user.id,
      eventType: 'USER_LOGOUT',
      description: 'User initiated session logout.',
      ipAddress: req.ip || '127.0.0.1'
    });

    res.setHeader('Set-Cookie', [
      'red_mission_user_session=; Path=/; HttpOnly; Max-Age=0'
    ]);

    res.json({
      success: true,
      message: 'Successfully logged out.'
    });
  });

  // ==========================================
  // 4. FORGOT PASSWORD (EMAIL LINK OR MOBILE OTP)
  // ==========================================

  app.post('/api/user/forgot-password/request', async (req, res) => {
    const { identifier, channel } = req.body; // channel: 'EMAIL' or 'MOBILE'
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Please enter your registered email or mobile number.' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanMobile = identifier.replace(/\s+/g, '');

    const db = getDatabase();
    const user = db.prepare(`
      SELECT * FROM users WHERE email = ? OR mobile_number = ?
    `).get(cleanIdentifier, cleanMobile);

    // Security practice: Never reveal if an account exists or not
    const standardSuccessMsg = 'If a matching active account was found, recovery instructions have been dispatched.';

    if (!user) {
      return res.json({ success: true, message: standardSuccessMsg });
    }

    const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    if (channel === 'MOBILE') {
      const isCustomOrDemo = config.SMS_PROVIDER === 'DEMO' || Boolean(config.FAST2SMS_CUSTOM_OTP);
      const rawOtp = isCustomOrDemo ? generateOtp() : null;
      const { hash, salt } = rawOtp ? hashOtp(rawOtp) : { hash: 'FAST2SMS_MANAGED', salt: 'FAST2SMS_MANAGED' };

      const smsRes = await sendSms({
        mobileNumber: user.mobile_number,
        message: rawOtp ? `Your RED MISSION password recovery code is: ${rawOtp}. Valid for ${config.OTP_EXPIRY_MINUTES} minutes.` : 'Your RED MISSION password recovery code has been dispatched.',
        otp: rawOtp
      });

      if (!smsRes.success) {
        return res.status(400).json({
          success: false,
          error: smsRes.error || 'Failed to dispatch password recovery SMS. Please try again.'
        });
      }

      db.prepare(`
        INSERT INTO otp_records (id, identifier, type, otp_hash, otp_salt, plain_demo_otp, expires_at, ip_address)
        VALUES (?, ?, 'USER_PASSWORD_RESET', ?, ?, ?, ?, ?)
      `).run(`otp_${crypto.randomUUID()}`, user.mobile_number, hash, salt, (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? rawOtp : null, expiresAt, clientIp);

      return res.json({
        success: true,
        message: standardSuccessMsg,
        channel: 'MOBILE',
        demoOtp: (config.SMS_PROVIDER === 'DEMO' && !config.IS_PROD) ? smsRes.demoOtp : null
      });
    } else {
      // Email link recovery
      const resetToken = generateSecureToken(32);
      const tokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(resetToken).digest('hex');

      db.prepare(`
        INSERT INTO password_reset_tokens (id, account_id, account_type, token_hash, identifier, delivery_channel, expires_at)
        VALUES (?, ?, 'USER', ?, ?, 'EMAIL_LINK', ?)
      `).run(`prt_${crypto.randomUUID()}`, user.id, tokenHash, user.email, expiresAt);

      const resetLink = `https://redmission.org/reset-password?token=${resetToken}`;
      const emailRes = await sendEmail({
        to: user.email,
        subject: 'RED MISSION — Password Recovery Link',
        text: `Hello ${user.full_name},\n\nPlease use the following link to reset your RED MISSION password:\n${resetLink}\n\nThis single-use link expires in ${config.OTP_EXPIRY_MINUTES} minutes.`,
        link: resetLink
      });

      return res.json({
        success: true,
        message: standardSuccessMsg,
        channel: 'EMAIL',
        demoLink: emailRes.demoLink
      });
    }
  });

  app.post('/api/user/forgot-password/reset', async (req, res) => {
    const { identifier, resetToken, otp, newPassword, confirmPassword } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    const db = getDatabase();
    let verifiedUser = null;

    if (resetToken) {
      const tokenHash = crypto.createHmac('sha256', config.SESSION_SECRET).update(resetToken).digest('hex');
      const resetRecord = db.prepare(`
        SELECT * FROM password_reset_tokens 
        WHERE token_hash = ? AND is_used = 0 AND account_type = 'USER'
      `).get(tokenHash);

      if (!resetRecord || new Date() > new Date(resetRecord.expires_at)) {
        return res.status(400).json({ success: false, error: 'Password reset link is invalid or has expired.' });
      }

      verifiedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(resetRecord.account_id);
      db.prepare('UPDATE password_reset_tokens SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(resetRecord.id);
    } else if (otp && identifier) {
      const cleanMobile = identifier.replace(/\s+/g, '');
      const otpRecord = db.prepare(`
        SELECT * FROM otp_records 
        WHERE identifier = ? AND type = 'USER_PASSWORD_RESET' AND is_used = 0
        ORDER BY created_at DESC LIMIT 1
      `).get(cleanMobile);

      if (!otpRecord || new Date() > new Date(otpRecord.expires_at)) {
        return res.status(400).json({ success: false, error: 'Password recovery OTP is invalid or has expired.' });
      }

      const verifyRes = await verifyMobileOtp({
        mobileNumber: cleanMobile,
        otp,
        salt: otpRecord.otp_salt,
        hash: otpRecord.otp_hash
      });

      if (!verifyRes.success) {
        return res.status(400).json({ success: false, error: verifyRes.error || 'Incorrect verification code.' });
      }

      verifiedUser = db.prepare('SELECT * FROM users WHERE mobile_number = ?').get(cleanMobile);
      db.prepare('UPDATE otp_records SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(otpRecord.id);
    } else {
      return res.status(400).json({ success: false, error: 'Please provide either a recovery token or mobile OTP.' });
    }

    if (!verifiedUser) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    // Hash and update new password
    const { hash, salt } = hashPassword(newPassword);
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_salt = ?, failed_login_attempts = 0, lockout_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hash, salt, verifiedUser.id);

    // Invalidate all existing user sessions for security!
    db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?').run(verifiedUser.id);

    logUserActivity({
      userId: verifiedUser.id,
      eventType: 'PASSWORD_RESET_SUCCESS',
      description: 'Password was successfully reset. All previous sessions invalidated.',
      ipAddress: clientIp
    });

    logSecurityAudit({
      actorType: 'USER',
      actorId: verifiedUser.id,
      action: 'USER_PASSWORD_RESET_COMPLETED',
      ipAddress: clientIp
    });

    res.json({
      success: true,
      message: 'Password successfully updated! Please log in with your new password.'
    });
  });

  // ==========================================
  // 5. USER SECURITY ACTIVITY & SESSION CONTROLS
  // ==========================================

  app.get('/api/user/security/activity', authenticateUser, (req, res) => {
    const db = getDatabase();

    const activities = db.prepare(`
      SELECT event_type, description, ip_address, user_agent, location, created_at 
      FROM user_security_activities 
      WHERE user_id = ? 
      ORDER BY created_at DESC LIMIT 25
    `).all(req.user.id);

    const activeSessions = db.prepare(`
      SELECT id, ip_address, user_agent, device_info, last_activity_at, created_at,
             (id = ?) as is_current_session
      FROM user_sessions 
      WHERE user_id = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_activity_at DESC
    `).all(req.session.id, req.user.id);

    res.json({
      success: true,
      activities,
      activeSessions
    });
  });

  // Logout all other sessions remotely
  app.post('/api/user/security/logout-all', authenticateUser, (req, res) => {
    const db = getDatabase();
    db.prepare(`
      UPDATE user_sessions 
      SET is_revoked = 1 
      WHERE user_id = ? AND id != ?
    `).run(req.user.id, req.session.id);

    logUserActivity({
      userId: req.user.id,
      eventType: 'REMOTE_LOGOUT_ALL',
      description: 'User remotely terminated all other active browser sessions.',
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({
      success: true,
      message: 'All other active sessions have been securely terminated.'
    });
  });

  // ==========================================
  // 6. PERMANENT ACCOUNT DELETION & DATA PRIVACY
  // ==========================================

  app.post('/api/user/delete-account', authenticateUser, async (req, res) => {
    const { password, reason } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password verification is strictly required to permanently delete your account.'
      });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Account deletion aborted.'
      });
    }

    const anonymizedDonorRef = `ANON_DONOR_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // Check if donor has a photo file on disk to delete
    let photoToDelete = null;
    try {
      const donorProfile = db.prepare('SELECT profile_photo_path FROM donor_profiles WHERE user_id = ?').get(user.id);
      if (donorProfile && donorProfile.profile_photo_path) {
        photoToDelete = path.join(config.SELFIE_STORAGE_DIR, path.basename(donorProfile.profile_photo_path));
      }
    } catch (e) {
      // Table or column may not exist
    }

    try {
      db.exec('BEGIN TRANSACTION;');

      // 1. Record Account Deletion audit
      db.prepare(`
        INSERT INTO account_deletion_records (id, user_id, reason, deletion_method, retained_anonymized_id)
        VALUES (?, ?, ?, 'SELF_REQUEST', ?)
      `).run(`del_${crypto.randomUUID()}`, user.id, reason || 'User requested permanent account closure', anonymizedDonorRef);

      // 2. Retain historical blood bank statistics in completely anonymized form (no PII retained)
      db.prepare(`
        INSERT INTO anonymized_donation_records (id, anonymized_donor_ref, blood_group, city, donation_date, units_donated)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
      `).run(`anon_${crypto.randomUUID()}`, anonymizedDonorRef, user.blood_group, user.city);

      // 3. Immediately revoke all sessions
      db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?').run(user.id);

      // 4. Delete personal account information from users table (cascading verifications/sessions)
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

      db.exec('COMMIT;');

      // Clean up physical photo file after transaction commits
      if (photoToDelete) {
        try {
          if (fs.existsSync(photoToDelete)) fs.unlinkSync(photoToDelete);
        } catch (e) {
          console.warn('[CLEANUP WARNING] Failed to unlink selfie on account deletion:', photoToDelete);
        }
      }

      logSecurityAudit({
        actorType: 'USER',
        actorId: anonymizedDonorRef,
        action: 'USER_ACCOUNT_PERMANENTLY_DELETED',
        details: { anonymizedRef: anonymizedDonorRef },
        ipAddress: clientIp
      });

      // Clear session cookie
      res.setHeader('Set-Cookie', ['red_mission_user_session=; Path=/; HttpOnly; Max-Age=0']);

      res.json({
        success: true,
        message: 'Your RED MISSION account and personal data have been permanently deleted in accordance with data privacy regulations.'
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error('[ACCOUNT DELETION ERROR]', err);
      return res.status(500).json({ success: false, error: 'Failed to process account deletion.' });
    }
  });

}

function extractDeviceSummary(userAgent = '') {
  if (userAgent.includes('iPhone')) return 'iPhone (iOS)';
  if (userAgent.includes('Android')) return 'Android Mobile';
  if (userAgent.includes('Windows')) return 'Windows Desktop';
  if (userAgent.includes('Macintosh')) return 'Mac OS';
  if (userAgent.includes('Linux')) return 'Linux Desktop';
  return 'Web Browser';
}
