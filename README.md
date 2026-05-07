# Optified

Premium health optimization and longevity platform.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS with custom Optified design system (navy/Manrope)
- **Components:** shadcn/ui-compatible primitives, custom-themed to brand
- **Auth + DB:** Supabase (Phase 2)
- **Email:** Resend for transactional (Phase 3)
- **Hosting:** Vercel

## Phase Roadmap

This repo is being built in six sequenced phases:

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Foundation: Next.js scaffold, design system, layout shells, route stubs | ✅ Complete |
| 2A | Database: migrations, RLS, seed, CLI workflow | ✅ Complete |
| 2B | Auth wiring: Supabase clients, middleware, role gates, repositories | ✅ Complete |
| 3 | Email + invite system: Resend, invite flow, password setup | ✅ Complete |
| 4A | Overview + Biomarkers tabs, sham wearable data seeder, Recharts | ✅ Complete |
| 4B | Program, Functional Metrics, Supplement Adherence | ✅ Complete |
| 4C | Education, Coach Notes, Tools calculators | ✅ Complete |
| 5A | Coach dashboard core: Pipeline, client detail, coach notes write flow | ✅ Complete |
| 5B | Outcomes, Alerts, Operations + View-as-Client impersonation | ✅ Complete |
| 6A | Admin CRUD: Programs (read-only), Education (CRUD), Supplements (CRUD) | ✅ Complete |
| 6B | Audit log viewer + polish + deploy prep | ✅ Complete |

**All phases complete.** For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Setup

### Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)
- Supabase CLI: `brew install supabase/tap/supabase`
- npm (lockfile is npm)

### First-time setup

```bash
npm install
supabase start                      # spins up local Postgres, Auth, Storage, Studio
cp .env.example .env.local          # fill in local Supabase keys printed by `supabase start`
```

Before running the app, create the three demo auth users per the instructions in `supabase/migrations/README.md`. Once those exist, run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`, sign in with one of the demo accounts, and land in the dashboard appropriate for that role.

**Temporary note on signup:** `supabase/config.toml` has `enable_signup = false` because beta is invite-only. To create demo users locally, either:

- Use Studio at `http://localhost:54323` → Authentication → Add user, or
- Temporarily set `enable_signup = true`, create accounts via `supabase.auth.signUp()`, then set it back

Phase 3 will wire the proper admin-driven invite flow, after which neither workaround is needed.

## Project Structure

```
app/
  (public)/             Public routes (login, signup, reset-password)
  (client)/dashboard/   Client-facing routes (role-gated Phase 2)
  (coach)/coach/        Coach-facing routes
  (admin)/admin/        Admin console
  api/                  Route handlers (Phase 2+)
  layout.tsx            Root layout (loads Manrope, applies dark theme)
  globals.css           Tailwind + shadcn HSL tokens mapped to brand navy
  page.tsx              Root — redirects to /login

components/
  ui/                   Low-level primitives (Button, Card, Input, etc.)
  layout/               Shell, logo, page header, in-development notice
  domain/               (Phase 4+) Optified-specific composite components

lib/
  utils/cn.ts           Tailwind class merge helper
  supabase/             (Phase 2) Server/client Supabase factories
  repositories/         (Phase 2) Data access layer — PHI migration boundary
  types/                (Phase 2) Shared TypeScript types
  validation/           (Phase 3) Zod schemas

supabase/
  migrations/           (Phase 2) SQL migration files
```

## Design System

The design system overrides shadcn defaults with a premium navy aesthetic.

**Colors:** `tailwind.config.ts` defines the full navy palette (`navy.50`–`navy.950`) with `navy.600` (#192C4C) as the brand primary. Brand grayscale (`cloud`, `smoke`, `steel`, `space`, `graphite`, `arsenic`, `phantom`) is available as direct utility classes. Semantic shadcn tokens (`primary`, `card`, `muted`, etc.) are mapped via HSL variables in `app/globals.css`.

**Typography:** Manrope loaded via `next/font/google`. Custom type scale defined in Tailwind config: `text-display-lg`, `text-display`, `text-h1`–`text-h3`, `text-body-lg`, `text-body`, `text-caption`, `text-overline`.

**Aesthetic:** dark-first (luxury), generous whitespace, subtle radial gradient on the html background, refined shadows (`shadow-elevation-1` through `shadow-elevation-3`, plus `shadow-glow-success`). Focus rings use the success green, not default blue.

## Architecture Principles

1. **PHI separation from day one.** All data access flows through `lib/repositories/`. Today every repository hits Supabase. When PHI-grade infrastructure lands, only PHI-related repository files change — no UI, route handler, or component code is touched.

2. **Role-gated route groups.** `(client)`, `(coach)`, `(admin)` each have their own layout with role-appropriate navigation. Phase 2 will add server-side role enforcement in each group's `layout.tsx`.

3. **Repository pattern, not direct Supabase calls in components.** Centralized validation, audit logging, and data contracts. Easier testing and future migration.

4. **Default-deny RLS.** Phase 2 will implement RLS policies on every table. No table will ever be `SELECT *`-able without explicit policy.

5. **Audit logging from day one.** The `audit_log` table exists in Phase 2 migrations. Cheap to add now, painful to backfill later.

## Commands

```bash
npm run dev         # Start dev server
npm run build       # Production build
npm run start       # Run production build
npm run lint        # ESLint
npm run typecheck   # TypeScript check
```

## Email Architecture

Optified uses two separate email systems that never overlap:

### Google Workspace — human email

- Business mailboxes: `david@optified.com`, etc.
- Human-to-human communication (replies to clients, internal team)
- Reachable via Gmail web, mobile apps, IMAP/SMTP clients
- **No code in this repo touches Google Workspace.** It's purely the inbox product.

### Resend — transactional email

- Application-generated emails sent from fixed addresses on `optified.com`
- Invitations (`accounts@`), password resets (`accounts@`), welcome emails (`accounts@`), future notifications (`noreply@`)
- Sent programmatically via the Resend REST API
- Humans never log in to these inboxes — they're send-only

### DNS setup (one-time, required before emails will deliver)

Resend needs DNS records on `optified.com` to prove you own the domain:

1. In Resend dashboard, add `optified.com` as a domain
2. Copy the SPF, DKIM, and DMARC records Resend provides
3. Add them to your DNS provider alongside the MX records that route incoming mail to Google Workspace
4. Wait for Resend to verify (usually minutes)

**SPF co-existence with Google Workspace:** your SPF record must list both Google and Resend, e.g.:
```
v=spf1 include:_spf.google.com include:amazonses.com ~all
```
(Resend sends via AWS SES on the backend, hence the `amazonses.com` include.)

The MX records stay pointed at Google Workspace. Inbound mail to `accounts@optified.com` still goes to Google; outbound mail from `accounts@optified.com` goes via Resend. These two directions are independent.

### Testing email locally

`supabase start` includes Inbucket — a local SMTP server that captures emails without sending them. By default our code sends via Resend's REST API (not SMTP), so it bypasses Inbucket and will fail locally if `RESEND_API_KEY` is unset.

For local development, either:
- Set a Resend API key in `.env.local` and send real emails to real addresses you own, or
- Set `RESEND_API_KEY=` (empty) and comment-out the send calls you're testing

Phase 6 will add a proper "dev mail" mode that routes to Inbucket when `NODE_ENV=development` and no Resend key is present.

### Swapping providers later

All email code depends on the `EmailProvider` interface in `lib/email/types.ts`. To swap Resend for Postmark, SES, SendGrid, or anything else: write a new provider implementation, update `lib/email/provider.ts` to instantiate it, and every call site continues working unchanged.

## Notes

- The site is set to `noindex, nofollow` in `app/layout.tsx` metadata during beta. Remove when launching publicly.
- shadcn/ui primitives in `components/ui/` are written directly (not via `npx shadcn-ui`) because they're tuned to the brand out of the gate. You can still add more shadcn components with the CLI later — they'll inherit the HSL variables automatically.
- No state management library. React Query will be added in Phase 2 for server state. Form state uses `react-hook-form` (added Phase 3).
