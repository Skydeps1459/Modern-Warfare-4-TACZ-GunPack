import {
  formatWebsiteUpdateDate,
  loadWebsiteUpdates,
  websiteUpdateDetailPath
} from "./website-update-data.js?v=20261101-2";
import { siteBaseUrl, uiText } from "./i18n.js?v=20261101-1";

const list = document.querySelector("#website-update-list");
const count = document.querySelector("#website-release-count");
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function createWebsiteUpdateEntry(update) {
  const article = document.createElement("article");
  article.className = "release-entry website-release-entry";
  article.id = `web-update-${update.id}`;

  const header = document.createElement("header");
  header.className = "release-entry-header";
  const copy = document.createElement("div");
  const version = document.createElement("span");
  version.className = "update-version";
  version.textContent = update.id;
  const heading = document.createElement("h2");
  heading.textContent = update.title;
  const time = document.createElement("time");
  time.dateTime = update.publishedAt || "";
  time.textContent = formatWebsiteUpdateDate(update.publishedAt);
  copy.append(version, heading, time);

  const actions = document.createElement("div");
  actions.className = "release-actions";
  const detailLink = document.createElement("a");
  detailLink.className = "button button-primary";
  detailLink.href = websiteUpdateDetailPath(update.id);
  detailLink.textContent = uiText("查看完整更新日志", "View full update");
  actions.append(detailLink);
  if (update.releaseUrl) {
    const releaseLink = document.createElement("a");
    releaseLink.className = "button button-ghost";
    releaseLink.href = update.releaseUrl;
    releaseLink.rel = "noreferrer";
    releaseLink.textContent = uiText("GitHub 发行说明 ↗", "GitHub release notes ↗");
    actions.append(releaseLink);
  }
  header.append(copy, actions);

  const facts = document.createElement("div");
  facts.className = "release-facts";
  facts.textContent = uiText(
    `更新 ${update.changes?.length || 0} 项 · 修复 ${update.bugFixes?.length || 0} 项 · 不提供网站文件下载`,
    `${update.changes?.length || 0} changes · ${update.bugFixes?.length || 0} fixes · Website files are not provided for download`
  );

  const notes = document.createElement("div");
  notes.className = "release-notes website-release-notes";
  const summary = document.createElement("p");
  summary.textContent = update.summary
    || uiText("查看本次网页版本包含的完整变更。", "View the full changes in this website update.");
  notes.append(summary);

  article.append(header, facts, notes);
  return article;
}

function scrollToCurrentHash() {
  const encodedId = window.location.hash.slice(1);
  if (!encodedId) return;

  let targetId = encodedId;
  try {
    targetId = decodeURIComponent(encodedId);
  } catch {
    // Keep the original fragment when it is not valid percent-encoding.
  }

  document.getElementById(targetId)?.scrollIntoView({ block: "start" });
}

async function renderWebsiteUpdates() {
  try {
    const updates = await loadWebsiteUpdates(siteBaseUrl());
    count.textContent = uiText(
      `${updates.length} 次网页更新`,
      `${updates.length} website updates`
    );
    list.replaceChildren();

    if (updates.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty";
      empty.textContent = uiText(
        "暂时没有网页更新记录。",
        "No website updates are available yet."
      );
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    updates.forEach((update) => fragment.append(createWebsiteUpdateEntry(update)));
    list.append(fragment);

    scrollToCurrentHash();
  } catch (error) {
    console.error(error);
    list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = uiText(
      "网页更新记录暂时无法载入，请稍后重试。",
      "Website updates could not be loaded. Please try again later."
    );
    list.append(empty);
  }
}

let refreshInFlight = false;

async function refreshWebsiteUpdates() {
  if (refreshInFlight || document.visibilityState === "hidden") return;
  refreshInFlight = true;
  try {
    await renderWebsiteUpdates();
  } finally {
    refreshInFlight = false;
  }
}

refreshWebsiteUpdates();
setInterval(refreshWebsiteUpdates, AUTO_REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshWebsiteUpdates();
});

