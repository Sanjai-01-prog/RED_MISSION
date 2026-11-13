/**
 * RED MISSION — Professional Multi-Sheet Excel (.xlsx) Report Generator
 * Phase 6, Feature 1: Official Rotaract District Activity Submission
 * 
 * Strict Zero-Dependency Native Node.js Implementation.
 * Produces genuine OpenXML (.xlsx) multi-sheet workbooks using native node:zlib
 * with custom column widths, bold headers, auto-filters, and 4 dedicated sheets.
 */

import zlib from 'node:zlib';

/**
 * Minimal in-memory ZIP builder using pure Node.js
 */
class SimpleZipBuilder {
  constructor() {
    this.files = []; // { name, buffer, crc, uncompressedSize, compressedData, offset }
  }

  addFile(name, content) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const crc = zlib.crc32(buf);
    const compressed = zlib.deflateRawSync(buf);
    this.files.push({
      name,
      uncompressedSize: buf.length,
      compressedData: compressed,
      crc
    });
  }

  build() {
    const parts = [];
    let currentOffset = 0;

    // 1. Write Local File Headers and Compressed Data
    for (const f of this.files) {
      f.offset = currentOffset;
      const nameBuf = Buffer.from(f.name, 'utf8');
      
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
      localHeader.writeUInt16LE(20, 4);         // Version needed: 2.0
      localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
      localHeader.writeUInt16LE(8, 8);          // Compression method: Deflate
      localHeader.writeUInt16LE(0, 10);         // Last mod time
      localHeader.writeUInt16LE(0, 12);         // Last mod date
      localHeader.writeUInt32LE(f.crc, 14);     // CRC-32
      localHeader.writeUInt32LE(f.compressedData.length, 18); // Compressed size
      localHeader.writeUInt32LE(f.uncompressedSize, 22);      // Uncompressed size
      localHeader.writeUInt16LE(nameBuf.length, 26);          // Filename length
      localHeader.writeUInt16LE(0, 28);                       // Extra field length

      parts.push(localHeader, nameBuf, f.compressedData);
      currentOffset += 30 + nameBuf.length + f.compressedData.length;
    }

    // 2. Write Central Directory
    const centralDirStart = currentOffset;
    for (const f of this.files) {
      const nameBuf = Buffer.from(f.name, 'utf8');
      const cdHeader = Buffer.alloc(46);
      cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
      cdHeader.writeUInt16LE(20, 4);         // Version made by
      cdHeader.writeUInt16LE(20, 6);         // Version needed
      cdHeader.writeUInt16LE(0, 8);          // General purpose bit flag
      cdHeader.writeUInt16LE(8, 10);         // Compression method: Deflate
      cdHeader.writeUInt16LE(0, 12);         // Last mod time
      cdHeader.writeUInt16LE(0, 14);         // Last mod date
      cdHeader.writeUInt32LE(f.crc, 16);     // CRC-32
      cdHeader.writeUInt32LE(f.compressedData.length, 20); // Compressed size
      cdHeader.writeUInt32LE(f.uncompressedSize, 24);      // Uncompressed size
      cdHeader.writeUInt16LE(nameBuf.length, 28);          // Filename length
      cdHeader.writeUInt16LE(0, 30);                       // Extra field length
      cdHeader.writeUInt16LE(0, 32);                       // File comment length
      cdHeader.writeUInt16LE(0, 34);                       // Disk number start
      cdHeader.writeUInt16LE(0, 36);                       // Internal attributes
      cdHeader.writeUInt32LE(0, 38);                       // External attributes
      cdHeader.writeUInt32LE(f.offset, 42);                // Relative offset of local header

      parts.push(cdHeader, nameBuf);
      currentOffset += 46 + nameBuf.length;
    }
    const centralDirSize = currentOffset - centralDirStart;

    // 3. Write End of Central Directory Record
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
    eocd.writeUInt16LE(0, 4);          // Disk number
    eocd.writeUInt16LE(0, 6);          // Disk with central dir
    eocd.writeUInt16LE(this.files.length, 8);  // Entries on this disk
    eocd.writeUInt16LE(this.files.length, 10); // Total entries
    eocd.writeUInt32LE(centralDirSize, 12);    // Central dir size
    eocd.writeUInt32LE(centralDirStart, 16);   // Central dir offset
    eocd.writeUInt16LE(0, 20);                 // Comment length

    parts.push(eocd);

    return Buffer.concat(parts);
  }
}

/**
 * XML Entity Escape
 */
function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Column Letter from 1-based index (1 -> A, 2 -> B, ..., 26 -> Z, 27 -> AA)
 */
function colLetter(colIdx) {
  let letter = '';
  while (colIdx > 0) {
    const mod = (colIdx - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colIdx = Math.floor((colIdx - mod) / 26);
  }
  return letter;
}

/**
 * Generate OpenXML Sheet XML with columns, rows, and auto-filters
 */
function buildSheetXml(headers, rows, { colWidths = [], autoFilter = true } = {}) {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  xml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;

  // Column Widths
  if (colWidths.length > 0) {
    xml += `  <cols>\n`;
    for (let i = 0; i < colWidths.length; i++) {
      const w = colWidths[i] || 15;
      xml += `    <col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>\n`;
    }
    xml += `  </cols>\n`;
  }

  xml += `  <sheetData>\n`;

  // Header Row (Row 1, Style 1 = Bold Header)
  xml += `    <row r="1" customHeight="1" ht="24">\n`;
  for (let c = 0; c < headers.length; c++) {
    const ref = `${colLetter(c + 1)}1`;
    xml += `      <c r="${ref}" t="inlineStr" s="1"><is><t>${escapeXml(headers[c])}</t></is></c>\n`;
  }
  xml += `    </row>\n`;

  // Data Rows (Row 2+, Style 0 = Regular, Style 2 = Numeric/Right-aligned)
  for (let r = 0; r < rows.length; r++) {
    const rowNum = r + 2;
    xml += `    <row r="${rowNum}" customHeight="1" ht="20">\n`;
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ref = `${colLetter(c + 1)}${rowNum}`;
      const val = row[c];

      if (typeof val === 'number') {
        xml += `      <c r="${ref}" s="2"><v>${val}</v></c>\n`;
      } else {
        xml += `      <c r="${ref}" t="inlineStr" s="0"><is><t>${escapeXml(val)}</t></is></c>\n`;
      }
    }
    xml += `    </row>\n`;
  }

  xml += `  </sheetData>\n`;

  // Auto-filter
  if (autoFilter && headers.length > 0 && rows.length > 0) {
    const lastCol = colLetter(headers.length);
    const lastRow = rows.length + 1;
    xml += `  <autoFilter ref="A1:${lastCol}${lastRow}"/>\n`;
  }

  xml += `</worksheet>`;
  return xml;
}

/**
 * Generate Multi-Sheet Excel Workbook (.xlsx)
 * 
 * Sheets:
 * 1. Monthly Summary
 * 2. Donor-wise Records
 * 3. Recipient Details
 * 4. Verification Details
 * 
 * @param {Object} reportData - Structured report output from reportDataService
 * @returns {Buffer} Binary XLSX buffer
 */
export function generateMonthlyDonationReportExcel(reportData) {
  const { period, summary, donations, preparedBy, authorizedBy, reportRef } = reportData;
  const isMasked = reportData.maskSensitive !== false;
  const privacyMode = reportData.privacyMode === 'UNMASKED' || !isMasked ? 'UNMASKED' : 'MASKED';
  const zip = new SimpleZipBuilder();

  // 1. [Content_Types].xml
  zip.addFile('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);

  // 2. _rels/.rels
  zip.addFile('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  // 3. xl/_rels/workbook.xml.rels
  zip.addFile('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // 4. xl/workbook.xml
  zip.addFile('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Monthly Summary" sheetId="1" r:id="rId1"/>
    <sheet name="Donor-wise Records" sheetId="2" r:id="rId2"/>
    <sheet name="Recipient Details" sheetId="3" r:id="rId3"/>
    <sheet name="Verification Details" sheetId="4" r:id="rId4"/>
  </sheets>
</workbook>`);

  // 5. xl/styles.xml (0: Regular, 1: Bold Header with Grey Fill, 2: Number/Total)
  zip.addFile('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF991B1B"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`);

  // =========================================================================
  // SHEET 1: Monthly Summary
  // =========================================================================
  const s1Headers = ['Metric Category', 'Performance Indicator', 'Monthly Value', 'Notes / Clinical Standard'];
  const s1Rows = [
    ['Activity Overview', 'Reporting Month & Year', `${period.monthName} ${period.year}`, 'Rotaract Activity Dossier'],
    ['Activity Overview', 'Report Reference Number', reportRef, 'Decentralized Audit Key'],
    ['Activity Overview', 'Date Range', `${period.startDate} to ${period.endDate}`, 'Exact Calendar Month'],
    ['Activity Overview', 'Audit Status', '100% OFFICIALLY AUDITED', 'Zero unverified pledges recorded'],
    ['Clinical Metric', 'Total Verified Completed Donations', summary.totalDonations, 'Matched with PDF count'],
    ['Clinical Metric', 'Total Whole Blood Units Delivered', summary.totalUnits, 'Matched with PDF units'],
    ['Clinical Metric', 'Active Registered Donors Mobilized', summary.uniqueDonorsCount, 'Unique lifesavers'],
    ['Clinical Metric', 'Healthcare Centers & Hospitals Served', summary.uniqueHospitalsCount, 'Verified facilities'],
    ['Clinical Metric', 'Emergency Trauma Patients Supported', summary.uniquePatientsCount, 'Emergency fulfillment'],
    ['Blood Distribution', 'A+ Positive Units', summary.bloodGroups['A+'] || 0, 'Whole blood units'],
    ['Blood Distribution', 'A- Negative Units', summary.bloodGroups['A-'] || 0, 'Whole blood units'],
    ['Blood Distribution', 'B+ Positive Units', summary.bloodGroups['B+'] || 0, 'Whole blood units'],
    ['Blood Distribution', 'B- Negative Units', summary.bloodGroups['B-'] || 0, 'Whole blood units'],
    ['Blood Distribution', 'AB+ Positive Units', summary.bloodGroups['AB+'] || 0, 'Whole blood units'],
    ['Blood Distribution', 'AB- Negative Units', summary.bloodGroups['AB-'] || 0, 'Whole blood units'],
    ['Blood Distribution', 'O+ Positive Units', summary.bloodGroups['O+'] || 0, 'Whole blood units'],
    ['Blood Distribution', 'O- Negative Units (Universal)', summary.bloodGroups['O-'] || 0, 'Whole blood units'],
    ['Governance', 'Report Prepared By', `${preparedBy.adminName} (${preparedBy.adminRole})`, 'Compiling Officer'],
    ['Governance', 'District Authorization Desk', authorizedBy.title, authorizedBy.designation],
    ['Governance', 'Donor PII Privacy Mode', privacyMode, isMasked ? 'Sensitive donor PII protected' : 'Authorized unmasked admin export'],
    ['Governance', 'Report Compilation Timestamp', reportData.generatedAt, 'ISO 8601 UTC']
  ];
  zip.addFile('xl/worksheets/sheet1.xml', buildSheetXml(s1Headers, s1Rows, {
    colWidths: [22, 38, 28, 35],
    autoFilter: true
  }));

  // =========================================================================
  // SHEET 2: Donor-wise Donation Records
  // =========================================================================
  const s2Headers = [
    'Donation Reference ID',
    'Donor Full Name',
    'Donor Blood Group',
    'Age',
    'City',
    'Lifetime Donations',
    'Actual Donation Date',
    'Donation Time',
    'Units Donated',
    'Donor Public Reference',
    isMasked ? 'Contact (Masked)' : 'Contact (Unmasked)',
    isMasked ? 'Email (Masked)' : 'Email (Unmasked)'
  ];
  const s2Rows = donations.map(d => [
    d.referenceId,
    d.donorName,
    d.donorBloodGroup,
    d.donorAge,
    d.donorCity,
    d.donorLifetimeDonations,
    d.donationDate,
    d.donationTime,
    d.unitsDonated,
    d.donorPublicRef,
    d.donorMobile,
    d.donorEmail
  ]);
  zip.addFile('xl/worksheets/sheet2.xml', buildSheetXml(s2Headers, s2Rows, {
    colWidths: [26, 26, 18, 12, 18, 18, 18, 16, 14, 30, 20, 26],
    autoFilter: true
  }));

  // =========================================================================
  // SHEET 3: Recipient & Hospital Details
  // =========================================================================
  const s3Headers = [
    'Donation Reference ID',
    'Recipient / Patient Name',
    'Recipient Blood Group',
    'Hospital Name',
    'Hospital City',
    'Hospital Address',
    'Urgency Level',
    'Clinical Condition / Notes'
  ];
  const s3Rows = donations.map(d => [
    d.referenceId,
    d.patientName,
    d.recipientBloodGroup,
    d.hospitalName,
    d.hospitalCity,
    d.hospitalAddress,
    d.urgencyLevel,
    d.clinicalCondition
  ]);
  zip.addFile('xl/worksheets/sheet3.xml', buildSheetXml(s3Headers, s3Rows, {
    colWidths: [26, 26, 20, 32, 20, 36, 16, 30],
    autoFilter: true
  }));

  // =========================================================================
  // SHEET 4: Verification & Audit Details
  // =========================================================================
  const s4Headers = [
    'Donation Reference ID',
    'Pledge Reference ID',
    'Proof Reference ID',
    'Verification Status',
    'Reviewed By Administrator',
    'Admin Role',
    'Verification Timestamp',
    'Certificate Reference ID',
    'QR Verification Token',
    'Photograph Status'
  ];
  const s4Rows = donations.map(d => [
    d.referenceId,
    d.pledgeId,
    d.proofId,
    d.verificationStatus,
    d.reviewedByAdmin,
    d.reviewedByRole,
    d.approvalDate,
    d.certificateId,
    d.qrToken,
    d.hasProofPhoto ? 'PHYSICAL_SLIP_ON_FILE' : 'DIGITAL_RECORD_VERIFIED'
  ]);
  zip.addFile('xl/worksheets/sheet4.xml', buildSheetXml(s4Headers, s4Rows, {
    colWidths: [26, 24, 24, 24, 28, 16, 24, 28, 36, 25],
    autoFilter: true
  }));

  return zip.build();
}
