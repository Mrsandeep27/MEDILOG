# MediLog — Legal & Policy Context for Landing Page

Use this document to generate: Privacy Policy, Terms of Service, About Us, Contact, and Advisory sections.

---

## Company / Founder Info

- **Product:** MediLog — India's first offline-first, AI-powered family health record manager
- **Founder:** Sandeep Pandey
- **Company:** 2XG (not yet formally registered — pre-revenue side project)
- **Location:** Bangalore, Karnataka, India
- **Contact Email:** sandeep@2xg.in (or use a medilog-specific email)
- **Website:** https://medi--log.vercel.app
- **GitHub:** https://github.com/Mrsandeep27/MEDILOG
- **Status:** Open source, free to use, no paid plan yet

---

## What MediLog Does

MediLog helps Indian families store, manage, and share health records digitally. It works offline (no internet needed) and uses AI to scan prescriptions, identify medicines, and answer health questions.

**Key features:**
- Family health profiles (unlimited members)
- AI prescription scanner (extracts medicines from photos)
- AI health assistant (symptom checker, not a replacement for real doctors)
- AI medicine identifier (photograph any medicine strip)
- AI lab report explainer
- Medicine reminders with notifications
- Emergency health card with QR sharing
- Doctor sharing via time-limited links
- ABHA (Ayushman Bharat) health ID integration
- Offline-first — works without internet, syncs when online
- PWA — no app store download needed

---

## Data Collection — COMPLETE Breakdown

### A. Data User Provides

| Data | When Collected | Required? |
|------|---------------|-----------|
| Email address | Signup | Yes |
| Password | Signup (hashed, never stored as plaintext) | Yes |
| Name | Onboarding | Yes |
| Phone number | Optional in profile | No |
| Family member names | When adding family | Yes (per member) |
| Date of birth | When adding family | No |
| Blood group | When adding family | No |
| Gender | When adding family | No |
| Allergies | When adding family | No |
| Chronic conditions | When adding family | No |
| Emergency contact name & phone | When adding family | No |
| ABHA health ID number | If user links ABHA | No |

### B. Health Records User Creates

| Data | Description |
|------|-------------|
| Prescription records | Title, doctor name, hospital, visit date, diagnosis, notes, images |
| Lab reports | Same structure as prescriptions |
| Vaccination records | Same structure |
| Bills & discharge summaries | Same structure |
| Medicine list | Name, dosage, frequency, duration, before/after food |
| Health vitals | Blood pressure, blood sugar, weight, temperature, SpO2 |
| Symptoms | Daily mood/symptom tracking (stored locally only, NOT synced) |
| Reminder schedules | Medicine name, time, days of week |

### C. Data Generated Automatically

| Data | How | Purpose |
|------|-----|---------|
| Reminder adherence logs | When user marks medicine as taken/missed/skipped | Track medicine compliance |
| Share access logs | When someone opens a shared health link | Know who viewed your shared records |
| AI API usage logs | Every AI feature call | Cost tracking, error debugging |
| Sync timestamps | On every data sync | Know what's been synced |

### D. Data NOT Collected

- No location/GPS data
- No contacts or address book access
- No call logs or SMS
- No advertising IDs
- No browsing history
- No third-party cookies
- No analytics tracking (no Google Analytics, no Mixpanel, etc.)
- No financial/payment data
- No biometric data (fingerprint, face ID)

---

## Where Data is Stored

### Local (on user's device)
- **IndexedDB** (via Dexie.js): All health records, family profiles, medicines, reminders, vitals
- **localStorage**: User session (email, name, ID), app settings (language, theme, PIN hash, notification preferences)
- **Images**: Prescription/lab report images stored as compressed blobs in IndexedDB (max 500KB each, max 10 per record)

### Cloud (Supabase — PostgreSQL)
- **Provider:** Supabase (hosted on AWS ap-south-1, Mumbai region)
- **What's synced:** All records except locally-stored images and symptom tracker data
- **When:** Auto-sync every 30 minutes when online, or manually triggered
- **Encryption in transit:** All connections use HTTPS/TLS
- **Database encryption:** Supabase default PostgreSQL encryption at rest
- **Access control:** Row Level Security (RLS) — users can only access their own data

### NOT Stored Anywhere
- Passwords (only hashed version stored by Supabase Auth)
- Credit card / payment info (no payments in app)
- Aadhaar number (only ABHA ID is stored, not raw Aadhaar)

---

## Third-Party Services

### 1. Supabase (Authentication + Database)
- **What we send:** Email, password (for auth), all synced health records
- **Their role:** User authentication, cloud database, session management
- **Data location:** AWS ap-south-1 (Mumbai, India)
- **Their privacy policy:** https://supabase.com/privacy
- **Note:** We use their Auth service for signup/login and PostgreSQL for data storage

### 2. Google Gemini AI (AI Features)
- **What we send:**
  - Prescription images (for AI extraction)
  - Symptom descriptions (for AI doctor chat)
  - Lab report images (for analysis)
  - Medicine photos (for identification)
  - Patient context: name, age, gender, blood group, allergies, chronic conditions, current medicines
- **What we DON'T send:** Email, password, phone number, Aadhaar/ABHA details
- **Their role:** AI-powered analysis and responses
- **Data retention by Google:** Subject to Google's AI API terms (data not used for training by default with paid API)
- **Their privacy policy:** https://policies.google.com/privacy
- **Models used:** gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview

### 3. Vercel (Hosting)
- **What they see:** Standard web server logs (IP address, user agent, URLs visited)
- **Their role:** Hosts the website and API routes
- **Their privacy policy:** https://vercel.com/legal/privacy-policy

### 4. Tesseract.js (OCR — Text Extraction)
- **Runs entirely in user's browser** — no data sent to any server
- **What it does:** Extracts text from prescription/lab report images locally
- **Languages supported:** English + Hindi

### 5. No Other Third Parties
- No advertising networks
- No analytics platforms
- No social media SDKs
- No crash reporting services
- No A/B testing tools

---

## Data Sharing

### Share Links (User-Initiated)
- Users can create time-limited share links for their health records
- Shared data: member profile (name, blood group, allergies, conditions), health records, medicines
- NOT shared: email, user ID, reminders, settings
- Links expire after configurable hours (default: 24 hours)
- Links can be revoked anytime
- Access is logged (timestamp only, no IP tracking)

### With Doctors
- Share links are designed for sharing with doctors
- Doctor sees a read-only view with QR code
- No account needed to view shared data

### We Never Share Data With
- Advertisers
- Insurance companies
- Employers
- Government agencies (unless legally required)
- Data brokers
- Any commercial third party

---

## Security Measures

| Measure | Implementation |
|---------|---------------|
| Password hashing | Supabase Auth (bcrypt) |
| Session tokens | JWT, 7-day expiry, httpOnly, sameSite=strict, secure |
| PIN lock | Optional 4-digit PIN, hashed with SHA-256, 5-min auto-lock |
| Rate limiting | 5 req/min for auth, 3 req/min for signup, 20/min for AI |
| Bot protection | Honeypot fields + timing checks on signup |
| Email verification | Required before app access |
| HTTPS | All connections encrypted in transit |
| Row Level Security | Users can only query their own data in Supabase |
| Soft deletes | Records marked as deleted, not immediately purged |
| Image compression | Max 500KB per image, processed locally before storage |
| Offline security | All data stored in browser's sandboxed IndexedDB |

---

## User Rights

### What Users Can Do
- **View all data:** Everything is visible in-app
- **Edit/delete records:** Full CRUD on all health records, family members, medicines, reminders
- **Export data:** JSON and CSV export available (More → Download Report)
- **Delete account:** Sign out removes local data; email support for full cloud deletion
- **Control sharing:** Create, revoke, and delete share links anytime
- **Control notifications:** Enable/disable, set quiet hours
- **Language choice:** English or Hindi
- **Offline access:** Use app without internet — no data leaves the device

### Data Retention
- Active data: Kept as long as account exists
- Deleted records: Soft-deleted (marked `is_deleted`), not immediately purged from database
- Share links: Automatically expire after set duration
- AI usage logs: Kept indefinitely for cost tracking
- **Full deletion:** Contact support to request complete data removal

---

## Compliance Notes

### GDPR (if applicable to EU users)
- Data minimization: Only essential data collected
- Right to access: Users can view all data in-app
- Right to delete: Users can delete records; full account deletion via support
- Data portability: JSON/CSV export available
- No automated decision-making that affects users legally

### India IT Act & DPDP Act (2023)
- Personal data processed with user consent (signup = consent)
- Health data is "sensitive personal data" — handled with additional care
- Data stored in India (Supabase AWS Mumbai region)
- No data sold or shared with third parties for commercial purposes
- Users can withdraw consent by deleting their account

### HIPAA (US)
- MediLog does NOT claim HIPAA compliance
- No BAA (Business Associate Agreement) with Supabase or Google
- Not intended for use by US healthcare providers as an EHR system

### Medical Disclaimer
- AI features are for informational purposes only
- AI Doctor is NOT a substitute for professional medical advice
- AI prescriptions/lab analysis should be verified by a qualified doctor
- MediLog is a health record manager, NOT a medical diagnostic tool

---

## Children's Privacy

- MediLog does not knowingly collect data from children under 13
- Family members (children) are added by the parent/guardian who manages the account
- Children's health records are managed by and accessible only to the account holder

---

## Contact for Legal/Privacy Matters

- **Email:** sandeep@2xg.in
- **GitHub Issues:** https://github.com/Mrsandeep27/MEDILOG/issues
- **Location:** Bangalore, Karnataka, India
- **Response time:** Within 72 hours for privacy-related requests

---

## For Landing Page — Pages to Generate

### 1. Privacy Policy Page
Use all data collection, storage, sharing, and third-party sections above. Include:
- What data we collect and why
- How we store it (local + cloud)
- Who we share it with (third-party services)
- User rights (access, delete, export)
- Cookies (only Supabase session cookie, no tracking cookies)
- Security measures
- Children's privacy
- Contact info
- Last updated date

### 2. Terms of Service Page
Key clauses:
- Service is provided "as-is", free of charge
- AI features are informational, not medical advice
- User is responsible for accuracy of their health records
- We may update terms — continued use = acceptance
- Account termination rights
- Intellectual property (app is open source, user data belongs to user)
- Limitation of liability
- Governing law: India

### 3. About Us Section
- Founded by Sandeep Pandey, Bangalore
- Mission: Make health record management accessible to 65Cr+ Indians without reliable internet
- Open source project
- Built with Next.js, Supabase, Google Gemini AI
- Offline-first architecture — works without internet
- Hindi-first design for Indian families

### 4. Contact Page
- Email: sandeep@2xg.in
- GitHub: https://github.com/Mrsandeep27/MEDILOG
- Location: Bangalore, India
- For: Privacy requests, bug reports, feature suggestions, partnerships

### 5. Advisory / Endorsements
- **Note:** No doctor endorsements or advisory board yet
- **Recommendation:** Add a medical disclaimer prominently
- **Future:** Seek endorsements from local GPs who use the app for patients
- **Landing page should say:** "Built with guidance from healthcare professionals" (only if true) OR "Reviewed by medical experts" (only if done)
- **Safe alternative:** "AI powered by Google Gemini — trained on medical literature"

---

*Document created: April 2026*
*For: Landing page legal pages generation*
*Author: Sandeep Pandey / MediLog Team*
