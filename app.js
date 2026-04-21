/* Loads articles.json and renders articles grouped by calendar day. */

const DATA_URL = "./articles.json";

const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");
const metaEl = document.getElementById("meta");

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
const metaFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function dayKey(iso) {
  return dayKeyFmt.format(new Date(iso));
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
    const sameByAndSource =
      (a.author || "").trim().toLowerCase() ===
      (a.source || "").trim().toLowerCase();
    const byline = sameByAndSource
      ? el("p", { class: "article__byline" }, a.author)
      : el(
          "p",
          { class: "article__byline" },
          a.author,
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
  const when = metaFmt.format(new Date(snapshot.generatedAt));
  metaEl.hidden = false;
  metaEl.textContent = `Snapshot: ${when} · window: last ${snapshot.windowDays} days · ${snapshot.count} article${snapshot.count === 1 ? "" : "s"}.`;
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
  contentEl.replaceChildren();

  const articles = Array.isArray(snapshot.articles) ? snapshot.articles : [];
  if (articles.length === 0) {
    contentEl.appendChild(
      el(
        "p",
        { class: "empty" },
        "No articles published in the last week.",
      ),
    );
  } else {
    for (const group of groupByDay(articles)) {
      contentEl.appendChild(renderDay(group));
    }
  }

  const failures = renderFailures(snapshot.failures);
  if (failures) contentEl.appendChild(failures);
}

main();
