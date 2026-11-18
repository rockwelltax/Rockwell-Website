const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config();

const authHandler = require('./api/auth');
const inquiriesHandler = require('./api/inquiries');

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

  // ── Clean URL rewrites ──
  let filePath = pathname;
  if (pathname === '/' || pathname === '') {
    filePath = '/index.html';
  } else if (pathname === '/services') {
    filePath = '/pages/services/services.html';
  } else if (pathname === '/services/tax-preparation') {
    filePath = '/pages/tax-preparation/tax-preparation.html';
  } else if (pathname === '/services/bookkeeping') {
    filePath = '/pages/bookkeeping/bookkeeping.html';
  } else if (pathname === '/services/digital-services') {
    filePath = '/pages/digital-services/digital-services.html';
  } else if (pathname === '/about') {
    filePath = '/pages/about/about.html';
  } else if (pathname === '/contact') {
    filePath = '/pages/contact/contact.html';
  } else if (pathname === '/start-your-tax-return') {
    filePath = '/pages/start-your-tax-return/start-your-tax-return.html';
  } else if (pathname === '/admin') {
    filePath = '/pages/admin/admin.html';
  } else if (pathname === '/privacy-policy') {
    filePath = '/pages/legal/privacy-policy.html';
  } else if (pathname === '/terms-of-use') {
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
