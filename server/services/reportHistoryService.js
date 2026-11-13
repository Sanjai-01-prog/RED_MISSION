/**
 * RED MISSION — Report History & Storage Service
 * Phase 6, Feature 1: Official Monthly Activity Report Storage
 * 
 * Strict Zero-Dependency Native Node.js Implementation.
 * Manages persistent report history, PDF/Excel file saving, and strict
 * anti-traversal file retrieval.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_REPORTS_DIR = config.REPORTS_STORAGE_DIR || path.resolve(PROJECT_ROOT, 'server/storage/reports');

function resolveStoragePaths(storageDir) {
  const reportsDir = storageDir ? path.resolve(storageDir) : DEFAULT_REPORTS_DIR;
  const historyFile = path.join(reportsDir, 'report_history.json');
  return { reportsDir, historyFile };
}

export function normalizeMaskSensitive(maskSensitive) {
  return !(maskSensitive === false || maskSensitive === 'false');
}

export function isExplicitlyMaskedRecord(record) {
  return Boolean(record && record.maskSensitive === true && record.privacyMode === 'MASKED');
}

export function isExplicitlyUnmaskedRecord(record) {
  return Boolean(record && record.maskSensitive === false && record.privacyMode === 'UNMASKED');
}

export function isRecordCompatibleWithPrivacyMode(record, maskSensitive = true) {
  if (!record) return false;
  const isMasked = normalizeMaskSensitive(maskSensitive);
  return isMasked ? isExplicitlyMaskedRecord(record) : isExplicitlyUnmaskedRecord(record);
}

// Ensure default reports storage directory exists
if (!fs.existsSync(DEFAULT_REPORTS_DIR)) {
  fs.mkdirSync(DEFAULT_REPORTS_DIR, { recursive: true });
}

/**
 * Load report history from persistent storage
 */
export function getReportHistory(options = {}) {
  const { historyFile } = resolveStoragePaths(options.storageDir);
  try {
    if (!fs.existsSync(historyFile)) {
      return [];
    }
    const data = fs.readFileSync(historyFile, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[REPORT HISTORY LOAD ERROR]', err.message);
    return [];
  }
}

/**
 * Save report history safely to disk
 */
function saveReportHistory(history, options = {}) {
  const { reportsDir, historyFile } = resolveStoragePaths(options.storageDir);
  try {
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.error('[REPORT HISTORY SAVE ERROR]', err.message);
  }
}

/**
 * Save newly generated report artifacts (PDF, Excel) and record in history.
 * Separates cache identity and artifact filenames by privacy mode (MASKED vs UNMASKED)
 * and stores deterministic dataFingerprint to detect stale caches.
 * 
 * @param {Object} reportData - Structured report output from reportDataService
 * @param {Buffer} pdfBuffer - Generated binary PDF
 * @param {Buffer} excelBuffer - Generated binary XLSX
 * @param {Object} [options] - Optional { storageDir }
 * @returns {Object} Stored report metadata record
 */
export function recordGeneratedReport(reportData, pdfBuffer, excelBuffer, options = {}) {
  const { reportsDir } = resolveStoragePaths(options.storageDir);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const { period, summary, preparedBy, reportRef } = reportData;
  const monthPad = String(period.month).padStart(2, '0');
  const isMasked = normalizeMaskSensitive(reportData.maskSensitive);
  const privacyMode = isMasked ? 'MASKED' : 'UNMASKED';
  const privacySuffix = isMasked ? 'masked' : 'unmasked';

  const pdfFileName = `RED_MISSION_Monthly_Report_${period.year}_${monthPad}_${privacySuffix}.pdf`;
  const excelFileName = `RED_MISSION_Monthly_Report_${period.year}_${monthPad}_${privacySuffix}.xlsx`;

  const pdfPath = path.join(reportsDir, pdfFileName);
  const excelPath = path.join(reportsDir, excelFileName);

  // Write files safely
  if (pdfBuffer) {
    fs.writeFileSync(pdfPath, pdfBuffer);
  }
  if (excelBuffer) {
    fs.writeFileSync(excelPath, excelBuffer);
  }

  const record = {
    id: reportRef,
    month: period.month,
    year: period.year,
    monthName: period.monthName,
    periodLabel: period.label,
    maskSensitive: isMasked,
    privacyMode,
    dataFingerprint: reportData.dataFingerprint || null,
    totalDonations: summary.totalDonations,
    totalUnits: summary.totalUnits,
    uniqueDonorsCount: summary.uniqueDonorsCount,
    uniqueHospitalsCount: summary.uniqueHospitalsCount,
    pdfFileName,
    excelFileName,
    pdfSize: pdfBuffer ? pdfBuffer.length : 0,
    excelSize: excelBuffer ? excelBuffer.length : 0,
    generatedAt: reportData.generatedAt,
    generatedByAdminId: preparedBy.adminId,
    generatedByAdminName: preparedBy.adminName,
    generatedByAdminRole: preparedBy.adminRole
  };

  const history = getReportHistory(options);
  // Replace only prior entry for the exact same (month, year, privacyMode) bucket
  const updatedHistory = history.filter(h => {
    if (h.month !== period.month || h.year !== period.year) return true;
    return isMasked ? !isExplicitlyMaskedRecord(h) : !isExplicitlyUnmaskedRecord(h);
  });
  updatedHistory.unshift(record); // Prepend latest at top
  saveReportHistory(updatedHistory, options);

  return record;
}

/**
 * Find a generated report by month, year, and strict privacy mode.
 * Fail-closed: masked lookups never return unmasked or unknown-provenance records.
 */
export function getReportByPeriod(month, year, options = {}) {
  const parsedMonth = parseInt(month, 10);
  const parsedYear = parseInt(year, 10);
  const isMasked = normalizeMaskSensitive(options.maskSensitive);
  const history = getReportHistory(options);
  return history.find(h => {
    if (h.month !== parsedMonth || h.year !== parsedYear) return false;
    return isMasked ? isExplicitlyMaskedRecord(h) : isExplicitlyUnmaskedRecord(h);
  }) || null;
}

/**
 * Find a generated report by its unique reference ID
 */
export function getReportById(reportId, options = {}) {
  if (!reportId) return null;
  const history = getReportHistory(options);
  return history.find(h => h.id === reportId) || null;
}

/**
 * Verify whether a cached report record matches the required privacy mode,
 * has the exact same underlying dataset fingerprint, and still exists on disk.
 */
export function isCachedReportFresh(record, currentReportData, options = {}) {
  if (!record || !currentReportData) return false;
  if (!isRecordCompatibleWithPrivacyMode(record, currentReportData.maskSensitive)) {
    return false;
  }
  if (!record.dataFingerprint || !currentReportData.dataFingerprint) {
    return false;
  }
  if (record.dataFingerprint !== currentReportData.dataFingerprint) {
    return false;
  }

  try {
    if (options.type === 'pdf') {
      getReportFilePath(record.pdfFileName, options);
    } else if (options.type === 'excel') {
      getReportFilePath(record.excelFileName, options);
    } else {
      getReportFilePath(record.pdfFileName, options);
      getReportFilePath(record.excelFileName, options);
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Safely resolve and validate report file path with strict path-traversal protection
 * 
 * @param {string} fileName - Base filename
 * @param {Object} [options] - Optional { storageDir }
 * @returns {string} Absolute verified filesystem path
 */
export function getReportFilePath(fileName, options = {}) {
  const { reportsDir } = resolveStoragePaths(options.storageDir);

  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Filename must be a non-empty string.');
  }

  // Defend against path traversal: must be exact safe basename
  const safeName = path.basename(fileName);
  if (safeName !== fileName || safeName === '.' || safeName === '..') {
    throw new Error(`Security Violation: Illegal path traversal sequence in filename '${fileName}'.`);
  }

  const resolved = path.resolve(reportsDir, safeName);
  const expectedPrefix = reportsDir.endsWith(path.sep) ? reportsDir : reportsDir + path.sep;
  if (!resolved.startsWith(expectedPrefix)) {
    throw new Error(`Security Violation: Path '${resolved}' attempts to escape reports directory.`);
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Report file not found: '${fileName}'.`);
  }

  return resolved;
}
