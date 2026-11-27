const db = require('./db');

const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'newPassword',
  'confirmPassword',
  'password_hash',
  'code',
  'details',
  'message',
  'ssn',
  'tin',
  'itin',
  'token',
  'csrfToken'
]);

const SSN_LIKE_REGEX = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/;

function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_METADATA_KEYS.has(k)) continue;
    if (typeof v === 'string') {
      if (SSN_LIKE_REGEX.test(v)) {
        clean[k] = '[REDACTED_SENSITIVE_PATTERN]';
      } else {
        clean[k] = v.slice(0, 300);
      }
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      clean[k] = v;
    } else if (Array.isArray(v)) {
      clean[k] = v.slice(0, 50).map((item) =>
        typeof item === 'string' && SSN_LIKE_REGEX.test(item)
          ? '[REDACTED]'
          : item
      );
    }
  }
  return clean;
}

/**
 * Append-only security audit logger.
 * Never persists SSNs, passwords, verification codes, or raw client message payloads.
 */
async function logSecurityEvent({
  eventType,
  severity = 'info',
  actorEmail = null,
  ipAddress = null,
  deviceHash = null,
  targetType = null,
  targetId = null,
  metadata = {},
  client = null
}) {
  try {
    const runner = client || db;
    const safeMeta = sanitizeMetadata(metadata);
    await runner.query(
      `INSERT INTO security_audit_logs
        (event_type, severity, actor_email, ip_address, device_hash, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        String(eventType).slice(0, 80),
        String(severity).slice(0, 20),
        actorEmail ? String(actorEmail).slice(0, 255) : null,
        ipAddress ? String(ipAddress).slice(0, 100) : null,
        deviceHash ? String(deviceHash).slice(0, 128) : null,
        targetType ? String(targetType).slice(0, 50) : null,
        targetId !== null && targetId !== undefined ? String(targetId).slice(0, 100) : null,
        JSON.stringify(safeMeta)
      ]
    );
  } catch (err) {
    console.error(`Audit log warning (${eventType}):`, err.message);
  }
}

module.exports = {
  logSecurityEvent,
  sanitizeMetadata
};
