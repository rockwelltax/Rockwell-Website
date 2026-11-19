(function() {
  // 1. Fetch site status
  let countdownTimer = null;

  async function checkStatus() {
    try {
      const res = await fetch('/api/site-status');
      const data = await res.json();

      // If site is now published, redirect to homepage!
      if (data && data.is_published) {
        window.location.replace('/');
        return;
      }

      const pillLabel = document.getElementById('cs-pill-label');
      const countdownWrap = document.getElementById('cs-countdown-wrap');

      if (data && data.status === 'scheduled' && data.scheduled_at) {
        const targetDate = new Date(data.scheduled_at).getTime();
        if (pillLabel) pillLabel.textContent = 'Launch Scheduled';
        if (countdownWrap) countdownWrap.style.display = 'block';

        function updateCountdown() {
          const now = Date.now();
          const diff = targetDate - now;

          if (diff <= 0) {
            clearInterval(countdownTimer);
            window.location.replace('/');
            return;
          }

          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const mins = Math.floor((diff / (1000 * 60)) % 60);
          const secs = Math.floor((diff / 1000) % 60);

          const elD = document.getElementById('cd-days');
          const elH = document.getElementById('cd-hours');
          const elM = document.getElementById('cd-mins');
          const elS = document.getElementById('cd-secs');

          if (elD) elD.textContent = String(days).padStart(2, '0');
          if (elH) elH.textContent = String(hours).padStart(2, '0');
          if (elM) elM.textContent = String(mins).padStart(2, '0');
          if (elS) elS.textContent = String(secs).padStart(2, '0');
        }

        updateCountdown();
        clearInterval(countdownTimer);
        countdownTimer = setInterval(updateCountdown, 1000);
      } else {
        // General Coming Soon mode
        if (pillLabel) pillLabel.textContent = 'Opening Soon';
        if (countdownWrap) countdownWrap.style.display = 'none';
      }
    } catch (e) {
      console.warn('Could not retrieve status:', e);
    }
  }

  checkStatus();
  setInterval(checkStatus, 30000);
})();
