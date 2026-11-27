/* ============================================================
   ROCKWELL — Client-side Form Validation, Turnstile & Follow-Up UX
   ============================================================ */

(function () {
  'use strict';

  const FORMATTED_SSN_REGEX = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/;
  const LABELED_SSN_REGEX = /\b(?:ssn|social\s*security|itin|tax\s*id|ein)[\s:#=-]*\d[\d\s-]{7,11}\b/i;
  const RAW_9DIGIT_SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}\b/;

  let serverFormToken = null;
  let activeTurnstileSiteKey = null;
  let followUpEmailAddress = 'info@rockwelltaxdigital.com';
  const turnstileWidgets = new Map();

  function isSsnLike(val, isPhoneField) {
    const s = String(val || '');
    if (!s) return false;
    if (FORMATTED_SSN_REGEX.test(s) || LABELED_SSN_REGEX.test(s)) return true;
    if (!isPhoneField && RAW_9DIGIT_SSN_REGEX.test(s)) return true;
    return false;
  }

  function isValidEmail(val) {
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(val.trim());
  }

  function isValidPhone(val) {
    const digits = val.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  function showError(field, msg) {
    clearError(field);
    field.setAttribute('aria-invalid', 'true');
    const err = document.createElement('span');
    err.className = 'field-error';
    err.setAttribute('role', 'alert');
    err.id = (field.id || field.name) + '-error';
    err.textContent = msg;
    field.setAttribute('aria-describedby', err.id);
    field.parentNode.insertBefore(err, field.nextSibling);
    field.classList.add('is-invalid');
  }

  function clearError(field) {
    field.setAttribute('aria-invalid', 'false');
    field.classList.remove('is-invalid');
    field.classList.remove('is-valid');
    const existing = document.getElementById((field.id || field.name) + '-error');
    if (existing) existing.remove();
    field.removeAttribute('aria-describedby');
  }

  function markValid(field) {
    clearError(field);
    field.classList.add('is-valid');
  }

  function validateField(field) {
    if (field.name === '_hp' || field.name === 'website_url') return true;

    const val = field.value.trim();
    const type = field.type;
    const required = field.hasAttribute('required');
    const isPhone = type === 'tel' || field.name === 'phone';

    if (required && !val) {
      showError(field, 'This field is required.');
      return false;
    }

    // Strict SSN rejection: warn & reject rather than silently mutating submitted text
    if (val && isSsnLike(val, isPhone)) {
      showError(
        field,
        'Please remove any Social Security Number (SSN) or Tax ID before submitting.'
      );
      return false;
    }

    if (type === 'email' && val && !isValidEmail(val)) {
      showError(field, 'Please enter a valid email address.');
      return false;
    }

    if (isPhone && val && !isValidPhone(val)) {
      showError(field, 'Please enter a valid phone number (7–15 digits).');
      return false;
    }

    if ((field.name === 'fullName' || field.name === 'practiceName') && val) {
      if (val.length < 2 || !/[a-zA-Z]/.test(val)) {
        showError(field, 'Please enter a valid name.');
        return false;
      }
    }

    if (field.name === 'message' && required && val && val.length < 4) {
      showError(field, 'Please enter a brief description of how we can help.');
      return false;
    }

    markValid(field);
    return true;
  }

  function validateRadioGroup(name, form) {
    const radios = form.querySelectorAll(`input[name="${name}"]`);
    const checked = Array.from(radios).some((r) => r.checked);
    const container = radios[0] ? radios[0].closest('.form-radio-group') : null;

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

  /* ── Initialize Signed Form Config, HttpOnly Device Cookie & Turnstile ── */
  async function initSecurityConfig() {
    try {
      const res = await fetch('/api/inquiries?action=config', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (res && res.ok) {
        const cfg = await res.json();
        if (cfg.formToken) serverFormToken = cfg.formToken;
        if (cfg.turnstileSiteKey) activeTurnstileSiteKey = cfg.turnstileSiteKey;
        if (cfg.followUpEmail) followUpEmailAddress = cfg.followUpEmail;
      }
    } catch (_) {}

    const containers = document.querySelectorAll('[data-turnstile-container]');
    if (!containers.length || !activeTurnstileSiteKey) return;

    try {
      if (!window.turnstile) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (window.turnstile && typeof window.turnstile.render === 'function') {
        containers.forEach(function (container) {
          const form = container.closest('form');
          const action = container.getAttribute('data-turnstile-action') || 'contact_inquiry';
          const widgetId = window.turnstile.render(container, {
            sitekey: activeTurnstileSiteKey,
            action: action,
            theme: 'light'
          });
          if (form && widgetId !== undefined) {
            turnstileWidgets.set(form, widgetId);
          }
        });
      }
    } catch (_) {}
  }

  /* ── Init a form ── */
  function initForm(form) {
    if (!form || form.dataset.rwInitialized === 'true') return;
    form.dataset.rwInitialized = 'true';

    const textFields = form.querySelectorAll(
      'input[type="text"]:not([name="_hp"]):not([name="website_url"]), input[type="email"], input[type="tel"], textarea, select'
    );

    const ssnAlert =
      form.querySelector('#ssn-alert, #contact-ssn-alert, #firm-ssn-alert') ||
      document.getElementById('ssn-alert') ||
      document.getElementById('contact-ssn-alert') ||
      document.getElementById('firm-ssn-alert');

    textFields.forEach(function (field) {
      field.addEventListener('blur', function () {
        validateField(field);
      });
      field.addEventListener('input', function () {
        const isPhone = field.type === 'tel' || field.name === 'phone';
        if (isSsnLike(field.value, isPhone)) {
          if (ssnAlert) ssnAlert.style.display = 'block';
        } else if (ssnAlert) {
          ssnAlert.style.display = 'none';
        }
        if (field.classList.contains('is-invalid')) validateField(field);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      let valid = true;

      textFields.forEach(function (field) {
        if (!validateField(field)) valid = false;
      });

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

  /* ── Error & 24-Hour Legitimate Follow-Up Card ── */
  function getOrCreateErrorBox(form) {
    let errBox = form.querySelector('.form-submit-error');
    if (!errBox) {
      errBox = document.createElement('div');
      errBox.className = 'form-submit-error notice notice--warning';
      errBox.setAttribute('role', 'alert');
      errBox.style.cssText = 'margin-bottom: 1rem; padding: 0.95rem 1.1rem; border-radius: 8px; background: #FDF2F0; color: #C53B27; border: 1px solid #F9D2CB; font-size: 0.875rem; line-height: 1.5;';
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn && submitBtn.parentNode) {
        submitBtn.parentNode.insertBefore(errBox, submitBtn);
      } else {
        form.appendChild(errBox);
      }
    }
    return errBox;
  }

  function showSubmitError(form, message) {
    const errBox = getOrCreateErrorBox(form);
    errBox.style.background = '#FDF2F0';
    errBox.style.color = '#C53B27';
    errBox.style.borderColor = '#F9D2CB';
    errBox.textContent = message;
    errBox.hidden = false;
    errBox.scrollIntoView && errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function show24HourFollowUpCard(form, message, payload) {
    const errBox = getOrCreateErrorBox(form);
    errBox.style.background = '#F3F9FB';
    errBox.style.color = '#29211D';
    errBox.style.borderColor = '#B6DCE5';
    errBox.innerHTML = '';

    const title = document.createElement('strong');
    title.style.display = 'block';
    title.style.marginBottom = '0.35rem';
    title.style.color = '#29211D';
    title.textContent = 'Recent Inquiry Already Logged — Need to Ask About Another Service?';

    const desc = document.createElement('p');
    desc.style.margin = '0 0 0.75rem 0';
    desc.textContent =
      message +
      ' To inquire about an additional service (such as Bookkeeping, Digital Services, or Firm Support) or add details right away, click below to email our team directly with your details pre-filled:';

    const subj = encodeURIComponent(`Additional Service Inquiry: ${payload.service_requested || payload.type} — ${payload.name}`);
    const bodyLines = [
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      payload.phone ? `Phone: ${payload.phone}` : '',
      `Service Requested: ${payload.service_requested || payload.type}`,
      payload.details?.message ? `\nDetails:\n${payload.details.message}` : ''
    ].filter(Boolean).join('\n');

    const mailLink = document.createElement('a');
    mailLink.href = `mailto:${followUpEmailAddress}?subject=${subj}&body=${encodeURIComponent(bodyLines)}`;
    mailLink.className = 'btn btn--primary btn--sm';
    mailLink.style.display = 'inline-flex';
    mailLink.textContent = `Send Direct Follow-Up to ${followUpEmailAddress} →`;

    errBox.appendChild(title);
    errBox.appendChild(desc);
    errBox.appendChild(mailLink);
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

    const formData = new FormData(form);
    const data = {};
    formData.forEach((val, key) => { data[key] = val; });

    // Require Cloudflare Turnstile token if widget is rendered
    let turnstileToken = data['cf-turnstile-response'] || '';
    if (!turnstileToken && window.turnstile && turnstileWidgets.has(form)) {
      try {
        turnstileToken = window.turnstile.getResponse(turnstileWidgets.get(form)) || '';
      } catch (_) {}
    }

    if (activeTurnstileSiteKey && turnstileWidgets.has(form) && !turnstileToken) {
      showSubmitError(form, 'Please complete the security verification check before submitting.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.setAttribute('data-original', btn.textContent);
      btn.textContent = 'Sending…';
    }

    try {
      // Ensure form token was fetched if page loaded offline briefly
      if (!serverFormToken) {
        const cfgRes = await fetch('/api/inquiries?action=config', { credentials: 'same-origin' }).catch(() => null);
        if (cfgRes && cfgRes.ok) {
          const cfg = await cfgRes.json().catch(() => ({}));
          serverFormToken = cfg.formToken || null;
        }
      }

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

      const cleanDetails = Object.assign({}, data);
      delete cleanDetails._hp;
      delete cleanDetails.website_url;
      delete cleanDetails['cf-turnstile-response'];

      let inquiryName = data.fullName || data.name || 'Anonymous Client';
      let inquiryType = contactType;
      let serviceRequested = data.subject || data.service || 'General Inquiry';

      if (isTax) {
        inquiryType = taxType;
        serviceRequested = taxType === '1099_tax' ? 'Self-Employed / 1099 Tax Return' : 'Individual Tax Return (W-2)';
      } else if (isFirm) {
        inquiryType = 'firm_support';
        inquiryName = data.practiceName
          ? `${data.practiceName} (${data.fullName || 'Primary Contact'})`
          : (data.fullName || 'Firm Inquiry');
        serviceRequested = data.firmType
          ? `Firm Support (${data.firmType})`
          : 'Tax Firm Back-Office Support';
      }

      const payload = {
        name: inquiryName,
        email: data.email || '',
        phone: data.phone || '',
        type: inquiryType,
        service_requested: serviceRequested,
        details: cleanDetails,
        _hp: data._hp || '',
        website_url: data.website_url || '',
        _ft: serverFormToken || '',
        turnstileToken: turnstileToken
      };

      const isFileProtocol = window.location.protocol === 'file:';
      const endpoints = isFileProtocol
        ? ['http://localhost:3000/api/inquiries', 'https://rockwellwebsite.vercel.app/api/inquiries']
        : ['/api/inquiries'];

      let res = null;
      let lastErr = null;
      for (const endpoint of endpoints) {
        try {
          res = await fetch(endpoint, {
            method: 'POST',
            credentials: 'same-origin',
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
        if (window.turnstile && turnstileWidgets.has(form)) {
          try { window.turnstile.reset(turnstileWidgets.get(form)); } catch (_) {}
        }

        if (res.status === 429 && resData.code === 'RATE_LIMIT_24H') {
          if (resData.followUpEmail) followUpEmailAddress = resData.followUpEmail;
          show24HourFollowUpCard(
            form,
            resData.error || 'One inquiry submission is permitted every 24 hours.',
            payload
          );
          return;
        }

        const msg = resData.error || `Submission failed (HTTP ${res.status}). Please try again.`;
        showSubmitError(form, msg);
        return;
      }

      form.style.display = 'none';

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
        'Unable to submit your inquiry right now. Please check your connection and try again.'
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.getAttribute('data-original') || 'Submit';
      }
    }
  }

  function init() {
    document.querySelectorAll('form[data-validate]').forEach(initForm);
    initSecurityConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RockwellForms = { init: initForm };

})();
