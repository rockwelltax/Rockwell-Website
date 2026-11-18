const db = require('../lib/db');
const { sendClientConfirmation, sendAdminNotification } = require('../lib/email');

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
  // Basic token check or simple signature check
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [email, exp] = decoded.split(':');
    return email === 'Kaelmendiola26@gmail.com' && Number(exp) > Date.now();
  } catch (_) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── GET /api/inquiries (List Inquiries - Admin Only) ───────
  if (req.method === 'GET') {
    if (!verifyAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }

    try {
      const { type, status, search } = req.query || {};
      let query = 'SELECT * FROM inquiries WHERE 1=1';
      const params = [];

      if (type && type !== 'all') {
        params.push(type);
        query += ` AND type = $${params.length}`;
      }

      if (status && status !== 'all') {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`;
      }

      query += ' ORDER BY created_at DESC LIMIT 100';

      const result = await db.query(query, params);
      return res.status(200).json({ inquiries: result.rows });
    } catch (err) {
      console.error('Error fetching inquiries:', err);
      return res.status(500).json({ error: 'Failed to retrieve inquiries' });
    }
  }

  // ── POST /api/inquiries (Submit New Inquiry) ───────────────
  if (req.method === 'POST') {
    const body = parseBody(req);
    const { name, email, phone, type = 'general_contact', service_requested = '', details = {} } = body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required fields' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    try {
      const insertQuery = `
        INSERT INTO inquiries (type, name, email, phone, service_requested, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const result = await db.query(insertQuery, [
        type,
        name,
        email,
        phone || null,
        service_requested || null,
        JSON.stringify(details),
        String(ip)
      ]);

      const saved = result.rows[0];

      // Await email notifications before returning response (Vercel freezes unawaited work)
      const [clientEmailRes, adminEmailRes] = await Promise.allSettled([
        sendClientConfirmation({ to: email, name, type, details }),
        sendAdminNotification({ inquiry: saved })
      ]);

      return res.status(201).json({
        success: true,
        message: 'Your inquiry has been submitted successfully. A confirmation email has been sent.',
        inquiryId: saved.id,
        emailStatus: {
          client: clientEmailRes.status === 'fulfilled' ? clientEmailRes.value : { success: false, error: 'Promise rejected' },
          admin: adminEmailRes.status === 'fulfilled' ? adminEmailRes.value : { success: false, error: 'Promise rejected' }
        }
      });
    } catch (err) {
      console.error('Error creating inquiry:', err);
      return res.status(500).json({ error: 'Database error saving inquiry' });
    }
  }

  // ── PATCH /api/inquiries (Update Status - Admin Only) ──────
  if (req.method === 'PATCH') {
    if (!verifyAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }

    const body = parseBody(req);
    const { id, status } = body;

    if (!id || !status) {
      return res.status(400).json({ error: 'Inquiry ID and new status are required' });
    }

    try {
      const updateQuery = `
        UPDATE inquiries
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *;
      `;
      const result = await db.query(updateQuery, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Inquiry not found' });
      }

      return res.status(200).json({ success: true, inquiry: result.rows[0] });
    } catch (err) {
      console.error('Error updating inquiry:', err);
      return res.status(500).json({ error: 'Failed to update inquiry status' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
