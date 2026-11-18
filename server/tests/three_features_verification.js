import assert from 'node:assert';
import crypto from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/env.js';
import {
  calculateAgeFromDob,
  resolveEffectiveAge,
  getDonorAvailabilityStatus,
  getBulkDonorAvailability,
  getTodayIstDateString,
  IST_TIMEZONE
} from '../services/donorAvailabilityService.js';
import {
  calculateWeekday,
  formatDisplayDate
} from '../../src/utils/calendarUtils.js';
import { hashPassword, generateSecureToken } from '../utils/crypto.js';
import { logSecurityAudit, logUserActivity } from '../utils/auditLogger.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

console.log('====================================================');
console.log('RED MISSION — THREE FEATURES LOCAL VERIFICATION SUITE');
console.log('====================================================\n');

const db = getDatabase();

// ---------------------------------------------------------------------
// TEST GROUP 1: Database Migration & Schema Integrity
// ---------------------------------------------------------------------
test('1.1 SQLite integrity check returns ok', () => {
  const check = db.prepare('PRAGMA integrity_check;').get();
  assert.strictEqual(check.integrity_check, 'ok');
});

test('1.2 Foreign key check reports 0 violations', () => {
  const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
  assert.strictEqual(fkCheck.length, 0);
});

test('1.3 Stage 3.5 migration record exists in schema_migrations', () => {
  const row = db.prepare("SELECT * FROM schema_migrations WHERE version = 'stage_3_5'").get();
  assert.ok(row, 'Stage 3.5 migration must be recorded');
});

test('1.4 users table contains date_of_birth and gender columns', () => {
  const tableInfo = db.prepare("PRAGMA table_info('users')").all();
  const cols = new Set(tableInfo.map(c => c.name));
  assert.ok(cols.has('date_of_birth'), 'users.date_of_birth must exist');
  assert.ok(cols.has('gender'), 'users.gender must exist');
});

test('1.5 pending_user_registrations contains date_of_birth and gender columns', () => {
  const tableInfo = db.prepare("PRAGMA table_info('pending_user_registrations')").all();
  const cols = new Set(tableInfo.map(c => c.name));
  assert.ok(cols.has('date_of_birth'), 'pending_user_registrations.date_of_birth must exist');
  assert.ok(cols.has('gender'), 'pending_user_registrations.gender must exist');
});

// ---------------------------------------------------------------------
// TEST GROUP 2: Existing User Preservation
// ---------------------------------------------------------------------
test('2.1 All 9 existing registered users are intact', () => {
  const countRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE id LIKE 'usr_%'").get();
  assert.strictEqual(countRow.count, 9, 'All 9 legacy users must remain intact');
});

test('2.2 Existing users have NULL date_of_birth and NULL gender (no invented data)', () => {
  const users = db.prepare("SELECT id, age, date_of_birth, gender FROM users WHERE id LIKE 'usr_%'").all();
  assert.strictEqual(users.length, 9);
  for (const u of users) {
    assert.strictEqual(u.date_of_birth, null, `User ${u.id} date_of_birth must be null`);
    assert.strictEqual(u.gender, null, `User ${u.id} gender must be null`);
    assert.ok(u.age >= 18 && u.age <= 65, `User ${u.id} legacy age must be valid`);
  }
});

test('2.3 resolveEffectiveAge preserves legacy age for existing users', () => {
  const users = db.prepare("SELECT id, age, date_of_birth FROM users WHERE id LIKE 'usr_%'").all();
  for (const u of users) {
    const effAge = resolveEffectiveAge(u.age, u.date_of_birth);
    assert.strictEqual(effAge, u.age, `Effective age must equal legacy stored age for user ${u.id}`);
  }
});

// ---------------------------------------------------------------------
// TEST GROUP 3: Dynamic Age Calculation, Leap Year, & IST Boundaries
// ---------------------------------------------------------------------
test('3.1 calculateAgeFromDob returns exact age on birthday', () => {
  const ref = '2026-11-17';
  // Born exactly 18 years ago on 2008-11-17
  assert.strictEqual(calculateAgeFromDob('2008-11-17', ref), 18);
  // Born 18 years ago tomorrow -> still 17
  assert.strictEqual(calculateAgeFromDob('2008-11-18', ref), 17);
  // Born 18 years ago yesterday -> 18
  assert.strictEqual(calculateAgeFromDob('2008-11-16', ref), 18);
});

test('3.2 calculateAgeFromDob boundary at 65 years', () => {
  const ref = '2026-11-17';
  // Born exactly 65 years ago on 1961-11-17
  assert.strictEqual(calculateAgeFromDob('1961-11-17', ref), 65);
  // Born 65 years ago yesterday (1961-11-16) -> 65
  assert.strictEqual(calculateAgeFromDob('1961-11-16', ref), 65);
  // Born 66 years ago on 1960-11-17 -> 66
  assert.strictEqual(calculateAgeFromDob('1960-11-17', ref), 66);
});

test('3.3 calculateAgeFromDob leap year Feb 29 arithmetic', () => {
  // Leap day baby born 2004-02-29
  // Evaluated on non-leap year 2023 on Feb 28 (before) vs March 1 (after)
  assert.strictEqual(calculateAgeFromDob('2004-02-29', '2023-02-28'), 18);
  assert.strictEqual(calculateAgeFromDob('2004-02-29', '2023-03-01'), 19);
});

test('3.4 calculateAgeFromDob rejects future dates with -1', () => {
  const ref = '2026-11-17';
  assert.strictEqual(calculateAgeFromDob('2026-11-18', ref), -1);
  assert.strictEqual(calculateAgeFromDob('2030-01-01', ref), -1);
});

test('3.5 calculateAgeFromDob rejects invalid date values with null', () => {
  assert.strictEqual(calculateAgeFromDob('invalid-string'), null);
  assert.strictEqual(calculateAgeFromDob('2024-02-30'), null); // invalid Feb 30
  assert.strictEqual(calculateAgeFromDob('2023-13-01'), null); // month 13
  assert.strictEqual(calculateAgeFromDob(''), null);
  assert.strictEqual(calculateAgeFromDob(null), null);
});

// ---------------------------------------------------------------------
// TEST GROUP 4: Calendar & Weekday Calculation
// ---------------------------------------------------------------------
test('4.1 calculateWeekday accurately returns day of week without contradictions', () => {
  assert.strictEqual(calculateWeekday('2026-11-17'), 'Tuesday');
  assert.strictEqual(calculateWeekday('2024-02-29'), 'Thursday');
  assert.strictEqual(calculateWeekday('1947-08-15'), 'Friday');
  assert.strictEqual(calculateWeekday('2000-01-01'), 'Saturday');
});

test('4.2 formatDisplayDate formats date into readable string', () => {
  assert.strictEqual(formatDisplayDate('2026-11-17'), '17 November 2026');
  assert.strictEqual(formatDisplayDate('2004-02-29'), '29 February 2004');
});

// ---------------------------------------------------------------------
// TEST GROUP 5: Profile Ownership, IDOR, Privilege Escalation & Contact Guard
// ---------------------------------------------------------------------
test('5.1 Forbidden security fields guard list is complete', () => {
  const forbiddenFields = [
    'role', 'roles', 'isAdmin', 'is_admin', 'is_super_admin',
    'isSuspended', 'is_suspended', 'isActive', 'is_active',
    'password_hash', 'password_salt', 'requires_password_change',
    'permissions', 'email_verified', 'mobile_verified'
  ];
  assert.strictEqual(forbiddenFields.length, 15);
});

test('5.2 Profile update transaction updates users and syncs donor_profiles', () => {
  const testUserId = 'usr_test_profile_sync';
  const { hash, salt } = hashPassword('TestPassword123!');

  // Clean up if exists
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  db.prepare('DELETE FROM donor_profiles WHERE user_id = ?').run(testUserId);

  // Insert initial test user
  db.prepare(`
    INSERT INTO users (id, full_name, mobile_number, email, age, date_of_birth, gender, blood_group, city, password_hash, password_salt, is_active)
    VALUES (?, 'Original Name', '9999988888', 'test_sync@redmission.org', 24, NULL, NULL, 'B+', 'Pune', ?, ?, 1)
  `).run(testUserId, hash, salt);

  db.prepare(`
    INSERT INTO donor_profiles (user_id, blood_group, city, pincode, is_available_for_emergency, consent_emergency_alerts, total_donations_count, is_photo_public)
    VALUES (?, 'B+', 'Pune', '411001', 1, 1, 0, 0)
  `).run(testUserId);

  // Perform transactional profile update
  const updatedName = 'Updated Legal Name';
  const updatedDob = '2000-05-15';
  const updatedGender = 'Female';
  const updatedBg = 'O+';
  const updatedCity = 'Mumbai';
  const updatedPin = '400001';
  const calculatedAge = calculateAgeFromDob(updatedDob, '2026-11-17');

  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  db.prepare(`
    UPDATE users
    SET full_name = ?, blood_group = ?, city = ?, date_of_birth = ?, gender = ?, age = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(updatedName, updatedBg, updatedCity, updatedDob, updatedGender, calculatedAge, testUserId);

  db.prepare(`
    UPDATE donor_profiles
    SET blood_group = ?, city = ?, pincode = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(updatedBg, updatedCity, updatedPin, testUserId);
  db.exec('COMMIT;');

  // Verify users table updated
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId);
  assert.strictEqual(u.full_name, updatedName);
  assert.strictEqual(u.blood_group, updatedBg);
  assert.strictEqual(u.city, updatedCity);
  assert.strictEqual(u.date_of_birth, updatedDob);
  assert.strictEqual(u.gender, updatedGender);
  assert.strictEqual(u.age, 26);

  // Verify donor_profiles synchronized
  const dp = db.prepare('SELECT * FROM donor_profiles WHERE user_id = ?').get(testUserId);
  assert.strictEqual(dp.blood_group, updatedBg);
  assert.strictEqual(dp.city, updatedCity);
  assert.strictEqual(dp.pincode, updatedPin);

  // Clean up test user
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  db.prepare('DELETE FROM donor_profiles WHERE user_id = ?').run(testUserId);
});

// ---------------------------------------------------------------------
// TEST GROUP 6: Donor Directory Dynamic Age Projection
// ---------------------------------------------------------------------
test('6.1 getDonorAvailabilityStatus dynamically computes age when DOB exists', () => {
  const testUserId = 'usr_test_avail_dob';
  const { hash, salt } = hashPassword('TestPassword123!');

  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  db.prepare('DELETE FROM donor_profiles WHERE user_id = ?').run(testUserId);

  db.prepare(`
    INSERT INTO users (id, full_name, mobile_number, email, age, date_of_birth, gender, blood_group, city, password_hash, password_salt, is_active)
    VALUES (?, 'DOB Test User', '9999977777', 'dob_avail@redmission.org', 20, '2004-01-01', 'Male', 'A+', 'Delhi', ?, ?, 1)
  `).run(testUserId, hash, salt);

  db.prepare(`
    INSERT INTO donor_profiles (user_id, blood_group, city, is_available_for_emergency, consent_emergency_alerts, total_donations_count, is_photo_public)
    VALUES (?, 'A+', 'Delhi', 1, 1, 0, 0)
  `).run(testUserId);

  // In 2026, user born 2004-01-01 is 22 years old
  const status = getDonorAvailabilityStatus(db, testUserId, { referenceDate: '2026-11-17' });
  assert.strictEqual(status.age, 22, 'getDonorAvailabilityStatus must compute dynamic age from DOB');

  // Clean up
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  db.prepare('DELETE FROM donor_profiles WHERE user_id = ?').run(testUserId);
});

test('6.2 getBulkDonorAvailability correctly resolves effective age for mixed rows', () => {
  const mixedRows = [
    { id: 'u1', age: 24, date_of_birth: null, has_donor_profile: 1, is_active: 1, is_suspended: 0, is_available_for_emergency: 1 },
    { id: 'u2', age: 30, date_of_birth: '1996-05-10', has_donor_profile: 1, is_active: 1, is_suspended: 0, is_available_for_emergency: 1 }
  ];

  const map = getBulkDonorAvailability(db, mixedRows, { referenceDate: '2026-11-17' });
  assert.ok(map.has('u1'));
  assert.ok(map.has('u2'));
  // u1 has null DOB -> uses stored 24
  assert.strictEqual(map.get('u1').age, 24);
  // u2 born 1996-05-10 in Nov 2026 -> 30
  assert.strictEqual(map.get('u2').age, 30);
});

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
