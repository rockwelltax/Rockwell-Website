const crypto = require('crypto');
const db = require('./db');
const { sha256Hex, hmacSha256Hex, safeEqualHex } = require('./auth-token');
const { logSecurityEvent } = require('./audit');

// Unambiguous 26-character alphabet (no 0/O, 1/I, 2/Z, 5/S, 8/B confusion)
const CAPTCHA_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679';
const CAPTCHA_LENGTH = 5;
const CAPTCHA_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CAPTCHA_MIN_SOLVE_MS = 1200; // 1.2s minimum human read+type threshold

const ALLOWED_ACTIONS = new Set([
  'contact_inquiry',
  'tax_return_inquiry',
  'firm_support_inquiry',
  'general'
]);

const GLYPH_COLORS = ['#1B3B44', '#1E6B7B', '#29211D', '#155263', '#2C3E50'];

function normalizeCaptchaCode(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function generateRandomCode(length = CAPTCHA_LENGTH) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CAPTCHA_ALPHABET[crypto.randomInt(0, CAPTCHA_ALPHABET.length)];
  }
  return out;
}

function escapeXml(ch) {
  return String(ch)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a crisp, high-contrast distorted SVG challenge image with
 * Bezier interference curves, micro-dot noise, and per-glyph rotation.
 */
function buildCaptchaSvgDataUri(code) {
  const width = 190;
  const height = 54;

  // Fine diagonal security hatch lines
  const hatchLines = [];
  for (let x = -40; x < width + 40; x += 18) {
    hatchLines.push(
      `<line x1="${x}" y1="0" x2="${x + 36}" y2="${height}" stroke="#1E6B7B" stroke-opacity="0.07" stroke-width="1" />`
    );
  }

  // Randomized interference Bezier waves
  const wavePaths = [];
  for (let w = 0; w < 3; w++) {
    const y1 = crypto.randomInt(10, height - 10);
    const cy1 = crypto.randomInt(4, height - 4);
    const cy2 = crypto.randomInt(4, height - 4);
    const y2 = crypto.randomInt(10, height - 10);
    const strokeColor = w % 2 === 0 ? '#1E6B7B' : '#5C4B43';
    const opacity = (0.20 + crypto.randomInt(0, 14) / 100).toFixed(2);
    wavePaths.push(
      `<path d="M 4 ${y1} C 62 ${cy1}, 128 ${cy2}, ${width - 4} ${y2}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-opacity="${opacity}" />`
    );
  }

  // Randomized speckle noise dots
  const dots = [];
  for (let d = 0; d < 26; d++) {
    const cx = crypto.randomInt(6, width - 6);
    const cy = crypto.randomInt(6, height - 6);
    const r = crypto.randomInt(10, 22) / 10;
    const fill = d % 2 === 0 ? '#1E6B7B' : '#29211D';
    const op = (0.14 + crypto.randomInt(0, 18) / 100).toFixed(2);
    dots.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${op}" />`);
  }

  // Distorted character glyphs
  const glyphs = [];
  const chars = code.split('');
  const startX = 27;
  const stepX = 33;

  chars.forEach((ch, idx) => {
    const x = startX + idx * stepX + crypto.randomInt(-3, 4);
    const y = 35 + crypto.randomInt(-4, 5);
    const rot = crypto.randomInt(-14, 15);
    const fontSize = crypto.randomInt(24, 28);
    const color = GLYPH_COLORS[idx % GLYPH_COLORS.length];
    glyphs.push(
      `<text x="${x}" y="${y}" fill="${color}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" transform="rotate(${rot} ${x} ${y - 8})">${escapeXml(ch)}</text>`
    );
  });

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Security verification image">`,
    `<defs>`,
    `<linearGradient id="rwCapBg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" stop-color="#F7FAFB" />`,
    `<stop offset="100%" stop-color="#E7F1F4" />`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="${width}" height="${height}" rx="6" fill="url(#rwCapBg)" />`,
    ...hatchLines,
    ...dots,
    ...wavePaths,
    ...glyphs,
    `</svg>`
  ].join('');

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * Generates an HMAC-SHA256 signed CAPTCHA challenge.
 * The raw code is never stored in the token — only its salted SHA-256 commitment.
 */
function createCaptchaChallenge({ action = 'general' } = {}) {
  const safeAction = ALLOWED_ACTIONS.has(action) ? action : 'general';
  const challengeId = crypto.randomBytes(12).toString('hex');
  const issuedAt = Date.now();
  const code = generateRandomCode(CAPTCHA_LENGTH);
  const answerHash = sha256Hex(`rw_cap_v1:${challengeId}:${code}`);

  const payload = `${challengeId}.${issuedAt}.${safeAction}.${answerHash}`;
  const sig = hmacSha256Hex('captcha_challenge_v1', payload);
  const challengeToken = `${payload}.${sig}`;
  const svgDataUri = buildCaptchaSvgDataUri(code);

  const result = {
    challengeId,
    challengeToken,
    svgDataUri,
    expiresAt: new Date(issuedAt + CAPTCHA_TTL_MS).toISOString()
  };

  // Expose _testAnswer strictly when explicitly requested by local automated test runner
  if (process.env.NODE_ENV === 'test_captcha_internal') {
    result._testAnswer = code;
  }

  return result;
}

/**
 * Verifies a submitted CAPTCHA challenge token + user answer:
 *  1. Constant-time HMAC-SHA256 signature verification
 *  2. Action binding verification
 *  3. Expiration (10m) & human minimum solve timing (>=1.2s)
 *  4. Constant-time salted SHA-256 answer comparison
 *  5. PostgreSQL one-time consumption check (prevents replay attacks)
 */
async function verifyCaptchaChallenge({
  captchaToken,
  captchaAnswer,
  expectedAction,
  remoteIp,
  deviceHash
}) {
  const rawToken = String(captchaToken || '').trim();
  const cleanAnswer = normalizeCaptchaCode(captchaAnswer);

  if (!rawToken) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'missing_captcha_token',
      error: 'Please complete the security verification check before submitting.'
    };
  }

  if (!cleanAnswer || cleanAnswer.length !== CAPTCHA_LENGTH) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'missing_or_incomplete_captcha_answer',
      error: 'Please enter the 5-character security code shown in the verification box.'
    };
  }

  const parts = rawToken.split('.');
  if (parts.length !== 5) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'malformed_captcha_token',
      error: 'Invalid security verification token. Please refresh the code and try again.'
    };
  }

  const [challengeId, issuedAtStr, tokenAction, answerHash, sig] = parts;
  if (
    !/^[0-9a-f]{24}$/.test(challengeId) ||
    !/^\d+$/.test(issuedAtStr) ||
    !/^[0-9a-f]{64}$/.test(answerHash) ||
    !/^[0-9a-f]{64}$/.test(sig)
  ) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'invalid_captcha_token_fields',
      error: 'Invalid security verification token. Please refresh the code and try again.'
    };
  }

  const payload = `${challengeId}.${issuedAtStr}.${tokenAction}.${answerHash}`;
  const expectedSig = hmacSha256Hex('captcha_challenge_v1', payload);
  if (!safeEqualHex(sig, expectedSig)) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'captcha_signature_mismatch',
      error: 'Security verification signature invalid. Please try the new code shown.'
    };
  }

  if (
    expectedAction &&
    tokenAction !== 'general' &&
    tokenAction !== expectedAction
  ) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'captcha_action_mismatch',
      error: 'Security verification form mismatch. Please try the new code shown.'
    };
  }

  const issuedAt = Number(issuedAtStr);
  const elapsedMs = Date.now() - issuedAt;

  if (elapsedMs > CAPTCHA_TTL_MS) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'captcha_expired',
      error: 'Security code expired. A fresh code has been loaded — please enter it and submit again.'
    };
  }

  if (elapsedMs < CAPTCHA_MIN_SOLVE_MS) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'captcha_solved_too_fast',
      error: 'Please take a moment to enter the security verification code.'
    };
  }

  const candidateHash = sha256Hex(`rw_cap_v1:${challengeId}:${cleanAnswer}`);
  if (!safeEqualHex(candidateHash, answerHash)) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'captcha_wrong_answer',
      error: 'Incorrect security code. A fresh code has been loaded — please try again.'
    };
  }

  // Enforce single-use replay protection via security_audit_logs
  try {
    const usedRes = await db.query(
      `SELECT 1 FROM security_audit_logs
       WHERE event_type = 'captcha_challenge_consumed'
         AND target_id = $1
       LIMIT 1`,
      [challengeId]
    );

    if (usedRes.rows.length > 0) {
      return {
        ok: false,
        statusCode: 400,
        reason: 'captcha_replayed',
        error: 'This security code was already used. Please enter the new code shown.'
      };
    }

    await logSecurityEvent({
      eventType: 'captcha_challenge_consumed',
      severity: 'info',
      ipAddress: remoteIp || null,
      deviceHash: deviceHash || null,
      targetType: 'captcha_challenge',
      targetId: challengeId,
      metadata: { action: tokenAction, solveMs: elapsedMs }
    });
  } catch (err) {
    console.error('CAPTCHA replay check DB error:', err.message);
    return {
      ok: false,
      statusCode: 503,
      reason: 'captcha_db_unavailable',
      error: 'Unable to verify security check right now. Please try again shortly.'
    };
  }

  return {
    ok: true,
    challengeId,
    action: tokenAction
  };
}

module.exports = {
  createCaptchaChallenge,
  verifyCaptchaChallenge,
  CAPTCHA_LENGTH
};
