import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";

const serverDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverDir, "..");
const publicDir = join(serverDir, "public");
const websiteUpdatesPath = join(serverDir, "website-updates.json");
const domesticMirrorPath = join(serverDir, "domestic-mirror.json");
const adminDir = join(serverDir, "admin");
const gunpackRoot = join(projectRoot, "assets", "mw4");
const gunIndexRoot = join(projectRoot, "data", "mw4", "index", "guns");
const gunIconRoot = join(projectRoot, "assets", "mw4", "textures", "gun", "slot");

const cache = {
  gunpack: null,
  gunpackAt: 0,
  github: null,
  githubAt: 0,
  githubError: null
};

const GUNPACK_CACHE_MS = 30_000;
const GITHUB_CACHE_MS = 5 * 60_000;
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60_000;
const ADMIN_GITHUB_ID = Number(process.env.ADMIN_GITHUB_ID || 317516594);
const ADMIN_GITHUB_LOGIN = process.env.ADMIN_GITHUB_LOGIN || "Skydeps1459";
const ADMIN_REPOSITORY_OWNER = process.env.GITHUB_OWNER || "Skydeps1459";
const ADMIN_REPOSITORY_NAME = process.env.GITHUB_REPO || "Modern-Warfare-4-TACZ-GunPack";
const ALLOWED_MIRROR_HOSTS = (process.env.ALLOWED_MIRROR_HOSTS
  || "lanzouc.com,lanzoux.com,lanzoui.com,lanzou.com")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const adminSessions = new Map();
const oauthStates = new Map();

const staticFiles = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/changelog.html", { file: "changelog.html", type: "text/html; charset=utf-8" }],
  ["/website-updates.html", { file: "website-updates.html", type: "text/html; charset=utf-8" }],
  ["/website-update.html", { file: "website-update.html", type: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/changelog.js", { file: "changelog.js", type: "text/javascript; charset=utf-8" }],
  ["/website-updates.js", { file: "website-updates.js", type: "text/javascript; charset=utf-8" }],
  ["/website-update.js", { file: "website-update.js", type: "text/javascript; charset=utf-8" }],
  ["/website-update-redirect.js", { file: "website-update-redirect.js", type: "text/javascript; charset=utf-8" }],
  ["/website-update-data.js", { file: "website-update-data.js", type: "text/javascript; charset=utf-8" }],
  ["/download-config.js", { file: "download-config.js", type: "text/javascript; charset=utf-8" }],
  ["/domestic-mirror.js", { file: "domestic-mirror.js", type: "text/javascript; charset=utf-8" }],
  ["/release-data.js", { file: "release-data.js", type: "text/javascript; charset=utf-8" }]
]);

const mimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"]
]);

const gunTypeLabels = {
  rifle: "突击步枪",
  sniper: "狙击步枪",
  pistol: "手枪",
  smg: "冲锋枪",
  shotgun: "霰弹枪",
  lmg: "轻机枪",
  mg: "机枪",
  dmr: "精确射手步枪",
  launcher: "发射器"
};

class GitHubRequestError extends Error {
  constructor(status, body) {
    super(`GitHub API ${status}: ${body}`);
    this.name = "GitHubRequestError";
    this.status = status;
  }
}

function stripJsonComments(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      index += 1;
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      index += 1;
      continue;
    }

    if (char === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      index = end === -1 ? text.length : end + 2;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

async function readJson(file) {
  const source = await readFile(file, "utf8");
  try {
    return JSON.parse(source);
  } catch {
    return JSON.parse(stripJsonComments(source));
  }
}

async function readConfig() {
  try {
    return await readJson(join(serverDir, "config.json"));
  } catch {
    return {};
  }
}

export function isAuthorizedGitHubUser(user, adminId = ADMIN_GITHUB_ID) {
  return Number(user?.id) === Number(adminId);
}

export function validateDomesticMirror(input, allowedHosts = ALLOWED_MIRROR_HOSTS) {
  const label = String(input?.label || "蓝奏云国内分流").trim();
  const password = String(input?.password || "").trim();
  if (!label || label.length > 60) {
    throw new Error("分流名称必须为 1-60 个字符。");
  }
  if (password.length > 32) {
    throw new Error("分享密码不能超过 32 个字符。");
  }

  let url;
  try {
    url = new URL(String(input?.url || "").trim());
  } catch {
    throw new Error("请输入有效的蓝奏云链接。");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("分流链接必须使用 HTTP 或 HTTPS。");
  }
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    throw new Error("链接域名不在允许的蓝奏云列表中。");
  }

  return { label, url: url.href, password };
}

function parseCookies(request) {
  const result = {};
  for (const part of String(request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    result[name] = decodeURIComponent(part.slice(separator + 1).trim());
  }
  return result;
}

function isSecureRequest(request) {
  const forwarded = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return forwarded === "https" || request.socket.encrypted === true;
}

function appendSetCookie(response, cookie) {
  const existing = response.getHeader("Set-Cookie");
  if (!existing) response.setHeader("Set-Cookie", cookie);
  else response.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookie] : [existing, cookie]);
}

function sessionCookie(request, value, maxAgeSeconds) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `mw4_admin_session=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function currentAdminSession(request) {
  const sessionId = parseCookies(request).mw4_admin_session;
  if (!sessionId) return null;
  const session = adminSessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(sessionId);
    return null;
  }
  return { sessionId, ...session };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function oauthConfigured() {
  return Boolean(process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET);
}

function publicBaseUrl(request) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const protocol = isSecureRequest(request) ? "https" : "http";
  return `${protocol}://${request.headers.host || "localhost"}`;
}

function oauthCallbackUrl(request) {
  return `${publicBaseUrl(request)}/auth/github/callback`;
}

async function readRequestBody(request, limit = 16_384) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function plainText(value) {
  return String(value ?? "").replace(/^§[0-9a-fklmnor]/gi, "").trim();
}

export async function readGunPackManifest() {
  const info = await readJson(join(gunpackRoot, "gunpack_info.json"));
  const [zhLang, enLang, indexFiles] = await Promise.all([
    readJson(join(gunpackRoot, "lang", "zh_cn.json")).catch(() => ({})),
    readJson(join(gunpackRoot, "lang", "en_us.json")).catch(() => ({})),
    readdir(gunIndexRoot)
  ]);

  const indexes = await Promise.all(
    indexFiles
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const id = name.slice(0, -5);
        const data = await readJson(join(gunIndexRoot, name));
        return {
          id,
          name: plainText(zhLang[data.name] || enLang[data.name] || id),
          description: plainText(zhLang[data.tooltip] || enLang[data.tooltip] || ""),
          type: data.type || "rifle",
          typeLabel: gunTypeLabels[data.type] || data.type || "枪械",
          sort: Number(data.sort ?? 999),
          iconUrl: `api/icons/${encodeURIComponent(id)}`
        };
      })
  );

  indexes.sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name, "zh-CN"));

  return {
    name: plainText(info.name),
    description: plainText(zhLang[info.desc] || enLang[info.desc] || info.desc),
    version: info.version,
    license: info.license,
    authors: info.authors || [],
    packDate: info.date,
    namespace: "mw4",
    guns: indexes
  };
}

export async function readWebsiteUpdates() {
  const payload = await readJson(websiteUpdatesPath);
  const updates = Array.isArray(payload.updates) ? payload.updates : [];
  return updates.sort((left, right) => {
    const leftTime = new Date(left.publishedAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

async function getGunPackManifest() {
  const now = Date.now();
  if (!cache.gunpack || now - cache.gunpackAt > GUNPACK_CACHE_MS) {
    cache.gunpack = await readGunPackManifest();
    cache.gunpackAt = now;
  }
  return cache.gunpack;
}

export function normalizeRelease(release) {
  if (!release) return null;
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
  const byVersion = (release) => sortPackReleasesByVersion(release)[0] || null;
  return byVersion(releases.filter((release) => !release.prerelease && release.asset))
    || byVersion(releases.filter((release) => release.asset))
    || byVersion(releases.filter((release) => !release.prerelease))
    || byVersion(releases);
}

export function sortReleasesByDate(releases) {
  return releases.sort((left, right) => {
    const leftTime = new Date(left.publishedAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export function sortPackReleasesByVersion(releases) {
  const versionParts = (release) => {
    const match = String(release?.tag || "").match(/(?:^|v)(\d+)\.(\d+)\.(\d+)/i);
    return match ? match.slice(1).map(Number) : null;
  };

  return [...releases].sort((left, right) => {
    const leftVersion = versionParts(left);
    const rightVersion = versionParts(right);
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

async function githubRequest(url, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mw4-gunpack-site",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    throw new GitHubRequestError(response.status, await response.text());
  }
  return response.json();
}

async function getGitHubData(force = false) {
  const now = Date.now();
  if (!force && cache.github && now - cache.githubAt < GITHUB_CACHE_MS) {
    return { data: cache.github, error: cache.githubError };
  }

  const config = await readConfig();
  const owner = process.env.GITHUB_OWNER || config.github?.owner;
  const repo = process.env.GITHUB_REPO || config.github?.repo;
  if (!owner || !repo) {
    cache.githubError = "GitHub repository is not configured.";
    return { data: null, error: cache.githubError };
  }

  const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const token = process.env.GITHUB_TOKEN;
  const [repoResult, releasesResult] = await Promise.allSettled([
    githubRequest(apiBase, token),
    githubRequest(`${apiBase}/releases?per_page=30`, token)
  ]);

  const repository = repoResult.status === "fulfilled"
    ? {
        owner,
        name: repoResult.value.name,
        fullName: repoResult.value.full_name,
        url: repoResult.value.html_url,
        description: repoResult.value.description,
        defaultBranch: repoResult.value.default_branch,
        stars: repoResult.value.stargazers_count,
        forks: repoResult.value.forks_count,
        openIssues: repoResult.value.open_issues_count,
        updatedAt: repoResult.value.updated_at,
        pushedAt: repoResult.value.pushed_at
      }
    : null;
  const releases = releasesResult.status === "fulfilled"
    ? sortReleasesByDate(
        releasesResult.value.filter((release) => !release.draft).map(normalizeRelease)
      )
    : [];
  const release = pickPackRelease(releases);
  const errors = [repoResult, releasesResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "GitHub request failed");

  cache.github = { repository, release, releases };
  cache.githubAt = now;
  cache.githubError = errors.length ? errors.join("; ") : null;
  return { data: cache.github, error: cache.githubError };
}

function sendJson(response, statusCode, payload, cacheControl = "no-store") {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": cacheControl
  });
  response.end(body);
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; " +
      "connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
}

async function serveFile(response, file, type, method, cacheControl = "public, max-age=300") {
  const fileStat = await stat(file);
  response.writeHead(200, {
    "Content-Type": type,
    "Content-Length": fileStat.size,
    "Cache-Control": cacheControl
  });
  if (method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}

function redirect(response, location) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store"
  });
  response.end();
}

async function exchangeOAuthCode(code, request) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "mw4-gunpack-admin"
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: oauthCallbackUrl(request)
    }),
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "GitHub OAuth exchange failed.");
  }
  return payload.access_token;
}

async function fetchGitHubUser(accessToken) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "mw4-gunpack-admin",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`GitHub user request failed: ${response.status}`);
  return response.json();
}

async function writeDomesticMirrorToGitHub(accessToken, mirror) {
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(ADMIN_REPOSITORY_OWNER)}/${encodeURIComponent(ADMIN_REPOSITORY_NAME)}/contents/web/domestic-mirror.json`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "mw4-gunpack-admin",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const currentResponse = await fetch(`${apiBase}?ref=main`, {
    headers,
    signal: AbortSignal.timeout(10_000)
  });
  const current = currentResponse.ok ? await currentResponse.json() : null;
  const content = `${JSON.stringify(mirror, null, 2)}\n`;
  const body = {
    message: "Update domestic Lanzou mirror",
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: "main"
  };
  if (current?.sha) body.sha = current.sha;

  const updateResponse = await fetch(apiBase, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const result = await updateResponse.json();
  if (!updateResponse.ok) {
    throw new Error(result.message || `GitHub update failed: ${updateResponse.status}`);
  }
  return {
    commitSha: result.commit?.sha || null,
    commitUrl: result.commit?.html_url || null
  };
}

async function handleRequest(request, response) {
  applySecurityHeaders(response);
  const method = request.method || "GET";
  const origin = `http://${request.headers.host || "localhost"}`;
  const url = new URL(request.url || "/", origin);
  const adminPost = method === "POST" && url.pathname === "/api/admin/domestic-mirror";
  if (!["GET", "HEAD"].includes(method) && !adminPost) {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true, service: "mw4-gunpack-site" });
    return;
  }

  if (url.pathname === "/auth/github") {
    if (!oauthConfigured()) {
      sendJson(response, 503, {
        error: "GitHub OAuth is not configured.",
        required: ["GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET", "PUBLIC_BASE_URL"]
      });
      return;
    }
    const state = randomBytes(24).toString("hex");
    oauthStates.set(state, { expiresAt: Date.now() + 10 * 60_000 });
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", process.env.GITHUB_OAUTH_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", oauthCallbackUrl(request));
    authorize.searchParams.set("scope", "read:user public_repo");
    authorize.searchParams.set("state", state);
    redirect(response, authorize.href);
    return;
  }

  if (url.pathname === "/auth/github/callback") {
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const stateEntry = state ? oauthStates.get(state) : null;
    if (state) oauthStates.delete(state);
    if (!stateEntry || stateEntry.expiresAt <= Date.now() || !code) {
      sendJson(response, 400, { error: "Invalid or expired OAuth state." });
      return;
    }

    try {
      const accessToken = await exchangeOAuthCode(code, request);
      const user = await fetchGitHubUser(accessToken);
      if (!isAuthorizedGitHubUser(user)) {
        sendJson(response, 403, {
          error: "This GitHub account is not authorized for the admin console.",
          user: { id: user.id, login: user.login }
        });
        return;
      }

      const sessionId = randomBytes(32).toString("hex");
      const csrfToken = randomBytes(24).toString("hex");
      const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
      adminSessions.set(sessionId, {
        user: { id: user.id, login: user.login },
        accessToken,
        csrfToken,
        expiresAt
      });
      appendSetCookie(
        response,
        sessionCookie(request, sessionId, Math.floor(ADMIN_SESSION_TTL_MS / 1000))
      );
      redirect(response, "/admin/");
    } catch (error) {
      console.error(error);
      sendJson(response, 502, { error: "GitHub login failed." });
    }
    return;
  }

  if (url.pathname === "/auth/logout") {
    const sessionId = parseCookies(request).mw4_admin_session;
    if (sessionId) adminSessions.delete(sessionId);
    appendSetCookie(response, sessionCookie(request, "", 0));
    redirect(response, "/admin/");
    return;
  }

  if (url.pathname === "/api/admin/session") {
    if (!oauthConfigured()) {
      sendJson(response, 503, {
        error: "后台尚未配置 GitHub OAuth。",
        configured: false
      });
      return;
    }
    const adminSession = currentAdminSession(request);
    if (!adminSession || !isAuthorizedGitHubUser(adminSession.user)) {
      sendJson(response, 401, {
        error: "GitHub login required.",
        loginUrl: "/auth/github"
      });
      return;
    }
    sendJson(response, 200, {
      authenticated: true,
      user: adminSession.user,
      csrfToken: adminSession.csrfToken,
      mirror: await readJson(domesticMirrorPath)
    });
    return;
  }

  if (adminPost) {
    const adminSession = currentAdminSession(request);
    if (!adminSession || !isAuthorizedGitHubUser(adminSession.user)) {
      sendJson(response, 401, { error: "GitHub login required." });
      return;
    }
    if (!safeEqual(request.headers["x-csrf-token"] || "", adminSession.csrfToken)) {
      sendJson(response, 403, { error: "Invalid CSRF token." });
      return;
    }

    try {
      const body = JSON.parse(await readRequestBody(request));
      const mirror = validateDomesticMirror(body);
      const commit = await writeDomesticMirrorToGitHub(adminSession.accessToken, mirror);
      sendJson(response, 200, { ok: true, mirror, commit });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Failed to update mirror." });
    }
    return;
  }

  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    await serveFile(response, join(adminDir, "index.html"), "text/html; charset=utf-8", method, "no-store");
    return;
  }

  if (url.pathname === "/admin/app.js") {
    await serveFile(response, join(adminDir, "app.js"), "text/javascript; charset=utf-8", method, "no-store");
    return;
  }

  if (url.pathname === "/admin/styles.css") {
    await serveFile(response, join(adminDir, "styles.css"), "text/css; charset=utf-8", method, "no-store");
    return;
  }

  if (url.pathname === "/api/gunpack") {
    sendJson(response, 200, await getGunPackManifest(), "public, max-age=30");
    return;
  }

  if (url.pathname === "/api/status") {
    const [gunpack, github] = await Promise.all([
      getGunPackManifest(),
      getGitHubData(url.searchParams.get("refresh") === "1")
    ]);
    sendJson(response, 200, {
      gunpack,
      github: github.data,
      githubError: github.error,
      refreshedAt: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/download") {
    const gunpack = await getGunPackManifest();
    const github = await getGitHubData();
    const location = github.data?.release?.downloadUrl
      || github.data?.repository?.url
      || `https://github.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/releases/tag/v${gunpack.version}`;
    const accelerated = url.searchParams.get("accelerated") === "1"
      ? `https://gh-proxy.com/${location}`
      : location;
    redirect(response, accelerated);
    return;
  }

  if (url.pathname === "/api/releases") {
    const github = await getGitHubData(url.searchParams.get("refresh") === "1");
    sendJson(response, 200, {
      releases: github.data?.releases || [],
      error: github.error,
      refreshedAt: new Date().toISOString()
    }, "public, max-age=60");
    return;
  }

  if (url.pathname === "/api/website-updates") {
    sendJson(response, 200, {
      updates: await readWebsiteUpdates()
    });
    return;
  }

  if (url.pathname === "/api/domestic-mirror") {
    sendJson(response, 200, await readJson(domesticMirrorPath));
    return;
  }

  if (url.pathname.startsWith("/api/icons/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/icons/".length));
    const manifest = await getGunPackManifest();
    if (!manifest.guns.some((gun) => gun.id === id)) {
      sendJson(response, 404, { error: "Gun icon not found" });
      return;
    }
    const file = join(gunIconRoot, `${id}.png`);
    await serveFile(response, file, "image/png", method);
    return;
  }

  if (url.pathname === "/website-updates/website-updates.html") {
    response.writeHead(302, {
      Location: `/website-updates.html${url.search}`,
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  const detailMatch = url.pathname.match(/^\/website-updates\/([a-z0-9._-]+)\.html$/i);
  if (detailMatch) {
    const updateId = detailMatch[1];
    const template = await readFile(join(serverDir, "templates", "website-update-detail.html"), "utf8");
    const body = template.replaceAll("{{UPDATE_ID}}", updateId);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "public, max-age=300"
    });
    response.end(body);
    return;
  }

  const staticEntry = staticFiles.get(url.pathname);
  if (staticEntry) {
    await serveFile(response, join(publicDir, staticEntry.file), staticEntry.type, method);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

export function createAppServer() {
  return createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Internal server error" });
      } else {
        response.destroy(error);
      }
    });
  });
}

export function startServer(port = Number(process.env.PORT || 3000)) {
  const server = createAppServer();
  server.listen(port, "0.0.0.0", () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`MW4 gun pack site listening on http://localhost:${actualPort}`);
  });
  return server;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  startServer();
}

