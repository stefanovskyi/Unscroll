// Pre-rendered builds: the list is in the DOM; we only wire the source filter.
// Dev / file-server preview: if #content still has the “Loading…” placeholder,
// we fetch `articles.json` and render the same markup the generator bakes in.

const htmlEscapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => htmlEscapes[c]);

// Mirrors YOUTUBE_ICON in scripts/generate.mjs — kept in sync so the
// dev-mode hydration path produces the same markup as the pre-rendered
// build.
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

function renderArticleHtml(a) {
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
        `<ul class="day__list">${g.items.map(renderArticleHtml).join("")}</ul>` +
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

async function hydrateIfNeeded() {
  const contentEl = document.getElementById("content");
  if (!contentEl || !contentEl.querySelector("#status")) return;

  try {
    const res = await fetch("./articles.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const snapshot = await res.json();

    const meta = document.getElementById("meta");
    if (meta) {
      meta.innerHTML = renderMetaHtml(snapshot);
      meta.hidden = false;
    }

    contentEl.innerHTML = renderArticlesHtml(snapshot.articles);

    const colophon = document.getElementById("colophon");
    if (colophon) {
      colophon.innerHTML = renderColophonHtml(snapshot);
    }

    const failures = document.getElementById("failures");
    if (failures) {
      failures.innerHTML = renderFailuresHtml(snapshot.failures);
    }
  } catch (err) {
    contentEl.innerHTML =
      `<p class="empty">Could not load <code>articles.json</code>. ` +
      `Run <code>node scripts/generate.mjs</code> (needs network) or open the pre-built page from CI.</p>`;
    console.error(err);
  }
}

function setupFilter() {
  const contentEl = document.getElementById("content");
  const quickFilter = document.getElementById("quick-filter");
  if (!contentEl || !quickFilter) return;

  const pills = [...quickFilter.querySelectorAll(".quick-filter__pill")];
  if (!pills.length) return;

  const existingEmpty = contentEl.querySelector(".empty");
  let emptyState = null;

  function applyFilter() {
    const categories = new Set(
      pills.filter((p) => p.classList.contains("is-active")).map((p) => p.dataset.category),
    );
    let visibleArticles = 0;

    for (const day of contentEl.querySelectorAll(".day")) {
      let anyVisible = false;
      for (const li of day.querySelectorAll(".article")) {
        const matches = categories.has(li.dataset.category || "article");
        li.hidden = !matches;
        if (matches) {
          anyVisible = true;
          visibleArticles++;
        }
      }
      day.hidden = !anyVisible;
    }

    if (visibleArticles === 0 && !existingEmpty) {
      if (!emptyState) {
        emptyState = document.createElement("p");
        emptyState.className = "empty";
        contentEl.appendChild(emptyState);
      }
      emptyState.textContent = "No articles match the selected filters.";
      emptyState.hidden = false;
    } else if (emptyState) {
      emptyState.hidden = true;
    }
  }

  for (const pill of pills) {
    pill.addEventListener("click", () => {
      const isActive = pill.classList.toggle("is-active");
      pill.setAttribute("aria-pressed", isActive ? "true" : "false");
      applyFilter();
    });
  }

  applyFilter();
}

async function main() {
  await hydrateIfNeeded();
  setupFilter();
}

main();
