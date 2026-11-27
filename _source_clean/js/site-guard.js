/**
 * Rockwell Tax & Digital Strategies Inc.
 * Strict Site Publication Guard & Zero-Flash Gatekeeper with Live Sync
 */
(function() {
  const path = window.location.pathname.toLowerCase();

  // Exempt routes that must always be accessible
  if (
    path.startsWith('/coming-soon') ||
    path.startsWith('/admin') ||
    path.startsWith('/api') ||
    path.includes('coming-soon.html') ||
    path.includes('admin.html')
  ) {
    return;
  }

  const CACHE_KEY = 'rockwell_site_published';
  const CACHE_TIME_KEY = 'rockwell_site_status_time';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  function hasPreviewQueryParam() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('preview') === 'admin';
    } catch (_) {
      return false;
    }
  }

  // Check if session or recent local storage already knows the site is published
  function isKnownPublished() {
    try {
      if (sessionStorage.getItem(CACHE_KEY) === 'true') return true;
      const localStatus = localStorage.getItem(CACHE_KEY);
      const localTime = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
      if (localStatus === 'true' && (Date.now() - localTime < CACHE_TTL_MS)) {
        sessionStorage.setItem(CACHE_KEY, 'true');
        return true;
      }
    } catch (_) {}
    return false;
  }

  const alreadyPublished = isKnownPublished();

  // 1. Zero-Flash Shield: ONLY if not already confirmed to be published
  let shield = null;
  if (!alreadyPublished) {
    shield = document.getElementById('rockwell-guard-shield');
    if (!shield) {
      shield = document.createElement('style');
      shield.id = 'rockwell-guard-shield';
      shield.textContent = 'html { visibility: hidden !important; opacity: 0 !important; background-color: #FAF8F5 !important; }';
      (document.head || document.documentElement).appendChild(shield);
    }
  }

  function revealPage() {
    if (shield && shield.parentNode) {
      shield.parentNode.removeChild(shield);
      shield = null;
    }
    document.documentElement.style.visibility = '';
    document.documentElement.style.opacity = '';
  }

  function redirectToComingSoon() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_KEY);
    } catch (_) {}
    window.location.replace('/coming-soon');
  }

  // 2. Initial Gatekeeper Check from server (requires server-verified HttpOnly session for Admin Preview)
  fetch('/api/site-status?t=' + Date.now(), {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
  })
    .then(res => res.json())
    .then(data => {
      const isPublished = data && data.is_published;
      const isServerVerifiedAdminPreview = hasPreviewQueryParam() && Boolean(data && data.is_admin_authenticated);

      if (!isPublished) {
        try {
          sessionStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_KEY);
        } catch (_) {}

        // Site is NOT published (either Coming Soon or Scheduled)
        if (isServerVerifiedAdminPreview) {
          revealPage();
          showAdminPreviewBanner(data.status, data.scheduled_at);
        } else {
          redirectToComingSoon();
        }
      } else {
        try {
          sessionStorage.setItem(CACHE_KEY, 'true');
          localStorage.setItem(CACHE_KEY, 'true');
          localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
        } catch (_) {}
        revealPage();
      }
    })
    .catch(() => {
      if (alreadyPublished) {
        revealPage();
      } else {
        redirectToComingSoon();
      }
    });

  // 3. Live Heartbeat Sync: automatically eject public visitors if site is unpublished
  function pollLiveStatus() {
    fetch('/api/site-status?t=' + Date.now(), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    })
      .then(res => res.json())
      .then(data => {
        const isPublished = data && data.is_published;
        const isAdminPreview = hasPreviewQueryParam() && Boolean(data && data.is_admin_authenticated);

        if (!isPublished && !isAdminPreview) {
          try {
            sessionStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(CACHE_KEY);
          } catch (_) {}

          // Site was unpublished by admin while user is browsing: smooth transition out
          if (document.body) {
            document.body.style.transition = 'opacity 0.5s ease';
            document.body.style.opacity = '0';
          }
          setTimeout(() => {
            redirectToComingSoon();
          }, 450);
        } else if (isAdminPreview) {
          updateAdminPreviewBanner(data.status, data.scheduled_at);
        }
      })
      .catch(() => {});
  }

  setInterval(pollLiveStatus, 5000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pollLiveStatus();
    }
  });

  function showAdminPreviewBanner(status, scheduledAt) {
    if (document.getElementById('rockwell-admin-preview-bar')) {
      updateAdminPreviewBanner(status, scheduledAt);
      return;
    }

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
        <span id="rockwell-preview-status-text" style="color:#d6c4b2;">● ${statusText} &mdash; Public visitors are redirected to the Coming Soon page.</span>
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

  function updateAdminPreviewBanner(status, scheduledAt) {
    const label = document.getElementById('rockwell-preview-status-text');
    if (label) {
      const statusText = status === 'scheduled' && scheduledAt
        ? `Scheduled Launch: ${new Date(scheduledAt).toLocaleString()}`
        : `Coming Soon Mode Active`;
      label.textContent = `● ${statusText} — Public visitors are redirected to the Coming Soon page.`;
    }
  }
})();
