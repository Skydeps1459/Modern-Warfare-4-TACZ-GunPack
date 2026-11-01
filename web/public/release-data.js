const repositoryConfig = {
  owner: "Skydeps1459",
  repo: "Modern-Warfare-4-TACZ-GunPack"
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function formatReleaseDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : dateFormatter.format(date);
}

export function formatReleaseBytes(value) {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

export function acceleratedReleaseUrl(url, prefix = "https://gh-proxy.com/") {
  return `${prefix}${url}`;
}

export function releaseAnchor(tag) {
  return `release-${String(tag || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function normalizeRelease(release) {
  if (!release) return null;
  if (release.tag && release.url) return release;
  const zipAsset = (release.assets || []).find((asset) => /\.zip$/i.test(asset.name));
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    url: release.html_url,
    publishedAt: release.published_at,
    body: release.body || "",
    prerelease: Boolean(release.prerelease),
    downloadUrl: zipAsset?.browser_download_url || release.html_url,
    asset: zipAsset
      ? {
          name: zipAsset.name,
          size: zipAsset.size,
          downloadCount: zipAsset.download_count,
          updatedAt: zipAsset.updated_at
        }
      : null
  };
}

export function pickPackRelease(releases) {
  return releases.find((release) => !release.prerelease && release.asset)
    || releases.find((release) => release.asset)
    || releases.find((release) => !release.prerelease)
    || releases[0]
    || null;
}

export function sortReleasesByDate(releases) {
  return releases.sort((left, right) => {
    const leftTime = new Date(left.publishedAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function releaseVersionParts(release) {
  const match = String(release?.tag || "").match(/(?:^|v)(\d+)\.(\d+)\.(\d+)/i);
  return match ? match.slice(1).map(Number) : null;
}

export function sortPackReleasesByVersion(releases) {
  return [...releases].sort((left, right) => {
    const leftVersion = releaseVersionParts(left);
    const rightVersion = releaseVersionParts(right);
    if (leftVersion && rightVersion) {
      for (let index = 0; index < leftVersion.length; index += 1) {
        if (leftVersion[index] !== rightVersion[index]) {
          return rightVersion[index] - leftVersion[index];
        }
      }
    } else if (leftVersion) {
      return -1;
    } else if (rightVersion) {
      return 1;
    }

    const leftTime = new Date(left.publishedAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export function isWebsiteRelease(release) {
  return /^(?:website|web|site)-/i.test(release?.tag || "");
}

export function isPackRelease(release) {
  return Boolean(release?.asset) && !isWebsiteRelease(release);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function loadReleases() {
  const localApi = new URL("api/releases", document.baseURI);
  const staticApi = new URL("api/releases.json", document.baseURI);
  staticApi.searchParams.set("v", Date.now().toString());
  const githubApi = `https://api.github.com/repos/${repositoryConfig.owner}/${repositoryConfig.repo}/releases?per_page=30`;

  for (const source of [localApi, staticApi, githubApi]) {
    try {
      const payload = await fetchJson(source, {
        headers: { Accept: "application/json" }
      });
      const releases = Array.isArray(payload) ? payload : payload.releases;
      if (Array.isArray(releases)) {
        return sortReleasesByDate(releases
          .filter((release) => !release.draft)
          .map(normalizeRelease));
      }
    } catch (error) {
      console.info(`Release source unavailable: ${source}`, error.message);
    }
  }

  return [];
}

export async function loadPackReleases() {
  return sortPackReleasesByVersion((await loadReleases()).filter(isPackRelease));
}

export async function loadWebsiteReleases() {
  return (await loadReleases()).filter(isWebsiteRelease);
}

function appendInlineContent(container, text) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) {
      container.append(document.createTextNode(text.slice(cursor, match.index)));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      container.append(strong);
    } else if (token.startsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      container.append(code);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (linkMatch) {
        const link = document.createElement("a");
        link.textContent = linkMatch[1];
        link.href = linkMatch[2];
        link.rel = "noopener noreferrer";
        link.target = "_blank";
        container.append(link);
      }
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    container.append(document.createTextNode(text.slice(cursor)));
  }
}

export function renderReleaseNotes(markdown, container) {
  container.replaceChildren();
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let list = null;
  let paragraph = null;

  const flush = () => {
    list = null;
    paragraph = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flush();
      const level = Math.min(4, heading[1].length + 1);
      const element = document.createElement(`h${level}`);
      appendInlineContent(element, heading[2]);
      container.append(element);
      continue;
    }

    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      if (!list) {
        list = document.createElement("ul");
        container.append(list);
      }
      const item = document.createElement("li");
      appendInlineContent(item, listItem[1]);
      list.append(item);
      paragraph = null;
      continue;
    }

    if (line.startsWith("> ")) {
      flush();
      const quote = document.createElement("blockquote");
      appendInlineContent(quote, line.slice(2));
      container.append(quote);
      continue;
    }

    if (!paragraph) {
      paragraph = document.createElement("p");
      appendInlineContent(paragraph, line.trim());
      container.append(paragraph);
    } else {
      paragraph.append(document.createTextNode(" "));
      appendInlineContent(paragraph, line.trim());
    }
    list = null;
  }
}

export function extractReleaseSummary(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const isHeading = (line) => /^#{1,4}\s+/.test(line);
  const isListItem = (line) => /^\s*[-*]\s+/.test(line);
  const clean = (line) => line
    .replace(/^#{1,4}\s+/, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();

  const bugHeadingIndex = lines.findIndex((line) => /^#{1,4}\s+.*bug\s*修复/i.test(line));
  const scopedLines = bugHeadingIndex >= 0
    ? lines.slice(bugHeadingIndex + 1)
    : lines;
  const summaryLine = scopedLines.find((line) => line.trim() && !isHeading(line))
    || lines.find((line) => line.trim() && !isListItem(line));
  return summaryLine ? clean(summaryLine).slice(0, 180) : "查看本次版本包含的完整更新内容。";
}

export function createHomeReleaseCard(release) {
  const article = document.createElement("article");
  article.className = "update-card";

  const meta = document.createElement("div");
  meta.className = "update-meta";
  const version = document.createElement("span");
  version.className = "update-version";
  version.textContent = release.tag;
  const time = document.createElement("time");
  time.dateTime = release.publishedAt || "";
  time.textContent = formatReleaseDate(release.publishedAt);
  meta.append(version, time);

  const heading = document.createElement("h3");
  heading.textContent = release.name;
  const summary = document.createElement("p");
  summary.textContent = extractReleaseSummary(release.body);
  const link = document.createElement("a");
  link.className = "update-link";
  link.href = `./changelog.html#${releaseAnchor(release.tag)}`;
  link.textContent = "查看完整更新";

  article.append(meta, heading, summary, link);
  return article;
}

