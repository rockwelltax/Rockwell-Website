#!/usr/bin/env node
/**
 * Rockwell Tax & Digital Strategies Inc.
 * Comprehensive Automated Security, Concurrency, Rate-Limit & Functional Test Suite
 *
 * Runs strictly against DEV_DATABASE_URL (never touches production records).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { Client } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

// Force development mode so lib/db.js connects strictly to DEV_DATABASE_URL
process.env.NODE_ENV = 'development';
// Disable live outbound Resend network calls during automated test suite while verifying email module logic
process.env.RESEND_API_KEY = '';

const server = require('../server');
const db = require('../lib/db');
const emailModule = require('../lib/email');
const { verifyTurnstileToken } = require('../lib/turnstile');
const { createCaptchaChallenge, verifyCaptchaChallenge } = require('../lib/captcha');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCookieValue(setCookieHeaders, cookieName) {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const hdr of list) {
    const firstPart = hdr.split(';')[0];
    const eq = firstPart.indexOf('=');
    if (eq !== -1 && firstPart.slice(0, eq).trim() === cookieName) {
      return {
        rawHeader: hdr,
        cookiePair: firstPart.trim(),
        value: firstPart.slice(eq + 1).trim()
      };
    }
  }
  return null;
}

async function runTests() {
  console.log('🧪 Rockwell Comprehensive Security & Concurrency Verification Suite');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Seed a clean test admin user on DEV_MIGRATION_DATABASE_URL
  const ownerClient = new Client({
    connectionString: process.env.DEV_MIGRATION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await ownerClient.connect();

  const testAdminEmail = 'info@rockwelltaxdigital.com';
  const testAdminPass = 'RockwellSecure#2026!';
  const passHash = await bcrypt.hash(testAdminPass, 10);

  await ownerClient.query('TRUNCATE TABLE inquiry_rate_limits, admin_sessions, security_audit_logs, password_resets, login_rate_limits RESTART IDENTITY CASCADE');
  await ownerClient.query(`DELETE FROM inquiries WHERE email LIKE '%@example-test.com' OR email LIKE '%@gmail.com' OR email LIKE '%@silvacpa-test.com'`);
  await ownerClient.query(
    `INSERT INTO admin_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [testAdminEmail, passHash]
  );
  await ownerClient.query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ('publishing', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify({ status: 'coming_soon', scheduled_at: null, updated_at: new Date().toISOString() })]
  );

  let passed = 0;
  async function step(name, fn) {
    process.stdout.write(`  • ${name} ... `);
    try {
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log('❌ FAIL');
      console.error('    Failure details:', err);
      throw err;
    }
  }

  // Start ephemeral local HTTP server
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Verify Email Routing Constant
    await step('1. Exclusive admin email routing (info@rockwelltaxdigital.com)', async () => {
      assert.strictEqual(emailModule.INQUIRY_NOTIFICATION_EMAIL, 'info@rockwelltaxdigital.com');
    });

    // 2. Verify Least-Privilege App Role Restrictions
    await step('2. Least-privilege DB role blocks TRUNCATE and DROP TABLE', async () => {
      await assert.rejects(
        () => db.query('TRUNCATE TABLE inquiries'),
        /permission denied/i
      );
      await assert.rejects(
        () => db.query('DROP TABLE inquiries'),
        /permission denied|must be owner/i
      );
      await assert.rejects(
        () => db.query('DELETE FROM security_audit_logs'),
        /permission denied/i
      );
    });

    // 3. Verify Coming Soon Mode Server-Side Protection & Unauthenticated Preview Block
    let sharedFormToken = null;
    let deviceCookie1 = null;
    await step('3. Coming Soon mode blocks public POST /api/inquiries & unauthenticated ?preview=admin', async () => {
      const previewRes = await fetch(`${baseUrl}/?preview=admin`);
      const previewHtml = await previewRes.text();
      assert(previewHtml.includes('Coming Soon'), 'Unauthenticated ?preview=admin must receive Coming Soon page');

      const cfgRes = await fetch(`${baseUrl}/api/inquiries?action=config`);
      const cfg = await cfgRes.json();
      sharedFormToken = cfg.formToken;
      deviceCookie1 = extractCookieValue(cfgRes.headers.getSetCookie(), 'rw_did');
      assert(deviceCookie1 && deviceCookie1.rawHeader.includes('HttpOnly'), 'rw_did cookie must be HttpOnly');

      await sleep(2600); // Satisfy human timing check (>= 2.5s)

      const postRes = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': deviceCookie1.cookiePair,
          'X-Forwarded-For': '198.51.100.10'
        },
        body: JSON.stringify({
          name: 'Blocked Visitor',
          email: 'visitor@example-test.com',
          type: 'general_contact',
          service_requested: 'general',
          details: { message: 'Hello while coming soon', subject: 'general' },
          _ft: sharedFormToken,
          turnstileToken: 'test-pass-token'
        })
      });
      assert.strictEqual(postRes.status, 403, 'Public inquiry during Coming Soon must return 403');
    });

    // 4. Admin Auth: Reject Forged Unsigned Base64 & Tampered HMAC Tokens
    await step('4. Forged unsigned Base64 and tampered HMAC admin tokens are rejected (401)', async () => {
      const legacyForged = Buffer.from('info@rockwelltaxdigital.com:9999999999999').toString('base64');
      const res1 = await fetch(`${baseUrl}/api/inquiries`, {
        headers: { Authorization: `Bearer ${legacyForged}` }
      });
      assert.strictEqual(res1.status, 401);

      const tampered = `${crypto.randomUUID()}.${Date.now() + 60000}.aW5mb0Byb2Nrd2VsbHRheGRpZ2l0YWwuY29t.${'a'.repeat(64)}`;
      const res2 = await fetch(`${baseUrl}/api/inquiries`, {
        headers: { Cookie: `rw_admin_session=${tampered}` }
      });
      assert.strictEqual(res2.status, 401);
    });

    // 5. Admin Login, HttpOnly Strict Cookie, CSRF Enforcement & Admin Preview Submission
    let adminCookie = null;
    let adminCsrf = null;
    await step('5. Admin login issues HttpOnly Strict cookie + CSRF token & unlocks Admin Preview', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.1' },
        body: JSON.stringify({ email: testAdminEmail, password: testAdminPass })
      });
      assert.strictEqual(loginRes.status, 200);
      const loginData = await loginRes.json();
      assert(loginData.csrfToken && loginData.csrfToken.length === 64);
      adminCsrf = loginData.csrfToken;

      adminCookie = extractCookieValue(loginRes.headers.getSetCookie(), 'rw_admin_session');
      assert(adminCookie, 'rw_admin_session cookie must be issued');
      assert(adminCookie.rawHeader.includes('HttpOnly'), 'Admin cookie must be HttpOnly');
      assert(adminCookie.rawHeader.includes('SameSite=Strict'), 'Admin cookie must be SameSite=Strict');
      assert(adminCookie.rawHeader.includes('Max-Age=43200'), 'Admin cookie Max-Age must be 43200');

      // Verify ?preview=admin works ONLY when authenticated
      const authedPreview = await fetch(`${baseUrl}/?preview=admin`, {
        headers: { Cookie: adminCookie.cookiePair }
      });
      const authedHtml = await authedPreview.text();
      assert(authedHtml.includes('Your Finances. Our Expertise.'), 'Authenticated admin preview must serve live index.html');

      // Verify state-changing POST without CSRF is rejected with 403
      const noCsrfRes = await fetch(`${baseUrl}/api/site-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie.cookiePair
        },
        body: JSON.stringify({ status: 'published' })
      });
      assert.strictEqual(noCsrfRes.status, 403, 'Missing X-CSRF-Token must return 403');

      // Publish live with valid CSRF
      const pubRes = await fetch(`${baseUrl}/api/site-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie.cookiePair,
          'X-CSRF-Token': adminCsrf
        },
        body: JSON.stringify({ status: 'published' })
      });
      assert.strictEqual(pubRes.status, 200);
    });

    // Helper to obtain a fresh signed rw_did cookie + form token
    async function initFreshFormClient(ip) {
      const r = await fetch(`${baseUrl}/api/inquiries?action=config`, {
        headers: { 'X-Forwarded-For': ip }
      });
      const d = await r.json();
      const c = extractCookieValue(r.headers.getSetCookie(), 'rw_did');
      return { formToken: d.formToken, cookiePair: c.cookiePair };
    }

    // 6. Test All 3 Forms (Contact, Tax Return, Firm Support) + Shared Public IP + Dotted Gmail
    let firstClientSession = null;
    await step('6. Contact, Tax Return, and Firm Support forms succeed for 3 users sharing 1 corporate IP (including dotted Gmail)', async () => {
      const sharedOfficeIp = '203.0.113.88';
      const c1 = await initFreshFormClient(sharedOfficeIp);
      const c2 = await initFreshFormClient(sharedOfficeIp);
      const c3 = await initFreshFormClient(sharedOfficeIp);
      firstClientSession = c1;

      await sleep(2600);

      // Form 1: Contact (with legitimate multi-dot Gmail!)
      const resContact = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: c1.cookiePair,
          'X-Forwarded-For': sharedOfficeIp,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          name: 'Maria Clara Santos',
          email: 'm.a.r.i.a.santos@gmail.com',
          type: 'bookkeeping',
          service_requested: 'bookkeeping',
          details: {
            fullName: 'Maria Clara Santos',
            email: 'm.a.r.i.a.santos@gmail.com',
            subject: 'bookkeeping',
            message: 'Looking for monthly managed bookkeeping for our retail store.'
          },
          _ft: c1.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(resContact.status, 201, 'Contact form with dotted Gmail on shared IP must succeed');

      // Form 2: Start Your Tax Return
      const resTax = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: c2.cookiePair,
          'X-Forwarded-For': sharedOfficeIp,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          name: 'David Miller',
          email: 'david.miller@example-test.com',
          type: '1099_tax',
          service_requested: 'Self-Employed / 1099 Tax Return',
          details: {
            fullName: 'David Miller',
            email: 'david.miller@example-test.com',
            taxYear: '2026',
            filingStatus: 'mfj',
            w2Count: '1-6',
            selfEmployed: 'yes',
            otherIncome: 'no',
            states: 'California and New York'
          },
          _ft: c2.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(resTax.status, 201, 'Tax Return form on shared IP must succeed');

      // Form 3: Tax Firm Support
      const resFirm = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: c3.cookiePair,
          'X-Forwarded-For': sharedOfficeIp,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          name: 'Apex CPA Group (Robert Chen, CPA)',
          email: 'rchen@silvacpa-test.com',
          phone: '(415) 555-0192',
          type: 'firm_support',
          service_requested: 'Firm Support (Multi-Partner CPA Firm)',
          details: {
            practiceName: 'Apex CPA Group',
            fullName: 'Robert Chen, CPA',
            email: 'rchen@silvacpa-test.com',
            phone: '(415) 555-0192',
            firmType: 'Multi-Partner CPA Firm',
            software: 'Intuit Lacerte',
            volume: '30 hours/week',
            message: 'Need peak season 1040 & 1065 preparation support.'
          },
          _ft: c3.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(resFirm.status, 201, 'Tax Firm Support form must succeed and save to DB');
    });

    // 7. Test 24-Hour Per-Device & Per-Email Restrictions
    await step('7. Repeat submissions within 24h from same Device Cookie OR same Email return 429 + followUpEmail', async () => {
      // Same device cookie (c1), brand new email & IP
      const sameDeviceRes = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: firstClientSession.cookiePair,
          'X-Forwarded-For': '198.51.100.200'
        },
        body: JSON.stringify({
          name: 'Maria Clara Santos',
          email: 'maria.second.email@example-test.com',
          type: 'digital_services',
          service_requested: 'digital-services',
          details: { message: 'Also asking about reels creation.', subject: 'digital-services' },
          _ft: firstClientSession.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(sameDeviceRes.status, 429);
      const sameDevData = await sameDeviceRes.json();
      assert.strictEqual(sameDevData.code, 'RATE_LIMIT_24H');
      assert.strictEqual(sameDevData.followUpEmail, 'info@rockwelltaxdigital.com');

      // Fresh device cookie, but existing email (david.miller@example-test.com)
      const freshDev = await initFreshFormClient('198.51.100.201');
      await sleep(2600);
      const sameEmailRes = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: freshDev.cookiePair,
          'X-Forwarded-For': '198.51.100.201'
        },
        body: JSON.stringify({
          name: 'David Miller',
          email: 'DAVID.MILLER@example-test.com',
          type: 'general_contact',
          service_requested: 'general',
          details: { message: 'Duplicate email inquiry within 24 hours.', subject: 'general' },
          _ft: freshDev.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(sameEmailRes.status, 429);
    });

    // 8. Concurrent Race-Condition Test (PostgreSQL Advisory Locks)
    await step('8. Concurrent simultaneous submissions are serialized atomically (1 x 201, 4 x 429)', async () => {
      const raceSession = await initFreshFormClient('198.51.100.222');
      await sleep(2600);

      const concurrentPayload = JSON.stringify({
        name: 'Concurrent Race Tester',
        email: 'race.condition.tester@example-test.com',
        type: 'general_contact',
        service_requested: 'general',
        details: { message: 'Testing simultaneous race condition requests.', subject: 'general' },
        _ft: raceSession.formToken,
        turnstileToken: 'valid-dev-token'
      });

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          fetch(`${baseUrl}/api/inquiries`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: raceSession.cookiePair,
              'X-Forwarded-For': '198.51.100.222'
            },
            body: concurrentPayload
          })
        )
      );

      const statuses = responses.map((r) => r.status).sort();
      assert.deepStrictEqual(statuses, [201, 429, 429, 429, 429], `Expected [201, 429, 429, 429, 429], got ${JSON.stringify(statuses)}`);
    });

    // 9. Strict SSN Rejection + Zero Sensitive Storage in Audit Logs
    await step('9. SSN-like data is rejected (400) and NEVER stored in inquiries or security_audit_logs', async () => {
      const ssnSession = await initFreshFormClient('198.51.100.99');
      await sleep(2600);
      const fakeSsn = '432-55-9876';

      const ssnRes = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ssnSession.cookiePair,
          'X-Forwarded-For': '198.51.100.99'
        },
        body: JSON.stringify({
          name: 'SSN Test Client',
          email: 'ssn.client@example-test.com',
          type: 'general_contact',
          service_requested: 'general',
          details: { message: `My number is ${fakeSsn} please check`, subject: 'general' },
          _ft: ssnSession.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(ssnRes.status, 400);

      const auditLeakCheck = await ownerClient.query(
        `SELECT COUNT(*)::int AS cnt FROM security_audit_logs WHERE metadata::text LIKE $1`,
        [`%${fakeSsn}%`]
      );
      assert.strictEqual(auditLeakCheck.rows[0].cnt, 0, 'SSN must NEVER appear in security_audit_logs');
    });

    // 10. Bot Spam Signatures, Honeypot & Speed Trap
    await step('10. Honeypot, <2.5s speed trap, gibberish state, and Tor bot signatures are blocked (400)', async () => {
      const botSession = await initFreshFormClient('185.220.101.99');

      // Instant (<2.5s) check
      const fastRes = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: botSession.cookiePair, 'X-Forwarded-For': '185.220.101.99' },
        body: JSON.stringify({
          name: 'Fast Bot',
          email: 'fast@example-test.com',
          type: 'general_contact',
          details: { message: 'Instant submit' },
          _ft: botSession.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(fastRes.status, 400);

      await sleep(2600);

      // Honeypot check
      const hpRes = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: botSession.cookiePair, 'X-Forwarded-For': '185.220.101.99' },
        body: JSON.stringify({
          name: 'Honeypot Bot',
          email: 'hp@example-test.com',
          type: 'general_contact',
          details: { message: 'Valid looking message' },
          _hp: 'https://bot-link.biz',
          _ft: botSession.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(hpRes.status, 400);

      // Exact Tor Bot Signature #1 (Contact numeric message + consonant name + dotted gmail)
      const torRes1 = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: botSession.cookiePair, 'X-Forwarded-For': '185.220.101.99' },
        body: JSON.stringify({
          name: 'Vucoydy',
          email: 'ckb.i.gb.oss8.5@gmail.com',
          type: 'w2_tax',
          service_requested: 'tax-inquiry',
          details: { fullName: 'Vucoydy', email: 'ckb.i.gb.oss8.5@gmail.com', subject: 'tax-inquiry', message: '6795321893' },
          _ft: botSession.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(torRes1.status, 400);

      // Exact Tor Bot Signature #2 (Gibberish non-US state)
      const torRes2 = await fetch(`${baseUrl}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: botSession.cookiePair, 'X-Forwarded-For': '185.220.101.99' },
        body: JSON.stringify({
          name: 'Nrgul',
          email: 'ckb.i.gb.oss8.5@gmail.com',
          type: 'w2_tax',
          service_requested: 'Individual Tax Return (W-2)',
          details: { fullName: 'Nrgul', states: 'Yvnkxc', taxYear: '2026', w2Count: '7+', filingStatus: 'not-sure', selfEmployed: 'not-sure', otherIncome: 'not-sure' },
          _ft: botSession.formToken,
          turnstileToken: 'valid-dev-token'
        })
      });
      assert.strictEqual(torRes2.status, 400);
    });

    // 11. Turnstile Invalid Token & Production Fail-Closed Check
    await step('11. Turnstile rejects missing/failed tokens and fails closed in production if secret missing', async () => {
      // Missing token
      const missRes = await verifyTurnstileToken({ token: '', remoteIp: '203.0.113.1', expectedAction: 'contact_inquiry' });
      assert.strictEqual(missRes.ok, false);
      assert.strictEqual(missRes.statusCode, 400);

      // Cloudflare official always-fail secret key
      const prevDevSecret = process.env.DEV_TURNSTILE_SECRET_KEY;
      process.env.DEV_TURNSTILE_SECRET_KEY = '2x0000000000000000000000000000000AA';
      const failTokenRes = await verifyTurnstileToken({ token: 'invalid-token', remoteIp: '203.0.113.1', expectedAction: 'contact_inquiry' });
      process.env.DEV_TURNSTILE_SECRET_KEY = prevDevSecret;
      assert.strictEqual(failTokenRes.ok, false);
      assert.strictEqual(failTokenRes.statusCode, 400);

      // Production fail-closed when TURNSTILE_SECRET_KEY is missing
      process.env.NODE_ENV = 'production';
      const savedProdSecret = process.env.TURNSTILE_SECRET_KEY;
      delete process.env.TURNSTILE_SECRET_KEY;
      const prodFailClosed = await verifyTurnstileToken({ token: 'some-token', remoteIp: '203.0.113.1', expectedAction: 'contact_inquiry' });
      if (savedProdSecret) process.env.TURNSTILE_SECRET_KEY = savedProdSecret;
      process.env.NODE_ENV = 'development';
      assert.strictEqual(prodFailClosed.ok, false);
      assert.strictEqual(prodFailClosed.statusCode, 503);
    });

    // 12. Password Reset 6-Digit Brute-Force Invalidation & Session Logout Revocation
    await step('12. Password reset invalidates 6-digit code after 5 wrong guesses & logout revokes session', async () => {
      await ownerClient.query(
        `INSERT INTO password_resets (email, code, expires_at, used, failed_attempts)
         VALUES ($1, '849201', NOW() + INTERVAL '2 minutes', false, 0)`,
        [testAdminEmail]
      );

      for (let i = 1; i <= 5; i++) {
        const wrongRes = await fetch(`${baseUrl}/api/auth?action=verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.77' },
          body: JSON.stringify({ email: testAdminEmail, code: '000000' })
        });
        assert(wrongRes.status === 400 || wrongRes.status === 429);
      }

      // 6th attempt WITH the real code must fail because the code was invalidated & rate-locked
      const realCodeAfterBrute = await fetch(`${baseUrl}/api/auth?action=verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.78' },
        body: JSON.stringify({ email: testAdminEmail, code: '849201' })
      });
      assert.strictEqual(realCodeAfterBrute.status, 400, 'Code must be permanently marked used=true after 5 failures');

      // Test Logout revoking active admin session immediately
      const logoutRes = await fetch(`${baseUrl}/api/auth?action=logout`, {
        method: 'POST',
        headers: {
          Cookie: adminCookie.cookiePair,
          'X-CSRF-Token': adminCsrf
        }
      });
      assert.strictEqual(logoutRes.status, 200);

      const postLogoutGet = await fetch(`${baseUrl}/api/inquiries`, {
        headers: { Cookie: adminCookie.cookiePair }
      });
      assert.strictEqual(postLogoutGet.status, 401, 'Revoked session cookie must be rejected with 401 after logout');
    });

    // 13. Built-in Cryptographic SVG CAPTCHA Verification & Replay Protection
    await step('13. Built-in SVG CAPTCHA rejects wrong/tampered/fast/replayed codes & accepts valid code once', async () => {
      // Verify /api/inquiries?action=config returns captcha mode + SVG image when live Turnstile keys are unset
      const cfgRes = await fetch(`${baseUrl}/api/inquiries?action=config&formAction=contact_inquiry`);
      const cfgJson = await cfgRes.json();
      assert.strictEqual(cfgJson.securityMode, 'captcha');
      assert(cfgJson.captcha && cfgJson.captcha.svgDataUri.startsWith('data:image/svg+xml;base64,'));
      assert(!cfgJson.captcha._testAnswer, 'Raw CAPTCHA answer must never be exposed over HTTP');

      // Generate internal test challenge to test verification & replay protection
      process.env.NODE_ENV = 'test_captcha_internal';
      const challenge = createCaptchaChallenge({ action: 'contact_inquiry' });
      process.env.NODE_ENV = 'development';
      assert(challenge._testAnswer && challenge._testAnswer.length === 5);

      // Instant solve (<1.2s) must be rejected
      const tooFastRes = await verifyCaptchaChallenge({
        captchaToken: challenge.challengeToken,
        captchaAnswer: challenge._testAnswer,
        expectedAction: 'contact_inquiry',
        remoteIp: '203.0.113.55'
      });
      assert.strictEqual(tooFastRes.ok, false);
      assert.strictEqual(tooFastRes.reason, 'captcha_solved_too_fast');

      await sleep(1300);

      // Wrong answer must be rejected without consuming the challenge
      const wrongAnsRes = await verifyCaptchaChallenge({
        captchaToken: challenge.challengeToken,
        captchaAnswer: 'ZZZZZ',
        expectedAction: 'contact_inquiry',
        remoteIp: '203.0.113.55'
      });
      assert.strictEqual(wrongAnsRes.ok, false);
      assert.strictEqual(wrongAnsRes.reason, 'captcha_wrong_answer');

      // Tampered token signature must be rejected
      const tamperedRes = await verifyCaptchaChallenge({
        captchaToken: challenge.challengeToken.slice(0, -4) + 'ffff',
        captchaAnswer: challenge._testAnswer,
        expectedAction: 'contact_inquiry',
        remoteIp: '203.0.113.55'
      });
      assert.strictEqual(tamperedRes.ok, false);
      assert.strictEqual(tamperedRes.reason, 'captcha_signature_mismatch');

      // Correct answer (case-insensitive) succeeds once
      const validRes = await verifyCaptchaChallenge({
        captchaToken: challenge.challengeToken,
        captchaAnswer: challenge._testAnswer.toLowerCase(),
        expectedAction: 'contact_inquiry',
        remoteIp: '203.0.113.55'
      });
      assert.strictEqual(validRes.ok, true);

      // Second replay of the exact same solved challenge must be rejected
      const replayRes = await verifyCaptchaChallenge({
        captchaToken: challenge.challengeToken,
        captchaAnswer: challenge._testAnswer,
        expectedAction: 'contact_inquiry',
        remoteIp: '203.0.113.55'
      });
      assert.strictEqual(replayRes.ok, false);
      assert.strictEqual(replayRes.reason, 'captcha_replayed');
    });

    console.log(`\n🎉 ALL ${passed}/13 SECURITY & CONCURRENCY VERIFICATION SUITES PASSED!`);
  } finally {
    await ownerClient.query('TRUNCATE TABLE inquiry_rate_limits, admin_sessions, password_resets, login_rate_limits RESTART IDENTITY CASCADE').catch(() => {});
    await ownerClient.query(`DELETE FROM inquiries WHERE email LIKE '%@example-test.com' OR email = 'm.a.r.i.a.santos@gmail.com' OR email = 'rchen@silvacpa-test.com'`).catch(() => {});
    await ownerClient.end();
    await db.pool.end();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Security verification suite failed:', err.message);
  process.exit(1);
});
