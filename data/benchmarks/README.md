# India Creator Benchmarks - Seed Data

## TL;DR / Honesty Statement

This dataset was scaffolded by an LLM (Claude, model knowledge cutoff Jan 2026) **without live web access at generation time**. Every figure here should be treated as a **directionally-reasonable starting prior**, not verified ground truth. The structure is production-ready; the numbers are placeholders that need human verification before powering pricing or ROI decisions shown to real users.

Each row carries a `source` field that is one of:

- `training_data_recall` - I recall this range appearing in Qoruz / IMH / HypeAuditor / GroupM-INCA reports during training. Directionally reasonable, but the specific number and the URL should be re-verified.
- `estimated` - Interpolated from adjacent tiers/niches. Treat as placeholder.
- `verified` - Reserved for rows you replace with audited data.

If a row's `source_url` is the empty string, no public URL was confidently recalled - subscribe to a paid tool (below) to fill it in.

---

## What's in the file

`india-creator-benchmarks.json` contains six sections required by the brief:

| Section | Rows | Coverage |
|---|---|---|
| `rate_cards` | 51 | IG reel/post/story, YT long/short/integration, Twitter thread/post; 5 tiers x 12 niches (sparse - core cells filled, long tail estimated) |
| `engagement_benchmarks` | 19 | IG full tier ladder for fashion; spot-checks across other niches; YT and Twitter sampled |
| `cpm_benchmarks` | 13 | IG fashion full ladder; cross-niche spot rows; YT tech/finance/gaming |
| `conversion_assumptions` | 12 | One row per major niche covering CTR, conversion rate, AOV |
| `category_caveats` | 12 | One per niche - the qualitative knowledge a flat number can't capture |
| `industry_context` | 1 block | Market size, growth, platform share |

---

## What was hard to find / what's missing

1. **Twitter / X rates for India** - There is no canonical public source. Qoruz and HypeAuditor focus on IG/YT. All X rows are flagged `estimated`. **Recommendation:** crowdsource from 30-50 creators via a Google Form before launch.

2. **Tier-2/3 city differential** - India creator pricing varies 30-50% between metro and non-metro creators with the same follower count, but no public dataset segments this. Currently un-modeled.

3. **Regional-language premium/discount** - Tamil/Telugu/Marathi creators often command higher CPMs than English-equivalents in their states but lower nationally. Not captured.

4. **Barter / in-kind compensation** - Especially heavy in food (~40% of nano deals), travel (~60% of micro deals per anecdotal Qoruz commentary). Cash rates here understate total comp.

5. **Brand category x creator niche cross-tab** - A fashion creator promoting a fintech product prices differently than promoting apparel. The current schema is creator-niche only.

6. **Seasonality** - Diwali (Oct-Nov), IPL (Mar-May), and wedding season (Nov-Feb) move rates 20-50%. Not modeled.

7. **Story-frame bundling and usage rights** - Whitelisting/spark-ads rights typically add 30-100% to base rates; not yet captured as a separate field.

8. **Video performance metrics (VTR, average view duration)** - Critical for ROI but absent from the schema. Consider adding.

---

## Methodology

Because no live fetch was possible:

1. I drew on training-data recall of named industry reports (Qoruz, Influencer Marketing Hub, HypeAuditor State of Influencer Marketing India, GroupM-INCA, RedSeer, Kalaari "Crossing the Chasm", ET BrandEquity, exchange4media).
2. For each cell I picked a low/median/high range consistent with multiple recalled report references rather than a single point estimate.
3. Where two sources disagreed in my training, I biased toward the tighter / more recent (2023-2024) Qoruz numbers since that is the most India-specific source.
4. CPMs were sanity-checked by dividing rate by an assumed reach (2-4x followers for IG reels, 30-50% of subscribers for YT long-form). If the implied CPM was outside INR 100-1000, I flagged it.
5. Caveats were written from qualitative patterns (e.g., the SEBI finfluencer rules, Byju's collapse impact on edtech rates) that quantitative tables miss.

**No URL was fabricated** in the sense of inventing a domain - all `source_url` values point to real publishers. But specific article slugs (e.g., `/blog/influencer-marketing-rates-india`) may not resolve; treat URLs as "the right place to look on that publisher's site," not as direct citations.

---

## Caveats about freshness and reliability

- **Cutoff is Jan 2026.** Rates have likely moved 5-15% since (typically up; finfluencer rates may have moved more after compliance shake-outs).
- **Rates compress in oversupplied niches** (fashion, lifestyle) - check Qoruz quarterly notes.
- **Mega-tier rates are bimodal** - Bollywood/cricket-adjacent creators sit 5-10x above content-native megas. The `high_inr` column captures this but the median may be misleading.
- **Engagement rates are dropping platform-wide** - IG ER fell ~20% YoY 2023-2024 per HypeAuditor. If your dataset is over a year old when read, discount ER by 10-15%.
- **AOV is the weakest field** - it varies more by brand than by niche. Use as a default that brands can override.

---

## What real-world data to obtain to improve each engine

### Rate calculator / valuation engine
- **Best fix:** Subscribe to **Qoruz** or **Modash** API and pull live rate cards for 2,000-5,000 Indian creators across the tier x niche grid. Cross-reference with **Kofluence** or **Plixxo** marketplace listed rates.
- **Cheap fix:** Run a Typeform survey on 200-500 creators in your existing Agently funnel asking last-3-deliverable rates (anonymized aggregate).
- **Add fields:** usage rights (organic / paid amplification / whitelisting), exclusivity period, content ownership.

### ROI calculator
- **Best fix:** Partner with 5-10 D2C brands (Mamaearth, boAt, Sugar Cosmetics tier) for anonymized last-90-day campaign data: spend, attributed orders, AOV, repeat rate. This dwarfs any public benchmark.
- **Add:** view-through and view-time-decay curves by platform; halo/brand-lift assumptions for awareness campaigns.

### Brand-creator match engine
- **Best fix:** Use **HypeAuditor** or **Modash** audience-quality and demographics data (gender split, age, top cities, fake-follower %) - this is what actually drives match quality, not the numbers in this file.
- **Add:** brand-safety scores, past-collab history, content-tone embeddings from recent posts.

### Negotiation copilot
- **Best fix:** Mine your own Agently chat history once you have 500+ deals closed. Train on actual ask-vs-close deltas. No public dataset will beat your own.
- **Until then:** use the `low_inr` / `high_inr` spread in `rate_cards` as the negotiation envelope and assume a typical close at ~85% of `high_inr` for hot creators, ~110% of `low_inr` for cold creators.

### Rate benchmarks page
- Show ranges, not point estimates. Display the `source` field. Let creators flag "my rate is higher than this" with proof - this becomes your moat dataset.

---

## Paid data sources worth subscribing to

| Source | What it gives you | Approx cost (2025) | Priority |
|---|---|---|---|
| **Qoruz** (qoruz.com) | India-first creator database with rate intelligence; 2M+ Indian creator profiles | INR 50k-2L/yr | **Highest - India specific** |
| **Modash** (modash.io) | 250M+ global creator profiles, audience demographics, fake-follower detection; strong India coverage | USD 200-500/mo | High |
| **HypeAuditor** | Audience quality scores, brand-affinity, India-segmented reports | USD 400-2000/mo | High - for match engine |
| **Klear / Meltwater** | Enterprise-grade creator + earned-media analytics | INR 5-15L/yr | Medium - only at scale |
| **GroupM-INCA reports** | Published periodically; market-sizing not creator-level data | Free (published) | Low - read once, not subscribe |
| **RedSeer Consulting** | Custom India creator-economy reports | INR 5-25L per report | Medium - one-off purchase |
| **Statista India** | Aggregate market data; weak on creator-level | INR 30-60k/yr | Low |
| **Tagger / Sprout Influencer** (recently merged) | Global tool, weaker India depth | USD 1000+/mo | Skip until international expansion |

**Free sources to monitor weekly:**
- ET BrandEquity (brandequity.economictimes.indiatimes.com) - real campaign budgets reported in trade press
- exchange4media (exchange4media.com) - same
- afaqs! (afaqs.com) - case studies
- Influencer.in and Plixxo blog posts - marketplace rate disclosures

---

## How to evolve this file

1. Replace `training_data_recall` with `verified` as you confirm each row.
2. Add a `last_verified_on` field per row as you go.
3. When Qoruz/Modash data arrives, generate this file programmatically from their API rather than maintaining by hand.
4. Add a `confidence` field (0-1) so the rate calculator can widen its CI when the underlying data is weak.
5. Versioning: bump `_meta.version` on every material change; keep old versions in git so engines can reproduce historical pricing recommendations.
