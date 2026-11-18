/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Bookkeeping Page Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function initOptionCards() {
    const cards = document.querySelectorAll('.bk-option-card');
    cards.forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        this.style.borderColor = 'var(--color-teal)';
      });
      card.addEventListener('mouseleave', function () {
        if (!this.classList.contains('bk-option-card--featured')) {
          this.style.borderColor = '';
        }
      });
    });

    // Check URL query parameters for targeted option focus (e.g. ?option=app)
    const params = new URLSearchParams(window.location.search);
    const option = params.get('option');
    if (option) {
      const targetCard = document.getElementById('option-' + option);
      if (targetCard) {
        setTimeout(function () {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetCard.style.outline = '2px solid var(--color-teal)';
          targetCard.style.outlineOffset = '4px';
        }, 200);
      }
    }
  }

  function init() {
    initOptionCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
