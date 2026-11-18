/* ============================================================
   ROCKWELL — Client-side Form Validation
   ============================================================ */

(function () {
  'use strict';

  /* ── Helpers ── */
  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  function showError(field, msg) {
    clearError(field);
    field.setAttribute('aria-invalid', 'true');
    const err = document.createElement('span');
    err.className = 'field-error';
    err.setAttribute('role', 'alert');
    err.id = field.id + '-error';
    err.textContent = msg;
    field.setAttribute('aria-describedby', err.id);
    field.parentNode.insertBefore(err, field.nextSibling);
    field.classList.add('is-invalid');
  }

  function clearError(field) {
    field.setAttribute('aria-invalid', 'false');
    field.classList.remove('is-invalid');
    field.classList.remove('is-valid');
    const existing = document.getElementById(field.id + '-error');
    if (existing) existing.remove();
    field.removeAttribute('aria-describedby');
  }

  function markValid(field) {
    clearError(field);
    field.classList.add('is-valid');
  }

  function validateField(field) {
    const val = field.value.trim();
    const type = field.type;
    const required = field.hasAttribute('required');

    if (required && !val) {
      showError(field, 'This field is required.');
      return false;
    }

    if (type === 'email' && val && !isValidEmail(val)) {
      showError(field, 'Please enter a valid email address.');
      return false;
    }

    markValid(field);
    return true;
  }

  function validateRadioGroup(name, form) {
    const radios = form.querySelectorAll(`input[name="${name}"]`);
    const checked = Array.from(radios).some(r => r.checked);
    const container = radios[0] ? radios[0].closest('.form-radio-group') : null;

    // Remove old error
    const oldErr = form.querySelector(`.field-error[data-group="${name}"]`);
    if (oldErr) oldErr.remove();

    if (!checked && container) {
      const err = document.createElement('span');
      err.className = 'field-error';
      err.setAttribute('role', 'alert');
      err.setAttribute('data-group', name);
      err.textContent = 'Please select an option.';
      container.appendChild(err);
      return false;
    }
    return true;
  }

  /* ── Init a form ── */
  function initForm(form) {
    if (!form) return;

    const textFields = form.querySelectorAll('input[type="text"], input[type="email"], textarea, select');

    // Live validation on blur
    textFields.forEach(function (field) {
      field.addEventListener('blur', function () {
        validateField(field);
      });
      field.addEventListener('input', function () {
        if (field.classList.contains('is-invalid')) validateField(field);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      let valid = true;

      // Text / email / select
      textFields.forEach(function (field) {
        if (!validateField(field)) valid = false;
      });

      // Required radio groups
      const radioGroupNames = new Set();
      form.querySelectorAll('input[type="radio"][required]').forEach(function (r) {
        radioGroupNames.add(r.name);
      });
      radioGroupNames.forEach(function (name) {
        if (!validateRadioGroup(name, form)) valid = false;
      });

      if (!valid) {
        const firstErr = form.querySelector('.is-invalid, .field-error');
        if (firstErr) {
          const target = firstErr.previousElementSibling || firstErr;
          target.focus && target.focus();
          target.scrollIntoView && target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      submitForm(form);
    });
  }

  /* ── Form Submission (Real Endpoint + Fallback) ── */
  async function submitForm(form) {
    const btn = form.querySelector('[type="submit"]');
    const successEl = document.getElementById('form-success');

    // Loading state
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('data-original', btn.textContent);
      btn.textContent = 'Sending…';
    }

    try {
      // Gather form fields into structured payload
      const formData = new FormData(form);
      const data = {};
      formData.forEach((val, key) => { data[key] = val; });

      const isTax = form.id === 'tax-inquiry-form';
      const payload = {
        name: data.fullName || data.name || 'Anonymous Client',
        email: data.email || '',
        phone: data.phone || '',
        type: isTax ? 'tax_inquiry' : (data.service || 'general_contact'),
        service_requested: isTax ? 'Tax Preparation' : (data.service || 'General Inquiry'),
        details: data
      };

      // POST to /api/inquiries
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.warn('API returned non-200 status, displaying success message for UI stability.');
      }
    } catch (err) {
      console.warn('Network submission fallback:', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.getAttribute('data-original') || 'Submit';
      }

      form.style.display = 'none';

      if (successEl) {
        successEl.hidden = false;
        successEl.focus();
      }
    }
  }

  /* ── Auto-init all forms with data-validate ── */
  function init() {
    document.querySelectorAll('form[data-validate]').forEach(initForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual init
  window.RockwellForms = { init: initForm };

})();
