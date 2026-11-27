/* ============================================================
   ROCKWELL — Client-side Form Validation, Turnstile & Follow-Up UX
   ============================================================ */

(function () {
  'use strict';

  const FORMATTED_SSN_REGEX = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/;
  const LABELED_SSN_REGEX = /\b(?:ssn|social\s*security|itin|tax\s*id|ein)[\s:#=-]*\d[\d\s-]{7,11}\b/i;
  const RAW_9DIGIT_SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}\b/;

  let serverFormToken = null;
  let activeSecurityMode = 'captcha';
  let activeTurnstileSiteKey = null;
  let followUpEmailAddress = 'info@rockwelltaxdigital.com';
  const turnstileWidgets = new Map();
  const captchaWidgets = new Map();

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
    if (field.disabled) {
      clearError(field);
      return true;
    }

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

  /* ── Built-in Cryptographic SVG CAPTCHA Widget Renderer ── */
  function renderBuiltinCaptchaWidget(container, formAction, initialCaptcha) {
    const form = container.closest('form');
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'rw-captcha-card';
    card.style.cssText =
      'background: #FFFFFF; border: 1px solid #D2E1E6; border-radius: 10px; padding: 0.85rem 1rem; box-shadow: 0 2px 8px rgba(30, 107, 123, 0.06); max-width: 440px;';

    const header = document.createElement('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; gap: 0.5rem;';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText =
      'display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.84rem; font-weight: 600; color: #29211D;';
    titleWrap.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z" fill="#E8F4F6" stroke="#1E6B7B" stroke-width="1.8"/><path d="M8.5 12.2L10.9 14.6L15.8 9.7" stroke="#1E6B7B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Security Verification <span style="color:#C53B27;" aria-hidden="true">*</span></span>';

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.setAttribute('aria-label', 'Generate a new security verification code');
    refreshBtn.style.cssText =
      'background: #F2F8FA; border: 1px solid #C8DCE2; color: #1E6B7B; border-radius: 6px; padding: 0.25rem 0.6rem; font-size: 0.76rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; transition: background 0.15s ease;';
    refreshBtn.textContent = '↻ New Code';

    header.appendChild(titleWrap);
    header.appendChild(refreshBtn);

    const bodyRow = document.createElement('div');
    bodyRow.style.cssText =
      'display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;';

    const imgEl = document.createElement('img');
    imgEl.alt = 'Security verification characters';
    imgEl.title = 'Click to load a new code';
    imgEl.style.cssText =
      'width: 186px; height: 52px; border-radius: 6px; border: 1px solid #C8DCE2; background: #EFF6F8; cursor: pointer; flex-shrink: 0; display: block; user-select: none;';
    if (initialCaptcha && initialCaptcha.svgDataUri) {
      imgEl.src = initialCaptcha.svgDataUri;
    }

    const inputWrap = document.createElement('div');
    inputWrap.style.cssText = 'flex: 1 1 165px; position: relative;';

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.setAttribute('data-captcha-input', 'true');
    inputEl.maxLength = 5;
    inputEl.autocomplete = 'off';
    inputEl.autocapitalize = 'characters';
    inputEl.spellcheck = false;
    inputEl.placeholder = 'Enter 5 characters';
    inputEl.setAttribute('aria-label', 'Enter the 5 characters shown in the security image');
    inputEl.style.cssText =
      'width: 100%; height: 52px; padding: 0 2.2rem 0 0.85rem; border: 1.5px solid #CBD5E1; border-radius: 6px; font-size: 1rem; font-weight: 700; letter-spacing: 0.18em; color: #29211D; background: #FAFAFA; box-sizing: border-box; text-transform: uppercase; outline: none; transition: border-color 0.15s ease, background 0.15s ease;';

    const statusBadge = document.createElement('span');
    statusBadge.setAttribute('aria-hidden', 'true');
    statusBadge.style.cssText =
      'position: absolute; right: 0.7rem; top: 50%; transform: translateY(-50%); font-size: 0.95rem; color: #1E6B7B; font-weight: 700; display: none; pointer-events: none;';
    statusBadge.textContent = '✓';

    inputWrap.appendChild(inputEl);
    inputWrap.appendChild(statusBadge);

    bodyRow.appendChild(imgEl);
    bodyRow.appendChild(inputWrap);

    const footer = document.createElement('div');
    footer.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.73rem; color: #64748B; gap: 0.5rem;';
    footer.innerHTML =
      '<span>Type the 5 characters above (not case-sensitive)</span>' +
      '<span style="color:#1E6B7B; font-weight:500;">Rockwell Anti-Spam</span>';

    card.appendChild(header);
    card.appendChild(bodyRow);
    card.appendChild(footer);
    container.appendChild(card);

    const state = {
      container: container,
      formAction: formAction,
      token: (initialCaptcha && initialCaptcha.challengeToken) || '',
      imgEl: imgEl,
      inputEl: inputEl,
      refresh: async function () {
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Loading…';
        try {
          const r = await fetch(
            '/api/inquiries?action=captcha&formAction=' + encodeURIComponent(formAction),
            { method: 'GET', credentials: 'same-origin', cache: 'no-store' }
          );
          if (r && r.ok) {
            const d = await r.json();
            if (d && d.captcha) {
              state.token = d.captcha.challengeToken || '';
              if (d.captcha.svgDataUri) {
                imgEl.src = d.captcha.svgDataUri;
              }
              inputEl.value = '';
              inputEl.style.borderColor = '#CBD5E1';
              inputEl.style.background = '#FAFAFA';
              statusBadge.style.display = 'none';
            }
          }
        } catch (_) {
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '↻ New Code';
        }
      }
    };

    inputEl.addEventListener('input', function () {
      const cleaned = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (this.value !== cleaned) {
        this.value = cleaned;
      }
      if (cleaned.length === 5) {
        this.style.borderColor = '#1E6B7B';
        this.style.background = '#FFFFFF';
        statusBadge.style.display = 'inline';
        clearSubmitError(form);
      } else {
        this.style.borderColor = '#CBD5E1';
        this.style.background = '#FAFAFA';
        statusBadge.style.display = 'none';
      }
    });

    refreshBtn.addEventListener('click', function () {
      state.refresh().then(function () {
        inputEl.focus();
      });
    });

    imgEl.addEventListener('click', function () {
      state.refresh().then(function () {
        inputEl.focus();
      });
    });

    if (form) {
      captchaWidgets.set(form, state);
    }

    if (!state.token) {
      state.refresh();
    }
  }

  /* ── Initialize Signed Form Config, HttpOnly Device Cookie & Security Challenge ── */
  async function initSecurityConfig() {
    const containers = document.querySelectorAll('[data-turnstile-container]');
    const primaryAction = containers[0]
      ? containers[0].getAttribute('data-turnstile-action') || 'contact_inquiry'
      : 'contact_inquiry';

    let initialCaptcha = null;
    try {
      const res = await fetch(
        '/api/inquiries?action=config&formAction=' + encodeURIComponent(primaryAction),
        {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store'
        }
      );
      if (res && res.ok) {
        const cfg = await res.json();
        if (cfg.formToken) serverFormToken = cfg.formToken;
        if (cfg.securityMode) activeSecurityMode = cfg.securityMode;
        if (cfg.turnstileSiteKey) activeTurnstileSiteKey = cfg.turnstileSiteKey;
        if (cfg.captcha) initialCaptcha = cfg.captcha;
        if (cfg.followUpEmail) followUpEmailAddress = cfg.followUpEmail;
      }
    } catch (_) {}

    if (!containers.length) return;

    if (activeSecurityMode === 'turnstile' && activeTurnstileSiteKey) {
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
              theme: 'light',
              'error-callback': function () {
                // If Cloudflare Turnstile fails to initialize (e.g. unlisted preview domain or stale sitekey),
                // seamlessly fall back to Rockwell's HMAC-signed SVG CAPTCHA instead of showing a broken box
                if (form) turnstileWidgets.delete(form);
                renderBuiltinCaptchaWidget(container, action, null);
                return true;
              }
            });
            if (form && widgetId !== undefined) {
              turnstileWidgets.set(form, widgetId);
            }
          });
          return;
        }
      } catch (_) {}
    }

    // Default / Production Built-in Cryptographic SVG CAPTCHA
    containers.forEach(function (container, idx) {
      const action = container.getAttribute('data-turnstile-action') || 'contact_inquiry';
      renderBuiltinCaptchaWidget(container, action, idx === 0 ? initialCaptcha : null);
    });
  }

  /* ── Init a form ── */
  function initForm(form) {
    if (!form || form.dataset.rwInitialized === 'true') return;
    form.dataset.rwInitialized = 'true';

    const textFields = form.querySelectorAll(
      'input[type="text"]:not([name="_hp"]):not([name="website_url"]):not([data-captcha-input]), input[type="email"], input[type="tel"], textarea, select'
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
      if (field.tagName === 'SELECT') {
        field.addEventListener('change', function () {
          validateField(field);
        });
      }
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

    // 1) Require Cloudflare Turnstile token if live Turnstile widget is rendered
    let turnstileToken = data['cf-turnstile-response'] || '';
    if (!turnstileToken && window.turnstile && turnstileWidgets.has(form)) {
      try {
        turnstileToken = window.turnstile.getResponse(turnstileWidgets.get(form)) || '';
      } catch (_) {}
    }

    if (activeSecurityMode === 'turnstile' && activeTurnstileSiteKey && turnstileWidgets.has(form) && !turnstileToken) {
      showSubmitError(form, 'Please complete the security verification check before submitting.');
      return;
    }

    // 2) Require Built-in Cryptographic SVG CAPTCHA if rendered
    let captchaToken = '';
    let captchaAnswer = '';
    if (captchaWidgets.has(form)) {
      const capState = captchaWidgets.get(form);
      captchaToken = capState.token || '';
      captchaAnswer = (capState.inputEl ? capState.inputEl.value : '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      if (!captchaToken) {
        await capState.refresh();
        showSubmitError(form, 'A fresh security verification code was loaded. Please enter the 5 characters shown.');
        if (capState.inputEl) capState.inputEl.focus();
        return;
      }

      if (captchaAnswer.length !== 5) {
        if (capState.inputEl) {
          capState.inputEl.style.borderColor = '#C53B27';
          capState.inputEl.focus();
        }
        showSubmitError(form, 'Please enter the 5-character security code shown in the verification box.');
        return;
      }
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
        turnstileToken: turnstileToken,
        captchaToken: captchaToken,
        captchaAnswer: captchaAnswer
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
        if (captchaWidgets.has(form)) {
          try { await captchaWidgets.get(form).refresh(); } catch (_) {}
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
