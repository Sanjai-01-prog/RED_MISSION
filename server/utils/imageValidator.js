/**
 * Image Validation Utility
 * Validates Base64 image payloads for donor selfie uploads without external dependencies.
 * Enforces magic bytes verification, format restrictions (JPEG, PNG, WebP),
 * maximum decoded byte size (3 MiB), and header dimension limits.
 */

import { config } from '../config/env.js';

export function parseImageDimensions(buf, format) {
  try {
    if (format === 'png' && buf.length >= 24) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return { width, height };
    }
    if (format === 'jpeg') {
      let offset = 2;
      while (offset < buf.length - 8) {
        // Skip fill 0xFF padding bytes cleanly
        while (offset < buf.length && buf[offset] !== 0xFF) offset++;
        while (offset < buf.length && buf[offset] === 0xFF) offset++;
        if (offset >= buf.length) break;
        const marker = buf[offset];
        offset += 1;
        // Standalone markers (TEM 0x01, RST0..RST7 0xD0..0xD7, SOI 0xD8, EOI 0xD9) carry no length field
        if (marker === 0x00 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) {
          continue;
        }
        // Start of Frame markers (except DHT 0xC4, JPG 0xC8, DAC 0xCC)
        if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          if (offset + 6 < buf.length) {
            const height = buf.readUInt16BE(offset + 3);
            const width = buf.readUInt16BE(offset + 5);
            return { width, height };
          }
          break;
        }
        if (offset + 1 >= buf.length) break;
        const len = buf.readUInt16BE(offset);
        if (len < 2) break;
        offset += len;
      }
    }
    if (format === 'webp') {
      if (buf.length >= 30) {
        const tag = buf.toString('ascii', 12, 16);
        if (tag === 'VP8 ') {
          const width = buf.readUInt16LE(26) & 0x3fff;
          const height = buf.readUInt16LE(28) & 0x3fff;
          return { width, height };
        } else if (tag === 'VP8L') {
          const b1 = buf[21];
          const b2 = buf[22];
          const b3 = buf[23];
          const b4 = buf[24];
          const width = 1 + (((b2 & 0x3f) << 8) | b1);
          const height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
          return { width, height };
        } else if (tag === 'VP8X') {
          const width = 1 + buf.readUIntLE(24, 3);
          const height = 1 + buf.readUIntLE(27, 3);
          return { width, height };
        }
      }
    }
  } catch (e) {
    // Dimension extraction failure is non-fatal if format is valid
  }
  return { width: 0, height: 0 };
}

export function validateImagePayload(payloadStr, {
  maxSize = config.MAX_SELFIE_SIZE_BYTES || 3 * 1024 * 1024,
  minDim = 1,
  maxDim = 4096,
  requireDimensions = false
} = {}) {
  let buffer;
  if (Buffer.isBuffer(payloadStr)) {
    buffer = payloadStr;
  } else {
    if (!payloadStr || typeof payloadStr !== 'string') {
      return { valid: false, error: 'Image payload is required.' };
    }

    // Strip Data URI prefix if present (supports standard, parameterized, or empty-MIME prefixes; magic bytes still validated below)
    let cleanBase64 = payloadStr.trim();
    const dataUriMatch = cleanBase64.match(/^data:[^,]*;base64,(.+)$/is);
    if (dataUriMatch) {
      cleanBase64 = dataUriMatch[1].trim();
    }

    // Verify Base64 character set
    const stripped = cleanBase64.replace(/\s+/g, '');
    if (stripped.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(stripped)) {
      return { valid: false, error: 'Invalid Base64 image encoding.' };
    }

    // Base64 padding check
    if (stripped.length % 4 !== 0) {
      return { valid: false, error: 'Malformed or truncated Base64 image data.' };
    }

    try {
      buffer = Buffer.from(stripped, 'base64');
    } catch (e) {
      return { valid: false, error: 'Failed to decode Base64 image data.' };
    }
  }

  if (buffer.length === 0) {
    return { valid: false, error: 'Decoded image payload is empty.' };
  }

  if (buffer.length > maxSize) {
    const limitMiB = (maxSize / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
    return {
      valid: false,
      error: `Decoded image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MiB) exceeds the ${limitMiB} MiB limit.`
    };
  }

  // Magic bytes / File signature verification
  let format = null;
  let mime = null;
  let ext = null;

  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    format = 'jpeg';
    mime = 'image/jpeg';
    ext = '.jpg';
  } else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    format = 'png';
    mime = 'image/png';
    ext = '.png';
  } else if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    format = 'webp';
    mime = 'image/webp';
    ext = '.webp';
  } else {
    return {
      valid: false,
      error: 'Unsupported or corrupted image format. Only JPEG, PNG, and WebP images are permitted.'
    };
  }

  // Dimension abuse & structural header validation
  const dims = parseImageDimensions(buffer, format);
  if (requireDimensions) {
    if (format === 'png' && (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR')) {
      return {
        valid: false,
        error: 'Corrupted or incomplete PNG image header. Please upload a valid JPEG, PNG, or WebP photograph.'
      };
    }
    if (!dims.width || !dims.height || dims.width <= 0 || dims.height <= 0) {
      return {
        valid: false,
        error: 'Corrupted or unreadable image file. Please upload a valid JPEG, PNG, or WebP photograph.'
      };
    }
  }
  if (dims.width > 0 && dims.height > 0) {
    if (dims.width < minDim || dims.height < minDim) {
      return {
        valid: false,
        error: `Image dimensions (${dims.width}x${dims.height}) are too small. Minimum dimension is ${minDim}x${minDim}.`
      };
    }
    if (dims.width > maxDim || dims.height > maxDim) {
      return {
        valid: false,
        error: `Image dimensions (${dims.width}x${dims.height}) exceed maximum allowed dimension of ${maxDim}x${maxDim}.`
      };
    }
  }

  return {
    valid: true,
    buffer,
    format,
    mime,
    ext,
    sizeBytes: buffer.length,
    width: dims.width,
    height: dims.height
  };
}
