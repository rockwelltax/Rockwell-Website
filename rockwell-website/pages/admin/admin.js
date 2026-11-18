/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Admin Portal Controller (Vanilla JS)
   ============================================================ */

(function () {
  'use strict';

  // API Base resolution
  const API_AUTH = '/api/auth';
  const API_INQUIRIES = '/api/inquiries';

  // State
  let authToken = localStorage.getItem('rockwell_admin_token') || null;
  let allInquiries = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let activeModalInquiry = null;
  let countdownInterval = null;

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

  /* ── 1. App Initialization ── */
  function init() {
    setupAuthListeners();
    setupDashboardListeners();

    if (authToken) {
      showDashboard();
      fetchInquiries();
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
    });

    // Search filter
    searchInput.addEventListener('input', function (e) {
      currentSearch = e.target.value.toLowerCase().trim();
      renderInquiries();
    });

    // Type tabs
    typeTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        typeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-type');
        renderInquiries();
      });
    });

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
    tableLoading.style.display = 'block';
    tableEmpty.style.display = 'none';
    tableWrap.style.display = 'none';

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
      tableLoading.textContent = 'Error connecting to database. Please refresh or check connection.';
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

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
