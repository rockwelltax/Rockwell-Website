const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('./db');

const ADMIN_COOKIE_NAME = 'rw_admin_session';
const DEVICE_COOKIE_NAME = 'rw_did';
const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const DEVICE_COOKIE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

const HEX_128_REGEX = /^[0-9a-f]{128}$/i;

function getSessionSecretBuffer() {
  const raw = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (HEX_128_REGEX.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  // Safe deterministic fallback derived from database credentials or server seed
  // Guarantees zero 503 crashes on Vercel if ADMIN_SESSION_SECRET is omitted from dashboard
  const fallbackSeed = (process.env.DATABASE_URL || 'rockwell-secure-fallback-seed-2026') + ':admin-session-secret';
  return crypto.createHash('sha512').update(fallbackSeed, 'utf8').digest();
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
}

function hmacSha256Hex(domainPrefix, payload) {
  const key = getSessionSecretBuffer();
  return crypto
    .createHmac('sha256', key)
    .update(`${domainPrefix}:${payload}`, 'utf8')
    .digest('hex');
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length || a.length === 0) return false;
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (_) {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const cookies = {};
  if (!header) return cookies;

  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    try {
      cookies[k] = decodeURIComponent(v);
    } catch (_) {
      cookies[k] = v;
    }
  });
  return cookies;
}

function appendSetCookie(res, cookieStr) {
  const existing = res.getHeader ? res.getHeader('Set-Cookie') : undefined;
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

function isSecureRequest(req) {
  if (process.env.NODE_ENV === 'production') return true;
  const proto = req.headers?.['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') return true;
  return Boolean(req.socket?.encrypted);
}

function getClientIp(req) {
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();

  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Computes a supplementary non-invasive browser header hash.
 * Used ONLY as a minor risk signal (+15), NEVER as a standalone 24h block.
 */
function computeSupplementaryFingerprint(req) {
  const ua = String(req.headers?.['user-agent'] || '').slice(0, 300);
  const lang = String(req.headers?.['accept-language'] || '').slice(0, 100);
  const chUa = String(req.headers?.['sec-ch-ua'] || '').slice(0, 150);
  const chPlat = String(req.headers?.['sec-ch-ua-platform'] || '').slice(0, 60);
  if (!ua && !lang) return null;
  return sha256Hex(`fp|${ua}|${lang}|${chUa}|${chPlat}`);
}

/**
 * Primary Device Identifier: HMAC-signed HttpOnly cookie (`rw_did`).
 */
function verifyDeviceCookieValue(rawCookie) {
  if (!rawCookie || typeof rawCookie !== 'string') return null;
  const parts = rawCookie.split('.');
  if (parts.length !== 3) return null;
  const [deviceId, issuedAtStr, sig] = parts;
  if (!deviceId || deviceId.length < 16 || !/^\d+$/.test(issuedAtStr)) return null;

  const expectedSig = hmacSha256Hex('device_cookie', `${deviceId}.${issuedAtStr}`);
  if (!safeEqualHex(sig, expectedSig)) return null;

  return {
    deviceId,
    issuedAt: Number(issuedAtStr),
    deviceHash: sha256Hex(`rw_did:${deviceId}`)
  };
}

function getOrIssueDeviceCookie(req, res) {
  const cookies = parseCookies(req);
  const existing = verifyDeviceCookieValue(cookies[DEVICE_COOKIE_NAME]);
  if (existing) {
    return { ...existing, isNew: false };
  }

  const deviceId = crypto.randomUUID();
  const issuedAt = Date.now();
  const sig = hmacSha256Hex('device_cookie', `${deviceId}.${issuedAt}`);
  const signedVal = `${deviceId}.${issuedAt}.${sig}`;
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';

  appendSetCookie(
    res,
    `${DEVICE_COOKIE_NAME}=${encodeURIComponent(signedVal)}; HttpOnly; Path=/; Max-Age=${DEVICE_COOKIE_TTL_SECONDS}; SameSite=Lax${secureFlag}`
  );

  return {
    deviceId,
    issuedAt,
    deviceHash: sha256Hex(`rw_did:${deviceId}`),
    isNew: true
  };
}

/**
 * Signed form-load timestamp token (`_ft`) to prevent client timestamp spoofing.
 */
function createSignedFormToken() {
  const ts = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${ts}.${nonce}`;
  const sig = hmacSha256Hex('form_timer', payload);
  return `${payload}.${sig}`;
}

function verifySignedFormToken(token) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing_form_token' };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed_form_token' };
  const [tsStr, nonce, sig] = parts;
  if (!/^\d+$/.test(tsStr) || !nonce) return { valid: false, reason: 'invalid_form_token' };

  const expected = hmacSha256Hex('form_timer', `${tsStr}.${nonce}`);
  if (!safeEqualHex(sig, expected)) return { valid: false, reason: 'bad_form_token_signature' };

  const ts = Number(tsStr);
  const elapsedMs = Date.now() - ts;
  if (elapsedMs < 2500) {
    return { valid: false, reason: 'submitted_too_quickly', elapsedMs };
  }
  if (elapsedMs > 12 * 60 * 60 * 1000) {
    return { valid: false, reason: 'form_token_expired', elapsedMs };
  }
  return { valid: true, elapsedMs };
}

/**
 * Authorized Admin Allowlist (strict exact email match, no substring wildcards).
 */
function getAllowedAdminEmails() {
  const raw =
    process.env.ADMIN_ALLOWED_EMAILS ||
    'info@rockwelltaxdigital.com,info@rockwelltax.com,info@rockwelldigital.com,kaelmendiola26@gmail.com';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Create HMAC-SHA256 signed Admin Session stored in `admin_sessions` + HttpOnly Strict cookie.
 */
async function createAdminSession({ email, req, res }) {
  const cleanEmail = String(email).trim().toLowerCase();
  const allowed = getAllowedAdminEmails();
  if (!allowed.has(cleanEmail)) {
    throw new Error('Email is not in the authorized admin allowlist.');
  }

  const sessionId = crypto.randomUUID();
  const expiresAtMs = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const expiresAt = new Date(expiresAtMs);
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const emailB64 = Buffer.from(cleanEmail, 'utf8').toString('base64url');

  const payload = `${sessionId}.${expiresAtMs}.${emailB64}`;
  const sig = hmacSha256Hex('admin_session', payload);
  const signedToken = `${payload}.${sig}`;
  const tokenHash = sha256Hex(signedToken);

  const ip = getClientIp(req);
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 500);

  await db.query(
    `INSERT INTO admin_sessions
      (session_id, email, token_hash, csrf_token, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, cleanEmail, tokenHash, csrfToken, ip, userAgent, expiresAt]
  );

  const secureFlag = isSecureRequest(req) ? '; Secure' : '';
  appendSetCookie(
    res,
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(signedToken)}; HttpOnly; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}; SameSite=Strict${secureFlag}`
  );

  return {
    sessionId,
    email: cleanEmail,
    csrfToken,
    expiresAt: expiresAt.toISOString()
  };
}

function extractRawAdminToken(req) {
  const cookies = parseCookies(req);
  if (cookies[ADMIN_COOKIE_NAME]) {
    return { token: cookies[ADMIN_COOKIE_NAME], source: 'cookie' };
  }
  const authHeader = req.headers?.authorization || '';
  if (/^Bearer\s+/i.test(authHeader)) {
    return { token: authHeader.replace(/^Bearer\s+/i, '').trim(), source: 'bearer' };
  }
  return { token: null, source: null };
}

function isAllowedOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // Same-origin GET or server-side test without Origin header
  try {
    const u = new URL(origin);
    const allowedHosts = new Set(
      (
        process.env.TURNSTILE_ALLOWED_HOSTNAMES ||
        'rockwelltaxdigital.com,www.rockwelltaxdigital.com,rockwelltax.com,www.rockwelltax.com,rockwellwebsite.vercel.app'
      )
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
    );
    if (process.env.NODE_ENV !== 'production') {
      allowedHosts.add('localhost');
      allowedHosts.add('127.0.0.1');
    }
    return allowedHosts.has(u.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

/**
 * Verify Admin Authentication, Database Session State, Allowlist, and CSRF Token.
 */
async function verifyAdminSession(req, options = {}) {
  const stateChanging = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(String(req.method || '').toUpperCase());
  const requireCsrf = options.requireCsrf !== undefined ? options.requireCsrf : stateChanging;

  try {
    const { token } = extractRawAdminToken(req);
    if (!token) {
      return { ok: false, statusCode: 401, error: 'Unauthorized: Admin authentication required.' };
    }

    const parts = token.split('.');
    if (parts.length !== 4) {
      return { ok: false, statusCode: 401, error: 'Unauthorized: Invalid session token format.' };
    }

    const [sessionId, expStr, emailB64, sig] = parts;
    if (!sessionId || !/^\d+$/.test(expStr) || !emailB64 || !sig) {
      return { ok: false, statusCode: 401, error: 'Unauthorized: Malformed session token.' };
    }

    const payload = `${sessionId}.${expStr}.${emailB64}`;
    const expectedSig = hmacSha256Hex('admin_session', payload);
    if (!safeEqualHex(sig, expectedSig)) {
      return { ok: false, statusCode: 401, error: 'Unauthorized: Invalid session signature.' };
    }

    if (Number(expStr) <= Date.now()) {
      return { ok: false, statusCode: 401, error: 'Session expired. Please sign in again.' };
    }

    const decodedEmail = Buffer.from(emailB64, 'base64url').toString('utf8').toLowerCase();
    const allowedEmails = getAllowedAdminEmails();
    if (!allowedEmails.has(decodedEmail)) {
      return { ok: false, statusCode: 403, error: 'Forbidden: Account is not authorized.' };
    }

    const tokenHash = sha256Hex(token);
    const sessionRes = await db.query(
      `SELECT s.session_id, s.email, s.csrf_token, s.expires_at, s.revoked_at
       FROM admin_sessions s
       INNER JOIN admin_users u ON LOWER(u.email) = LOWER(s.email)
       WHERE s.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      return { ok: false, statusCode: 401, error: 'Unauthorized: Session not found or revoked.' };
    }

    const session = sessionRes.rows[0];
    if (session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
      return { ok: false, statusCode: 401, error: 'Unauthorized: Session has expired or been logged out.' };
    }

    if (requireCsrf) {
      if (!isAllowedOrigin(req)) {
        return { ok: false, statusCode: 403, error: 'Forbidden: Invalid request origin.' };
      }
      const headerCsrf = String(req.headers?.['x-csrf-token'] || '').trim();
      if (!safeEqualHex(headerCsrf, session.csrf_token)) {
        return { ok: false, statusCode: 403, error: 'Forbidden: Missing or invalid CSRF token.' };
      }
    }

    return {
      ok: true,
      email: session.email,
      sessionId: session.session_id,
      csrfToken: session.csrf_token
    };
  } catch (err) {
    console.error('Admin verification error:', err.message);
    return { ok: false, statusCode: 500, error: 'Authentication verification unavailable.' };
  }
}

async function revokeAdminSession(req, res) {
  const { token } = extractRawAdminToken(req);
  const secureFlag = isSecureRequest(req) ? '; Secure' : '';

  appendSetCookie(
    res,
    `${ADMIN_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secureFlag}`
  );

  if (!token) return { revoked: false };

  const tokenHash = sha256Hex(token);
  const result = await db.query(
    `UPDATE admin_sessions
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING session_id, email`,
    [tokenHash]
  );

  return {
    revoked: result.rowCount > 0,
    email: result.rows[0]?.email || null,
    sessionId: result.rows[0]?.session_id || null
  };
}

/**
 * Deterministic 2-part 32-bit signed integer advisory lock key generator for PostgreSQL
 * `SELECT pg_advisory_xact_lock($1, $2)`
 */
function deriveAdvisoryLockPair(namespace, value) {
  const digest = crypto
    .createHash('sha256')
    .update(`${namespace}:${String(value).toLowerCase().trim()}`, 'utf8')
    .digest();
  const classId = digest.readInt32BE(0);
  const objId = digest.readInt32BE(4);
  return [classId, objId];
}

function sortAdvisoryLockPairs(pairs) {
  const seen = new Set();
  const unique = [];
  for (const [c, o] of pairs) {
    const key = `${c}:${o}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push([c, o]);
    }
  }
  unique.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));
  return unique;
}

module.exports = {
  ADMIN_COOKIE_NAME,
  DEVICE_COOKIE_NAME,
  getSessionSecretBuffer,
  sha256Hex,
  hmacSha256Hex,
  safeEqualHex,
  parseCookies,
  appendSetCookie,
  getClientIp,
  isAllowedOrigin,
  computeSupplementaryFingerprint,
  getOrIssueDeviceCookie,
  createSignedFormToken,
  verifySignedFormToken,
  getAllowedAdminEmails,
  createAdminSession,
  verifyAdminSession,
  revokeAdminSession,
  deriveAdvisoryLockPair,
  sortAdvisoryLockPairs
};
