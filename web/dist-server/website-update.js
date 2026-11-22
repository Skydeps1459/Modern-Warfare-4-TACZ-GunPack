import {
  formatWebsiteUpdateDate,
  loadWebsiteUpdates
} from "./website-update-data.js?v=20261101-2";
import { siteBaseUrl, uiText } from "./i18n.js?v=20261101-1";

const shell = document.querySelector("#website-update-detail");
const crumb = document.querySelector("#website-detail-crumb");
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function createChangeSection(title, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const section = document.createElement("section");
  section.className = "website-change-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const changes = document.createElement("ul");
  for (const item of items) {
    const entry = document.createElement("li");
    entry.textContent = item;
    changes.append(entry);
  }
  section.append(heading, changes);
  return section;
}

function requestedUpdateId() {
  const params = new URLSearchParams(window.location.search);
  const pathId = window.location.pathname.match(/\/website-updates\/([^/]+)\.html$/i)?.[1];
  return document.documentElement.dataset.updateId
    || (pathId ? decodeURIComponent(pathId) : null)
    || params.get("id")
    || window.location.hash.replace(/^#web-update-/, "");
}

function renderUpdate(update) {
  crumb.textContent = update.id;
  document.title = uiText(
    `${update.id} // 网页更新 // Modern Warfare 4 TACZ`,
    `${update.id} // Website Update // Modern Warfare 4 TACZ`
  );

  const article = document.createElement("article");
  article.className = "release-entry website-release-entry website-detail-card";

  const header = document.createElement("header");
  header.className = "release-entry-header";
  const copy = document.createElement("div");
  const version = document.createElement("span");
  version.className = "update-version";
  version.textContent = update.id;
  const heading = document.createElement("h1");
  heading.textContent = update.title;
  const time = document.createElement("time");
  time.dateTime = update.publishedAt || "";
  time.textContent = formatWebsiteUpdateDate(update.publishedAt);
  copy.append(version, heading, time);

  const actions = document.createElement("div");
  actions.className = "release-actions";
  if (update.releaseUrl) {
    const releaseLink = document.createElement("a");
    releaseLink.className = "button button-ghost";
    releaseLink.href = update.releaseUrl;
    releaseLink.rel = "noreferrer";
    releaseLink.textContent = uiText("GitHub 发行说明 ↗", "GitHub release notes ↗");
    actions.append(releaseLink);
  }
  const backLink = document.createElement("a");
  backLink.className = "button button-outline";
  backLink.href = new URL("../website-updates.html?v=20261101-2", document.baseURI);
  backLink.textContent = uiText("返回网页更新", "Back to website updates");
  actions.append(backLink);
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
  summary.className = "website-detail-summary";
  summary.textContent = update.summary
    || uiText("查看本次网页版本包含的完整变更。", "View the full changes in this website update.");
  notes.append(summary);

  const changes = createChangeSection(uiText("完整更新内容", "Full update details"), update.changes);
  if (changes) notes.append(changes);
  const bugFixes = createChangeSection(uiText("问题修复", "Fixes"), update.bugFixes);
  if (bugFixes) notes.append(bugFixes);

  article.append(header, facts, notes);
  shell.replaceChildren(article);
}

async function renderWebsiteUpdateDetail() {
  const id = requestedUpdateId();
  if (!id) {
    shell.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = uiText(
      "没有指定网页更新版本，请从网页更新列表进入。",
      "No website update version was specified. Open one from the website update list."
    );
    shell.append(empty);
    return;
  }

  try {
    const updates = await loadWebsiteUpdates(siteBaseUrl());
    const update = updates.find((item) => item.id === id);
    if (!update) {
      shell.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "log-empty";
      empty.textContent = uiText(
        `没有找到网页更新版本：${id}`,
        `Website update not found: ${id}`
      );
      shell.append(empty);
      return;
    }
    renderUpdate(update);
  } catch (error) {
    console.error(error);
    shell.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = uiText(
      "网页更新详情暂时无法载入，请稍后重试。",
      "Website update details could not be loaded. Please try again later."
    );
    shell.append(empty);
  }
}

let refreshInFlight = false;

async function refreshDetail() {
  if (refreshInFlight || document.visibilityState === "hidden") return;
  refreshInFlight = true;
  try {
    await renderWebsiteUpdateDetail();
  } finally {
    refreshInFlight = false;
  }
}

refreshDetail();
setInterval(refreshDetail, AUTO_REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshDetail();
});

