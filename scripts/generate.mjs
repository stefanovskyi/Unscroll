import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Parser from "rss-parser";
import { feeds } from "./feeds.mjs";

const DAYS = 14;
const USER_AGENT =
  "reading-list-news/1.0 (+https://github.com/) feed-aggregator";
const TIMEOUT_MS = 20_000;

// The previous build's articles.json, as currently deployed. Sources that
// fail this build are backfilled from it so a transient feed error degrades
// to "one day staler" instead of the source vanishing from the page.
const PREVIOUS_SNAPSHOT_URL =
  process.env.PREVIOUS_SNAPSHOT_URL ||
  "https://unscroll.stefanovskyi.com/articles.json";

// Deploy guard: a build with no articles, or with this share of sources
// failing and no previous snapshot to backfill from, exits non-zero so CI
// keeps the previous deploy live instead of shipping a gutted page.
const MAX_FAILURE_RATIO = 1 / 3;

const parser = new Parser({
  timeout: TIMEOUT_MS,
  headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
  customFields: {
    item: [
      ["dc:creator", "dcCreator"],
      ["author", "atomAuthor"],
    ],
  },
});

function pickAuthor(item, feedDefault, fallback) {
  const candidates = [
    item.creator,
    item.dcCreator,
    typeof item.author === "string" ? item.author : item.author?.name,
    item.atomAuthor?.name,
    feedDefault,
    fallback,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return fallback;
}

function pickDate(item) {
  const raw = item.isoDate || item.pubDate || item.published || item.updated;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchFeed({ source, fallbackAuthor, candidates }) {
  for (const url of candidates) {
    try {
      const parsed = await parser.parseURL(url);
      return { parsed, url };
    } catch (err) {
      console.warn(`  · failed ${url}: ${err.message}`);
    }
  }
  throw new Error(`No candidate feed worked for ${source}`);
}

function normalize(parsed, feedConfig) {
  const feedAuthor =
    parsed.itunes?.author ||
    (typeof parsed.author === "string" ? parsed.author : parsed.author?.name) ||
    parsed.managingEditor ||
    null;

  const items = [];
  for (const item of parsed.items ?? []) {
    const date = pickDate(item);
    if (!date) continue;
    const title = (item.title || "").trim();
    if (!title) continue;
    const link = (item.link || item.guid || "").trim();
    if (!link) continue;
    let article = {
      title,
      link,
      author: pickAuthor(item, feedAuthor, feedConfig.fallbackAuthor),
      source: feedConfig.source,
      category: feedConfig.category || "article",
      date: date.toISOString(),
    };
    if (typeof feedConfig.transform === "function") {
      article = feedConfig.transform(article);
      if (!article) continue;
    }
    items.push(article);
  }
  return items;
}

// Attach https://x.com/<handle> to articles whose author matches the
// feed's primary-author name (xAuthor, falling back to fallbackAuthor).
// The match is case-insensitive and trimmed so minor feed inconsistencies
// don't drop the link. Guest posts whose author differs are left alone.
function attachAuthorUrls(articles, feedConfig) {
  if (!feedConfig.xHandle) return articles;
  const primary = (feedConfig.xAuthor || feedConfig.fallbackAuthor || "")
    .trim()
    .toLowerCase();
  if (!primary) return articles;
  const url = `https://x.com/${feedConfig.xHandle}`;
  for (const a of articles) {
    if ((a.author || "").trim().toLowerCase() === primary) a.authorUrl = url;
  }
  return articles;
}

function withinLastDays(iso, cutoffMs) {
  return new Date(iso).getTime() >= cutoffMs;
}

async function fetchPreviousSnapshot() {
  try {
    const res = await fetch(PREVIOUS_SNAPSHOT_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const snapshot = await res.json();
    if (!Array.isArray(snapshot.articles)) throw new Error("no articles array");
    return snapshot;
  } catch (err) {
    console.warn(
      `Previous snapshot unavailable (${PREVIOUS_SNAPSHOT_URL}): ${err.message}`,
    );
    return null;
  }
}

// HTML rendering --------------------------------------------------
//
// The site pre-renders articles into index.html at build time. This
// eliminates the render-blocking CSS request, the articles.json
// fetch, and the layout shift that used to happen when the "Loading…"
// placeholder was swapped for the full list. The browser gets a page
// whose critical content is already painted on first byte; app.js
// only wires up the source filter.

const htmlEscapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => htmlEscapes[c]);

// Inline YouTube glyph rendered before the channel name in the byline of
// any article whose `kind` is "youtube". Inlined (not background-image) so
// the icon ships with the pre-rendered HTML and needs no extra request.
const YOUTUBE_ICON =
  '<svg class="article__media-icon article__media-icon--youtube" viewBox="0 0 24 24" width="14" height="14" aria-label="YouTube" role="img">' +
  '<path fill="#ff0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>' +
  '<path fill="#fff" d="M9.546 15.568V8.432L15.818 12l-6.272 3.568z"/>' +
  "</svg>";

// Public API (v1). Static, versioned projections of the snapshot, served off
// Pages with `Access-Control-Allow-Origin: *`. "Last N days" means the N most
// recent days that actually have articles, so a quiet calendar day never
// shortens the response — `dates` reports which days a caller got. Unlike
// articles.json (an internal build output), the shape here is a contract:
// change it by adding a v2, not by editing v1.
const API_DIR = ["api", "v1"];

function buildApiPayload(days, generatedAt) {
  const items = days.flatMap((day) => day.items);
  return {
    generatedAt,
    dates: days.map((day) => day.key),
    count: items.length,
    items: items.map((a) => ({
      date: a.date,
      author: a.author,
      title: a.title,
      link: a.link,
    })),
  };
}

async function writeApi(snapshot, rootDir) {
  const days = groupArticlesByUtcDay(snapshot.articles);
  const dir = path.join(rootDir, ...API_DIR);
  await mkdir(dir, { recursive: true });

  const written = [];
  for (const [file, dayCount] of [
    ["latest.json", 1],
    ["last-2-days.json", 2],
  ]) {
    // slice() on a short list yields an empty payload rather than throwing:
    // an endpoint always answers 200 with `items: []`.
    const payload = buildApiPayload(days.slice(0, dayCount), snapshot.generatedAt);
    await writeFile(
      path.join(dir, file),
      JSON.stringify(payload, null, 2) + "\n",
      "utf8",
    );
    written.push(
      `${path.posix.join(...API_DIR, file)} — ${payload.count} item(s) across ${payload.dates.length} day(s)`,
    );
  }
  return written;
}

const dayHeadingFmt = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function groupArticlesByUtcDay(articles) {
  const byDay = new Map();
  for (const a of articles) {
    const key = a.date.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(a);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      date: new Date(items[0].date),
      items: items.sort((x, y) => (x.date < y.date ? 1 : -1)),
    }));
}

function renderArticle(a) {
  const title = `<a class="article__title" href="${esc(a.link)}" rel="noopener" target="_blank">${esc(a.title)}</a>`;
  const authorNode = a.authorUrl
    ? `<a class="article__author-link" href="${esc(a.authorUrl)}" rel="noopener" target="_blank">${esc(a.author)}</a>`
    : esc(a.author);
  const icon = a.kind === "youtube" ? YOUTUBE_ICON : "";
  const sameByAndSource =
    (a.author || "").trim().toLowerCase() === (a.source || "").trim().toLowerCase();
  const byline = sameByAndSource
    ? `<p class="article__byline">${icon}${authorNode}</p>`
    : `<p class="article__byline">${icon}${authorNode}<span class="article__source"> · ${esc(a.source)}</span></p>`;
  const category = a.category || (a.kind === "youtube" ? "youtube" : "article");
  return `<li class="article" data-source="${esc(a.source)}" data-category="${esc(category)}">${title}${byline}</li>`;
}

function renderArticlesHtml(articles) {
  if (!articles.length) {
    return `<p class="empty">No articles published in the last window.</p>`;
  }
  const groups = groupArticlesByUtcDay(articles);
  return groups
    .map(
      (g) =>
        `<section class="day" aria-labelledby="day-${g.key}">` +
        `<h2 class="day__heading" id="day-${g.key}">${esc(dayHeadingFmt.format(g.date))}</h2>` +
        `<ul class="day__list">${g.items.map(renderArticle).join("")}</ul>` +
        `</section>`,
    )
    .join("");
}

function renderMetaHtml(snapshot) {
  const { sources, windowDays, generatedAt } = snapshot;
  const stamp = new Date(generatedAt);
  const when = stamp.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `${sources} source${sources === 1 ? "" : "s"} · last ${windowDays} days · updated ${esc(when)}`;
}

function renderColophonHtml(snapshot) {
  const stamp = new Date(snapshot.generatedAt);
  const when = stamp.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `Snapshot ${esc(when)} · ${snapshot.count} article${snapshot.count === 1 ? "" : "s"}.`;
}

function renderFailuresHtml(failures) {
  if (!failures?.length) return "";
  const items = failures
    .map((f) => {
      const note = f.backfilled
        ? ` (showing ${f.backfilled} article(s) from the previous build)`
        : "";
      return `<li>${esc(f.source)} — ${esc(f.reason)}${esc(note)}</li>`;
    })
    .join("");
  return `<div class="failures"><details><summary>${failures.length} feed(s) failed in the last build</summary><ul>${items}</ul></details></div>`;
}

function replaceMarker(html, name, replacement) {
  const open = `<!--@${name}-->`;
  const close = `<!--/@${name}-->`;
  const start = html.indexOf(open);
  const end = html.indexOf(close, start + open.length);
  if (start < 0 || end < 0) throw new Error(`Missing marker @${name} in template.html`);
  return html.slice(0, start + open.length) + replacement + html.slice(end);
}

async function writeIndexHtml(snapshot, rootDir) {
  const templatePath = path.join(rootDir, "template.html");
  const indexPath = path.join(rootDir, "index.html");
  const stylesPath = path.join(rootDir, "styles.css");
  const [template, styles] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);
  let html = template;
  html = replaceMarker(html, "styles", `<style>${styles}</style>`);
  html = replaceMarker(html, "meta", renderMetaHtml(snapshot));
  html = replaceMarker(html, "content", renderArticlesHtml(snapshot.articles));
  html = replaceMarker(html, "failures", renderFailuresHtml(snapshot.failures));
  html = replaceMarker(html, "colophon", renderColophonHtml(snapshot));
  await writeFile(indexPath, html, "utf8");
  return indexPath;
}

async function main() {
  const buildStartedAt = performance.now();
  const now = new Date();
  const cutoffMs = now.getTime() - DAYS * 24 * 60 * 60 * 1000;

  console.log(`Fetching ${feeds.length} feeds…`);
  const previousPromise = fetchPreviousSnapshot();
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const startedAt = performance.now();
      console.log(`→ ${feed.source}`);
      try {
        let items, label;
        if (typeof feed.fetch === "function") {
          items = await feed.fetch();
          label = `${feed.source} (custom)`;
        } else {
          const parsed = await fetchFeed(feed);
          items = normalize(parsed.parsed, feed);
          label = parsed.url;
        }
        if (items.length === 0) {
          console.warn(
            `  · warning: ${feed.source} returned zero raw items; the source may be empty or its parser may need attention`,
          );
        }
        const fallbackCategory = feed.category || "article";
        for (const item of items) {
          if (!item.category) item.category = fallbackCategory;
        }
        attachAuthorUrls(items, feed);
        const recent = items.filter((a) => withinLastDays(a.date, cutoffMs));
        const durationMs = Math.round(performance.now() - startedAt);
        console.log(
          `  ✓ ${label} — ${items.length} raw, ${recent.length} recent item(s) — ${durationMs} ms`,
        );
        return recent;
      } catch (err) {
        const durationMs = Math.round(performance.now() - startedAt);
        console.warn(
          `  · ${feed.source} failed after ${durationMs} ms: ${err.message}`,
        );
        throw err;
      }
    }),
  );

  const previous = await previousPromise;

  const articles = [];
  const failures = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      const feed = feeds[i];
      const reason = String(r.reason?.message ?? r.reason);
      const cached = previous
        ? previous.articles.filter(
            (a) => a.source === feed.source && withinLastDays(a.date, cutoffMs),
          )
        : [];
      articles.push(...cached);
      failures.push({ source: feed.source, reason, backfilled: cached.length });
      console.warn(
        `✗ ${feed.source}: ${reason}` +
          (cached.length ? ` — backfilled ${cached.length} article(s) from previous snapshot` : ""),
      );
    }
  });

  if (articles.length === 0) {
    throw new Error(
      "Deploy guard: build produced 0 articles; keeping the previous deploy.",
    );
  }
  if (!previous && failures.length > feeds.length * MAX_FAILURE_RATIO) {
    throw new Error(
      `Deploy guard: ${failures.length}/${feeds.length} sources failed and no previous snapshot was available to backfill from; keeping the previous deploy.`,
    );
  }

  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  const snapshot = {
    generatedAt: now.toISOString(),
    windowDays: DAYS,
    sources: feeds.length,
    count: articles.length,
    failures,
    articles,
  };

  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const outPath = path.join(rootDir, "articles.json");
  await writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  const indexPath = await writeIndexHtml(snapshot, rootDir);
  const apiFiles = await writeApi(snapshot, rootDir);
  console.log(
    `\nWrote ${articles.length} article(s) from ${feeds.length - failures.length}/${feeds.length} feeds to ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(`Patched pre-rendered HTML into ${path.relative(process.cwd(), indexPath)}`);
  for (const line of apiFiles) console.log(`Wrote ${line}`);
  console.log(`Build completed in ${Math.round(performance.now() - buildStartedAt)} ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
