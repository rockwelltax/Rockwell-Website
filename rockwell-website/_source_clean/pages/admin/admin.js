/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Admin Portal Controller (Vanilla JS)
   ============================================================ */

(function () {
  'use strict';

  // API Base resolution
  const isStaticLocal =
    window.location.protocol === 'file:' ||
    ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') &&
      window.location.port !== '3000');
  const API_BASE = isStaticLocal ? 'http://localhost:3000' : '';
  const API_AUTH = `${API_BASE}/api/auth`;
  const API_INQUIRIES = `${API_BASE}/api/inquiries`;
  const API_SITE_STATUS = `${API_BASE}/api/site-status`;

  // State
  let authToken = localStorage.getItem('rockwell_admin_token') || null;
  let allInquiries = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let activeModalInquiry = null;
  let countdownInterval = null;
  let liveStatusCountdownTimer = null;
  let currentSitePublishing = null;
  let pendingPublishingAction = null;

  // DOM Elements
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginStep = document.getElementById('login-step');
  const forgotStep = document.getElementById('forgot-step');
  const loginForm = document.getElementById('login-form');
  const loginAlert = document.getElementById('login-alert');
  const forgotAlert = document.getElementById('forgot-alert');
  const userDisplayEmail = document.getElementById('user-display-email');
  const btnLogout = document.getElementById('btn-logout');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnExportCsv = document.getElementById('btn-export-csv');

  // Inquiries DOM
  const tableWrap = document.getElementById('table-wrap');
  const tableLoading = document.getElementById('table-loading');
  const tableEmpty = document.getElementById('table-empty');
  const tbody = document.getElementById('inquiries-tbody');
  const searchInput = document.getElementById('search-input');
  const typeTabs = document.querySelectorAll('.type-tab');

  // Metric elements
  const metricTotal = document.getElementById('metric-total');
  const metricNew = document.getElementById('metric-new');
  const metricTax = document.getElementById('metric-tax');
  const metricBusiness = document.getElementById('metric-business');

  // Modal DOM
  const detailModal = document.getElementById('detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalClientName = document.getElementById('modal-client-name');
  const modalTypeBadge = document.getElementById('modal-type-badge');
  const modalContent = document.getElementById('modal-content');
  const modalStatusSelect = document.getElementById('modal-status-select');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalEmailBtn = document.getElementById('modal-email-btn');

  // Forgot password DOM
  const btnShowForgot = document.getElementById('btn-show-forgot');
  const btnBackLogin = document.getElementById('btn-back-login');
  const btnSendCode = document.getElementById('btn-send-code');
  const btnSubmitReset = document.getElementById('btn-submit-reset');
  const forgotSubEmail = document.getElementById('forgot-sub-email');
  const forgotSubVerify = document.getElementById('forgot-sub-verify');
  const forgotEmailInput = document.getElementById('forgot-email');
  const resetCodeInput = document.getElementById('reset-code');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const timerCountdown = document.getElementById('timer-countdown');

  // Publishing Controls DOM
  const pubStatusBadge = document.getElementById('pub-status-badge');
  const pubStatusBadgeText = document.getElementById('pub-status-badge-text');
  const pubStatusDetail = document.getElementById('pub-status-detail');
  const btnModeComingSoon = document.getElementById('btn-mode-coming-soon');
  const btnModeSchedule = document.getElementById('btn-mode-schedule');
  const btnModePublish = document.getElementById('btn-mode-publish');
  const pubScheduleDrawer = document.getElementById('pub-schedule-drawer');
  const pubDatetimeInput = document.getElementById('pub-datetime-input');
  const pubDatetimeHint = document.getElementById('pub-datetime-hint');
  const btnSaveSchedule = document.getElementById('btn-save-schedule');
  const btnCancelSchedule = document.getElementById('btn-cancel-schedule');
  const pubSchedulePreview = document.getElementById('pub-schedule-preview');
  const pubPreviewD = document.getElementById('pub-preview-d');
  const pubPreviewH = document.getElementById('pub-preview-h');
  const pubPreviewM = document.getElementById('pub-preview-m');
  const pubPreviewS = document.getElementById('pub-preview-s');
  const pubPresetPills = document.querySelectorAll('.pub-preset-pill');

  // Confirmation Modal DOM
  const pubConfirmModal = document.getElementById('pub-confirm-modal');
  const btnClosePubModal = document.getElementById('btn-close-pub-modal');
  const btnCancelPubModal = document.getElementById('btn-cancel-pub-modal');
  const btnExecutePubModal = document.getElementById('btn-execute-pub-modal');
  const pubModalEyebrow = document.getElementById('pub-modal-eyebrow');
  const pubModalTitle = document.getElementById('pub-modal-title');
  const pubModalMessage = document.getElementById('pub-modal-message');
  const pubModalImpact = document.getElementById('pub-modal-impact');
  const toastContainer = document.getElementById('admin-toast-container');

  /* ── 1. App Initialization ── */
  function init() {
    setupAuthListeners();
    setupDashboardListeners();

    if (authToken) {
      try {
        const decoded = atob(authToken);
        const [email] = decoded.split(':');
        if (email) userDisplayEmail.textContent = email;
      } catch (_) {}
      showDashboard();
      fetchInquiries();
      fetchPublishingStatus();
    } else {
      showAuth();
    }
  }

  function showAuth() {
    authView.style.display = 'flex';
    dashboardView.style.display = 'none';
  }

  function showDashboard() {
    authView.style.display = 'none';
    dashboardView.style.display = 'block';
  }

  /* ── 2. Auth Listeners ── */
  function setupAuthListeners() {
    // Login form submit
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      loginAlert.style.display = 'none';

      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;
      const btn = document.getElementById('btn-login');

      if (!email || !password) {
        showLoginAlert('Please enter both email and password.');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span>Verifying credentials...</span>';

      try {
        const res = await fetch(`${API_AUTH}?action=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          showLoginAlert(data.error || 'Invalid credentials or login locked.');
          btn.disabled = false;
          btn.innerHTML = '<span>Sign In to Dashboard</span>';
          return;
        }

        authToken = data.token;
        localStorage.setItem('rockwell_admin_token', authToken);
        userDisplayEmail.textContent = data.user?.email || email;

        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to Dashboard</span>';
        showDashboard();
        fetchInquiries();
        fetchPublishingStatus();
      } catch (err) {
        showLoginAlert('Unable to reach auth server. Please check your network connection.');
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to Dashboard</span>';
      }
    });

    // Toggle forgot password view
    btnShowForgot.addEventListener('click', function () {
      loginStep.style.display = 'none';
      forgotStep.style.display = 'block';
      forgotAlert.style.display = 'none';
      forgotSubEmail.style.display = 'block';
      forgotSubVerify.style.display = 'none';
      clearInterval(countdownInterval);
    });

    btnBackLogin.addEventListener('click', function () {
      forgotStep.style.display = 'none';
      loginStep.style.display = 'block';
      clearInterval(countdownInterval);
    });

    // Step A: Send 2-minute reset code
    btnSendCode.addEventListener('click', async function () {
      const email = forgotEmailInput.value.trim();
      if (!email) {
        showForgotAlert('Please enter your admin email address.', 'error');
        return;
      }

      btnSendCode.disabled = true;
      btnSendCode.textContent = 'Sending code via Resend...';

      try {
        const res = await fetch(`${API_AUTH}?action=forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!res.ok) {
          showForgotAlert(data.error || 'Failed to send verification code.', 'error');
          btnSendCode.disabled = false;
          btnSendCode.textContent = 'Send 2-Min Verification Code';
          return;
        }

        showForgotAlert(data.message, 'success');
        forgotSubEmail.style.display = 'none';
        forgotSubVerify.style.display = 'block';
        start2MinCountdown();
      } catch (err) {
        showForgotAlert('Error communicating with mail service.', 'error');
        btnSendCode.disabled = false;
        btnSendCode.textContent = 'Send 2-Min Verification Code';
      }
    });

    // Step B: Submit reset code & new password
    btnSubmitReset.addEventListener('click', async function () {
      const email = forgotEmailInput.value.trim();
      const code = resetCodeInput.value.trim();
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!code || code.length !== 6) {
        showForgotAlert('Please enter the valid 6-digit code.', 'error');
        return;
      }

      if (!newPassword || newPassword.length < 6) {
        showForgotAlert('Password must be at least 6 characters long.', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        showForgotAlert('Passwords do not match.', 'error');
        return;
      }

      btnSubmitReset.disabled = true;
      btnSubmitReset.textContent = 'Updating password...';

      try {
        const res = await fetch(`${API_AUTH}?action=reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, newPassword })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          showForgotAlert(data.error || 'Failed to reset password. Code may have expired.', 'error');
          btnSubmitReset.disabled = false;
          btnSubmitReset.textContent = 'Confirm & Update Password';
          return;
        }

        clearInterval(countdownInterval);
        showForgotAlert('Password updated successfully! You can now log in.', 'success');
        setTimeout(function () {
          forgotStep.style.display = 'none';
          loginStep.style.display = 'block';
          document.getElementById('admin-password').value = newPassword;
        }, 1200);
      } catch (err) {
        showForgotAlert('Failed to update password. Please try again.', 'error');
        btnSubmitReset.disabled = false;
        btnSubmitReset.textContent = 'Confirm & Update Password';
      }
    });
  }

  function start2MinCountdown() {
    let timeLeft = 120; // 2 minutes in seconds
    clearInterval(countdownInterval);

    function tick() {
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      timerCountdown.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        showForgotAlert('⏱️ The verification code has expired. Please request a new code.', 'error');
        btnSubmitReset.disabled = true;
      }
      timeLeft--;
    }

    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  function showLoginAlert(msg) {
    loginAlert.textContent = msg;
    loginAlert.style.display = 'block';
  }

  function showForgotAlert(msg, type = 'error') {
    forgotAlert.textContent = msg;
    forgotAlert.className = `admin-alert admin-alert--${type}`;
    forgotAlert.style.display = 'block';
  }

  /* ── 3. Dashboard Listeners ── */
  function setupDashboardListeners() {
    // Logout
    btnLogout.addEventListener('click', function () {
      localStorage.removeItem('rockwell_admin_token');
      authToken = null;
      showAuth();
    });

    // Refresh
    btnRefresh.addEventListener('click', function () {
      fetchInquiries();
      fetchPublishingStatus();
    });

    // Site Publishing Manager Setup
    setupPublishingListeners();

    // Search filter
    searchInput.addEventListener('input', function (e) {
      currentSearch = e.target.value.toLowerCase().trim();
      renderInquiries();
    });

    // Type tabs
    const typeFilterSelect = document.getElementById('type-filter-select');

    typeTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        typeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-type');
        if (typeFilterSelect) typeFilterSelect.value = currentFilter;
        renderInquiries();
      });
    });

    // Mobile combo box filter
    if (typeFilterSelect) {
      typeFilterSelect.addEventListener('change', function (e) {
        currentFilter = e.target.value;
        typeTabs.forEach(t => {
          t.classList.toggle('active', t.getAttribute('data-type') === currentFilter);
        });
        renderInquiries();
      });
    }

    // Export CSV
    btnExportCsv.addEventListener('click', exportCSV);

    // Modal close
    btnCloseModal.addEventListener('click', function () {
      detailModal.style.display = 'none';
    });

    detailModal.addEventListener('click', function (e) {
      if (e.target === detailModal) detailModal.style.display = 'none';
    });

    // Modal save status
    modalSaveBtn.addEventListener('click', async function () {
      if (!activeModalInquiry) return;
      const newStatus = modalStatusSelect.value;
      modalSaveBtn.disabled = true;
      modalSaveBtn.textContent = 'Saving...';

      try {
        const res = await fetch(API_INQUIRIES, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ id: activeModalInquiry.id, status: newStatus })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          activeModalInquiry.status = newStatus;
          // Update in array
          const idx = allInquiries.findIndex(i => i.id === activeModalInquiry.id);
          if (idx !== -1) allInquiries[idx].status = newStatus;
          renderInquiries();
          updateMetrics();
          detailModal.style.display = 'none';
        } else {
          alert(data.error || 'Failed to update status');
        }
      } catch (e) {
        alert('Network error updating status');
      } finally {
        modalSaveBtn.disabled = false;
        modalSaveBtn.textContent = 'Save Changes';
      }
    });
  }

  /* ── 4. Fetch Inquiries from Database ── */
  async function fetchInquiries() {
    const loadingTextEl = tableLoading.querySelector('.admin-loading-text');
    tableLoading.classList.remove('is-error');
    if (loadingTextEl) loadingTextEl.textContent = 'Loading inquiries from database...';
    tableLoading.style.display = 'flex';
    tableEmpty.style.display = 'none';
    tableWrap.style.display = 'none';

    if (btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.classList.add('is-loading');
    }

    try {
      const res = await fetch(API_INQUIRIES, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (res.status === 401) {
        localStorage.removeItem('rockwell_admin_token');
        authToken = null;
        showAuth();
        return;
      }

      const data = await res.json();
      allInquiries = data.inquiries || [];

      tableLoading.style.display = 'none';
      tableWrap.style.display = 'block';

      updateMetrics();
      renderInquiries();
    } catch (err) {
      tableLoading.classList.add('is-error');
      if (loadingTextEl) {
        loadingTextEl.textContent = 'Error connecting to database. Please refresh or check connection.';
      } else {
        tableLoading.textContent = 'Error connecting to database. Please refresh or check connection.';
      }
    } finally {
      if (btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.classList.remove('is-loading');
      }
    }
  }

  /* ── 5. Render Inquiries Table ── */
  function renderInquiries() {
    let filtered = allInquiries;

    // Filter by Type
    if (currentFilter !== 'all') {
      filtered = filtered.filter(item => item.type === currentFilter);
    }

    // Filter by Search
    if (currentSearch) {
      filtered = filtered.filter(item => {
        const text = `${item.name} ${item.email} ${item.phone || ''} ${item.type} ${JSON.stringify(item.details)}`.toLowerCase();
        return text.includes(currentSearch);
      });
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      tableEmpty.style.display = 'block';
      tableWrap.style.display = 'none';
      return;
    }

    tableEmpty.style.display = 'none';
    tableWrap.style.display = 'block';

    tbody.innerHTML = filtered.map(item => {
      const dateStr = formatDate(item.created_at);
      const typeBadge = getTypeBadge(item.type);
      const statusBadge = getStatusBadge(item.status);

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:#29211D;">${dateStr.date}</div>
            <div class="client-meta">${dateStr.time}</div>
          </td>
          <td>
            <div class="client-name-bold">${escapeHtml(item.name)}</div>
          </td>
          <td>
            <div><a href="mailto:${escapeHtml(item.email)}" style="color:#3892A9;font-weight:500;">${escapeHtml(item.email)}</a></div>
            <div class="client-meta">${escapeHtml(item.phone || 'No phone provided')}</div>
          </td>
          <td>
            ${typeBadge}
            ${item.service_requested ? `<div class="client-meta" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.service_requested)}</div>` : ''}
          </td>
          <td>
            ${statusBadge}
          </td>
          <td class="text-right">
            <button class="btn btn--outline-dark btn--sm btn-view-detail" data-id="${item.id}">
              View Details
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row click listeners
    tbody.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = Number(btn.getAttribute('data-id'));
        openDetailModal(id);
      });
    });
  }

  /* ── 6. Update Metric Cards ── */
  function updateMetrics() {
    const total = allInquiries.length;
    const newCount = allInquiries.filter(i => i.status === 'new').length;
    const taxCount = allInquiries.filter(i => i.type === 'w2_tax' || i.type === '1099_tax').length;
    const bizCount = allInquiries.filter(i => i.type === 'firm_support' || i.type === 'bookkeeping' || i.type === 'digital_services').length;

    metricTotal.textContent = total;
    metricNew.textContent = newCount;
    metricTax.textContent = taxCount;
    metricBusiness.textContent = bizCount;
  }

  /* ── 7. Open Detail Modal ── */
  function openDetailModal(id) {
    const item = allInquiries.find(i => i.id === id);
    if (!item) return;

    activeModalInquiry = item;
    modalClientName.textContent = item.name;
    modalTypeBadge.textContent = formatTypeLabel(item.type);
    modalStatusSelect.value = item.status || 'new';

    modalEmailBtn.setAttribute('href', `mailto:${item.email}?subject=Regarding%20your%20inquiry%20with%20Rockwell%20Tax%20%26%20Digital%20Strategies`);

    const details = item.details || {};
    const detailsRows = Object.entries(details)
      .map(([k, v]) => `
        <tr>
          <td class="detail-label">${formatKey(k)}</td>
          <td><strong>${escapeHtml(String(v))}</strong></td>
        </tr>
      `).join('');

    const dateStr = formatDate(item.created_at);

    modalContent.innerHTML = `
      <div class="detail-section-title">Client Information</div>
      <table class="detail-table" style="margin-bottom:1.25rem;">
        <tr><td class="detail-label">Full Name</td><td><strong>${escapeHtml(item.name)}</strong></td></tr>
        <tr><td class="detail-label">Email</td><td><a href="mailto:${escapeHtml(item.email)}" style="color:#3892A9;">${escapeHtml(item.email)}</a></td></tr>
        <tr><td class="detail-label">Phone</td><td>${escapeHtml(item.phone || 'None')}</td></tr>
        <tr><td class="detail-label">Submitted On</td><td>${dateStr.date} at ${dateStr.time}</td></tr>
        ${item.service_requested ? `<tr><td class="detail-label">Specific Request</td><td>${escapeHtml(item.service_requested)}</td></tr>` : ''}
      </table>

      <div class="detail-section-title">Intake &amp; Form Details</div>
      <table class="detail-table">
        ${detailsRows || '<tr><td colspan="2" style="text-align:center;color:#8C827A;">No additional custom parameters submitted.</td></tr>'}
      </table>
    `;

    detailModal.style.display = 'flex';
  }

  /* ── 8. Export CSV ── */
  function exportCSV() {
    if (allInquiries.length === 0) {
      alert('No inquiries to export.');
      return;
    }

    const headers = ['ID', 'Date', 'Type', 'Name', 'Email', 'Phone', 'Status', 'Service Requested', 'Details'];
    const rows = allInquiries.map(i => [
      i.id,
      new Date(i.created_at).toISOString(),
      i.type,
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${(i.email || '').replace(/"/g, '""')}"`,
      `"${(i.phone || '').replace(/"/g, '""')}"`,
      i.status,
      `"${(i.service_requested || '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(i.details || {}).replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rockwell_inquiries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ── Helper Functions ── */
  function formatDate(isoStr) {
    if (!isoStr) return { date: 'N/A', time: '' };
    const d = new Date(isoStr);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
  }

  function getTypeBadge(type) {
    switch (type) {
      case 'w2_tax':
        return '<span class="badge badge--type-w2">W-2 Individual</span>';
      case '1099_tax':
        return '<span class="badge badge--type-1099">1099 Self-Employed</span>';
      case 'firm_support':
        return '<span class="badge badge--type-firm">Tax Firm Support</span>';
      case 'bookkeeping':
        return '<span class="badge badge--type-bookkeeping">Bookkeeping</span>';
      case 'digital_services':
        return '<span class="badge badge--type-digital">Digital Services</span>';
      default:
        return '<span class="badge badge--type-contact">General Contact</span>';
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'new':
        return '<span class="badge badge--status-new">New</span>';
      case 'reviewed':
        return '<span class="badge badge--status-reviewed">Reviewed</span>';
      case 'contacted':
        return '<span class="badge badge--status-contacted">Contacted</span>';
      case 'completed':
        return '<span class="badge badge--status-completed">Completed</span>';
      default:
        return `<span class="badge">${escapeHtml(status || 'new')}</span>`;
    }
  }

  function formatTypeLabel(type) {
    switch (type) {
      case 'w2_tax': return 'Individual Tax Return (W-2)';
      case '1099_tax': return 'Self-Employed / 1099 Tax Return';
      case 'firm_support': return 'Tax Firm Back-Office Support';
      case 'bookkeeping': return 'Bookkeeping Services';
      case 'digital_services': return 'Digital Services';
      default: return 'General Inquiry';
    }
  }

  function formatKey(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return m;
      }
    });
  }

  /* ══════════════════════════════════════════════
     SITE VISIBILITY & LAUNCH SCHEDULER
     ══════════════════════════════════════════════ */
  function getLocalDatetimeString(date) {
    const pad = n => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast--${type}`;
    
    let iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    toast.innerHTML = `
      <span style="display:flex; align-items:center; flex-shrink:0;">${iconSvg}</span>
      <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  async function fetchPublishingStatus() {
    try {
      const res = await fetch(API_SITE_STATUS);
      const data = await res.json();
      currentSitePublishing = data;
      renderPublishingUI(data);
    } catch (err) {
      console.warn('Failed to load publishing status:', err);
    }
  }

  function renderPublishingUI(data) {
    if (!pubStatusBadge) return;
    clearInterval(liveStatusCountdownTimer);

    const status = data.status || 'coming_soon';

    // Reset button active states
    [btnModeComingSoon, btnModeSchedule, btnModePublish].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    pubStatusBadge.className = 'admin-publish-badge';

    if (status === 'published' || data.is_published) {
      pubStatusBadge.classList.add('admin-publish-badge--published');
      pubStatusBadgeText.textContent = 'Live & Published';
      pubStatusDetail.textContent = 'All public visitors have unrestricted access to the live website.';
      if (btnModePublish) btnModePublish.classList.add('active');
      if (pubScheduleDrawer) pubScheduleDrawer.style.display = 'none';
    } else if (status === 'scheduled' && data.scheduled_at) {
      pubStatusBadge.classList.add('admin-publish-badge--scheduled');
      pubStatusBadgeText.textContent = 'Launch Scheduled';
      if (btnModeSchedule) btnModeSchedule.classList.add('active');

      const targetTime = new Date(data.scheduled_at).getTime();

      function updateStatusCountdown() {
        const diff = targetTime - Date.now();
        if (diff <= 0) {
          clearInterval(liveStatusCountdownTimer);
          fetchPublishingStatus();
          return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);

        const timeStr = `${new Date(data.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
        pubStatusDetail.textContent = `Go-live in ${d}d ${h}h ${m}m ${s}s (${timeStr})`;
      }

      updateStatusCountdown();
      liveStatusCountdownTimer = setInterval(updateStatusCountdown, 1000);
    } else {
      // Coming Soon
      pubStatusBadge.classList.add('admin-publish-badge--coming-soon');
      pubStatusBadgeText.textContent = 'Coming Soon Active';
      pubStatusDetail.textContent = 'Public visitors see the Coming Soon splash page. Admins can preview.';
      if (btnModeComingSoon) btnModeComingSoon.classList.add('active');
      if (pubScheduleDrawer) pubScheduleDrawer.style.display = 'none';
    }
  }

  function validateScheduleInput() {
    if (!pubDatetimeInput) return false;

    // Dynamically lock minimum to right now
    const nowLocal = getLocalDatetimeString(new Date());
    pubDatetimeInput.min = nowLocal;

    const val = pubDatetimeInput.value;
    if (!val) {
      pubDatetimeInput.classList.remove('pub-datetime-input--invalid');
      pubDatetimeHint.textContent = 'Select a future hour to view live countdown';
      pubDatetimeHint.className = 'pub-input-hint';
      btnSaveSchedule.disabled = true;
      if (pubSchedulePreview) pubSchedulePreview.style.display = 'none';
      return false;
    }

    const selectedTime = new Date(val).getTime();
    const nowTime = Date.now();

    // STRICT RULE: past dates and elapsed hours cannot be enabled
    if (isNaN(selectedTime) || selectedTime <= nowTime) {
      pubDatetimeInput.classList.add('pub-datetime-input--invalid');
      pubDatetimeHint.textContent = '⚠️ Elapsed hours and past dates cannot be selected. Please choose a future hour.';
      pubDatetimeHint.className = 'pub-input-hint pub-input-hint--error';
      btnSaveSchedule.disabled = true;
      if (pubSchedulePreview) pubSchedulePreview.style.display = 'none';
      return false;
    }

    // Valid future date
    pubDatetimeInput.classList.remove('pub-datetime-input--invalid');
    pubDatetimeHint.textContent = 'Valid future launch schedule. Ready to arm.';
    pubDatetimeHint.className = 'pub-input-hint';
    btnSaveSchedule.disabled = false;

    // Render countdown preview chips
    const diff = selectedTime - nowTime;
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (pubPreviewD) pubPreviewD.textContent = d;
    if (pubPreviewH) pubPreviewH.textContent = String(h).padStart(2, '0');
    if (pubPreviewM) pubPreviewM.textContent = String(m).padStart(2, '0');
    if (pubPreviewS) pubPreviewS.textContent = String(s).padStart(2, '0');
    if (pubSchedulePreview) pubSchedulePreview.style.display = 'flex';

    return true;
  }

  function setupPublishingListeners() {
    if (!btnModeComingSoon) return;

    // 1. Mode Button: Coming Soon
    btnModeComingSoon.addEventListener('click', () => {
      if (currentSitePublishing && currentSitePublishing.status === 'coming_soon') {
        showToast('Site is already in Coming Soon mode.', 'info');
        return;
      }
      openPublishModal({
        status: 'coming_soon',
        eyebrow: 'Private Access Control',
        title: 'Activate Coming Soon Mode?',
        message: 'Are you sure you want to lock the public website in Coming Soon mode?',
        impact: 'Public visitors will immediately see the luxury Coming Soon splash page. You and other authenticated administrators can continue previewing the live website.'
      });
    });

    // 2. Mode Button: Publish Live Now
    btnModePublish.addEventListener('click', () => {
      if (currentSitePublishing && currentSitePublishing.status === 'published') {
        showToast('Rockwell website is already live and public.', 'info');
        return;
      }
      openPublishModal({
        status: 'published',
        eyebrow: 'Go-Live Authorization',
        title: 'Publish Rockwell Website Live Now?',
        message: 'Are you ready to immediately release the complete Rockwell Tax & Digital Strategies Inc. website to the public?',
        impact: 'All public visitors across the web will have immediate, unrestricted access to all pages, services, tax intake forms, and bookkeeping tools.'
      });
    });

    // 3. Mode Button: Schedule Launch
    btnModeSchedule.addEventListener('click', () => {
      const isDrawerOpen = pubScheduleDrawer.style.display === 'block';
      if (isDrawerOpen) {
        pubScheduleDrawer.style.display = 'none';
      } else {
        pubScheduleDrawer.style.display = 'block';
        // Set dynamic min to now
        pubDatetimeInput.min = getLocalDatetimeString(new Date());

        if (currentSitePublishing && currentSitePublishing.status === 'scheduled' && currentSitePublishing.scheduled_at) {
          pubDatetimeInput.value = getLocalDatetimeString(new Date(currentSitePublishing.scheduled_at));
        } else {
          // Default to +24 hours
          const defaultFuture = new Date(Date.now() + 24 * 3600 * 1000);
          pubDatetimeInput.value = getLocalDatetimeString(defaultFuture);
        }
        validateScheduleInput();
      }
    });

    // 4. Schedule Input validation (strict past-hour prevention)
    pubDatetimeInput.addEventListener('input', validateScheduleInput);
    pubDatetimeInput.addEventListener('change', validateScheduleInput);
    pubDatetimeInput.addEventListener('focus', () => {
      pubDatetimeInput.min = getLocalDatetimeString(new Date());
    });

    // 5. Preset Pills (+24h, +3d, +1w, +2w)
    pubPresetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const hours = parseInt(pill.getAttribute('data-hours'), 10) || 24;
        const target = new Date(Date.now() + hours * 3600 * 1000);
        pubDatetimeInput.value = getLocalDatetimeString(target);
        validateScheduleInput();
      });
    });

    // 6. Confirm & Arm Launch Schedule
    btnSaveSchedule.addEventListener('click', async () => {
      if (!validateScheduleInput()) {
        showToast('Cannot schedule launch in the past. Please select a future date and time.', 'error');
        return;
      }

      const scheduledIso = new Date(pubDatetimeInput.value).toISOString();
      btnSaveSchedule.disabled = true;
      btnSaveSchedule.innerHTML = '<span>Arming Schedule...</span>';

      try {
        const res = await fetch(API_SITE_STATUS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            status: 'scheduled',
            scheduled_at: scheduledIso
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message || 'Launch schedule successfully armed!', 'success');
          pubScheduleDrawer.style.display = 'none';
          fetchPublishingStatus();
        } else {
          showToast(data.error || 'Failed to update schedule.', 'error');
        }
      } catch (err) {
        showToast('Network error while saving schedule.', 'error');
      } finally {
        btnSaveSchedule.disabled = false;
        btnSaveSchedule.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Confirm &amp; Arm Launch Schedule</span>';
      }
    });

    // 7. Cancel Schedule Drawer
    btnCancelSchedule.addEventListener('click', () => {
      pubScheduleDrawer.style.display = 'none';
    });

    // 8. Confirmation Modal events
    function openPublishModal(action) {
      pendingPublishingAction = action;
      pubModalEyebrow.textContent = action.eyebrow;
      pubModalTitle.textContent = action.title;
      pubModalMessage.textContent = action.message;
      pubModalImpact.textContent = action.impact;
      pubConfirmModal.style.display = 'flex';
    }

    function closePublishModal() {
      pendingPublishingAction = null;
      pubConfirmModal.style.display = 'none';
    }

    btnClosePubModal.addEventListener('click', closePublishModal);
    btnCancelPubModal.addEventListener('click', closePublishModal);

    btnExecutePubModal.addEventListener('click', async () => {
      if (!pendingPublishingAction) return;

      const { status } = pendingPublishingAction;
      btnExecutePubModal.disabled = true;
      btnExecutePubModal.textContent = 'Applying Changes...';

      try {
        const res = await fetch(API_SITE_STATUS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ status })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message, 'success');
          closePublishModal();
          fetchPublishingStatus();
        } else {
          showToast(data.error || 'Failed to update status.', 'error');
        }
      } catch (err) {
        showToast('Network error while updating status.', 'error');
      } finally {
        btnExecutePubModal.disabled = false;
        btnExecutePubModal.textContent = 'Confirm & Apply';
      }
    });
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
