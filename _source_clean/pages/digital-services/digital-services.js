/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Digital Services Page Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function initServiceSelector() {
    const items = document.querySelectorAll('.ds-service-item');
    const selectionText = document.getElementById('ds-selection-text');
    const selectionCta = document.getElementById('ds-selection-cta');
    const heroCta = document.getElementById('ds-hero-cta');

    if (!items.length || !selectionText || !selectionCta) return;

    const selectedServices = new Set();

    function updateSummary() {
      if (selectedServices.size === 0) {
        selectionText.textContent = 'Select one or more services above to tailor your consultation inquiry.';
        selectionCta.textContent = 'Inquire About Digital Services →';
        selectionCta.href = '../contact/contact.html?service=digital-services';
        if (heroCta) heroCta.href = '../contact/contact.html?service=digital-services';
      } else {
        const list = Array.from(selectedServices).join(', ');
        selectionText.innerHTML = `<strong>Selected focus:</strong> ${list}`;
        const encoded = encodeURIComponent(list);
        selectionCta.textContent = `Inquire About ${selectedServices.size} Selected Service${selectedServices.size > 1 ? 's' : ''} →`;
        selectionCta.href = `../contact/contact.html?service=digital-services&focus=${encoded}`;
        if (heroCta) heroCta.href = `../contact/contact.html?service=digital-services&focus=${encoded}`;
      }
    }

    items.forEach(function (item) {
      function toggle() {
        const key = item.getAttribute('data-service-key');
        if (selectedServices.has(key)) {
          selectedServices.delete(key);
          item.classList.remove('is-selected');
          item.setAttribute('aria-pressed', 'false');
        } else {
          selectedServices.add(key);
          item.classList.add('is-selected');
          item.setAttribute('aria-pressed', 'true');
        }
        updateSummary();
      }

      item.addEventListener('click', toggle);
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  function init() {
    initServiceSelector();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
