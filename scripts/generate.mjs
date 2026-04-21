import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Parser from "rss-parser";
import { feeds } from "./feeds.mjs";

const DAYS = 7;
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

function withinLastDays(iso, cutoffMs) {
  return new Date(iso).getTime() >= cutoffMs;
}

async function main() {
  const now = new Date();
  const cutoffMs = now.getTime() - DAYS * 24 * 60 * 60 * 1000;

  console.log(`Fetching ${feeds.length} feeds…`);
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      console.log(`→ ${feed.source}`);
      const { parsed, url } = await fetchFeed(feed);
      const items = normalize(parsed, feed).filter((a) =>
        withinLastDays(a.date, cutoffMs),
      );
      console.log(`  ✓ ${url} — ${items.length} recent item(s)`);
      return items;
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
    count: articles.length,
    failures,
    articles,
  };

  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "articles.json",
  );
  await writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(
    `\nWrote ${articles.length} article(s) from ${feeds.length - failures.length}/${feeds.length} feeds to ${path.relative(process.cwd(), outPath)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
