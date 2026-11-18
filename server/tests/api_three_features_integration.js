import assert from 'node:assert';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { app, server } from '../index.js';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import { hashPassword } from '../utils/crypto.js';

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

// Minimal 1x1 valid PNG buffer as base64 dataUrl for valid photo testing
const VALID_PHOTO_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

// Helper to make mock HTTP request into app without network socket
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

console.log('====================================================');
console.log('RED MISSION — API & ENDPOINT INTEGRATION TEST SUITE');
console.log('====================================================\n');

const db = getDatabase();

async function main() {
  const testMobile = '9876501234';
  const testEmail = 'api_test_dob@redmission.org';
  const testPassword = 'Password123!';

  // Clean prior test artifacts
  db.prepare('DELETE FROM users WHERE email = ? OR mobile_number = ?').run(testEmail, testMobile);

  // ---------------------------------------------------------------------
  // 1. Direct Registration: Rejection of invalid DOBs
  // ---------------------------------------------------------------------
  await runTest('1.1 Direct Registration rejects future Date of Birth', async () => {
    const res = await dispatchRequest('POST', '/api/user/register/direct', {
      body: {
        fullName: 'Future Tester',
        mobileNumber: testMobile,
        email: testEmail,
        dob: '2030-01-01',
        gender: 'Male',
        bloodGroup: 'O+',
        city: 'Mumbai',
        password: testPassword,
        confirmPassword: testPassword,
        termsAccepted: true,
        photoConsent: true,
        selfieImage: VALID_PHOTO_DATA_URL
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json?.error, 'Date of birth cannot be in the future.');
  });

  await runTest('1.2 Direct Registration rejects under-18 Date of Birth', async () => {
    const res = await dispatchRequest('POST', '/api/user/register/direct', {
      body: {
        fullName: 'Minor Tester',
        mobileNumber: testMobile,
        email: testEmail,
        dob: '2015-05-10',
        gender: 'Female',
        bloodGroup: 'A+',
        city: 'Pune',
        password: testPassword,
        confirmPassword: testPassword,
        termsAccepted: true,
        photoConsent: true,
        selfieImage: VALID_PHOTO_DATA_URL
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json?.error, 'Voluntary blood donors must be aged between 18 and 65 years.');
  });

  await runTest('1.3 Direct Registration rejects over-65 Date of Birth', async () => {
    const res = await dispatchRequest('POST', '/api/user/register/direct', {
      body: {
        fullName: 'Senior Tester',
        mobileNumber: testMobile,
        email: testEmail,
        dob: '1950-01-01',
        gender: 'Other',
        bloodGroup: 'B+',
        city: 'Delhi',
        password: testPassword,
        confirmPassword: testPassword,
        termsAccepted: true,
        photoConsent: true,
        selfieImage: VALID_PHOTO_DATA_URL
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json?.error, 'Voluntary blood donors must be aged between 18 and 65 years.');
  });

  await runTest('1.4 Direct Registration rejects invalid gender', async () => {
    const res = await dispatchRequest('POST', '/api/user/register/direct', {
      body: {
        fullName: 'Gender Tester',
        mobileNumber: testMobile,
        email: testEmail,
        dob: '2000-01-01',
        gender: 'Alien',
        bloodGroup: 'O+',
        city: 'Delhi',
        password: testPassword,
        confirmPassword: testPassword,
        termsAccepted: true,
        photoConsent: true,
        selfieImage: VALID_PHOTO_DATA_URL
      }
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.json?.error.includes('valid gender option'));
  });

  // ---------------------------------------------------------------------
  // 2. Direct Registration: Successful registration with DOB and Gender
  // ---------------------------------------------------------------------
  let createdUserId = null;
  await runTest('2.1 Direct Registration succeeds with valid DOB & Gender', async () => {
    const res = await dispatchRequest('POST', '/api/user/register/direct', {
      body: {
        fullName: 'Aarav Sharma',
        mobileNumber: testMobile,
        email: testEmail,
        dob: '2001-04-12',
        gender: 'Male',
        bloodGroup: 'O+',
        city: 'Bangalore',
        password: testPassword,
        confirmPassword: testPassword,
        termsAccepted: true,
        photoConsent: true,
        selfieImage: VALID_PHOTO_DATA_URL
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.json?.success, true);
    assert.ok(res.json?.userId);
    createdUserId = res.json.userId;

    // Verify database record
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(createdUserId);
    assert.ok(user);
    assert.strictEqual(user.full_name, 'Aarav Sharma');
    assert.strictEqual(user.date_of_birth, '2001-04-12');
    assert.strictEqual(user.gender, 'Male');
    assert.strictEqual(user.blood_group, 'O+');
    assert.strictEqual(user.city, 'Bangalore');
    assert.strictEqual(user.age, 25); // In Nov 2026, born April 2001 is 25
  });

  // ---------------------------------------------------------------------
  // 3. Login returns DOB, Gender & dynamically computed Age
  // ---------------------------------------------------------------------
  let sessionToken = null;
  await runTest('3.1 Login returns dateOfBirth, gender and dynamic age', async () => {
    const res = await dispatchRequest('POST', '/api/user/login', {
      body: {
        identifier: testEmail,
        password: testPassword
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.success, true);
    assert.ok(res.json?.token);
    sessionToken = res.json.token;

    assert.strictEqual(res.json.user.fullName, 'Aarav Sharma');
    assert.strictEqual(res.json.user.dateOfBirth, '2001-04-12');
    assert.strictEqual(res.json.user.gender, 'Male');
    assert.strictEqual(res.json.user.age, 25);
  });

  // ---------------------------------------------------------------------
  // 4. User Profile Editing (PUT /api/user/profile)
  // ---------------------------------------------------------------------
  const authHeaders = {
    authorization: `Bearer ${sessionToken}`
  };

  await runTest('4.1 PUT /api/user/profile updates Full Name, DOB, Gender, City, Pincode', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: authHeaders,
      body: {
        fullName: 'Aarav K. Sharma',
        dob: '2002-08-15',
        gender: 'Male',
        bloodGroup: 'O+',
        city: 'Mysore',
        pincode: '570001'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.success, true);
    assert.strictEqual(res.json?.user?.fullName, 'Aarav K. Sharma');
    assert.strictEqual(res.json?.user?.dateOfBirth, '2002-08-15');
    assert.strictEqual(res.json?.user?.city, 'Mysore');
    assert.strictEqual(res.json?.user?.pincode, '570001');
    assert.strictEqual(res.json?.user?.age, 24); // In Nov 2026, born Aug 2002 is 24

    // Verify DB
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(createdUserId);
    assert.strictEqual(u.full_name, 'Aarav K. Sharma');
    assert.strictEqual(u.date_of_birth, '2002-08-15');
    assert.strictEqual(u.age, 24);

    const dp = db.prepare('SELECT * FROM donor_profiles WHERE user_id = ?').get(createdUserId);
    assert.strictEqual(dp.city, 'Mysore');
    assert.strictEqual(dp.pincode, '570001');
  });

  await runTest('4.2 PUT /api/user/profile rejects privilege escalation fields with 403', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: authHeaders,
      body: {
        role: 'SUPER_ADMIN',
        fullName: 'Hacker Attempt'
      }
    });

    assert.strictEqual(res.status, 403);
    assert.ok(res.json?.error.includes('strictly forbidden'));
  });

  await runTest('4.3 PUT /api/user/profile rejects IDOR tampering with 403', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: authHeaders,
      body: {
        userId: 'usr_another_person_id',
        fullName: 'IDOR Attempt'
      }
    });

    assert.strictEqual(res.status, 403);
    assert.ok(res.json?.error.includes('Unauthorized profile update attempt'));
  });

  await runTest('4.4 PUT /api/user/profile rejects mobile/email changes when OTP_ENABLED=false', async () => {
    const res = await dispatchRequest('PUT', '/api/user/profile', {
      headers: authHeaders,
      body: {
        mobileNumber: '9111122222'
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json?.code, 'CONTACT_UPDATE_OTP_REQUIRED');

    // Confirm DB mobile number was NOT modified or marked verified
    const u = db.prepare('SELECT mobile_number FROM users WHERE id = ?').get(createdUserId);
    assert.strictEqual(u.mobile_number, testMobile);
  });

  await runTest('4.5 Security audit and user activity logs recorded the update', async () => {
    const audit = db.prepare("SELECT * FROM security_audit_logs WHERE actor_id = ? AND action = 'USER_PROFILE_UPDATED'").get(createdUserId);
    assert.ok(audit, 'Security audit log must be recorded');

    const activity = db.prepare("SELECT * FROM user_security_activities WHERE user_id = ? AND event_type = 'PROFILE_UPDATED'").get(createdUserId);
    assert.ok(activity, 'User activity log must be recorded');
  });

  // Clean up created test user
  db.prepare('DELETE FROM users WHERE id = ?').run(createdUserId);
  db.prepare('DELETE FROM donor_profiles WHERE user_id = ?').run(createdUserId);
  db.prepare('DELETE FROM user_verifications WHERE user_id = ?').run(createdUserId);
  db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(createdUserId);
  db.prepare("DELETE FROM security_audit_logs WHERE actor_id = ?").run(createdUserId);
  db.prepare("DELETE FROM user_security_activities WHERE user_id = ?").run(createdUserId);

  console.log('\n====================================================');
  console.log(`TOTAL API TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  server.close(() => {
    if (failed > 0) process.exit(1);
    else process.exit(0);
  });
}

main().catch(err => {
  console.error('[UNCAUGHT TEST RUNNER ERROR]', err);
  process.exit(1);
});
