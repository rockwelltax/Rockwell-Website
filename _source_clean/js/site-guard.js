/**
 * Rockwell Tax & Digital Strategies Inc.
 * Site Publication Guard & Admin Preview Controller
 */
(function() {
  const path = window.location.pathname.toLowerCase();

  // Exempt routes that should never be intercepted
  if (
    path.startsWith('/coming-soon') ||
    path.startsWith('/admin') ||
    path.startsWith('/api') ||
    path.includes('coming-soon.html') ||
    path.includes('admin.html')
  ) {
    return;
  }

  const adminToken = localStorage.getItem('rockwell_admin_token');

  // Fast check: fetch site status
  fetch('/api/site-status')
    .then(res => res.json())
    .then(data => {
      const isPublished = data && data.is_published;

      if (!isPublished) {
        if (adminToken) {
          // Admin is browsing the site -> show executive preview banner
          showAdminPreviewBanner(data.status, data.scheduled_at);
        } else {
          // Public visitor -> redirect to Coming Soon splash
          window.location.replace('/coming-soon');
        }
      }
    })
    .catch(() => {
      // If error occurs and no admin token, safe fallback if offline
    });

  function showAdminPreviewBanner(status, scheduledAt) {
    if (document.getElementById('rockwell-admin-preview-bar')) return;

    const banner = document.createElement('div');
    banner.id = 'rockwell-admin-preview-bar';
    banner.style.cssText = `
      position: sticky;
      top: 0;
      left: 0;
      width: 100%;
      background: linear-gradient(90deg, #1f1815 0%, #29211D 50%, #1f1815 100%);
      border-bottom: 2px solid #BCA18A;
      color: #FAF8F5;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      z-index: 999999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    `;

    const statusText = status === 'scheduled' && scheduledAt
      ? `Scheduled Launch: ${new Date(scheduledAt).toLocaleString()}`
      : `Coming Soon Mode Active`;

    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span style="background:rgba(188,161,138,0.2); border:1px solid #BCA18A; color:#BCA18A; font-weight:700; font-size:10px; letter-spacing:0.08em; padding:2px 8px; border-radius:9999px; text-transform:uppercase;">Admin Preview</span>
        <span style="color:#d6c4b2;">● ${statusText} &mdash; Public visitors are redirected to the Coming Soon page.</span>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <a href="/admin" style="background:#3892A9; color:#ffffff; text-decoration:none; font-weight:600; font-size:12px; padding:4px 12px; border-radius:6px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          Admin Portal &rarr;
        </a>
      </div>
    `;

    if (document.body) {
      document.body.prepend(banner);
    } else {
      window.addEventListener('DOMContentLoaded', () => document.body.prepend(banner));
    }
  }
})();
