import { config } from '../config/env.js';
import { getDatabase } from '../database/connection.js';
import { ensureTemporal, parseOfficialLaunchTimestamp } from '../../src/utils/launchTimer.js';

const LAUNCH_CONFIG_KEY = 'official_launch_timestamp';

/**
 * Resolves the single fixed official website launch timestamp from persistent configuration
 * (environment configuration + persistent SQLite site_config table).
 * Never generates a timestamp dynamically with Date.now(), and never enables the production
 * timer outside NODE_ENV === 'production'.
 */
export async function getPersistentLaunchConfig(db = getDatabase()) {
  const TemporalImpl = await ensureTemporal();

  const envRaw = config.OFFICIAL_LAUNCH_TIMESTAMP || '';
  const envTimestampUtc = parseOfficialLaunchTimestamp(envRaw, TemporalImpl);

  let storedRow = null;
  try {
    storedRow = db.prepare('SELECT value FROM site_config WHERE key = ?').get(LAUNCH_CONFIG_KEY);
  } catch {
    storedRow = null;
  }

  let persistedTimestampUtc = parseOfficialLaunchTimestamp(storedRow?.value || '', TemporalImpl);

  // Sync authoritative configured timestamp into persistent SQLite site_config table
  if (envTimestampUtc && envTimestampUtc !== persistedTimestampUtc) {
    try {
      db.prepare(`
        INSERT INTO site_config (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(LAUNCH_CONFIG_KEY, envTimestampUtc);
      persistedTimestampUtc = envTimestampUtc;
    } catch {
      // Non-fatal if DB is read-only; envTimestampUtc remains authoritative
    }
  }

  const launchTimestampUtc = envTimestampUtc || persistedTimestampUtc || null;
  const isProduction = Boolean(config.IS_PROD);
  const timerActive = Boolean(isProduction && config.LAUNCH_TIMER_ENABLED && launchTimestampUtc);

  return {
    success: true,
    environment: config.NODE_ENV,
    isProduction,
    timerActive,
    launchTimestampUtc,
    serverNowUtc: TemporalImpl.Now.instant().toString()
  };
}

/**
 * Deduplicated count of verified completed donation entities.
 * Relational deduplication rules:
 * 1. Verified completed donations linked to pledges (request_pledges.id):
 *    - Pledge status = 'APPROVED' OR
 *    - Has an approved proof in donation_proofs (status = 'APPROVED') OR
 *    - Has an issued certificate in donation_certificates.
 *    Deduplicates multiple proofs or certificates attached to the same pledge.
 * 2. Verified completed offline/direct donation proofs:
 *    - donation_proofs.status = 'APPROVED'
 *    - pledge_id is NULL or not present in request_pledges.
 * 3. Verified completed offline/direct certificates:
 *    - pledge_id is NULL or not in request_pledges
 *    - proof_id is NULL or not in approved donation_proofs.
 * 4. Anonymized retained completed donation records (from deleted user accounts).
 */
export function countVerifiedDonations(db) {
  let hasAnonTable = false;
  try {
    const tableRow = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anonymized_donation_records'").get();
    hasAnonTable = Boolean(tableRow);
  } catch {
    hasAnonTable = false;
  }

  const anonSql = hasAnonTable
    ? `
      UNION
      SELECT 'anon_' || adr.id as canonical_donation_id
      FROM anonymized_donation_records adr
    `
    : '';

  const query = `
    SELECT COUNT(DISTINCT canonical_donation_id) as total
    FROM (
      -- 1. Verified completed donations linked to pledges
      SELECT p.id as canonical_donation_id
      FROM request_pledges p
      WHERE p.status = 'APPROVED'
         OR EXISTS (
              SELECT 1 FROM donation_proofs dp 
              WHERE dp.pledge_id = p.id AND dp.status = 'APPROVED'
            )
         OR EXISTS (
              SELECT 1 FROM donation_certificates dc 
              WHERE dc.pledge_id = p.id
            )

      UNION

      -- 2. Verified completed offline/direct donation proofs without an associated pledge
      SELECT dp.id as canonical_donation_id
      FROM donation_proofs dp
      WHERE dp.status = 'APPROVED'
        AND (
          dp.pledge_id IS NULL 
          OR TRIM(dp.pledge_id) = '' 
          OR NOT EXISTS (SELECT 1 FROM request_pledges rp WHERE rp.id = dp.pledge_id)
        )

      UNION

      -- 3. Verified completed offline/direct certificates without an associated pledge or approved proof
      SELECT dc.id as canonical_donation_id
      FROM donation_certificates dc
      WHERE (
          dc.pledge_id IS NULL 
          OR TRIM(dc.pledge_id) = '' 
          OR NOT EXISTS (SELECT 1 FROM request_pledges rp WHERE rp.id = dc.pledge_id)
        )
        AND (
          dc.proof_id IS NULL 
          OR TRIM(dc.proof_id) = '' 
          OR NOT EXISTS (SELECT 1 FROM donation_proofs dp WHERE dp.id = dc.proof_id AND dp.status = 'APPROVED')
        )
      ${anonSql}
    )
  `;

  const row = db.prepare(query).get();
  return Number(row?.total || 0);
}

/**
 * Computes potential lives impacted using only eligible verified completed whole-blood donations.
 * Approved business rule: up to 3 therapeutic components (Packed Red Blood Cells, Platelet Concentrate, Fresh Frozen Plasma).
 * If donation records are unverified or zero, returns 0 safely.
 */
export function calculatePotentialLivesImpacted(totalVerifiedWholeBloodDonations) {
  const verifiedCount = Math.max(0, parseInt(totalVerifiedWholeBloodDonations, 10) || 0);
  if (verifiedCount === 0) return 0;
  const POTENTIAL_COMPONENTS_PER_WHOLE_BLOOD = 3;
  return verifiedCount * POTENTIAL_COMPONENTS_PER_WHOLE_BLOOD;
}

/**
 * Computes distinct normalized cities represented across registered voluntary donors and hospital requisitions.
 * Handles blanks, nulls, invalid inputs safely with zero PII exposure.
 */
export function countCitiesRepresented(db) {
  const query = `
    SELECT COUNT(DISTINCT normalized_city) as total
    FROM (
      SELECT LOWER(TRIM(u.city)) as normalized_city
      FROM users u
      JOIN donor_profiles d ON u.id = d.user_id
      WHERE u.is_active = 1 
        AND u.city IS NOT NULL 
        AND TRIM(u.city) != ''
        AND LENGTH(TRIM(u.city)) >= 2

      UNION

      SELECT LOWER(TRIM(er.hospital_city)) as normalized_city
      FROM emergency_requests er
      WHERE er.hospital_city IS NOT NULL 
        AND TRIM(er.hospital_city) != ''
        AND LENGTH(TRIM(er.hospital_city)) >= 2
    )
    WHERE normalized_city IS NOT NULL 
      AND normalized_city != '' 
      AND normalized_city != 'null' 
      AND normalized_city != 'undefined'
  `;

  const row = db.prepare(query).get();
  return Number(row?.total || 0);
}

/**
 * Counts registered active voluntary donors.
 */
export function countRegisteredDonors(db) {
  const donorStat = db.prepare(`
    SELECT COUNT(DISTINCT d.user_id) as total 
    FROM donor_profiles d 
    JOIN users u ON d.user_id = u.id 
    WHERE u.is_active = 1 AND u.is_suspended = 0
  `).get();
  return Number(donorStat?.total || 0);
}

export function setupSiteConfigRoutes(app) {
  app.get('/api/site/launch-config', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const payload = await getPersistentLaunchConfig();
    return res.status(200).json(payload);
  });

  // ==========================================
  // PUBLIC IMPACT & TELEMETRY STATISTICS
  // Real database metrics computed directly from SQLite (NO hardcoded or simulated values)
  // Relational deduplication with zero Math.max() heuristics
  // ==========================================
  app.get('/api/public/impact-stats', (req, res) => {
    try {
      const db = getDatabase();

      // 1. Total Verified Completed Donations (relational deduplication)
      const totalDonations = countVerifiedDonations(db);

      // 2. Registered Voluntary Donors
      const registeredDonors = countRegisteredDonors(db);

      // 3. Potential Lives Impacted (F-03: estimated potential based on up to 3 components per verified whole-blood donation)
      const potentialLivesImpacted = calculatePotentialLivesImpacted(totalDonations);

      // 4. Cities Represented (F-04: network representation of donors & hospital requests)
      const citiesRepresented = countCitiesRepresented(db);

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).json({
        success: true,
        stats: {
          totalDonations,
          registeredDonors,
          potentialLivesImpacted,
          // Backward-compatibility aliases for existing consumers
          livesImpacted: potentialLivesImpacted,
          citiesRepresented,
          citiesReached: citiesRepresented
        },
        calculationMetadata: {
          multiplier: 3,
          donationBasis: 'Verified completed whole-blood donations',
          potentialLivesExplanation: 'Estimated potential based on up to three therapeutic components per verified whole-blood donation. Actual patient treatment is not confirmed by this statistic.',
          cityMetricExplanation: 'Distinct normalized geographic locations of registered voluntary donors and requisitioning medical centers represented across the network.',
          guidelines: 'National Blood Transfusion Council (NBTC) / WHO component fractionation model'
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[IMPACT STATS ERROR]', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to compute real-time impact statistics.'
      });
    }
  });
}
