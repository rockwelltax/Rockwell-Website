# Rockwell Tax & Digital Strategies Inc. — Master Website Project

A complete, production-quality, responsive multi-page website for **Rockwell Tax & Digital Strategies Inc.**, designed and engineered using semantic HTML5, modern CSS3, and vanilla JavaScript (ES6+).

Built according to the client's Week 1 requirements, official brand palette, and strict security and trust standards.

---

## Brand Identity & Color Architecture

Built strictly with the official 4-color palette:

| Role | Color Name | Hex Code | Usage |
|---|---|---|---|
| **Warm Surface** | Warm Beige | `#BCA18A` | Soft warm section surfaces, decorative flourishes, borders, badges |
| **Interactive Accent** | Teal Blue | `#3892A9` | Primary CTA buttons, interactive links, focus states, icons |
| **Typography & Contrast** | Dark Brown | `#29211D` | Deep editorial headings, body text, dark hero & footer sections |
| **Clean Surface** | White | `#FFFFFF` | Main cards, form containers, high-contrast readable surfaces |

Typography is paired with the editorial serif **Playfair Display** for headlines and clean **Inter** for readable body text and user-interface elements.

---

## Project Structure

```
rockwell-website/
│
├── index.html                   # Home page (Page 1)
├── index.css                    # Home page styles
├── index.js                     # Home page interactions & scroll hint
│
├── pages/
│   ├── services/                # Services Overview (Page 2)
│   │   ├── services.html
│   │   ├── services.css
│   │   └── services.js          # Interactive category filtering
│   │
│   ├── tax-preparation/         # Tax Preparation (Page 3)
│   │   ├── tax-preparation.html
│   │   ├── tax-preparation.css
│   │   └── tax-preparation.js   # Interactive starting fee estimator
│   │
│   ├── bookkeeping/             # Bookkeeping (Page 4)
│   │   ├── bookkeeping.html
│   │   ├── bookkeeping.css
│   │   └── bookkeeping.js       # Option comparison & query routing
│   │
│   ├── digital-services/        # Digital Services (Page 5)
│   │   ├── digital-services.html
│   │   ├── digital-services.css
│   │   └── digital-services.js  # Interactive scope interest selector
│   │
│   ├── about/                   # About / Founder (Page 6)
│   │   ├── about.html
│   │   ├── about.css
│   │   └── about.js             # Credentials and values interaction
│   │
│   ├── start-your-tax-return/   # Tax Return Inquiry (Page 7)
│   │   ├── start-your-tax-return.html
│   │   ├── start-your-tax-return.css
│   │   └── start-your-tax-return.js # Pre-fill handler & SSN safeguard
│   │
│   ├── contact/                 # Contact & Consultation (Page 8)
│   │   ├── contact.html
│   │   ├── contact.css
│   │   └── contact.js           # Topic selector & character counter
│   │
│   └── legal/                   # Supplementary Legal Pages
│       ├── privacy-policy.html
│       ├── terms-of-use.html
│       └── legal.css
│
├── assets/
│   ├── images/                  # Authentic curated business photography
│   │   ├── hero-consultation.jpg
│   │   ├── tax-preparation.jpg
│   │   ├── bookkeeping-dashboard.jpg
│   │   ├── business-review.jpg
│   │   ├── digital-marketing.jpg
│   │   ├── digital-content.jpg
│   │   ├── social-media.jpg
│   │   ├── tax-accounting-hero.jpg
│   │   └── founder-placeholder.svg # Official portrait badge for Fritzie
│   ├── icons/
│   │   └── favicon.svg          # Official Rockwell "R" SVG favicon
│   └── fonts/                   # Web font hooks
│
├── css/
│   ├── variables.css            # Official brand tokens, spacing & shadows
│   ├── global.css               # Reset, buttons, containers, notices
│   ├── typography.css           # Playfair Display & Inter type hierarchy
│   ├── navigation.css           # Header, desktop links, mobile hamburger
│   ├── footer.css               # Editorial footer & legal layout
│   ├── animations.css           # Staggered entrances & scroll transitions
│   └── responsive.css           # 360px to 1920px mobile-first breakpoints
│
├── js/
│   ├── navigation.js            # Shared navigation/footer & active state
│   ├── animations.js            # IntersectionObserver scroll reveals
│   ├── utilities.js             # Focus trap, debounce, escapeHTML
│   └── form-validation.js       # Accessible live client-side validation
│
├── README.md                    # Complete project documentation
└── .gitignore                   # Git ignore rules
```

---

## How to Run Locally

No compiler, bundler, or Node.js environment is required. You can test the site directly:

1. **Direct file opening:**
   Double-click `rockwell-website/index.html` in any modern web browser. All paths are relative and work seamlessly on `file:///`.

2. **Using a local web server (Recommended):**
   ```bash
   # Python 3
   cd rockwell-website
   python -m http.server 8080

   # Or using npx serve
   npx serve rockwell-website
   ```
   Then open `http://localhost:8080` in your browser.

---

## Page-by-Page Inventory & Features

### 1. Home (`index.html`)
- **Eyebrow:** `TAX • BOOKKEEPING • DIGITAL SERVICES`
- **Headline:** `Tax Preparation Made Clear. Business Support Made Simple.`
- **Hero Visual:** High-resolution authentic workspace photo with warm beige accents and glassmorphism badge.
- **CTAs:** Primary `Explore Services` & Secondary `Start Your Tax Return`.
- **Services Overview:** Tax Preparation ($100+ / $250+), Bookkeeping, Digital Services.
- **Meet Rockwell:** Introduction of founder Fritzie Ann Silva with executive portrait badge adhering to photo approval guidelines.
- **Trust Section:** Five core pillars: Transparent quotes upfront, secure document handoff, client privacy, review before filing, no outcome guarantees.
- **Testimonials:** Verified placeholder explicitly noting reviews appear only when genuine and client-approved (zero fabricated reviews).

### 2. Services (`pages/services/services.html`)
- **Headline:** `Choose the Support You Need.`
- **Interactive Filtering:** Quick-select pills (`All Services`, `Tax Preparation`, `Bookkeeping`, `Digital Services`) that filter and scroll to the relevant service block.
- **Visuals:** Authentic photography for each service area.
- **Individual Services:** Each service available separately with direct inquiry actions.

### 3. Tax Preparation (`pages/tax-preparation/tax-preparation.html`)
- **Headline:** `Tax Preparation Services`
- **Pricing:**
  - Individual: Starting at **$100+** (typical personal return with up to 6 W-2 forms).
  - Self-Employed: Starting at **$250+** (freelancers, side businesses, Schedule C).
- **Interactive Starting Fee Estimator:** Live calculator widget that lets users calculate their starting fee and passes their parameters directly to the inquiry questionnaire.
- **Client Journey:** Detailed 5-step process (Inquiry &rarr; Fee Confirmation &rarr; Upfront Payment &rarr; Secure Portal Upload &rarr; Prepare, Review & File).
- **Notices:** Clear disclosures on no guaranteed refunds and no IRS EA claim.

### 4. Bookkeeping (`pages/bookkeeping/bookkeeping.html`)
- **Headline:** `Bookkeeping Support That Fits Your Business.`
- **Option 1 (AI App):** Marked clearly with an **"Unconfirmed"** badge (~$19/month). Discloses that pricing, features, and referral agreements are pending confirmation with the app owner.
- **Option 2 (Managed Bookkeeping):** "Request a Quote" based on transaction volume.
- **Why It Matters:** Visual section with authentic review photography.

### 5. Digital Services (`pages/digital-services/digital-services.html`)
- **Headline:** `Help Your Business Get Noticed Online.`
- **Confirmed Scope:** Social media content creation, social media posts, reels creation, and business promotions.
- **Interactive Service Selector:** Users can click cards to select which services they need; the inquiry button dynamically updates to pre-fill their selection.
- **Audience & Disclaimers:** Clarifies that digital marketing results cannot be guaranteed.

### 6. About (`pages/about/about.html`)
- **Headline:** `Rooted in Experience. Guided by Trust.`
- **Founder Background:** Complete approved narrative detailing Fritzie Ann Silva's degrees (B.S. in Computer Science, M.S. in Database Technologies) and operational experience.
- **Founder Portrait:** High-fidelity executive monogram placeholder respecting the client rule to not fabricate an identity.
- **How We Work:** Complete approved text on earning trust through transparent pricing, careful information handling, and client collaboration.

### 7. Start Your Tax Return (`pages/start-your-tax-return/start-your-tax-return.html`)
- **Headline:** `Tell Us a Little About Your Tax Needs.`
- **8 Required Form Fields:**
  1. Full Name
  2. Email Address
  3. Tax Year (2025, 2024, 2023, Prior years)
  4. Filing Status (Single, MFJ, MFS, Not sure)
  5. Number of W-2 forms (0, 1–6, 7+)
  6. Did you earn money from working for yourself? (Yes, No, Not sure)
  7. Any other tax forms or income? (Yes, No, Not sure)
  8. What state(s) did you live or work in?
- **Security & Privacy:**
  - Strict warning against entering SSNs, bank details, or uploading documents.
  - Active client-side SSN detection safeguard that intercepts 9-digit patterns and sanitizes inputs.
  - Clear Week 1 Demonstration / Prototype badge.
  - Accessible validation and success state with next-step instructions.

### 8. Contact (`pages/contact/contact.html`)
- **Headline:** `Get in Touch.`
- **Features:** General inquiry form with quick topic pills, subject pre-fill from query parameters, 1000-character counter, anti-SSN safeguard, and direct service links.
- **Pending Notice:** Explains that official business telephone, direct email, and social media handles will be published upon verified setup prior to launch.

---

## Third-Party Integrations & Launch Readiness Status

| Integration | Status | Launch Plan |
|---|---|---|
| **Form Submissions** | ⏳ Prototype / Demonstrated | Client-side validation active. Connect to approved endpoint (e.g. Formspree or secure backend) before public launch. |
| **Payment Links** | ⏳ Pending Setup | Prepare placeholder integration for GoDaddy Pay Links / QR codes once merchant fees and payout destination are verified. |
| **Secure Document Portal** | ⏳ Architectural Placeholder | Public file uploads are strictly omitted. Secure document upload portal must be independently selected, security-reviewed, and linked separately after payment. |
| **Booking Calendar** | ⏳ Not Required for Launch | As confirmed in Week 1 decisions, consultation inquiries are handled via the inquiry forms without unnecessary third-party subscriptions. |

---

## Unconfirmed Client Information Checklist

| Item | Status | Action Required Before Public Launch |
|---|---|---|
| Direct Business Phone | ⚠ Not published | Supply verified phone number. |
| Official Email Address | ⚠ Not published | Supply official `@rockwelltax.com` email address. |
| Social Media Profiles | ⚠ Not published | Confirm verified links for Facebook, Instagram, LinkedIn, etc. |
| Bookkeeping App Pricing ($19/mo) | ⚠ Marked as unconfirmed | Verify pricing, feature set, support SLA, and referral agreement with app vendor. |
| Client Testimonials | ⚠ Not fabricated | Add verified client reviews once written client consent is received. |
| Founder Portrait | ⚠ Official placement badge | Replace SVG portrait frame with high-resolution photograph of Fritzie Ann Silva. |
| Physical Business Address | ⚠ Not published | Confirm whether a physical address or digital office is published. |

---

## Compliance & Security Standards

- **Zero IRS EA / CPA Misrepresentation:** The site strictly positions Rockwell as an experienced tax preparation and business support practice, without claiming Enrolled Agent or IRS certifications that have not been granted.
- **No Refund Guarantees:** Disclaimers explicitly inform taxpayers that returns are prepared accurately following tax regulations, but refunds and specific outcomes cannot be guaranteed.
- **Taxpayer Privacy (IRC § 7216 Awareness):** Sensitive taxpayer information (Social Security Numbers, bank account numbers, W-2 attachments) is never collected through public contact forms.
- **GoDaddy Websites + Marketing Basic Compatibility:** The codebase is designed cleanly with pure HTML, CSS, and JS. It can be hosted on any static web server, Netlify, GitHub Pages, or adapted into GoDaddy embed structures.

---

*Rockwell Tax & Digital Strategies Inc. &bull; Designed &amp; Developed for Week 1 Deliverable Approval.*
