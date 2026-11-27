# Rockwell Tax & Digital Strategies Inc. — Admin & Security Architecture

This document provides a comprehensive operational overview of the website administration, infrastructure ownership, security controls, rate-limiting architecture, and disaster recovery for **Rockwell Tax & Digital Strategies Inc.**

---

## 1. Administrative Access & Session Security

- **Admin Portal URL**: `https://www.rockwelltax.com/admin` / `https://rockwelltaxdigital.com/admin` (`http://localhost:3000/admin` locally)
- **Authorized Administrative Allowlist (`ADMIN_ALLOWED_EMAILS`)**:
  - `info@rockwelltaxdigital.com` — *Primary Rockwell Owner Account (bcrypt-hashed in Neon; credentials provided privately at turnover)*
  - `info@rockwelldigital.com` — *Secondary Rockwell Account*
  - `kaelmendiola26@gmail.com` — *Developer / Support (removable upon final turnover)*

### Authentication & Session Controls (`/api/auth`):
1. **Password Hashing**: Passwords are hashed using `bcryptjs` (12 salt rounds on resets/updates). Plaintext passwords are never stored or logged.
2. **Cryptographic Session Cookies + Database Revocation**:
   - Login issues an `HttpOnly; SameSite=Strict; Secure` cookie (`rw_admin_session`, 12-hour TTL) signed with HMAC-SHA256 (`ADMIN_SESSION_SECRET`) and backed by a row in `admin_sessions` storing only the SHA-256 token hash.
   - Unsigned or tampered tokens are immediately rejected (`401`).
   - All state-changing admin endpoints (`POST /api/site-status`, `PATCH /api/inquiries`, `DELETE /api/inquiries`, logout) enforce constant-time `X-CSRF-Token` validation (`403` if missing/mismatched).
3. **Brute-Force Protection**:
   - Login attempts are rate-limited per `(IP, Email)` pair (5 failed attempts trigger a 5-minute lockout).
4. **Password Reset Security**:
   - Generates a cryptographically random 6-digit code emailed via Resend (`2-minute` strict expiration).
   - Automatically invalidates the code after **5 wrong guesses** (`failed_attempts >= 5`) and revokes all active admin sessions upon password change.

---

## 2. Public Form Protection & Smart 24-Hour Rate Limiting

All three public intake forms — **Contact (`/contact`)**, **Start Your Tax Return (`/start-your-tax-return`)**, and **Tax Firm Support (`/firm-support`)** — pass through a multi-layer defense pipeline (`POST /api/inquiries`):

1. **Human Verification (Cloudflare Turnstile + Built-in Cryptographic SVG CAPTCHA)**:
   - Supports live **Cloudflare Turnstile** (`TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`) with hostname & action verification.
   - Includes a self-healing **Built-in HMAC-SHA256 SVG CAPTCHA** (`lib/captcha.js`) with distorted Bezier glyphs, 1.2s minimum human solve timing, and single-use replay protection in `security_audit_logs` whenever Turnstile keys are unset or unavailable.
2. **Dual Honeypot & Signed Timing Trap**:
   - Hidden honeypot fields (`_hp`, `website_url`) and an HMAC-signed form token (`_ft`) requiring at least `2.5 seconds` of human interaction before submission.
3. **Server-Side Schema Validation & Strict Anti-SSN Scanner (`lib/spam-filter.js`)**:
   - Validates name, RFC email syntax, phone number (`7–15 digits`, collected across all 3 forms), tax year, filing status, location, and firm metadata.
   - **Zero-Storage SSN/ITIN Protection**: Any input resembling a Social Security Number or Tax ID is rejected (`400`) before database insertion and is **never** written to `inquiries` or `security_audit_logs`.
4. **Client-Friendly Smart 24-Hour Rate Limiting (PostgreSQL Transactional Advisory Locks)**:
   - Serialized atomically with `pg_advisory_xact_lock` so concurrent bot bursts cannot bypass limits.
   - **Multi-Service Friendly**: Legitimate clients who submit one inquiry (e.g., *Individual Tax Return*) can **immediately** submit additional inquiries for other Rockwell services (e.g., *Bookkeeping*, *Digital Services*, or *Firm Support*) without being blocked.
   - **Follow-Up Friendly**: Allows up to **2 inquiries per service category per email in 24h** (with a `60-second` duplicate-click guard on the same category) and up to **4 total inquiries per email / 24h**.
   - **Shared Computer & Office Wi-Fi Friendly**: Allows up to **5 inquiries per device cookie / 24h** (with a `3-second` anti-race burst guard) and adaptive shared-IP limits (`10 / 24h`, `5 / 10m`), ensuring spouses on one computer or colleagues on corporate Wi-Fi are not blocked.
   - **Graceful Direct-Email Fallback**: Whenever a rate limit is reached (`429 RATE_LIMIT_24H`), the form displays a pre-filled 1-click `mailto:info@rockwelltaxdigital.com` follow-up card so no legitimate client message is ever lost.

---

## 3. Database Architecture & Least-Privilege Security (Neon Postgres)

- **Account Owner**: `info@rockwelltaxdigital.com` (Neon Org ID: `org-twilight-shape-37080134`)
- **Project**: `Rockwell Website` (`sparkling-night-63077142`, Region: `aws-ap-southeast-1`, PostgreSQL 18)
- **Isolated Branches**:
  - `production` (`br-cold-term-bikawpjz` — Endpoint: `ep-solitary-morning-bigws9sn`)
  - `development` (`br-tiny-poetry-bilmdc7j` — Endpoint: `ep-square-boat-biuc4ydh`)
- **Least-Privilege Runtime Role (`rockwell_app_user`)**:
  - Runtime API endpoints connect strictly as `rockwell_app_user`, which has **zero DDL (`DROP`, `ALTER`) and zero `TRUNCATE` privileges**, cannot `DELETE` from `security_audit_logs` or `admin_users`, and can only update `(password_hash, updated_at)` on `admin_users`.
  - Schema owner credentials (`neondb_owner` via `MIGRATION_DATABASE_URL`) are used exclusively by offline CLI migration/backup scripts.
- **Core Tables**: `inquiries`, `inquiry_rate_limits`, `admin_users`, `admin_sessions`, `password_resets`, `login_rate_limits`, `site_settings`, `security_audit_logs`.

---

## 4. Email Infrastructure & Notifications (Resend)

- **Provider**: **Resend** (`RESEND_API_KEY`)
- **Configured Sender (`FROM_EMAIL`)**: `Rockwell Tax & Digital <info@rockwelltaxdigital.com>` *(requires `rockwelltaxdigital.com` domain verification in Resend Dashboard alongside `rockwelltax.com`)*
- **Exclusive Admin Notification Routing (`INQUIRY_NOTIFICATION_EMAIL`)**:
  - Strictly routes all admin inquiry alerts exclusively to `info@rockwelltaxdigital.com` (`Reply-To` set to client's email).
  - Sends instant branded confirmation emails to the client (`Reply-To` set to `info@rockwelltaxdigital.com`).

---

## 5. Hosting, Code Protection & Disaster Recovery

- **GitHub Repository**: `https://github.com/rockwelltax/Rockwell-Website` (Under Rockwell GitHub account `rockwelltax`)
- **Production Host**: **Vercel** (`vercel.json` enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`)
- **Client JavaScript Protection**: `npm run build` (`scripts/obfuscate.js`) compiles clean sources from `_source_clean/` into obfuscated production bundles.
- **Backups & Verification CLI**:
  - `npm run migrate` (`node scripts/migrate-db.js --target dev|prod`) — Idempotent schema & least-privilege role provisioning.
  - `npm run backup` (`node scripts/backup-db.js`) — Encrypted/JSON snapshot export of database tables.
  - `npm run test:security` (`node scripts/test-security.js`) — 13-suite automated security, concurrency, and functional verification runner (executes strictly against `DEV_DATABASE_URL`).
