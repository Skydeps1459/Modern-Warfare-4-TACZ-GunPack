import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  normalizeRelease,
  readGunPackManifest,
  readWebsiteUpdates,
  sortReleasesByDate
} from "../server.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const projectRoot = resolve(webDir, "..");
const repositoryOwner = process.env.GITHUB_OWNER || "Skydeps1459";
const repositoryName = process.env.GITHUB_REPO || "Modern-Warfare-4-TACZ-GunPack";
const DEFAULT_MIRROR = {
  id: "gh-proxy",
  name: "gh-proxy.com",
  prefix: "https://gh-proxy.com/"
};

export async function fetchStaticReleases({
  owner = repositoryOwner,
  repo = repositoryName,
  token = process.env.GITHUB_TOKEN
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mw4-gunpack-pages-build",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=30`,
      { headers, signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const releases = await response.json();
    return sortReleasesByDate(releases.filter((release) => !release.draft).map(normalizeRelease));
  } catch (error) {
    console.warn(`Could not snapshot GitHub Releases: ${error.message}`);
    return [];
  }
}

export async function fetchStaticRepository({
  owner = repositoryOwner,
  repo = repositoryName,
  token = process.env.GITHUB_TOKEN
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mw4-gunpack-pages-build",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers, signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const repository = await response.json();
    return {
      owner,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      description: repository.description,
      defaultBranch: repository.default_branch,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      openIssues: repository.open_issues_count,
      updatedAt: repository.updated_at,
      pushedAt: repository.pushed_at
    };
  } catch (error) {
    console.warn(`Could not snapshot GitHub repository status: ${error.message}`);
    return null;
  }
}

export function toStaticManifest(manifest) {
  return {
    ...manifest,
    guns: manifest.guns.map((gun) => ({
      ...gun,
      iconUrl: `${gun.iconUrl}.png`
    }))
  };
}

export function toDetailPage(template, updateId) {
  if (!/^[a-z0-9._-]+$/i.test(updateId)) {
    throw new Error(`Invalid website update id: ${updateId}`);
  }
  return template.replaceAll("{{UPDATE_ID}}", updateId);
}

export async function probeDownloadMirror(mirror, downloadUrl, timeoutMs = 9_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${mirror.prefix}${downloadUrl}`, {
      headers: { Range: "bytes=0-65535" },
      redirect: "follow",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") || "";
    if (![200, 206].includes(response.status)) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (/text\/html|application\/json/i.test(contentType)) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const reader = response.body?.getReader();
    const firstChunk = reader ? await reader.read() : { value: null, done: true };
    await reader?.cancel();
    const bytes = firstChunk.value?.byteLength || 0;
    if (bytes === 0) throw new Error("Empty response");

    return {
      ...mirror,
      ok: true,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
      bytes
    };
  } catch (error) {
    return {
      ...mirror,
      ok: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function buildDownloadConfig(downloadUrl, mirrors) {
  if (!downloadUrl) {
    return {
      generatedAt: new Date().toISOString(),
      directUrl: null,
      selected: DEFAULT_MIRROR,
      fallback: null,
      acceleratedUrl: null,
      probes: []
    };
  }

  const probes = await Promise.all(
    mirrors.map((mirror) => probeDownloadMirror(mirror, downloadUrl))
  );
  const working = probes
    .filter((probe) => probe.ok)
    .sort((left, right) => left.latencyMs - right.latencyMs);
  const selected = working[0] || DEFAULT_MIRROR;
  const fallback = working[1] || null;

  return {
    generatedAt: new Date().toISOString(),
    directUrl: downloadUrl,
    selected,
    fallback,
    acceleratedUrl: `${selected.prefix}${downloadUrl}`,
    excludedHosts: ["gh.my-website.ccwu.cc"],
    probes
  };
}

export function downloadConfigFromSelection(downloadUrl, selection) {
  if (!downloadUrl) {
    return {
      generatedAt: new Date().toISOString(),
      directUrl: null,
      selected: DEFAULT_MIRROR,
      fallback: null,
      acceleratedUrl: null,
      probes: []
    };
  }

  const selected = selection?.selected?.prefix
    ? selection.selected
    : DEFAULT_MIRROR;
  return {
    generatedAt: selection?.generatedAt || new Date().toISOString(),
    directUrl: downloadUrl,
    selected,
    fallback: selection?.fallback || null,
    acceleratedUrl: `${selected.prefix}${downloadUrl}`,
    excludedHosts: selection?.excludedHosts || ["gh.my-website.ccwu.cc"],
    probes: selection?.probes || []
  };
}

export async function buildStaticSite() {
  const publicDir = join(webDir, "public");
  const distDir = join(webDir, "dist");
  const iconSourceDir = join(projectRoot, "assets", "mw4", "textures", "gun", "slot");
  const iconOutputDir = join(distDir, "api", "icons");
  const detailOutputDir = join(distDir, "website-updates");
  const englishDetailOutputDir = join(distDir, "en", "website-updates");

  await rm(distDir, { recursive: true, force: true });
  await mkdir(iconOutputDir, { recursive: true });
  await mkdir(detailOutputDir, { recursive: true });
  const publicEntries = await readdir(publicDir);
  for (const name of publicEntries) {
    if (!name.includes(".bak")) {
      await cp(join(publicDir, name), join(distDir, name), { recursive: true });
    }
  }
  await mkdir(englishDetailOutputDir, { recursive: true });

  const [manifest, releases, repository, downloadedSelection] = await Promise.all([
    readGunPackManifest(),
    fetchStaticReleases(),
    fetchStaticRepository(),
    readFile(join(webDir, "download-selection.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null)
  ]);
  const packRelease = releases.find((release) =>
    release.asset && !/^website-/i.test(release.tag)
  );
  const downloadConfig = downloadConfigFromSelection(
    packRelease?.downloadUrl || null,
    downloadedSelection
  );
  const staticManifest = toStaticManifest(manifest);
  await writeFile(join(distDir, "api", "gunpack.json"), `${JSON.stringify(staticManifest, null, 2)}\n`, "utf8");
  await writeFile(join(distDir, "api", "releases.json"), `${JSON.stringify(releases, null, 2)}\n`, "utf8");
  await writeFile(join(distDir, "api", "repository.json"), `${JSON.stringify(repository, null, 2)}\n`, "utf8");
  await writeFile(
    join(distDir, "api", "download-config.json"),
    `${JSON.stringify(downloadConfig, null, 2)}\n`,
    "utf8"
  );
  await cp(join(webDir, "website-updates.json"), join(distDir, "api", "website-updates.json"));
  await cp(join(webDir, "domestic-mirror.json"), join(distDir, "api", "domestic-mirror.json"));

  const [detailTemplate, englishDetailTemplate, websiteUpdates] = await Promise.all([
    readFile(join(webDir, "templates", "website-update-detail.html"), "utf8"),
    readFile(join(webDir, "templates", "website-update-detail-en.html"), "utf8"),
    readWebsiteUpdates()
  ]);
  for (const update of websiteUpdates) {
    await writeFile(
      join(detailOutputDir, `${update.id}.html`),
      toDetailPage(detailTemplate, update.id),
      "utf8"
    );
    await writeFile(
      join(englishDetailOutputDir, `${update.id}.html`),
      toDetailPage(englishDetailTemplate, update.id),
      "utf8"
    );
  }

  const iconNames = new Set(manifest.guns.map((gun) => `${gun.id}.png`));
  const sourceFiles = await readdir(iconSourceDir);
  for (const name of sourceFiles) {
    if (iconNames.has(name)) {
      await cp(join(iconSourceDir, name), join(iconOutputDir, name));
    }
  }

  console.log(
    `Built static site: ${manifest.version}, ${manifest.guns.length} guns, ` +
      `${releases.length} releases, ${websiteUpdates.length} website detail pages in Chinese and English`
  );
  console.log(
    `Download accelerator: ${downloadConfig.selected.name} ` +
      `(${downloadConfig.selected.latencyMs == null ? "fallback" : `${downloadConfig.selected.latencyMs} ms`})`
  );
  return staticManifest;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  await buildStaticSite();
}

