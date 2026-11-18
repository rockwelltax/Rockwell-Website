/* ============================================================
   ROCKWELL — Scroll Animations via IntersectionObserver
   ============================================================ */

(function () {
  'use strict';

  // Skip all animations if user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Make all reveal elements immediately visible
    document.querySelectorAll('.reveal, .reveal--fade, .reveal--left, .reveal--right').forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }

  function initReveal() {
    const elements = document.querySelectorAll('.reveal, .reveal--fade, .reveal--left, .reveal--right');
    if (!elements.length) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -48px 0px'
    });

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }

})();
