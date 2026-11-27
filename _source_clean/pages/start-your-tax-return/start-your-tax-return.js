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

  // Cascading Worldwide Country -> State/Province -> City Selector
  function initLocationCascader() {
    const countrySelect = document.getElementById('loc-country');
    const stateSelect = document.getElementById('loc-state');
    const stateWrap = document.getElementById('loc-state-wrap');
    const citySelect = document.getElementById('loc-city');
    const cityWrap = document.getElementById('loc-city-wrap');
    const manualCityWrap = document.getElementById('loc-manual-city-wrap');
    const manualCityInput = document.getElementById('loc-manual-city');
    const additionalInput = document.getElementById('additional-states');
    const countryNameHidden = document.getElementById('loc-country-name');
    const stateNameHidden = document.getElementById('loc-state-name');
    const statesHidden = document.getElementById('states');

    if (!countrySelect || !stateSelect || !citySelect || !statesHidden) return;

    function getSelectedText(selectEl) {
      if (!selectEl || !selectEl.value) return '';
      const opt = selectEl.options[selectEl.selectedIndex];
      return opt ? opt.textContent.trim() : '';
    }

    function syncComposedLocation() {
      const cName = getSelectedText(countrySelect);
      const sName = !stateSelect.disabled && stateSelect.value ? getSelectedText(stateSelect) : '';
      let cityVal = '';
      if (!manualCityInput.disabled && manualCityInput.value.trim()) {
        cityVal = manualCityInput.value.trim();
      } else if (!citySelect.disabled && citySelect.value && citySelect.value !== '__OTHER__') {
        cityVal = citySelect.value;
      }

      if (countryNameHidden) countryNameHidden.value = cName;
      if (stateNameHidden) stateNameHidden.value = sName;

      const parts = [cityVal, sName, cName].filter(Boolean);
      let summary = parts.join(', ');
      const extra = additionalInput && additionalInput.value ? additionalInput.value.trim() : '';
      if (extra) {
        summary = summary ? `${summary} (Also: ${extra})` : extra;
      }
      statesHidden.value = summary;
    }

    function toggleManualCity(show) {
      if (!manualCityWrap || !manualCityInput) return;
      if (show) {
        manualCityWrap.style.display = 'block';
        manualCityInput.disabled = false;
        manualCityInput.required = true;
      } else {
        manualCityWrap.style.display = 'none';
        manualCityInput.disabled = true;
        manualCityInput.required = false;
        manualCityInput.value = '';
      }
      syncComposedLocation();
    }

    async function loadCities(countryCode, stateCode) {
      citySelect.innerHTML = '<option value="">Loading cities…</option>';
      citySelect.disabled = true;
      toggleManualCity(false);

      try {
        const res = await fetch(
          `/api/locations?type=cities&country=${encodeURIComponent(countryCode)}&state=${encodeURIComponent(stateCode || 'NONE')}`
        );
        const data = res.ok ? await res.json() : { cities: [] };
        const cities = Array.isArray(data.cities) ? data.cities : [];

        if (cities.length === 0) {
          if (cityWrap) cityWrap.style.display = 'none';
          citySelect.disabled = true;
          citySelect.required = false;
          citySelect.innerHTML = '<option value="__OTHER__" selected>Other</option>';
          toggleManualCity(true);
          return;
        }

        if (cityWrap) cityWrap.style.display = '';
        citySelect.innerHTML = '<option value="">Select city / municipality…</option>';
        const frag = document.createDocumentFragment();
        cities.forEach(function (name) {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          frag.appendChild(opt);
        });
        const otherOpt = document.createElement('option');
        otherOpt.value = '__OTHER__';
        otherOpt.textContent = 'Other (Type manually)';
        frag.appendChild(otherOpt);

        citySelect.appendChild(frag);
        citySelect.disabled = false;
        citySelect.required = true;
      } catch (_) {
        if (cityWrap) cityWrap.style.display = 'none';
        citySelect.disabled = true;
        citySelect.required = false;
        toggleManualCity(true);
      }
      syncComposedLocation();
    }

    async function loadStates(countryCode) {
      stateSelect.innerHTML = '<option value="">Loading states/provinces…</option>';
      stateSelect.disabled = true;
      citySelect.innerHTML = '<option value="">Select state/province first…</option>';
      citySelect.disabled = true;
      if (cityWrap) cityWrap.style.display = '';
      toggleManualCity(false);

      if (!countryCode) {
        stateSelect.innerHTML = '<option value="">Select country first…</option>';
        syncComposedLocation();
        return;
      }

      try {
        const res = await fetch(`/api/locations?type=states&country=${encodeURIComponent(countryCode)}`);
        const data = res.ok ? await res.json() : { states: [] };
        const states = Array.isArray(data.states) ? data.states : [];

        if (states.length === 0) {
          if (stateWrap) stateWrap.style.display = 'none';
          stateSelect.disabled = true;
          stateSelect.required = false;
          stateSelect.innerHTML = '<option value="">N/A</option>';
          await loadCities(countryCode, 'NONE');
          return;
        }

        if (stateWrap) stateWrap.style.display = '';
        stateSelect.innerHTML = '<option value="">Select state / province…</option>';
        const frag = document.createDocumentFragment();
        states.forEach(function (st) {
          const opt = document.createElement('option');
          opt.value = st.code;
          opt.textContent = st.name;
          frag.appendChild(opt);
        });
        stateSelect.appendChild(frag);
        stateSelect.disabled = false;
        stateSelect.required = true;
      } catch (_) {
        stateSelect.innerHTML = '<option value="">Unable to load states</option>';
      }
      syncComposedLocation();
    }

    async function loadCountries() {
      countrySelect.innerHTML = '<option value="">Loading countries…</option>';
      try {
        const res = await fetch('/api/locations?type=countries');
        const data = res.ok ? await res.json() : { priority: [], all: [] };

        countrySelect.innerHTML = '<option value="">Select country…</option>';

        if (Array.isArray(data.priority) && data.priority.length > 0) {
          const priGroup = document.createElement('optgroup');
          priGroup.label = 'Popular Locations';
          data.priority.forEach(function (c) {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = c.name;
            priGroup.appendChild(opt);
          });
          countrySelect.appendChild(priGroup);
        }

        if (Array.isArray(data.all) && data.all.length > 0) {
          const allGroup = document.createElement('optgroup');
          allGroup.label = 'All Countries (A–Z)';
          const priSet = new Set((data.priority || []).map((p) => p.code));
          data.all.forEach(function (c) {
            if (priSet.has(c.code)) return;
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = c.name;
            allGroup.appendChild(opt);
          });
          countrySelect.appendChild(allGroup);
        }
      } catch (_) {
        countrySelect.innerHTML =
          '<option value="">Select country…</option><option value="US">United States</option><option value="PH">Philippines</option>';
      }
    }

    countrySelect.addEventListener('change', function () {
      loadStates(this.value);
    });

    stateSelect.addEventListener('change', function () {
      if (this.value) {
        loadCities(countrySelect.value, this.value);
      } else {
        citySelect.innerHTML = '<option value="">Select state/province first…</option>';
        citySelect.disabled = true;
        toggleManualCity(false);
      }
      syncComposedLocation();
    });

    citySelect.addEventListener('change', function () {
      if (this.value === '__OTHER__') {
        toggleManualCity(true);
        if (manualCityInput) manualCityInput.focus();
      } else {
        toggleManualCity(false);
      }
      syncComposedLocation();
    });

    if (manualCityInput) {
      manualCityInput.addEventListener('input', syncComposedLocation);
    }
    if (additionalInput) {
      additionalInput.addEventListener('input', syncComposedLocation);
    }

    loadCountries();
  }

  function init() {
    initPathSelector();
    initPreFill();
    initDynamicGuidance();
    initLocationCascader();
    initSsnDetection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
