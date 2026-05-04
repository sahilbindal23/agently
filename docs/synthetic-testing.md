# Synthetic Testing

Agently has Playwright-based synthetic tester agents for the core prototype workflows. They are not a replacement for humans, but they catch broken links, auth regressions, role leakage, privacy mistakes, runtime overlays, and workflow bugs before testers spend time on the site.

## Run Locally

Start the app or let Playwright start it:

```bash
npm run test:e2e
```

For visible browser testing:

```bash
npm run test:e2e:headed
```

Then generate the feedback report:

```bash
npm run test:e2e:report
```

The report is written to:

```text
test-results/e2e-feedback-report.md
```

Paste that report back into Codex when something fails.

## Run Against Vercel

Use your deployed URL:

```bash
$env:AGENTLY_BASE_URL="https://your-vercel-url.vercel.app"
$env:AGENTLY_SKIP_WEBSERVER="1"
npm run test:e2e
npm run test:e2e:report
```

## Demo Accounts

The tests default to:

```text
admin@agently.demo / DemoPassword123!
brand@agently.demo / DemoPassword123!
creator@agently.demo / DemoPassword123!
freelancer@agently.demo / DemoPassword123!
```

You can override them with environment variables:

```text
AGENTLY_ADMIN_EMAIL
AGENTLY_ADMIN_PASSWORD
AGENTLY_BRAND_EMAIL
AGENTLY_BRAND_PASSWORD
AGENTLY_CREATOR_EMAIL
AGENTLY_CREATOR_PASSWORD
AGENTLY_FREELANCER_EMAIL
AGENTLY_FREELANCER_PASSWORD
```

## Current Coverage

- logged-out visitor can reach homepage, login, and signup
- brand can inspect discovery, campaigns, offers, messages, activity, and insights
- creator can inspect home, full profile, offers, AI tools, and payments
- freelancer can inspect home, offers, messages, activity, and payments
- admin can inspect operating views
- public brand profiles do not expose private offer/project amounts
- brand Activity Center does not duplicate campaign reminders
- profile visibility copy does not expose internal decision language
