/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   About Page Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function initHowItems() {
    const items = document.querySelectorAll('.how-item');
    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () {
        this.style.borderColor = 'var(--color-teal)';
        this.style.boxShadow = 'var(--shadow-md)';
      });
      item.addEventListener('mouseleave', function () {
        this.style.borderColor = '';
        this.style.boxShadow = '';
      });
    });

    const quote = document.querySelector('.about-quote');
    if (quote) {
      quote.addEventListener('mouseenter', function () {
        this.style.borderLeftColor = 'var(--color-brown)';
      });
      quote.addEventListener('mouseleave', function () {
        this.style.borderLeftColor = 'var(--color-teal)';
      });
    }
  }

  function init() {
    initHowItems();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
