const db = require('../lib/db');
const { INQUIRY_NOTIFICATION_EMAIL, sendClientConfirmation, sendAdminNotification } = require('../lib/email');
const {
  getClientIp,
  computeSupplementaryFingerprint,
  getOrIssueDeviceCookie,
  createSignedFormToken,
  verifySignedFormToken,
  verifyAdminSession,
  deriveAdvisoryLockPair,
  sortAdvisoryLockPairs
} = require('../lib/auth-token');
const { hasLiveTurnstileConfig, getTurnstileSiteKey, verifyTurnstileToken } = require('../lib/turnstile');
const { createCaptchaChallenge, verifyCaptchaChallenge } = require('../lib/captcha');
const {
  detectSensitiveSsnData,
  evaluateInquirySubmission,
  getExpectedTurnstileAction
} = require('../lib/spam-filter');
const { logSecurityEvent } = require('../lib/audit');

const ALLOWED_STATUS_UPDATES = new Set([
  'new',
  'reviewed',
  'contacted',
  'completed',
  'spam_archived'
]);

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    if (req.body.length > 32768) return null;
    try { return JSON.parse(req.body); } catch (_) {}
  }
  return {};
}

function applyCorsHeaders(req, res) {
  const origin = req.headers?.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
}

module.exports = async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = String(req.query?.action || '').toLowerCase();

  // ── 0. PUBLIC FORM CONFIG & SIGNED DEVICE COOKIE INIT (GET ?action=config) ──
  if (req.method === 'GET' && action === 'config') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      getOrIssueDeviceCookie(req, res);
      const formToken = createSignedFormToken();
      const liveTurnstile = hasLiveTurnstileConfig();
      const siteKey = liveTurnstile ? getTurnstileSiteKey() : null;
      const formAction = String(req.query?.formAction || 'general').trim();
      const captchaPayload = liveTurnstile
        ? null
        : createCaptchaChallenge({ action: formAction });
      if (captchaPayload) {
        delete captchaPayload._testAnswer;
      }

      return res.status(200).json({
        success: true,
        securityMode: liveTurnstile ? 'turnstile' : 'captcha',
        turnstileSiteKey: siteKey,
        captcha: captchaPayload,
        formToken,
        followUpEmail: INQUIRY_NOTIFICATION_EMAIL
      });
    } catch (err) {
      console.error('Form config init error:', err.message);
      return res.status(500).json({ error: 'Unable to initialize form security configuration.' });
    }
  }

  // ── 0b. REFRESH BUILT-IN CAPTCHA CHALLENGE (GET ?action=captcha) ──
  if (req.method === 'GET' && action === 'captcha') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      getOrIssueDeviceCookie(req, res);
      const formAction = String(req.query?.formAction || 'general').trim();
      const captchaPayload = createCaptchaChallenge({ action: formAction });
      delete captchaPayload._testAnswer;
      return res.status(200).json({
        success: true,
        captcha: captchaPayload
      });
    } catch (err) {
      console.error('CAPTCHA refresh error:', err.message);
      return res.status(500).json({ error: 'Unable to generate a new security code.' });
    }
  }

  // ── 1. GET /api/inquiries (List Inquiries - Admin Only) ───────
  if (req.method === 'GET') {
    const auth = await verifyAdminSession(req, { requireCsrf: false });
    if (!auth.ok) {
      return res.status(auth.statusCode).json({ error: auth.error });
    }

    try {
      const { type, status, search, includeArchived } = req.query || {};
      let query = 'SELECT * FROM inquiries WHERE 1=1';
      const params = [];

      if (type && type !== 'all') {
        params.push(type);
        query += ` AND type = $${params.length}`;
      }

      if (status && status !== 'all') {
        params.push(status);
        query += ` AND status = $${params.length}`;
      } else if (includeArchived !== 'true') {
        query += ` AND status != 'spam_archived'`;
      }

      if (search) {
        params.push(`%${String(search).slice(0, 100)}%`);
        query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`;
      }

      query += ' ORDER BY created_at DESC LIMIT 200';

      const result = await db.query(query, params);
      return res.status(200).json({ inquiries: result.rows });
    } catch (err) {
      console.error('Error fetching inquiries:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve inquiries' });
    }
  }

  // ── 2. POST /api/inquiries (Submit New Verified Inquiry) ──────
  if (req.method === 'POST') {
    const body = parseBody(req);
    if (!body || typeof body !== 'object') {
      return res.status(413).json({ error: 'Invalid or oversized request payload.' });
    }

    if (JSON.stringify(body).length > 32768) {
      return res.status(413).json({ error: 'Request payload exceeds 32KB limit.' });
    }

    const ip = getClientIp(req);
    let deviceInfo;
    try {
      deviceInfo = getOrIssueDeviceCookie(req, res);
    } catch (err) {
      console.error('Device cookie error:', err.message);
      return res.status(503).json({ error: 'Security configuration error.' });
    }

    const fpHash = computeSupplementaryFingerprint(req);

    // Step A: Server-Side Coming Soon Protection (Admin Preview requires verified server session)
    try {
      const pubRes = await db.query(`
        SELECT
          NOW() AT TIME ZONE 'UTC' AS db_time,
          (SELECT value FROM site_settings WHERE key = 'publishing') AS value
      `);
      const dbNow = new Date(pubRes.rows[0]?.db_time || Date.now()).getTime();
      const pubSetting = pubRes.rows[0]?.value || { status: 'coming_soon' };
      const isSiteLive =
        pubSetting.status === 'published' ||
        (pubSetting.status === 'scheduled' &&
         pubSetting.scheduled_at &&
         new Date(pubSetting.scheduled_at).getTime() <= dbNow);

      if (!isSiteLive && process.env.COMING_SOON_BLOCK_INQUIRIES === 'true') {
        const adminCheck = await verifyAdminSession(req, { requireCsrf: false });
        if (!adminCheck.ok) {
          await logSecurityEvent({
            eventType: 'inquiry_blocked_coming_soon',
            severity: 'warn',
            ipAddress: ip,
            deviceHash: deviceInfo.deviceHash,
            metadata: { siteStatus: pubSetting.status }
          });
          return res.status(403).json({
            error: 'The website is currently in Coming Soon mode and is not accepting public form submissions yet.'
          });
        }
      }
    } catch (err) {
      console.error('Coming soon verification error:', err.message);
      return res.status(503).json({ error: 'Unable to verify site availability.' });
    }

    // Step B: Honeypot Verification
    const hp1 = String(body._hp || body.details?._hp || '').trim();
    const hp2 = String(body.website_url || body.details?.website_url || '').trim();
    if (hp1 || hp2) {
      await logSecurityEvent({
        eventType: 'inquiry_rejected_honeypot',
        severity: 'warn',
        ipAddress: ip,
        deviceHash: deviceInfo.deviceHash,
        metadata: { reason: 'honeypot_filled' }
      });
      return res.status(400).json({ error: 'Unable to process submission.' });
    }

    // Step C: Signed Form Interaction Timing Verification (>= 2.5s)
    const timerCheck = verifySignedFormToken(body._ft);
    if (!timerCheck.valid) {
      await logSecurityEvent({
        eventType: 'inquiry_rejected_timing',
        severity: 'warn',
        ipAddress: ip,
        deviceHash: deviceInfo.deviceHash,
        metadata: { reason: timerCheck.reason, elapsedMs: timerCheck.elapsedMs || 0 }
      });
      return res.status(400).json({
        error: timerCheck.reason === 'form_token_expired'
          ? 'Your form session expired. Please refresh the page and submit again.'
          : 'Please take a moment to complete the form before submitting.'
      });
    }

    // Step D: Strict SSN / Sensitive Tax ID Protection (Reject without logging sensitive text)
    const ssnCheck = detectSensitiveSsnData(body);
    if (ssnCheck.detected) {
      await logSecurityEvent({
        eventType: 'inquiry_rejected_sensitive_data',
        severity: 'warn',
        ipAddress: ip,
        deviceHash: deviceInfo.deviceHash,
        metadata: { reason: 'ssn_pattern_detected', fieldName: ssnCheck.fieldName }
      });
      return res.status(400).json({
        error: 'Security Protection: We detected a number resembling a Social Security Number (SSN) or Tax ID. For your protection, please remove it before submitting. Sensitive tax documents are collected only through our separate encrypted portal after your quote is confirmed.'
      });
    }

    // Step E: Human Security Challenge Verification
    // - Uses live Cloudflare Turnstile when production site+secret keys are configured
    // - Uses Rockwell's built-in cryptographic SVG CAPTCHA in production / browser forms otherwise
    const expectedAction = getExpectedTurnstileAction(body);
    const liveTurnstile = hasLiveTurnstileConfig();

    if (liveTurnstile) {
      const turnstileRes = await verifyTurnstileToken({
        token: body.turnstileToken,
        remoteIp: ip,
        expectedAction
      });

      if (!turnstileRes.ok) {
        await logSecurityEvent({
          eventType: 'turnstile_failed',
          severity: turnstileRes.statusCode >= 500 ? 'error' : 'warn',
          ipAddress: ip,
          deviceHash: deviceInfo.deviceHash,
          metadata: {
            reason: turnstileRes.reason,
            expectedAction,
            errorCodes: turnstileRes.errorCodes || []
          }
        });
        return res.status(turnstileRes.statusCode).json({ error: turnstileRes.error });
      }
    } else if (body.captchaToken || process.env.NODE_ENV === 'production') {
      const captchaRes = await verifyCaptchaChallenge({
        captchaToken: body.captchaToken,
        captchaAnswer: body.captchaAnswer,
        expectedAction,
        remoteIp: ip,
        deviceHash: deviceInfo.deviceHash
      });

      if (!captchaRes.ok) {
        await logSecurityEvent({
          eventType: 'turnstile_failed',
          severity: captchaRes.statusCode >= 500 ? 'error' : 'warn',
          ipAddress: ip,
          deviceHash: deviceInfo.deviceHash,
          metadata: {
            provider: 'rockwell_captcha',
            reason: captchaRes.reason,
            expectedAction
          }
        });
        return res.status(captchaRes.statusCode).json({ error: captchaRes.error });
      }
    } else {
      const turnstileRes = await verifyTurnstileToken({
        token: body.turnstileToken,
        remoteIp: ip,
        expectedAction
      });

      if (!turnstileRes.ok) {
        await logSecurityEvent({
          eventType: 'turnstile_failed',
          severity: turnstileRes.statusCode >= 500 ? 'error' : 'warn',
          ipAddress: ip,
          deviceHash: deviceInfo.deviceHash,
          metadata: {
            reason: turnstileRes.reason,
            expectedAction,
            errorCodes: turnstileRes.errorCodes || []
          }
        });
        return res.status(turnstileRes.statusCode).json({ error: turnstileRes.error });
      }
    }

    // Step F: Gather Supplementary Risk Context & Evaluate Schema + Composite Risk Score
    let supplementaryFpMatched = false;
    let recentIpRejections = 0;
    try {
      if (fpHash) {
        const fpCheck = await db.query(
          `SELECT 1 FROM inquiry_rate_limits
           WHERE ip_address = $1 AND fp_hash = $2
             AND created_at > NOW() - INTERVAL '24 hours'
           LIMIT 1`,
          [String(ip), fpHash]
        );
        supplementaryFpMatched = fpCheck.rows.length > 0;
      }

      const rejCheck = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM security_audit_logs
         WHERE ip_address = $1
           AND event_type IN ('inquiry_rejected_honeypot', 'inquiry_rejected_timing', 'turnstile_failed', 'inquiry_rejected_spam')
           AND created_at > NOW() - INTERVAL '15 minutes'`,
        [String(ip)]
      );
      recentIpRejections = rejCheck.rows[0]?.cnt || 0;
    } catch (_) {}

    const evalResult = evaluateInquirySubmission(body, {
      elapsedMs: timerCheck.elapsedMs,
      supplementaryFpMatched,
      recentIpRejections
    });

    if (!evalResult.valid) {
      await logSecurityEvent({
        eventType: 'inquiry_rejected_spam',
        severity: 'warn',
        ipAddress: ip,
        deviceHash: deviceInfo.deviceHash,
        metadata: {
          reason: evalResult.reason,
          riskScore: evalResult.riskScore || 0,
          signals: evalResult.riskSignals || []
        }
      });
      return res.status(400).json({ error: evalResult.error });
    }

    const clean = evalResult.cleanPayload;

    // Step G: Atomic Concurrency-Safe Rate Limit Enforcement & Inquiry Creation
    const client = await db.getClient();
    let savedInquiry = null;

    try {
      await client.query('BEGIN');

      // Acquire deterministic sorted PostgreSQL transactional advisory locks
      const lockPairs = sortAdvisoryLockPairs([
        deriveAdvisoryLockPair('device', deviceInfo.deviceHash),
        deriveAdvisoryLockPair('email', clean.emailNormalized),
        deriveAdvisoryLockPair('ip', ip)
      ]);

      for (const [classId, objId] of lockPairs) {
        await client.query('SELECT pg_advisory_xact_lock($1, $2)', [classId, objId]);
      }

      // 1. Primary Signed HttpOnly Device Cookie 24-Hour Limit (1 inquiry / 24h)
      const deviceLimitRes = await client.query(
        `SELECT created_at FROM inquiry_rate_limits
         WHERE device_hash = $1 AND created_at > NOW() - INTERVAL '24 hours'
         ORDER BY created_at DESC LIMIT 1`,
        [deviceInfo.deviceHash]
      );

      if (deviceLimitRes.rows.length > 0) {
        await logSecurityEvent({
          eventType: 'inquiry_rate_limited',
          severity: 'info',
          actorEmail: clean.emailNormalized,
          ipAddress: ip,
          deviceHash: deviceInfo.deviceHash,
          metadata: { scope: 'device_24h' },
          client
        });
        await client.query('COMMIT');
        return res.status(429).json({
          error: 'You have already submitted an inquiry from this device within the last 24 hours.',
          code: 'RATE_LIMIT_24H',
          followUpEmail: INQUIRY_NOTIFICATION_EMAIL
        });
      }

      // 2. Normalized Email Address 24-Hour Limit (1 inquiry / 24h)
      const emailLimitRes = await client.query(
        `SELECT created_at FROM inquiry_rate_limits
         WHERE email_normalized = $1 AND created_at > NOW() - INTERVAL '24 hours'
         ORDER BY created_at DESC LIMIT 1`,
        [clean.emailNormalized]
      );

      if (emailLimitRes.rows.length > 0) {
        await logSecurityEvent({
          eventType: 'inquiry_rate_limited',
          severity: 'info',
          actorEmail: clean.emailNormalized,
          ipAddress: ip,
          deviceHash: deviceInfo.deviceHash,
          metadata: { scope: 'email_24h' },
          client
        });
        await client.query('COMMIT');
        return res.status(429).json({
          error: 'An inquiry using this email address has already been submitted within the last 24 hours.',
          code: 'RATE_LIMIT_24H',
          followUpEmail: INQUIRY_NOTIFICATION_EMAIL
        });
      }

      // 3. Adaptive Shared-IP Rate Limit (protects corporate & household Wi-Fi while stopping IP floods)
      const ipStatsRes = await client.query(
        `SELECT
           COUNT(*)::int AS count_24h,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '10 minutes')::int AS count_10m,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute')::int AS count_1m
         FROM inquiry_rate_limits
         WHERE ip_address = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [String(ip)]
      );

      const { count_24h = 0, count_10m = 0, count_1m = 0 } = ipStatsRes.rows[0] || {};
      const isSuspiciousIp = recentIpRejections >= 3;
      const maxIp24h = isSuspiciousIp ? 2 : 10;
      const maxIp10m = isSuspiciousIp ? 1 : 5;
      const maxIp1m = isSuspiciousIp ? 1 : 4;

      if (count_24h >= maxIp24h || count_10m >= maxIp10m || count_1m >= maxIp1m) {
        await logSecurityEvent({
          eventType: 'inquiry_rate_limited',
          severity: 'warn',
          actorEmail: clean.emailNormalized,
          ipAddress: ip,
          deviceHash: deviceInfo.deviceHash,
          metadata: { scope: 'adaptive_ip', count_24h, count_10m, count_1m, isSuspiciousIp },
          client
        });
        await client.query('COMMIT');
        return res.status(429).json({
          error: 'Too many submissions detected from your network recently. Please try again later or email info@rockwelltaxdigital.com directly.',
          code: 'RATE_LIMIT_IP',
          followUpEmail: INQUIRY_NOTIFICATION_EMAIL
        });
      }

      // 4. Insert Verified Inquiry + Rate Limit Entry + Audit Log Atomically
      const insertRes = await client.query(
        `INSERT INTO inquiries
          (type, name, email, phone, service_requested, details, ip_address, device_hash, risk_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          clean.type,
          clean.name,
          clean.email,
          clean.phone,
          clean.serviceRequested,
          JSON.stringify(clean.details),
          String(ip),
          deviceInfo.deviceHash,
          evalResult.riskScore
        ]
      );

      savedInquiry = insertRes.rows[0];

      await client.query(
        `INSERT INTO inquiry_rate_limits
          (inquiry_id, ip_address, device_hash, fp_hash, email_normalized, inquiry_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          savedInquiry.id,
          String(ip),
          deviceInfo.deviceHash,
          fpHash,
          clean.emailNormalized,
          clean.type
        ]
      );

      await logSecurityEvent({
        eventType: 'inquiry_submitted',
        severity: 'info',
        actorEmail: clean.emailNormalized,
        ipAddress: ip,
        deviceHash: deviceInfo.deviceHash,
        targetType: 'inquiry',
        targetId: savedInquiry.id,
        metadata: {
          inquiryType: clean.type,
          riskScore: evalResult.riskScore
        },
        client
      });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Error creating inquiry:', err.message);
      return res.status(500).json({ error: 'Database error saving inquiry' });
    } finally {
      client.release();
    }

    // Step H: Dispatch Client Confirmation & Exclusive info@rockwelltaxdigital.com Admin Notification
    const [clientEmailRes, adminEmailRes] = await Promise.allSettled([
      sendClientConfirmation({
        to: clean.email,
        name: clean.name,
        type: clean.type,
        details: clean.details
      }),
      sendAdminNotification({ inquiry: savedInquiry })
    ]);

    return res.status(201).json({
      success: true,
      message: 'Your inquiry has been submitted successfully. A confirmation email has been sent.',
      inquiryId: savedInquiry.id,
      emailStatus: {
        client: clientEmailRes.status === 'fulfilled' ? clientEmailRes.value : { success: false, error: 'Promise rejected' },
        admin: adminEmailRes.status === 'fulfilled' ? adminEmailRes.value : { success: false, error: 'Promise rejected' }
      }
    });
  }

  // ── 3. PATCH /api/inquiries (Update Status - Admin Only + CSRF) ──
  if (req.method === 'PATCH') {
    const auth = await verifyAdminSession(req, { requireCsrf: true });
    if (!auth.ok) {
      return res.status(auth.statusCode).json({ error: auth.error });
    }

    const body = parseBody(req) || {};
    const id = Number(body.id);
    const status = String(body.status || '').trim();

    if (!id || !Number.isInteger(id) || !ALLOWED_STATUS_UPDATES.has(status)) {
      return res.status(400).json({ error: 'Valid Inquiry ID and allowed status are required' });
    }

    try {
      const result = await db.query(
        `UPDATE inquiries
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Inquiry not found' });
      }

      await logSecurityEvent({
        eventType: 'admin_inquiry_status_changed',
        severity: 'info',
        actorEmail: auth.email,
        ipAddress: getClientIp(req),
        targetType: 'inquiry',
        targetId: id,
        metadata: { newStatus: status }
      });

      return res.status(200).json({ success: true, inquiry: result.rows[0] });
    } catch (err) {
      console.error('Error updating inquiry:', err.message);
      return res.status(500).json({ error: 'Failed to update inquiry status' });
    }
  }

  // ── 4. DELETE /api/inquiries (Delete Single Inquiry - Admin Only + CSRF) ──
  if (req.method === 'DELETE') {
    const auth = await verifyAdminSession(req, { requireCsrf: true });
    if (!auth.ok) {
      return res.status(auth.statusCode).json({ error: auth.error });
    }

    const body = parseBody(req) || {};
    const id = Number(req.query?.id || body?.id);

    if (!id || !Number.isInteger(id)) {
      return res.status(400).json({ error: 'A single numeric Inquiry ID is required for deletion.' });
    }

    try {
      const result = await db.query('DELETE FROM inquiries WHERE id = $1 RETURNING id, type', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Inquiry not found' });
      }

      await logSecurityEvent({
        eventType: 'admin_inquiry_deleted',
        severity: 'warn',
        actorEmail: auth.email,
        ipAddress: getClientIp(req),
        targetType: 'inquiry',
        targetId: id,
        metadata: { inquiryType: result.rows[0].type }
      });

      return res.status(200).json({
        success: true,
        message: `Inquiry #${id} deleted successfully`,
        deletedId: id
      });
    } catch (err) {
      console.error('Error deleting inquiry:', err.message);
      return res.status(500).json({ error: 'Failed to delete inquiry from database' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
