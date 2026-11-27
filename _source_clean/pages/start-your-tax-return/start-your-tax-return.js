/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Tax Inquiry Form Interactive Scripts & Pre-fill Handler
   ============================================================ */

(function () {
  'use strict';

  function initPathSelector() {
    const btnW2 = document.getElementById('btn-path-w2');
    const btn1099 = document.getElementById('btn-path-1099');
    if (!btnW2 || !btn1099) return;

    function setPath(path) {
      const is1099 = path === '1099' || path === 'self_employed';
      
      // Update button styling
      btnW2.style.borderColor = is1099 ? 'var(--color-border)' : 'var(--color-teal)';
      btnW2.querySelector('span').textContent = is1099 ? 'Click to select' : 'Selected';
      btnW2.querySelector('span').style.background = is1099 ? 'transparent' : 'var(--color-teal)';
      btnW2.querySelector('span').style.color = is1099 ? 'var(--color-text-muted)' : '#fff';

      btn1099.style.borderColor = is1099 ? 'var(--color-teal)' : 'var(--color-border)';
      btn1099.querySelector('span').textContent = is1099 ? 'Selected' : 'Click to select';
      btn1099.querySelector('span').style.background = is1099 ? 'var(--color-teal)' : 'transparent';
      btn1099.querySelector('span').style.color = is1099 ? '#fff' : 'var(--color-text-muted)';

      // Auto check appropriate selfEmployed radio in questionnaire
      const seRadio = document.querySelector(`input[name="selfEmployed"][value="${is1099 ? 'yes' : 'no'}"]`);
      if (seRadio) {
        seRadio.checked = true;
        seRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // If W-2 path selected, default to 1-6 W-2s
      if (!is1099) {
        const w2Radio = document.querySelector('input[name="w2Count"][value="1-6"]');
        if (w2Radio && !document.querySelector('input[name="w2Count"]:checked')) {
          w2Radio.checked = true;
        }
      }
    }

    btnW2.addEventListener('click', () => setPath('w2'));
    btn1099.addEventListener('click', () => setPath('1099'));

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const pathParam = params.get('path');
    if (pathParam === '1099' || pathParam === 'self_employed' || params.get('self_employed') === 'yes') {
      setPath('1099');
    } else {
      setPath('w2');
    }
  }

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
        } else {
          if (ssnAlert) ssnAlert.style.display = 'none';
        }
      });
    });
  }

  function init() {
    initPathSelector();
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
