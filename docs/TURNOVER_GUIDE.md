# Rockwell Tax & Digital Strategies Inc. — Turnover, Account Ownership & Pre-Publication Guide

**Prepared**: November 27, 2026  
**Primary Rockwell Owner Account**: `info@rockwelltaxdigital.com`

This turnover guide documents **(1) Infrastructure Account Ownership & Access**, **(2) Summary of All Security & Functional Changes**, **(3) Production Environment Variables**, and **(4) Final Pre-Publication Checklist**.

---

## 1. Infrastructure Account Ownership & Access Matrix

All core infrastructure services must reside under **Rockwell Tax & Digital Strategies Inc.** (`info@rockwelltaxdigital.com`). Below is the verified status of each platform:

| Platform / Service | Purpose | Current Account / Organization | Identifiers & URLs | Turnover Status & Action Items |
| :--- | :--- | :--- | :--- | :--- |
| **1. GitHub** | Source Code Repository | **`rockwelltax`** *(Rockwell Account)* | Repo: `https://github.com/rockwelltax/Rockwell-Website` | **Under Rockwell Account.** Review Collaborators under *Settings → Collaborators* during turnover. |
| **2. Vercel** | Production Hosting & Serverless APIs | **Rockwell Vercel Account** *(Connected to `rockwelltax/Rockwell-Website`)* | Domains: `rockwelltax.com`, `www.rockwelltax.com`, `rockwelltaxdigital.com` | **Verify Env Vars & Domains** (see Section 3 below) and trigger a fresh Production Redeploy. |
| **3. Neon PostgreSQL** | Serverless Postgres Database (Prod + Dev) | **`info@rockwelltaxdigital.com`** (`org-twilight-shape-37080134`) | Project: `Rockwell Website` (`sparkling-night-63077142`, AWS Singapore)<br>• Prod Branch: `production` (`br-cold-term-bikawpjz` / `ep-solitary-morning-bigws9sn`)<br>• Dev Branch: `development` (`br-tiny-poetry-bilmdc7j` / `ep-square-boat-biuc4ydh`) | **100% Under Rockwell Account.** Enable MFA on `console.neon.tech` under *Account Settings* and ensure Vercel `DATABASE_URL` points to `ep-solitary-morning-bigws9sn-pooler` (Section 3). |
| **4. Cloudflare** | DNS Management & Turnstile Bot Protection | **Rockwell Cloudflare Account (`info@rockwelltaxdigital.com`)** | Turnstile Widget Hostnames:<br>`rockwelltax.com`, `www.rockwelltax.com`, `rockwelltaxdigital.com`, `www.rockwelltaxdigital.com` | **Action Required if Turnstile Desired:** Log in to `dash.cloudflare.com` under `info@rockwelltaxdigital.com` → *Turnstile → Add Widget*, copy the matching **Site Key** and **Secret Key** into Vercel, or leave blank to use Rockwell's Built-in SVG CAPTCHA. |
| **5. Resend** | Outbound Confirmation, Admin Alert & Reset Emails | **Rockwell Resend Account** (`resend.com`) | Verified Domain: `rockwelltax.com`<br>Configured Sender: `info@rockwelltaxdigital.com` | **Action Required:** Confirm Resend login is owned by `info@rockwelltaxdigital.com`, and add + verify DNS records (DKIM/SPF) for **`rockwelltaxdigital.com`** at `resend.com/domains` so emails send cleanly from `info@rockwelltaxdigital.com`. |
| **6. Website Admin Portal** | Inquiry CRM, CSV Export & Site Publish Gate | `/admin` (`https://www.rockwelltax.com/admin`) | Allowed Admins (`ADMIN_ALLOWED_EMAILS`):<br>• `info@rockwelltaxdigital.com`<br>• `info@rockwelldigital.com` | **Post-Turnover Step:** Log in as `info@rockwelltaxdigital.com`, reset password via `/admin` *Forgot Password*, and remove developer email (`kaelmendiola26@gmail.com`) from `ADMIN_ALLOWED_EMAILS` in Vercel when handover concludes. |

---

## 2. Summary of Implemented Changes (Changelog)

### A. Public Intake Forms & Client Experience
1. **Tax Firm Support Form (`/firm-support`) Submission Fix**:
   - Added missing `data-validate` binding across clean/production templates, switched asset references to root-relative paths (`/js/...`, `/css/...`), and explicitly registered `#firm-support-form`, `#contact-form`, and `#tax-inquiry-form` in `js/form-validation.js` so form submissions never trigger a native browser page reload.
2. **Phone Number Field Added Across All Forms**:
   - Added required `Phone Number` (`input[type="tel" name="phone"]`) fields to **Contact (`/contact`)** and **Start Your Tax Return (`/start-your-tax-return`)** (matching **Tax Firm Support (`/firm-support`)**), validated for `7–15` digits and persisted into `inquiries.phone`, Admin Dashboard tables/CSV exports, and Admin email alerts.
3. **Email Sender & Exclusive Notification Routing**:
   - Updated `FROM_EMAIL` default and templates to `Rockwell Tax & Digital <info@rockwelltaxdigital.com>`.
   - Locked `INQUIRY_NOTIFICATION_EMAIL` exclusively to `info@rockwelltaxdigital.com` so client inquiries never leak to developer addresses.

### B. Multi-Layer Bot, Spam & Sensitive Data Protection
1. **Cloudflare Turnstile + Self-Healing Built-in SVG CAPTCHA**:
   - Implemented server-verified Cloudflare Turnstile (`lib/turnstile.js`) paired with an automatic fallback to Rockwell's **Built-in Cryptographic HMAC-SHA256 SVG CAPTCHA** (`lib/captcha.js`) featuring distorted vector glyphs, `>=1.2s` human solve timing, and database-backed replay prevention.
   - Added automatic misconfiguration detection (`siteKey === secretKey` or Cloudflare `invalid-input-secret`) so forms seamlessly fall back to SVG CAPTCHA instead of blocking clients with `503` errors.
2. **Dual Honeypot & Interaction Speed Trap**:
   - Added hidden `_hp` and `website_url` honeypots plus HMAC-signed `_ft` form timing tokens (`>=2.5s` human completion time).
3. **Server-Side Validation & Strict Anti-SSN Protection**:
   - Server-side schema validation (`lib/spam-filter.js`) rejects malformed emails/phones, HTML/link injection, gibberish bot payloads, and any text matching SSN/ITIN patterns (`400`) without ever storing sensitive numbers in the database or audit logs.

### C. Smart Client-Friendly 24-Hour Rate Limiting
- Upgraded `POST /api/inquiries` rate limiting so **legitimate clients with additional inquiries are never unfairly blocked**:
  - **Multiple Services Allowed Immediately**: A client who submits a *Tax Return* inquiry can immediately submit additional inquiries for *Bookkeeping*, *Digital Services*, *Firm Support*, or *General Questions*.
  - **Follow-Ups Allowed**: Up to **2 submissions per same service category per email in 24h** (with a `60-second` duplicate-click cooldown) and up to **4 total inquiries per email in 24h**.
  - **Shared Household / Office Devices Supported**: Up to **5 inquiries per device cookie in 24h** (with a `3-second` simultaneous burst guard) and adaptive shared-IP thresholds (`10 / 24h`, `5 / 10m`).
  - **Pre-Filled Direct Email Escape Hatch**: Any visitor reaching a rate limit receives a polite card with a 1-click `mailto:info@rockwelltaxdigital.com` button pre-populated with their message.

### D. Admin Portal & Database Hardening
- Migrated both `production` and `development` PostgreSQL branches under Rockwell's Neon account (`info@rockwelltaxdigital.com` / `sparkling-night-63077142`).
- Provisioned least-privilege runtime database user `rockwell_app_user` (zero `DROP`, `ALTER`, or `TRUNCATE` privileges).
- Enforced `HttpOnly; SameSite=Strict; Secure` HMAC-SHA256 admin session cookies, server-side session revocation (`admin_sessions`), `X-CSRF-Token` validation, Coming Soon server-side gatekeeping, and `security_audit_logs`.
- Re-compiled all 15 client JavaScript bundles via `npm run build`.

### E. Final 8-Section Content, Navigation & UX Refinements (Monday Turnover Ready)
1. **Navigation Menu**: Standardized `Home | Services | About Rockwell | Contact` with `Tax Preparation`, `Bookkeeping Services`, and `Digital Services` cleanly nested under the `Services` dropdown, plus the `Start Your Tax Return` CTA button and proper `/firm-support` active-state/routing support.
2. **About Rockwell**: Updated title from *"Founder & Principal"* to *"Founder"*, added Fritzie's educational background (*"She holds a bachelor’s degree in Computer Science and a master’s degree in Database Technologies"*), retained her trust & compliance quote, renamed the section to *"How We Work With You"*, and styled the four steps as clean static informational items with zero clickable/hover button appearance.
3. **Tax Preparation Page**: Streamlined repetitive fee disclaimers into concise clarity (*"Final pricing depends on the complexity of the return and applicable state filings"*), retained **$100+** (Individual W-2) and **$250+** (Self-Employed/1099), and updated practice standards across `/services/tax-preparation`, `/services`, and `/terms-of-use` to: *"Our tax preparation services are led by an experienced tax return preparer with an active IRS Preparer Tax Identification Number (PTIN)."*
4. **Tax Inquiry Form**: Added all 6 IRS filing status options (`Single`, `Married Filing Jointly`, `Married Filing Separately`, `Head of Household`, `Qualifying Surviving Spouse`, `Not Sure`) in both frontend HTML and backend `lib/spam-filter.js` validation, confirmed `2026` tax year availability, and retained prominent SSN/Tax ID/document upload warnings (with zero file-upload inputs on public forms).
5. **Tax Firm Support**: Verified `Explore Firm Support` routes cleanly to `/firm-support` and updated the form footer notice to *"Your information will be handled with care and confidentiality."*
6. **Bookkeeping Services**: Retained `AI Bookkeeping App` at **$19.99/month (subject to final pricing confirmation)** and `Managed Bookkeeping — Request a Quote`, with clear callouts confirming they are separate standalone options with no requirement to avail both.
7. **Privacy & Footer**: Verified `Privacy Policy` link in the global footer across all pages and updated `/privacy-policy` copy for review prior to final publication.
8. **Google Search SEO, Sitelinks Schema & Admin Stealth Protection**:
   - Unified all `<link rel="canonical">`, Open Graph `og:url`, and Twitter Card tags to the live production domain (`https://www.rockwelltax.com`).
   - Added rich Schema.org JSON-LD (`AccountingService`, `ProfessionalService`, `WebSite`, `OfferCatalog`, `SiteNavigationElement` Sitelinks list, and per-page `BreadcrumbList` / `Service` / `AboutPage` / `ContactPage`) targeting *"Rockwell Tax & Digital Strategies Inc."*, *"RockwellTax & Digital Strategies Inc."*, *"Rockwell Tax"*, *"Rockwell"*, and core W-2, 1099, PTIN, CPA firm support, bookkeeping, and digital service search terms.
   - Created `/robots.txt`, `/sitemap.xml` (11 public indexable URLs), and `/site.webmanifest`.
   - Locked down `/admin` (and `/coming-soon` + `/api/*`) against search indexing across 4 layers: `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">`, Edge HTTP header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` in `vercel.json` & `server.js`, `Disallow: /admin` in `robots.txt`, and complete exclusion from `sitemap.xml`.
   - **Post-Launch Tip**: Submit `https://www.rockwelltax.com/sitemap.xml` in **Google Search Console** (`search.google.com/search-console`) under the `info@rockwelltaxdigital.com` Google account for fastest indexing and Sitelinks generation.

---

## 3. Production Environment Variables Checklist (Vercel)

Before final publication, verify the following variables in **Vercel Dashboard → Project Settings → Environment Variables (Production)**:

| Variable | Recommended Production Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables Secure cookies & production DB pool |
| `DATABASE_URL` | `postgresql://rockwell_app_user:<APP_DB_PASSWORD>@<prod-pooler-host>/neondb?sslmode=require` | **Must point to Rockwell's Neon `production` pooler** (`sparkling-night-63077142`) |
| `ADMIN_SESSION_SECRET` | *(128-character random hex secret)* | Signs admin cookies, CSRF, device cookies & CAPTCHA tokens |
| `ADMIN_ALLOWED_EMAILS` | `info@rockwelltaxdigital.com,info@rockwelldigital.com` | Add/remove authorized admin login emails here |
| `RESEND_API_KEY` | `re_...` *(from Rockwell Resend account)* | Outbound email API key |
| `FROM_EMAIL` | `Rockwell Tax & Digital <info@rockwelltaxdigital.com>` | Ensure `rockwelltaxdigital.com` is **Verified** in Resend Domains! *(Use `info@rockwelltax.com` temporarily if DNS verification is still pending)* |
| `INQUIRY_NOTIFICATION_EMAIL` | `info@rockwelltaxdigital.com` | Exclusive recipient for all client inquiry alerts |
| `TURNSTILE_SITE_KEY` | *(Leave blank OR paste valid Site Key from Rockwell Cloudflare)* | Leaving blank automatically runs Built-in SVG CAPTCHA |
| `TURNSTILE_SECRET_KEY` | *(Leave blank OR paste matching Secret Key from Rockwell Cloudflare)* | Must NOT equal `TURNSTILE_SITE_KEY` |
| `COMING_SOON_BLOCK_INQUIRIES` | `true` | Blocks unauthenticated form POSTs while site is in Coming Soon mode; automatically allows all public inquiries once Published |

---

## 4. Final Pre-Publication Verification Checklist

- [x] **Database Schema & Role Grants Applied**: `node scripts/migrate-db.js --target prod` and `--target dev` executed on Rockwell's Neon project (`sparkling-night-63077142`).
- [x] **Automated 13-Suite Security & Concurrency Tests**: `npm run test:security` — **13/13 PASS** on isolated `development` branch.
- [x] **Client JS Bytecode Obfuscation**: `npm run build` — **15/15 files encrypted**.
- [ ] **Resend Domain Verification**: Verify `rockwelltaxdigital.com` status is **Verified** at `https://resend.com/domains`.
- [ ] **Vercel Environment Variables Sync & Redeploy**: Confirm Section 3 variables in Vercel (especially `DATABASE_URL`, `FROM_EMAIL`, and clearing mismatched Turnstile keys until fresh Rockwell Cloudflare keys are created), then redeploy.
- [ ] **Live Smoke Test Before Public Announcement**:
  1. Log in to `/admin` as `info@rockwelltaxdigital.com`.
  2. Set Site Status to **Published** (or test via **Admin Preview** `?preview=admin` first).
  3. Submit 1 test inquiry on `/contact`, `/start-your-tax-return`, and `/firm-support` (verifying Phone Number saves in `/admin` and confirmation + admin emails arrive from `info@rockwelltaxdigital.com`).
  4. Delete the 3 test inquiries from `/admin` so the production dashboard starts clean.
