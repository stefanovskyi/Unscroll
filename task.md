# Task Description

Build a **minimal static website** deployed on **GitHub Pages**: a single page that lists articles from the provided sources, grouped by date (most recent first), showing each article’s **title** and **author**. Show only items from the **last seven days including today** (relative to the data snapshot).

GitHub Pages serves **static files only** (HTML, CSS, JavaScript, JSON, etc.). There is **no Node.js or other server at runtime** on Pages. Feed fetching and RSS/Atom parsing therefore run **outside the browser**—for example a **GitHub Actions** workflow and/or a **local script** you run before commit—that writes a **data file** (e.g. `articles.json`) the page loads with `fetch()`. That avoids CORS issues that block browsers from calling most RSS URLs directly.

## Sources

- https://simonwillison.net/
- https://newsletter.pragmaticengineer.com/
- https://world.hey.com/dhh
- https://martinfowler.com/feed.atom
- https://substack.com/@thorstenball/posts
- https://blog.exe.dev/
- https://www.seangoedecke.com/rss.xml
- https://substack.com/@derekthompson/posts
- https://addyosmani.com/blog/
- https://substack.com/@dimko1/posts

(Map homepage or profile URLs to real Atom/RSS feed URLs in implementation, as needed.)

## Hosting and delivery (GitHub Pages)

- **Repository output**: whatever GitHub Pages publishes (often the root of `main`, a `/docs` folder, or the `gh-pages` branch)—must contain the **static assets** the site needs.
- **Paths**: use **relative URLs** for assets and data (e.g. `./articles.json` or `/repo-name/articles.json` depending on project vs user Pages) so the site works on the GitHub Pages URL.
- **Freshness**: “latest” articles are as fresh as the **last successful data build**. A **scheduled workflow** (e.g. daily at a chosen time, timezone-aware if required) can regenerate `articles.json` and commit or deploy it so the live site updates without a dedicated backend.

## Minimal implementation (constraints)

- **Runtime (in the browser)**: plain HTML, CSS, and JavaScript only; **no** React/Vue/build step unless clearly justified.
- **Dependencies**: minimize npm packages; anything used only for **generating** `articles.json` can be **dev-only** or run only in CI—**not** shipped as a runtime requirement for visitors.
- **Data pipeline**: one small, clear script (Node or other) that reads configured feed URLs, applies the 7-day filter and author rules, and emits JSON the static page consumes.
- **Do not** rely on client-side `fetch()` to third-party RSS URLs from the deployed page: most feeds are not CORS-enabled for GitHub Pages origins.

## Design preferences

- **Overall**: simple, minimal layout; **easy to read** (comfortable line length, line height, and contrast).
- **Backgrounds**: flat **solid** fills; **no gradients** (including subtle radial or mesh backgrounds).
- **Colour**: prefer a **soft, pastel** palette (e.g. warm off-white / paper tones for the page, slightly lighter panels for grouped content).
- **Avoid**: **violet, magenta, purple, pink**, and harsh, oversaturated (“toxic”) colours for accents, borders, and highlights.
- **Accents**: at most **one** restrained accent (e.g. dusty teal, sage, or muted slate) for links and focus states; keep shadows and borders **neutral**, not tinted.

## Recommended UI tools (runtime)

Stay within the **plain HTML, CSS, and JavaScript** runtime above; pick **one** visual layer, not several competing systems.

- **First choice**: **Pico.css**—single stylesheet (CDN or vendored), classless defaults on semantic HTML, little custom CSS, no JS framework.
- **Alternatives** if more structure is needed: **Shoelace** (web components, works with vanilla HTML/JS) or **Bootstrap 5** (CSS and optional JS from CDN).
- **Skip for this project**: React, Vue, Svelte, and other SPA stacks; avoid extra client libraries (e.g. Alpine.js) unless a few lines of vanilla JS truly cannot cover the behavior.
- **Optional**: generate a single **Tailwind** CSS file in **CI only** (no React) if a utility-first workflow is preferred; do not ship heavy client bundles for styling alone.
- **Typography**: one readable **sans** for body text and optionally **one** display/serif for headings; keep webfont usage **minimal** (e.g. Google Fonts with `display=swap` or a good system stack).

## Propositions toward minimalism

1. **Single data file** (e.g. `articles.json`) plus **one HTML entry** and optional shared CSS/JS—no database, no server process on Pages.
2. **GitHub Actions** to run the generator on **push** and optionally on a **schedule** (e.g. daily) so the site stays current without manual runs.
3. **Reuse one RSS/Atom parsing library** in the generator only; keep the published site free of heavy client bundles.
4. **Document** in the README how to run the generator locally and how Pages is configured (branch/folder, base path for assets).
