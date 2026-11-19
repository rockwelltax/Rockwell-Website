/* ============================================================
   ROCKWELL — Shared Utilities
   ============================================================ */

(function (global) {
  'use strict';

  const Rockwell = global.Rockwell || {};

  /* ── Debounce ── */
  Rockwell.debounce = function (fn, wait) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  };

  /* ── Sanitize HTML output ── */
  Rockwell.escapeHTML = function (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* ── Smooth scroll to element ── */
  Rockwell.scrollTo = function (target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── Trap focus inside a container (for modals / mobile nav) ── */
  Rockwell.trapFocus = function (container) {
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    container.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    });
  };

  global.Rockwell = Rockwell;

})(window);
