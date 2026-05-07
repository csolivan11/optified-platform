# Deploying Optified to Production

Complete runbook for taking the app from local development to a live
production environment on Vercel + Supabase.

This guide assumes you've successfully run the app locally end-to-end
following the main README. If you haven't, do that first.

---

## Overview

Production architecture:

```
[User browser] → [Vercel Edge/Next.js] → [Supabase Postgres + Auth]
                          ↓
                       [Resend]
                   (transactional email)
```

All infrastructure is managed (no servers to run). Costs at launch:
Vercel Hobby free, Supabase Free tier, Resend Free tier (3K emails/mo).
Upgrade paths are all pay-as-you-go.

---

## 1. Supabase production project

### Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Name: `optified-prod` (or similar)
3. Database password: generate a strong one, **save it in 1Password** — you'll need it for migrations
4. Region: pick the one closest to your users (US East for most US traffic)
5. Pricing: Free tier is fine for beta; upgrade to Pro ($25/mo) when you need daily backups

### Apply migrations

From your local checkout:

```bash
# Link your local project to the remote one
supabase link --project-ref <your-project-ref>

# Push all migrations to production
supabase db push
```

**Do not run `supabase db reset` against production.** Ever. That command
wipes the database. The `db push` command applies pending migrations only.

### Configure auth

In the Supabase dashboard:

- **Authentication → URL Configuration**
  - Site URL: `https://optified.com` (or your actual domain)
  - Redirect URLs: add `https://optified.com/**` to allowed list
- **Authentication → Email Templates**: leave as defaults for now. Our app
  sends its own templated emails via Resend for invites and password
  resets. Supabase's built-in emails are only used for passwordless magic
  links, which we don't currently use.
- **Authentication → Providers → Email**: make sure "Confirm email" is
  enabled. This prevents sign-ups with addresses the user doesn't own.

### Create the first admin

Because self-signup is not enabled (invites only), you need to manually
create the first admin user to bootstrap the system:

1. **Authentication → Users → Add user** in the Supabase dashboard
2. Email: your admin email. Mark "Auto confirm user" so you can sign in
   immediately without an email confirmation.
3. Note the generated user ID.
4. Open the SQL editor and run:

```sql
update public.profiles
set role = 'admin',
    first_name = 'Your',
    last_name = 'Name'
where id = '<paste-user-id>';
```

That admin can now sign in, invite coaches, and invite the first clients.

### Capture credentials

From **Project Settings → API**, copy:

- `Project URL` → env var `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → env var `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` secret key → env var `SUPABASE_SERVICE_ROLE_KEY`

The service role key bypasses RLS. **Never expose it to the browser.** Our
code enforces this via `import "server-only"` guards on the service
client — don't remove those.

---

## 2. Resend production configuration

### Create the account

1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain (e.g. `optified.com`)
   - Resend provides DNS records (SPF, DKIM, DMARC) to add to your
     domain's DNS host
   - **Important:** if you use Google Workspace for human email, your
     existing SPF record must include BOTH providers:
     `v=spf1 include:_spf.google.com include:amazonses.com ~all`
   - DKIM records are provider-specific and can coexist

### Configure senders

Our app uses three sending addresses:

- `noreply@optified.com` — system notifications (invites, password resets)
- `accounts@optified.com` — account-related correspondence
- `coach@optified.com` — coach-to-client transactional messages

Add each as a verified sender in the Resend dashboard. You don't need
mailboxes on these addresses if you never receive replies at them; if
you want replies to go somewhere, configure forwarding in your domain's
email host (Google Workspace makes this easy via aliases).

### Get the API key

**API Keys → Create API Key**, scope it to "Sending access" only. Copy
the key for the next section.

---

## 3. Vercel deployment

### Import the repo

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Select the `optified` repo
3. Framework preset: **Next.js** (auto-detected)
4. Build settings: leave defaults. Our `next.config.js` is correctly
   configured for App Router.

### Environment variables

Add these to **Settings → Environment Variables** in the Vercel project
(copy from your `.env.example` for the complete list):

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase (§1) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase (§1) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase (§1) | Production, Preview, Development |
| `RESEND_API_KEY` | From Resend (§2) | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://optified.com` | Production |
| `NEXT_PUBLIC_APP_URL` | `https://<preview>.vercel.app` | Preview |
| `EMAIL_FROM_NOREPLY` | `noreply@optified.com` | Production, Preview |
| `EMAIL_FROM_ACCOUNTS` | `accounts@optified.com` | Production, Preview |
| `EMAIL_FROM_COACH` | `coach@optified.com` | Production, Preview |

Preview environments intentionally share the production Supabase. If
you'd rather isolate, create a second Supabase project and point Preview
env vars there — but then every PR preview starts from empty data.

### Custom domain

**Settings → Domains** → add `optified.com` (and `www.optified.com` as
redirect). Vercel will provide DNS records to add to your domain host.
SSL provisions automatically.

Once the domain is live, return to Supabase **Authentication → URL
Configuration** and update the Site URL to the live domain.

### Deploy

Push to `main`. Vercel auto-deploys. The first deploy takes ~2 minutes.
Subsequent deploys are cached and run in ~30 seconds.

---

## 4. Pre-launch checklist

Before sending the first real invite, verify each of these:

### Database

- [ ] `supabase db lint` returns no warnings from your local checkout
- [ ] All migrations are present in production (check with `supabase
      migration list --linked`)
- [ ] Row-Level Security is enabled on every public table (spot check:
      **Table Editor** in Supabase dashboard shows a lock icon next to
      each protected table)
- [ ] The `audit_log` immutability trigger is active:

  ```sql
  -- Run in Supabase SQL editor. Both should error.
  update audit_log set action = 'tampered' where id = (select id from audit_log limit 1);
  delete from audit_log where id = (select id from audit_log limit 1);
  ```

### Auth

- [ ] Sign in as your admin user on the live domain
- [ ] Create a test invitation, verify email arrives from the correct
      sender
- [ ] Accept the invite end-to-end, confirm password setup works
- [ ] Sign out and sign back in
- [ ] Test password reset flow

### Features

- [ ] Client dashboard loads with seed data (for the seeded test
      account)
- [ ] Coach pipeline shows all assigned clients
- [ ] Client detail page loads, posting a coach note works and appears
      immediately
- [ ] View-as-Client from `/admin/users` enters impersonation correctly,
      banner shows, exit button returns to admin
- [ ] Creating a coach note during impersonation is blocked with the
      correct error message (tests the `requireNotImpersonating` guard)
- [ ] Audit log viewer at `/admin/audit-log` shows the impersonation
      start/stop events from the previous step
- [ ] Creating an article in `/admin/education/new` works, markdown
      preview renders, published article appears in client education tab
- [ ] Adding a supplement in `/admin/supplements` works, inline edit
      persists, archive toggle works

### Performance

- [ ] Lighthouse score on `/dashboard` (signed in) ≥ 90 for Performance
      and Accessibility
- [ ] First Contentful Paint under 1.5s on 4G simulation
- [ ] No console errors on any primary route

### Operational

- [ ] `NEXT_PUBLIC_APP_URL` in Vercel matches the actual live domain
- [ ] Supabase project has daily backups enabled (requires Pro tier)
- [ ] You have a recovery plan if you lose access to your admin account
      (document the SQL to elevate another user to admin, kept somewhere
      you can reach without the app)

---

## 5. Post-launch operational notes

### Monitoring

For beta, Vercel's built-in analytics and Supabase's logs are enough. As
volume grows, wire up:

- **Sentry** (errors) — the `app/error.tsx` boundary has a TODO marker
  where to call `captureException`
- **Axiom** or **Logtail** (structured logs) — pipe Next.js logs via
  Vercel Integration
- **Supabase log drains** → your log aggregator (Pro tier)

### Database backups

Supabase Free tier has no backups. Before beta starts, upgrade to Pro
($25/mo) which gives you daily automated backups with 7-day retention.
Without this, a bad query or malicious actor could destroy client data
with no recovery path.

### Secrets rotation

Rotate every 90 days:

- `SUPABASE_SERVICE_ROLE_KEY` — regenerate in Supabase dashboard, update
  in Vercel
- `RESEND_API_KEY` — regenerate in Resend dashboard, update in Vercel

Add these to a calendar reminder.

### Migration workflow

Production changes flow one direction:

```
local change → migration file → PR → merge to main →
→ CI or manual `supabase db push` against production
```

Never modify the production schema directly in the Supabase dashboard.
Anything applied out-of-band makes subsequent migrations unpredictable.

### Incident response

If something goes wrong in production:

1. **Immediately:** revert the problematic commit in `main` → Vercel
   auto-deploys the previous version within a minute
2. **Then:** investigate the failure in a local branch, write a
   regression test, fix, migration if needed
3. **Finally:** re-deploy

The audit log at `/admin/audit-log` is your forensic tool — filter by
the time window of the incident to see exactly what was happening.

---

## 6. Questions you should be able to answer

Before accepting a single real user, be able to answer yes to all of:

- Can I find out which coach last edited any specific client's protocol?
  (Audit log with target_client_id filter)
- Can I lock out a compromised admin account?
  (Supabase dashboard → Authentication → Users → disable user)
- Can I recover from "I accidentally deleted the wrong supplement"?
  (PITR or the archive pattern — supplements soft-delete, they don't
  hard-delete)
- Can I prove to a client that no one viewed their records without
  authorization? (RLS + audit log queries)
- Can I swap the underlying database for local testing without affecting
  production? (Yes — `.env.local` vs production env vars)

If any of these feels uncertain, fix that before launch.
