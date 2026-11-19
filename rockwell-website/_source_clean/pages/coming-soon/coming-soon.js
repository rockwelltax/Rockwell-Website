(function() {
  // 1. Fetch site status & dynamic launch controller
  let countdownTimer = null;
  let launchTriggered = false;

  function triggerLaunchReveal() {
    if (launchTriggered) return;
    launchTriggered = true;

    clearInterval(countdownTimer);

    // Show launch celebration overlay
    const overlay = document.getElementById('cs-launch-overlay');
    const progressBar = document.getElementById('cs-launch-progress-bar');

    if (overlay) {
      overlay.style.display = 'flex';
      setTimeout(() => {
        if (progressBar) progressBar.style.width = '100%';
      }, 60);

      // Smooth elevation on Lottie player
      const lottieWrap = document.querySelector('.cs-lottie-wrap');
      if (lottieWrap) {
        lottieWrap.style.transition = 'transform 2s ease, filter 2s ease';
        lottieWrap.style.transform = 'scale(1.15) translateY(-15px)';
        lottieWrap.style.filter = 'drop-shadow(0 20px 40px rgba(56, 146, 169, 0.4))';
      }

      // Smooth dissolve into live homepage
      setTimeout(() => {
        document.body.style.transition = 'opacity 0.6s ease';
        document.body.style.opacity = '0';
        setTimeout(() => {
          window.location.replace('/');
        }, 600);
      }, 2400);
    } else {
      window.location.replace('/');
    }
  }

  async function checkStatus() {
    try {
      const res = await fetch('/api/site-status');
      const data = await res.json();

      // If site is published, smoothly trigger live reveal!
      if (data && data.is_published) {
        triggerLaunchReveal();
        return;
      }

      const countdownWrap = document.getElementById('cs-countdown-wrap');

      if (data && data.status === 'scheduled' && data.scheduled_at) {
        const targetDate = new Date(data.scheduled_at).getTime();
        if (countdownWrap) countdownWrap.style.display = 'block';

        function updateCountdown() {
          const now = Date.now();
          const diff = targetDate - now;

          if (diff <= 0) {
            triggerLaunchReveal();
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
        // General Coming Soon mode (no countdown)
        if (countdownWrap) countdownWrap.style.display = 'none';
        clearInterval(countdownTimer);
      }
    } catch (e) {
      console.warn('Could not retrieve status:', e);
    }
  }

  checkStatus();
  setInterval(checkStatus, 15000);
})();
