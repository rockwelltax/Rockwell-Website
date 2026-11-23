# Rockwell Tax & Digital Strategies Inc. — Admin & Security Architecture

This document provides a comprehensive operational overview of the website administration, infrastructure ownership, security practices, and disaster recovery for **Rockwell Tax & Digital Strategies Inc.**

---

## 1. Administrative Access & Credentials

- **Admin Portal URL**: `https://rockwelltaxdigital.com/admin` (or `http://localhost:3000/admin` locally)
- **Primary Administrative Accounts**:
  - `info@rockwelltaxdigital.com` (Default Initial Password: `admin123`)
  - `Kaelmendiola26@gmail.com` (Default Initial Password: `admin123`)
  - `Info@rockwelldigital.com`
  - `info@rockwelltax.com`

### Access Control & Security Policies:
1. **Password Encryption**: All passwords are encrypted with `bcrypt` (10 salt rounds). Plaintext passwords are never stored or logged.
2. **Rate Limiting**: To prevent brute-force attacks, the `/api/auth` endpoint restricts repeated login failures. Exceeding 5 failed attempts within 5 minutes results in a temporary lock tracked in the `login_rate_limits` table.
3. **Password Reset Security**:
   - Resets generate a secure random 6-digit verification code sent via Resend to the admin's email.
   - Codes strictly expire after **2 minutes**.
   - Verified codes update the password and automatically flag the code as consumed (`used = true`).
4. **Session Authentication**: Authenticated sessions issue a time-limited base64 Bearer token evaluated by `verifyAdmin` on all sensitive API routes (`GET /api/inquiries`, `PATCH /api/inquiries`, `DELETE /api/inquiries`).

---

## 2. Client Inquiry Storage & Database

- **Provider**: **Neon Serverless Postgres** (Database name: `neondb`)
- **Connection Configuration**: Managed through `DATABASE_URL` (pooled connection for serverless API endpoints) and `DATABASE_URL_UNPOOLED` (for direct schema migrations).
- **Core Tables**:
  - `inquiries`: Stores incoming submissions from `/contact`, `/start-your-tax-return`, and `/firm-support`.
    - Columns: `id`, `type` (`w2_tax`, `1099_tax`, `firm_support`, `bookkeeping`, `digital_services`, `general_contact`), `name`, `email`, `phone`, `service_requested`, `status` (`new`, `contacted`, `quote_sent`, `in_progress`, `completed`, `archived`), `details` (`JSONB`), `ip_address`, `created_at`, `updated_at`.
  - `admin_users`: Stores admin credentials and update timestamps.
  - `password_resets`: Tracks 6-digit reset codes and expiration windows.
  - `login_rate_limits`: Stores failed attempts and lockout expiration timestamps.
  - `site_settings`: Holds the global publishing state (`published`, `coming_soon`, `scheduled`).

---

## 3. Email Infrastructure & Notifications

- **Provider**: **Resend** (API Key in `.env` under `RESEND_API_KEY`)
- **Sending Domain**: Verified domain `notifications@rockwelltax.com` (or fallback domain configured in `FROM_EMAIL`)
- **Notification Routing**:
  - **Client Confirmation**: Dispatches an instant, branded email to the client confirming receipt, setting clear expectations (fee confirmation before work begins, no documents sent over public forms, secure portal upload link sent separately).
  - **Admin Notification**: Dispatches an alert containing all form fields, client contact info, and tax year/firm software details directly to `ADMIN_EMAIL` (`info@rockwelltaxdigital.com,Kaelmendiola26@gmail.com`).

---

## 4. Hosting & Deployment

- **Production Host**: **Vercel**
  - Project configuration: Root `vercel.json` provides strict security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`), clean URL redirects, and serverless API handlers (`/api/auth`, `/api/inquiries`, `/api/site-status`).
- **Code Repository**: GitHub: `https://github.com/martquirante/ockwell_website-`
- **Client Code Obfuscation**: Client-facing JavaScript is encrypted into bytecode using `javascript-obfuscator` (`npm run obfuscate`), while original clean source files are maintained under `_source_clean/` for development.

---

## 5. Backups & Disaster Recovery

1. **Neon Automated Backups & Point-in-Time Recovery (PITR)**:
   - Neon automatically snapshots data continuously. The database can be restored to any second within the retention window.
   - Database branches can be created instantly for staging or testing without risking production data.
2. **Offline Data Backups via Admin Portal**:
   - The Admin Portal includes an **Export CSV** feature (`btn-export-csv`) on the inquiries table. Admins can export and download all inquiries at any time.
3. **Database Initialization Script**:
   - `node scripts/init-db.js` verifies and re-creates all necessary tables and indexes if deployed to a fresh Postgres instance.

---

## 6. Rockwell Ownership & Account Handoff Checklist

To ensure Rockwell Tax & Digital Strategies Inc. retains full ownership:
- [x] **Primary Business Email**: `info@rockwelltaxdigital.com` configured as admin and primary contact.
- [x] **Database Access**: Neon Postgres instance credentials stored securely in `.env`.
- [x] **Email Service Access**: Resend account credentials associated with `rockwelltax.com`.
- [x] **Hosting Access**: Vercel project ownership linked to the official repository.
- [x] **Domain DNS**: DNS records for `rockwelltaxdigital.com` and `rockwelltax.com` configured for Vercel and Resend verification.
