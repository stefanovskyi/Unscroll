// Source URLs from task.md, mapped to feed URLs where needed.
// Each entry lists one or more candidate feed URLs; the generator tries
// them in order and stops at the first that parses successfully.
//
// `fallbackAuthor` is used when a feed omits per-item author metadata.
// `source` is the human-readable label used in the UI.
// `transform(item)` is an optional per-source hook that runs after the
// default normalizer; return a modified item, or `null` to drop it.

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

export const feeds = [
  {
    source: "Simon Willison",
    fallbackAuthor: "Simon Willison",
    candidates: ["https://simonwillison.net/atom/entries/"],
    transform: simonWillisonTransform,
  },
  {
    source: "The Pragmatic Engineer",
    fallbackAuthor: "Gergely Orosz",
    candidates: [
      "https://newsletter.pragmaticengineer.com/feed",
      "https://www.pragmaticengineer.com/rss/",
    ],
  },
  {
    source: "DHH — HEY World",
    fallbackAuthor: "David Heinemeier Hansson",
    candidates: ["https://world.hey.com/dhh/feed.atom"],
  },
  {
    source: "Martin Fowler",
    fallbackAuthor: "Martin Fowler",
    candidates: ["https://martinfowler.com/feed.atom"],
  },
  {
    source: "Thorsten Ball — Register Spill",
    fallbackAuthor: "Thorsten Ball",
    candidates: [
      "https://registerspill.thorstenball.com/feed",
      "https://registerspill.substack.com/feed",
    ],
  },
  {
    source: "blog.exe.dev",
    fallbackAuthor: "exe.dev",
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
    candidates: ["https://www.seangoedecke.com/rss.xml"],
  },
  {
    source: "Derek Thompson",
    fallbackAuthor: "Derek Thompson",
    candidates: [
      "https://www.derekthompson.org/feed",
      "https://derekthompson.substack.com/feed",
    ],
  },
  {
    source: "Addy Osmani",
    fallbackAuthor: "Addy Osmani",
    candidates: [
      "https://addyosmani.com/feed.xml",
      "https://addyosmani.com/blog/feed.xml",
      "https://addyosmani.com/rss.xml",
    ],
  },
  {
    source: "Humanager (Dima Maleev)",
    fallbackAuthor: "Dima Maleev",
    candidates: ["https://sonerdy.substack.com/feed"],
  },
];
