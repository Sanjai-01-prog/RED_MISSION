import { config } from '../config/env.js';
import { verifyOtp } from './crypto.js';

/**
 * Normalizes an Indian mobile number to a strict 10-digit format.
 * Accepts formats like: +919876543210, 919876543210, 09876543210, or 9876543210.
 * Returns a 10-digit string starting with 6-9, or null if invalid.
 */
export function normalizeIndianMobile(rawMobile) {
  if (!rawMobile || typeof rawMobile !== 'string') return null;
  
  // Remove spaces, hyphens, parentheses, and leading plus
  let cleaned = rawMobile.replace(/[\s\-\(\)\+]/g, '');

  // Strip international country code +91 or 91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  }
  // Strip leading zero (STD prefix)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Must be exactly 10 digits starting with 6, 7, 8, or 9 (TRAI standard)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Masks a mobile number for safe diagnostic logging (e.g. "+91 ******3210").
 * Never logs complete phone numbers to avoid privacy leakage.
 */
export function maskMobileNumber(mobile) {
  if (!mobile || typeof mobile !== 'string') return 'UNKNOWN';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last4 = digits.slice(-4);
    return `+91 ******${last4}`;
  }
  return '******';
}

/**
 * Extracts a human-readable error message from Fast2SMS JSON responses.
 */
function extractFast2SmsMessage(data, fallback = 'Fast2SMS request failed') {
  if (!data) return fallback;
  if (Array.isArray(data.message) && data.message.length > 0) {
    return data.message.join(', ');
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }
  return fallback;
}

/**
 * Dispatches an SMS OTP to a recipient mobile number using Fast2SMS or Demo Gateway.
 */
export async function sendSms({ mobileNumber, message, otp = null }) {
  const timestamp = new Date().toISOString();
  const cleanMobile = normalizeIndianMobile(mobileNumber);

  if (!cleanMobile) {
    return {
      success: false,
      error: 'Please provide a valid 10-digit Indian mobile number (e.g., 9876543210).',
      timestamp
    };
  }

  // ========================================================
  // 1. FAST2SMS INTEGRATION (Smart OTP Route)
  // ========================================================
  if (config.SMS_PROVIDER === 'FAST2SMS') {
    if (!config.FAST2SMS_API_KEY || !config.FAST2SMS_API_KEY.trim()) {
      return {
        success: false,
        error: 'Fast2SMS API key (FAST2SMS_API_KEY) is not configured in server environment.',
        timestamp
      };
    }

    if (!config.FAST2SMS_OTP_ID || !config.FAST2SMS_OTP_ID.trim()) {
      return {
        success: false,
        error: 'Fast2SMS Smart OTP Template ID (FAST2SMS_OTP_ID) is not configured in server environment.',
        timestamp
      };
    }

    const payload = {
      mobile: cleanMobile,
      otp_id: config.FAST2SMS_OTP_ID.trim()
    };

    // If custom OTP injection is explicitly enabled in config
    if (config.FAST2SMS_CUSTOM_OTP && otp) {
      payload.otp = String(otp).trim();
    }

    const endpoint = config.FAST2SMS_SEND_URL || 'https://www.fast2sms.com/dev/otp/send';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': config.FAST2SMS_API_KEY.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (response.status === 200 && data && (data.return === true || data.status_code === 200)) {
        console.log(`[FAST2SMS SUCCESS] OTP request accepted for ${maskMobileNumber(cleanMobile)} (Request ID: ${data.request_id || 'N/A'})`);
        return {
          success: true,
          provider: 'FAST2SMS',
          requestId: data.request_id || null,
          message: extractFast2SmsMessage(data, 'OTP sent successfully'),
          demoOtp: null, // NEVER exposed in production or real SMS mode!
          timestamp
        };
      }

      if (response.status === 401) {
        console.error('[FAST2SMS ERROR] HTTP 401 Unauthorized: Invalid FAST2SMS_API_KEY');
        return {
          success: false,
          error: 'Fast2SMS authorization failed: Invalid API Key. Please verify FAST2SMS_API_KEY in server environment.',
          timestamp
        };
      }

      const failureReason = extractFast2SmsMessage(data, `Provider rejected request with HTTP status ${response.status}`);
      console.error(`[FAST2SMS ERROR] HTTP ${response.status}: ${failureReason}`);
      return {
        success: false,
        error: `Fast2SMS delivery error: ${failureReason}`,
        timestamp
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('[FAST2SMS ERROR] Request timed out after 10000ms');
        return {
          success: false,
          error: 'Fast2SMS gateway timed out. Please try again.',
          timestamp
        };
      }

      console.error('[FAST2SMS NETWORK ERROR]', err.message);
      return {
        success: false,
        error: `Unable to connect to Fast2SMS gateway: ${err.message}`,
        timestamp
      };
    }
  }

  // ========================================================
  // 2. DEMO SMS PROVIDER (Local Development & Testing Only)
  // ========================================================
  if (config.SMS_PROVIDER === 'DEMO') {
    if (config.IS_PROD) {
      console.error('[SECURITY ALERT] DEMO SMS provider attempted in production mode!');
      return {
        success: false,
        error: 'Security Error: Demo SMS OTP is disabled in production mode. Configure FAST2SMS credentials.',
        timestamp
      };
    }

    console.log(`\n======================================================`);
    console.log(`[DEV SMS GATEWAY] To: ${cleanMobile}`);
    console.log(`[MESSAGE]: ${message}`);
    if (otp) {
      console.log(`[DEMO OTP CODE]: ${otp} (Valid for ${config.OTP_EXPIRY_MINUTES} mins)`);
    }
    console.log(`======================================================\n`);

    return {
      success: true,
      provider: 'DEMO',
      demoOtp: otp, // Only populated in non-production development mode
      timestamp
    };
  }

  // Unsupported provider fallback
  return {
    success: false,
    error: `Unsupported SMS provider: "${config.SMS_PROVIDER}". Supported providers are FAST2SMS and DEMO.`,
    timestamp
  };
}

/**
 * Verifies an entered mobile OTP code.
 * If provider is FAST2SMS, calls Fast2SMS /dev/otp/verify.
 * If provider is DEMO, checks HMAC-SHA256 salted hash locally.
 */
export async function verifyMobileOtp({ mobileNumber, otp, salt = null, hash = null }) {
  if (!otp || typeof otp !== 'string' || !otp.trim()) {
    return { success: false, error: 'Please enter the verification code.' };
  }

  const cleanMobile = normalizeIndianMobile(mobileNumber);
  if (!cleanMobile) {
    return { success: false, error: 'Invalid mobile number format.' };
  }

  const cleanOtp = otp.trim();

  // Fast2SMS verification
  if (config.SMS_PROVIDER === 'FAST2SMS') {
    // Mode A: Custom OTP mode enabled (FAST2SMS_CUSTOM_OTP=true)
    // In this mode, RED MISSION generated the OTP, sent it via Fast2SMS, and verifies that same locally generated OTP
    if (config.FAST2SMS_CUSTOM_OTP) {
      if (!salt || !hash || salt === 'FAST2SMS_MANAGED' || hash === 'FAST2SMS_MANAGED') {
        return { success: false, error: 'Missing security verification parameters.' };
      }
      const isValid = verifyOtp(cleanOtp, salt, hash);
      if (!isValid) {
        return { success: false, error: 'Incorrect verification code.' };
      }
      return { success: true, message: 'OTP verified successfully.' };
    }

    // Mode B: Fast2SMS-generated OTP mode (FAST2SMS_CUSTOM_OTP=false, Default)
    // Fast2SMS generated the OTP on /dev/otp/send.
    // Verify strictly with Fast2SMS /dev/otp/verify without comparing against any separately generated local OTP.
    if (!config.FAST2SMS_API_KEY || !config.FAST2SMS_API_KEY.trim()) {
      return { success: false, error: 'Fast2SMS API key is not configured.' };
    }

    const endpoint = config.FAST2SMS_VERIFY_URL || 'https://www.fast2sms.com/dev/otp/verify';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': config.FAST2SMS_API_KEY.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          mobile: cleanMobile,
          otp: cleanOtp
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (response.status === 200 && data && (data.return === true || data.status_code === 200)) {
        return { success: true, message: 'OTP verified successfully.' };
      }

      if (response.status === 404) {
        return { success: false, error: 'Verification code not found or expired. Please request a new code.' };
      }

      const errorMsg = extractFast2SmsMessage(data, 'Incorrect or expired verification code.');
      return { success: false, error: errorMsg };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Verification timed out. Please try again.' };
      }
      return { success: false, error: `Verification network error: ${err.message}` };
    }
  }

  // DEMO verification (Development mode)
  if (config.SMS_PROVIDER === 'DEMO') {
    if (config.IS_PROD) {
      return { success: false, error: 'Demo OTP verification is not permitted in production mode.' };
    }

    if (!salt || !hash) {
      return { success: false, error: 'Missing security verification parameters.' };
    }

    const isValid = verifyOtp(cleanOtp, salt, hash);
    if (!isValid) {
      return { success: false, error: 'Incorrect verification code.' };
    }

    return { success: true };
  }

  return { success: false, error: `Verification unsupported for SMS provider: ${config.SMS_PROVIDER}` };
}
