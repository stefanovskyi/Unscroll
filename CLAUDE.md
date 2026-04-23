# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install                     # installs rss-parser (dev-only)
npm run build                   # regenerates articles.json via scripts/generate.mjs
python3 -m http.server 8742     # preview at http://127.0.0.1:8742/ (any port)
```

There are no tests, linters, or formatters configured. CI runs `npm ci || npm install && npm run build` and then deploys the directory root via `actions/deploy-pages`.

## Architecture

The site is split across a **build-time pipeline** (Node, runs in CI) and a **runtime** (plain HTML/CSS/JS served by GitHub Pages). This separation is a hard constraint from `task.md`: GitHub Pages has no server, and most RSS feeds do not set CORS headers, so feeds cannot be fetched from the browser. The generator produces `articles.json` ahead of time and the page just loads that file.

### Build-time: `scripts/`

- `scripts/feeds.mjs` — the source list. Each entry has:
  - `source` / `fallbackAuthor` — display strings; `fallbackAuthor` is used only when the feed omits per-item author metadata.
  - `candidates` — ordered list of feed URLs. `fetchFeed` tries them in order and stops at the first that parses. This is how we tolerate sites that change feed paths.
  - `transform(item)` — optional per-source hook that runs after the default normaliser. Return a modified item or `null` to drop it. Currently used by Simon Willison to strip the `#atom-entries` tracking fragment and to defensively drop anything whose URL path does not look like a long-form entry (`/YYYY/Mon/DD/slug/`).
- `scripts/generate.mjs` — orchestrator. Runs all feeds in parallel via `Promise.allSettled` (a single feed's failure never blocks others), applies a 14-day window relative to `new Date()`, sorts newest-first, and writes `articles.json` with shape `{ generatedAt, windowDays, count, failures, articles }`. Per-URL timeout is 20s.

When adding a source, prefer extending `feeds.mjs` with a new `transform` over editing `generate.mjs` — keeps source-specific logic local to the source.

### Runtime: page root

- `index.html` — single page, relative asset paths (`./styles.css`, `./articles.json`, `./app.js`) so the same files work on both user Pages (`user.github.io/`) and project Pages (`user.github.io/repo/`) without a base-path build step.
- `app.js` — fetches `articles.json`, groups articles by calendar day using `Intl.DateTimeFormat('en-CA', ...)` (ISO-like `YYYY-MM-DD` key, locale-stable), and renders each day into a `<section class="day">`. The byline collapses `author · source` to just `author` when the two strings match (case-insensitive, trimmed).
- `styles.css` — design inspired by [maxua.com/blogroll](https://maxua.com/blogroll): warm paper background (`#faf8f5`), centred single-column layout, uppercase accent-coloured date headings, tiny accent bullet dots before each row, flat list (no cards). Accent is blue (`--accent: #3d86e1`) — do not swap for violet/magenta/pink/purple per `task.md` design preferences. Dark mode palette is included and uses the same hue family.

### Deployment

`.github/workflows/build.yml` runs on push to `main`, on `15 6 * * *` UTC cron, and on manual dispatch. It uploads the repo root as a Pages artifact, so the generator must write `articles.json` into the repo root (which it does). Pages source in repo settings must be set to **GitHub Actions** for the `deploy-pages@v5` step to work.

### Things to keep in mind

- `articles.json` is committed so local previews work without running the generator. CI regenerates and overwrites it on every run. If you change the JSON schema, update both `generate.mjs` and `app.js` together.
- The generator's 14-day filter uses `new Date()` at build time, so the window slides with each build rather than being pinned to the commit time. The snapshot timestamp is exposed as `generatedAt` and shown in the page header.
- `fallbackAuthor` is the author shown when a feed omits it — not a default override. If a feed *has* author data that is wrong, fix it via a `transform`, not `fallbackAuthor`.
- Per `task.md`: no SPA frameworks, no client-side RSS fetching, no gradients, minimal webfonts. Keep dependencies dev-only.
