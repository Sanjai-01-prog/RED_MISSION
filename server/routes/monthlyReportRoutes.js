/**
 * RED MISSION — Monthly Donation Reports API Routes
 * Phase 6, Feature 1: Official Rotaract Activity Report Generator & Downloader
 * 
 * Strict Zero-Dependency Native Node.js Implementation.
 * Role-Based Access Control: ADMIN and SUPER_ADMIN only.
 */

import fs from 'node:fs';
import { getDatabase as defaultGetDatabase } from '../database/connection.js';
import { authenticateAdmin as defaultAuthenticateAdmin } from '../middleware/authMiddleware.js';
import { getMonthlyDonationReportData } from '../services/reportDataService.js';
import { generateMonthlyDonationReportPdf } from '../services/pdfReportGenerator.js';
import { generateMonthlyDonationReportExcel } from '../services/excelReportGenerator.js';
import { 
  recordGeneratedReport, 
  getReportHistory, 
  getReportByPeriod, 
  getReportById, 
  getReportFilePath,
  normalizeMaskSensitive,
  isRecordCompatibleWithPrivacyMode,
  isCachedReportFresh
} from '../services/reportHistoryService.js';
import { logSecurityAudit as defaultLogSecurityAudit } from '../utils/auditLogger.js';

/**
 * Middleware: Verify that admin has ADMIN or SUPER_ADMIN role.
 * Explicitly denies MODERATOR accounts from generating, viewing, or downloading monthly reports.
 */
export function requireReportAdminRole(req, res, next) {
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
      code: 'FORBIDDEN_REPORT_ACCESS',
      error: 'Access Denied: Only administrators and super administrators are authorized to generate and export monthly donation activity reports.'
    });
  }

  next();
}

function validateMonthYear(month, year) {
  const parsedMonth = parseInt(month, 10);
  const parsedYear = parseInt(year, 10);

  if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return {
      valid: false,
      code: 'INVALID_MONTH',
      error: 'Month must be an integer between 1 and 12.'
    };
  }

  if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
    return {
      valid: false,
      code: 'INVALID_YEAR',
      error: 'Year must be a 4-digit integer between 2000 and 2100.'
    };
  }

  return { valid: true, parsedMonth, parsedYear };
}

/**
 * Unified secure artifact download handler for PDF and Excel exports.
 * Enforces:
 * - Strict privacy-mode isolation (masked request can NEVER retrieve an unmasked artifact).
 * - Live dataset fingerprint verification so newly approved donations never use stale caches.
 */
function handleArtifactDownload(req, res, format, deps) {
  const { getDb, logAudit, historyOpts } = deps;
  const isPdf = format === 'pdf';

  try {
    const db = getDb();
    const { month, year, reportId, maskSensitive } = req.query || {};
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const requestedMask = normalizeMaskSensitive(maskSensitive);

    let targetRecord = null;
    if (reportId) {
      targetRecord = getReportById(reportId, historyOpts);
      if (!targetRecord) {
        return res.status(404).json({
          success: false,
          code: 'REPORT_NOT_FOUND',
          error: `Report ledger record '${reportId}' was not found.`
        });
      }

      if (!isRecordCompatibleWithPrivacyMode(targetRecord, requestedMask)) {
        return res.status(403).json({
          success: false,
          code: 'PRIVACY_MODE_MISMATCH',
          error: requestedMask
            ? 'Access Denied: A masked download request cannot retrieve an unmasked or legacy report artifact.'
            : 'Privacy Mode Mismatch: Requested report record does not match the requested privacy mode.'
        });
      }
    }

    const periodCheck = validateMonthYear(month ?? targetRecord?.month, year ?? targetRecord?.year);
    if (!periodCheck.valid) {
      return res.status(400).json({
        success: false,
        code: periodCheck.code,
        error: 'Valid month and year or existing reportId required.'
      });
    }

    const { parsedMonth, parsedYear } = periodCheck;

    if (!targetRecord) {
      targetRecord = getReportByPeriod(parsedMonth, parsedYear, {
        ...historyOpts,
        maskSensitive: requestedMask
      });
    }

    // Compute live verified report data & dataset fingerprint
    const reportData = getMonthlyDonationReportData(db, {
      month: parsedMonth,
      year: parsedYear,
      maskSensitive: requestedMask,
      admin: req.admin
    });

    const privacySuffix = requestedMask ? 'masked' : 'unmasked';
    const fallbackName = `RED_MISSION_Monthly_Report_${parsedYear}_${String(parsedMonth).padStart(2, '0')}_${privacySuffix}.${isPdf ? 'pdf' : 'xlsx'}`;
    let fileBuffer = null;
    let downloadFileName = fallbackName;
    let cacheStatus = 'GENERATED_ON_THE_FLY';

    if (targetRecord && isCachedReportFresh(targetRecord, reportData, { ...historyOpts, type: format })) {
      const targetName = isPdf ? targetRecord.pdfFileName : targetRecord.excelFileName;
      const filePath = getReportFilePath(targetName, historyOpts);
      fileBuffer = fs.readFileSync(filePath);
      downloadFileName = targetName;
      cacheStatus = 'HIT';
    } else if (targetRecord) {
      // Cached artifact was stale (underlying donations changed) or missing on disk: regenerate both to stay synchronized
      const freshPdf = generateMonthlyDonationReportPdf(reportData);
      const freshExcel = generateMonthlyDonationReportExcel(reportData);
      const refreshedRecord = recordGeneratedReport(reportData, freshPdf, freshExcel, historyOpts);
      fileBuffer = isPdf ? freshPdf : freshExcel;
      downloadFileName = isPdf ? refreshedRecord.pdfFileName : refreshedRecord.excelFileName;
      cacheStatus = 'REGENERATED_STALE';
    } else {
      fileBuffer = isPdf
        ? generateMonthlyDonationReportPdf(reportData)
        : generateMonthlyDonationReportExcel(reportData);
      cacheStatus = 'GENERATED_ON_THE_FLY';
    }

    logAudit({
      actorType: 'ADMIN',
      actorId: req.admin.id,
      action: isPdf ? 'MONTHLY_REPORT_PDF_DOWNLOADED' : 'MONTHLY_REPORT_EXCEL_DOWNLOADED',
      details: `Downloaded ${isPdf ? 'PDF' : 'Excel'} report (${reportData.privacyMode}, ${cacheStatus}): ${downloadFileName}`,
      ipAddress: clientIp
    });

    res.setHeader(
      'Content-Type',
      isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Report-Privacy-Mode', reportData.privacyMode);
    res.setHeader('X-Report-Cache-Status', cacheStatus);
    return res.end(fileBuffer);
  } catch (err) {
    console.error(`[MONTHLY REPORT ${isPdf ? 'PDF' : 'EXCEL'} DOWNLOAD ERROR]`, err);
    return res.status(500).json({
      success: false,
      error: `Failed to download ${isPdf ? 'PDF' : 'Excel'} report: ${err.message}`
    });
  }
}

export function setupMonthlyReportRoutes(app, deps = {}) {
  const getDb = deps.getDatabase || defaultGetDatabase;
  const authAdmin = deps.authenticateAdmin || defaultAuthenticateAdmin;
  const logAudit = deps.logSecurityAudit || defaultLogSecurityAudit;
  const historyOpts = deps.storageDir ? { storageDir: deps.storageDir } : {};
  const sharedDeps = { getDb, logAudit, historyOpts };

  // ==========================================
  // 1. GET REPORT PREVIEW / DATA
  // ==========================================
  app.get('/api/admin/reports/monthly', authAdmin, requireReportAdminRole, (req, res) => {
    try {
      const db = getDb();
      const { month, year, maskSensitive = 'true' } = req.query || {};

      const periodCheck = validateMonthYear(month, year);
      if (!periodCheck.valid) {
        return res.status(400).json({
          success: false,
          code: periodCheck.code,
          error: periodCheck.error
        });
      }

      const { parsedMonth, parsedYear } = periodCheck;
      const mask = normalizeMaskSensitive(maskSensitive);

      const reportData = getMonthlyDonationReportData(db, {
        month: parsedMonth,
        year: parsedYear,
        maskSensitive: mask,
        admin: req.admin
      });

      const existingRecord = getReportByPeriod(parsedMonth, parsedYear, {
        ...historyOpts,
        maskSensitive: mask
      });
      const isStale = Boolean(
        existingRecord &&
        (!existingRecord.dataFingerprint || existingRecord.dataFingerprint !== reportData.dataFingerprint)
      );

      return res.status(200).json({
        success: true,
        report: {
          ...reportData,
          isPreviouslyGenerated: Boolean(existingRecord),
          isStale,
          existingRecord: existingRecord || null
        }
      });
    } catch (err) {
      console.error('[MONTHLY REPORT PREVIEW ERROR]', err);
      return res.status(500).json({
        success: false,
        error: `Failed to retrieve monthly report data: ${err.message}`
      });
    }
  });

  // ==========================================
  // 2. GENERATE & SAVE OFFICIAL REPORT
  // ==========================================
  app.post('/api/admin/reports/monthly/generate', authAdmin, requireReportAdminRole, (req, res) => {
    try {
      const db = getDb();
      const { month, year, maskSensitive = true } = req.body || {};
      const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';

      const periodCheck = validateMonthYear(month, year);
      if (!periodCheck.valid) {
        return res.status(400).json({
          success: false,
          code: periodCheck.code,
          error: periodCheck.error
        });
      }

      const { parsedMonth, parsedYear } = periodCheck;
      const mask = normalizeMaskSensitive(maskSensitive);

      // 1. Fetch verified report data
      const reportData = getMonthlyDonationReportData(db, {
        month: parsedMonth,
        year: parsedYear,
        maskSensitive: mask,
        admin: req.admin
      });

      // 2. Generate PDF and Excel buffers
      const pdfBuffer = generateMonthlyDonationReportPdf(reportData);
      const excelBuffer = generateMonthlyDonationReportExcel(reportData);

      // 3. Persist generated files under isolated privacy bucket and update report history
      const record = recordGeneratedReport(reportData, pdfBuffer, excelBuffer, historyOpts);

      // 4. Log audit event
      logAudit({
        actorType: 'ADMIN',
        actorId: req.admin.id,
        action: 'MONTHLY_REPORT_GENERATED',
        details: `Generated official monthly donation report for ${reportData.period.label} (${reportData.privacyMode}, ID: ${record.id}, Total Donations: ${record.totalDonations}, Units: ${record.totalUnits})`,
        ipAddress: clientIp
      });

      return res.status(200).json({
        success: true,
        message: `Official report for ${reportData.period.label} (${reportData.privacyMode}) generated and certified successfully.`,
        record,
        summary: reportData.summary,
        period: reportData.period
      });
    } catch (err) {
      console.error('[MONTHLY REPORT GENERATION ERROR]', err);
      return res.status(500).json({
        success: false,
        error: `Failed to generate monthly report: ${err.message}`
      });
    }
  });

  // ==========================================
  // 3. DOWNLOAD OFFICIAL PDF
  // ==========================================
  app.get('/api/admin/reports/monthly/pdf', authAdmin, requireReportAdminRole, (req, res) => {
    return handleArtifactDownload(req, res, 'pdf', sharedDeps);
  });

  // ==========================================
  // 4. DOWNLOAD OFFICIAL EXCEL WORKBOOK
  // ==========================================
  app.get('/api/admin/reports/monthly/excel', authAdmin, requireReportAdminRole, (req, res) => {
    return handleArtifactDownload(req, res, 'excel', sharedDeps);
  });

  // ==========================================
  // 5. GET REPORT GENERATION HISTORY
  // ==========================================
  app.get('/api/admin/reports/history', authAdmin, requireReportAdminRole, (req, res) => {
    try {
      const history = getReportHistory(historyOpts);
      return res.status(200).json({
        success: true,
        count: history.length,
        reports: history
      });
    } catch (err) {
      console.error('[REPORT HISTORY ERROR]', err);
      return res.status(500).json({
        success: false,
        error: `Failed to retrieve report history: ${err.message}`
      });
    }
  });
}
