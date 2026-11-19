(function() {
  let countdownTimer = null;
  let heartbeatTimer = null;
  let launchTriggered = false;

  // Anti-tamper clock state anchored to server & CPU monotonic counter
  let anchorRemainingSeconds = null;
  let anchorPerfTime = null;
  let targetScheduledAt = null;

  function triggerLaunchReveal() {
    if (launchTriggered) return;
    launchTriggered = true;

    clearInterval(countdownTimer);
    clearInterval(heartbeatTimer);

    // Set countdown displays to zero
    ['cd-days', 'cd-hours', 'cd-mins', 'cd-secs'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '00';
    });

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
        lottieWrap.style.transition = 'transform 2s cubic-bezier(0.16, 1, 0.3, 1), filter 2s ease';
        lottieWrap.style.transform = 'scale(1.12) translateY(-10px)';
        lottieWrap.style.filter = 'drop-shadow(0 20px 40px rgba(56, 146, 169, 0.45))';
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

  function updateDisplay(secondsLeft) {
    const total = Math.max(0, Math.floor(secondsLeft));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    const elD = document.getElementById('cd-days');
    const elH = document.getElementById('cd-hours');
    const elM = document.getElementById('cd-mins');
    const elS = document.getElementById('cd-secs');

    if (elD) elD.textContent = String(days).padStart(2, '0');
    if (elH) elH.textContent = String(hours).padStart(2, '0');
    if (elM) elM.textContent = String(mins).padStart(2, '0');
    if (elS) elS.textContent = String(secs).padStart(2, '0');
  }

  function tickCountdown() {
    if (anchorRemainingSeconds === null || anchorPerfTime === null) return;

    // Elapsed monotonic time since anchor: CANNOT be tampered with by changing device clock/calendar
    const elapsedSeconds = (performance.now() - anchorPerfTime) / 1000;
    const currentRemaining = Math.max(0, anchorRemainingSeconds - elapsedSeconds);

    updateDisplay(currentRemaining);

    if (currentRemaining <= 0) {
      triggerLaunchReveal();
    }
  }

  async function syncSiteStatus() {
    if (launchTriggered) return;
    try {
      const res = await fetch('/api/site-status?t=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();

      // If site is published, smoothly trigger live reveal!
      if (data && data.is_published) {
        triggerLaunchReveal();
        return;
      }

      const countdownWrap = document.getElementById('cs-countdown-wrap');

      if (data && data.status === 'scheduled' && data.scheduled_at) {
        if (countdownWrap && countdownWrap.style.display !== 'block') {
          countdownWrap.style.display = 'block';
        }

        const serverRemaining = typeof data.remaining_seconds === 'number'
          ? data.remaining_seconds
          : Math.max(0, Math.floor((new Date(data.scheduled_at).getTime() - Date.now()) / 1000));

        if (serverRemaining <= 0) {
          triggerLaunchReveal();
          return;
        }

        // Calculate expected remaining from monotonic clock
        const currentCalculatedRemaining = anchorRemainingSeconds !== null
          ? anchorRemainingSeconds - ((performance.now() - anchorPerfTime) / 1000)
          : null;

        // Re-anchor if target schedule changed, first run, or drift exceeds 2 seconds
        if (
          targetScheduledAt !== data.scheduled_at ||
          currentCalculatedRemaining === null ||
          Math.abs(currentCalculatedRemaining - serverRemaining) > 2
        ) {
          targetScheduledAt = data.scheduled_at;
          anchorRemainingSeconds = serverRemaining;
          anchorPerfTime = performance.now();
          updateDisplay(serverRemaining);
        }

        if (!countdownTimer) {
          countdownTimer = setInterval(tickCountdown, 250);
        }
      } else {
        // Mode is pure coming_soon (no countdown or schedule disarmed)
        if (countdownWrap && countdownWrap.style.display !== 'none') {
          countdownWrap.style.display = 'none';
        }
        if (countdownTimer) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
        anchorRemainingSeconds = null;
        anchorPerfTime = null;
        targetScheduledAt = null;
      }
    } catch (e) {
      // In case of transient network glitch, existing monotonic countdown continues uninterrupted
      console.warn('Status sync heartbeat warning:', e);
    }
  }

  // Initial check immediately
  syncSiteStatus();

  // Fast background heartbeat polling every 2.5 seconds for instant live sync without page refresh
  heartbeatTimer = setInterval(syncSiteStatus, 2500);

  // Tab visibility and focus listener: instantly resync when user tabs back or device wakes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !launchTriggered) {
      syncSiteStatus();
    }
  });
  window.addEventListener('focus', () => {
    if (!launchTriggered) {
      syncSiteStatus();
    }
  });
})();
