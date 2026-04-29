# Unscroll (reading list)

**Live site:** [unscroll.stefanovskyi.com](https://unscroll.stefanovskyi.com)

## Idea

**Unscroll** is a small, single-page “reverse timeline” of writing you care about: a curated set of author feeds, rolled into one calm list, newest first. The goal is to skim what actually published in the last couple of weeks without opening dozens of sites or social feeds. Feeds are fetched at **build time** (RSS has no useful browser CORS for most sites), the page is **static HTML** on GitHub Pages, and CI rebuilds and redeploys on a daily schedule so the list stays current.

A minimal static site that lists recent articles from a small set of writers,
grouped by date (most recent first), showing each article's title and author.
Only the **last 14 days** of items (relative to the build snapshot) are shown.

The page is plain HTML, CSS, and JS — no runtime framework, no client bundle,
no server. The build pipeline pre-renders the article list from `template.html`
into `index.html` and produces `articles.json`; GitHub Actions regenerates and
redeploys daily. `index.html` and `articles.json` are build outputs and are
not committed.

## Key files (reference)

| Path | Role |
| --- | --- |
| `template.html` | Page **template** with `<!--@name-->` / `<!--/@name-->` regions (styles, content, meta, failures, colophon) the generator fills in. |
| `index.html` | Build **output** (gitignored); produced by the generator from `template.html`. |
| `styles.css` | Paper-toned, pastel look; the generator inlines it into the built `index.html`. |
| `app.js` | **Runtime:** source filter on the pre-rendered list. **Dev:** if the content placeholder is still there, fetches `articles.json` and renders. |
| `articles.json` | Build output (gitignored): snapshot for CI/local use. |
| `scripts/feeds.mjs` | Authoritative list of sources, candidate feed URLs, optional per-source `transform` hooks. |
| `scripts/generate.mjs` | Fetches feeds, 14-day window, writes `articles.json`, renders `template.html` → `index.html`. |
| `.github/workflows/build.yml` | `npm run build` + GitHub Pages deploy (push, daily cron, manual). |

## Local preview

```sh
npm install          # installs rss-parser (dev-only)
npm run build        # regenerates articles.json
python3 -m http.server 8000   # or any static server
# open http://127.0.0.1:8000
```

The generator prints which feeds succeeded or failed; failed feeds are also
recorded in `articles.json` under `failures` so the page can surface them.

## Sources

Feeds are listed in `scripts/feeds.mjs`. Each source can list multiple
candidate feed URLs — the first one that parses wins. To add a source,
append an entry like:

```js
{
  source: "Display name",
  fallbackAuthor: "Used when the feed omits item-level authors",
  candidates: ["https://example.com/feed.atom"],
},
```
