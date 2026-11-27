/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   About Page Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function initHowItems() {
    // Steps under "How We Work With You" are strictly static informational items (no hover/button effects)
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
