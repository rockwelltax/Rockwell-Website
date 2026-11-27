/**
 * Rockwell Tax & Digital Strategies Inc.
 * Server-Side Input Validation, SSN Hard-Rejection & Composite Spam Risk Model
 */

const { Country } = require('country-state-city');

const ALL_ISO_COUNTRIES = Country.getAllCountries();
const VALID_COUNTRY_CODES = new Set(ALL_ISO_COUNTRIES.map((c) => c.isoCode.toUpperCase()));
const VALID_COUNTRY_NAMES = ALL_ISO_COUNTRIES.map((c) => c.name.toLowerCase());

const ALLOWED_TYPES = new Set([
  'w2_tax',
  '1099_tax',
  'firm_support',
  'bookkeeping',
  'digital_services',
  'general_contact'
]);

const ALLOWED_TAX_YEARS = new Set(['2026', '2025', '2024', '2023', 'prior']);
const ALLOWED_FILING_STATUSES = new Set(['single', 'mfj', 'mfs', 'hoh', 'qss', 'not-sure']);
const ALLOWED_W2_COUNTS = new Set(['0', '1-6', '7+']);
const ALLOWED_YES_NO = new Set(['yes', 'no', 'not-sure']);

// Comprehensive US States, Territories, Postal Codes & Multi-State Descriptors
const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'GU', 'VI', 'AS', 'MP', 'PH'
]);

const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
  'puerto rico', 'guam', 'virgin islands', 'american samoa', 'mariana',
  'multiple states', 'all states', 'military', 'apo', 'fpo', 'abroad',
  'expat', 'international', 'overseas', 'outside us', 'foreign', 'philippines',
  'remote', 'none', 'not sure', 'n/a'
];

// Formatted SSN/ITIN (XXX-XX-XXXX or XXX XX XXXX)
const FORMATTED_SSN_REGEX = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/;
// Labeled SSN/TIN/ITIN
const LABELED_SSN_REGEX = /\b(?:ssn|social\s*security|itin|tax\s*id|ein)[\s:#=-]*\d[\d\s-]{7,11}\b/i;
// Unformatted 9-digit SSN block (excludes invalid 000, 666, 9XX prefixes)
const RAW_9DIGIT_SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}\b/;

/**
 * Scans submission fields for SSN/ITIN-like sensitive numbers.
 * Never returns the matched sensitive value so callers never log it.
 */
function detectSensitiveSsnData(body) {
  if (!body || typeof body !== 'object') return { detected: false };

  const topFields = ['name', 'email', 'phone', 'service_requested'];
  for (const key of topFields) {
    const val = String(body[key] || '');
    if (!val) continue;
    if (FORMATTED_SSN_REGEX.test(val) || LABELED_SSN_REGEX.test(val)) {
      return { detected: true, fieldName: key };
    }
    if (key !== 'phone' && RAW_9DIGIT_SSN_REGEX.test(val)) {
      return { detected: true, fieldName: key };
    }
  }

  if (body.details && typeof body.details === 'object') {
    for (const [k, rawVal] of Object.entries(body.details)) {
      if (k === '_ft' || k === '_hp' || k === 'website_url') continue;
      const val = String(rawVal || '');
      if (!val) continue;
      if (FORMATTED_SSN_REGEX.test(val) || LABELED_SSN_REGEX.test(val)) {
        return { detected: true, fieldName: `details.${k}` };
      }
      if (k !== 'phone' && RAW_9DIGIT_SSN_REGEX.test(val)) {
        return { detected: true, fieldName: `details.${k}` };
      }
    }
  }

  return { detected: false };
}

function isValidUsStateInput(val, details = {}) {
  const countryCode = String(details?.countryCode || '').trim().toUpperCase();
  const clean = String(val || '').trim();

  // Structured worldwide location selector (any of the 250 ISO countries)
  if (countryCode && VALID_COUNTRY_CODES.has(countryCode)) {
    if (clean.length >= 2 && clean.length <= 250 && !containsHtmlOrSpamLinks(clean)) {
      return true;
    }
  }

  if (clean.length < 2 || clean.length > 250) return false;
  if (containsHtmlOrSpamLinks(clean)) return false;
  const lower = clean.toLowerCase();

  for (const stateName of US_STATE_NAMES) {
    if (lower.includes(stateName)) return true;
  }

  for (const countryName of VALID_COUNTRY_NAMES) {
    if (countryName.length >= 4 && lower.includes(countryName)) return true;
  }

  // Check uppercase 2-letter US state or ISO country tokens (e.g. "NY", "CA, TX", "PH", "CA")
  const tokens = clean.split(/[\s,;/+&|-]+/).filter(Boolean);
  for (const tok of tokens) {
    const up = tok.toUpperCase();
    if (tok.length === 2 && (US_STATE_CODES.has(up) || VALID_COUNTRY_CODES.has(up))) {
      return true;
    }
  }

  return false;
}

function isValidEmailSyntax(email) {
  const clean = String(email || '').trim();
  if (!clean || clean.length > 254) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(clean);
}

function containsHtmlOrSpamLinks(str) {
  const s = String(str || '');
  if (/<script\b|<iframe\b|<a\s+href=/i.test(s)) return true;
  const urlMatches = s.match(/https?:\/\//gi);
  if (urlMatches && urlMatches.length >= 2) return true;
  return false;
}

/**
 * Validates schema and computes a composite Spam Risk Score (0-100).
 * Dotted Gmail addresses and consonant-heavy names are NEVER auto-rejected alone;
 * they act strictly as weighted risk signals (rejection threshold >= 60).
 */
function evaluateInquirySubmission(body, context = {}) {
  const {
    elapsedMs = 10000,
    supplementaryFpMatched = false,
    recentIpRejections = 0
  } = context;

  const rawType = String(body.type || 'general_contact').trim();
  const type = rawType === 'contact' ? 'general_contact' : rawType;

  if (!ALLOWED_TYPES.has(type)) {
    return { valid: false, reason: 'invalid_inquiry_type', error: 'Invalid inquiry category selected.' };
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  const serviceRequested = String(body.service_requested || '').trim();
  const details = body.details && typeof body.details === 'object' && !Array.isArray(body.details)
    ? body.details
    : {};

  // 1. Basic Required & Length Checks
  if (!name || name.length < 2 || name.length > 150 || !/[a-zA-Z]/.test(name)) {
    return { valid: false, reason: 'invalid_name', error: 'Please enter your full name (2–150 characters).' };
  }

  if (containsHtmlOrSpamLinks(name) || containsHtmlOrSpamLinks(serviceRequested)) {
    return { valid: false, reason: 'html_or_links_in_header_fields', error: 'Invalid characters detected in name or subject.' };
  }

  if (!isValidEmailSyntax(email)) {
    return { valid: false, reason: 'invalid_email', error: 'Please enter a valid email address.' };
  }

  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[0-9()\-.\s]+$/.test(phone) || phone.length > 25) {
      return { valid: false, reason: 'invalid_phone_chars', error: 'Please enter a valid phone number using numbers only.' };
    }
    if (digits.length < 7 || digits.length > 15) {
      return { valid: false, reason: 'invalid_phone', error: 'Please enter a valid phone number (7–15 digits).' };
    }
  }

  // 2. Form-Specific Schema Checks
  const isTaxQuestionnaire =
    (type === 'w2_tax' || type === '1099_tax') &&
    (details.taxYear !== undefined || details.states !== undefined || details.filingStatus !== undefined);

  if (isTaxQuestionnaire) {
    if (!ALLOWED_TAX_YEARS.has(String(details.taxYear || ''))) {
      return { valid: false, reason: 'invalid_tax_year', error: 'Please select a valid tax year.' };
    }
    if (details.filingStatus && !ALLOWED_FILING_STATUSES.has(String(details.filingStatus))) {
      return { valid: false, reason: 'invalid_filing_status', error: 'Please select a valid filing status.' };
    }
    if (details.w2Count && !ALLOWED_W2_COUNTS.has(String(details.w2Count))) {
      return { valid: false, reason: 'invalid_w2_count', error: 'Please select a valid W-2 form count.' };
    }
    if (details.selfEmployed && !ALLOWED_YES_NO.has(String(details.selfEmployed))) {
      return { valid: false, reason: 'invalid_self_employed', error: 'Invalid self-employment selection.' };
    }
    if (!isValidUsStateInput(details.states, details)) {
      return {
        valid: false,
        reason: 'invalid_us_state',
        error: 'Please select your country, state/province, and city.'
      };
    }
  } else if (type === 'firm_support') {
    const practiceName = String(details.practiceName || '').trim();
    const firmType = String(details.firmType || '').trim();
    const software = String(details.software || '').trim();
    if (!practiceName || practiceName.length < 2) {
      return { valid: false, reason: 'missing_practice_name', error: 'Please provide your firm or practice name.' };
    }
    if (!phone) {
      return { valid: false, reason: 'missing_firm_phone', error: 'Please provide a direct phone number for firm consultation.' };
    }
    if (!firmType || !software) {
      return { valid: false, reason: 'missing_firm_metadata', error: 'Please select your practice type and primary tax software.' };
    }
  } else {
    // Contact / Bookkeeping / Digital Services / General Tax Inquiry via Contact Form
    const msg = String(details.message || '').trim();
    if (!msg || msg.length < 4 || msg.length > 2000) {
      return {
        valid: false,
        reason: 'invalid_message_length',
        error: 'Please enter a brief message describing how we can help (4–2000 characters).'
      };
    }
    if (containsHtmlOrSpamLinks(msg)) {
      return {
        valid: false,
        reason: 'spam_links_in_message',
        error: 'Please remove external links or HTML tags from your message.'
      };
    }
  }

  // 3. Composite Spam Risk Scoring (Threshold: >= 60 blocks)
  let riskScore = 0;
  const riskSignals = [];

  const [localPart, domain] = email.toLowerCase().split('@');
  if ((domain === 'gmail.com' || domain === 'googlemail.com') && (localPart.split('.').length - 1) >= 3) {
    riskScore += 20;
    riskSignals.push('dotted_gmail_alias(+20)');
  }

  const trimmedName = String(details.fullName || name).trim();
  if (/^[a-z]{5,12}$/i.test(trimmedName) && (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(trimmedName) || !/[aeiouy]/i.test(trimmedName))) {
    riskScore += 25;
    riskSignals.push('unusual_single_token_name(+25)');
  }

  const msg = String(details.message || '').trim();
  if (msg && /^\d{6,15}$/.test(msg)) {
    riskScore += 40;
    riskSignals.push('numeric_only_message(+40)');
  }

  if (
    isTaxQuestionnaire &&
    details.w2Count === '7+' &&
    details.filingStatus === 'not-sure' &&
    details.selfEmployed === 'not-sure' &&
    details.otherIncome === 'not-sure'
  ) {
    riskScore += 25;
    riskSignals.push('all_unsure_7plus_w2_pattern(+25)');
  }

  if (elapsedMs >= 2500 && elapsedMs < 4500) {
    riskScore += 15;
    riskSignals.push('fast_completion(+15)');
  }

  if (supplementaryFpMatched) {
    riskScore += 15;
    riskSignals.push('supplementary_fp_repeat(+15)');
  }

  if (recentIpRejections >= 1) {
    const ipPenalty = Math.min(35, recentIpRejections * 20);
    riskScore += ipPenalty;
    riskSignals.push(`recent_ip_rejections(+${ipPenalty})`);
  }

  if (riskScore >= 60) {
    return {
      valid: false,
      reason: 'high_spam_risk_score',
      riskScore,
      riskSignals,
      error: 'Your submission was flagged by our automated spam filter. If this is an error, please email info@rockwelltaxdigital.com directly.'
    };
  }

  // Sanitize internal keys out of stored details
  const sanitizedDetails = {};
  for (const [k, v] of Object.entries(details)) {
    if (k === '_hp' || k === 'website_url' || k === '_ft' || k === 'cf-turnstile-response') continue;
    if (typeof v === 'string') {
      sanitizedDetails[k] = v.trim().slice(0, 2000);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      sanitizedDetails[k] = v;
    }
  }

  return {
    valid: true,
    riskScore,
    riskSignals,
    cleanPayload: {
      type,
      name: name.slice(0, 150),
      email: email.slice(0, 254),
      emailNormalized: email.toLowerCase(),
      phone: phone ? phone.slice(0, 50) : null,
      serviceRequested: serviceRequested ? serviceRequested.slice(0, 100) : null,
      details: sanitizedDetails
    }
  };
}

function getExpectedTurnstileAction(body) {
  const type = String(body?.type || '');
  if (type === 'firm_support') return 'firm_support_inquiry';
  if (
    (type === 'w2_tax' || type === '1099_tax') &&
    body?.details &&
    (body.details.taxYear !== undefined || body.details.states !== undefined)
  ) {
    return 'tax_return_inquiry';
  }
  return 'contact_inquiry';
}

module.exports = {
  ALLOWED_TYPES,
  detectSensitiveSsnData,
  isValidUsStateInput,
  evaluateInquirySubmission,
  getExpectedTurnstileAction
};
