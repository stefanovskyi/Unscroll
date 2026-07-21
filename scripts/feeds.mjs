// Source URLs from task.md, mapped to feed URLs where needed.
// Each entry lists one or more candidate feed URLs; the generator tries
// them in order and stops at the first that parses successfully.
//
// `fallbackAuthor` is used when a feed omits per-item author metadata.
// `source` is the human-readable label used in the UI.
// `transform(item)` is an optional per-source hook that runs after the
// default normalizer; return a modified item, or `null` to drop it.
//
// `fetch()` is an escape hatch for sources that have no usable feed.
// When set, the generator skips rss-parser entirely and uses the array
// of normalized articles the function returns. See Paul Graham below.

// Simon Willison's blog publishes four streams under one site:
// long-form entries, quotes ("Quoting X"), link blog, and TILs. The
// /atom/everything/ feed merges all four; /atom/entries/ is the
// dedicated long-form feed that matches https://simonwillison.net/entries/.
// We want only the long-form entries, so we use the entries feed with
// no fallback — falling back to /atom/everything/ would reintroduce
// the other three streams.
const simonWillisonEntryPath = /^\/\d{4}\/[A-Z][a-z]{2}\/\d{1,2}\/[^/]+\/?$/;

function simonWillisonTransform(item) {
  // The entries feed puts an `#atom-entries` tracking fragment on every
  // link — strip it for cleaner URLs.
  let url;
  try {
    url = new URL(item.link);
  } catch {
    return null;
  }
  if (url.hash === "#atom-entries") url.hash = "";

  // Defensive guard: make sure this really looks like a long-form
  // entry URL (`/YYYY/Mon/DD/slug/`). If the feed ever starts carrying
  // quotes/links/TILs, drop them rather than render them.
  if (!simonWillisonEntryPath.test(url.pathname)) return null;

  return { ...item, link: url.toString() };
}

// `xHandle` is the author's X (formerly Twitter) handle without the @.
// The generator attaches `https://x.com/<handle>` as `authorUrl` on any
// article whose author matches the feed's `fallbackAuthor` (or an
// explicit `xAuthor` for multi-author feeds). Guest posts on single-
// author feeds therefore don't get misattributed to the main author.
// Feeds without a clear single author (brand newsletters, group blogs)
// omit `xHandle`.
export const feeds = [
  {
    source: "Simon Willison",
    fallbackAuthor: "Simon Willison",
    xHandle: "simonw",
    category: "article",
    candidates: ["https://simonwillison.net/atom/entries/"],
    transform: simonWillisonTransform,
  },
  {
    source: "The Pragmatic Engineer",
    fallbackAuthor: "Gergely Orosz",
    xHandle: "GergelyOrosz",
    category: "article",
    candidates: [
      "https://newsletter.pragmaticengineer.com/feed",
      "https://www.pragmaticengineer.com/rss/",
    ],
  },
  {
    source: "DHH — HEY World",
    fallbackAuthor: "David Heinemeier Hansson",
    xHandle: "dhh",
    category: "article",
    candidates: ["https://world.hey.com/dhh/feed.atom"],
  },
  {
    source: "Martin Fowler",
    fallbackAuthor: "Martin Fowler",
    xHandle: "martinfowler",
    category: "article",
    candidates: ["https://martinfowler.com/feed.atom"],
  },
  {
    source: "Thorsten Ball — Register Spill",
    fallbackAuthor: "Thorsten Ball",
    xHandle: "thorstenball",
    category: "newsletter",
    candidates: [
      "https://registerspill.thorstenball.com/feed",
      "https://registerspill.substack.com/feed",
    ],
  },
  {
    source: "blog.exe.dev",
    fallbackAuthor: "exe.dev",
    category: "article",
    candidates: [
      "https://blog.exe.dev/atom.xml",
      "https://blog.exe.dev/rss.xml",
      "https://blog.exe.dev/feed.xml",
      "https://blog.exe.dev/index.xml",
    ],
  },
  {
    source: "Sean Goedecke",
    fallbackAuthor: "Sean Goedecke",
    xHandle: "sjgoedecke",
    category: "article",
    candidates: ["https://www.seangoedecke.com/rss.xml"],
  },
  {
    source: "Derek Thompson",
    fallbackAuthor: "Derek Thompson",
    xHandle: "DKThomp",
    category: "newsletter",
    candidates: [
      "https://www.derekthompson.org/feed",
      "https://derekthompson.substack.com/feed",
    ],
  },
  {
    source: "Addy Osmani",
    fallbackAuthor: "Addy Osmani",
    xHandle: "addyosmani",
    category: "article",
    candidates: [
      "https://addyosmani.com/feed.xml",
      "https://addyosmani.com/blog/feed.xml",
      "https://addyosmani.com/rss.xml",
    ],
  },
  {
    source: "Humanager (Dima Maleev)",
    fallbackAuthor: "Dima Maleev",
    category: "newsletter",
    candidates: ["https://sonerdy.substack.com/feed"],
  },
  {
    source: "Armin Ronacher",
    fallbackAuthor: "Armin Ronacher",
    xHandle: "mitsuhiko",
    category: "article",
    candidates: ["https://lucumr.pocoo.org/feed.atom"],
  },
  {
    source: "Boris Tane",
    fallbackAuthor: "Boris Tane",
    xHandle: "boristane",
    category: "article",
    candidates: ["https://boristane.com/rss.xml"],
  },
  {
    source: "David Crawshaw",
    fallbackAuthor: "David Crawshaw",
    xHandle: "davidcrawshaw",
    category: "article",
    candidates: ["https://crawshaw.io/atom.xml"],
  },
  {
    source: "Phil Eaton",
    fallbackAuthor: "Phil Eaton",
    xHandle: "eatonphil",
    category: "article",
    candidates: ["https://notes.eatonphil.com/rss.xml"],
  },
  {
    source: "Stay SaaSy",
    fallbackAuthor: "Stay SaaSy",
    xHandle: "staysaasy",
    category: "article",
    candidates: ["https://staysaasy.com/feed.xml"],
  },
  {
    source: "Paul Graham",
    xHandle: "paulg",
    xAuthor: "Paul Graham",
    category: "article",
    fetch: fetchPaulGraham,
  },
  {
    source: "Naval",
    fallbackAuthor: "Naval",
    xHandle: "naval",
    category: "article",
    candidates: ["https://nav.al/feed"],
  },
  {
    source: "Geoffrey Litt",
    fallbackAuthor: "Geoffrey Litt",
    xHandle: "geoffreylitt",
    category: "article",
    candidates: ["https://www.geoffreylitt.com/feed.xml"],
  },
  {
    source: "Ben Kuhn",
    fallbackAuthor: "Ben Kuhn",
    xHandle: "benkuhn",
    category: "article",
    candidates: ["https://www.benkuhn.net/index.xml"],
  },
  {
    source: "Stratechery",
    fallbackAuthor: "Ben Thompson",
    xHandle: "benthompson",
    category: "newsletter",
    candidates: ["https://stratechery.com/feed/"],
  },
  {
    source: "Charity Majors",
    fallbackAuthor: "Charity Majors",
    xHandle: "mipsytipsy",
    category: "article",
    candidates: ["https://charity.wtf/feed/"],
  },
  {
    // The Atlantic has no newsletter-specific RSS for Work in Progress;
    // the Derek Thompson author feed is the closest available and in
    // practice covers his WIP columns plus a handful of broader pieces.
    // Kept separate from his personal substack (`Derek Thompson`).
    source: "Work in Progress (The Atlantic)",
    fallbackAuthor: "Derek Thompson",
    xHandle: "DKThomp",
    category: "newsletter",
    candidates: ["https://www.theatlantic.com/feed/author/derek-thompson/"],
  },
  {
    source: "One Useful Thing (Ethan Mollick)",
    fallbackAuthor: "Ethan Mollick",
    xHandle: "emollick",
    category: "newsletter",
    candidates: ["https://www.oneusefulthing.org/feed"],
  },
  {
    source: "Max Woolf",
    fallbackAuthor: "Max Woolf",
    xHandle: "minimaxir",
    category: "article",
    candidates: ["https://minimaxir.com/index.xml"],
  },
  {
    source: "Noahpinion (Noah Smith)",
    fallbackAuthor: "Noah Smith",
    xHandle: "Noahpinion",
    category: "article",
    candidates: ["https://www.noahpinion.blog/feed"],
  },
  {
    source: "Steve Yegge",
    fallbackAuthor: "Steve Yegge",
    xHandle: "Steve_Yegge",
    category: "article",
    candidates: [
      "https://steve-yegge.medium.com/feed",
      "https://medium.com/feed/@steve-yegge",
    ],
  },
  {
    source: "Read Trung (Trung Phan)",
    fallbackAuthor: "Trung Phan",
    xHandle: "TrungTPhan",
    category: "newsletter",
    candidates: ["https://www.readtrung.com/feed"],
  },
  {
    source: "Val Town",
    fallbackAuthor: "Val Town",
    xHandle: "ValDotTown",
    category: "article",
    candidates: ["https://blog.val.town/rss.xml"],
  },
  {
    source: "NLP Newsletter (Elvis Saravia)",
    fallbackAuthor: "Elvis Saravia",
    xHandle: "omarsar0",
    category: "newsletter",
    candidates: ["https://nlp.elvissaravia.com/feed"],
  },
  {
    source: "Architecture Weekly",
    fallbackAuthor: "Oskar Dudycz",
    xHandle: "oskar_at_net",
    category: "newsletter",
    candidates: ["https://www.architecture-weekly.com/feed"],
  },
  {
    // a16z publishes no per-topic RSS; the main feed is used and is mostly
    // tech-adjacent content. Individual authors vary.
    source: "a16z",
    fallbackAuthor: "a16z",
    xHandle: "a16z",
    category: "article",
    candidates: ["https://www.a16z.news/feed"],
  },
  {
    source: "ByteByteGo",
    fallbackAuthor: "Alex Xu",
    xHandle: "alexxubyte",
    category: "newsletter",
    candidates: ["https://blog.bytebytego.com/feed"],
  },
  {
    source: "Hacker Newsletter",
    fallbackAuthor: "Hacker Newsletter",
    xHandle: "hnletter",
    category: "newsletter",
    candidates: ["https://buttondown.com/hacker-newsletter/rss"],
  },
  {
    source: "Software Lead Weekly",
    xHandle: "orenellenbogen",
    xAuthor: "Oren Ellenbogen",
    category: "newsletter",
    fetch: fetchSoftwareLeadWeekly,
  },
  {
    source: "Founder Weekly",
    category: "newsletter",
    fetch: fetchFounderWeekly,
  },
  {
    source: "Programmer Weekly",
    category: "newsletter",
    fetch: fetchProgrammerWeekly,
  },
  {
    source: "Python Weekly",
    category: "newsletter",
    fetch: fetchPythonWeekly,
  },
  {
    source: "Modern Data 101",
    fallbackAuthor: "Modern Data 101",
    category: "newsletter",
    candidates: ["https://moderndata101.substack.com/feed"],
  },
  {
    source: "Deep Learning Weekly",
    fallbackAuthor: "Deep Learning Weekly",
    category: "newsletter",
    candidates: ["https://www.deeplearningweekly.com/feed"],
  },
  {
    source: "Matt Wolfe",
    category: "youtube",
    fetch: () =>
      fetchYouTubeChannel({
        handle: "mreflow",
        channelId: "UChpleBmo18P08aKCIgti38g",
        source: "Matt Wolfe",
      }),
  },
  {
    // Newsletter source above already uses "The Pragmatic Engineer"; the
    // YouTube channel goes by the slightly shorter handle to keep the two
    // distinct in the source filter.
    source: "Pragmatic Engineer",
    category: "youtube",
    fetch: () =>
      fetchYouTubeChannel({
        handle: "pragmaticengineer",
        channelId: "UCPbwhExawYrn9xxI21TFfyw",
        source: "Pragmatic Engineer",
      }),
  },
  {
    source: "AI Engineer",
    category: "youtube",
    fetch: () =>
      fetchYouTubeChannel({
        handle: "aiDotEngineer",
        channelId: "UCLKPca3kwwd-B59HNr-_lvA",
        source: "AI Engineer",
      }),
  },
  {
    source: "In the World of AI",
    category: "youtube",
    fetch: () =>
      fetchYouTubeChannel({
        handle: "intheworldofai",
        channelId: "UC2WmuBuFq6gL08QYG-JjXKw",
        source: "In the World of AI",
      }),
  },
  {
    source: "Anthropic Engineering",
    xHandle: "AnthropicAI",
    xAuthor: "Anthropic",
    category: "article",
    fetch: fetchAnthropicEngineering,
  },
  {
    source: "Lenny's Podcast",
    category: "youtube",
    fetch: () =>
      fetchYouTubeChannel({
        handle: "LennysPodcast",
        channelId: "UC6t1O76G0jYXOAoYCm153dA",
        source: "Lenny's Podcast",
      }),
  },
];

// --- Paul Graham scraper -------------------------------------------
//
// paulgraham.com has no RSS. aaronsw.com hosts a scrape but it omits
// dates, which makes a date-windowed reader useless. The site itself
// publishes only a month-level date ("March 2026") inside each essay
// page, so this scraper walks articles.html and fetches the top few
// essay pages to extract their dates.

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

async function fetchText(url, timeoutMs = 20_000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": "reading-list-news/1.0 (+github pages aggregator)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractMonthYear(html) {
  // Matches the "<font size=2 face=verdana>March 2026" header each
  // essay renders just below its title image. Fall back to a naked
  // "Month YYYY" anywhere if the font tag varies.
  const m = html.match(
    /<font[^>]*>\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  // Mid-month (15th, UTC) is a fair centre for a date with only
  // month-level precision: "March 2026" was as likely published on
  // March 1 as on March 30.
  return new Date(Date.UTC(Number(m[2]), month, 15));
}

// --- Beehiiv sitemap scraper ---------------------------------------
//
// Beehiiv-hosted newsletters (founderweekly.com, programmerweekly.com,
// pythonweekly.com) expose no RSS feed, but their sitemap.xml lists every
// issue with the publish date baked into the slug — e.g.
// `founder-weekly-issue-728-april-22-2026`. We parse dates straight from
// the slug and keep the newest N so the 14-day window filter doesn't have
// to walk hundreds of archived issues. Some publications abbreviate the
// month ("apr" vs "april"), so matchMonth accepts both forms.

function matchMonth(token) {
  const lc = token.toLowerCase();
  const exact = MONTHS.indexOf(lc);
  if (exact >= 0) return exact;
  const prefix = MONTHS.findIndex((m) => m.startsWith(lc));
  return prefix;
}

async function fetchBeehiivIssues({ origin, slugPrefix, source, author, titlePrefix }) {
  const sitemap = await fetchText(`${origin}/sitemap.xml`);
  const slugRe = new RegExp(
    `/p/(${slugPrefix}-(\\d+)-([a-z]+)-(\\d+)-(\\d{4}))`,
    "g",
  );
  const seen = new Set();
  const articles = [];
  for (const [, slug, issue, month, day, year] of sitemap.matchAll(slugRe)) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const monthIdx = matchMonth(month);
    if (monthIdx < 0) continue;
    const date = new Date(Date.UTC(Number(year), monthIdx, Number(day)));
    if (Number.isNaN(date.getTime())) continue;
    articles.push({
      title: `${titlePrefix} #${issue}`,
      link: `${origin}/p/${slug}`,
      author,
      source,
      date: date.toISOString(),
    });
  }
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  return articles.slice(0, 20);
}

function fetchFounderWeekly() {
  return fetchBeehiivIssues({
    origin: "https://www.founderweekly.com",
    slugPrefix: "founder-weekly-issue",
    source: "Founder Weekly",
    author: "Founder Weekly",
    titlePrefix: "Founder Weekly",
  });
}

function fetchProgrammerWeekly() {
  return fetchBeehiivIssues({
    origin: "https://www.programmerweekly.com",
    slugPrefix: "programmer-weekly-issue",
    source: "Programmer Weekly",
    author: "Programmer Weekly",
    titlePrefix: "Programmer Weekly",
  });
}

function fetchPythonWeekly() {
  return fetchBeehiivIssues({
    origin: "https://www.pythonweekly.com",
    slugPrefix: "python-weekly-issue",
    source: "Python Weekly",
    author: "Rahul Chaudhary",
    titlePrefix: "Python Weekly",
  });
}

// --- Software Lead Weekly scraper ----------------------------------
//
// softwareleadweekly.com serves a JS-rendered SPA; its advertised /rss/
// endpoint returns the HTML shell, not a feed. The sitemap.xml lists
// every issue at /issues/N (no date in the slug), but each issue page
// has a <title> like "Issue #699, 17th April 2026 - SoftwareLeadWeekly",
// so we pull dates from the title tag.

async function fetchSoftwareLeadWeekly() {
  const sitemap = await fetchText("https://softwareleadweekly.com/sitemap.xml");
  const issueRe = /\/issues\/(\d+)(?=[<"])/g;
  const issues = new Set();
  for (const [, n] of sitemap.matchAll(issueRe)) issues.add(Number(n));
  const top = [...issues].sort((a, b) => b - a).slice(0, 15);
  if (top.length === 0) throw new Error("No /issues/N URLs in sitemap");

  const titleRe =
    /Issue #(\d+),\s*(\d+)(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/;
  const articles = await Promise.all(
    top.map(async (n) => {
      const url = `https://softwareleadweekly.com/issues/${n}`;
      try {
        const html = await fetchText(url);
        const m = html.match(titleRe);
        if (!m) return null;
        const monthIdx = MONTHS.indexOf(m[3].toLowerCase());
        if (monthIdx < 0) return null;
        const date = new Date(Date.UTC(Number(m[4]), monthIdx, Number(m[2])));
        if (Number.isNaN(date.getTime())) return null;
        return {
          title: `Software Lead Weekly #${m[1]}`,
          link: url,
          author: "Oren Ellenbogen",
          source: "Software Lead Weekly",
          date: date.toISOString(),
        };
      } catch {
        return null;
      }
    }),
  );
  return articles.filter(Boolean);
}

// --- YouTube channel scraper ---------------------------------------
//
// YouTube's Atom feed lives at /feeds/videos.xml?channel_id=UCxxx, but
// the user-facing URLs use @handles. Channel IDs are permanent, so each
// feed entry pins its `channelId` and the build goes straight to the
// Atom feed. Resolving the ID from the channel HTML page is kept only
// as a fallback for newly added channels — that page is large and
// YouTube often serves consent walls / bot checks to datacenter IPs
// like GitHub runners, so it must not be on the every-build path.
// We parse the Atom feed directly to avoid pulling rss-parser into
// this module (other custom fetchers here also do minimal regex
// parsing for the same reason).

const xmlEntities = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
};

function decodeXml(s) {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => xmlEntities[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

async function resolveChannelId(handle) {
  const channelHtml = await fetchText(`https://www.youtube.com/@${handle}`);
  const idMatch = channelHtml.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (!idMatch) throw new Error(`Cannot resolve channel ID for @${handle}`);
  console.warn(
    `  · resolved @${handle} → ${idMatch[1]} — pin it as channelId in feeds.mjs`,
  );
  return idMatch[1];
}

async function fetchYouTubeChannel({ handle, channelId, source }) {
  const id = channelId || (await resolveChannelId(handle));
  const xml = await fetchText(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
  );
  const articles = [];
  for (const [, body] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const titleM = body.match(/<title>([\s\S]*?)<\/title>/);
    const linkM = body.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/);
    const publishedM = body.match(/<published>([^<]+)<\/published>/);
    if (!titleM || !linkM || !publishedM) continue;
    const link = linkM[1].trim();
    // The Atom feed mixes Shorts (/shorts/<id>) into the same stream as
    // long-form videos (/watch?v=<id>). Drop Shorts.
    if (link.includes("/shorts/")) continue;
    const date = new Date(publishedM[1]);
    if (Number.isNaN(date.getTime())) continue;
    articles.push({
      title: decodeXml(titleM[1].trim()),
      link,
      author: source,
      source,
      date: date.toISOString(),
      kind: "youtube",
    });
  }
  return articles;
}

// --- Anthropic Engineering scraper ---------------------------------
//
// anthropic.com/engineering is a Next.js page with no RSS. Its initial
// payload embeds a list of articles as escaped JSON inside the document,
// one block per article shaped like:
//   {"_type":"engineeringArticle", ... ,"publishedOn":"YYYY-MM-DD",
//    "slug":{..."current":"<slug>"}, ... ,"title":"<title>"}
// We split on the "engineeringArticle" marker and pull publishedOn, slug,
// and title from each block. Authors are not in the index payload, so we
// label everything "Anthropic" — accurate for the brand blog, even though
// individual posts have named bylines on their own pages.

async function fetchAnthropicEngineering() {
  const html = await fetchText("https://www.anthropic.com/engineering");
  const blockRe = /\\"_type\\":\\"engineeringArticle\\"([\s\S]*?)(?=\\"_type\\":\\"engineeringArticle\\"|<\/script>)/g;
  const slugRe = /\\"slug\\":\{\\"_type\\":\\"slug\\",\\"current\\":\\"([^"\\]+)\\"/;
  const dateRe = /\\"publishedOn\\":\\"(\d{4}-\d{2}-\d{2})\\"/;
  const titleRe = /\\"title\\":\\"((?:[^"\\]|\\.)+?)\\"/;

  const seen = new Set();
  const articles = [];
  for (const [, block] of html.matchAll(blockRe)) {
    const slugM = block.match(slugRe);
    const dateM = block.match(dateRe);
    const titleM = block.match(titleRe);
    if (!slugM || !dateM || !titleM) continue;
    const slug = slugM[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    // Date is YYYY-MM-DD with no time; treat as midday UTC so it lands on
    // the intended calendar day in any sane timezone.
    const date = new Date(`${dateM[1]}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    const title = decodeXml(titleM[1].replace(/\\u0026/g, "&").replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    articles.push({
      title,
      link: `https://www.anthropic.com/engineering/${slug}`,
      author: "Anthropic",
      source: "Anthropic Engineering",
      date: date.toISOString(),
    });
  }
  if (articles.length === 0) {
    throw new Error("No engineeringArticle entries found on anthropic.com/engineering");
  }
  return articles;
}

async function fetchPaulGraham() {
  const indexUrl = "https://paulgraham.com/articles.html";
  const html = await fetchText(indexUrl);
  // The articles.html body is a flat list of essay links, newest first.
  // Grab the top 6 — more than enough to cover any realistic window,
  // and cheap enough to fetch in parallel.
  const linkRe = /<a href="([a-z0-9][a-z0-9-]*\.html)">([^<]+)<\/a>/g;
  const newest = [...html.matchAll(linkRe)].slice(0, 6);
  if (newest.length === 0) throw new Error("No essay links found in articles.html");

  const essays = await Promise.all(
    newest.map(async ([, href, title]) => {
      const essayUrl = `https://paulgraham.com/${href}`;
      try {
        const essayHtml = await fetchText(essayUrl);
        const date = extractMonthYear(essayHtml);
        if (!date) return null;
        return {
          title: title.trim(),
          link: essayUrl,
          author: "Paul Graham",
          source: "Paul Graham",
          date: date.toISOString(),
        };
      } catch {
        return null;
      }
    }),
  );
  return essays.filter(Boolean);
}
