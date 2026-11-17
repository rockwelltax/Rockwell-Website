/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Tax Inquiry Form Interactive Scripts & Pre-fill Handler
   ============================================================ */

(function () {
  'use strict';

  function initPreFill() {
    const params = new URLSearchParams(window.location.search);

    // Pre-fill W-2 count
    const w2 = params.get('w2');
    if (w2) {
      const radio = document.querySelector(`input[name="w2Count"][value="${w2}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Pre-fill Self-Employment
    const selfEmployed = params.get('self_employed');
    if (selfEmployed) {
      const radio = document.querySelector(`input[name="selfEmployed"][value="${selfEmployed}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Pre-fill Filing Status
    const filing = params.get('filing');
    if (filing) {
      if (filing === 'single') {
        const radio = document.querySelector('input[name="filingStatus"][value="single"]');
        if (radio) radio.checked = true;
      } else if (filing === 'mfj') {
        const radio = document.querySelector('input[name="filingStatus"][value="mfj"]');
        if (radio) radio.checked = true;
      }
    }
  }

  function initDynamicGuidance() {
    const selfEmployedRadios = document.querySelectorAll('input[name="selfEmployed"]');
    const selfEmployedNote = document.getElementById('self-employed-note');

    selfEmployedRadios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (selfEmployedNote) {
          selfEmployedNote.style.display = (this.value === 'yes') ? 'block' : 'none';
        }
      });
    });

    const w2Radios = document.querySelectorAll('input[name="w2Count"]');
    const w2Note = document.getElementById('w2-extra-note');

    w2Radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (w2Note) {
          w2Note.style.display = (this.value === '7+') ? 'block' : 'none';
        }
      });
    });

    // Check initial state
    const checkedSelf = document.querySelector('input[name="selfEmployed"]:checked');
    if (checkedSelf && checkedSelf.value === 'yes' && selfEmployedNote) {
      selfEmployedNote.style.display = 'block';
    }
    const checkedW2 = document.querySelector('input[name="w2Count"]:checked');
    if (checkedW2 && checkedW2.value === '7+' && w2Note) {
      w2Note.style.display = 'block';
    }
  }

  // Active SSN Detection Safeguard: Disallows SSN entry
  function initSsnDetection() {
    const textInputs = document.querySelectorAll('#tax-inquiry-form input[type="text"], #tax-inquiry-form textarea');
    const ssnAlert = document.getElementById('ssn-alert');
    const ssnPattern = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/;

    textInputs.forEach(function (input) {
      input.addEventListener('input', function () {
        if (ssnPattern.test(this.value)) {
          if (ssnAlert) ssnAlert.style.display = 'block';
          // Sanitize immediately to protect user data
          this.value = this.value.replace(ssnPattern, '[SSN REMOVED FOR PRIVACY]');
        } else {
          if (ssnAlert) ssnAlert.style.display = 'none';
        }
      });
    });
  }

  function init() {
    initPreFill();
    initDynamicGuidance();
    initSsnDetection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
