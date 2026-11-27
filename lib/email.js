const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Strictly route ALL admin inquiry notifications to info@rockwelltaxdigital.com.
// Never read legacy ADMIN_EMAIL here so old multi-recipient env vars cannot leak notifications.
const INQUIRY_NOTIFICATION_EMAIL = (
  process.env.INQUIRY_NOTIFICATION_EMAIL || 'info@rockwelltaxdigital.com'
).trim();

// Verified domain sender from rockwelltax.com
const FROM_EMAIL = process.env.FROM_EMAIL || 'Rockwell Tax & Digital <notifications@rockwelltax.com>';

/**
 * Base email layout with mobile-first and light/dark theme styling
 */
function wrapEmailTemplate(contentHtml, preheaderText = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Rockwell Tax &amp; Digital Strategies</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #f7f5f2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #29211D;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e5dfd8;
      box-shadow: 0 4px 20px rgba(41, 33, 29, 0.06);
    }
    .email-header {
      background-color: #29211D;
      padding: 28px 24px;
      text-align: center;
      border-bottom: 3px solid #3892A9;
    }
    .email-header-title {
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 8px 0 2px 0;
      font-family: Georgia, serif;
    }
    .email-header-sub {
      color: #BCA18A;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
      margin: 0;
    }
    .email-body {
      padding: 32px 28px;
      line-height: 1.6;
      font-size: 15px;
      color: #29211D;
    }
    .email-card {
      background-color: #faf8f5;
      border: 1px solid #e8e2da;
      border-radius: 8px;
      padding: 18px 20px;
      margin: 20px 0;
    }
    .code-box {
      background-color: #29211D;
      color: #3892A9;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;
      text-align: center;
      padding: 16px 20px;
      border-radius: 8px;
      margin: 24px 0;
      font-family: monospace;
      border: 2px dashed #3892A9;
    }
    .btn-primary {
      display: inline-block;
      background-color: #3892A9;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      margin: 15px 0;
    }
    .email-footer {
      background-color: #faf8f5;
      padding: 24px 28px;
      text-align: center;
      border-top: 1px solid #e8e2da;
      font-size: 12px;
      color: #7a7068;
      line-height: 1.5;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1a1614 !important;
        color: #e5dfd8 !important;
      }
      .email-container {
        background-color: #221c19 !important;
        border-color: #3d332d !important;
      }
      .email-body {
        color: #f0ebe4 !important;
      }
      .email-card {
        background-color: #2a2320 !important;
        border-color: #3d332d !important;
      }
      .email-footer {
        background-color: #1c1815 !important;
        border-color: #3d332d !important;
        color: #a3988f !important;
      }
      .email-footer p {
        color: #a3988f !important;
      }
      .code-box {
        background-color: #171311 !important;
      }
    }
    @media only screen and (max-width: 480px) {
      .email-container {
        margin: 0 !important;
        border-radius: 0 !important;
        border: none !important;
      }
      .email-body {
        padding: 24px 18px !important;
      }
    }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#f7f5f2;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheaderText}
  </div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <div class="email-container">
          <div class="email-header">
            <h1 class="email-header-title">Rockwell</h1>
            <p class="email-header-sub">Tax &amp; Digital Strategies Inc.</p>
          </div>
          <div class="email-body">
            ${contentHtml}
          </div>
          <div class="email-footer">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #29211D;">Rockwell Tax &amp; Digital Strategies Inc.</p>
            <p style="margin: 0 0 10px 0;">Clear answers &bull; Honest pricing &bull; Confidentiality &amp; compliance</p>
            <p style="margin: 0; font-size: 11px;">Note: We never ask for Social Security numbers or sensitive banking credentials through standard public web forms.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Send Client Confirmation Email (To Client's Email, Reply-To info@rockwelltaxdigital.com)
 */
async function sendClientConfirmation({ to, name, type, details = {} }) {
  let typeLabel = 'Inquiry';
  if (type === 'w2_tax') typeLabel = 'Individual Tax Return (W-2)';
  else if (type === '1099_tax') typeLabel = 'Self-Employed / 1099 Tax Return';
  else if (type === 'firm_support') typeLabel = 'Tax Firm Back-Office Support';
  else if (type === 'bookkeeping') typeLabel = 'Bookkeeping Services Inquiry';
  else if (type === 'digital_services') typeLabel = 'Digital Services Inquiry';

  const detailsList = Object.entries(details)
    .filter(([k, v]) => v && typeof v !== 'object')
    .map(([k, v]) => `<li style="margin-bottom:6px;"><strong>${formatKey(k)}:</strong> ${escapeHtml(String(v))}</li>`)
    .join('');

  const body = `
    <h2 style="font-family: Georgia, serif; font-size: 20px; color: #29211D; margin-top: 0;">Thank you, ${escapeHtml(name)}</h2>
    <p>We have successfully received your inquiry for <strong>${typeLabel}</strong>.</p>
    
    <div class="email-card">
      <h3 style="margin-top:0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #3892A9;">Inquiry Summary</h3>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.5; font-size: 14px;">
        ${detailsList || '<li>Inquiry logged with your contact details</li>'}
      </ul>
    </div>

    <h3 style="font-size: 16px; margin-bottom: 8px;">What Happens Next?</h3>
    <ol style="padding-left: 20px; line-height: 1.6; margin-top: 4px;">
      <li><strong>Information Review:</strong> Fritzie and the Rockwell team will carefully review your inquiry details.</li>
      <li><strong>Personalized Quote:</strong> We will reach out to discuss scope and provide a transparent, confirmed quote before any payment is requested.</li>
      <li><strong>Secure Document Exchange:</strong> If you proceed with tax preparation, you will receive private access to an approved, encrypted document upload portal.</li>
    </ol>

    <div class="email-card" style="border-left: 3px solid #3892A9;">
      <p style="margin: 0; font-size: 13.5px; line-height: 1.55;">
        <strong>Need to inquire about another service or update your details?</strong><br>
        To protect client security, our web forms accept one inquiry per 24 hours. If you would also like to ask about Bookkeeping, Digital Services, or Firm Support—or add details right away—simply <strong>reply directly to this email</strong> or write to <a href="mailto:${escapeHtml(INQUIRY_NOTIFICATION_EMAIL)}" style="color:#3892A9;">${escapeHtml(INQUIRY_NOTIFICATION_EMAIL)}</a>.
      </p>
    </div>

    <p style="margin-bottom: 0;">Warm regards,<br><strong>Rockwell Tax &amp; Digital Strategies Team</strong></p>
  `;

  const html = wrapEmailTemplate(body, `Confirmation of your inquiry with Rockwell Tax & Digital Strategies Inc.`);

  try {
    if (!resend) {
      console.warn('⚠️ Resend is not initialized (missing RESEND_API_KEY).');
      return { success: false, error: 'Resend API key missing' };
    }

    const res = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      replyTo: INQUIRY_NOTIFICATION_EMAIL,
      subject: `Inquiry Received: ${typeLabel} — Rockwell Tax & Digital Strategies`,
      html
    });

    if (res.error) {
      console.error(`❌ Resend error sending confirmation to ${to}:`, res.error.message);
      return { success: false, error: res.error.message };
    }

    return { success: true, id: res.data?.id };
  } catch (err) {
    console.error(`❌ Failed to send confirmation email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Send Admin Notification Email (Exclusively to info@rockwelltaxdigital.com, Reply-To Client)
 */
async function sendAdminNotification({ inquiry }) {
  const { name, email, phone, type, service_requested, details = {} } = inquiry;

  const detailsList = Object.entries(details)
    .filter(([k, v]) => v && typeof v !== 'object')
    .map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;font-weight:600;">${formatKey(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;">${escapeHtml(String(v))}</td></tr>`)
    .join('');

  const body = `
    <h2 style="font-family: Georgia, serif; font-size: 20px; color: #29211D; margin-top: 0;">New Inquiry Received!</h2>
    <p>A new client has submitted a verified inquiry on the Rockwell website.</p>
    
    <div class="email-card">
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;font-weight:600;width:35%;">Client Name</td><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;font-weight:600;">Email Address</td><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;"><a href="mailto:${escapeHtml(email)}" style="color:#3892A9;">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;font-weight:600;">Phone Number</td><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;">${escapeHtml(phone || 'Not provided')}</td></tr>
        <tr><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;font-weight:600;">Inquiry Type</td><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;"><strong style="color:#3892A9;">${escapeHtml(type)}</strong></td></tr>
        ${service_requested ? `<tr><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;font-weight:600;">Service Requested</td><td style="padding:6px 10px;border-bottom:1px solid #e8e2da;">${escapeHtml(service_requested)}</td></tr>` : ''}
        ${detailsList}
      </table>
    </div>

    <p style="text-align:center;">
      <a href="https://rockwelltaxdigital.com/admin" class="btn-primary">View in Admin Dashboard &rarr;</a>
    </p>
  `;

  const html = wrapEmailTemplate(body, `New inquiry from ${name} (${type})`);

  try {
    if (!resend) {
      console.warn('⚠️ Resend is not initialized (missing RESEND_API_KEY).');
      return { success: false, error: 'Resend API key missing' };
    }

    const adminRecipients = INQUIRY_NOTIFICATION_EMAIL.split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const res = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminRecipients,
      replyTo: email,
      subject: `🚨 [New Rockwell Inquiry] ${type.toUpperCase()}: ${name}`,
      html
    });

    if (res.error) {
      console.error(`❌ Resend error sending admin notification to ${adminRecipients.join(', ')}:`, res.error.message);
      return { success: false, error: res.error.message };
    }

    return { success: true, id: res.data?.id, recipients: adminRecipients };
  } catch (err) {
    console.error(`❌ Failed to send admin notification:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Send Password Reset Code (Valid for 2 minutes)
 */
async function sendPasswordResetCode({ to, code }) {
  const body = `
    <h2 style="font-family: Georgia, serif; font-size: 20px; color: #29211D; margin-top: 0;">Password Reset Code</h2>
    <p>You requested a password reset for your Rockwell Admin account (<strong>${escapeHtml(to)}</strong>).</p>
    
    <p>Please enter the following 6-digit verification code to proceed:</p>
    
    <div class="code-box">
      ${escapeHtml(code)}
    </div>

    <p style="color: #b33924; font-weight: 600; text-align: center;">
      ⏱️ This code will expire in exactly 2 minutes for security.
    </p>

    <p style="font-size: 13px; color: #7a7068; margin-top: 24px;">
      If you did not make this request, you can safely ignore this email. Your admin password will remain unchanged.
    </p>
  `;

  const html = wrapEmailTemplate(body, `Your Rockwell Admin password reset code is ${code}`);

  try {
    if (!resend) {
      console.warn('⚠️ Resend is not initialized (missing RESEND_API_KEY).');
      return { success: false, error: 'Resend API key missing' };
    }

    const res = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `🔑 ${code} is your Rockwell Admin verification code (Expires in 2 mins)`,
      html
    });

    if (res.error) {
      console.error(`❌ Resend error sending reset code to ${to}:`, res.error.message);
      return { success: false, error: res.error.message };
    }

    return { success: true, id: res.data?.id };
  } catch (err) {
    console.error(`❌ Failed to send reset code to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

function formatKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

module.exports = {
  INQUIRY_NOTIFICATION_EMAIL,
  sendClientConfirmation,
  sendAdminNotification,
  sendPasswordResetCode
};
