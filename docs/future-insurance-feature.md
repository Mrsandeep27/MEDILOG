# Health Insurance Feature — Future Idea

## Concept
Store, access, and manage family health insurance policies within MediLog. No insurance company API needed — users upload their existing policy document and AI extracts the details (same pattern as prescription scanning).

## Core Features

### 1. Insurance Vault
- Store multiple policies (health, life, accident)
- Fields: Provider, Policy Number, Type, Sum Insured, Premium, Renewal Date, Covered Members (linked to family), Nominee, TPA Name
- Upload policy PDF/photo → Gemini Vision auto-extracts all fields
- Manual entry fallback
- Works offline (Dexie table)

### 2. Digital Insurance Card
- One-tap view at hospital reception (like Emergency Card)
- Shows: Policy Number, Provider, TPA, Sum Insured, Covered Members, Validity
- Shareable as text/image

### 3. Premium Reminders
- Auto-create reminder when policy is added (30 days before renewal)
- Reuse existing reminder system

### 4. Claim Tracker
- Status flow: Draft → Submitted → Under Review → Approved/Rejected
- Attach documents (bills, discharge summary — link to existing records)
- Track claim amount vs approved amount

### 5. Coverage Quick-Check (AI)
- "Is this procedure covered under my policy?"
- Uses policy details + Gemini to answer

## User Flow
```
User logged into MediLog
  → /insurance (from More menu)
  → "Add Insurance" → Upload PDF/photo OR manual entry
  → AI reads document → auto-fills provider, policy number, sum insured, etc.
  → User reviews & saves
  → Policy stored in Dexie + synced to Supabase
  → Digital card available, premium reminder auto-set
```

## Technical Plan

### New Dexie Tables
```
insurancePolicies:
  id, user_id, provider, policy_number, type (health/life/accident),
  sum_insured, premium_amount, premium_frequency (monthly/quarterly/yearly),
  renewal_date, covered_member_ids[], nominee_name, nominee_relation,
  tpa_name, policy_doc_blob, is_active, sync fields...

insuranceClaims:
  id, policy_id, member_id, claim_number, amount_claimed, amount_approved,
  status (draft/submitted/under_review/approved/rejected),
  hospital, diagnosis, submitted_date, settled_date,
  record_ids[], notes, sync fields...
```

### New Pages
- `/insurance` — list policies + claims summary
- `/insurance/add` — add policy (upload or manual)
- `/insurance/[id]` — policy detail + digital card view
- `/insurance/claim` — file/track a claim

### New Hook
- `useInsurance()` — CRUD for policies and claims

### API Route
- `/api/extract-insurance` — Gemini Vision reads policy document, returns structured JSON

## Estimated Effort
- Core vault + digital card + reminders: ~2-3 hours
- Claim tracker: ~1 hour
- AI coverage checker: ~1 hour

## Indian Insurance Providers to Support
Star Health, ICICI Lombard, HDFC ERGO, Bajaj Allianz, New India Assurance, Max Bupa, Care Health, Niva Bupa, Tata AIG, Aditya Birla Health, Ayushman Bharat (PMJAY)
