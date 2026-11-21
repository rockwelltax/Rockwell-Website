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

  /* ── Form Submission (Real Endpoint with Error Handling) ── */
  function showSubmitError(form, message) {
    let errBox = form.querySelector('.form-submit-error');
    if (!errBox) {
      errBox = document.createElement('div');
      errBox.className = 'form-submit-error notice notice--warning';
      errBox.setAttribute('role', 'alert');
      errBox.style.cssText = 'margin-bottom: 1rem; padding: 0.85rem 1rem; border-radius: 8px; background: #FDF2F0; color: #C53B27; border: 1px solid #F9D2CB; font-size: 0.875rem; font-weight: 500;';
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn && submitBtn.parentNode) {
        submitBtn.parentNode.insertBefore(errBox, submitBtn);
      } else {
        form.appendChild(errBox);
      }
    }
    errBox.textContent = message;
    errBox.hidden = false;
    errBox.scrollIntoView && errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearSubmitError(form) {
    const errBox = form.querySelector('.form-submit-error');
    if (errBox) {
      errBox.hidden = true;
      errBox.textContent = '';
    }
  }

  async function submitForm(form) {
    const btn = form.querySelector('[type="submit"]');
    const successEl = document.getElementById('form-success');

    clearSubmitError(form);

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
      const isFirm = form.id === 'firm-support-form';
      const taxType = data.selfEmployed === 'yes' ? '1099_tax' : 'w2_tax';
      const subjectMap = {
        'tax-inquiry': 'w2_tax',
        'bookkeeping': 'bookkeeping',
        'digital-services': 'digital_services',
        'general': 'general_contact'
      };
      const contactType = subjectMap[data.subject] || data.service || 'general_contact';
      const inquiryType = isFirm ? 'firm_support' : (isTax ? taxType : contactType);
      const serviceRequested = isFirm
        ? `Firm Support (${data.practiceName || data.firmType || 'Accounting Practice'})`
        : (isTax
          ? (taxType === '1099_tax' ? 'Self-Employed / 1099 Tax Return' : 'Individual Tax Return (W-2)')
          : (data.subject || data.service || 'General Inquiry'));

      const payload = {
        name: data.fullName || data.contactName || data.name || (data.practiceName ? `${data.practiceName} (Contact)` : 'Anonymous Client'),
        email: data.email || '',
        phone: data.phone || '',
        type: inquiryType,
        service_requested: serviceRequested,
        details: data
      };

      const isFileProtocol = window.location.protocol === 'file:';
      const endpoints = isFileProtocol
        ? ['http://localhost:3000/api/inquiries', 'https://rockwellwebsite.vercel.app/api/inquiries']
        : ['/api/inquiries', 'http://localhost:3000/api/inquiries', 'https://rockwellwebsite.vercel.app/api/inquiries'];

      let res = null;
      let lastErr = null;
      for (const endpoint of endpoints) {
        try {
          res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!res) {
        throw lastErr || new Error('Unable to reach API server.');
      }

      const resData = await res.json().catch(() => ({}));

      if (!res.ok || !resData.success) {
        const msg = resData.error || `Submission failed (HTTP ${res.status}). Please try again.`;
        showSubmitError(form, msg);
        return;
      }

      form.style.display = 'none';

      // Hide surrounding pre-form intro elements so confirmation screen is clean on mobile
      const preElements = [
        document.querySelector('.tax-form-header'),
        document.querySelector('.tax-path-selector'),
        document.querySelector('.tax-form-security-notice'),
        document.querySelector('.contact-topics'),
        document.querySelector('.firm-intro')
      ];
      preElements.forEach(function (el) {
        if (el) el.style.display = 'none';
      });

      if (successEl) {
        successEl.hidden = false;
        successEl.style.display = 'block';
        successEl.setAttribute('tabindex', '-1');
        successEl.focus({ preventScroll: true });
        successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      showSubmitError(
        form,
        'Unable to submit your inquiry right now. Please check your connection and make sure you are on the live site or http://localhost:3000.'
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.getAttribute('data-original') || 'Submit';
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
