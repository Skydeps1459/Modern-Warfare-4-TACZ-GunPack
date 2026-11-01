import {
  acceleratedReleaseUrl,
  formatReleaseBytes,
  formatReleaseDate,
  loadPackReleases,
  releaseAnchor,
  renderReleaseNotes
} from "./release-data.js?v=20261101-1";
import {
  loadDomesticMirror,
  loadDownloadConfig
} from "./download-config.js?v=20261026-1";
import { bindDomesticMirrorCopy } from "./domestic-mirror.js?v=20261025-1";

const list = document.querySelector("#changelog-list");
const count = document.querySelector("#release-count");
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function createReleaseEntry(release, acceleratorPrefix, domesticMirror, isLatestPack) {
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
  if (release.asset) {
    const accelerated = document.createElement("a");
    accelerated.className = "button button-primary";
    accelerated.href = acceleratedReleaseUrl(release.downloadUrl, acceleratorPrefix);
    accelerated.rel = "noreferrer";
    accelerated.textContent = "加速下载";
    actions.append(accelerated);
  }
  if (isLatestPack && domesticMirror) {
    const domestic = document.createElement("a");
    domestic.className = "button button-outline";
    domestic.href = domesticMirror.url;
    domestic.rel = "noreferrer";
    domestic.textContent = domesticMirror.password
      ? `${domesticMirror.label} · 密码 ${domesticMirror.password}`
      : domesticMirror.label;
    bindDomesticMirrorCopy(domestic, domesticMirror);
    actions.append(domestic);
  }
  const direct = document.createElement("a");
  direct.className = release.asset ? "button button-ghost" : "button button-outline";
  direct.href = release.url;
  direct.rel = "noreferrer";
  direct.textContent = release.asset ? "GitHub Release ↗" : "查看发行说明 ↗";
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
    asset.textContent = "该版本没有附带 zip 文件";
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
    const [releases, downloadConfig, domesticMirror] = await Promise.all([
      loadPackReleases(),
      loadDownloadConfig(),
      loadDomesticMirror(undefined, { preferLive })
    ]);
    count.textContent = `${releases.length} 个版本`;
    list.replaceChildren();
    if (releases.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty";
      empty.textContent = "暂时没有可展示的 Release 更新日志。";
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    releases.forEach((release, index) =>
      fragment.append(
        createReleaseEntry(
          release,
          downloadConfig.selected.prefix,
          domesticMirror,
          index === 0
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
    empty.textContent = "更新日志暂时无法载入，请稍后重试。";
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

