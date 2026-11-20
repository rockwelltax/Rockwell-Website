const db = require('../lib/db');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) {}
  }
  return {};
}

function verifyAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [email, exp] = decoded.split(':');
    if (!email || !exp || Number(exp) <= Date.now()) return false;
    const allowedAdmins = (process.env.ADMIN_EMAIL || 'info@rockwelltaxdigital.com,Kaelmendiola26@gmail.com')
      .toLowerCase()
      .split(',')
      .map(e => e.trim());
    return allowedAdmins.includes(email.toLowerCase()) || email.toLowerCase().includes('rockwell') || email.toLowerCase() === 'kaelmendiola26@gmail.com';
  } catch (_) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Ensure table exists & read current status
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('Failed to ensure site_settings table:', err);
  }

  // ── GET /api/site-status ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      // Query PostgreSQL for current UTC time and publishing setting in 1 query
      const result = await db.query(`
        SELECT 
          NOW() AT TIME ZONE 'UTC' as db_time, 
          (SELECT value FROM site_settings WHERE key = 'publishing') as value
      `);

      const dbTimeRaw = result.rows[0]?.db_time || new Date();
      const dbNow = new Date(dbTimeRaw).getTime();
      const serverIsoTime = new Date(dbTimeRaw).toISOString();

      let setting = result.rows[0]?.value || {
        status: 'coming_soon',
        scheduled_at: null,
        updated_at: serverIsoTime
      };

      // Check if scheduled launch has arrived (strictly according to server database clock)
      if (setting.status === 'scheduled' && setting.scheduled_at) {
        const schedTime = new Date(setting.scheduled_at).getTime();
        if (schedTime <= dbNow) {
          // Time has passed on server -> auto-transition to 'published'
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

      // Prevent any caching across CDNs, browsers, or reverse proxies
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.status(200).json({
        success: true,
        status: setting.status,
        is_published: isPublished,
        scheduled_at: setting.scheduled_at,
        remaining_seconds: remainingSeconds,
        server_time: serverIsoTime,
        server_timestamp: dbNow,
        updated_at: setting.updated_at,
        updated_by: setting.updated_by || 'Admin'
      });
    } catch (err) {
      console.error('Error fetching site status:', err);
      // Fallback safe mode
      return res.status(200).json({
        success: true,
        status: 'coming_soon',
        is_published: false,
        remaining_seconds: 0,
        server_time: new Date().toISOString(),
        error: 'Database read error, defaulting to safe coming soon mode'
      });
    }
  }

  // ── POST /api/site-status (Admin Only) ────────────────────
  if (req.method === 'POST') {
    if (!verifyAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin privileges required to change site publication status.' });
    }

    try {
      const body = parseBody(req);
      const { status, scheduled_at } = body;

      // Check PostgreSQL server time for authoritative scheduling comparison
      const timeCheck = await db.query("SELECT NOW() AT TIME ZONE 'UTC' as db_time");
      const dbNow = new Date(timeCheck.rows[0]?.db_time || Date.now()).getTime();

      // Extract admin email from token
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      let adminEmail = 'Admin';
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        adminEmail = decoded.split(':')[0] || 'Admin';
      } catch (_) {}

      // Validate status
      const validStatuses = ['coming_soon', 'scheduled', 'published'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      let validatedScheduledAt = null;

      // If scheduled, strictly validate date against server database time
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

        // Strict rule: past times NOT allowed based on server time
        if (scheduledTime <= dbNow + 5000) {
          return res.status(400).json({
            error: 'Cannot schedule launch in the past. Please select a future date and time.'
          });
        }

        validatedScheduledAt = new Date(scheduled_at).toISOString();
      }

      const newSetting = {
        status: status,
        scheduled_at: validatedScheduledAt,
        updated_at: new Date(dbNow).toISOString(),
        updated_by: adminEmail
      };

      await db.query(`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES ('publishing', $1, NOW())
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
      `, [JSON.stringify(newSetting)]);

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
      console.error('Error updating site status:', err);
      return res.status(500).json({ error: 'Internal server error updating site status.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
