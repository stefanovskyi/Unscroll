# Reading list

A minimal static site that lists recent articles from a small set of writers,
grouped by date (most recent first), showing each article's title and author.
Only the **last 7 days** of items (relative to the build snapshot) are shown.

The page is plain HTML, CSS, and JS — no runtime framework, no client bundle,
no server. It loads a single `articles.json` produced ahead of time by a
Node script; GitHub Actions regenerates and redeploys daily.

## Files

| Path | Role |
| --- | --- |
| `index.html` | The page |
| `styles.css` | Paper-toned, pastel styling |
| `app.js` | Loads `articles.json`, renders day-grouped list |
| `articles.json` | Data file (generated — do not edit by hand) |
| `scripts/feeds.mjs` | Source → feed-URL list |
| `scripts/generate.mjs` | Fetches feeds, filters to last 7 days, writes `articles.json` |
| `.github/workflows/build.yml` | Runs the generator and deploys Pages daily |

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

## GitHub Pages setup

1. In repository **Settings → Pages**, set **Source** to
   *GitHub Actions* (the workflow uses `actions/deploy-pages`).
2. Make sure **Settings → Actions → General → Workflow permissions** allows
   Pages deployments (this is the default for repositories that have Pages
   enabled with the GitHub Actions source).
3. Push to `main`. The workflow at `.github/workflows/build.yml` runs on
   every push, on a daily cron (`15 6 * * *` UTC), and on manual dispatch.
   It installs dependencies, runs `npm run build`, uploads the whole
   directory as a Pages artifact, and deploys.

### Project-Pages base path

This site uses **relative URLs** (`./styles.css`, `./articles.json`) so it
works whether deployed to a user/organisation Pages site
(`https://user.github.io/`) or a project Pages site
(`https://user.github.io/repo-name/`). No base-path configuration is needed.

## Design notes

- Solid pastel fills, no gradients. Warm paper tone for the page, slightly
  lighter panel for grouped content.
- One muted accent (dusty teal) for hover/focus states.
- No violet / magenta / pink / oversaturated hues.
- System font stack for body text; one weight for titles.
- Optional `prefers-color-scheme: dark` palette using the same hue family.

## Why the data file is committed

GitHub Pages serves static files, so `articles.json` must be present in
the deployed tree. The CI workflow rebuilds it on every run before uploading
the artifact; committing the file keeps local previews working without
needing to run `npm run build` first. If you prefer not to commit it, delete
the file from `main` and rely solely on the workflow-generated artifact —
just remember local previews will show the "could not load" state until
you run `npm run build`.
