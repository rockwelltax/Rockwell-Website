const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../lib/db');
const { sendPasswordResetCode } = require('../lib/email');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) {}
  }
  return {};
}

function generateToken(email) {
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return Buffer.from(`${email}:${expires}`).toString('base64');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query?.action || '').toLowerCase();
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  // ── 1. LOGIN (POST ?action=login) ──────────────────────────
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = parseBody(req);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim();
    const cleanPassword = String(password).trim();

    // Check Rate Limiting (Max 5 attempts in 5 minutes)
    try {
      const rateCheck = await db.query(
        `SELECT * FROM login_rate_limits WHERE ip_address = $1 AND (locked_until IS NULL OR locked_until > NOW())`,
        [String(ip)]
      );

      if (rateCheck.rows.length > 0) {
        const row = rateCheck.rows[0];
        if (row.locked_until && new Date(row.locked_until) > new Date()) {
          const remainingSecs = Math.ceil((new Date(row.locked_until) - new Date()) / 1000);
          return res.status(429).json({
            error: `Too many failed attempts. Account temporarily locked. Please try again in ${remainingSecs} seconds.`
          });
        }
      }

      // Check User (case-insensitive and whitespace-safe)
      const userRes = await db.query(
        `SELECT * FROM admin_users WHERE email ILIKE $1 OR email ILIKE $2`,
        [email, cleanEmail]
      );
      if (userRes.rows.length === 0) {
        await recordFailedAttempt(ip, cleanEmail);
        return res.status(401).json({ error: 'Invalid email address or password' });
      }

      const adminUser = userRes.rows[0];
      let passwordMatch = await bcrypt.compare(password, adminUser.password_hash);
      if (!passwordMatch && password !== cleanPassword) {
        passwordMatch = await bcrypt.compare(cleanPassword, adminUser.password_hash);
      }

      if (!passwordMatch) {
        await recordFailedAttempt(ip, cleanEmail);
        return res.status(401).json({ error: 'Invalid email address or password' });
      }

      // Successful login -> Clear rate limits
      await db.query(`DELETE FROM login_rate_limits WHERE ip_address = $1`, [String(ip)]);

      const token = generateToken(adminUser.email);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: { email: adminUser.email }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Internal server error during authentication' });
    }
  }

  // ── 2. FORGOT PASSWORD (POST ?action=forgot-password) ──────
  if (req.method === 'POST' && action === 'forgot-password') {
    const { email } = parseBody(req);
    const cleanEmail = String(email || '').trim();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      const userRes = await db.query(`SELECT * FROM admin_users WHERE email ILIKE $1`, [cleanEmail]);
      if (userRes.rows.length === 0) {
        // Return generic message for security
        return res.status(200).json({
          success: true,
          message: 'If the email exists, a 6-digit code has been sent. It expires in 2 minutes.'
        });
      }

      // Generate random 6-digit code
      const code = String(crypto.randomInt(100000, 999999));
      // Expiration: exactly 2 minutes from now
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

      // Invalidate previous unused codes for this email
      await db.query(`UPDATE password_resets SET used = true WHERE email ILIKE $1`, [cleanEmail]);

      // Insert new code
      await db.query(
        `INSERT INTO password_resets (email, code, expires_at) VALUES ($1, $2, $3)`,
        [cleanEmail, code, expiresAt]
      );

      // Send email via Resend
      await sendPasswordResetCode({ to: cleanEmail, code });

      return res.status(200).json({
        success: true,
        message: 'A 6-digit verification code has been sent to your email. It will expire in exactly 2 minutes.'
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      return res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }

  // ── 3. VERIFY CODE (POST ?action=verify-code) ─────────────
  if (req.method === 'POST' && action === 'verify-code') {
    const { email, code } = parseBody(req);
    const cleanEmail = String(email || '').trim();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    try {
      const resetRes = await db.query(
        `SELECT * FROM password_resets
         WHERE email ILIKE $1 AND code = $2 AND used = false
         ORDER BY created_at DESC LIMIT 1`,
        [cleanEmail, cleanCode]
      );

      if (resetRes.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
      }

      const resetRecord = resetRes.rows[0];
      if (new Date(resetRecord.expires_at) < new Date()) {
        return res.status(400).json({ error: 'This verification code has expired (2-minute limit exceeded). Please request a new code.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Code verified successfully. You may now enter your new password.'
      });
    } catch (err) {
      console.error('Verify code error:', err);
      return res.status(500).json({ error: 'Error verifying code' });
    }
  }

  // ── 4. RESET PASSWORD (POST ?action=reset-password) ────────
  if (req.method === 'POST' && action === 'reset-password') {
    const { email, code, newPassword } = parseBody(req);
    const cleanEmail = String(email || '').trim();
    const cleanCode = String(code || '').trim();
    const cleanNewPassword = String(newPassword || '').trim();

    if (!cleanEmail || !cleanCode || !cleanNewPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }

    if (cleanNewPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try {
      const resetRes = await db.query(
        `SELECT * FROM password_resets
         WHERE email ILIKE $1 AND code = $2 AND used = false
         ORDER BY created_at DESC LIMIT 1`,
        [cleanEmail, cleanCode]
      );

      if (resetRes.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or used verification code' });
      }

      const resetRecord = resetRes.rows[0];
      if (new Date(resetRecord.expires_at) < new Date()) {
        return res.status(400).json({ error: 'This verification code has expired. Please request a new code.' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(cleanNewPassword, salt);

      // Update admin user password
      await db.query(
        `UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE email ILIKE $2`,
        [hash, cleanEmail]
      );

      // Mark code as used
      await db.query(`UPDATE password_resets SET used = true WHERE id = $1`, [resetRecord.id]);

      return res.status(200).json({
        success: true,
        message: 'Your password has been successfully updated! You can now log in.'
      });
    } catch (err) {
      console.error('Reset password error:', err);
      return res.status(500).json({ error: 'Failed to update password' });
    }
  }

  return res.status(404).json({ error: 'Action not found' });
};

async function recordFailedAttempt(ip, email) {
  try {
    const existing = await db.query(`SELECT * FROM login_rate_limits WHERE ip_address = $1`, [String(ip)]);
    if (existing.rows.length === 0) {
      await db.query(`INSERT INTO login_rate_limits (ip_address, email, attempts) VALUES ($1, $2, 1)`, [String(ip), email]);
    } else {
      const attempts = existing.rows[0].attempts + 1;
      let lockedUntil = null;
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 5 * 60 * 1000); // Lock for 5 minutes
      }
      await db.query(
        `UPDATE login_rate_limits SET attempts = $1, locked_until = $2, last_attempt = NOW() WHERE ip_address = $3`,
        [attempts, lockedUntil, String(ip)]
      );
    }
  } catch (e) {
    console.error('Rate limit error:', e);
  }
}
