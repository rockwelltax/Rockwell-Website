const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const authHandler = require('./api/auth');
const inquiriesHandler = require('./api/inquiries');
const siteStatusHandler = require('./api/site-status');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Add query to req for serverless compatibility
  req.query = parsedUrl.query;

  // Helper response wrapper
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(data));
    return this;
  };

  // Buffer body if POST/PATCH
  if (req.method === 'POST' || req.method === 'PATCH') {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    await new Promise(resolve => req.on('end', resolve));
    try {
      req.body = JSON.parse(bodyData);
    } catch (_) {
      req.body = bodyData;
    }
  }

  // ── Route: /api/auth ──
  if (pathname === '/api/auth') {
    return authHandler(req, res);
  }

  // ── Route: /api/inquiries ──
  if (pathname === '/api/inquiries') {
    return inquiriesHandler(req, res);
  }

  // ── Route: /api/site-status ──
  if (pathname === '/api/site-status') {
    return siteStatusHandler(req, res);
  }

  // ── Clean URL rewrites & Aliases ──
  let filePath = pathname;
  if (pathname === '/' || pathname === '') {
    try {
      const db = require('./lib/db');
      const row = await db.query("SELECT value FROM site_settings WHERE key = 'publishing'");
      const val = row.rows[0]?.value;
      const isLive = val?.status === 'published' || (val?.status === 'scheduled' && val?.scheduled_at && new Date(val.scheduled_at).getTime() <= Date.now());
      if (!isLive && parsedUrl.query.preview !== 'admin') {
        filePath = '/pages/coming-soon/coming-soon.html';
      } else {
        filePath = '/index.html';
      }
    } catch (_) {
      filePath = '/pages/coming-soon/coming-soon.html';
    }
  } else if (pathname === '/services' || pathname === '/services.html' || pathname === '/services/services.html') {
    filePath = '/pages/services/services.html';
  } else if (pathname === '/services/tax-preparation' || pathname === '/tax-preparation' || pathname === '/tax-preparation.html' || pathname === '/tax-preparation/tax-preparation.html' || pathname === '/services/tax-preparation/tax-preparation.html' || pathname === '/services/tax-preparation.html') {
    filePath = '/pages/tax-preparation/tax-preparation.html';
  } else if (pathname === '/firm-support' || pathname === '/firm-support.html' || pathname === '/services/tax-preparation/firm-support' || pathname === '/services/tax-preparation/firm-support.html' || pathname === '/pages/tax-preparation/firm-support.html') {
    filePath = '/pages/tax-preparation/firm-support.html';
  } else if (pathname === '/services/bookkeeping' || pathname === '/bookkeeping' || pathname === '/bookkeeping.html' || pathname === '/bookkeeping/bookkeeping.html' || pathname === '/services/bookkeeping/bookkeeping.html' || pathname === '/services/bookkeeping.html') {
    filePath = '/pages/bookkeeping/bookkeeping.html';
  } else if (pathname === '/services/digital-services' || pathname === '/digital-services' || pathname === '/digital-services.html' || pathname === '/digital-services/digital-services.html' || pathname === '/services/digital-services/digital-services.html' || pathname === '/services/digital-services.html') {
    filePath = '/pages/digital-services/digital-services.html';
  } else if (pathname === '/about' || pathname === '/about.html' || pathname === '/about/about.html' || pathname.startsWith('/services/about')) {
    filePath = '/pages/about/about.html';
  } else if (pathname === '/contact' || pathname === '/contact.html' || pathname === '/contact/contact.html' || pathname.startsWith('/services/contact')) {
    filePath = '/pages/contact/contact.html';
  } else if (pathname === '/start-your-tax-return' || pathname === '/start-your-tax-return.html' || pathname === '/start-your-tax-return/start-your-tax-return.html' || pathname.startsWith('/services/start-your-tax-return')) {
    filePath = '/pages/start-your-tax-return/start-your-tax-return.html';
  } else if (pathname === '/admin' || pathname === '/admin.html' || pathname === '/admin/admin.html') {
    filePath = '/pages/admin/admin.html';
  } else if (pathname === '/coming-soon' || pathname === '/coming-soon.html' || pathname === '/pages/coming-soon/coming-soon.html') {
    filePath = '/pages/coming-soon/coming-soon.html';
  } else if (pathname === '/privacy-policy' || pathname === '/privacy-policy.html' || pathname === '/legal/privacy-policy.html') {
    filePath = '/pages/legal/privacy-policy.html';
  } else if (pathname === '/terms-of-use' || pathname === '/terms-of-use.html' || pathname === '/legal/terms-of-use.html') {
    filePath = '/pages/legal/terms-of-use.html';
  }

  const fullPath = path.join(ROOT, filePath);

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Rockwell local server running at http://localhost:${PORT}`);
  console.log(`   Admin portal: http://localhost:${PORT}/admin`);
});
