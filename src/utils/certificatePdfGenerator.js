import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { certificateApi } from '../services/api';

const A4_LANDSCAPE_WIDTH = 841.89;
const A4_LANDSCAPE_HEIGHT = 595.28;

export function formatCertificateDate(dateStr) {
  if (!dateStr) return 'N/A';
  const normalized = String(dateStr).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T00:00:00Z`)
    : new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? 'UTC' : 'Asia/Kolkata'
  });
}

function toWinAnsiSafeText(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfLiteralString(str) {
  return toWinAnsiSafeText(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function estimateTextWidth(text, fontSize, isBold = false) {
  const safe = toWinAnsiSafeText(text);
  const factor = isBold ? 0.56 : 0.51;
  return safe.length * fontSize * factor;
}

function wrapTextLines(text, maxWidth, fontSize, isBold = false, maxLines = 4) {
  const safe = toWinAnsiSafeText(text);
  if (!safe) return [];

  const words = safe.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize, isBold) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) break;
      }
      if (estimateTextWidth(word, fontSize, isBold) > maxWidth) {
        let slice = '';
        for (const ch of word) {
          if (estimateTextWidth(`${slice}${ch}`, fontSize, isBold) <= maxWidth) {
            slice += ch;
          } else {
            if (slice) {
              lines.push(slice);
              if (lines.length >= maxLines) break;
            }
            slice = ch;
          }
        }
        current = lines.length < maxLines ? slice : '';
      } else {
        current = word;
      }
    }
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function pdfText(x, y, text, { font = 'F1', size = 10, color = '0.09 0.11 0.16', align = 'left' } = {}) {
  const safe = escapePdfLiteralString(text);
  if (!safe) return '';
  const isBold = font === 'F2' || font === 'F4';
  const estWidth = estimateTextWidth(text, size, isBold);
  let drawX = x;
  if (align === 'center') {
    drawX = x - estWidth / 2;
  } else if (align === 'right') {
    drawX = x - estWidth;
  }
  return `BT /${font} ${size.toFixed(2)} Tf ${color} rg 1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm (${safe}) Tj ET`;
}

function pdfRect(x, y, w, h, { fill, stroke, lineWidth = 1 } = {}) {
  const ops = [];
  if (stroke) ops.push(`${lineWidth.toFixed(2)} w ${stroke} RG`);
  if (fill) ops.push(`${fill} rg`);
  const cmd = fill && stroke ? 'B' : fill ? 'f' : 'S';
  ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${cmd}`);
  return ops.join('\n');
}

function pdfLine(x1, y1, x2, y2, color = '0.82 0.70 0.40', lineWidth = 0.8) {
  return `${lineWidth.toFixed(2)} w ${color} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`;
}

function drawRedMissionVectorCrest(cx, cy, radius = 24) {
  const k = 0.5522847498;
  const r = radius;
  const kr = r * k;
  const ops = [];

  // Outer crimson circle badge
  ops.push('0.73 0.08 0.15 rg 0.85 0.68 0.28 RG 1.8 w');
  ops.push([
    `${(cx + r).toFixed(2)} ${cy.toFixed(2)} m`,
    `${(cx + r).toFixed(2)} ${(cy + kr).toFixed(2)} ${(cx + kr).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`,
    `${(cx - kr).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy + kr).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`,
    `${(cx - r).toFixed(2)} ${(cy - kr).toFixed(2)} ${(cx - kr).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`,
    `${(cx + kr).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy - kr).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`,
    'B'
  ].join(' '));

  // Inner white stylized blood droplet silhouette
  const topY = cy + r * 0.56;
  const botY = cy - r * 0.52;
  const midY = cy - r * 0.14;
  const dropW = r * 0.44;
  ops.push('1 1 1 rg');
  ops.push([
    `${cx.toFixed(2)} ${topY.toFixed(2)} m`,
    `${(cx + dropW * 0.55).toFixed(2)} ${(cy + r * 0.14).toFixed(2)} ${(cx + dropW).toFixed(2)} ${midY.toFixed(2)} ${(cx + dropW).toFixed(2)} ${(botY + r * 0.28).toFixed(2)} c`,
    `${(cx + dropW).toFixed(2)} ${(botY + r * 0.03).toFixed(2)} ${(cx + dropW * 0.52).toFixed(2)} ${botY.toFixed(2)} ${cx.toFixed(2)} ${botY.toFixed(2)} c`,
    `${(cx - dropW * 0.52).toFixed(2)} ${botY.toFixed(2)} ${(cx - dropW).toFixed(2)} ${(botY + r * 0.03).toFixed(2)} ${(cx - dropW).toFixed(2)} ${(botY + r * 0.28).toFixed(2)} c`,
    `${(cx - dropW).toFixed(2)} ${midY.toFixed(2)} ${(cx - dropW * 0.55).toFixed(2)} ${(cy + r * 0.14).toFixed(2)} ${cx.toFixed(2)} ${topY.toFixed(2)} c`,
    'f'
  ].join(' '));

  // Small crimson medical cross inside the droplet
  const crossY = botY + r * 0.30;
  const barL = r * 0.26;
  const barT = r * 0.09;
  ops.push('0.73 0.08 0.15 rg');
  ops.push(`${(cx - barL / 2).toFixed(2)} ${(crossY - barT / 2).toFixed(2)} ${barL.toFixed(2)} ${barT.toFixed(2)} re f`);
  ops.push(`${(cx - barT / 2).toFixed(2)} ${(crossY - barL / 2).toFixed(2)} ${barT.toFixed(2)} ${barL.toFixed(2)} re f`);

  return ops.join('\n');
}

function parseSvgPathDataToRects(dString) {
  const rects = [];
  if (!dString) return rects;

  // qrcode.react v4 emits subpaths like M1,1h1v1h-1z or M1 1h1v1H1z
  const tokens = dString.match(/[a-zA-Z]|[-+]?\d*\.?\d+/g) || [];
  let idx = 0;
  let cx = 0;
  let cy = 0;
  let cmd = '';

  const readNum = () => {
    if (idx >= tokens.length) return 0;
    return Number.parseFloat(tokens[idx++]);
  };

  while (idx < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[idx])) {
      cmd = tokens[idx++];
      if (cmd === 'z' || cmd === 'Z') continue;
    }

    if (cmd === 'M' || cmd === 'm') {
      const nx = readNum();
      const ny = readNum();
      if (cmd === 'M') {
        cx = nx;
        cy = ny;
      } else {
        cx += nx;
        cy += ny;
      }

      // Check for immediate module rectangle pattern: M x y h w v h ...
      let width = null;
      let height = null;
      const saveIdx = idx;
      if (idx + 3 < tokens.length && (tokens[idx] === 'h' || tokens[idx] === 'H') && (tokens[idx + 2] === 'v' || tokens[idx + 2] === 'V')) {
        const hCmd = tokens[idx];
        const wVal = Number.parseFloat(tokens[idx + 1]);
        const vCmd = tokens[idx + 2];
        const hVal = Number.parseFloat(tokens[idx + 3]);
        width = hCmd === 'h' ? wVal : wVal - cx;
        height = vCmd === 'v' ? hVal : hVal - cy;
        if (width > 0 && height > 0) {
          rects.push({ x: cx, y: cy, w: width, h: height });
          idx += 4;
          // Consume trailing H/h/z of that subpath cleanly
          while (idx < tokens.length && !/^[mM]$/.test(tokens[idx])) {
            if (/^[a-zA-Z]$/.test(tokens[idx])) {
              const sub = tokens[idx++];
              if (sub === 'z' || sub === 'Z') break;
              if (idx < tokens.length && !/^[a-zA-Z]$/.test(tokens[idx])) idx++;
            } else {
              idx++;
            }
          }
          continue;
        }
      }
      idx = saveIdx;
      cmd = cmd === 'M' ? 'L' : 'l';
    } else if (/^[lLhHvV]$/.test(cmd)) {
      if (cmd === 'l') { cx += readNum(); cy += readNum(); }
      else if (cmd === 'L') { cx = readNum(); cy = readNum(); }
      else if (cmd === 'h') { cx += readNum(); }
      else if (cmd === 'H') { cx = readNum(); }
      else if (cmd === 'v') { cy += readNum(); }
      else if (cmd === 'V') { cy = readNum(); }
    } else {
      idx++;
    }
  }

  return rects;
}

export function parseQrSvgToRects(svgString) {
  if (!svgString || typeof svgString !== 'string') {
    return { viewBoxSize: 29, rects: [] };
  }

  const vbMatch = svgString.match(/viewBox=["']\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  const viewBoxSize = vbMatch ? Number.parseFloat(vbMatch[1]) || 29 : 29;
  const rects = [];

  // Match <rect ...> elements (skip white full background rect)
  const rectRegex = /<rect\b([^>]*)\/?>/gi;
  let rMatch;
  while ((rMatch = rectRegex.exec(svgString)) !== null) {
    const attrs = rMatch[1];
    const fillMatch = attrs.match(/fill=["']([^"']+)["']/i);
    const fill = fillMatch ? fillMatch[1].toLowerCase() : '';
    if (fill === '#ffffff' || fill === '#fff' || fill === 'white' || fill === 'none') continue;

    const x = Number.parseFloat((attrs.match(/\bx=["']([\d.-]+)["']/i) || [])[1] || '0');
    const y = Number.parseFloat((attrs.match(/\by=["']([\d.-]+)["']/i) || [])[1] || '0');
    const w = Number.parseFloat((attrs.match(/\bwidth=["']([\d.-]+)["']/i) || [])[1] || '0');
    const h = Number.parseFloat((attrs.match(/\bheight=["']([\d.-]+)["']/i) || [])[1] || '0');
    if (w > 0 && h > 0 && !(x === 0 && y === 0 && w >= viewBoxSize && h >= viewBoxSize)) {
      rects.push({ x, y, w, h });
    }
  }

  // Match <path ... d="..."> elements (qrcode.react v4 format)
  if (rects.length === 0) {
    const pathRegex = /<path\b([^>]*)\/?>/gi;
    let pMatch;
    while ((pMatch = pathRegex.exec(svgString)) !== null) {
      const attrs = pMatch[1];
      const fillMatch = attrs.match(/fill=["']([^"']+)["']/i);
      const fill = fillMatch ? fillMatch[1].toLowerCase() : '';
      if (fill === '#ffffff' || fill === '#fff' || fill === 'white' || fill === 'none') continue;
      const dMatch = attrs.match(/\bd=["']([^"']+)["']/i);
      if (!dMatch) continue;
      const parsed = parseSvgPathDataToRects(dMatch[1]);
      for (const r of parsed) {
        if (!(r.x === 0 && r.y === 0 && r.w >= viewBoxSize && r.h >= viewBoxSize)) {
          rects.push(r);
        }
      }
    }
  }

  return { viewBoxSize, rects };
}

export function generateQrVectorData(url) {
  try {
    const svgString = renderToStaticMarkup(
      React.createElement(QRCodeSVG, {
        value: String(url || 'https://redmission.org'),
        size: 160,
        level: 'M',
        includeMargin: false,
        bgColor: '#FFFFFF',
        fgColor: '#0F172A'
      })
    );
    return parseQrSvgToRects(svgString);
  } catch (err) {
    console.warn('[CERTIFICATE PDF] QR generation fallback:', err);
    return { viewBoxSize: 29, rects: [] };
  }
}

export function buildCertificatePdfBytes(certificateData, options = {}) {
  const {
    photoJpeg = null,
    qrVector = null,
    verificationUrl = ''
  } = options;

  const certId = toWinAnsiSafeText(certificateData?.id || certificateData?.certificateId || 'CERT-RED-ISSUED');
  const donorName = toWinAnsiSafeText(certificateData?.donorName || 'Verified Voluntary Donor');
  const bloodGroup = toWinAnsiSafeText(certificateData?.bloodGroup || '--');
  const unitsDonated = Number(certificateData?.unitsDonated || 1);
  const hospitalName = toWinAnsiSafeText(certificateData?.hospitalName || '');
  const hospitalCity = toWinAnsiSafeText(certificateData?.hospitalCity || '');
  const donationLocation = [hospitalName, hospitalCity].filter(Boolean).join(', ') || 'Authorized Clinical Facility';
  const donationDateStr = formatCertificateDate(certificateData?.verifiedDonationDate || certificateData?.donationDate);
  const issueDateStr = formatCertificateDate(certificateData?.issuedAt);
  const recipientReference = toWinAnsiSafeText(
    certificateData?.recipientReference || certificateData?.patientName || 'Confidential Clinical Recipient'
  );
  const organizationName = toWinAnsiSafeText(certificateData?.organizationName || 'RED MISSION');
  const issuingAuthority = toWinAnsiSafeText(
    certificateData?.issuingAuthority || 'RED MISSION Clinical Verification Council'
  );
  const issuingDesignation = toWinAnsiSafeText(
    certificateData?.issuingDesignation || 'Authorized Issuing Authority'
  );
  const approvalStatusLabel = certificateData?.approvalStatus === 'LEGACY_VERIFIED'
    ? 'LEGACY VERIFIED'
    : 'VERIFIED & APPROVED';

  const qrToken = certificateData?.qrVerificationToken || certId;
  const resolvedVerifyUrl = verificationUrl || `https://redmission.org/#verify-certificate-${qrToken}`;
  const resolvedQr = qrVector && Array.isArray(qrVector.rects) && qrVector.rects.length > 0
    ? qrVector
    : generateQrVectorData(resolvedVerifyUrl);

  const ops = [];

  // 1. Page background & multi-layered Red / White / Subtle Gold border
  ops.push(pdfRect(0, 0, A4_LANDSCAPE_WIDTH, A4_LANDSCAPE_HEIGHT, { fill: '0.996 0.992 0.986' }));
  ops.push(pdfRect(18, 18, A4_LANDSCAPE_WIDTH - 36, A4_LANDSCAPE_HEIGHT - 36, { fill: '1 1 1', stroke: '0.69 0.08 0.14', lineWidth: 2.5 }));
  ops.push(pdfRect(26, 26, A4_LANDSCAPE_WIDTH - 52, A4_LANDSCAPE_HEIGHT - 52, { stroke: '0.80 0.62 0.24', lineWidth: 1.0 }));
  ops.push(pdfRect(31, 31, A4_LANDSCAPE_WIDTH - 62, A4_LANDSCAPE_HEIGHT - 62, { stroke: '0.94 0.89 0.78', lineWidth: 0.6 }));

  // Subtle gold corner flourishes
  const cornerLen = 18;
  const corners = [
    [34, A4_LANDSCAPE_HEIGHT - 34, 1, -1],
    [A4_LANDSCAPE_WIDTH - 34, A4_LANDSCAPE_HEIGHT - 34, -1, -1],
    [34, 34, 1, 1],
    [A4_LANDSCAPE_WIDTH - 34, 34, -1, 1]
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ops.push(pdfLine(cx, cy, cx + dx * cornerLen, cy, '0.78 0.58 0.20', 1.6));
    ops.push(pdfLine(cx, cy, cx, cy + dy * cornerLen, '0.78 0.58 0.20', 1.6));
  }

  // 2. Official Header Band (y: 472 .. 556)
  ops.push(pdfRect(34, 472, A4_LANDSCAPE_WIDTH - 68, 84, { fill: '0.996 0.968 0.968' }));
  ops.push(pdfLine(34, 472, A4_LANDSCAPE_WIDTH - 34, 472, '0.80 0.62 0.24', 1.1));
  ops.push(pdfRect(34, 553, A4_LANDSCAPE_WIDTH - 68, 3, { fill: '0.70 0.08 0.15' }));

  // Header left emblem
  ops.push(drawRedMissionVectorCrest(76, 514, 24));

  // Header titles
  ops.push(pdfText(114, 532, organizationName.toUpperCase(), { font: 'F2', size: 12.5, color: '0.72 0.08 0.15' }));
  ops.push(pdfText(114, 506, 'CERTIFICATE OF APPRECIATION', { font: 'F4', size: 22.5, color: '0.09 0.11 0.16' }));
  ops.push(pdfText(114, 487, 'OFFICIAL VOLUNTARY BLOOD DONATION RECOGNITION & CLINICAL RECORD', { font: 'F2', size: 8.2, color: '0.56 0.42 0.15' }));

  // Header right blood-group seal pill
  ops.push(pdfRect(682, 489, 108, 50, { fill: '0.72 0.08 0.15', stroke: '0.84 0.67 0.28', lineWidth: 1.0 }));
  ops.push(pdfText(736, 524, 'BLOOD GROUP', { font: 'F2', size: 7.2, color: '0.98 0.87 0.88', align: 'center' }));
  ops.push(pdfText(736, 499, `${bloodGroup}  (${unitsDonated} ${unitsDonated === 1 ? 'Unit' : 'Units'})`, { font: 'F2', size: 13.5, color: '1 1 1', align: 'center' }));

  // 3. Three-Column Body Area (y: 118 .. 456, height = 338pt)
  // --- LEFT SECTION: Donor Photograph (~33% of 746pt content width -> x: 46 .. 294, width 248pt) ---
  const photoCardX = 46;
  const photoCardY = 118;
  const photoCardW = 248;
  const photoCardH = 338;
  ops.push(pdfRect(photoCardX, photoCardY, photoCardW, photoCardH, { fill: '0.988 0.982 0.972', stroke: '0.82 0.70 0.40', lineWidth: 1.0 }));

  const frameX = photoCardX + 12;
  const frameY = photoCardY + 34;
  const frameW = photoCardW - 24;
  const frameH = photoCardH - 46;
  ops.push(pdfRect(frameX, frameY, frameW, frameH, { fill: '0.955 0.955 0.962', stroke: '0.88 0.85 0.78', lineWidth: 0.75 }));

  if (photoJpeg && photoJpeg.bytes && photoJpeg.width > 0 && photoJpeg.height > 0) {
    // Strictly preserve original aspect ratio inside the portrait box (never stretch/crop)
    const innerPad = 4;
    const availW = frameW - innerPad * 2;
    const availH = frameH - innerPad * 2;
    const scale = Math.min(availW / photoJpeg.width, availH / photoJpeg.height);
    const drawW = photoJpeg.width * scale;
    const drawH = photoJpeg.height * scale;
    const drawX = frameX + innerPad + (availW - drawW) / 2;
    const drawY = frameY + innerPad + (availH - drawH) / 2;

    ops.push(`q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /Im1 Do Q`);
    ops.push(pdfRect(drawX, drawY, drawW, drawH, { stroke: '0.82 0.70 0.40', lineWidth: 0.6 }));
  } else {
    // Clean, unmistakable fallback when donor photo is absent
    const midX = frameX + frameW / 2;
    const midY = frameY + frameH / 2 + 12;
    ops.push(pdfRect(midX - 38, midY - 38, 76, 76, { fill: '0.92 0.93 0.95', stroke: '0.80 0.82 0.86', lineWidth: 0.8 }));
    ops.push(pdfText(midX, midY + 4, 'DONOR PHOTOGRAPH', { font: 'F2', size: 9.0, color: '0.40 0.44 0.52', align: 'center' }));
    ops.push(pdfText(midX, midY - 12, 'UNAVAILABLE', { font: 'F2', size: 9.0, color: '0.58 0.20 0.24', align: 'center' }));
  }

  ops.push(pdfText(photoCardX + photoCardW / 2, photoCardY + 14, 'AUTHENTICATED VOLUNTARY DONOR', { font: 'F2', size: 7.4, color: '0.50 0.40 0.18', align: 'center' }));

  // --- CENTER SECTION: Donor & Verified Donation Record (x: 312 .. 600, width 288pt) ---
  const centerX = 312;
  const centerW = 288;

  ops.push(pdfText(centerX, 442, 'PROUDLY PRESENTED TO', { font: 'F2', size: 8.2, color: '0.72 0.08 0.15' }));

  const nameFontSize = donorName.length > 26 ? 15.5 : donorName.length > 18 ? 18.0 : 21.0;
  const nameLines = wrapTextLines(donorName, centerW, nameFontSize, true, 2);
  let cursorY = 414;
  for (const line of nameLines) {
    ops.push(pdfText(centerX, cursorY, line, { font: 'F4', size: nameFontSize, color: '0.09 0.11 0.16' }));
    cursorY -= nameFontSize * 1.15;
  }

  const ruleY = Math.min(cursorY + 4, 392);
  ops.push(pdfLine(centerX, ruleY, centerX + centerW, ruleY, '0.82 0.70 0.40', 1.0));

  const citationText = 'In heartfelt recognition of a verified voluntary blood donation through RED MISSION, contributing directly toward saving a human life.';
  const citationLines = wrapTextLines(citationText, centerW, 9.2, false, 3);
  let citY = ruleY - 16;
  for (const cLine of citationLines) {
    ops.push(pdfText(centerX, citY, cLine, { font: 'F1', size: 9.2, color: '0.26 0.30 0.37' }));
    citY -= 12.5;
  }

  // Structured details rows below citation
  const rowsTopY = Math.min(citY - 8, 330);
  const details = [
    { label: 'CERTIFICATE ID', value: certId, bold: true, color: '0.70 0.08 0.15' },
    { label: 'BLOOD GROUP', value: `${bloodGroup} (${unitsDonated} ${unitsDonated === 1 ? 'Unit Donated' : 'Units Donated'})`, bold: true, color: '0.09 0.11 0.16' },
    { label: 'VERIFIED DONATION DATE', value: donationDateStr, bold: true, color: '0.09 0.11 0.16' },
    { label: 'DONATION LOCATION', value: donationLocation, bold: false, color: '0.12 0.16 0.22' },
    { label: 'RECIPIENT REFERENCE', value: recipientReference, bold: false, color: '0.12 0.16 0.22' },
    { label: 'CERTIFICATE ISSUE DATE', value: issueDateStr, bold: true, color: '0.09 0.11 0.16' }
  ];

  let rowY = rowsTopY;
  const rowBottomLimit = 122;
  for (let i = 0; i < details.length && rowY >= rowBottomLimit; i++) {
    const item = details[i];
    const wrappedVal = wrapTextLines(item.value, centerW - 6, 9.4, item.bold, 2);
    const blockH = wrappedVal.length > 1 ? 35 : 26;
    if (rowY - blockH < rowBottomLimit - 6) break;

    ops.push(pdfRect(centerX, rowY - blockH + 4, centerW, blockH, { fill: i % 2 === 0 ? '0.986 0.986 0.990' : '1 1 1', stroke: '0.91 0.91 0.93', lineWidth: 0.5 }));
    ops.push(pdfText(centerX + 8, rowY - 8, item.label, { font: 'F2', size: 6.8, color: '0.45 0.49 0.56' }));

    let vy = rowY - 19;
    for (const vLine of wrappedVal) {
      ops.push(pdfText(centerX + 8, vy, vLine, { font: item.bold ? 'F2' : 'F1', size: 9.2, color: item.color }));
      vy -= 10.5;
    }
    rowY -= blockH + 4;
  }

  // --- RIGHT SECTION: QR Verification Panel (x: 616 .. 796, width 180pt) ---
  const rightX = 616;
  const rightY = 118;
  const rightW = 180;
  const rightH = 338;
  ops.push(pdfRect(rightX, rightY, rightW, rightH, { fill: '0.994 0.988 0.988', stroke: '0.82 0.70 0.40', lineWidth: 1.0 }));

  const rightMidX = rightX + rightW / 2;
  ops.push(pdfText(rightMidX, 439, 'SECURE VERIFICATION', { font: 'F2', size: 8.0, color: '0.72 0.08 0.15', align: 'center' }));
  ops.push(pdfLine(rightX + 18, 431, rightX + rightW - 18, 431, '0.90 0.84 0.70', 0.7));

  // QR Frame & Crisp Vector Modules
  const qrOuterSize = 136;
  const qrBoxX = rightMidX - qrOuterSize / 2;
  const qrBoxY = 285;
  ops.push(pdfRect(qrBoxX, qrBoxY, qrOuterSize, qrOuterSize, { fill: '1 1 1', stroke: '0.78 0.80 0.84', lineWidth: 0.8 }));

  if (resolvedQr.rects.length > 0) {
    const pad = 8;
    const drawArea = qrOuterSize - pad * 2;
    const scale = drawArea / (resolvedQr.viewBoxSize || 29);
    ops.push('0.06 0.09 0.16 rg');
    for (const r of resolvedQr.rects) {
      const rx = qrBoxX + pad + r.x * scale;
      const ry = qrBoxY + pad + (resolvedQr.viewBoxSize - r.y - r.h) * scale;
      const rw = r.w * scale;
      const rh = r.h * scale;
      ops.push(`${rx.toFixed(2)} ${ry.toFixed(2)} ${rw.toFixed(2)} ${rh.toFixed(2)} re f`);
    }
  } else {
    ops.push(pdfText(rightMidX, qrBoxY + 64, 'QR VERIFICATION', { font: 'F2', size: 8.5, color: '0.40 0.45 0.52', align: 'center' }));
  }

  ops.push(pdfText(rightMidX, 267, 'Scan QR code to verify certificate', { font: 'F2', size: 7.8, color: '0.15 0.19 0.26', align: 'center' }));
  ops.push(pdfText(rightMidX, 256, 'authenticity on RED MISSION.', { font: 'F1', size: 7.6, color: '0.32 0.37 0.45', align: 'center' }));

  // Verification URL Card
  ops.push(pdfRect(rightX + 10, 186, rightW - 20, 58, { fill: '1 1 1', stroke: '0.90 0.84 0.84', lineWidth: 0.6 }));
  ops.push(pdfText(rightX + 16, 232, 'VERIFICATION URL', { font: 'F2', size: 6.6, color: '0.45 0.49 0.56' }));
  const urlLines = wrapTextLines(resolvedVerifyUrl, rightW - 32, 6.8, false, 3);
  let uY = 220;
  for (const uLine of urlLines) {
    ops.push(pdfText(rightX + 16, uY, uLine, { font: 'F1', size: 6.7, color: '0.14 0.24 0.44' }));
    uY -= 10;
  }

  // Right Certificate ID Strip
  ops.push(pdfRect(rightX + 10, 130, rightW - 20, 44, { fill: '0.996 0.968 0.968', stroke: '0.86 0.68 0.68', lineWidth: 0.7 }));
  ops.push(pdfText(rightMidX, 161, 'CERTIFICATE ID', { font: 'F2', size: 6.6, color: '0.52 0.16 0.20', align: 'center' }));
  ops.push(pdfText(rightMidX, 144, certId, { font: 'F2', size: 8.6, color: '0.09 0.11 0.16', align: 'center' }));

  // 4. Official Footer Band (y: 40 .. 104)
  ops.push(pdfLine(46, 104, 796, 104, '0.82 0.70 0.40', 1.0));

  // Left footer: Issuing Authority (no fabricated signatures)
  ops.push(pdfText(48, 86, 'ISSUING AUTHORITY', { font: 'F2', size: 7.0, color: '0.48 0.52 0.58' }));
  ops.push(pdfText(48, 70, issuingAuthority, { font: 'F2', size: 9.6, color: '0.09 0.11 0.16' }));
  ops.push(pdfText(48, 56, issuingDesignation, { font: 'F1', size: 8.0, color: '0.35 0.39 0.46' }));

  // Center footer: Official Organization Seal & Issue Date
  ops.push(pdfRect(334, 48, 174, 46, { fill: '0.992 0.984 0.965', stroke: '0.82 0.70 0.40', lineWidth: 0.75 }));
  ops.push(pdfText(421, 79, 'OFFICIAL RED MISSION RECORD', { font: 'F2', size: 7.4, color: '0.72 0.08 0.15', align: 'center' }));
  ops.push(pdfText(421, 64, `Issued: ${issueDateStr}`, { font: 'F2', size: 8.2, color: '0.14 0.18 0.24', align: 'center' }));
  ops.push(pdfText(421, 53, 'Emergency Blood Donor Network', { font: 'F1', size: 6.8, color: '0.40 0.44 0.50', align: 'center' }));

  // Right footer: Status & Network Branding
  ops.push(pdfText(794, 86, 'CERTIFICATION STATUS', { font: 'F2', size: 7.0, color: '0.48 0.52 0.58', align: 'right' }));
  ops.push(pdfText(794, 70, approvalStatusLabel, { font: 'F2', size: 9.4, color: '0.06 0.48 0.30', align: 'right' }));
  ops.push(pdfText(794, 56, `${organizationName} • Verified Clinical Record`, { font: 'F1', size: 8.0, color: '0.35 0.39 0.46', align: 'right' }));

  const streamContent = ops.join('\n');
  const streamBytes = new TextEncoder().encode(streamContent);

  // Build PDF 1.4 objects cleanly with exact byte offsets for xref
  const objects = [];
  const hasPhoto = Boolean(photoJpeg && photoJpeg.bytes && photoJpeg.width > 0 && photoJpeg.height > 0);
  const contentObjNum = hasPhoto ? 9 : 8;

  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  // 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  // 3: Page (A4 Landscape: 841.89 x 595.28)
  const xObjectEntry = hasPhoto ? ' /XObject << /Im1 8 0 R >>' : '';
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LANDSCAPE_WIDTH} ${A4_LANDSCAPE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >>${xObjectEntry} >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
  );
  // 4-7: Standard Type1 Fonts (WinAnsiEncoding)
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

  const chunks = [];
  const offsets = [0];
  let currentOffset = 0;

  const pushBytes = (uint8) => {
    chunks.push(uint8);
    currentOffset += uint8.length;
  };
  const pushAscii = (str) => {
    pushBytes(new TextEncoder().encode(str));
  };

  pushAscii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  for (const objStr of objects) {
    offsets.push(currentOffset);
    pushAscii(objStr);
  }

  if (hasPhoto) {
    offsets.push(currentOffset);
    pushAscii(
      `8 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(photoJpeg.width)} /Height ${Math.round(photoJpeg.height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${photoJpeg.bytes.length} >>\nstream\n`
    );
    pushBytes(photoJpeg.bytes);
    pushAscii('\nendstream\nendobj\n');
  }

  // Content stream object
  offsets.push(currentOffset);
  pushAscii(`${contentObjNum} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
  pushBytes(streamBytes);
  pushAscii('\nendstream\nendobj\n');

  const xrefStart = currentOffset;
  const totalObjects = offsets.length;
  const xrefLines = [`xref\n0 ${totalObjects}\n0000000000 65535 f \n`];
  for (let i = 1; i < totalObjects; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushAscii(xrefLines.join(''));
  pushAscii(`trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const output = new Uint8Array(currentOffset);
  let pos = 0;
  for (const chunk of chunks) {
    output.set(chunk, pos);
    pos += chunk.length;
  }
  return output;
}

function parseBaselineJpegInfo(bytes) {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let idx = 2;
  while (idx + 3 < bytes.length) {
    if (bytes[idx] !== 0xff) break;
    while (idx < bytes.length && bytes[idx] === 0xff) idx++;
    if (idx >= bytes.length) break;
    const marker = bytes[idx++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (idx + 1 >= bytes.length) break;
    const segLen = (bytes[idx] << 8) | bytes[idx + 1];
    if (segLen < 2 || idx + segLen > bytes.length) break;

    // SOF0 (0xC0) baseline DCT; require 8-bit 3-component (DeviceRGB YCbCr) for safe direct embedding
    if (marker === 0xc0 && segLen >= 8) {
      const precision = bytes[idx + 2];
      const height = (bytes[idx + 3] << 8) | bytes[idx + 4];
      const width = (bytes[idx + 5] << 8) | bytes[idx + 6];
      const components = bytes[idx + 7];
      if (precision === 8 && components === 3 && width > 0 && height > 0) {
        return { width, height, bytes };
      }
      return null;
    }
    if (marker === 0xc2) {
      // Progressive JPEG -> re-encode via high-res canvas to baseline DCT
      return null;
    }
    idx += segLen;
  }
  return null;
}

async function convertImageBlobToJpegBytes(blob) {
  if (!blob) return null;

  try {
    const rawBuffer = await blob.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);
    const directJpeg = parseBaselineJpegInfo(rawBytes);
    if (directJpeg) {
      return directJpeg;
    }
  } catch {
    // Fall through to canvas decode
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 0;
        const naturalH = img.naturalHeight || img.height || 0;
        if (naturalW <= 0 || naturalH <= 0) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        const maxDim = 1400;
        const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
        const targetW = Math.max(1, Math.round(naturalW * scale));
        const targetH = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        canvas.toBlob(async (jpegBlob) => {
          URL.revokeObjectURL(objectUrl);
          if (!jpegBlob) {
            resolve(null);
            return;
          }
          const arrBuf = await jpegBlob.arrayBuffer();
          resolve({
            width: targetW,
            height: targetH,
            bytes: new Uint8Array(arrBuf)
          });
        }, 'image/jpeg', 0.95);
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
}

export function getCertificatePdfFilename(certificateData) {
  const safeId = String(certificateData?.id || certificateData?.certificateId || 'VERIFIED')
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  return `RED-MISSION-Certificate-${safeId}.pdf`;
}

export async function downloadCertificatePdf(certificateData, { tokenType } = {}) {
  if (!certificateData) {
    throw new Error('Certificate data is required to generate PDF.');
  }

  const qrToken = certificateData.qrVerificationToken || certificateData.id || '';
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://redmission.org';
  const verificationUrl = `${origin}/#verify-certificate-${qrToken}`;

  let photoJpeg = null;
  if ((certificateData.donorPhotoAvailable || certificateData.donorPhotoUrl) && certificateData.pledgeId) {
    try {
      const photoBlob = await certificateApi.fetchDonorPhotoBlob(certificateData.pledgeId, {
        donorPhotoUrl: certificateData.donorPhotoUrl,
        tokenType
      });
      if (photoBlob) {
        photoJpeg = await convertImageBlobToJpegBytes(photoBlob);
      }
    } catch (err) {
      console.warn('[CERTIFICATE PDF] Photo fetch skipped:', err);
    }
  }

  const qrVector = generateQrVectorData(verificationUrl);
  const pdfBytes = buildCertificatePdfBytes(certificateData, {
    photoJpeg,
    qrVector,
    verificationUrl
  });

  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(pdfBlob);
  const filename = getCertificatePdfFilename(certificateData);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 1500);

  return { filename, bytesLength: pdfBytes.length, hasPhoto: Boolean(photoJpeg) };
}
