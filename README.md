# MediFamily - AI-Powered Family Health Record Manager

> India's first offline-first, AI-powered family health record manager. Scan prescriptions, get AI medical guidance, track medicines, and share records with doctors — all from your browser.

**Live:** [medifamily.in](https://medifamily.in)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)
![Gemini AI](https://img.shields.io/badge/Gemini-AI-4285F4?logo=google)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)

---

## The Problem

Every Indian family faces this:

- **Lost prescriptions** — paper prescriptions get lost within days
- **WhatsApp chaos** — medical reports scattered across family group chats
- **No history at new doctors** — "What medicines are you currently taking?" and you blank out
- **Elderly parents** — kids manage parents' health remotely but have zero organized records
- **Emergency panic** — in a hospital emergency, no one can find blood group, allergies, or past surgery details
- **Generic AI advice** — existing health apps give cookie-cutter suggestions that don't know your medical history

**There is no simple, free, offline-first app** that lets an Indian family manage health records for every member in one place — with AI that actually knows your history.

---

## The Solution

**MediFamily** is a Progressive Web App (PWA) that turns your phone into a **digital health locker for your entire family** — with an AI doctor that gets smarter every day.

### How It Works

```
1. Add Family Members     →  Mom, Dad, Kids, Grandparents
2. Scan Prescriptions     →  Camera snap → AI extracts medicines, dosages, doctor name
3. Store Everything       →  Prescriptions, lab reports, vaccination records, bills
4. Ask AI Doctor          →  "Meri tabiyat kharab hai" → grounded advice from YOUR medical history
5. Get Reminders          →  "Dad's BP medicine at 8 AM" with adherence tracking
6. Share with Doctors     →  QR code → doctor sees full history (no login needed)
7. Emergency Card         →  Blood group, allergies, medicines — one tap
```

---

## Features

### Core Health Management

| Feature | Description |
|---------|-------------|
| **Family Profiles** | Unlimited family members with health details, allergies, chronic conditions |
| **AI Prescription Scanner** | Camera → Tesseract OCR (Hindi + English) → Gemini AI extraction |
| **Document Vault** | Store prescriptions, lab reports, vaccinations, bills, discharge summaries |
| **Medicine Reminders** | Daily reminders with push notifications + adherence tracking |
| **Health Timeline** | Chronological view of all medical events per member |
| **Vitals Tracker** | BP, blood sugar, weight, temperature, SpO2 with trend charts |
| **Appointments** | Schedule doctor visits with 3-hour advance notifications |
| **Emergency Card** | One-tap blood group, allergies, medicines, emergency contact + QR code |
| **Doctor Sharing (QR)** | Generate QR code — doctor sees full history in browser, no login needed |

### AI-Powered Features

| Feature | Description |
|---------|-------------|
| **AI Doctor** | Self-improving health assistant grounded in patient's actual medical history |
| **Medicine Info** | Identify any medicine — uses, side effects, dosage, interactions |
| **Lab Insights** | Upload lab reports → AI explains abnormal values in simple language |
| **Medicine Checker** | Check drug-drug interactions between any medicines |
| **Health Risk Assessment** | AI-powered risk scoring based on vitals, conditions, and lifestyle |

### Self-Improving AI System

The AI Doctor doesn't just answer questions — it **learns from mistakes and gets better over time:**

```
User asks question → AI responds → Safety Detector scans response
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │                                            │
              No violations                              Violation found
              (response sent)                                   │
                                          ┌─────────────────────┴────────────┐
                                          │                                  │
                                   Critical violation                 Non-critical
                                   (block response,                  (flag + queue)
                                    show safety msg)                       │
                                          │                    Rule Writer drafts fix
                                          │                          │
                                   Queue rule candidate    ┌─────────┴──────────┐
                                          │                │                    │
                                          │         Auto-approvable      Needs review
                                          │         (NEVER/ALWAYS)       (admin UI)
                                          │              │                    │
                                          │         Live in 60s       /admin/rules
                                          └──────────────┴────────────────────┘
```

- **30 seed safety rules** curated for Indian medical context
- **Safety Detector** catches allergy violations, pregnancy-unsafe drugs, pediatric aspirin, non-OTC suggestions, ignored red-flags — pure JS, <5ms, no LLM call
- **Rule Writer** (meta-LLM) drafts one specific rule from each bad answer
- **Auto-approve** lane for rules that strictly tighten safety (NEVER/ALWAYS-warn)
- **Admin review** at `/admin/rules` for everything else
- **Patient Brief** built from actual records — medicines, vitals, visits, contraindications — so the AI references YOUR data, not generic advice

### Platform Features

| Feature | Description |
|---------|-------------|
| **Offline-First** | Everything works without internet (IndexedDB via Dexie.js) |
| **Cloud Sync** | Auto-syncs to Supabase PostgreSQL when online |
| **PIN Lock** | 4-digit PIN with auto-lock after 5 min inactivity |
| **Bilingual** | English + Hindi (Hinglish AI responses) |
| **PWA** | Install on any device — works like a native app |
| **Export** | Download all records as JSON or PDF |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 (strict) |
| **Styling** | Tailwind CSS v4 + shadcn/ui (OKLCH theme) |
| **State** | Zustand 5 (persisted to localStorage) |
| **Local DB** | Dexie.js 4 (IndexedDB) — offline-first |
| **Cloud DB** | Supabase PostgreSQL + Prisma 6 ORM |
| **Auth** | Supabase Auth (email/password + email verify) |
| **AI** | Google Gemini (multi-key rotation, model fallback, JSON mode) |
| **OCR** | Tesseract.js 7 (English + Hindi) |
| **Forms** | React Hook Form + Zod |
| **Notifications** | Web Push API + Service Worker |
| **Icons** | Lucide React |
| **Deployment** | Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/                 # Login, email verify, onboarding
│   ├── (app)/                  # Authenticated app (bottom nav, PIN lock)
│   │   ├── home/               # Dashboard
│   │   ├── family/             # Family members CRUD + edit/emergency/share
│   │   ├── records/            # Health records CRUD
│   │   ├── scan/               # AI prescription scanner pipeline
│   │   ├── reminders/          # Medicine reminders + adherence
│   │   ├── ai-doctor/          # AI health assistant chat
│   │   ├── appointments/       # Doctor visit scheduling
│   │   ├── emergency-card/     # Emergency health card + QR
│   │   ├── vitals/             # BP, sugar, weight, temp, SpO2 tracking
│   │   ├── timeline/           # Health timeline view
│   │   ├── medicine/           # Medicine info lookup
│   │   ├── medicine-checker/   # Drug interaction checker
│   │   ├── lab-insights/       # Lab report AI analysis
│   │   ├── health-risk/        # AI risk assessment
│   │   ├── smart-records/      # Health overview dashboard
│   │   ├── admin/              # Admin: rule management
│   │   └── more/               # Settings, export, feedback, sharing
│   ├── api/
│   │   ├── ai-doctor/          # AI doctor with self-improving rules
│   │   ├── extract/            # Prescription extraction
│   │   ├── sync/               # Batched Dexie ↔ Supabase sync
│   │   ├── admin/rules/        # Admin: approve/reject/edit rules
│   │   ├── feedback/           # User feedback + AI message signals
│   │   └── ...                 # Share, family, members, etc.
│   └── share/[token]/          # Public doctor view (SSR, no auth)
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── layout/                 # Bottom nav, header, offline indicator, PIN lock
│   ├── family/                 # Member card, form, selector
│   ├── records/                # Record card, form, timeline
│   └── home/                   # Global search, notification center, weekly summary
├── lib/
│   ├── ai/
│   │   ├── gemini.ts           # Multi-key Gemini caller with model fallback
│   │   ├── medical/            # Self-improving AI system
│   │   │   ├── brief.ts        # Patient medical brief builder (client-side)
│   │   │   ├── rules-server.ts # Live rules loader (DB + 60s cache)
│   │   │   ├── safety-detector.ts  # Post-response safety scan (<5ms)
│   │   │   ├── rule-writer.ts  # Meta-LLM rule drafter
│   │   │   └── reference/      # OTC drugs, allergy map, red-flags, etc.
│   │   └── extract-prescription.ts
│   ├── db/                     # Dexie schema, sync engine, migrations
│   ├── supabase/               # Supabase client
│   ├── auth/                   # PIN auth, JWT, admin gate
│   ├── i18n/                   # English + Hindi translations
│   └── notifications/          # Web push helpers
├── stores/                     # Zustand: auth, settings, family
├── hooks/                      # useMembers, useRecords, useSync, etc.
└── constants/                  # Config, labels, limits
```

---

## Quick Start

```bash
git clone https://github.com/Mrsandeep27/MEDIFAMILY.git
cd MEDIFAMILY
npm install
npm run dev        # starts on localhost:3000 (Turbopack)
```

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
DATABASE_URL=your_pooled_connection_string
DIRECT_URL=your_direct_connection_string
JWT_SECRET=your_jwt_secret
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_AI_API_KEY=your_gemini_api_key
ADMIN_EMAILS=your_email@example.com
```

Supports up to 11 Gemini API keys for rotation (`GOOGLE_AI_API_KEY`, `GOOGLE_AI_API_KEY_2` through `_11`).

### Build

```bash
npm run build      # prisma generate && next build
npm run test       # vitest
npm run typecheck  # tsc --noEmit
```

---

## AI Doctor — How It Works

The AI Doctor is a self-improving medical assistant. Here's the full pipeline for every request:

1. **Patient Brief** (client): Dexie reads → builds ~300-500 token snapshot of active medicines, recent vitals, recent visits, computed contraindications from allergy/pregnancy checks
2. **Live Rules** (server): 30+ curated safety rules loaded from Supabase with 60s cache, injected into Gemini's `systemInstruction`
3. **Gemini Call**: `gemini-2.5-flash-lite` with JSON mode, ~800 max output tokens, system instruction cached across turns
4. **Safety Detector** (server): pure-JS scan catches allergy violations, pregnancy-unsafe drugs, pediatric aspirin, non-OTC suggestions, red-flag symptoms with low urgency. **Critical violations block the response.**
5. **Rule Queue**: violations auto-queue a `rule_candidate`. A meta-LLM call drafts a proposed rule. Auto-approvable rules (strict safety tightening) deploy within 60s. Everything else goes to admin review at `/admin/rules`.

### Safety Layers

| Layer | What it catches | Speed |
|-------|----------------|-------|
| **Seed Rules** (systemInstruction) | General medical safety — no prescription drugs, allergy checks, age thresholds, red-flag escalation | 0ms (cached) |
| **Patient Brief** (contraindications) | Per-patient "DO NOT suggest X" based on allergies + pregnancy | 0ms (pre-computed) |
| **Safety Detector** (post-response) | Allergy conflicts, pregnancy-unsafe drugs, pediatric aspirin, non-OTC, missed red-flags | <5ms |
| **Admin Review** (human-in-the-loop) | Edge cases the automated layers miss | ~20s per rule |

---

## Target Users

| Segment | Pain Point |
|---------|------------|
| **Young professionals (25-35)** | Managing parents' health remotely |
| **Parents with young kids** | Tracking vaccines, pediatric visits, growth |
| **Elderly care** | Multiple doctors, 5+ daily medicines, frequent tests |
| **Chronic patients** | Long-term medication tracking and lab monitoring |

---

## Competitive Advantage

| Feature | MediFamily | Practo | Google Health | Others |
|---------|-----------|--------|--------------|--------|
| Family-centric | Yes | No | No | No |
| AI Doctor (grounded in YOUR records) | Yes | No | No | No |
| Self-improving safety system | Yes | No | No | No |
| AI prescription scan (Hindi+English) | Yes | No | No | Basic OCR |
| Offline-first | Yes | No | No | Some |
| QR sharing (no login needed) | Yes | No | No | No |
| India-focused (Hinglish, OTC drugs, KIRAN helpline) | Yes | Partial | No | No |
| Free & Open Source | Yes | Paid | Discontinued | Ads-heavy |

---

## Admin Panel

Access at `/admin/rules` (requires email in `ADMIN_EMAILS` env var):

- **Pending Candidates**: Bad-answer signals from the safety detector + user thumbs-down, with conversation context and AI-drafted rule proposals
- **Active Rules**: All live rules injected into AI Doctor, with severity badges and one-click deactivate
- **Counters**: Pending / Approved / Rejected / Active at a glance

---

## License

MIT License — Open Source

---

**Built with care for every Indian family.**
