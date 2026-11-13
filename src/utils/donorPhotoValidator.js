export const ALLOWED_DONOR_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_DONOR_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MiB

/**
 * Validates and prepares a user-selected image file for donor profile upload.
 * Verifies file non-emptiness, MIME allowlist, size limit, and actual Image() decoding.
 */
export function validateAndPrepareDonorPhoto(file, { maxBytes = MAX_DONOR_PHOTO_BYTES, maxDimension = 1024 } = {}) {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ valid: false, error: 'Please select a donor profile photograph.' });
      return;
    }

    if (typeof file.size === 'number' && file.size <= 0) {
      resolve({ valid: false, error: 'The selected image file is empty.' });
      return;
    }

    if (!ALLOWED_DONOR_PHOTO_MIME_TYPES.includes(file.type)) {
      resolve({ valid: false, error: 'Please choose a valid JPEG, PNG, or WebP image file.' });
      return;
    }

    if (file.size > maxBytes) {
      resolve({
        valid: false,
        error: `Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 3 MB maximum limit.`
      });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ valid: false, error: 'Failed to read the selected image file.' });
    };

    reader.onload = (event) => {
      const rawDataUrl = event.target?.result;
      if (!rawDataUrl || typeof rawDataUrl !== 'string') {
        resolve({ valid: false, error: 'Unable to read image data.' });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve({
          valid: false,
          error: 'The selected file could not be decoded as a valid image. It may be corrupted or not an image.'
        });
      };

      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) {
          resolve({ valid: false, error: 'Image dimensions are invalid or zero.' });
          return;
        }

        if (img.naturalWidth <= maxDimension && img.naturalHeight <= maxDimension) {
          resolve({
            valid: true,
            dataUrl: rawDataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
            mime: file.type,
            sizeBytes: file.size
          });
          return;
        }

        try {
          const canvas = document.createElement('canvas');
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w >= h) {
            h = Math.max(1, Math.round((h * maxDimension) / w));
            w = maxDimension;
          } else {
            w = Math.max(1, Math.round((w * maxDimension) / h));
            h = maxDimension;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          let outUrl = canvas.toDataURL('image/webp', 0.88);
          if (!outUrl.startsWith('data:image/webp')) {
            outUrl = canvas.toDataURL('image/jpeg', 0.88);
          }

          resolve({
            valid: true,
            dataUrl: outUrl,
            width: w,
            height: h,
            mime: outUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
            sizeBytes: file.size
          });
        } catch {
          resolve({ valid: false, error: 'Failed to process oversized image dimensions.' });
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
