# Job Match Engine — personalized for Kartik Shanbhag

A personalized **job recommendation engine** (not a generic job board) that scores real
Navi Mumbai & Mumbai product roles against Kartik Shanbhag's résumé. The résumé is the single
source of truth: the candidate profile, the derived experience level, and every match score are
computed from it.

## What it does

- **Derives experience level from the résumé** (never hardcoded, never user-selected). Change
  `src/data/profile.ts` and the level, target band and scoring re-derive.
- **Scores every job 0–100** with an explainable, weighted breakdown:

  | Component | Weight |
  |---|---|
  | Domain / industry fit | 25 |
  | Role & seniority fit | 20 |
  | Skills overlap (synonym-aware) | 25 |
  | Experience-level fit | 15 |
  | Location & work mode | 15 |

  Relevance (domain + role + skills = 70%) dominates location (15%), so a high-keyword but
  poor-fit Mumbai job cannot outrank a genuine career fit.
- **Ranks by career fit**, breaking ties by location priority: **Navi Mumbai → Mumbai**.
- For each role, shows: match score + breakdown, why it matches, relevant résumé experience,
  matching skills, missing/preferred skills, seniority fit, location, work mode, company, title,
  and a real apply link.
- **Dashboard**: top recommendations, best match score, Navi Mumbai / Mumbai counts, jobs grouped
  by role category, skills frequently requested but missing, and companies hiring for the profile.
- **Applied tab**: mark roles applied (or hitting Apply records it); tracked in the browser.
- **Update résumé**: upload a new PDF — it's parsed in-browser (pdf.js), you review/edit the
  extracted profile, and the engine re-derives your level and re-scores every job. No upload,
  no credentials.
- **Auto-refresh hourly**: the app re-pulls from its `JobSource` every hour.

## Fixed product rules (not user-configurable)

- Locations: **Navi Mumbai** (highest priority), then **Mumbai**. No other locations.
- Work modes: **Hybrid** and **On-site**. **Remote is excluded.**
- These are enforced at the data-source boundary (`src/lib/jobSource.ts`), not exposed as filters.

## Data

Jobs in `src/data/jobs.ts` are **real listings captured from Naukri.com on 2026-09-27** via
targeted searches for the candidate's profile, plus a spread of off-profile roles so the engine
visibly down-ranks poor fits. Apply links are the real listing URLs; individual reqs expire over
time.

## Architecture

```
src/
  data/profile.ts     # candidate profile (source of truth)
  data/jobs.ts        # real captured listings
  lib/level.ts        # experience-level derivation
  lib/taxonomy.ts     # skill synonyms + domain classification
  lib/scoring.ts      # the match engine (pure function)
  lib/jobSource.ts    # JobSource interface + StaticJobSource (swap in a live API here)
  lib/dashboard.ts    # derived dashboard aggregates
  components/         # Dashboard, JobCard, JobDetail, ScoreRing
```

The engine depends only on the `JobSource` interface, so a live source can be added without
touching the scorer or the UI. An hourly Naukri scraper that produces a live feed lives in
[`backend/`](backend/README.md); set `VITE_JOBS_FEED_URL` at build time to consume it (the app
falls back to the baked-in data when the feed is unreachable).

## Run

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```

Built with Vite + React + TypeScript + Tailwind CSS v4.

## Deploy hourly-fresh to GitHub Pages (no server)

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) hosts the whole app
**and** an hourly-refreshed job feed on GitHub Pages — no always-on backend. Each run
harvests Naukri (via `backend/`), writes `public/jobs.json`, builds the app with
`VITE_JOBS_FEED_URL=./jobs.json` (so the feed is same-origin — no CORS), and deploys
to Pages. The app also re-fetches the feed hourly on its own, and falls back to the
baked-in listings if a scrape is skipped.

One-time setup:

```bash
git init && git add -A && git commit -m "Job Match Engine"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The workflow runs on push, hourly (`cron: 0 * * * *`), and on demand
(**Actions → Scrape & deploy → Run workflow**). Your live URL is
`https://<you>.github.io/<repo>/`. Use a **public** repo (Pages on private repos needs a paid plan).
