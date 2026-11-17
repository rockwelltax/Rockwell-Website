/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Tax Preparation Page Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function initEstimator() {
    const filingSelect = document.getElementById('calc-filing-type');
    const w2Select = document.getElementById('calc-w2-count');
    const priceDisplay = document.getElementById('calc-price-display');
    const noteDisplay = document.getElementById('calc-note');
    const proceedBtn = document.getElementById('calc-proceed-btn');

    if (!filingSelect || !w2Select || !priceDisplay || !proceedBtn) return;

    function recalculate() {
      const isSelfEmployed = filingSelect.value === 'self-employed';
      const w2Count = w2Select.value;

      let basePrice = isSelfEmployed ? 250 : 100;
      let note = '';
      let urlParams = new URLSearchParams();

      if (isSelfEmployed) {
        urlParams.set('filing', 'self-employed');
        urlParams.set('self_employed', 'yes');
        note = 'Self-employed / Schedule C returns start at $250+. Covers sole proprietors, freelancers, and independent contractors.';
        if (w2Count === '7+') {
          note += ' Having 7+ W-2s alongside Schedule C involves additional documentation review.';
        }
      } else {
        urlParams.set('filing', 'individual');
        urlParams.set('self_employed', 'no');
        note = 'Individual return with standard W-2 filing starts at $100+. Includes single and married filers.';
        if (w2Count === '7+') {
          note += ' Returns with 7+ W-2 forms may require extra processing time, confirmed in your written quote.';
        }
      }

      urlParams.set('w2', w2Count);

      priceDisplay.textContent = '$' + basePrice + '+';
      noteDisplay.textContent = note;
      proceedBtn.href = '../start-your-tax-return/start-your-tax-return.html?' + urlParams.toString();
    }

    filingSelect.addEventListener('change', recalculate);
    w2Select.addEventListener('change', recalculate);

    recalculate();
  }

  function initStepHighlights() {
    const steps = document.querySelectorAll('.process-step');
    steps.forEach(function (step) {
      step.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-2px)';
        this.style.transition = 'transform 0.2s ease';
      });
      step.addEventListener('mouseleave', function () {
        this.style.transform = '';
      });
    });
  }

  function init() {
    initEstimator();
    initStepHighlights();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
