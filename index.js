/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Homepage Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function init() {
    // 1. Dynamic Hero Height Calculation for Mobile Safari/Chrome toolbars
    const hero = document.querySelector('.hero');
    function adjustHeroHeight() {
      if (hero && window.innerWidth < 768) {
        hero.style.minHeight = window.innerHeight + 'px';
      } else if (hero) {
        hero.style.minHeight = '';
      }
    }
    adjustHeroHeight();

    let resizeTimeout;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(adjustHeroHeight, 100);
    }, { passive: true });

    // 2. Smooth Scroll on Hero Scroll Hint Click
    const scrollHint = document.querySelector('.hero__scroll-hint');
    if (scrollHint) {
      scrollHint.style.cursor = 'pointer';
      scrollHint.setAttribute('role', 'button');
      scrollHint.setAttribute('aria-label', 'Scroll down to services section');
      scrollHint.setAttribute('tabindex', '0');

      function scrollToServices() {
        const target = document.getElementById('services-heading') || document.querySelector('.services-overview');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      scrollHint.addEventListener('click', scrollToServices);
      scrollHint.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          scrollToServices();
        }
      });
    }

    // 3. Service Cards Hover Depth & Focus Enhancement
    const cards = document.querySelectorAll('.service-card');
    cards.forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        this.style.borderColor = 'var(--color-teal)';
      });
      card.addEventListener('mouseleave', function () {
        this.style.borderColor = '';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
