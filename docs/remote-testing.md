# Remote Tester Deployment

Use Vercel for friend testing. Local tunnels are fine for quick demos, but they are slow and fragile for multi-person workflow testing.

## 1. Before deploying

Run the latest Supabase migrations in the SQL editor:

- `017_verification_layer.sql`
- `018_verification_tiers.sql`
- `019_match_explainability.sql`

Keep `.env.local` private. Never send it to testers.

## 2. Deploy with Vercel

1. Push the `agently` project to GitHub.
2. Go to Vercel and import the GitHub repo.
3. Select the `agently` folder as the project root if Vercel asks.
4. Framework preset should be `Next.js`.
5. Add the environment variables from `.env.example`.

Required for the prototype:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=https://your-vercel-url.vercel.app
```

Optional but useful:

```txt
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
```

If OpenAI or Stripe keys are missing, the prototype should still run with fallback/stubbed behavior.

## 3. Supabase auth settings

In Supabase:

1. Go to Authentication settings.
2. Set Site URL to the Vercel URL.
3. Add the Vercel URL to allowed redirect URLs.

Example:

```txt
https://your-vercel-url.vercel.app
```

## 4. Tester logins

Use the demo accounts already created in Supabase Auth:

```txt
admin@agently.demo / DemoPassword123!
brand@agently.demo / DemoPassword123!
creator@agently.demo / DemoPassword123!
freelancer@agently.demo / DemoPassword123!
```

## 5. What to ask testers to try

- Brand: create a campaign, review creator/freelancer recommendations, shortlist talent, create offers/projects.
- Creator: review offers, inspect contract/payment status, submit deliverable.
- Freelancer: review projects, submit deliverable, inspect payment status.
- Admin: review activity center, verification queue, contracts, deliverables, payouts, and tester feedback.

## 6. Notes

For real public launch, do not rely on service-role-powered API routes as broad admin helpers. For this prototype, it is acceptable because speed matters, but before production the app should tighten role checks, RLS coverage, and audit logging.
