# Unscroll

**Live site:** [unscroll.stefanovskyi.com](https://unscroll.stefanovskyi.com)

**Unscroll** is a small, single-page “reverse timeline” of writing you care about: a curated set of author feeds, rolled into one calm list, newest first. The goal is to skim what actually published in the last couple of weeks without opening dozens of sites or social feeds. Feeds are fetched at **build time** (RSS has no useful browser CORS for most sites), the page is **static HTML** on GitHub Pages, and CI rebuilds and redeploys on a daily schedule so the list stays current.

A minimal static site that lists recent articles from a small set of writers,
grouped by date (most recent first), showing each article's title and author.
Only the **last 14 days** of items (relative to the build snapshot) are shown.

The page is plain HTML, CSS, and JS — no runtime framework, no client bundle,
no server. The build pipeline pre-renders the article list from `template.html`
into `index.html` and produces `articles.json`; GitHub Actions regenerates and
redeploys daily. `index.html` and `articles.json` are build outputs and are
not committed.


## Local preview

```sh
npm install          # installs rss-parser (dev-only)
npm run build        # regenerates articles.json
python3 -m http.server 8000   # or any static server
# open http://127.0.0.1:8000
```

The generator prints which feeds succeeded or failed; failed feeds are also
recorded in `articles.json` under `failures` so the page can surface them.

## Public API

Two read-only JSON endpoints, generated at build time and served as static
files. No auth, no rate limits, `Access-Control-Allow-Origin: *`, so they are
callable directly from a browser. They refresh once a day with the site.

| Endpoint | Returns |
| --- | --- |
| [`/api/v1/latest.json`](https://unscroll.stefanovskyi.com/api/v1/latest.json) | The most recent day that has articles |
| [`/api/v1/last-2-days.json`](https://unscroll.stefanovskyi.com/api/v1/last-2-days.json) | The two most recent days that have articles |

```json
{
  "generatedAt": "2026-08-01T05:59:12.345Z",
  "dates": ["2026-08-01", "2026-07-31"],
  "count": 12,
  "items": [
    {
      "date": "2026-08-01T16:52:07.000Z",
      "author": "Gergely Orosz",
      "title": "Pushing software engineering limits with “napkin math”",
      "link": "https://newsletter.pragmaticengineer.com/p/..."
    }
  ]
}
```

Notes on the contract:

- Days are **UTC** calendar days, matching how the page groups them.
- A day with no articles is skipped rather than returned empty, so
  `last-2-days.json` always spans two days that have content. Read `dates` to
  see which days you actually got — they need not be consecutive.
- `items` is sorted newest first, and `date` is a full ISO 8601 timestamp, so
  items remain sortable within a day.
- Endpoints always answer `200`; an empty result is `"items": []`, never a 404.
- Responses are cached by the GitHub Pages CDN for 10 minutes.
- `articles.json` is *not* part of this contract — it is an internal build
  output whose shape can change without notice. Breaking changes to the API
  ship as `/api/v2/`, leaving `v1` in place.

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
