import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import {
  createAppServer,
  isAuthorizedGitHubUser,
  normalizeRelease,
  pickPackRelease,
  readGunPackManifest,
  readWebsiteUpdates,
  sortReleasesByDate,
  validateDomesticMirror,
  validateMobileMirror
} from "../server.mjs";
import {
  downloadConfigFromSelection,
  toDetailPage,
  toStaticManifest
} from "../scripts/build-static.mjs";
import {
  acceleratedReleaseUrl,
  extractReleaseSummary,
  isPackRelease,
  isWebsiteRelease,
  normalizeRelease as normalizeClientRelease,
  pickPackRelease as pickClientPackRelease,
  sortPackReleasesByVersion
} from "../public/release-data.js";
import { decodeBase64Utf8 } from "../public/download-config.js";
import { websiteUpdateDetailPath } from "../public/website-update-data.js";

test("decodes UTF-8 GitHub contents payloads", () => {
  const label = "蓝奏云国内分流";
  const encoded = Buffer.from(label, "utf8").toString("base64");
  assert.equal(decodeBase64Utf8(encoded), label);
});

test("reads the live gun pack manifest", async () => {
  const manifest = await readGunPackManifest();
  assert.equal(manifest.namespace, "mw4");
  assert.match(manifest.version, /-Release$/);
  assert.equal(manifest.license, "GPL-3.0");
  assert.ok(manifest.guns.length >= 14);
  assert.ok(manifest.guns.every((gun) => gun.id && gun.name && gun.iconUrl));
  assert.ok(manifest.guns.every((gun) => gun.nameEn && gun.typeLabelEn));
});

test("creates file-based icon URLs for static hosting", async () => {
  const manifest = await readGunPackManifest();
  const staticManifest = toStaticManifest(manifest);
  assert.ok(staticManifest.guns.every((gun) => gun.iconUrl.endsWith(".png")));
  assert.equal(manifest.guns[0].iconUrl.includes(".png"), false);
});

test("keeps release notes and zip metadata in the release feed", () => {
  const release = normalizeRelease({
    tag_name: "v1.8.1-Release",
    name: "Hotfix",
    html_url: "https://github.com/example/releases/tag/v1.8.1-Release",
    published_at: "2026-10-25T12:00:00Z",
    body: "## Bug 修复\n\n- 修复换弹音效",
    assets: [{
      name: "Modern.Warfare.4-1.8.1-Release.zip",
      size: 26229060,
      download_count: 3,
      updated_at: "2026-10-25T12:00:00Z",
      browser_download_url: "https://github.com/example/release.zip"
    }]
  });

  assert.equal(release.tag, "v1.8.1-Release");
  assert.match(release.body, /换弹音效/);
  assert.equal(release.asset.size, 26229060);
  assert.equal(extractReleaseSummary(release.body), "修复换弹音效");
  assert.equal(normalizeClientRelease(release), release);
});

test("keeps downloads attached to the pack release when a site release is newer", () => {
  const siteRelease = { tag: "website-v1.0.0", asset: null, prerelease: false };
  const packRelease = { tag: "v1.8.0-Release", asset: { name: "pack.zip" }, prerelease: false };
  assert.equal(pickPackRelease([siteRelease, packRelease]), packRelease);
});

test("sorts the release feed by publication time", () => {
  const releases = sortReleasesByDate([
    { tag: "older", publishedAt: "2026-10-25T11:00:00Z" },
    { tag: "newer", publishedAt: "2026-10-25T12:00:00Z" }
  ]);
  assert.deepEqual(releases.map((release) => release.tag), ["newer", "older"]);
});

test("sorts pack releases by version before publication time", () => {
  const releases = sortPackReleasesByVersion([
    { tag: "v1.10.3-Release", publishedAt: "2026-11-01T09:30:00Z" },
    { tag: "v1.10.4-Release", publishedAt: "2026-11-01T09:20:00Z" },
    { tag: "v1.9.9-Release", publishedAt: "2026-11-01T10:00:00Z" },
    { tag: "v1.10.2-Release", publishedAt: "2026-11-01T09:10:00Z" }
  ]);
  assert.deepEqual(
    releases.map((release) => release.tag),
    ["v1.10.4-Release", "v1.10.3-Release", "v1.10.2-Release", "v1.9.9-Release"]
  );
});

test("selects the highest pack version even when it was published earlier", () => {
  const highest = { tag: "v1.10.4-Release", asset: { name: "1.10.4.zip" }, prerelease: false };
  const later = { tag: "v1.10.3-Release", asset: { name: "1.10.3.zip" }, prerelease: false };
  assert.equal(pickPackRelease([later, highest]), highest);
  assert.equal(pickClientPackRelease([later, highest]), highest);
});

test("separates website releases from downloadable gun-pack releases", () => {
  const website = { tag: "website-v1.0.0", asset: null };
  const pack = { tag: "v1.8.1-Release", asset: { name: "pack.zip" } };
  assert.equal(isWebsiteRelease(website), true);
  assert.equal(isPackRelease(website), false);
  assert.equal(isWebsiteRelease(pack), false);
  assert.equal(isPackRelease(pack), true);
});

test("keeps a repository-driven website update log", async () => {
  const updates = await readWebsiteUpdates();
  assert.ok(updates.length >= 32);
  assert.match(updates[0].id, /^website-v\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(updates[0].changes));
  assert.equal("downloadUrl" in updates[0], false);
});

test("renders a dedicated detail page for each update id", () => {
  const page = toDetailPage('<html data-update-id="{{UPDATE_ID}}"><title>{{UPDATE_ID}}</title></html>', "website-v1.0.13");
  assert.match(page, /data-update-id="website-v1\.0\.13"/);
  assert.match(page, /<title>website-v1\.0\.13<\/title>/);
});

test("builds one canonical home-card detail path", () => {
  assert.match(
    websiteUpdateDetailPath("website-v1.0.14"),
    /^\.\/website-updates\/website-v1\.0\.14\.html\?v=\d{8}-\d+$/
  );
});

test("uses the verified gh-proxy accelerator", () => {
  assert.equal(
    acceleratedReleaseUrl("https://github.com/example/release.zip"),
    "https://gh-proxy.com/https://github.com/example/release.zip"
  );
});

test("supports the build-selected accelerator prefix", () => {
  assert.equal(
    acceleratedReleaseUrl("https://github.com/example/release.zip", "https://mirror.example/"),
    "https://mirror.example/https://github.com/example/release.zip"
  );
});

test("combines the daily mirror selection with the latest pack URL", () => {
  const directUrl = "https://github.com/example/releases/download/v1.8.1/pack.zip";
  const config = downloadConfigFromSelection(directUrl, {
    generatedAt: "2026-10-25T16:00:00Z",
    selected: {
      id: "daily-node",
      name: "daily.example",
      prefix: "https://daily.example/",
      latencyMs: 250
    },
    fallback: null,
    excludedHosts: ["gh.my-website.ccwu.cc"],
    probes: []
  });
  assert.equal(config.directUrl, directUrl);
  assert.equal(config.acceleratedUrl, `https://daily.example/${directUrl}`);
});

test("excludes the known resetting mirror host", async () => {
  const mirrorConfig = JSON.parse(
    await readFile(new URL("../download-mirrors.json", import.meta.url), "utf8")
  );
  assert.ok(mirrorConfig.excludedHosts.includes("gh.my-website.ccwu.cc"));
  assert.equal(
    mirrorConfig.mirrors.some((mirror) => mirror.prefix.includes("gh.my-website.ccwu.cc")),
    false
  );
});

test("admin authentication only accepts the owner GitHub id", () => {
  assert.equal(isAuthorizedGitHubUser({ id: 317516594, login: "Skydeps1459" }), true);
  assert.equal(isAuthorizedGitHubUser({ id: 1, login: "someone-else" }), false);
});

test("validates domestic Lanzou mirror updates", () => {
  const mirror = validateDomesticMirror({
    label: "蓝奏云国内分流",
    url: "https://wwaxl.lanzouc.com/itbK24dd0odi",
    password: "6wgt"
  });
  assert.equal(mirror.url, "https://wwaxl.lanzouc.com/itbK24dd0odi");
  assert.throws(() => validateDomesticMirror({
    label: "bad",
    url: "https://example.com/file",
    password: ""
  }), /蓝奏云/);
});

test("validates closed domestic mirror state", () => {
  const closed = validateDomesticMirror({
    closed: true,
    label: "蓝奏云国内分流",
    notice: "由于枪包文件即将达到蓝奏云单次传输上限，为了玩家下载体验，蓝奏云分流现正式关闭，未来枪包分流下载将暂时迁移至移动云盘",
    noticeEn: "The Lanzou mirror is now officially closed."
  });
  assert.equal(closed.closed, true);
  assert.equal(closed.url, undefined);
  assert.match(closed.notice, /上限/);

  // closed state does not require a link
  const closedNoNotice = validateDomesticMirror({ closed: true, label: "蓝奏云国内分流" });
  assert.equal(closedNoNotice.closed, true);

  // overly long notices are rejected
  assert.throws(() => validateDomesticMirror({
    closed: true,
    label: "蓝奏云国内分流",
    notice: "长".repeat(301)
  }), /过长/);

  // closed state may pre-stage a valid link for later re-opening
  const staged = validateDomesticMirror({
    closed: true,
    label: "蓝奏云国内分流",
    notice: "关闭公告",
    url: "https://wwaxl.lanzouc.com/itbK24dd0odi",
    password: "6wgt"
  });
  assert.equal(staged.closed, true);
  assert.equal(staged.url, "https://wwaxl.lanzouc.com/itbK24dd0odi");
  assert.equal(staged.password, "6wgt");

  // invalid staged links are still rejected
  assert.throws(() => validateDomesticMirror({
    closed: true,
    label: "蓝奏云国内分流",
    notice: "关闭公告",
    url: "https://example.com/file"
  }), /蓝奏云/);
});

test("validates China Mobile Cloud mirror updates", () => {
  const mirror = validateMobileMirror({
    label: "移动云盘分流",
    url: "https://yun.139.com/shareweb/#/w/i/abc123",
    password: "m66k"
  });
  assert.equal(mirror.url, "https://yun.139.com/shareweb/#/w/i/abc123");
  assert.equal(mirror.password, "m66k");

  // empty url keeps the mirror hidden on the website
  const empty = validateMobileMirror({ label: "移动云盘分流", url: "", password: "" });
  assert.equal(empty.url, "");

  // non-mobile-cloud domains are rejected
  assert.throws(() => validateMobileMirror({
    label: "bad",
    url: "https://example.com/file",
    password: ""
  }), /移动云盘/);

  // http is rejected
  assert.throws(() => validateMobileMirror({
    label: "bad scheme",
    url: "http://yun.139.com/share",
    password: ""
  }), /HTTPS/);
});

test("serves health and local gun pack data", async (t) => {
  const server = createAppServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/healthz`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    service: "mw4-gunpack-site"
  });

  const packResponse = await fetch(`${baseUrl}/api/gunpack`);
  assert.equal(packResponse.status, 200);
  const payload = await packResponse.json();
  assert.equal(payload.namespace, "mw4");
  assert.ok(payload.guns.length >= 14);

  const pageResponse = await fetch(baseUrl);
  assert.equal(pageResponse.status, 200);
  const pageHtml = await pageResponse.text();
  assert.match(pageHtml, /Modern Warfare 4/);
  assert.match(pageHtml, /id="website-log"/);
  assert.match(pageHtml, /id="homepage-website-updates"/);

  const englishPageResponse = await fetch(`${baseUrl}/en/`);
  assert.equal(englishPageResponse.status, 200);
  const englishPageHtml = await englishPageResponse.text();
  assert.match(englishPageHtml, /<html lang="en"/);
  assert.match(englishPageHtml, /Three-step deployment/);

  const englishChangelogResponse = await fetch(`${baseUrl}/en/changelog.html`);
  assert.equal(englishChangelogResponse.status, 200);
  assert.match(await englishChangelogResponse.text(), /Changelog/);

  const englishWebsiteUpdatesResponse = await fetch(`${baseUrl}/en/website-updates.html`);
  assert.equal(englishWebsiteUpdatesResponse.status, 200);
  assert.match(await englishWebsiteUpdatesResponse.text(), /Website Updates/);

  const changelogResponse = await fetch(`${baseUrl}/changelog.html`);
  assert.equal(changelogResponse.status, 200);
  assert.match(await changelogResponse.text(), /更新日志/);

  const websiteUpdatesResponse = await fetch(`${baseUrl}/website-updates.html`);
  assert.equal(websiteUpdatesResponse.status, 200);
  assert.match(await websiteUpdatesResponse.text(), /网页更新/);

  const websiteUpdateDetailResponse = await fetch(`${baseUrl}/website-update.html`);
  assert.equal(websiteUpdateDetailResponse.status, 200);
  assert.match(await websiteUpdateDetailResponse.text(), /网页更新详情/);

  const dedicatedDetailResponse = await fetch(`${baseUrl}/website-updates/website-v1.0.12.html`);
  assert.equal(dedicatedDetailResponse.status, 200);
  assert.match(await dedicatedDetailResponse.text(), /website-v1\.0\.12/);

  const englishDetailResponse = await fetch(`${baseUrl}/en/website-updates/website-v1.0.12.html`);
  assert.equal(englishDetailResponse.status, 200);
  const englishDetailHtml = await englishDetailResponse.text();
  assert.match(englishDetailHtml, /<html lang="en"/);
  assert.match(englishDetailHtml, /website-v1\.0\.12/);

  const legacyNestedUpdatesResponse = await fetch(
    `${baseUrl}/website-updates/website-updates.html?v=20261025-11`,
    { redirect: "manual" }
  );
  assert.equal(legacyNestedUpdatesResponse.status, 302);
  assert.equal(
    legacyNestedUpdatesResponse.headers.get("location"),
    "/website-updates.html?v=20261025-11"
  );

  const websiteUpdateApiResponse = await fetch(`${baseUrl}/api/website-updates`);
  assert.equal(websiteUpdateApiResponse.status, 200);
  const websiteUpdateApi = await websiteUpdateApiResponse.json();
  assert.ok(websiteUpdateApi.updates.length >= 2);

  const domesticMirrorResponse = await fetch(`${baseUrl}/api/domestic-mirror`);
  assert.equal(domesticMirrorResponse.status, 200);
  const domesticMirror = await domesticMirrorResponse.json();
  if (domesticMirror.closed === true) {
    assert.match(domesticMirror.notice, /上限/);
    assert.ok(domesticMirror.noticeEn.length > 0);
  } else {
    assert.match(domesticMirror.url, /^https:\/\/[^/]*lanzou/i);
    assert.ok(domesticMirror.password.length > 0);
  }

  const mobileMirrorResponse = await fetch(`${baseUrl}/api/mobile-mirror`);
  assert.equal(mobileMirrorResponse.status, 200);
  const mobileMirror = await mobileMirrorResponse.json();
  assert.equal(typeof mobileMirror.url, "string");
  assert.equal(typeof mobileMirror.label, "string");
  if (mobileMirror.url) {
    assert.match(mobileMirror.url, /^https:\/\/[^/]*139\.com/i);
  }

  const lanzouNoticeResponse = await fetch(`${baseUrl}/lanzou-notice.html`);
  assert.equal(lanzouNoticeResponse.status, 200);
  assert.match(await lanzouNoticeResponse.text(), /蓝奏云分流已关闭/);

  const englishLanzouNoticeResponse = await fetch(`${baseUrl}/en/lanzou-notice.html`);
  assert.equal(englishLanzouNoticeResponse.status, 200);
  assert.match(await englishLanzouNoticeResponse.text(), /Lanzou Cloud mirror closed/);

  const removedCdnMirrorResponse = await fetch(`${baseUrl}/api/cdn-mirror`);
  assert.equal(removedCdnMirrorResponse.status, 404);

  const removedCdnNoticeResponse = await fetch(`${baseUrl}/cdn-notice.html`);
  assert.equal(removedCdnNoticeResponse.status, 404);

  const adminPageResponse = await fetch(`${baseUrl}/admin/`);
  assert.equal(adminPageResponse.status, 200);
  assert.match(await adminPageResponse.text(), /分流管理/);

  const adminSessionResponse = await fetch(`${baseUrl}/api/admin/session`);
  assert.equal(adminSessionResponse.status, 503);
});

