import assert from 'node:assert';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { app, server } from '../index.js';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import { hashPassword } from '../utils/crypto.js';
import { calculateAgeFromDob } from '../services/donorAvailabilityService.js';

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

class MockRequest extends Readable {
  constructor(method, url, headers, bodyBuffer) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.socket = { remoteAddress: '127.0.0.1' };
    this._bodyBuffer = bodyBuffer;
    this._pushed = false;
  }
  _read() {
    if (!this._pushed) {
      this._pushed = true;
      if (this._bodyBuffer && this._bodyBuffer.length > 0) {
        this.push(this._bodyBuffer);
      }
      this.push(null);
    }
  }
}

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.body = '';
  }
  setHeader(k, v) {
    this.headers[k.toLowerCase()] = v;
  }
  getHeader(k) {
    return this.headers[k.toLowerCase()];
  }
  writeHead(code, headers) {
    this.statusCode = code;
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        this.headers[k.toLowerCase()] = v;
      }
    }
    return this;
  }
  write(chunk) {
    if (chunk) this.body += chunk.toString();
  }
  end(chunk) {
    if (chunk) this.body += chunk.toString();
    this.emit('finish');
  }
}

function dispatchRequest(method, url, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    let bodyBuffer = null;
    const reqHeaders = { host: 'localhost', ...headers };
    if (body !== null && body !== undefined) {
      const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
      bodyBuffer = Buffer.from(bodyStr, 'utf8');
      if (!reqHeaders['content-type'] && !reqHeaders['Content-Type']) {
        reqHeaders['content-type'] = 'application/json';
      }
      reqHeaders['content-length'] = bodyBuffer.length;
    } else {
      reqHeaders['content-length'] = 0;
    }

    const req = new MockRequest(method, url, reqHeaders, bodyBuffer);
    const res = new MockResponse();

    res.once('finish', () => {
      let json = null;
      try {
        json = JSON.parse(res.body);
      } catch {}
      resolve({
        status: res.statusCode,
        headers: res.headers,
        body: res.body,
        json
      });
    });

    app.handle(req, res).catch(reject);
  });
}

console.log('================================================================');
console.log('RED MISSION — MANDATORY PROFILE COMPLETION VERIFICATION SUITE');
console.log('================================================================\n');

const db = getDatabase();

async function main() {
  const commonPassword = 'Password123!';
  const { hash, salt } = hashPassword(commonPassword);

  // Helper to create test user directly in DB
  function createTestUser({ id, email, mobile, dob = null, gender = null, age = 25, fullName = 'Test User' }) {
    db.prepare('DELETE FROM users WHERE email = ? OR mobile_number = ? OR id = ?').run(email, mobile, id);
    db.prepare(`
      INSERT INTO users (
        id, full_name, mobile_number, email, age, date_of_birth, gender, blood_group, city,
        password_hash, password_salt, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'O+', 'Coimbatore', ?, ?, 1)
    `).run(id, fullName, mobile, email, age, dob, gender, hash, salt);

    db.prepare(`
      INSERT INTO donor_profiles (
        user_id, blood_group, city, pincode, is_available_for_emergency, consent_emergency_alerts,
        last_donation_date, total_donations_count, profile_photo_path, profile_photo_mime, profile_photo_size_bytes,
        profile_photo_updated_at, selfie_consent_given, selfie_consent_at, is_photo_public
      ) VALUES (?, 'O+', 'Coimbatore', '641001', 1, 1, NULL, 0, NULL, NULL, NULL, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, 0)
    `).run(id);
  }

  function cleanupUser(id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.prepare('DELETE FROM donor_profiles WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_verifications WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(id);
    db.prepare("DELETE FROM security_audit_logs WHERE actor_id = ?").run(id);
    db.prepare("DELETE FROM user_security_activities WHERE user_id = ?").run(id);
  }

  // ---------------------------------------------------------------------
  // Test 1: Existing account with missing DOB and Gender
  // ---------------------------------------------------------------------
  const user1Id = 'usr_test_missing_both';
  const user1Email = 'test_missing_both@redmission.org';
  const user1Mobile = '9800000001';
  createTestUser({ id: user1Id, email: user1Email, mobile: user1Mobile, dob: null, gender: null, age: 24 });

  let user1Token = null;
  await runTest('1.1 Login on account missing both DOB and Gender sets requiresProfileCompletion=true', async () => {
    const res = await dispatchRequest('POST', '/api/user/login', {
      body: { identifier: user1Email, password: commonPassword }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.success, true);
    assert.strictEqual(res.json?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.dateOfBirth, null);
    assert.strictEqual(res.json?.user?.gender, null);
    user1Token = res.json?.token;
  });

  await runTest('1.2 GET /api/user/me returns requiresProfileCompletion=true when both fields missing', async () => {
    const res = await dispatchRequest('GET', '/api/user/me', {
      headers: { authorization: `Bearer ${user1Token}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.dateOfBirth, null);
    assert.strictEqual(res.json?.user?.gender, null);
  });

  // ---------------------------------------------------------------------
  // Test 2: Existing account with DOB but missing Gender
  // ---------------------------------------------------------------------
  const user2Id = 'usr_test_missing_gender';
  const user2Email = 'test_missing_gender@redmission.org';
  const user2Mobile = '9800000002';
  createTestUser({ id: user2Id, email: user2Email, mobile: user2Mobile, dob: '2001-07-20', gender: null });

  let user2Token = null;
  await runTest('2.1 Login on account with DOB but missing Gender sets requiresProfileCompletion=true', async () => {
    const res = await dispatchRequest('POST', '/api/user/login', {
      body: { identifier: user2Email, password: commonPassword }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.dateOfBirth, '2001-07-20');
    assert.strictEqual(res.json?.user?.gender, null);
    user2Token = res.json?.token;
  });

  await runTest('2.2 GET /api/user/me preserves existing DOB and flags missing Gender', async () => {
    const res = await dispatchRequest('GET', '/api/user/me', {
      headers: { authorization: `Bearer ${user2Token}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.dateOfBirth, '2001-07-20');
    assert.strictEqual(res.json?.user?.gender, null);
  });

  // ---------------------------------------------------------------------
  // Test 3: Existing account with Gender but missing DOB
  // ---------------------------------------------------------------------
  const user3Id = 'usr_test_missing_dob';
  const user3Email = 'test_missing_dob@redmission.org';
  const user3Mobile = '9800000003';
  createTestUser({ id: user3Id, email: user3Email, mobile: user3Mobile, dob: null, gender: 'Female', age: 30 });

  let user3Token = null;
  await runTest('3.1 Login on account with Gender but missing DOB sets requiresProfileCompletion=true', async () => {
    const res = await dispatchRequest('POST', '/api/user/login', {
      body: { identifier: user3Email, password: commonPassword }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.dateOfBirth, null);
    assert.strictEqual(res.json?.user?.gender, 'Female');
    user3Token = res.json?.token;
  });

  await runTest('3.2 GET /api/user/me preserves existing Gender and flags missing DOB', async () => {
    const res = await dispatchRequest('GET', '/api/user/me', {
      headers: { authorization: `Bearer ${user3Token}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.requiresProfileCompletion, true);
    assert.strictEqual(res.json?.user?.dateOfBirth, null);
    assert.strictEqual(res.json?.user?.gender, 'Female');
  });

  // ---------------------------------------------------------------------
  // Test 4: New registration with both fields
  // ---------------------------------------------------------------------
  const user4Email = 'test_new_reg_both@redmission.org';
  const user4Mobile = '9800000004';
  const validPhotoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  db.prepare('DELETE FROM users WHERE email = ? OR mobile_number = ?').run(user4Email, user4Mobile);

  let newUserId = null;
  await runTest('4.1 Direct Registration succeeds with both DOB and Gender', async () => {
    const res = await dispatchRequest('POST', '/api/user/register/direct', {
      body: {
        fullName: 'New Registered Donor',
        mobileNumber: user4Mobile,
        email: user4Email,
        dob: '2000-03-15',
        gender: 'Male',
        bloodGroup: 'B+',
        city: 'Chennai',
        password: commonPassword,
        confirmPassword: commonPassword,
        termsAccepted: true,
        photoConsent: true,
        selfieImage: validPhotoDataUrl
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.json?.success, true);
    assert.ok(res.json?.userId);
    newUserId = res.json.userId;
  });

  await runTest('4.2 Login on newly registered account has requiresProfileCompletion=false', async () => {
    const res = await dispatchRequest('POST', '/api/user/login', {
      body: { identifier: user4Email, password: commonPassword }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.requiresProfileCompletion, false);
    assert.strictEqual(res.json?.user?.requiresProfileCompletion, false);
    assert.strictEqual(res.json?.user?.dateOfBirth, '2000-03-15');
    assert.strictEqual(res.json?.user?.gender, 'Male');
  });

  // ---------------------------------------------------------------------
  // Test 5: Profile Completion Save via PUT /api/user/profile
  // ---------------------------------------------------------------------
  await runTest('5.1 Completing profile via PUT /api/user/profile succeeds and updates users row', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: { authorization: `Bearer ${user1Token}` },
      body: {
        dob: '1998-11-03',
        gender: 'Other'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.success, true);
    assert.strictEqual(res.json?.requiresProfileCompletion, false);
    assert.strictEqual(res.json?.user?.requiresProfileCompletion, false);
    assert.strictEqual(res.json?.user?.dateOfBirth, '1998-11-03');
    assert.strictEqual(res.json?.user?.gender, 'Other');
    assert.strictEqual(res.json?.user?.age, 28); // In Nov 2026, born Nov 3 1998 is 28

    // Verify DB
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user1Id);
    assert.strictEqual(u.date_of_birth, '1998-11-03');
    assert.strictEqual(u.gender, 'Other');
    assert.strictEqual(u.age, 28);
    // Credentials and other fields preserved
    assert.strictEqual(u.password_hash, hash);
    assert.strictEqual(u.mobile_number, user1Mobile);
    assert.strictEqual(u.email, user1Email);
  });

  // ---------------------------------------------------------------------
  // Test 6: Logout and login again – completion flag must remain false
  // ---------------------------------------------------------------------
  await runTest('6.1 Logout revokes the session', async () => {
    const res = await dispatchRequest('POST', '/api/user/logout', {
      headers: { authorization: `Bearer ${user1Token}` }
    });
    assert.strictEqual(res.status, 200);
  });

  await runTest('6.2 Login again after profile completion returns requiresProfileCompletion=false', async () => {
    const res = await dispatchRequest('POST', '/api/user/login', {
      body: { identifier: user1Email, password: commonPassword }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.requiresProfileCompletion, false);
    assert.strictEqual(res.json?.user?.requiresProfileCompletion, false);
    assert.strictEqual(res.json?.user?.dateOfBirth, '1998-11-03');
    assert.strictEqual(res.json?.user?.gender, 'Other');
    assert.strictEqual(res.json?.user?.age, 28);
  });

  // ---------------------------------------------------------------------
  // Test 7: Profile Update Security & IDOR Protection
  // ---------------------------------------------------------------------
  const user1ReLoginRes = await dispatchRequest('POST', '/api/user/login', {
    body: { identifier: user1Email, password: commonPassword }
  });
  const activeUser1Token = user1ReLoginRes.json?.token;

  await runTest('7.1 Reject IDOR attempt modifying someone else ID', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: { authorization: `Bearer ${activeUser1Token}` },
      body: {
        userId: 'usr_different_target_id',
        dob: '1995-01-01'
      }
    });

    assert.strictEqual(res.status, 403);
    assert.ok(res.json?.error.includes('Unauthorized profile update attempt'));
  });

  await runTest('7.2 Reject privilege escalation attempt (role/permissions)', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: { authorization: `Bearer ${activeUser1Token}` },
      body: {
        role: 'SUPER_ADMIN',
        gender: 'Female'
      }
    });

    assert.strictEqual(res.status, 403);
    assert.ok(res.json?.error.includes('strictly forbidden'));
  });

  // ---------------------------------------------------------------------
  // Test 8: Admin & Super Admin Login Regression
  // ---------------------------------------------------------------------
  await runTest('8.1 Super Admin account is intact and untouched', async () => {
    const superAdmin = db.prepare("SELECT id, username, email, role_id, is_active FROM admin_accounts WHERE role_id = 'SUPER_ADMIN'").get();
    assert.ok(superAdmin, 'Super Admin record must exist');
    assert.strictEqual(superAdmin.is_active, 1);
  });

  // ---------------------------------------------------------------------
  // Test 9: OTP-Disabled Contact Security Guard
  // ---------------------------------------------------------------------
  await runTest('9.1 Modifying mobile/email when OTP_ENABLED=false is blocked with 400', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: { authorization: `Bearer ${activeUser1Token}` },
      body: {
        email: 'hijack_attempt@hacker.io'
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json?.code, 'CONTACT_UPDATE_OTP_REQUIRED');

    // Confirm DB was not modified
    const u = db.prepare('SELECT email FROM users WHERE id = ?').get(user1Id);
    assert.strictEqual(u.email, user1Email);
  });

  // Clean up temporary test accounts before verifying legacy user count
  cleanupUser(user1Id);
  cleanupUser(user2Id);
  cleanupUser(user3Id);
  if (newUserId) cleanupUser(newUserId);

  // ---------------------------------------------------------------------
  // Test 10: Preservation of Original 9 Legacy Users
  // ---------------------------------------------------------------------
  await runTest('10.1 All 9 original legacy users exist with intact passwords & records', async () => {
    const legacyUsers = db.prepare("SELECT id, full_name, mobile_number, email, age, date_of_birth, gender FROM users WHERE id NOT LIKE 'usr_test%'").all();
    assert.strictEqual(legacyUsers.length, 9, 'All 9 legacy users must be preserved');

    for (const u of legacyUsers) {
      assert.ok(u.id);
      assert.ok(u.full_name);
      assert.ok(u.email);
      assert.ok(u.mobile_number);
      // Legacy users originally have NULL DOB and NULL gender
      assert.strictEqual(u.date_of_birth, null);
      assert.strictEqual(u.gender, null);
      assert.ok(u.age >= 18 && u.age <= 65);
    }
  });

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  server.close(() => {
    if (failed > 0) process.exit(1);
    else process.exit(0);
  });
}

main().catch(err => {
  console.error('[UNCAUGHT TEST RUNNER ERROR]', err);
  process.exit(1);
});
