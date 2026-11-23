import { isEnglish, uiText } from "./i18n.js?v=20261101-1";

// 全站移动端快捷定位侧边栏：浮动按钮开合抽屉，按当前页面动态收集锚点。
const MOBILE_QUERY = "(max-width: 760px)";
const media = window.matchMedia(MOBILE_QUERY);

const root = document.createElement("div");
root.className = "quicknav";
root.innerHTML = `
  <button class="quicknav-toggle" type="button" aria-expanded="false" aria-controls="quicknav-panel">
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
      <circle cx="19" cy="12" r="2" fill="currentColor"/>
    </svg>
    <span class="quicknav-toggle-label"></span>
  </button>
  <div class="quicknav-backdrop" hidden></div>
  <aside class="quicknav-panel" id="quicknav-panel" aria-label="">
    <div class="quicknav-head">
      <span class="quicknav-title"></span>
      <button class="quicknav-close" type="button" aria-label="">×</button>
    </div>
    <div class="quicknav-body">
      <p class="quicknav-empty" hidden></p>
    </div>
  </aside>
`;
document.body.append(root);

const toggle = root.querySelector(".quicknav-toggle");
const toggleLabel = root.querySelector(".quicknav-toggle-label");
const backdrop = root.querySelector(".quicknav-backdrop");
const panel = root.querySelector(".quicknav-panel");
const title = root.querySelector(".quicknav-title");
const closeBtn = root.querySelector(".quicknav-close");
const body = root.querySelector(".quicknav-body");
const emptyNote = root.querySelector(".quicknav-empty");

toggleLabel.textContent = uiText("定位", "Jump");
title.textContent = uiText("快捷定位", "Quick jump");
panel.setAttribute("aria-label", uiText("快捷定位", "Quick jump"));
closeBtn.setAttribute("aria-label", uiText("关闭快捷定位", "Close quick jump"));
emptyNote.textContent = uiText("正在载入可定位内容…", "Loading jump targets…");
toggle.setAttribute("aria-label", uiText("打开快捷定位", "Open quick jump"));

let lastItems = [];
let activeId = null;
let scrollScheduled = false;

function textOf(node) {
  return (node?.textContent || "").replace(/\s+/g, " ").trim();
}

function anchorItem(id, label) {
  const target = id ? document.getElementById(id) : null;
  if (!target || !label) return null;
  return { id, label, target };
}

function entryItems(container) {
  const items = [];
  container?.querySelectorAll("article.release-entry[id]").forEach((entry) => {
    const version = textOf(entry.querySelector(".update-version"));
    const heading = textOf(entry.querySelector(".release-entry-header h2, .release-entry-header h1"));
    const label = version && heading ? `${version} · ${heading}` : version || heading;
    const item = anchorItem(entry.id, label);
    if (item) items.push(item);
  });
  return items;
}

function collectItems() {
  const items = [];
  const path = window.location.pathname;

  if (/\/changelog\.html$/i.test(path)) {
    return entryItems(document.querySelector("#changelog-list"));
  }
  if (/\/website-updates\.html$/i.test(path)) {
    return entryItems(document.querySelector("#website-update-list"));
  }
  if (/\/website-updates\/[^/]+\.html$/i.test(path)) {
    const article = document.querySelector("#website-update-detail article");
    if (article) {
      article.querySelectorAll(".website-change-section").forEach((section, index) => {
        if (!section.id) section.id = `quicknav-section-${index}`;
        const item = anchorItem(section.id, textOf(section.querySelector("h3")));
        if (item) items.push(item);
      });
    }
    return items;
  }

  // 首页与其他页面：按页面章节收集锚点
  const sectionSelectors = [
    ["#thanks", uiText("特别感谢", "Special thanks")],
    ["#arsenal", uiText("军械库", "Armory")],
    ["#updates", uiText("更新与日志", "Updates & logs")],
    ["#install", uiText("四步部署", "Deployment")],
    ["#repository", uiText("仓库与发布同步", "Repository")],
    ["#website-log", uiText("网页更新记录", "Website updates")]
  ];
  for (const [selector, fallback] of sectionSelectors) {
    const section = document.querySelector(selector);
    if (!section) continue;
    if (!section.id) section.id = selector.slice(1);
    const label = textOf(section.querySelector(".section-heading h2, h2")) || fallback;
    const item = anchorItem(section.id, label);
    if (item) items.push(item);
  }
  if (items.length === 0) {
    document.querySelectorAll("main section[id]").forEach((section) => {
      const label = textOf(section.querySelector("h2, h1"));
      const item = anchorItem(section.id, label);
      if (item) items.push(item);
    });
  }
  return items;
}

function sameItems(a, b) {
  return a.length === b.length && a.every((item, index) => item.id === b[index].id && item.label === b[index].label);
}

function renderList(items) {
  body.querySelectorAll(".quicknav-link").forEach((link) => link.remove());
  emptyNote.hidden = items.length > 0;
  for (const item of items) {
    const link = document.createElement("a");
    link.className = "quicknav-link";
    link.href = `#${encodeURIComponent(item.id)}`;
    link.dataset.target = item.id;
    link.textContent = item.label;
    if (item.id === activeId) link.classList.add("is-active");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closePanel();
      try {
        history.pushState(null, "", `#${encodeURIComponent(item.id)}`);
      } catch {
        window.location.hash = item.id;
      }
      const target = document.getElementById(item.id);
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    body.append(link);
  }
}

function refresh() {
  const items = collectItems();
  if (!sameItems(items, lastItems)) {
    lastItems = items;
    renderList(items);
  }
  syncActive();
}

function syncActive() {
  if (lastItems.length === 0) return;
  const probe = window.scrollY + 150;
  let current = lastItems[0];
  for (const item of lastItems) {
    const top = item.target.getBoundingClientRect().top + window.scrollY;
    if (top <= probe) current = item;
    else break;
  }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
    current = lastItems[lastItems.length - 1];
  }
  if (current.id === activeId) return;
  activeId = current.id;
  body.querySelectorAll(".quicknav-link").forEach((link) => {
    const isActive = link.dataset.target === activeId;
    link.classList.toggle("is-active", isActive);
    if (isActive && root.classList.contains("is-open")) {
      link.scrollIntoView({ block: "nearest" });
    }
  });
}

function openPanel() {
  refresh();
  root.classList.add("is-open");
  backdrop.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  document.documentElement.classList.add("quicknav-open");
}

function closePanel() {
  if (!root.classList.contains("is-open")) return;
  root.classList.remove("is-open");
  backdrop.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  document.documentElement.classList.remove("quicknav-open");
}

toggle.addEventListener("click", () => {
  if (root.classList.contains("is-open")) closePanel();
  else openPanel();
});
closeBtn.addEventListener("click", closePanel);
backdrop.addEventListener("click", closePanel);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanel();
});

window.addEventListener("scroll", () => {
  if (scrollScheduled) return;
  scrollScheduled = true;
  requestAnimationFrame(() => {
    scrollScheduled = false;
    syncActive();
  });
}, { passive: true });

media.addEventListener("change", (event) => {
  root.hidden = !event.matches;
  if (!event.matches) closePanel();
});
root.hidden = !media.matches;

// 列表由页面脚本异步渲染（且每 5 分钟自动刷新），用 MutationObserver 跟随重建
const observed = [];
for (const selector of ["#changelog-list", "#website-update-list", "#website-update-detail", "main"]) {
  const node = document.querySelector(selector);
  if (node && !observed.includes(node)) {
    new MutationObserver(() => refresh()).observe(node, { childList: true, subtree: true });
    observed.push(node);
  }
}

refresh();
