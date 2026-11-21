/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Shared Navigation & Footer Component (Vanilla JS)
   Brand Colors: #BCA18A | #3892A9 | #29211D | #FFFFFF
   ============================================================ */

(function () {
  'use strict';

  /* ── Clean URL & Host Detection ── */
  function isCleanUrlHost() {
    const host = window.location.hostname;
    return host.includes('vercel.app') ||
           host.includes('rockwell') ||
           (window.location.protocol.startsWith('http') && !window.location.pathname.includes('/rockwell-website/'));
  }

  function getRoot() {
    if (isCleanUrlHost()) return '/';
    const path = window.location.pathname.replace(/\\/g, '/');
    const match = path.match(/\/pages\/[^/]+\//i);
    return match ? '../../' : './';
  }

  function resolvePath(cleanPath, fallbackPath) {
    if (isCleanUrlHost()) {
      return cleanPath;
    }
    return getRoot() + fallbackPath;
  }

  /* ── Active Link Detection ── */
  function isActive(cleanPath) {
    const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();

    if (cleanPath === '/') {
      return path === '/' || path === '' || path.endsWith('/index.html') ||
             (!path.includes('services') && !path.includes('about') && !path.includes('contact') && !path.includes('tax-return') && !path.includes('privacy') && !path.includes('terms') && !path.includes('admin'));
    }

    if (cleanPath === '/services') {
      return path.includes('services');
    }

    if (cleanPath === '/about') {
      return path.includes('about');
    }

    if (cleanPath === '/contact') {
      return path.includes('contact');
    }

    if (cleanPath === '/start-your-tax-return') {
      return path.includes('start-your-tax-return');
    }

    return false;
  }

  /* ── Build Navigation HTML ── */
  function buildNav() {
    const homeHref = resolvePath('/', 'index.html');
    const servicesHref = resolvePath('/services', 'pages/services/services.html');
    const taxHref = resolvePath('/services/tax-preparation', 'pages/tax-preparation/tax-preparation.html');
    const bkHref = resolvePath('/services/bookkeeping', 'pages/bookkeeping/bookkeeping.html');
    const dsHref = resolvePath('/services/digital-services', 'pages/digital-services/digital-services.html');
    const aboutHref = resolvePath('/about', 'pages/about/about.html');
    const contactHref = resolvePath('/contact', 'pages/contact/contact.html');
    const startTaxHref = resolvePath('/start-your-tax-return', 'pages/start-your-tax-return/start-your-tax-return.html');
    const logoSrc = isCleanUrlHost() ? '/assets/icons/favicon.png' : getRoot() + 'assets/icons/favicon.png';

    const isServicesActive = isActive('/services') ? ' active' : '';
    const isAboutActive = isActive('/about') ? ' active' : '';
    const isContactActive = isActive('/contact') ? ' active' : '';
    const isHomeActive = isActive('/') ? ' active' : '';

    return `
<a href="#main-content" class="skip-link">Skip to main content</a>
<header class="site-header" id="site-header" role="banner">
  <div class="container">
    <nav class="nav-inner" aria-label="Main navigation">
      <!-- Upper Left Logo + Name -->
      <a href="${homeHref}" class="nav-logo" aria-label="Rockwell Tax &amp; Digital Strategies — Home">
        <img src="${logoSrc}" alt="" class="nav-logo__icon" width="34" height="34" aria-hidden="true" />
        <div class="nav-logo__text">
          <span class="nav-logo__primary">Rockwell</span>
          <span class="nav-logo__sub">Tax &amp; Digital Strategies Inc.</span>
        </div>
      </a>

      <!-- Simplified Desktop Navigation: Home | Services (Dropdown) | About Rockwell | Contact -->
      <ul class="nav-links" role="list">
        <li class="nav-links__item">
          <a href="${homeHref}" class="nav-links__link${isHomeActive}">Home</a>
        </li>

        <!-- Services with Dropdown -->
        <li class="nav-links__item nav-dropdown" id="nav-services-dropdown">
          <a href="${servicesHref}" class="nav-links__link nav-dropdown__trigger${isServicesActive}" aria-haspopup="true" aria-expanded="false">
            Services
            <svg class="nav-dropdown__arrow" viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </a>
          <ul class="nav-dropdown__menu" role="menu" aria-label="Services Submenu">
            <li role="none">
              <a href="${taxHref}" class="nav-dropdown__link" role="menuitem">Tax Preparation</a>
            </li>
            <li role="none">
              <a href="${bkHref}" class="nav-dropdown__link" role="menuitem">Bookkeeping Services</a>
            </li>
            <li role="none">
              <a href="${dsHref}" class="nav-dropdown__link" role="menuitem">Digital Services</a>
            </li>
          </ul>
        </li>

        <li class="nav-links__item">
          <a href="${aboutHref}" class="nav-links__link${isAboutActive}">About Rockwell</a>
        </li>

        <li class="nav-links__item">
          <a href="${contactHref}" class="nav-links__link${isContactActive}">Contact</a>
        </li>
      </ul>

      <!-- CTA -->
      <div class="nav-cta">
        <a href="${startTaxHref}" class="btn btn--primary btn--sm nav-cta__btn">Start Your Tax Return</a>
      </div>

      <!-- Mobile Hamburger Button -->
      <button
        class="nav-hamburger"
        id="nav-hamburger"
        aria-label="Toggle navigation menu"
        aria-expanded="false"
        aria-controls="nav-mobile"
      >
        <span class="nav-hamburger__bar" aria-hidden="true"></span>
        <span class="nav-hamburger__bar" aria-hidden="true"></span>
        <span class="nav-hamburger__bar" aria-hidden="true"></span>
      </button>
    </nav>
  </div>
</header>

<!-- Mobile Drawer -->
<div class="nav-mobile" id="nav-mobile" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Site Menu">
  <div class="nav-mobile__inner">
    <nav class="nav-mobile__links" aria-label="Mobile navigation">
      <a href="${homeHref}" class="nav-mobile__link${isHomeActive}">Home</a>

      <div class="nav-mobile__group">
        <div class="nav-mobile__group-title">Services</div>
        <a href="${taxHref}" class="nav-mobile__sublink">Tax Preparation</a>
        <a href="${bkHref}" class="nav-mobile__sublink">Bookkeeping Services</a>
        <a href="${dsHref}" class="nav-mobile__sublink">Digital Services</a>
      </div>

      <a href="${aboutHref}" class="nav-mobile__link${isAboutActive}">About Rockwell</a>
      <a href="${contactHref}" class="nav-mobile__link${isContactActive}">Contact</a>
    </nav>

    <div class="nav-mobile__footer">
      <a href="${startTaxHref}" class="btn btn--primary btn--full">Start Your Tax Return</a>
      <p class="nav-mobile__note">Clear answers. Honest pricing. Your privacy protected.</p>
    </div>
  </div>
</div>`;
  }

  /* ── Build Footer HTML ── */
  function buildFooter() {
    const homeHref = resolvePath('/', 'index.html');
    const servicesHref = resolvePath('/services', 'pages/services/services.html');
    const taxHref = resolvePath('/services/tax-preparation', 'pages/tax-preparation/tax-preparation.html');
    const bkHref = resolvePath('/services/bookkeeping', 'pages/bookkeeping/bookkeeping.html');
    const dsHref = resolvePath('/services/digital-services', 'pages/digital-services/digital-services.html');
    const aboutHref = resolvePath('/about', 'pages/about/about.html');
    const contactHref = resolvePath('/contact', 'pages/contact/contact.html');
    const startTaxHref = resolvePath('/start-your-tax-return', 'pages/start-your-tax-return/start-your-tax-return.html');
    const privacyHref = resolvePath('/privacy-policy', 'pages/legal/privacy-policy.html');
    const termsHref = resolvePath('/terms-of-use', 'pages/legal/terms-of-use.html');
    const logoSrc = isCleanUrlHost() ? '/assets/icons/favicon.png' : getRoot() + 'assets/icons/favicon.png';

    return `
<footer class="site-footer" role="contentinfo">
  <div class="container">
    <div class="footer-top">

      <div class="footer-brand">
        <a href="${homeHref}" class="footer-logo" aria-label="Rockwell — Home">
          <div style="display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.25rem;">
            <img src="${logoSrc}" alt="" class="footer-logo__icon" width="32" height="32" aria-hidden="true" style="object-fit: contain; border-radius: 6px; display: block;" />
            <span class="footer-logo__primary">Rockwell</span>
          </div>
          <span class="footer-logo__sub">Tax &amp; Digital Strategies Inc.</span>
        </a>
        <p class="footer-tagline">Clear answers, careful work,<br>honest pricing, and your privacy protected.</p>
        <p class="footer-legal-notice">Rockwell Tax &amp; Digital Strategies Inc. is an independent professional services company. Services available separately.</p>
      </div>

      <nav aria-label="Footer navigation — Company">
        <p class="footer-nav__heading">Company</p>
        <ul class="footer-nav__list" role="list">
          <li><a href="${homeHref}" class="footer-nav__link">Home</a></li>
          <li><a href="${servicesHref}" class="footer-nav__link">Services Overview</a></li>
          <li><a href="${aboutHref}" class="footer-nav__link">About Rockwell</a></li>
          <li><a href="${contactHref}" class="footer-nav__link">Contact</a></li>
        </ul>
      </nav>

      <nav aria-label="Footer navigation — Services">
        <p class="footer-nav__heading">Services</p>
        <ul class="footer-nav__list" role="list">
          <li><a href="${taxHref}" class="footer-nav__link">Tax Preparation</a></li>
          <li><a href="${bkHref}" class="footer-nav__link">Bookkeeping</a></li>
          <li><a href="${dsHref}" class="footer-nav__link">Digital Services</a></li>
          <li><a href="${startTaxHref}" class="footer-nav__link">Start Your Tax Return</a></li>
        </ul>
      </nav>

      <div class="footer-contact">
        <p class="footer-nav__heading">Contact</p>
        <address class="footer-contact-address">
          <p class="footer-contact__item" style="margin-bottom: 0.75rem;">
            <a href="mailto:info@rockwelltaxdigital.com" class="footer-contact__email">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="opacity: 0.85; flex-shrink: 0; vertical-align: middle;">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span>info@rockwelltaxdigital.com</span>
            </a>
          </p>
          <div class="footer-social" aria-label="Rockwell Social Media">
            <a href="https://www.facebook.com/profile.php?id=61577544215130" target="_blank" rel="noopener noreferrer" class="footer-social__link" aria-label="Rockwell on Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="12" fill="#1877F2"/>
                <path d="M13.6 19v-6.4h2.15l.32-2.5H13.6V8.5c0-.72.2-1.22 1.24-1.22h1.32V5.05c-.23-.03-1.01-.1-1.93-.1-1.9 0-3.2 1.16-3.2 3.3v1.85H8.88v2.5h2.15V19h2.57z" fill="#FFFFFF"/>
              </svg>
              <span>Facebook</span>
            </a>
            <a href="https://www.instagram.com/rockwelltax/?utm_source=ig_web_button_share_sheet" target="_blank" rel="noopener noreferrer" class="footer-social__link" aria-label="Rockwell on Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                  <linearGradient id="ig-grad-footer" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#FD5949"/>
                    <stop offset="50%" stop-color="#D6249F"/>
                    <stop offset="100%" stop-color="#285AEB"/>
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-grad-footer)"/>
                <rect x="6.5" y="6.5" width="11" height="11" rx="3.2" fill="none" stroke="#FFFFFF" stroke-width="1.7"/>
                <circle cx="12" cy="12" r="2.7" fill="none" stroke="#FFFFFF" stroke-width="1.7"/>
                <circle cx="15.6" cy="8.4" r="0.9" fill="#FFFFFF"/>
              </svg>
              <span>Instagram</span>
            </a>
          </div>
          <p class="footer-contact__item" style="margin-top: 0.85rem;">
            <a href="${contactHref}" class="btn btn--outline-white btn--sm" style="font-size: 0.8125rem; padding: 0.5rem 1rem;">Inquiry Form &rarr;</a>
          </p>
        </address>
      </div>

    </div>

    <div class="footer-bottom">
      <p class="footer-copyright">&copy; ${new Date().getFullYear()} Rockwell Tax &amp; Digital Strategies Inc. All rights reserved.</p>
      <div class="footer-legal">
        <a href="${privacyHref}" class="footer-legal__link">Privacy Policy</a>
        <span class="footer-legal__sep" aria-hidden="true">&bull;</span>
        <a href="${termsHref}" class="footer-legal__link">Terms of Use</a>
      </div>
    </div>
  </div>
</footer>`;
  }

  /* ── Sanitize In-Page Links on Clean URL Hosts (e.g. Vercel) ── */
  function cleanUrlFromHref(href) {
    if (!href) return null;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return null;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        const u = new URL(href);
        if (u.origin !== window.location.origin) return null;
        href = u.pathname + u.search + u.hash;
      } catch (e) {
        return null;
      }
    }

    const match = href.match(/^([^?#]*)(.*)$/);
    const pathOnly = match ? match[1] : href;
    const queryAndHash = match ? match[2] : '';

    const normalized = pathOnly.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '').replace(/^\//, '');

    let target = null;
    if (normalized === 'index.html' || normalized === '' || normalized === '/') {
      target = '/';
    } else if (normalized.includes('tax-preparation')) {
      target = '/services/tax-preparation';
    } else if (normalized.includes('bookkeeping')) {
      target = '/services/bookkeeping';
    } else if (normalized.includes('digital-services')) {
      target = '/services/digital-services';
    } else if (normalized.includes('start-your-tax-return')) {
      target = '/start-your-tax-return';
    } else if (normalized.includes('services.html') || normalized === 'services' || normalized === 'pages/services') {
      target = '/services';
    } else if (normalized.includes('about')) {
      target = '/about';
    } else if (normalized.includes('contact')) {
      target = '/contact';
    } else if (normalized.includes('privacy-policy')) {
      target = '/privacy-policy';
    } else if (normalized.includes('terms-of-use')) {
      target = '/terms-of-use';
    } else if (normalized.includes('admin')) {
      target = '/admin';
    }

    if (target) {
      return target + queryAndHash;
    }
    return null;
  }

  function sanitizePageLinks() {
    if (!isCleanUrlHost()) return;

    document.querySelectorAll('a[href]').forEach(function (a) {
      const href = a.getAttribute('href');
      const clean = cleanUrlFromHref(href);
      if (clean) {
        a.setAttribute('href', clean);
      }
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (e) {
      if (!isCleanUrlHost()) return;
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      const clean = cleanUrlFromHref(href);
      if (clean && clean !== href) {
        a.setAttribute('href', clean);
      }
    }, true);
  }

  /* ── Injection Handler ── */
  function inject() {
    if (document.getElementById('site-header')) return;

    // Nav
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder) {
      navPlaceholder.outerHTML = buildNav();
    } else {
      document.body.insertAdjacentHTML('afterbegin', buildNav());
    }

    // Footer
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
      footerPlaceholder.outerHTML = buildFooter();
    } else {
      document.body.insertAdjacentHTML('beforeend', buildFooter());
    }

    sanitizePageLinks();
  }

  /* ── Mobile Hamburger Toggle with Accessible Focus Trapping ── */
  function initHamburger() {
    const hamburger = document.getElementById('nav-hamburger');
    const mobileNav = document.getElementById('nav-mobile');
    const header = document.getElementById('site-header');
    if (!hamburger || !mobileNav) return;

    function toggleMenu(open) {
      const shouldOpen = open !== undefined ? open : hamburger.getAttribute('aria-expanded') !== 'true';
      hamburger.setAttribute('aria-expanded', String(shouldOpen));
      mobileNav.setAttribute('aria-hidden', String(!shouldOpen));
      mobileNav.classList.toggle('is-open', shouldOpen);
      if (header) {
        header.classList.toggle('menu-open', shouldOpen);
      }
      document.body.style.overflow = shouldOpen ? 'hidden' : '';

      if (shouldOpen) {
        const firstLink = mobileNav.querySelector('a');
        if (firstLink) firstLink.focus();
      } else {
        hamburger.focus();
      }
    }

    hamburger.addEventListener('click', function () {
      toggleMenu();
    });

    const closeBtn = document.getElementById('nav-mobile-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        toggleMenu(false);
      });
    }

    mobileNav.addEventListener('click', function (e) {
      if (e.target === mobileNav) toggleMenu(false);
    });

    // Close on clicking any link inside mobile drawer
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) {
        toggleMenu(false);
      }
    });
  }

  /* ── Sticky Header Scroll State ── */
  function initScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;

    let ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          if (window.scrollY > 30) {
            header.classList.add('scrolled');
          } else {
            header.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── Dropdown Accessibility & Keyboard Navigation ── */
  function initDropdown() {
    const dropdown = document.getElementById('nav-services-dropdown');
    if (!dropdown) return;

    const trigger = dropdown.querySelector('.nav-dropdown__trigger');
    const menu = dropdown.querySelector('.nav-dropdown__menu');
    if (!trigger || !menu) return;

    // Toggle on click for touch devices
    trigger.addEventListener('click', function (e) {
      if (window.innerWidth >= 1024) {
        // Allow click to go to services page or open dropdown
        // On desktop hover handles it, but enter/space or touch opens
      }
    });

    // Keyboard support
    dropdown.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  }

  /* ── Instant Link Prefetcher (Instantaneous Page Switching) ── */
  function initPrefetch() {
    const prefetched = new Set();
    function prefetchUrl(url) {
      if (!url || prefetched.has(url)) return;
      try {
        const u = new URL(url, window.location.href);
        if (u.origin !== window.location.origin) return;
        if (u.pathname === window.location.pathname) return;
        if (u.pathname.startsWith('/api') || u.pathname.startsWith('/admin')) return;
        prefetched.add(url);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = u.href;
        document.head.appendChild(link);
      } catch (_) {}
    }

    document.addEventListener('mouseover', function (e) {
      const anchor = e.target.closest('a');
      if (anchor && anchor.href) {
        prefetchUrl(anchor.href);
      }
    }, { passive: true });

    document.addEventListener('touchstart', function (e) {
      const anchor = e.target.closest('a');
      if (anchor && anchor.href) {
        prefetchUrl(anchor.href);
      }
    }, { passive: true });
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      inject();
      initHamburger();
      initScroll();
      initDropdown();
      initPrefetch();
    });
  } else {
    inject();
    initHamburger();
    initScroll();
    initDropdown();
    initPrefetch();
  }
})();
