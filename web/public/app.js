import {
  createHomeReleaseCard,
  loadPackReleases,
  loadReleases,
  pickPackRelease
} from "./release-data.js?v=20261101-1";
import {
  createHomepageWebsiteUpdate,
  loadWebsiteUpdates
} from "./website-update-data.js?v=20261025-6";
import {
  accelerateDownloadUrl,
  loadDomesticMirror,
  loadDownloadConfig
} from "./download-config.js?v=20261026-1";
import { bindDomesticMirrorCopy } from "./domestic-mirror.js?v=20261025-1";

const elements = {
  packVersion: document.querySelector("#pack-version"),
  gunCount: document.querySelector("#gun-count"),
  repoStars: document.querySelector("#repo-stars"),
  manifestVersion: document.querySelector("#manifest-version"),
  manifestLicense: document.querySelector("#manifest-license"),
  releaseDate: document.querySelector("#release-date"),
  grid: document.querySelector("#gun-grid"),
  repositoryDescription: document.querySelector("#repository-description"),
  repoName: document.querySelector("#repo-name"),
  repoUpdated: document.querySelector("#repo-updated"),
  assetSize: document.querySelector("#asset-size"),
  downloadAccelerated: document.querySelector("#download-accelerated"),
  downloadDirect: document.querySelector("#download-direct"),
  downloadLanzou: document.querySelector("#download-lanzou"),
  recentReleases: document.querySelector("#recent-releases"),
  homepageWebsiteUpdates: document.querySelector("#homepage-website-updates"),
  repoLinks: [
    document.querySelector("#repo-nav-link"),
    document.querySelector("#repo-panel-link")
  ].filter(Boolean)
};

const repositoryConfig = {
  owner: "Skydeps1459",
  repo: "Modern-Warfare-4-TACZ-GunPack"
};

const repositoryUrl = `https://github.com/${repositoryConfig.owner}/${repositoryConfig.repo}`;
const releasesUrl = `${repositoryUrl}/releases`;
let acceleratorPrefix = "https://gh-proxy.com/";
let currentDownloadUrl = null;

const numberFormatter = new Intl.NumberFormat("zh-CN");
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const SCROLL_ANCHOR_IDS = ["arsenal", "updates", "install", "website-log"];
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : dateFormatter.format(date);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function applyRepositoryLinks(url) {
  if (!url) return;
  for (const link of elements.repoLinks) link.href = url;
}

function applyDownloadLinks(url) {
  const target = url || releasesUrl;
  currentDownloadUrl = target;
  elements.downloadAccelerated.href = accelerateDownloadUrl(target, acceleratorPrefix);
  elements.downloadDirect.href = target;
}

async function refreshDownloadAccelerator() {
  const config = await loadDownloadConfig();
  acceleratorPrefix = config.selected.prefix;
  if (currentDownloadUrl) applyDownloadLinks(currentDownloadUrl);
}

let domesticMirrorInFlight = false;
let lastDomesticMirrorAt = 0;
let lastDomesticMirrorKey = null;
let lastLiveMirrorAt = 0;
const MIRROR_REFRESH_MS = 30 * 1000;

async function loadDomesticMirrorLink({ preferLive = false } = {}) {
  if (domesticMirrorInFlight) return;
  // 连续切窗口时别把 GitHub API 的 60 次/小时额度打光
  if (preferLive) {
    if (Date.now() - lastLiveMirrorAt < 10_000) preferLive = false;
    else lastLiveMirrorAt = Date.now();
  }
  domesticMirrorInFlight = true;
  try {
    const mirror = await loadDomesticMirror(undefined, { preferLive });
    if (!mirror) {
      elements.downloadLanzou.hidden = true;
      lastDomesticMirrorKey = "";
      return;
    }
    // 内容没变就不动 DOM，避免每 30 秒重建按钮、重复绑定复制事件
    const key = [mirror.url, mirror.password, mirror.label].join("|");
    if (key === lastDomesticMirrorKey) return;
    lastDomesticMirrorKey = key;
    elements.downloadLanzou.href = mirror.url;
    elements.downloadLanzou.textContent = mirror.password
      ? `${mirror.label} · 密码 ${mirror.password}`
      : mirror.label;
    elements.downloadLanzou.hidden = false;
    bindDomesticMirrorCopy(elements.downloadLanzou, mirror);
  } finally {
    lastDomesticMirrorAt = Date.now();
    domesticMirrorInFlight = false;
  }
}

function createGunCard(gun, index) {
  const article = document.createElement("article");
  article.className = "gun-card";

  const top = document.createElement("div");
  top.className = "gun-card-top";
  const number = document.createElement("span");
  number.textContent = String(index + 1).padStart(2, "0");
  const type = document.createElement("span");
  type.className = "gun-type";
  type.textContent = gun.typeLabel;
  top.append(number, type);

  const imageWrap = document.createElement("div");
  imageWrap.className = "gun-image-wrap";
  const image = document.createElement("img");
  image.className = "gun-image";
  image.src = gun.iconUrl;
  image.alt = `${gun.name} 图标`;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.remove(), { once: true });
  imageWrap.append(image);

  const heading = document.createElement("h3");
  heading.textContent = gun.name;
  const description = document.createElement("p");
  description.textContent = gun.description || "Modern Warfare 4 枪械平台";

  article.append(top, imageWrap, heading, description);
  return article;
}

function renderGuns(guns) {
  elements.grid.replaceChildren();
  if (!Array.isArray(guns) || guns.length === 0) {
    const empty = document.createElement("div");
    empty.className = "loading-panel";
    empty.textContent = "仓库中暂未找到枪械索引。";
    elements.grid.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  guns.forEach((gun, index) => fragment.append(createGunCard(gun, index)));
  elements.grid.append(fragment);
}

function renderStatus(data) {
  const { gunpack, github, githubError } = data;
  elements.packVersion.textContent = gunpack.version;
  elements.gunCount.textContent = numberFormatter.format(gunpack.guns.length);
  elements.manifestVersion.textContent = `MW4 / ${gunpack.version.replace("-Release", "")}`;
  elements.manifestLicense.textContent = gunpack.license;
  renderGuns(gunpack.guns);

  const repository = github?.repository;
  const release = github?.release;
  applyDownloadLinks(release?.downloadUrl);
  if (repository) {
    elements.repoName.textContent = repository.fullName;
    elements.repoStars.textContent = numberFormatter.format(repository.stars);
    elements.repoUpdated.textContent = formatDate(repository.pushedAt || repository.updatedAt);
    elements.repositoryDescription.textContent = repository.description || "仓库已连接。";
    applyRepositoryLinks(repository.url);
  } else {
    elements.repoName.textContent = "GitHub API 暂不可用";
    elements.repoStars.textContent = "--";
    elements.repoUpdated.textContent = "--";
    elements.repositoryDescription.textContent = githubError
      ? "枪包数据已加载；GitHub 状态暂时无法同步。"
      : "等待仓库状态同步。";
  }

  if (release) {
    elements.releaseDate.textContent = formatDate(release.publishedAt);
    elements.assetSize.textContent = release.asset
      ? `${formatBytes(release.asset.size)} / ${numberFormatter.format(release.asset.downloadCount)} 次`
      : release.tag;
  } else {
    elements.releaseDate.textContent = "NO RELEASE";
    elements.assetSize.textContent = "--";
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadFromLocalBackend() {
  return fetchJson(new URL("api/status", document.baseURI), {
    headers: { Accept: "application/json" }
  });
}

async function loadFromGitHubPages() {
  const apiBase = `https://api.github.com/repos/${repositoryConfig.owner}/${repositoryConfig.repo}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const [gunpack, repositoryResult, releases] = await Promise.all([
    fetchJson(new URL("api/gunpack.json", document.baseURI)),
    fetchJson(new URL("api/repository.json", document.baseURI))
      .catch(() => fetchJson(apiBase, { headers }))
      .catch(() => null),
    loadReleases()
  ]);
  const packRelease = pickPackRelease(releases);

  return {
    gunpack,
    github: {
      repository: repositoryResult
        ? {
            owner: repositoryResult.owner?.login || repositoryResult.owner,
            name: repositoryResult.name,
            fullName: repositoryResult.full_name || repositoryResult.fullName,
            url: repositoryResult.html_url || repositoryResult.url,
            description: repositoryResult.description,
            defaultBranch: repositoryResult.default_branch || repositoryResult.defaultBranch,
            stars: repositoryResult.stargazers_count ?? repositoryResult.stars,
            forks: repositoryResult.forks_count ?? repositoryResult.forks,
            openIssues: repositoryResult.open_issues_count ?? repositoryResult.openIssues,
            updatedAt: repositoryResult.updated_at || repositoryResult.updatedAt,
            pushedAt: repositoryResult.pushed_at || repositoryResult.pushedAt
          }
        : null,
      release: packRelease
    },
    githubError: repositoryResult ? null : "GitHub repository status is unavailable.",
    refreshedAt: new Date().toISOString()
  };
}

async function loadStatus() {
  try {
    let data;
    try {
      data = await loadFromLocalBackend();
    } catch {
      data = await loadFromGitHubPages();
    }
    renderStatus(data);
  } catch (error) {
    console.error(error);
    elements.grid.replaceChildren();
    const panel = document.createElement("div");
    panel.className = "loading-panel";
    panel.textContent = "网页后端暂时无法连接，请稍后刷新。";
    elements.grid.append(panel);
    elements.packVersion.textContent = "OFFLINE";
    elements.gunCount.textContent = "--";
    elements.repoStars.textContent = "--";
  }
}

async function loadRecentReleases() {
  try {
    const releases = await loadPackReleases();
    elements.recentReleases.replaceChildren();
    if (releases.length === 0) {
      const empty = document.createElement("div");
      empty.className = "loading-panel";
      empty.textContent = "暂时没有可展示的 Release 更新。";
      elements.recentReleases.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    releases.slice(0, 3).forEach((release) => fragment.append(createHomeReleaseCard(release)));
    elements.recentReleases.append(fragment);
  } catch (error) {
    console.error(error);
    elements.recentReleases.replaceChildren();
    const panel = document.createElement("div");
    panel.className = "loading-panel";
    panel.textContent = "更新日志暂时无法载入，请稍后重试。";
    elements.recentReleases.append(panel);
  }
}

async function loadHomepageWebsiteUpdates() {
  try {
    const updates = await loadWebsiteUpdates();
    elements.homepageWebsiteUpdates.replaceChildren();
    if (updates.length === 0) {
      const empty = document.createElement("div");
      empty.className = "loading-panel";
      empty.textContent = "暂时没有网页更新记录。";
      elements.homepageWebsiteUpdates.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    updates.slice(0, 3).forEach((update) => fragment.append(createHomepageWebsiteUpdate(update)));
    elements.homepageWebsiteUpdates.append(fragment);
  } catch (error) {
    console.error(error);
    elements.homepageWebsiteUpdates.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "loading-panel";
    empty.textContent = "网页更新记录暂时无法载入。";
    elements.homepageWebsiteUpdates.append(empty);
  }
}

let refreshInFlight = false;
let lastRefreshAt = 0;

async function refreshPublicData() {
  if (refreshInFlight || document.visibilityState === "hidden") return;
  refreshInFlight = true;
  try {
    await Promise.allSettled([
      loadStatus(),
      loadRecentReleases(),
      loadHomepageWebsiteUpdates(),
      refreshDownloadAccelerator(),
      loadDomesticMirrorLink()
    ]);
    lastRefreshAt = Date.now();
  } finally {
    refreshInFlight = false;
  }
}

applyDownloadLinks(releasesUrl);
refreshPublicData();
setInterval(refreshPublicData, AUTO_REFRESH_MS);
// 分流按钮单独高频轮询（30 秒）：后端一改，页面最多半分钟内跟上
setInterval(() => {
  if (document.visibilityState === "visible") loadDomesticMirrorLink();
}, MIRROR_REFRESH_MS);
window.addEventListener("online", () => loadDomesticMirrorLink({ preferLive: true }));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  // 回到页面时直接问 GitHub API，拿到的是刚提交的最新值
  loadDomesticMirrorLink({ preferLive: true });
  if (Date.now() - lastRefreshAt >= AUTO_REFRESH_MS) refreshPublicData();
});
window.addEventListener("focus", () => {
  loadDomesticMirrorLink({ preferLive: true });
});

let scrollFrame = 0;

function replaceLocationHash(sectionId) {
  const url = `${window.location.pathname}${window.location.search}${sectionId ? `#${sectionId}` : ""}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
    window.history.replaceState(null, "", url);
  }
}

function syncLocationWithScroll() {
  scrollFrame = 0;
  if (window.scrollY <= 96) {
    replaceLocationHash("");
    return;
  }

  const probe = window.scrollY + Math.min(window.innerHeight * 0.42, 340);
  let currentSection = "";
  for (const sectionId of SCROLL_ANCHOR_IDS) {
    const section = document.getElementById(sectionId);
    if (section && section.offsetTop <= probe) currentSection = sectionId;
  }

  if (currentSection && window.location.hash !== `#${currentSection}`) {
    replaceLocationHash(currentSection);
  }
}

function scheduleScrollLocationSync() {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(syncLocationWithScroll);
}

window.addEventListener("scroll", scheduleScrollLocationSync, { passive: true });
window.addEventListener("hashchange", scheduleScrollLocationSync);
window.addEventListener("resize", scheduleScrollLocationSync);
window.requestAnimationFrame(() => window.requestAnimationFrame(syncLocationWithScroll));
