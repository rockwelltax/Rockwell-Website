const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TEST_SITE_KEY = '1x00000000000000000000AA';
const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

function isDummyTurnstileKey(key) {
  const k = String(key || '').trim();
  return !k || /^(1x0000|2x0000|3x0000)/.test(k);
}

/**
 * Returns true ONLY when real (non-test) Cloudflare Turnstile site + secret keys are configured.
 */
function hasLiveTurnstileConfig() {
  const siteKey = (process.env.TURNSTILE_SITE_KEY || '').trim();
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  return !isDummyTurnstileKey(siteKey) && !isDummyTurnstileKey(secretKey);
}

function getTurnstileSiteKey() {
  if (hasLiveTurnstileConfig()) {
    const raw = (process.env.TURNSTILE_SITE_KEY || '').trim();
    // Guard against Courier font OCR typo (1 vs lowercase l) in initial env paste
    if (raw === '0x4AAAAAAGVgO6PuGy17j2NT') {
      return '0x4AAAAAAGVgO6PuGyl7j2NT';
    }
    return raw;
  }
  return '';
}

function getAllowedHostnames(isProd) {
  const configured = (
    process.env.TURNSTILE_ALLOWED_HOSTNAMES ||
    'rockwelltaxdigital.com,www.rockwelltaxdigital.com,rockwelltax.com,www.rockwelltax.com,rockwellwebsite.vercel.app'
  )
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  const set = new Set(configured);
  set.add('localhost');
  set.add('127.0.0.1');
  set.add('example.com'); // Returned by Cloudflare's official dummy test key
  return set;
}

/**
 * Server-side Cloudflare Turnstile verification.
 * Fails closed in production if TURNSTILE_SECRET_KEY is missing or equals test secret.
 */
async function verifyTurnstileToken({ token, remoteIp, expectedAction }) {
  const isProd = process.env.NODE_ENV === 'production';
  const customSecret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  const allowDev = process.env.ALLOW_DEV_TURNSTILE === 'true' || process.env.VERCEL_ENV === 'preview';
  const secretKey = isProd && !allowDev
    ? customSecret
    : (customSecret || process.env.DEV_TURNSTILE_SECRET_KEY || TEST_SECRET_KEY).trim();

  // Fail closed in production if secret key is missing or left as dummy test key
  if (isProd && !allowDev && (!secretKey || secretKey === TEST_SECRET_KEY)) {
    return {
      ok: false,
      statusCode: 503,
      reason: 'turnstile_secret_missing_in_production',
      error: 'Security verification is temporarily unavailable. Please email info@rockwelltaxdigital.com directly.'
    };
  }

  const cleanToken = String(token || '').trim();
  if (!cleanToken || cleanToken.length > 2048) {
    return {
      ok: false,
      statusCode: 400,
      reason: 'missing_turnstile_token',
      error: 'Please complete the security verification check before submitting.'
    };
  }

  try {
    const formParams = new URLSearchParams();
    formParams.set('secret', secretKey);
    formParams.set('response', cleanToken);
    if (remoteIp && remoteIp !== 'unknown') {
      formParams.set('remoteip', remoteIp);
    }
    formParams.set('idempotency_key', crypto.randomUUID());

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formParams.toString()
    });

    const outcome = await verifyRes.json().catch(() => null);

    if (!verifyRes.ok && !outcome) {
      return {
        ok: false,
        statusCode: 502,
        reason: `turnstile_http_${verifyRes.status}`,
        error: 'Unable to verify security challenge at this moment. Please try again.'
      };
    }

    if (!outcome || outcome.success !== true) {
      const errCodes = outcome?.['error-codes'] || [];
      const isBadSecret = errCodes.includes('invalid-input-secret');
      return {
        ok: false,
        statusCode: isBadSecret ? 503 : 400,
        reason: isBadSecret ? 'turnstile_invalid_secret_key' : 'turnstile_verification_failed',
        errorCodes: errCodes,
        error: isBadSecret
          ? 'Server security key mismatch (TURNSTILE_SECRET_KEY). Please update the secret key in Vercel settings.'
          : 'Security verification failed or expired. Please refresh and try again.'
      };
    }

    // Validate hostname
    const allowedHosts = getAllowedHostnames(isProd);
    if (outcome.hostname) {
      const verifiedHost = String(outcome.hostname).toLowerCase();
      const isAllowed =
        allowedHosts.has(verifiedHost) ||
        verifiedHost.endsWith('.vercel.app') ||
        verifiedHost.includes('rockwell');
      if (!isAllowed) {
        return {
          ok: false,
          statusCode: 400,
          reason: 'turnstile_hostname_mismatch',
          error: 'Security verification domain mismatch.'
        };
      }
    } else if (isProd) {
      return {
        ok: false,
        statusCode: 400,
        reason: 'turnstile_missing_hostname',
        error: 'Security verification incomplete.'
      };
    }

    // Validate action when returned (Cloudflare dummy test key returns empty action)
    if (expectedAction && outcome.action && outcome.action !== expectedAction) {
      return {
        ok: false,
        statusCode: 400,
        reason: 'turnstile_action_mismatch',
        error: 'Security verification action mismatch.'
      };
    }

    return {
      ok: true,
      hostname: outcome.hostname || null,
      action: outcome.action || null
    };
  } catch (err) {
    console.error('Turnstile verification error:', err.message);
    return {
      ok: false,
      statusCode: 503,
      reason: 'turnstile_network_error',
      error: 'Unable to verify security check right now. Please try again shortly.'
    };
  }
}

module.exports = {
  hasLiveTurnstileConfig,
  getTurnstileSiteKey,
  verifyTurnstileToken,
  TEST_SITE_KEY,
  TEST_SECRET_KEY
};
