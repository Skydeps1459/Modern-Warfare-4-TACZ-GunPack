import {
  intlLocale,
  siteBaseUrl,
  uiText
} from "./i18n.js?v=20261101-1";

const dateFormatter = new Intl.DateTimeFormat(intlLocale(), {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function formatWebsiteUpdateDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "--" : dateFormatter.format(date);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function loadWebsiteUpdates(baseUrl = siteBaseUrl()) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const localApi = new URL("api/website-updates", siteBase);
  localApi.searchParams.set("v", Date.now().toString());
  const staticApi = new URL("api/website-updates.json", siteBase);
  staticApi.searchParams.set("v", Date.now().toString());

  for (const source of [localApi, staticApi]) {
    try {
      const payload = await fetchJson(source);
      if (Array.isArray(payload.updates)) {
        return payload.updates.sort((left, right) =>
          new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime()
        );
      }
    } catch (error) {
      console.info(`Website update source unavailable: ${source}`, error.message);
    }
  }
  return [];
}

export function websiteUpdateDetailPath(updateId) {
  return `./website-updates/${encodeURIComponent(updateId)}.html?v=20261101-2`;
}

export function createHomepageWebsiteUpdate(update) {
  const article = document.createElement("article");
  article.className = "home-website-update";

  const meta = document.createElement("div");
  meta.className = "home-website-update-meta";
  const version = document.createElement("span");
  version.textContent = update.id;
  const time = document.createElement("time");
  time.dateTime = update.publishedAt || "";
  time.textContent = formatWebsiteUpdateDate(update.publishedAt);
  meta.append(version, time);

  const heading = document.createElement("h3");
  heading.textContent = update.title;
  const summary = document.createElement("p");
  summary.textContent = update.summary
    || uiText("查看本次网页版本包含的完整变更。", "View the full changes in this website update.");
  const link = document.createElement("a");
  link.href = websiteUpdateDetailPath(update.id);
  link.textContent = uiText("查看完整记录", "View full record");

  article.append(meta, heading, summary, link);
  return article;
}

