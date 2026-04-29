import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Parser from "rss-parser";
import { feeds } from "./feeds.mjs";

const DAYS = 14;
const USER_AGENT =
  "reading-list-news/1.0 (+https://github.com/) feed-aggregator";
const TIMEOUT_MS = 20_000;

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

// Build a deduped, alphabetized list of writers for the page footer
// blogroll. Two feeds may represent the same writer (e.g. Derek Thompson
// has both his Substack and his Atlantic author feed); merge by X handle
// so the reader sees one entry per person. Feeds without an xHandle fall
// back to a plain name (no link).
function buildWriters(feedList) {
  const map = new Map();
  for (const f of feedList) {
    const name = f.xAuthor || f.fallbackAuthor || f.source;
    const xUrl = f.xHandle ? `https://x.com/${f.xHandle}` : null;
    const key = xUrl ?? `name:${name.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { name, xUrl });
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
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

function renderFilterOptionsHtml(articles) {
  const sources = [...new Set(articles.map((a) => a.source))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  return sources.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
}

function renderMetaHtml(snapshot) {
  const { sources, windowDays, generatedAt } = snapshot;
  const stamp = new Date(generatedAt);
  const when = stamp.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `${sources} source${sources === 1 ? "" : "s"} · last ${windowDays} days · updated ${esc(when)}`;
}

function renderBlogrollHtml(writers) {
  if (!writers?.length) return "";
  return writers
    .map((w) =>
      w.xUrl
        ? `<a href="${esc(w.xUrl)}" rel="noopener" target="_blank">${esc(w.name)}</a>`
        : `<span class="blogroll__plain">${esc(w.name)}</span>`,
    )
    .join(" · ");
}

function renderColophonHtml(snapshot) {
  const stamp = new Date(snapshot.generatedAt);
  const when = stamp.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `Snapshot ${esc(when)} · ${snapshot.count} article${snapshot.count === 1 ? "" : "s"}.`;
}

function renderFailuresHtml(failures) {
  if (!failures?.length) return "";
  const items = failures
    .map((f) => `<li>${esc(f.source)} — ${esc(f.reason)}</li>`)
    .join("");
  return `<div class="failures"><details><summary>${failures.length} feed(s) failed in the last build</summary><ul>${items}</ul></details></div>`;
}

function replaceMarker(html, name, replacement) {
  const open = `<!--@${name}-->`;
  const close = `<!--/@${name}-->`;
  const start = html.indexOf(open);
  const end = html.indexOf(close, start + open.length);
  if (start < 0 || end < 0) throw new Error(`Missing marker @${name} in index.html`);
  return html.slice(0, start + open.length) + replacement + html.slice(end);
}

async function writeIndexHtml(snapshot, rootDir) {
  const indexPath = path.join(rootDir, "index.html");
  const stylesPath = path.join(rootDir, "styles.css");
  const [template, styles] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);
  let html = template;
  html = replaceMarker(html, "styles", `<style>${styles}</style>`);
  html = replaceMarker(html, "meta", renderMetaHtml(snapshot));
  html = replaceMarker(html, "filter-options", renderFilterOptionsHtml(snapshot.articles));
  html = replaceMarker(html, "content", renderArticlesHtml(snapshot.articles));
  html = replaceMarker(html, "failures", renderFailuresHtml(snapshot.failures));
  html = replaceMarker(html, "blogroll", renderBlogrollHtml(snapshot.writers));
  html = replaceMarker(html, "colophon", renderColophonHtml(snapshot));
  await writeFile(indexPath, html, "utf8");
  return indexPath;
}

async function main() {
  const now = new Date();
  const cutoffMs = now.getTime() - DAYS * 24 * 60 * 60 * 1000;

  console.log(`Fetching ${feeds.length} feeds…`);
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      console.log(`→ ${feed.source}`);
      let items, label;
      if (typeof feed.fetch === "function") {
        items = await feed.fetch();
        label = `${feed.source} (custom)`;
      } else {
        const parsed = await fetchFeed(feed);
        items = normalize(parsed.parsed, feed);
        label = parsed.url;
      }
      const fallbackCategory = feed.category || "article";
      for (const item of items) {
        if (!item.category) item.category = fallbackCategory;
      }
      attachAuthorUrls(items, feed);
      const recent = items.filter((a) => withinLastDays(a.date, cutoffMs));
      console.log(`  ✓ ${label} — ${recent.length} recent item(s)`);
      return recent;
    }),
  );

  const articles = [];
  const failures = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      failures.push({ source: feeds[i].source, reason: String(r.reason?.message ?? r.reason) });
      console.warn(`✗ ${feeds[i].source}: ${r.reason?.message ?? r.reason}`);
    }
  });

  articles.sort((a, b) => new Date(b.date) - new Date(a.date));

  const snapshot = {
    generatedAt: now.toISOString(),
    windowDays: DAYS,
    sources: feeds.length,
    count: articles.length,
    failures,
    writers: buildWriters(feeds),
    articles,
  };

  const rootDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const outPath = path.join(rootDir, "articles.json");
  await writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  const indexPath = await writeIndexHtml(snapshot, rootDir);
  console.log(
    `\nWrote ${articles.length} article(s) from ${feeds.length - failures.length}/${feeds.length} feeds to ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(`Patched pre-rendered HTML into ${path.relative(process.cwd(), indexPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
