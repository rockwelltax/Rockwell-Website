const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../lib/db');
const { sendPasswordResetCode } = require('../lib/email');
const {
  getClientIp,
  safeEqualHex,
  getAllowedAdminEmails,
  createAdminSession,
  verifyAdminSession,
  revokeAdminSession
} = require('../lib/auth-token');
const { logSecurityEvent } = require('../lib/audit');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
}

module.exports = async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query?.action || '').toLowerCase();
  const ip = getClientIp(req);

  // ── 0. SESSION CHECK (GET ?action=session) ─────────────────
  if (req.method === 'GET' && action === 'session') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const auth = await verifyAdminSession(req, { requireCsrf: false });
    if (!auth.ok) {
      return res.status(401).json({ authenticated: false });
    }
    return res.status(200).json({
      success: true,
      authenticated: true,
      csrfToken: auth.csrfToken,
      user: { email: auth.email }
    });
  }

  // ── 1. LOGIN (POST ?action=login) ──────────────────────────
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = parseBody(req);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim();
    const cleanPassword = String(password).trim();

    try {
      const rateCheck = await db.query(
        `SELECT * FROM login_rate_limits
         WHERE ip_address = $1 AND LOWER(email) = LOWER($2)
           AND locked_until IS NOT NULL AND locked_until > NOW()`,
        [String(ip), cleanEmail]
      );

      if (rateCheck.rows.length > 0) {
        const row = rateCheck.rows[0];
        const remainingSecs = Math.max(1, Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000));
        return res.status(429).json({
          error: `Too many failed attempts. Account temporarily locked for security. Please try again in ${remainingSecs} seconds.`
        });
      }

      const allowedEmails = getAllowedAdminEmails();
      const userRes = await db.query(
        `SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [cleanEmail]
      );

      if (userRes.rows.length === 0 || !allowedEmails.has(cleanEmail.toLowerCase())) {
        await recordFailedAttempt(ip, cleanEmail);
        await logSecurityEvent({
          eventType: 'admin_login_failed',
          severity: 'warn',
          actorEmail: cleanEmail,
          ipAddress: ip,
          metadata: { reason: 'unknown_or_disallowed_email' }
        });
        return res.status(401).json({ error: 'Invalid email address or password' });
      }

      const adminUser = userRes.rows[0];
      let passwordMatch = await bcrypt.compare(password, adminUser.password_hash);
      if (!passwordMatch && password !== cleanPassword) {
        passwordMatch = await bcrypt.compare(cleanPassword, adminUser.password_hash);
      }

      if (!passwordMatch) {
        await recordFailedAttempt(ip, cleanEmail);
        await logSecurityEvent({
          eventType: 'admin_login_failed',
          severity: 'warn',
          actorEmail: adminUser.email,
          ipAddress: ip,
          metadata: { reason: 'invalid_password' }
        });
        return res.status(401).json({ error: 'Invalid email address or password' });
      }

      // Clear failed login rate limits
      await db.query(
        `DELETE FROM login_rate_limits WHERE ip_address = $1 AND LOWER(email) = LOWER($2)`,
        [String(ip), cleanEmail]
      );

      // Issue HMAC-SHA256 signed session + HttpOnly Strict cookie + CSRF token
      const session = await createAdminSession({
        email: adminUser.email,
        req,
        res
      });

      await logSecurityEvent({
        eventType: 'admin_login_success',
        severity: 'info',
        actorEmail: adminUser.email,
        ipAddress: ip,
        targetType: 'admin_session',
        targetId: session.sessionId
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
        user: { email: adminUser.email }
      });
    } catch (err) {
      console.error('Login error:', err.message);
      return res.status(500).json({ error: 'Internal server error during authentication' });
    }
  }

  // ── 2. LOGOUT (POST ?action=logout) ────────────────────────
  if (req.method === 'POST' && action === 'logout') {
    try {
      const auth = await verifyAdminSession(req, { requireCsrf: true });
      // Even if session already expired, allow clearing cookie safely if CSRF matches or not authenticated
      if (!auth.ok && auth.statusCode === 403) {
        return res.status(403).json({ error: auth.error });
      }

      const revoked = await revokeAdminSession(req, res);
      await logSecurityEvent({
        eventType: 'admin_logout',
        severity: 'info',
        actorEmail: revoked.email || auth.email || null,
        ipAddress: ip,
        targetType: 'admin_session',
        targetId: revoked.sessionId || auth.sessionId || null
      });

      return res.status(200).json({ success: true, message: 'Signed out successfully.' });
    } catch (err) {
      console.error('Logout error:', err.message);
      return res.status(500).json({ error: 'Failed to complete logout.' });
    }
  }

  // ── 3. FORGOT PASSWORD (POST ?action=forgot-password) ──────
  if (req.method === 'POST' && action === 'forgot-password') {
    const { email } = parseBody(req);
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const rateScope = `reset_req:${cleanEmail}`;
    try {
      const lockCheck = await checkScopedRateLock(ip, rateScope);
      if (lockCheck.locked) {
        return res.status(429).json({
          error: `Too many password reset requests. Please wait ${lockCheck.remainingSecs} seconds before requesting another code.`
        });
      }

      await recordFailedAttempt(ip, rateScope, 3, 15 * 60 * 1000);

      const allowedEmails = getAllowedAdminEmails();
      const userRes = await db.query(`SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);

      if (userRes.rows.length === 0 || !allowedEmails.has(cleanEmail)) {
        return res.status(200).json({
          success: true,
          message: 'If the email exists, a 6-digit code has been sent. It expires in 2 minutes.'
        });
      }

      const code = String(crypto.randomInt(100000, 1000000));
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

      await db.query(`UPDATE password_resets SET used = true WHERE LOWER(email) = LOWER($1)`, [cleanEmail]);
      await db.query(
        `INSERT INTO password_resets (email, code, expires_at, failed_attempts) VALUES ($1, $2, $3, 0)`,
        [cleanEmail, code, expiresAt]
      );

      await sendPasswordResetCode({ to: userRes.rows[0].email, code });

      await logSecurityEvent({
        eventType: 'admin_password_reset_requested',
        severity: 'info',
        actorEmail: cleanEmail,
        ipAddress: ip
      });

      return res.status(200).json({
        success: true,
        message: 'A 6-digit verification code has been sent to your email. It will expire in exactly 2 minutes.'
      });
    } catch (err) {
      console.error('Forgot password error:', err.message);
      return res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }

  // ── 4. VERIFY CODE (POST ?action=verify-code) ─────────────
  if (req.method === 'POST' && action === 'verify-code') {
    const { email, code } = parseBody(req);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const verifyCheck = await verifyResetCodeSafely({ email: cleanEmail, submittedCode: cleanCode, ip });
    if (!verifyCheck.ok) {
      return res.status(verifyCheck.statusCode).json({ error: verifyCheck.error });
    }

    return res.status(200).json({
      success: true,
      message: 'Code verified successfully. You may now enter your new password.'
    });
  }

  // ── 5. RESET PASSWORD (POST ?action=reset-password) ────────
  if (req.method === 'POST' && action === 'reset-password') {
    const { email, code, newPassword } = parseBody(req);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const cleanNewPassword = String(newPassword || '').trim();

    if (!cleanEmail || !cleanCode || !cleanNewPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }

    if (cleanNewPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long for security.' });
    }

    try {
      const verifyCheck = await verifyResetCodeSafely({ email: cleanEmail, submittedCode: cleanCode, ip });
      if (!verifyCheck.ok) {
        return res.status(verifyCheck.statusCode).json({ error: verifyCheck.error });
      }

      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(cleanNewPassword, salt);

      await db.query(
        `UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2)`,
        [hash, cleanEmail]
      );

      await db.query(`UPDATE password_resets SET used = true WHERE id = $1`, [verifyCheck.record.id]);

      // Revoke all active sessions for this user upon password reset
      await db.query(
        `UPDATE admin_sessions SET revoked_at = NOW() WHERE LOWER(email) = LOWER($1) AND revoked_at IS NULL`,
        [cleanEmail]
      );

      await db.query(
        `DELETE FROM login_rate_limits WHERE LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2)`,
        [cleanEmail, `reset_verify:${cleanEmail}`]
      );

      await logSecurityEvent({
        eventType: 'admin_password_reset_completed',
        severity: 'info',
        actorEmail: cleanEmail,
        ipAddress: ip
      });

      return res.status(200).json({
        success: true,
        message: 'Your password has been successfully updated! You can now log in.'
      });
    } catch (err) {
      console.error('Reset password error:', err.message);
      return res.status(500).json({ error: 'Failed to update password' });
    }
  }

  return res.status(404).json({ error: 'Action not found' });
};

async function checkScopedRateLock(ip, scopeKey) {
  const res = await db.query(
    `SELECT locked_until FROM login_rate_limits
     WHERE ip_address = $1 AND LOWER(email) = LOWER($2)
       AND locked_until IS NOT NULL AND locked_until > NOW()
     LIMIT 1`,
    [String(ip), String(scopeKey)]
  );
  if (res.rows.length === 0) return { locked: false };
  const remainingSecs = Math.max(1, Math.ceil((new Date(res.rows[0].locked_until).getTime() - Date.now()) / 1000));
  return { locked: true, remainingSecs };
}

async function verifyResetCodeSafely({ email, submittedCode, ip }) {
  const rateScope = `reset_verify:${email}`;
  const lockCheck = await checkScopedRateLock(ip, rateScope);
  if (lockCheck.locked) {
    return {
      ok: false,
      statusCode: 429,
      error: `Too many failed verification attempts. Locked for ${lockCheck.remainingSecs} seconds.`
    };
  }

  const resetRes = await db.query(
    `SELECT * FROM password_resets
     WHERE LOWER(email) = LOWER($1) AND used = false
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  );

  if (resetRes.rows.length === 0) {
    await recordFailedAttempt(ip, rateScope, 5, 15 * 60 * 1000);
    return { ok: false, statusCode: 400, error: 'Invalid or expired verification code.' };
  }

  const resetRecord = resetRes.rows[0];
  if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
    await db.query(`UPDATE password_resets SET used = true WHERE id = $1`, [resetRecord.id]);
    return {
      ok: false,
      statusCode: 400,
      error: 'This verification code has expired (2-minute limit exceeded). Please request a new code.'
    };
  }

  const expectedPadded = String(resetRecord.code || '').padEnd(6, ' ');
  const submittedPadded = String(submittedCode || '').slice(0, 6).padEnd(6, ' ');
  const isMatch = submittedCode.length === 6 && safeEqualHex(submittedPadded, expectedPadded);

  if (!isMatch) {
    const newFailures = (resetRecord.failed_attempts || 0) + 1;
    const shouldInvalidate = newFailures >= 5;
    await db.query(
      `UPDATE password_resets SET failed_attempts = $1, used = $2 WHERE id = $3`,
      [newFailures, shouldInvalidate, resetRecord.id]
    );
    await recordFailedAttempt(ip, rateScope, 5, 15 * 60 * 1000);

    await logSecurityEvent({
      eventType: 'admin_reset_code_failed',
      severity: 'warn',
      actorEmail: email,
      ipAddress: ip,
      metadata: { failedAttempts: newFailures, codeInvalidated: shouldInvalidate }
    });

    return {
      ok: false,
      statusCode: shouldInvalidate ? 429 : 400,
      error: shouldInvalidate
        ? 'Too many incorrect code attempts. This code has been invalidated for security; please request a new code.'
        : 'Invalid verification code. Please check and try again.'
    };
  }

  return { ok: true, record: resetRecord };
}

async function recordFailedAttempt(ip, email, maxAttempts = 5, lockoutMs = 5 * 60 * 1000) {
  try {
    const cleanIp = String(ip || 'unknown').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const now = Date.now();
    const WINDOW_MS = 15 * 60 * 1000;

    const existing = await db.query(
      `SELECT * FROM login_rate_limits WHERE ip_address = $1 AND LOWER(email) = LOWER($2)`,
      [cleanIp, cleanEmail]
    );

    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO login_rate_limits (ip_address, email, attempts, last_attempt) VALUES ($1, $2, 1, NOW())`,
        [cleanIp, cleanEmail]
      );
    } else {
      const row = existing.rows[0];
      const lastAttemptTime = row.last_attempt ? new Date(row.last_attempt).getTime() : 0;
      const lockedUntilTime = row.locked_until ? new Date(row.locked_until).getTime() : 0;

      let attempts = 1;
      if (lockedUntilTime > 0 && lockedUntilTime <= now) {
        attempts = 1;
      } else if (now - lastAttemptTime < WINDOW_MS) {
        attempts = (row.attempts || 0) + 1;
      } else {
        attempts = 1;
      }

      let lockedUntil = null;
      if (attempts >= maxAttempts) {
        lockedUntil = new Date(now + lockoutMs);
      }

      await db.query(
        `UPDATE login_rate_limits
         SET attempts = $1, locked_until = $2, last_attempt = NOW()
         WHERE id = $3`,
        [attempts, lockedUntil, row.id]
      );
    }

    await db.query(
      `DELETE FROM login_rate_limits
       WHERE (locked_until IS NULL AND last_attempt < NOW() - INTERVAL '1 day')
          OR (locked_until IS NOT NULL AND locked_until < NOW() - INTERVAL '1 day')`
    );
  } catch (e) {
    console.error('Rate limit error:', e.message);
  }
}
