# MediLog — CLAUDE.md

-Codex will review your output once you are done
-cursor will review your output once you are done
## What is this?

MediLog is an offline-first, AI-powered family health record manager PWA for Indian families. Built with Next.js 16, it works without internet using Dexie.js (IndexedDB) and syncs to Supabase PostgreSQL when online.

**Live:** https://medi--log.vercel.app
**Repo:** https://github.com/Mrsandeep27/MEDILOG

---

## Quick Start

```bash
npm install
npm run dev        # starts on localhost:3000 (Turbopack)
npm run build      # prisma generate && next build
npm run test       # vitest
npm run typecheck  # tsc --noEmit
```

**Required env vars** (in `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
JWT_SECRET=
GOOGLE_AI_API_KEY=        # Gemini — up to 11 rotation keys (_2 through _11)
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| UI | Tailwind CSS v4 + shadcn/ui (OKLCH theme) |
| Local DB | Dexie.js 4 (IndexedDB) |
| Cloud DB | Supabase PostgreSQL + Prisma 6 |
| Auth | Supabase Auth (email/password + email verify) |
| State | Zustand 5 (persisted to localStorage) |
| Forms | React Hook Form + Zod 4 |
| AI | Google Gemini (multi-key rotation, model fallback) |
| OCR | Tesseract.js 7 (English + Hindi) |
| Icons | Lucide React |
| Toasts | Sonner |
| Tests | Vitest + Testing Library |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Root redirect → /login or /home or /onboarding
│   ├── layout.tsx                  # Root layout (PWA meta, fonts, SW registration)
│   ├── globals.css                 # Tailwind v4 + shadcn theme
│   ├── (auth)/                     # Public auth pages (centered card layout)
│   │   ├── login/                  # Email + password sign in/up
│   │   ├── onboarding/             # Create self member (first-time setup)
│   │   └── verify/                 # Redirect stub
│   ├── (app)/                      # Protected pages (bottom nav, PIN lock, error boundary)
│   │   ├── layout.tsx              # Auth guard — checks Supabase session
│   │   ├── home/                   # Dashboard
│   │   ├── family/                 # Members list, add, [memberId]/{edit,emergency,share,insights}
│   │   ├── records/                # Records list, add, [recordId]/{edit}
│   │   ├── scan/                   # AI prescription scanner pipeline
│   │   ├── reminders/              # Medicine reminders + adherence
│   │   ├── more/                   # Settings, export, shared-links, feedback
│   │   └── symptom-tracker/        # Daily mood/symptom tracking
│   ├── share/[token]/              # Public doctor view (no auth, SSR)
│   ├── auth/callback/              # Supabase email verify callback
│   └── api/                        # API routes (see below)
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── layout/                     # bottom-nav, app-header, offline-indicator, pin-lock
│   ├── family/                     # member-card, member-form, member-avatar, tag-input
│   ├── records/                    # record-card, record-form, record-timeline
│   ├── common/                     # empty-state, loading-spinner
│   └── pwa/                        # install-button
├── hooks/                          # All data hooks (see below)
├── stores/                         # Zustand stores (auth, settings, family)
├── lib/
│   ├── db/                         # dexie.ts, schema.ts, sync.ts, prisma.ts
│   ├── supabase/                   # client.ts (browser client)
│   ├── auth/                       # jwt.ts, pin.ts
│   ├── ai/                         # gemini.ts, extract-prescription.ts
│   ├── ocr/                        # tesseract.ts
│   ├── i18n/                       # translations.ts, use-locale.ts
│   ├── export/                     # export-data.ts (JSON + CSV)
│   └── notifications/              # web-push.ts
└── constants/
    └── config.ts                   # PIN_LENGTH, SYNC_INTERVAL, limits, etc.
```

---

## Auth Flow

Simple and linear:

```
/login → Sign Up → Supabase sends verify email
                  → User clicks link → /auth/callback → /onboarding
       → Sign In → /home (or /onboarding if first time)

/onboarding → Fill profile (MemberForm) → /home

/ (root) → Checks Supabase session → redirects to /login, /onboarding, or /home
```

- **Auth store** (`src/stores/auth-store.ts`): Zustand with persist. Stores `user`, `isAuthenticated`, `hasCompletedOnboarding`.
- **Auth hook** (`src/hooks/use-auth.ts`): Subscribes to `onAuthStateChange`, provides `signOut`.
- **Auth guard** (`src/app/(app)/layout.tsx`): Checks Supabase session on mount, redirects if none.
- **Redirects use `window.location.replace()`** — not `router.replace()` — for reliability.

---

## Database Architecture

### Local (Dexie.js — IndexedDB)

8 tables, all with sync metadata (`sync_status`, `synced_at`, `is_deleted`, `updated_at`):

| Table | Key Fields |
|-------|-----------|
| `members` | id, user_id, name, relation, blood_group, allergies[], chronic_conditions[] |
| `records` | id, member_id, type, title, doctor_name, visit_date, image_urls[], local_image_blobs[] |
| `medicines` | id, record_id, member_id, name, dosage, frequency, is_active |
| `reminders` | id, medicine_id, member_id, time, days[], is_active |
| `reminderLogs` | id, reminder_id, scheduled_at, status (taken/missed/skipped) |
| `shareLinks` | id, member_id, token, expires_at, is_active |
| `shareAccessLogs` | id, share_link_id, accessed_at |
| `healthMetrics` | id, member_id, type (bp/sugar/weight/temp/spo2), value (JSON) |

### Sync (`src/lib/db/sync.ts`)

- **Push:** Single POST `/api/sync` with all pending items batched
- **Pull:** Single GET `/api/sync?tables=...` with per-table timestamps
- **Conflict resolution:** Newer `updated_at` wins
- **Auto-sync:** 30-min interval via `useSync` hook
- **Soft deletes:** `is_deleted` flag, never hard-delete

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/extract` | POST | Gemini prescription extraction |
| `/api/ai-doctor` | POST | AI doctor chat |
| `/api/lab-insights` | POST | Lab report analysis |
| `/api/medicine-info` | POST | Medicine identification |
| `/api/sync` | POST/GET | Batched Dexie ↔ Supabase sync |
| `/api/share/[token]` | GET | Public share link data |
| `/api/family` | CRUD | Family group management |
| `/api/feedback` | POST | User feedback |
| `/api/abha` | POST | ABHA health ID integration |
| `/api/admin` | GET/POST | Admin dashboard |
| `/auth/callback` | GET | Supabase email verify callback |

---

## Hooks Reference

| Hook | File | Purpose |
|------|------|---------|
| `useAuth` | use-auth.ts | Supabase auth listener + signOut |
| `useMembers` | use-members.ts | Family CRUD (Dexie) |
| `useRecords` | use-records.ts | Records CRUD + image compression |
| `useMedicines` | use-medicines.ts | Medicines CRUD |
| `useReminders` | use-reminders.ts | Reminders + adherence logging |
| `useHealthMetrics` | use-health-metrics.ts | BP, sugar, weight, temp, SpO2 |
| `useShareLinks` | use-share-links.ts | Share link CRUD + token generation |
| `useSync` | use-sync.ts | Auto-sync controller (30-min interval) |
| `useCamera` | use-camera.ts | MediaDevices API (start, stop, capture) |
| `useOnline` | use-online.ts | Online/offline detection |

All data hooks use Dexie's `useLiveQuery` for reactive local-first queries.

---

## AI Integration

**Gemini API** (`src/lib/ai/gemini.ts`):
- Up to 11 API keys with automatic rotation
- Model fallback chain for reliability
- Usage logging (fire-and-forget to DB)
- `parseJsonResponse()` extracts JSON from markdown code blocks

**Prescription Scanner** (`src/app/api/extract/route.ts`):
- Camera/upload → Tesseract OCR (eng+hin) → Gemini extraction → review → save
- Extracts: medicine name, dosage, frequency, duration, before_food
- Supports Hindi/Hinglish prescriptions

---

## Conventions

**Imports:** Absolute with `@/` alias. Group: React/Next → `@/` internal → external libs.

**Components:** Functional + TypeScript. `"use client"` at top of client components. Props interface above component.

**Naming:**
- Components: `PascalCase` (MemberCard, RecordForm)
- Hooks: `camelCase` with `use` prefix (useMembers, useSync)
- Types: `PascalCase` (Member, RecordFormData)
- Constants: `UPPER_SNAKE_CASE` (PIN_LENGTH, SYNC_INTERVAL_MS)

**State:** Zustand for global state. Dexie live queries for data. React Hook Form + Zod for forms.

**Errors:** Try-catch → sonner toast for user feedback. Error boundary in app layout. `console.error` for server logs.

**Images:** Compressed to max 500KB. Stored as blobs in Dexie. Max 10 per record. Blob URLs created on-demand, auto-revoked on unmount.

**Validation:** Zod schemas in `src/lib/utils/validators.ts`. All forms use `zodResolver`.

---

## Key Constants (`src/constants/config.ts`)

```
PIN_LENGTH = 4
PIN_LOCK_TIMEOUT_MS = 300000 (5 min)
SYNC_INTERVAL_MS = 1800000 (30 min)
MAX_IMAGE_SIZE_KB = 500
MAX_IMAGES_PER_RECORD = 10
SHARE_LINK_DEFAULT_HOURS = 24
QUIET_HOURS = 22:00 – 07:00
```

**Record types:** prescription, lab_report, vaccination, bill, discharge_summary, other
**Relations:** self, spouse, father, mother, son, daughter, grandfather, grandmother, brother, sister, other
**Blood groups:** A+, A-, B+, B-, AB+, AB-, O+, O-

---

## Things to Know

- **Offline-first:** Every feature works without internet. Sync happens when online.
- **No middleware.ts:** All auth is client-side (Supabase session checks).
- **Service worker** (`public/sw.js`): Network-first, skips caching on localhost, cache v3.
- **PWA manifest** (`public/manifest.json`): `start_url: /home`, standalone display.
- **Symptom tracker** uses localStorage (not Dexie) — intentionally local-only.
- **Prisma** generates on build (`postinstall` + `build` scripts).
- **Tailwind v4** — CSS-based config in `globals.css`, not `tailwind.config.ts`.
