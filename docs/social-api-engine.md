# Social API Engine Foundation

Agently treats connected social accounts as a higher-trust signal than self-reported screenshots or profile fields.

## Current Prototype

- Creators can connect Instagram, Facebook, or YouTube from `/profile`.
- The app stores connected accounts in `connected_social_accounts`.
- The app stores metric pulls in `social_metric_snapshots`.
- The current sync is a deterministic mock API pull so the product workflow can be tested before Meta/Google OAuth approval.
- Campaign recommendations prefer synced metric confidence when snapshots exist.

## Production Providers

### Meta: Instagram and Facebook

Use Meta OAuth for Instagram professional accounts and Facebook pages. Useful permissions include:

- `instagram_basic`
- `instagram_manage_insights`
- `pages_read_engagement`
- `read_insights`

Target metrics:

- followers
- reach
- impressions
- engagement
- audience top cities/countries when available

### Google: YouTube

Use Google OAuth, not service accounts, for creator-owned YouTube channels.

Useful scopes:

- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/yt-analytics.readonly`

Target metrics:

- views
- subscribers
- likes/comments/shares
- country reports
- viewer demographic reports where available

## Trust Hierarchy

1. Provider API snapshots
2. Agently transaction outcomes
3. Public profile and portfolio review
4. Self-reported profile fields

Self-reported data should help with context, not inflate core scores.
