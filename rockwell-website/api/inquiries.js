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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
      await db.query(`
        CREATE TABLE IF NOT EXISTS inquiries (
          id SERIAL PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          service_requested VARCHAR(100),
          status VARCHAR(50) DEFAULT 'new',
          details JSONB DEFAULT '{}'::jsonb,
          ip_address VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

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

  // ── DELETE /api/inquiries (Delete Inquiry - Admin Only) ──────
  if (req.method === 'DELETE') {
    if (!verifyAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
    }

    const body = parseBody(req);
    const id = req.query?.id || body?.id;
    const purgeAll = req.query?.all === 'true' || body?.all === true;

    try {
      if (purgeAll) {
        await db.query('TRUNCATE TABLE inquiries RESTART IDENTITY');
        return res.status(200).json({ success: true, message: 'All inquiries have been permanently cleared' });
      }

      if (!id) {
        return res.status(400).json({ error: 'Inquiry ID is required for deletion' });
      }

      const result = await db.query('DELETE FROM inquiries WHERE id = $1 RETURNING id;', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Inquiry not found' });
      }

      return res.status(200).json({ success: true, message: `Inquiry #${id} deleted successfully`, deletedId: id });
    } catch (err) {
      console.error('Error deleting inquiry:', err);
      return res.status(500).json({ error: 'Failed to delete inquiry from database' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
