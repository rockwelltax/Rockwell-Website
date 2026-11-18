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
              <a href="${servicesHref}" class="nav-dropdown__link" role="menuitem">All Services Overview</a>
            </li>
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

  <!-- Mobile Drawer -->
  <div class="nav-mobile" id="nav-mobile" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Site Menu">
    <div class="nav-mobile__inner">
      <div class="nav-mobile__header">
        <a href="${homeHref}" class="nav-logo" aria-label="Rockwell Tax &amp; Digital Strategies — Home">
          <img src="${logoSrc}" alt="" class="nav-logo__icon" width="28" height="28" aria-hidden="true" />
          <div class="nav-logo__text">
            <span class="nav-logo__primary">Rockwell</span>
            <span class="nav-logo__sub">Tax &amp; Digital Strategies Inc.</span>
          </div>
        </a>
        <button class="nav-mobile__close" id="nav-mobile-close" aria-label="Close menu">&times;</button>
      </div>

      <nav class="nav-mobile__links" aria-label="Mobile navigation">
        <a href="${homeHref}" class="nav-mobile__link${isHomeActive}">Home</a>

        <div class="nav-mobile__group">
          <div class="nav-mobile__group-title">Services</div>
          <a href="${servicesHref}" class="nav-mobile__sublink">Services Overview</a>
          <a href="${taxHref}" class="nav-mobile__sublink">Tax Preparation</a>
          <a href="${bkHref}" class="nav-mobile__sublink">Bookkeeping</a>
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
  </div>
</header>`;
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
    const adminHref = resolvePath('/admin', 'pages/admin/admin.html');
    const logoSrc = isCleanUrlHost() ? '/assets/icons/favicon.png' : getRoot() + 'assets/icons/favicon.png';

    return `
<footer class="site-footer" role="contentinfo">
  <div class="container">
    <div class="footer-top">

      <div class="footer-brand">
        <a href="${homeHref}" class="footer-logo" aria-label="Rockwell — Home">
          <div style="display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.25rem;">
            <img src="${logoSrc}" alt="" class="footer-logo__icon" width="28" height="28" aria-hidden="true" style="filter: brightness(0) invert(1);" />
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
          <p class="footer-contact__item footer-contact__pending">Direct phone &amp; official email address will be published upon verified setup prior to launch.</p>
          <p class="footer-contact__item" style="margin-top: 0.75rem;">
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
        <span class="footer-legal__sep" aria-hidden="true">&bull;</span>
        <a href="${adminHref}" class="footer-legal__link" style="opacity: 0.5;">Admin Portal</a>
      </div>
    </div>
  </div>
</footer>`;
  }

  /* ── Sanitize In-Page Links on Clean URL Hosts (e.g. Vercel) ── */
  function sanitizePageLinks() {
    if (!isCleanUrlHost()) return;

    const mapping = {
      'index.html': '/',
      'pages/services/services.html': '/services',
      'pages/tax-preparation/tax-preparation.html': '/services/tax-preparation',
      'pages/bookkeeping/bookkeeping.html': '/services/bookkeeping',
      'pages/digital-services/digital-services.html': '/services/digital-services',
      'pages/about/about.html': '/about',
      'pages/contact/contact.html': '/contact',
      'pages/start-your-tax-return/start-your-tax-return.html': '/start-your-tax-return',
      'pages/legal/privacy-policy.html': '/privacy-policy',
      'pages/legal/terms-of-use.html': '/terms-of-use',
      'pages/admin/admin.html': '/admin'
    };

    document.querySelectorAll('a[href]').forEach(function (a) {
      const href = a.getAttribute('href');
      if (!href) return;
      const clean = href.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
      if (mapping[clean]) {
        a.setAttribute('href', mapping[clean]);
      }
    });
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
    if (!hamburger || !mobileNav) return;

    function toggleMenu(open) {
      const shouldOpen = open !== undefined ? open : hamburger.getAttribute('aria-expanded') !== 'true';
      hamburger.setAttribute('aria-expanded', String(shouldOpen));
      mobileNav.setAttribute('aria-hidden', String(!shouldOpen));
      mobileNav.classList.toggle('is-open', shouldOpen);
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

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      inject();
      initHamburger();
      initScroll();
      initDropdown();
    });
  } else {
    inject();
    initHamburger();
    initScroll();
    initDropdown();
  }
})();
