/* ============================================================
   ROCKWELL TAX & DIGITAL STRATEGIES INC.
   Shared Navigation & Footer Component (Vanilla JS)
   Brand Colors: #BCA18A | #3892A9 | #29211D | #FFFFFF
   ============================================================ */

(function () {
  'use strict';

  /* ── Detect Root Relative Path ── */
  function getRoot() {
    const path = window.location.pathname.replace(/\\/g, '/');
    // If inside /pages/... return ../../, otherwise ./
    const match = path.match(/\/pages\/[^/]+\//i);
    return match ? '../../' : './';
  }

  function resolveRoot(href) {
    return getRoot() + href;
  }

  /* ── Robust Active Link Detector ── */
  function isActive(href) {
    const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();

    // Home
    if (href === 'index.html' || href === '' || href === './') {
      return !path.includes('/pages/');
    }

    // Specific subpages
    if (href.includes('services/services.html')) {
      return path.includes('/pages/services/') && !path.includes('tax-preparation') && !path.includes('bookkeeping') && !path.includes('digital-services');
    }
    if (href.includes('tax-preparation')) {
      return path.includes('/tax-preparation/');
    }
    if (href.includes('bookkeeping')) {
      return path.includes('/bookkeeping/');
    }
    if (href.includes('digital-services')) {
      return path.includes('/digital-services/');
    }
    if (href.includes('about')) {
      return path.includes('/about/');
    }
    if (href.includes('contact')) {
      return path.includes('/contact/');
    }
    if (href.includes('start-your-tax-return')) {
      return path.includes('/start-your-tax-return/');
    }

    return false;
  }

  /* ── Nav Links Configuration ── */
  const NAV_LINKS = [
    { label: 'Home',             href: 'index.html' },
    { label: 'Services',         href: 'pages/services/services.html' },
    { label: 'Tax Preparation',  href: 'pages/tax-preparation/tax-preparation.html' },
    { label: 'Bookkeeping',      href: 'pages/bookkeeping/bookkeeping.html' },
    { label: 'Digital Services', href: 'pages/digital-services/digital-services.html' },
    { label: 'About',            href: 'pages/about/about.html' },
    { label: 'Contact',          href: 'pages/contact/contact.html' },
  ];

  const TAX_RETURN_HREF = 'pages/start-your-tax-return/start-your-tax-return.html';

  /* ── Build Navigation HTML ── */
  function buildNav() {
    const desktopLinks = NAV_LINKS.map(function (item) {
      const resolved = resolveRoot(item.href);
      const activeClass = isActive(item.href) ? ' active' : '';
      const ariaCurrent = isActive(item.href) ? ' aria-current="page"' : '';
      return `<li class="nav-links__item"><a href="${resolved}" class="nav-links__link${activeClass}"${ariaCurrent}>${item.label}</a></li>`;
    }).join('\n        ');

    const mobileLinks = NAV_LINKS.map(function (item) {
      const resolved = resolveRoot(item.href);
      const activeClass = isActive(item.href) ? ' active' : '';
      const ariaCurrent = isActive(item.href) ? ' aria-current="page"' : '';
      return `<a href="${resolved}" class="nav-mobile__link${activeClass}"${ariaCurrent}>${item.label}</a>`;
    }).join('\n    ');

    const taxHref = resolveRoot(TAX_RETURN_HREF);
    const homeHref = resolveRoot('index.html');
    const contactHref = resolveRoot('pages/contact/contact.html');

    return `
<a href="#main-content" class="skip-link">Skip to main content</a>
<header class="site-header" id="site-header" role="banner">
  <div class="container">
    <nav class="nav-inner" aria-label="Main navigation">
      <a href="${homeHref}" class="nav-logo" aria-label="Rockwell Tax &amp; Digital Strategies — Home">
        <span class="nav-logo__primary">Rockwell</span>
        <span class="nav-logo__sub">Tax &amp; Digital Strategies Inc.</span>
      </a>

      <ul class="nav-links" role="list">
        ${desktopLinks}
      </ul>

      <div class="nav-cta">
        <a href="${taxHref}" class="btn btn--primary">Start Your Tax Return</a>
      </div>

      <button
        class="nav-hamburger"
        aria-label="Open navigation menu"
        aria-expanded="false"
        aria-controls="nav-mobile"
        id="nav-hamburger"
      >
        <span class="nav-hamburger__bar"></span>
        <span class="nav-hamburger__bar"></span>
        <span class="nav-hamburger__bar"></span>
      </button>
    </nav>
  </div>
</header>

<div class="nav-mobile" id="nav-mobile" aria-hidden="true">
  <div class="nav-mobile__inner">
    ${mobileLinks}
    <div class="nav-mobile__cta">
      <a href="${taxHref}" class="btn btn--primary btn--lg">Start Your Tax Return</a>
      <a href="${contactHref}" class="btn btn--secondary btn--lg">Contact Us</a>
    </div>
  </div>
</div>`;
  }

  /* ── Build Footer HTML ── */
  function buildFooter() {
    const homeHref = resolveRoot('index.html');
    const servicesHref = resolveRoot('pages/services/services.html');
    const taxHref = resolveRoot('pages/tax-preparation/tax-preparation.html');
    const bkHref = resolveRoot('pages/bookkeeping/bookkeeping.html');
    const dsHref = resolveRoot('pages/digital-services/digital-services.html');
    const aboutHref = resolveRoot('pages/about/about.html');
    const contactHref = resolveRoot('pages/contact/contact.html');
    const startTaxHref = resolveRoot(TAX_RETURN_HREF);
    const privacyHref = resolveRoot('pages/legal/privacy-policy.html');
    const termsHref = resolveRoot('pages/legal/terms-of-use.html');

    return `
<footer class="site-footer" role="contentinfo">
  <div class="container">
    <div class="footer-top">

      <div class="footer-brand">
        <a href="${homeHref}" class="footer-logo" aria-label="Rockwell — Home">
          <span class="footer-logo__primary">Rockwell</span>
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
          <li><a href="${taxHref}" class="footer-nav__link">Tax Preparation ($100+)</a></li>
          <li><a href="${bkHref}" class="footer-nav__link">Bookkeeping Support</a></li>
          <li><a href="${dsHref}" class="footer-nav__link">Digital Services</a></li>
          <li><a href="${startTaxHref}" class="footer-nav__link">Start Your Tax Return</a></li>
        </ul>
      </nav>

      <div>
        <p class="footer-nav__heading">Verified Contact</p>
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
      </div>
    </div>
  </div>
</footer>`;
  }

  /* ── Injection Handler ── */
  function inject() {
    // Avoid double injection
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
        // Focus first link in mobile menu
        const firstLink = mobileNav.querySelector('a');
        if (firstLink) firstLink.focus();
      } else {
        hamburger.focus();
      }
    }

    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (mobileNav.classList.contains('is-open') && !hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
        toggleMenu(false);
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) {
        toggleMenu(false);
      }
    });

    // Close when mobile links are clicked
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(false);
      });
    });
  }

  /* ── Sticky Header on Scroll ── */
  function initStickyNav() {
    const header = document.getElementById('site-header');
    if (!header) return;

    function onScroll() {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Lifecycle Init ── */
  function init() {
    inject();
    initHamburger();
    initStickyNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
