/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Services Page Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function init() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const serviceBlocks = document.querySelectorAll('.service-block');
    const dividers = document.querySelectorAll('.services-divider');

    if (!filterButtons.length) return;

    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const filter = this.getAttribute('data-filter');

        // Update active filter button state
        filterButtons.forEach(function (b) {
          b.classList.remove('active', 'btn--primary');
          b.classList.add('btn--outline-teal');
          b.setAttribute('aria-selected', 'false');
        });

        this.classList.add('active', 'btn--primary');
        this.classList.remove('btn--outline-teal');
        this.setAttribute('aria-selected', 'true');

        // Filter service blocks
        serviceBlocks.forEach(function (block) {
          const category = block.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            block.style.display = 'grid';
            setTimeout(function () {
              block.classList.add('is-visible');
            }, 50);
          } else {
            block.style.display = 'none';
          }
        });

        // Hide dividers if filtered to single category
        dividers.forEach(function (divider) {
          divider.style.display = (filter === 'all') ? 'block' : 'none';
        });

        // If specific category selected, scroll to it smoothly
        if (filter !== 'all') {
          const target = document.getElementById('service-block-' + filter);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });

    // Handle hash in URL (e.g. services.html#tax)
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const matchBtn = document.querySelector(`.filter-btn[data-filter="${hash}"]`);
      if (matchBtn) matchBtn.click();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
