const db = require('../lib/db');
const { getClientIp, verifyAdminSession } = require('../lib/auth-token');
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

  // ── GET /api/site-status ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const result = await db.query(`
        SELECT
          NOW() AT TIME ZONE 'UTC' AS db_time,
          (SELECT value FROM site_settings WHERE key = 'publishing') AS value
      `);

      const dbTimeRaw = result.rows[0]?.db_time || new Date();
      const dbNow = new Date(dbTimeRaw).getTime();
      const serverIsoTime = new Date(dbTimeRaw).toISOString();

      let setting = result.rows[0]?.value || {
        status: 'coming_soon',
        scheduled_at: null,
        updated_at: serverIsoTime
      };

      if (setting.status === 'scheduled' && setting.scheduled_at) {
        const schedTime = new Date(setting.scheduled_at).getTime();
        if (schedTime <= dbNow) {
          setting.status = 'published';
          setting.scheduled_at = null;
          setting.updated_at = serverIsoTime;
          setting.auto_published = true;

          await db.query(
            "UPDATE site_settings SET value = $1, updated_at = NOW() WHERE key = 'publishing'",
            [JSON.stringify(setting)]
          );
        }
      }

      const isPublished = setting.status === 'published';
      const remainingSeconds = (setting.status === 'scheduled' && setting.scheduled_at)
        ? Math.max(0, Math.floor((new Date(setting.scheduled_at).getTime() - dbNow) / 1000))
        : 0;

      // Also check if requester has an active server-verified admin session (for Admin Preview UX)
      let isAdminAuthenticated = false;
      if (req.headers?.cookie || req.headers?.authorization) {
        const adminCheck = await verifyAdminSession(req, { requireCsrf: false });
        isAdminAuthenticated = adminCheck.ok;
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.status(200).json({
        success: true,
        status: setting.status,
        is_published: isPublished,
        is_admin_authenticated: isAdminAuthenticated,
        scheduled_at: setting.scheduled_at,
        remaining_seconds: remainingSeconds,
        server_time: serverIsoTime,
        server_timestamp: dbNow,
        updated_at: setting.updated_at,
        updated_by: setting.updated_by || 'Admin'
      });
    } catch (err) {
      console.error('Error fetching site status:', err.message);
      return res.status(200).json({
        success: true,
        status: 'coming_soon',
        is_published: false,
        is_admin_authenticated: false,
        remaining_seconds: 0,
        server_time: new Date().toISOString(),
        error: 'Database read error, defaulting to safe coming soon mode'
      });
    }
  }

  // ── POST /api/site-status (Admin Only + CSRF) ─────────────
  if (req.method === 'POST') {
    const auth = await verifyAdminSession(req, { requireCsrf: true });
    if (!auth.ok) {
      return res.status(auth.statusCode).json({ error: auth.error });
    }

    try {
      const body = parseBody(req);
      const { status, scheduled_at } = body;

      const timeCheck = await db.query("SELECT NOW() AT TIME ZONE 'UTC' AS db_time");
      const dbNow = new Date(timeCheck.rows[0]?.db_time || Date.now()).getTime();

      const validStatuses = ['coming_soon', 'scheduled', 'published'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      let validatedScheduledAt = null;
      if (status === 'scheduled') {
        if (!scheduled_at) {
          return res.status(400).json({
            error: 'A scheduled publication date and time is required.'
          });
        }

        const scheduledTime = new Date(scheduled_at).getTime();
        if (isNaN(scheduledTime)) {
          return res.status(400).json({
            error: 'Invalid scheduled date format. Please supply a valid ISO date/time string.'
          });
        }

        if (scheduledTime <= dbNow + 5000) {
          return res.status(400).json({
            error: 'Cannot schedule launch in the past. Please select a future date and time.'
          });
        }

        validatedScheduledAt = new Date(scheduled_at).toISOString();
      }

      const newSetting = {
        status,
        scheduled_at: validatedScheduledAt,
        updated_at: new Date(dbNow).toISOString(),
        updated_by: auth.email
      };

      await db.query(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES ('publishing', $1, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(newSetting)]
      );

      await logSecurityEvent({
        eventType: 'site_status_changed',
        severity: 'info',
        actorEmail: auth.email,
        ipAddress: getClientIp(req),
        targetType: 'site_settings',
        targetId: 'publishing',
        metadata: { status, scheduledAt: validatedScheduledAt }
      });

      return res.status(200).json({
        success: true,
        message: status === 'published'
          ? 'Rockwell website is now LIVE and accessible to the public.'
          : status === 'scheduled'
            ? `Site publication scheduled for ${new Date(validatedScheduledAt).toLocaleString()}.`
            : 'Coming Soon mode activated. Public visitors will see the Coming Soon page.',
        setting: newSetting
      });
    } catch (err) {
      console.error('Error updating site status:', err.message);
      return res.status(500).json({ error: 'Internal server error updating site status.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
