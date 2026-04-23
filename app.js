/* Loads articles.json and renders articles grouped by calendar day. */

const DATA_URL = "./articles.json";

const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");
const metaEl = document.getElementById("meta");
const filterEl = document.getElementById("filter");
const filterSelect = document.getElementById("filter-source");
const blogrollEl = document.getElementById("blogroll");
const colophonEl = document.getElementById("colophon");
const failuresEl = document.getElementById("failures");

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayHeadingFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const relTimeFmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function dayKey(iso) {
  return dayKeyFmt.format(new Date(iso));
}

function relativeTime(iso) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return relTimeFmt.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relTimeFmt.format(hours, "hour");
  const days = Math.round(hours / 24);
  return relTimeFmt.format(days, "day");
}

function groupByDay(articles) {
  const byDay = new Map();
  for (const a of articles) {
    const key = dayKey(a.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(a);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      date: new Date(items[0].date),
      items: items.sort((x, y) => new Date(y.date) - new Date(x.date)),
    }));
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(
      typeof child === "string" ? document.createTextNode(child) : child,
    );
  }
  return node;
}

function renderDay(group) {
  const list = el("ul", { class: "day__list" });
  for (const a of group.items) {
    const title = el(
      "a",
      { class: "article__title", href: a.link, rel: "noopener", target: "_blank" },
      a.title,
    );
    const authorNode = a.authorUrl
      ? el(
          "a",
          {
            class: "article__author-link",
            href: a.authorUrl,
            rel: "noopener",
            target: "_blank",
          },
          a.author,
        )
      : document.createTextNode(a.author);
    const sameByAndSource =
      (a.author || "").trim().toLowerCase() ===
      (a.source || "").trim().toLowerCase();
    const byline = sameByAndSource
      ? el("p", { class: "article__byline" }, authorNode)
      : el(
          "p",
          { class: "article__byline" },
          authorNode,
          el("span", { class: "article__source" }, ` · ${a.source}`),
        );
    list.appendChild(el("li", { class: "article" }, title, byline));
  }
  return el(
    "section",
    { class: "day", "aria-labelledby": `day-${group.key}` },
    el(
      "h2",
      { class: "day__heading", id: `day-${group.key}` },
      dayHeadingFmt.format(group.date),
    ),
    list,
  );
}

function renderFailures(failures) {
  if (!failures?.length) return null;
  const list = el("ul");
  for (const f of failures) {
    list.appendChild(el("li", {}, `${f.source} — ${f.reason}`));
  }
  return el(
    "div",
    { class: "failures" },
    el(
      "details",
      {},
      el("summary", {}, `${failures.length} feed(s) failed in the last build`),
      list,
    ),
  );
}

function renderMeta(snapshot) {
  const sources = snapshot.sources ?? "?";
  const parts = [
    `${sources} source${sources === 1 ? "" : "s"}`,
    `last ${snapshot.windowDays} days`,
    `updated ${relativeTime(snapshot.generatedAt)}`,
  ];
  metaEl.hidden = false;
  metaEl.textContent = parts.join(" · ");
}

function renderBlogroll(writers) {
  if (!writers?.length) return;
  blogrollEl.replaceChildren();
  writers.forEach((w, i) => {
    if (i > 0) blogrollEl.appendChild(document.createTextNode(" · "));
    if (w.xUrl) {
      blogrollEl.appendChild(
        el(
          "a",
          { href: w.xUrl, rel: "noopener", target: "_blank" },
          w.name,
        ),
      );
    } else {
      blogrollEl.appendChild(
        el("span", { class: "blogroll__plain" }, w.name),
      );
    }
  });
  blogrollEl.hidden = false;
}

function renderColophon(snapshot) {
  colophonEl.replaceChildren(
    document.createTextNode(
      `Snapshot ${new Date(snapshot.generatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })} · ${snapshot.count} article${snapshot.count === 1 ? "" : "s"}.`,
    ),
  );
}

function populateFilter(articles) {
  const sources = [...new Set(articles.map((a) => a.source))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  for (const s of sources) {
    filterSelect.appendChild(el("option", { value: s }, s));
  }
  filterEl.hidden = false;
}

function renderArticles(articles, filterSource) {
  contentEl.replaceChildren();
  const filtered = filterSource
    ? articles.filter((a) => a.source === filterSource)
    : articles;
  if (filtered.length === 0) {
    contentEl.appendChild(
      el(
        "p",
        { class: "empty" },
        filterSource
          ? `No recent articles from ${filterSource}.`
          : "No articles published in the last window.",
      ),
    );
    return;
  }
  for (const group of groupByDay(filtered)) {
    contentEl.appendChild(renderDay(group));
  }
}

async function main() {
  let snapshot;
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    snapshot = await res.json();
  } catch (err) {
    statusEl.textContent = `Could not load articles.json — ${err.message}`;
    return;
  }

  renderMeta(snapshot);
  renderColophon(snapshot);
  renderBlogroll(snapshot.writers);

  const articles = Array.isArray(snapshot.articles) ? snapshot.articles : [];
  populateFilter(articles);
  filterSelect.addEventListener("change", () => {
    renderArticles(articles, filterSelect.value);
  });
  renderArticles(articles, "");

  const failures = renderFailures(snapshot.failures);
  if (failures) failuresEl.appendChild(failures);
}

main();
