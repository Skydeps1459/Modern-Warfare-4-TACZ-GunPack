import {
  acceleratedReleaseUrl,
  formatReleaseBytes,
  formatReleaseDate,
  loadPackReleases,
  releaseAnchor,
  renderReleaseNotes
} from "./release-data.js?v=20261101-3";
import {
  loadAcceleratorSwitch,
  loadDownloadConfig,
  loadQuarkMirror
} from "./download-config.js?v=20261125-1";
import { bindDomesticMirrorCopy } from "./domestic-mirror.js?v=20261101-2";
import {
  isEnglish,
  siteBaseUrl,
  uiText
} from "./i18n.js?v=20261101-1";

const list = document.querySelector("#changelog-list");
const count = document.querySelector("#release-count");
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const COMPACT_QUERY = "(max-width: 760px)";
const compactMedia = typeof window !== "undefined" && typeof window.matchMedia === "function"
  ? window.matchMedia(COMPACT_QUERY)
  : null;

// 移动端不展示加速下载按钮：窄屏下按钮组只保留分流与 GitHub 原链。
function isCompactViewport() {
  return compactMedia ? compactMedia.matches : false;
}

function createReleaseEntry(release, acceleratorPrefix, quarkMirror, isLatestPack, acceleratorEnabled) {
  const article = document.createElement("article");
  article.className = "release-entry";
  article.id = releaseAnchor(release.tag);

  const header = document.createElement("header");
  header.className = "release-entry-header";
  const copy = document.createElement("div");
  const tag = document.createElement("span");
  tag.className = "update-version";
  tag.textContent = release.tag;
  const heading = document.createElement("h2");
  heading.textContent = release.name;
  const time = document.createElement("time");
  time.dateTime = release.publishedAt || "";
  time.textContent = formatReleaseDate(release.publishedAt);
  copy.append(tag, heading, time);

  const actions = document.createElement("div");
  actions.className = "release-actions";
  // 加速下载受后台总开关控制：默认关闭时不渲染加速按钮，GitHub 原链转为主按钮。
  // 移动端（≤760px）一律不展示加速按钮，只保留分流与 GitHub 原链。
  const showAccelerator = acceleratorEnabled && !isCompactViewport();
  if (release.asset && showAccelerator) {
    const accelerated = document.createElement("a");
    accelerated.className = "button button-primary";
    accelerated.href = acceleratedReleaseUrl(release.downloadUrl, acceleratorPrefix);
    accelerated.rel = "noreferrer";
    accelerated.textContent = uiText("加速下载", "Accelerated download");
    actions.append(accelerated);
  }
  // 蓝奏云下载按钮与入口已永久移除：关闭提示信息也已下线，不再渲染
  // 详细更新页国内分流展示夸克网盘（移动云盘分流仅保留在主页下载区）
  if (isLatestPack && quarkMirror) {
    const quark = document.createElement("a");
    quark.className = "button button-outline";
    quark.href = quarkMirror.url;
    quark.rel = "noreferrer";
    const quarkLabel = isEnglish() ? "Quark Cloud mirror" : quarkMirror.label;
    quark.textContent = quarkMirror.password
      ? (isEnglish()
          ? `${quarkLabel} · Password ${quarkMirror.password}`
          : `${quarkLabel} · 密码 ${quarkMirror.password}`)
      : quarkLabel;
    bindDomesticMirrorCopy(quark, quarkMirror);
    actions.append(quark);
  }
  const direct = document.createElement("a");
  direct.className = release.asset
    ? (showAccelerator ? "button button-ghost" : "button button-primary")
    : "button button-outline";
  direct.href = release.url;
  direct.rel = "noreferrer";
  direct.textContent = release.asset
    ? "GitHub Release ↗"
    : uiText("查看发行说明 ↗", "View release notes ↗");
  actions.append(direct);
  header.append(copy, actions);

  const facts = document.createElement("div");
  facts.className = "release-facts";
  if (release.asset) {
    const asset = document.createElement("span");
    asset.textContent = `${release.asset.name} · ${formatReleaseBytes(release.asset.size)}`;
    facts.append(asset);
  } else {
    const asset = document.createElement("span");
    asset.textContent = uiText(
      "该版本没有附带 zip 文件",
      "This release has no ZIP asset"
    );
    facts.append(asset);
  }

  const notes = document.createElement("div");
  notes.className = "release-notes";
  renderReleaseNotes(release.body, notes);

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

async function renderChangelog({ preferLive = false } = {}) {
  try {
    const [releases, downloadConfig, quarkMirror, acceleratorSwitch] = await Promise.all([
      loadPackReleases(),
      loadDownloadConfig(siteBaseUrl()),
      loadQuarkMirror(siteBaseUrl(), { preferLive }),
      loadAcceleratorSwitch(siteBaseUrl(), { preferLive })
    ]);
    const acceleratorEnabled = acceleratorSwitch.enabled === true;
    count.textContent = uiText(
      `${releases.length} 个版本`,
      `${releases.length} releases`
    );
    list.replaceChildren();
    if (releases.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty";
      empty.textContent = uiText(
        "暂时没有可展示的 Release 更新日志。",
        "No release notes are available yet."
      );
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    releases.forEach((release, index) =>
      fragment.append(
        createReleaseEntry(
          release,
          downloadConfig.selected.prefix,
          quarkMirror,
          index === 0,
          acceleratorEnabled
        )
      )
    );
    list.append(fragment);

    scrollToCurrentHash();
  } catch (error) {
    console.error(error);
    list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = uiText(
      "更新日志暂时无法载入，请稍后重试。",
      "Release notes could not be loaded. Please try again later."
    );
    list.append(empty);
  }
}

let refreshInFlight = false;

async function refreshChangelog({ preferLive = false } = {}) {
  if (refreshInFlight || document.visibilityState === "hidden") return;
  refreshInFlight = true;
  try {
    await renderChangelog({ preferLive });
  } finally {
    refreshInFlight = false;
  }
}

refreshChangelog();
setInterval(refreshChangelog, AUTO_REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshChangelog({ preferLive: true });
});

// 视口跨过移动端断点时重绘，保证加速按钮的显隐始终与当前屏幕宽度一致。
if (compactMedia) {
  const onCompactChange = () => {
    refreshChangelog();
  };
  if (typeof compactMedia.addEventListener === "function") {
    compactMedia.addEventListener("change", onCompactChange);
  } else if (typeof compactMedia.addListener === "function") {
    compactMedia.addListener(onCompactChange);
  }
}

