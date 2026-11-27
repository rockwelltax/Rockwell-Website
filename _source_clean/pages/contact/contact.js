/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Contact Page Interactive Scripts
   ============================================================ */

(function () {
  'use strict';

  function initContactFormEnhancements() {
    const subjectSelect = document.getElementById('contact-subject');
    const messageInput = document.getElementById('contact-message');
    const charCounter = document.getElementById('char-counter');
    const topicPills = document.querySelectorAll('.topic-pill');
    const ssnAlert = document.getElementById('contact-ssn-alert');

    // 1. URL Query Parameter Handling
    const params = new URLSearchParams(window.location.search);
    const service = params.get('service');
    const focus = params.get('focus');

    if (service && subjectSelect) {
      if (service.includes('tax')) {
        subjectSelect.value = 'tax-inquiry';
      } else if (service.includes('bookkeeping')) {
        subjectSelect.value = 'bookkeeping';
      } else if (service.includes('digital')) {
        subjectSelect.value = 'digital-services';
      }
      highlightActivePill(subjectSelect.value);
      subjectSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (focus && messageInput && !messageInput.value) {
      messageInput.value = `I am interested in: ${focus}. `;
      updateCharCount();
    }

    // 2. Quick Topic Pills Handler
    function highlightActivePill(val) {
      topicPills.forEach(function (pill) {
        if (pill.getAttribute('data-topic') === val) {
          pill.classList.remove('btn--outline-teal');
          pill.classList.add('btn--primary');
        } else {
          pill.classList.remove('btn--primary');
          pill.classList.add('btn--outline-teal');
        }
      });
    }

    topicPills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        const topic = this.getAttribute('data-topic');
        if (subjectSelect) {
          subjectSelect.value = topic;
          highlightActivePill(topic);
          subjectSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    if (subjectSelect) {
      subjectSelect.addEventListener('change', function () {
        highlightActivePill(this.value);
      });
    }

    // 3. Character Counter
    function updateCharCount() {
      if (messageInput && charCounter) {
        const len = messageInput.value.length;
        charCounter.textContent = `${len} / 1000`;
      }
    }

    if (messageInput) {
      messageInput.addEventListener('input', function () {
        updateCharCount();

        // 4. Client-side SSN pattern warning (warn & reject on submit rather than silently mutating input)
        const ssnPattern = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/;
        if (ssnPattern.test(this.value)) {
          if (ssnAlert) ssnAlert.style.display = 'block';
        } else {
          if (ssnAlert) ssnAlert.style.display = 'none';
        }
      });
    }

    updateCharCount();
  }

  function init() {
    initContactFormEnhancements();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
