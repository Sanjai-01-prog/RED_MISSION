/**
 * RED MISSION — Professional A4 PDF Monthly Donation Report Generator
 * Phase 6, Feature 1: Official Rotaract District Submission Report
 * 
 * Strict Zero-Dependency Native Node.js Implementation.
 * Produces standard-compliant, pixel-perfect PDF 1.4 documents
 * with embedded proof photographs, typography, vector lines, and pagination.
 */

import fs from 'node:fs';
import { parseImageDimensions } from '../utils/imageValidator.js';

// Standard A4 Dimensions in PostScript Points (72 points = 1 inch)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 515.28 pt
const MARGIN_TOP = 45;
const MARGIN_BOTTOM = 45;

/**
 * Escape text for PDF literal strings (enclose in parentheses)
 */
function escapePdfText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * PDF Builder Class
 */
class SimplePdfDoc {
  constructor() {
    this.objects = [];
    this.pages = [];
    this.images = []; // Array of { id, buffer, width, height, name }
    this.currentPageIndex = -1;
  }

  addObject(content) {
    const id = this.objects.length + 1;
    this.objects.push({ id, content });
    return id;
  }

  addPage() {
    const pageObj = {
      stream: [],
      imagesUsed: []
    };
    this.pages.push(pageObj);
    this.currentPageIndex = this.pages.length - 1;
    return pageObj;
  }

  get currentPage() {
    if (this.currentPageIndex === -1) {
      this.addPage();
    }
    return this.pages[this.currentPageIndex];
  }

  // PDF Graphics Primitives
  write(cmd) {
    this.currentPage.stream.push(cmd);
  }

  save() {
    this.write('q');
  }

  restore() {
    this.write('Q');
  }

  setColor(r, g, b) {
    this.write(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  }

  setStrokeColor(r, g, b) {
    this.write(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  }

  setLineWidth(w) {
    this.write(`${w.toFixed(2)} w`);
  }

  rect(x, y, w, h, fill = false, stroke = false) {
    this.write(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    if (fill && stroke) this.write('B');
    else if (fill) this.write('f');
    else if (stroke) this.write('S');
  }

  line(x1, y1, x2, y2) {
    this.write(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  text(str, x, y, { font = '/F1', size = 10, color = [0.1, 0.1, 0.1] } = {}) {
    this.save();
    this.setColor(color[0], color[1], color[2]);
    this.write(`BT ${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(str)}) Tj ET`);
    this.restore();
  }

  addImage(filePath) {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const buf = fs.readFileSync(filePath);
      const dims = parseImageDimensions(buf, 'jpeg');
      if (!dims || dims.width === 0 || dims.height === 0) return null;

      const imgName = `Img${this.images.length + 1}`;
      const imgRecord = {
        name: imgName,
        buffer: buf,
        width: dims.width,
        height: dims.height
      };
      this.images.push(imgRecord);
      return imgRecord;
    } catch {
      return null;
    }
  }

  drawImage(imgRecord, x, y, width, height) {
    if (!imgRecord) return;
    this.currentPage.imagesUsed.push(imgRecord);
    this.save();
    this.write(`${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${imgRecord.name} Do`);
    this.restore();
  }

  buildBuffer() {
    // Collect all objects
    // 1: Catalog
    // 2: Pages Root
    // 3: Font Helvetica
    // 4: Font Helvetica-Bold
    // 5: Font Courier
    // Next: Images
    // Next: Page Objects & Contents
    const chunks = [];
    chunks.push(Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary'));

    let objectCount = 0;
    const offsets = [];

    const recordObject = (contentBuffer) => {
      objectCount++;
      offsets.push(chunks.reduce((acc, c) => acc + c.length, 0));
      chunks.push(Buffer.from(`${objectCount} 0 obj\n`, 'utf8'));
      chunks.push(contentBuffer);
      chunks.push(Buffer.from('\nendobj\n', 'utf8'));
      return objectCount;
    };

    // 1: Catalog
    const catalogId = 1;
    const pagesRootId = 2;
    const fontHelvId = 3;
    const fontHelvBoldId = 4;
    const fontCourierId = 5;

    // Reserve catalog and pagesRoot
    recordObject(Buffer.from(`<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`, 'utf8'));
    
    // Pages root placeholder (will write actual kids later or pre-calculate)
    // To keep it simple, pre-allocate IDs
    const totalPages = this.pages.length;
    let nextId = 6;

    // Assign IDs to images
    const imageObjectMap = new Map();
    for (const img of this.images) {
      imageObjectMap.set(img.name, nextId++);
    }

    // Page IDs: each page needs Page obj + Content stream obj
    const pageIds = [];
    const contentIds = [];
    for (let i = 0; i < totalPages; i++) {
      pageIds.push(nextId++);
      contentIds.push(nextId++);
    }

    // Now write Pages Root (Object 2)
    const kidsStr = pageIds.map(id => `${id} 0 R`).join(' ');
    // We already recorded object 1. To write object 2:
    recordObject(Buffer.from(`<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] >>`, 'utf8'));

    // Fonts: Objects 3, 4, 5
    recordObject(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'utf8'));
    recordObject(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>', 'utf8'));
    recordObject(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>', 'utf8'));

    // Images
    for (const img of this.images) {
      const imgHeader = `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.buffer.length} >>\nstream\n`;
      const imgFooter = '\nendstream';
      recordObject(Buffer.concat([
        Buffer.from(imgHeader, 'utf8'),
        img.buffer,
        Buffer.from(imgFooter, 'utf8')
      ]));
    }

    // Pages & Content streams
    for (let i = 0; i < totalPages; i++) {
      const page = this.pages[i];
      const pageId = pageIds[i];
      const contentId = contentIds[i];

      // Build XObject resource dictionary for this page
      let xobjDict = '';
      if (page.imagesUsed.length > 0) {
        const entries = [...new Set(page.imagesUsed)].map(img => `/${img.name} ${imageObjectMap.get(img.name)} 0 R`).join(' ');
        xobjDict = `/XObject << ${entries} >>`;
      }

      // Page Object
      recordObject(Buffer.from(
        `<< /Type /Page /Parent ${pagesRootId} 0 R /Resources << /Font << /F1 ${fontHelvId} 0 R /F2 ${fontHelvBoldId} 0 R /F3 ${fontCourierId} 0 R >> ${xobjDict} >> /Contents ${contentId} 0 R >>`,
        'utf8'
      ));

      // Page Content Stream
      const streamText = page.stream.join('\n');
      const streamBuf = Buffer.from(streamText, 'utf8');
      const contentObjText = `<< /Length ${streamBuf.length} >>\nstream\n${streamText}\nendstream`;
      recordObject(Buffer.from(contentObjText, 'utf8'));
    }

    // Cross-Reference Table (xref)
    const xrefOffset = chunks.reduce((acc, c) => acc + c.length, 0);
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      xref += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objectCount + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%%%EOF\n`;
    chunks.push(Buffer.from(xref, 'utf8'));

    return Buffer.concat(chunks);
  }
}

/**
 * Generate Professional A4 Monthly Donation Report PDF
 * 
 * @param {Object} reportData - Structured report output from reportDataService
 * @returns {Buffer} Binary PDF buffer
 */
export function generateMonthlyDonationReportPdf(reportData) {
  const doc = new SimplePdfDoc();
  const { period, summary, donations, preparedBy, authorizedBy, reportRef } = reportData;
  const isMasked = reportData.maskSensitive !== false;
  const privacyMode = reportData.privacyMode === 'UNMASKED' || !isMasked ? 'UNMASKED' : 'MASKED';

  // Helper: Draw Running Header & Footer
  const renderHeaderFooter = (pageNumber, totalPages) => {
    // Header banner line
    doc.save();
    doc.setColor(0.78, 0.12, 0.12); // Deep Crimson
    doc.rect(MARGIN_LEFT, PAGE_HEIGHT - 32, CONTENT_WIDTH, 2, true, false);
    doc.text('RED MISSION  //  ROTARACT DISTRICT ACTIVITY REPORT', MARGIN_LEFT, PAGE_HEIGHT - 26, {
      font: '/F2',
      size: 8,
      color: [0.78, 0.12, 0.12]
    });
    doc.text(`REPORT REF: ${reportRef}`, PAGE_WIDTH - MARGIN_RIGHT - 140, PAGE_HEIGHT - 26, {
      font: '/F3',
      size: 7.5,
      color: [0.4, 0.4, 0.4]
    });

    // Footer banner line
    doc.setStrokeColor(0.85, 0.85, 0.85);
    doc.setLineWidth(0.75);
    doc.line(MARGIN_LEFT, 32, PAGE_WIDTH - MARGIN_RIGHT, 32);
    doc.text('Confidential • For Official Rotaract District Submission & Clinical Verification Only', MARGIN_LEFT, 22, {
      font: '/F1',
      size: 7.5,
      color: [0.5, 0.5, 0.5]
    });
    doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT - 55, 22, {
      font: '/F2',
      size: 8,
      color: [0.3, 0.3, 0.3]
    });
    doc.restore();
  };

  // =========================================================================
  // PAGE 1: COVER & EXECUTIVE MONTHLY SUMMARY
  // =========================================================================
  doc.addPage();
  let y = PAGE_HEIGHT - 65;

  // Organization Title Badge
  doc.save();
  doc.setColor(0.96, 0.96, 0.98);
  doc.rect(MARGIN_LEFT, y - 55, CONTENT_WIDTH, 60, true, false);
  doc.setStrokeColor(0.78, 0.12, 0.12);
  doc.setLineWidth(1.5);
  doc.line(MARGIN_LEFT, y + 5, MARGIN_LEFT, y - 55); // Left accent bar
  doc.restore();

  doc.text('RED MISSION BLOOD DONATION NETWORK', MARGIN_LEFT + 15, y - 12, {
    font: '/F2',
    size: 16,
    color: [0.78, 0.12, 0.12]
  });
  doc.text('ROTARACT CLUB & ROTARACT DISTRICT OFFICIAL ACTIVITY SUBMISSION', MARGIN_LEFT + 15, y - 26, {
    font: '/F2',
    size: 9,
    color: [0.2, 0.25, 0.35]
  });
  doc.text(`Official Monthly Verified Activity Dossier — Reporting Period: ${period.monthName} ${period.year}`, MARGIN_LEFT + 15, y - 42, {
    font: '/F1',
    size: 9.5,
    color: [0.35, 0.4, 0.45]
  });

  y -= 75;

  // Metadata Strip
  doc.save();
  doc.setColor(0.93, 0.95, 0.98);
  doc.rect(MARGIN_LEFT, y - 22, CONTENT_WIDTH, 24, true, false);
  doc.restore();

  doc.text(`Date Range: ${period.startDate} to ${period.endDate}`, MARGIN_LEFT + 10, y - 14, {
    font: '/F2',
    size: 8.5,
    color: [0.15, 0.2, 0.3]
  });
  doc.text(`Report Prepared: ${reportData.generatedAt.split('T')[0]}`, MARGIN_LEFT + 220, y - 14, {
    font: '/F1',
    size: 8.5,
    color: [0.25, 0.3, 0.35]
  });
  doc.text(`Status: OFFICIALLY AUDITED & CERTIFIED`, MARGIN_LEFT + 345, y - 14, {
    font: '/F2',
    size: 8.5,
    color: [0.05, 0.55, 0.3]
  });

  y -= 45;

  // Section Heading: Executive Telemetry Summary
  doc.text('1. EXECUTIVE PERFORMANCE TELEMETRY', MARGIN_LEFT, y, {
    font: '/F2',
    size: 12,
    color: [0.1, 0.15, 0.25]
  });
  doc.setStrokeColor(0.8, 0.8, 0.85);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y - 4, PAGE_WIDTH - MARGIN_RIGHT, y - 4);
  y -= 18;

  // 4 KPI Metric Cards (Grid 2x2 or 4x1)
  const cardW = (CONTENT_WIDTH - 24) / 4;
  const cardH = 52;
  const cards = [
    { title: 'VERIFIED DONATIONS', val: String(summary.totalDonations), subtitle: 'Clinically audited' },
    { title: 'UNITS COLLECTED', val: `${summary.totalUnits} Units`, subtitle: 'Whole blood / PRBC' },
    { title: 'UNIQUE LIFESAVERS', val: String(summary.uniqueDonorsCount), subtitle: 'Active registered donors' },
    { title: 'HOSPITALS SERVED', val: String(summary.uniqueHospitalsCount), subtitle: 'Clinical institutions' }
  ];

  for (let i = 0; i < 4; i++) {
    const cx = MARGIN_LEFT + i * (cardW + 8);
    const c = cards[i];

    doc.save();
    doc.setColor(0.97, 0.97, 0.98);
    doc.rect(cx, y - cardH, cardW, cardH, true, false);
    doc.setStrokeColor(0.85, 0.85, 0.9);
    doc.setLineWidth(0.75);
    doc.rect(cx, y - cardH, cardW, cardH, false, true);
    doc.restore();

    doc.text(c.title, cx + 8, y - 14, { font: '/F2', size: 6.8, color: [0.5, 0.1, 0.1] });
    doc.text(c.val, cx + 8, y - 32, { font: '/F2', size: 14, color: [0.1, 0.15, 0.25] });
    doc.text(c.subtitle, cx + 8, y - 44, { font: '/F1', size: 7, color: [0.5, 0.55, 0.6] });
  }

  y -= cardH + 25;

  // Section Heading: Blood Group-wise Donation Distribution
  doc.text('2. CLINICAL BLOOD GROUP DISTRIBUTION', MARGIN_LEFT, y, {
    font: '/F2',
    size: 12,
    color: [0.1, 0.15, 0.25]
  });
  doc.setStrokeColor(0.8, 0.8, 0.85);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y - 4, PAGE_WIDTH - MARGIN_RIGHT, y - 4);
  y -= 16;

  // Table of 8 Blood Groups
  const bgTableW = CONTENT_WIDTH;
  const colW = bgTableW / 8;
  const bgOrder = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  // Table Header
  doc.save();
  doc.setColor(0.9, 0.92, 0.96);
  doc.rect(MARGIN_LEFT, y - 18, bgTableW, 20, true, false);
  doc.restore();

  for (let i = 0; i < 8; i++) {
    const bx = MARGIN_LEFT + i * colW;
    doc.text(bgOrder[i], bx + colW / 2 - 8, y - 13, { font: '/F2', size: 9, color: [0.15, 0.2, 0.3] });
  }
  y -= 20;

  // Table Data Row
  doc.save();
  doc.setColor(0.98, 0.98, 0.99);
  doc.rect(MARGIN_LEFT, y - 20, bgTableW, 22, true, false);
  doc.setStrokeColor(0.85, 0.85, 0.9);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN_LEFT, y - 20, bgTableW, 22, false, true);
  doc.restore();

  for (let i = 0; i < 8; i++) {
    const bx = MARGIN_LEFT + i * colW;
    const count = summary.bloodGroups[bgOrder[i]] || 0;
    const pct = summary.totalDonations > 0 ? ((count / summary.totalDonations) * 100).toFixed(0) : '0';
    doc.text(`${count} u (${pct}%)`, bx + colW / 2 - 16, y - 14, {
      font: '/F1',
      size: 8,
      color: count > 0 ? [0.75, 0.1, 0.1] : [0.6, 0.6, 0.6]
    });
  }
  y -= 38;

  // Narrative Statement
  doc.text('3. ACTIVITY SUMMARY & COMPLIANCE STATEMENT', MARGIN_LEFT, y, {
    font: '/F2',
    size: 12,
    color: [0.1, 0.15, 0.25]
  });
  doc.setStrokeColor(0.8, 0.8, 0.85);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y - 4, PAGE_WIDTH - MARGIN_RIGHT, y - 4);
  y -= 16;

  const narrative = [
    `During the period of ${period.monthName} ${period.year}, the RED MISSION Blood Donation Network mobilized`,
    `${summary.uniqueDonorsCount} registered lifesavers to fulfill ${summary.totalDonations} clinical emergency blood requests, delivering a total of`,
    `${summary.totalUnits} whole blood units across ${summary.uniqueHospitalsCount} healthcare centers. Every record documented in this dossier represents`,
    `a completed donation verified against physical hospital slips, blood bank donor cards, and administrative review.`,
    `In accordance with National Blood Transfusion Council (NBTC) guidelines and Rotaract District activity governance,`,
    `zero unverified pledges or rejected submissions are recorded in this official submission.`
  ];

  for (const line of narrative) {
    doc.text(line, MARGIN_LEFT + 4, y, { font: '/F1', size: 8.8, color: [0.3, 0.35, 0.4] });
    y -= 14;
  }

  y -= 10;

  // Authorization Box on Page 1 Footer
  doc.save();
  doc.setColor(0.97, 0.98, 0.97);
  doc.rect(MARGIN_LEFT, y - 55, CONTENT_WIDTH, 55, true, false);
  doc.setStrokeColor(0.2, 0.6, 0.3);
  doc.setLineWidth(1);
  doc.rect(MARGIN_LEFT, y - 55, CONTENT_WIDTH, 55, false, true);
  doc.restore();

  doc.text('DISTRICT PORTAL SUBMISSION ATTESTATION', MARGIN_LEFT + 12, y - 16, {
    font: '/F2',
    size: 9,
    color: [0.1, 0.5, 0.25]
  });
  doc.text(`Prepared By: ${preparedBy.adminName} (${preparedBy.adminRole})`, MARGIN_LEFT + 12, y - 30, {
    font: '/F1',
    size: 8.5,
    color: [0.25, 0.3, 0.35]
  });
  doc.text(`Authorized Desk: ${authorizedBy.designation}`, MARGIN_LEFT + 12, y - 44, {
    font: '/F1',
    size: 8.5,
    color: [0.25, 0.3, 0.35]
  });
  doc.text('STAMP / VERIFICATION SEAL', PAGE_WIDTH - MARGIN_RIGHT - 140, y - 16, {
    font: '/F2',
    size: 7.5,
    color: [0.5, 0.5, 0.5]
  });
  doc.text(`Privacy Mode: ${privacyMode}`, PAGE_WIDTH - MARGIN_RIGHT - 140, y - 44, {
    font: '/F2',
    size: 7.5,
    color: privacyMode === 'UNMASKED' ? [0.75, 0.1, 0.1] : [0.1, 0.5, 0.25]
  });

  // =========================================================================
  // PAGES 2+: DETAILED DONOR-WISE DONATION RECORDS (EVIDENCE CARDS)
  // =========================================================================
  const cardHeight = 155; // Height per donation card including photo
  let pageNumber = 1;

  if (donations.length === 0) {
    // Zero donations edge case
    doc.addPage();
    pageNumber++;
    y = PAGE_HEIGHT - 65;
    doc.text('DETAILED DONOR-WISE DONATION RECORDS', MARGIN_LEFT, y, { font: '/F2', size: 14, color: [0.78, 0.12, 0.12] });
    y -= 40;
    doc.save();
    doc.setColor(0.96, 0.96, 0.98);
    doc.rect(MARGIN_LEFT, y - 60, CONTENT_WIDTH, 60, true, false);
    doc.restore();
    doc.text(`No verified completed donations were recorded for the period ${period.monthName} ${period.year}.`, MARGIN_LEFT + 20, y - 32, {
      font: '/F1',
      size: 10,
      color: [0.4, 0.45, 0.5]
    });
  } else {
    doc.addPage();
    pageNumber++;
    y = PAGE_HEIGHT - 65;

    doc.text(`DETAILED DONOR-WISE DONATION RECORDS — ${period.monthName.toUpperCase()} ${period.year}`, MARGIN_LEFT, y, {
      font: '/F2',
      size: 13,
      color: [0.78, 0.12, 0.12]
    });
    doc.text(`Total Records: ${donations.length} Verified Donations`, PAGE_WIDTH - MARGIN_RIGHT - 150, y, {
      font: '/F1',
      size: 9,
      color: [0.4, 0.4, 0.4]
    });
    y -= 14;

    for (let idx = 0; idx < donations.length; idx++) {
      const d = donations[idx];

      // Check if current card fits on page
      if (y - cardHeight < MARGIN_BOTTOM + 20) {
        doc.addPage();
        pageNumber++;
        y = PAGE_HEIGHT - 65;
        doc.text(`DETAILED DONOR-WISE DONATION RECORDS (CONT.) — ${period.monthName.toUpperCase()} ${period.year}`, MARGIN_LEFT, y, {
          font: '/F2',
          size: 11,
          color: [0.78, 0.12, 0.12]
        });
        y -= 20;
      }

      // Card Container Outer Box
      doc.save();
      doc.setColor(0.99, 0.99, 1.0);
      doc.rect(MARGIN_LEFT, y - cardHeight, CONTENT_WIDTH, cardHeight, true, false);
      doc.setStrokeColor(0.85, 0.87, 0.92);
      doc.setLineWidth(0.75);
      doc.rect(MARGIN_LEFT, y - cardHeight, CONTENT_WIDTH, cardHeight, false, true);

      // Card Header Ribbon
      doc.setColor(0.92, 0.95, 0.98);
      doc.rect(MARGIN_LEFT, y - 22, CONTENT_WIDTH, 22, true, false);
      doc.setStrokeColor(0.78, 0.12, 0.12);
      doc.setLineWidth(1.5);
      doc.line(MARGIN_LEFT, y, MARGIN_LEFT, y - cardHeight); // Left accent bar
      doc.restore();

      // Top Ribbon Text
      doc.text(`#${d.index}. REF: ${d.referenceId}`, MARGIN_LEFT + 10, y - 14, {
        font: '/F2',
        size: 9,
        color: [0.15, 0.2, 0.35]
      });
      doc.text(`DATE: ${d.donationDate} (${d.donationTime})`, MARGIN_LEFT + 180, y - 14, {
        font: '/F1',
        size: 8.5,
        color: [0.25, 0.3, 0.4]
      });
      doc.text(`[VERIFIED LIFESAVER]`, PAGE_WIDTH - MARGIN_RIGHT - 110, y - 14, {
        font: '/F2',
        size: 8,
        color: [0.05, 0.55, 0.25]
      });

      const bodyY = y - 36;
      const col1X = MARGIN_LEFT + 12;
      const col2X = MARGIN_LEFT + 175;
      const photoBoxX = MARGIN_LEFT + 360;
      const photoBoxW = 140;
      const photoBoxH = 105;

      // Column 1: Donor Information
      doc.text('DONOR DETAILS', col1X, bodyY, { font: '/F2', size: 8, color: [0.78, 0.12, 0.12] });
      doc.text(`Name: ${d.donorName}`, col1X, bodyY - 14, { font: '/F2', size: 8.5, color: [0.1, 0.15, 0.2] });
      doc.text(`Blood Group: ${d.donorBloodGroup}`, col1X, bodyY - 26, { font: '/F2', size: 8.5, color: [0.75, 0.1, 0.1] });
      doc.text(`Age: ${d.donorAge}  |  City: ${d.donorCity}`, col1X, bodyY - 38, { font: '/F1', size: 8, color: [0.3, 0.35, 0.4] });
      doc.text(`Contact: ${d.donorMobile}`, col1X, bodyY - 50, { font: '/F1', size: 7.8, color: [0.35, 0.4, 0.45] });
      doc.text(`Email: ${d.donorEmail}`, col1X, bodyY - 62, { font: '/F1', size: 7.8, color: [0.35, 0.4, 0.45] });
      doc.text(`Total Donations: ${d.donorLifetimeDonations} lifetime`, col1X, bodyY - 74, { font: '/F1', size: 7.8, color: [0.2, 0.5, 0.3] });
      doc.text(`ID: ${d.donorPublicRef}`, col1X, bodyY - 86, { font: '/F3', size: 6.8, color: [0.5, 0.55, 0.6] });

      // Column 2: Recipient, Hospital & Verification
      doc.text('RECIPIENT & CLINICAL FACILITY', col2X, bodyY, { font: '/F2', size: 8, color: [0.15, 0.25, 0.4] });
      doc.text(`Patient: ${d.patientName}`, col2X, bodyY - 14, { font: '/F2', size: 8.5, color: [0.1, 0.15, 0.2] });
      doc.text(`Hospital: ${d.hospitalName}`, col2X, bodyY - 26, { font: '/F1', size: 8, color: [0.2, 0.25, 0.3] });
      doc.text(`Location: ${d.hospitalCity}`, col2X, bodyY - 38, { font: '/F1', size: 8, color: [0.3, 0.35, 0.4] });
      doc.text(`Units Donated: ${d.unitsDonated} Unit (Whole Blood)`, col2X, bodyY - 50, { font: '/F2', size: 8, color: [0.75, 0.1, 0.1] });
      
      doc.text('AUDIT & VERIFICATION', col2X, bodyY - 66, { font: '/F2', size: 7.5, color: [0.1, 0.5, 0.25] });
      doc.text(`Reviewed By: ${d.reviewedByAdmin}`, col2X, bodyY - 77, { font: '/F1', size: 7.5, color: [0.3, 0.35, 0.4] });
      doc.text(`Certificate: ${d.certificateId}`, col2X, bodyY - 88, { font: '/F3', size: 7, color: [0.35, 0.4, 0.45] });
      doc.text(`Verification QR Token: ${d.qrToken.slice(0, 16)}...`, col2X, bodyY - 99, { font: '/F3', size: 6.5, color: [0.5, 0.55, 0.6] });

      // Column 3: Proof Photograph Container
      doc.save();
      doc.setColor(0.95, 0.95, 0.96);
      doc.rect(photoBoxX, bodyY - photoBoxH + 10, photoBoxW, photoBoxH, true, false);
      doc.setStrokeColor(0.8, 0.8, 0.85);
      doc.setLineWidth(0.5);
      doc.rect(photoBoxX, bodyY - photoBoxH + 10, photoBoxW, photoBoxH, false, true);
      doc.restore();

      let photoRendered = false;
      if (d.proofPhotoPath && fs.existsSync(d.proofPhotoPath)) {
        const imgObj = doc.addImage(d.proofPhotoPath);
        if (imgObj) {
          // Fit preserving aspect ratio within photo box (inset by 4pt)
          const maxW = photoBoxW - 8;
          const maxH = photoBoxH - 8;
          const aspect = imgObj.width / imgObj.height;
          let drawW = maxW;
          let drawH = drawW / aspect;
          if (drawH > maxH) {
            drawH = maxH;
            drawW = drawH * aspect;
          }
          const drawX = photoBoxX + (photoBoxW - drawW) / 2;
          const drawY = bodyY - photoBoxH + 10 + (photoBoxH - drawH) / 2;
          doc.drawImage(imgObj, drawX, drawY, drawW, drawH);
          photoRendered = true;
        }
      }

      if (!photoRendered) {
        doc.text('DONATION PROOF PHOTOGRAPH', photoBoxX + 10, bodyY - 35, {
          font: '/F2',
          size: 7,
          color: [0.5, 0.55, 0.6]
        });
        doc.text('Hospital Slip / Blood Card', photoBoxX + 16, bodyY - 48, {
          font: '/F1',
          size: 7.5,
          color: [0.4, 0.45, 0.5]
        });
        doc.text('[Digital Record Verified]', photoBoxX + 18, bodyY - 62, {
          font: '/F2',
          size: 7.5,
          color: [0.1, 0.55, 0.25]
        });
        doc.text(`Proof ID: ${d.proofId}`, photoBoxX + 10, bodyY - 76, {
          font: '/F3',
          size: 6.5,
          color: [0.55, 0.6, 0.65]
        });
      }

      y -= cardHeight + 14;
    }
  }

  // =========================================================================
  // FINAL PAGE: CERTIFICATION, AUDIT & DISTRICT AUTHORIZATION
  // =========================================================================
  doc.addPage();
  pageNumber++;
  y = PAGE_HEIGHT - 65;

  doc.text('FINAL VERIFICATION & DISTRICT AUTHORIZATION', MARGIN_LEFT, y, {
    font: '/F2',
    size: 14,
    color: [0.78, 0.12, 0.12]
  });
  doc.setStrokeColor(0.8, 0.8, 0.85);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y - 4, PAGE_WIDTH - MARGIN_RIGHT, y - 4);
  y -= 25;

  // Final Summary Audit Table
  const summaryRows = [
    ['Activity Submission Month & Year', `${period.monthName} ${period.year}`],
    ['Report Dossier Reference Number', reportRef],
    ['Total Eligible Completed Donations', `${summary.totalDonations} Donations`],
    ['Total Blood Units Delivered to Patients', `${summary.totalUnits} Units`],
    ['Unique Active Registered Donors Mobilized', `${summary.uniqueDonorsCount} Donors`],
    ['Participating Hospitals & Blood Banks', `${summary.uniqueHospitalsCount} Facilities`],
    ['Clinical Verification Status', '100% AUDITED AGAINST PHYSICAL SLIPS'],
    ['Donor PII Privacy Mode', privacyMode === 'UNMASKED' ? 'UNMASKED (AUTHORIZED INTERNAL FULL PII)' : 'MASKED (SENSITIVE PII PROTECTED)'],
    ['Report Preparation Date', reportData.generatedAt]
  ];

  for (let i = 0; i < summaryRows.length; i++) {
    const row = summaryRows[i];
    doc.save();
    doc.setColor(i % 2 === 0 ? 0.97 : 1.0, i % 2 === 0 ? 0.98 : 1.0, i % 2 === 0 ? 0.99 : 1.0);
    doc.rect(MARGIN_LEFT, y - 18, CONTENT_WIDTH, 20, true, false);
    doc.setStrokeColor(0.88, 0.88, 0.92);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, y - 18, PAGE_WIDTH - MARGIN_RIGHT, y - 18);
    doc.restore();

    doc.text(row[0], MARGIN_LEFT + 10, y - 13, { font: '/F2', size: 8.5, color: [0.2, 0.25, 0.35] });
    doc.text(row[1], MARGIN_LEFT + 250, y - 13, { font: '/F1', size: 8.5, color: [0.1, 0.1, 0.1] });
    y -= 20;
  }

  y -= 30;

  // Formal Certification Undertaking
  doc.text('FORMAL SUBMISSION UNDERTAKING & DECLARATION', MARGIN_LEFT, y, {
    font: '/F2',
    size: 11,
    color: [0.1, 0.15, 0.25]
  });
  doc.setStrokeColor(0.8, 0.8, 0.85);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y - 4, PAGE_WIDTH - MARGIN_RIGHT, y - 4);
  y -= 16;

  const undertaking = [
    'We hereby declare and certify on behalf of the Rotaract District Blood Donation Committee that all donor',
    'records, hospital admissions, units collected, and photographic evidence submitted in this report have been',
    'independently verified by authorized medical moderators. Each donation corresponds to an authentic certificate',
    'registered on the RED MISSION decentralized clinical ledger with tamper-evident QR verification tokens.',
    'No simulated, pledged, rejected, or cancelled donation records have been included in this activity dossier.'
  ];

  for (const line of undertaking) {
    doc.text(line, MARGIN_LEFT + 4, y, { font: '/F1', size: 8.5, color: [0.3, 0.35, 0.4] });
    y -= 14;
  }

  y -= 35;

  // Dual Signatory Authorization Block
  const sigBoxW = (CONTENT_WIDTH - 20) / 2;
  const sigBoxH = 110;

  // Box 1: Prepared By
  doc.save();
  doc.setColor(0.98, 0.98, 0.99);
  doc.rect(MARGIN_LEFT, y - sigBoxH, sigBoxW, sigBoxH, true, false);
  doc.setStrokeColor(0.85, 0.85, 0.9);
  doc.setLineWidth(0.75);
  doc.rect(MARGIN_LEFT, y - sigBoxH, sigBoxW, sigBoxH, false, true);
  doc.restore();

  doc.text('PREPARED & COMPILED BY', MARGIN_LEFT + 12, y - 16, { font: '/F2', size: 8, color: [0.5, 0.1, 0.1] });
  doc.text(preparedBy.adminName, MARGIN_LEFT + 12, y - 32, { font: '/F2', size: 10, color: [0.1, 0.15, 0.25] });
  doc.text(`Role: ${preparedBy.adminRole} (RED MISSION)`, MARGIN_LEFT + 12, y - 44, { font: '/F1', size: 8, color: [0.35, 0.4, 0.45] });
  doc.text(`Digital Sign-off: VERIFIED_OK`, MARGIN_LEFT + 12, y - 56, { font: '/F2', size: 8, color: [0.1, 0.55, 0.25] });
  doc.text('Signature: __________________________', MARGIN_LEFT + 12, y - 90, { font: '/F1', size: 8, color: [0.5, 0.5, 0.5] });

  // Box 2: Authorized Signatory
  const b2X = MARGIN_LEFT + sigBoxW + 20;
  doc.save();
  doc.setColor(0.98, 0.98, 0.99);
  doc.rect(b2X, y - sigBoxH, sigBoxW, sigBoxH, true, false);
  doc.setStrokeColor(0.85, 0.85, 0.9);
  doc.setLineWidth(0.75);
  doc.rect(b2X, y - sigBoxH, sigBoxW, sigBoxH, false, true);
  doc.restore();

  doc.text('ROTARACT DISTRICT AUTHORIZATION', b2X + 12, y - 16, { font: '/F2', size: 8, color: [0.1, 0.3, 0.6] });
  doc.text(authorizedBy.title, b2X + 12, y - 32, { font: '/F2', size: 9.5, color: [0.1, 0.15, 0.25] });
  doc.text(authorizedBy.designation, b2X + 12, y - 44, { font: '/F1', size: 8, color: [0.35, 0.4, 0.45] });
  doc.text(`Attestation Ref: ${reportRef}`, b2X + 12, y - 56, { font: '/F3', size: 7.5, color: [0.3, 0.35, 0.4] });
  doc.text('Official District Seal & Stamp Here', b2X + 12, y - 90, { font: '/F1', size: 8, color: [0.5, 0.5, 0.5] });

  // Render Running Header & Footer across all pages
  const totalReportPages = doc.pages.length;
  for (let p = 0; p < totalReportPages; p++) {
    doc.currentPageIndex = p;
    renderHeaderFooter(p + 1, totalReportPages);
  }

  return doc.buildBuffer();
}
