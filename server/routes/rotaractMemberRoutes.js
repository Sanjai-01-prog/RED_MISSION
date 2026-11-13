/**
 * RED MISSION — Rotaract College Members Directory API Routes
 * Phase 6, Feature 4: Public Directory & Authorized Admin Management
 *
 * Security Model:
 * - Public endpoints expose ONLY authorized (`isPublic === true`) public fields (`id`, `fullName`, `designation`, `photoUrl`, `displayOrder`)
 *   and stream ONLY photos belonging to `isPublic === true` records with `X-Content-Type-Options: nosniff`.
 * - Admin CRUD and reorder endpoints enforce `authenticateAdmin` + `ADMIN`/`SUPER_ADMIN` role authorization
 *   (explicitly blocking unauthenticated users, regular users, and MODERATOR accounts with 401/403).
 */

import fs from 'node:fs';
import { getDatabase as defaultGetDatabase } from '../database/connection.js';
import { authenticateAdmin as defaultAuthenticateAdmin } from '../middleware/authMiddleware.js';
import { logSecurityAudit as defaultLogSecurityAudit } from '../utils/auditLogger.js';
import {
  listPublicMembers,
  listAllMembersAdmin,
  getPublicMemberPhoto,
  getAdminMemberPhoto,
  createMember,
  updateMember,
  reorderMembers,
  deleteMember
} from '../services/rotaractMemberService.js';

export function requireRotaractAdminRole(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      code: 'ADMIN_AUTH_REQUIRED',
      error: 'Administrator authentication required.'
    });
  }

  const role = req.admin.role_id || req.admin.roleId;
  if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_ROTARACT_MANAGEMENT',
      error: 'Access Denied: Only Administrators and Super Administrators are authorized to manage Rotaract directory records.'
    });
  }

  next();
}

function streamPhotoFile(res, photoMeta, cacheHeader) {
  const fileBuffer = fs.readFileSync(photoMeta.fullPath);
  res.writeHead(200, {
    'Content-Type': photoMeta.mime,
    'Content-Length': fileBuffer.length,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': cacheHeader
  });
  return res.end(fileBuffer);
}

function extractUploadedPhoto(req) {
  const uploadedFile = req.files?.photo || req.files?.photoPayload || req.files?.file || req.files?.image;
  if (uploadedFile && Buffer.isBuffer(uploadedFile.buffer)) {
    return uploadedFile.buffer;
  }
  const { photoPayload, photo, image } = req.body || {};
  return photoPayload || photo || image || null;
}

export function setupRotaractMemberRoutes(app, deps = {}) {
  const getDb = deps.getDatabase || defaultGetDatabase;
  const authAdmin = deps.authenticateAdmin || defaultAuthenticateAdmin;
  const logAudit = deps.logSecurityAudit || defaultLogSecurityAudit;
  const storageOpts = deps.storageDir ? { storageDir: deps.storageDir } : {};

  // ==========================================
  // 1. PUBLIC: LIST PUBLISHED ROTARACT MEMBERS
  // ==========================================
  app.get('/api/rotaract/members', (req, res) => {
    try {
      const db = getDb();
      const { search = '', designation = '' } = req.query || {};
      const result = listPublicMembers(
        { search, designation },
        { ...storageOpts, db }
      );

      res.setHeader('Cache-Control', 'no-cache');
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[ROTARACT PUBLIC LIST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve Rotaract members directory.'
      });
    }
  });

  // ==========================================
  // 2. PUBLIC: STREAM PUBLISHED MEMBER PHOTOGRAPH
  // ==========================================
  app.get('/api/rotaract/members/:id/photo', (req, res) => {
    try {
      const db = getDb();
      const photoMeta = getPublicMemberPhoto(req.params.id, { ...storageOpts, db });
      if (!photoMeta) {
        return res.status(404).json({
          success: false,
          code: 'MEMBER_PHOTO_NOT_FOUND',
          error: 'Member photograph not found or not authorized for public display.'
        });
      }

      return streamPhotoFile(res, photoMeta, 'public, max-age=300');
    } catch (err) {
      console.error('[ROTARACT PUBLIC PHOTO ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to stream member photograph.'
      });
    }
  });

  // ==========================================
  // 3. ADMIN: LIST ALL ROTARACT MEMBERS (PUBLISHED + HIDDEN)
  // ==========================================
  app.get('/api/admin/rotaract/members', authAdmin, requireRotaractAdminRole, (req, res) => {
    try {
      const db = getDb();
      const result = listAllMembersAdmin({ ...storageOpts, db });
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error('[ROTARACT ADMIN LIST ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve admin Rotaract directory.'
      });
    }
  });

  // ==========================================
  // 4. ADMIN: PREVIEW ANY MEMBER PHOTOGRAPH (INCLUDING HIDDEN)
  // ==========================================
  app.get('/api/admin/rotaract/members/:id/photo', authAdmin, requireRotaractAdminRole, (req, res) => {
    try {
      const db = getDb();
      const photoMeta = getAdminMemberPhoto(req.params.id, { ...storageOpts, db });
      if (!photoMeta) {
        return res.status(404).json({
          success: false,
          code: 'MEMBER_PHOTO_NOT_FOUND',
          error: 'Member photograph not found.'
        });
      }

      return streamPhotoFile(res, photoMeta, 'private, no-store');
    } catch (err) {
      console.error('[ROTARACT ADMIN PHOTO ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to load member photograph preview.'
      });
    }
  });

  // ==========================================
  // 5. ADMIN: ADD ROTARACT MEMBER
  // ==========================================
  app.post('/api/admin/rotaract/members', authAdmin, requireRotaractAdminRole, (req, res) => {
    try {
      const db = getDb();
      const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
      const { fullName, designation, isPublic } = req.body || {};
      const resolvedPhoto = extractUploadedPhoto(req);

      const result = createMember(
        {
          fullName,
          designation,
          photoPayload: resolvedPhoto,
          isPublic: isPublic !== undefined ? isPublic : true,
          adminId: req.admin.id
        },
        { ...storageOpts, db }
      );

      if (!result.success) {
        return res.status(result.status || 400).json({
          success: false,
          code: result.code,
          error: result.error
        });
      }

      logAudit({
        actorType: 'ADMIN',
        actorId: req.admin.id,
        action: 'ROTARACT_MEMBER_ADDED',
        details: {
          memberId: result.member.id,
          fullName: result.member.fullName,
          designation: result.member.designation,
          isPublic: result.member.isPublic,
          hasPhoto: result.member.hasPhoto
        },
        ipAddress: clientIp
      });

      return res.status(201).json({
        success: true,
        member: result.member,
        message: 'Rotaract directory member added successfully.'
      });
    } catch (err) {
      console.error('[ROTARACT ADD MEMBER ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to create Rotaract directory member.'
      });
    }
  });

  // ==========================================
  // 6. ADMIN: UPDATE MEMBER DETAILS / DESIGNATION / PHOTO / VISIBILITY
  // ==========================================
  app.put('/api/admin/rotaract/members/:id', authAdmin, requireRotaractAdminRole, (req, res) => {
    try {
      const db = getDb();
      const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
      const { fullName, designation, removePhoto, isPublic } = req.body || {};
      const resolvedPhoto = extractUploadedPhoto(req);

      const result = updateMember(
        req.params.id,
        {
          fullName,
          designation,
          photoPayload: resolvedPhoto,
          removePhoto,
          isPublic
        },
        req.admin.id,
        { ...storageOpts, db }
      );

      if (!result.success) {
        return res.status(result.status || 400).json({
          success: false,
          code: result.code,
          error: result.error
        });
      }

      logAudit({
        actorType: 'ADMIN',
        actorId: req.admin.id,
        action: 'ROTARACT_MEMBER_UPDATED',
        details: {
          memberId: result.member.id,
          fullName: result.member.fullName,
          designation: result.member.designation,
          isPublic: result.member.isPublic,
          hasPhoto: result.member.hasPhoto
        },
        ipAddress: clientIp
      });

      return res.json({
        success: true,
        member: result.member,
        message: 'Rotaract directory member updated successfully.'
      });
    } catch (err) {
      console.error('[ROTARACT UPDATE MEMBER ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to update Rotaract directory member.'
      });
    }
  });

  // ==========================================
  // 7. ADMIN: REORDER ROTARACT MEMBERS
  // ==========================================
  app.patch('/api/admin/rotaract/members/reorder', authAdmin, requireRotaractAdminRole, (req, res) => {
    try {
      const db = getDb();
      const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
      const { orderedIds } = req.body || {};

      const result = reorderMembers(orderedIds, req.admin.id, { ...storageOpts, db });
      if (!result.success) {
        return res.status(result.status || 400).json({
          success: false,
          code: result.code,
          error: result.error
        });
      }

      logAudit({
        actorType: 'ADMIN',
        actorId: req.admin.id,
        action: 'ROTARACT_MEMBERS_REORDERED',
        details: { orderedCount: result.members.length },
        ipAddress: clientIp
      });

      return res.json({
        success: true,
        members: result.members,
        message: 'Directory display order updated.'
      });
    } catch (err) {
      console.error('[ROTARACT REORDER ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to reorder Rotaract directory members.'
      });
    }
  });

  // ==========================================
  // 8. ADMIN: REMOVE ROTARACT MEMBER
  // ==========================================
  app.delete('/api/admin/rotaract/members/:id', authAdmin, requireRotaractAdminRole, (req, res) => {
    try {
      const db = getDb();
      const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
      const result = deleteMember(req.params.id, { ...storageOpts, db });

      if (!result.success) {
        return res.status(result.status || 404).json({
          success: false,
          code: result.code,
          error: result.error
        });
      }

      logAudit({
        actorType: 'ADMIN',
        actorId: req.admin.id,
        action: 'ROTARACT_MEMBER_REMOVED',
        details: {
          memberId: result.deletedId,
          fullName: result.deletedName
        },
        ipAddress: clientIp
      });

      return res.json({
        success: true,
        deletedId: result.deletedId,
        message: 'Rotaract directory member removed permanently.'
      });
    } catch (err) {
      console.error('[ROTARACT DELETE MEMBER ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to remove Rotaract directory member.'
      });
    }
  });
}
