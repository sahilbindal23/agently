# Agently

Agently is a creator representation platform: a digital talent agency operating system for creator CRM, sponsorship valuation, deal workflow, contract protection, and Stripe-first payment control.

## Stack

- Next.js App Router, TypeScript, Tailwind, shadcn-style local components
- Supabase Postgres/Auth/Storage-ready schema with RLS starter policies
- Stripe checkout session flow for funded deal status, defaulting to INR for the India-first MVP
- OpenAI structured JSON endpoints with deterministic fallbacks when keys are missing

## Run Locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in Supabase, Stripe, and OpenAI keys when ready. The app runs with demo data and AI fallbacks before keys are configured.

## Mobile And Desktop Path

This MVP is built as a responsive web app first so the product logic, API routes, and Supabase model stay shared. For iOS and Android, wrap the Next app with Capacitor once auth, upload, and payment flows are stable. For desktop, use Tauri or Electron with the hosted app or a local shell. The same backend boundaries in `app/api`, `lib/ai`, `lib/stripe`, and `lib/supabase` can serve all clients.
