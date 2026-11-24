const DEFAULT_PREFIX = "https://gh-proxy.com/";
const DOMESTIC_MIRROR_RAW_URL = "https://raw.githubusercontent.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/main/web/domestic-mirror.json";
const DOMESTIC_MIRROR_CDN_URL = "https://cdn.jsdelivr.net/gh/Skydeps1459/Modern-Warfare-4-TACZ-GunPack@main/web/domestic-mirror.json";
const DOMESTIC_MIRROR_API_URL = "https://api.github.com/repos/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/contents/web/domestic-mirror.json?ref=main";
const MOBILE_MIRROR_RAW_URL = "https://raw.githubusercontent.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/main/web/mobile-mirror.json";
const MOBILE_MIRROR_CDN_URL = "https://cdn.jsdelivr.net/gh/Skydeps1459/Modern-Warfare-4-TACZ-GunPack@main/web/mobile-mirror.json";
const MOBILE_MIRROR_API_URL = "https://api.github.com/repos/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/contents/web/mobile-mirror.json?ref=main";
const QUARK_MIRROR_RAW_URL = "https://raw.githubusercontent.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/main/web/quark-mirror.json";
const QUARK_MIRROR_CDN_URL = "https://cdn.jsdelivr.net/gh/Skydeps1459/Modern-Warfare-4-TACZ-GunPack@main/web/quark-mirror.json";
const QUARK_MIRROR_API_URL = "https://api.github.com/repos/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/contents/web/quark-mirror.json?ref=main";
const ACCELERATOR_RAW_URL = "https://raw.githubusercontent.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/main/web/accelerator.json";
const ACCELERATOR_CDN_URL = "https://cdn.jsdelivr.net/gh/Skydeps1459/Modern-Warfare-4-TACZ-GunPack@main/web/accelerator.json";
const ACCELERATOR_API_URL = "https://api.github.com/repos/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/contents/web/accelerator.json?ref=main";
const LANZOU_CLOSED_NOTICE = "由于枪包文件即将达到蓝奏云单次传输上限，为了玩家下载体验，蓝奏云分流现正式关闭，未来枪包分流下载将暂时迁移至移动云盘";
const LANZOU_CLOSED_NOTICE_EN = "The gun pack file is approaching Lanzou Cloud's single-transfer size limit. To keep downloads smooth for players, the Lanzou mirror is now officially closed. Mirror downloads will temporarily move to China Mobile Cloud Drive.";

export function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function accelerateDownloadUrl(url, prefix = DEFAULT_PREFIX) {
  if (!url) return "";
  return `${prefix}${url}`;
}

export async function loadDownloadConfig(baseUrl = new URL("./", document.baseURI)) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const endpoint = new URL("api/download-config.json", siteBase);
  endpoint.searchParams.set("v", Date.now().toString());

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    const prefix = String(config?.selected?.prefix || "");
    if (!/^https:\/\/[^/]+\/$/.test(prefix)) {
      throw new Error("Invalid accelerator prefix");
    }
    return {
      ...config,
      selected: {
        ...config.selected,
        prefix
      }
    };
  } catch (error) {
    console.info("Download accelerator config unavailable; using default.", error.message);
    return {
      selected: {
        id: "gh-proxy",
        name: "gh-proxy.com",
        prefix: DEFAULT_PREFIX
      },
      fallback: null
    };
  }
}

// 加速下载总开关：默认关闭（屏蔽加速按钮与功能，保留 GitHub 原链）。
// 多源回退与分流配置一致；任何来源失败都按"关闭"处理，绝不默认放行加速。
export async function loadAcceleratorSwitch(
  baseUrl = new URL("./", document.baseURI),
  { preferLive = false } = {}
) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const endpoint = new URL("api/accelerator.json", siteBase);
  endpoint.searchParams.set("v", Date.now().toString());
  const liveEndpoint = new URL(ACCELERATOR_RAW_URL);
  liveEndpoint.searchParams.set("v", Date.now().toString());
  const cdnEndpoint = new URL(ACCELERATOR_CDN_URL);
  cdnEndpoint.searchParams.set("v", Date.now().toString());
  const apiEndpoint = new URL(ACCELERATOR_API_URL);
  apiEndpoint.searchParams.set("v", Date.now().toString());

  const sources = preferLive
    ? [
        { url: new URL("api/accelerator", siteBase) },
        { url: apiEndpoint, githubContents: true },
        { url: endpoint },
        { url: liveEndpoint },
        { url: cdnEndpoint }
      ]
    : [
        { url: new URL("api/accelerator", siteBase) },
        { url: endpoint },
        { url: liveEndpoint },
        { url: apiEndpoint, githubContents: true },
        { url: cdnEndpoint }
      ];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let config = await response.json();
      if (source.githubContents) {
        config = JSON.parse(decodeBase64Utf8(config.content));
      }
      return {
        enabled: config?.enabled === true,
        source: source.url.hostname
      };
    } catch (error) {
      console.info(`Accelerator switch source unavailable: ${source.url.hostname}`, error.message);
    }
  }
  return { enabled: false, source: "default" };
}

export async function loadDomesticMirror(
  baseUrl = new URL("./", document.baseURI),
  { preferLive = false } = {}
) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const endpoint = new URL("api/domestic-mirror.json", siteBase);
  endpoint.searchParams.set("v", Date.now().toString());
  const liveEndpoint = new URL(DOMESTIC_MIRROR_RAW_URL);
  liveEndpoint.searchParams.set("v", Date.now().toString());
  const cdnEndpoint = new URL(DOMESTIC_MIRROR_CDN_URL);
  cdnEndpoint.searchParams.set("v", Date.now().toString());
  const apiEndpoint = new URL(DOMESTIC_MIRROR_API_URL);
  apiEndpoint.searchParams.set("v", Date.now().toString());

  // 顺序决定"多久能看到后端的改动"：
  //   服务端模式（Node）的 /api/domestic-mirror 每次请求都读文件，永远最新；
  //   静态 Pages 模式下 raw / jsDelivr 都有 CDN 缓存，GitHub Contents API 才是实时的。
  //   ⇒ 用户回到页面 / 切换标签页时用 preferLive 直接问 GitHub API（即时）；
  //     后台每 30 秒轮询用静态快照，避免打爆 API 的 60 次/小时限额。
  const sources = preferLive
    ? [
        { url: new URL("api/domestic-mirror", siteBase) },
        { url: apiEndpoint, githubContents: true },
        { url: endpoint },
        { url: liveEndpoint },
        { url: cdnEndpoint }
      ]
    : [
        { url: new URL("api/domestic-mirror", siteBase) },
        { url: endpoint },
        { url: liveEndpoint },
        { url: apiEndpoint, githubContents: true },
        { url: cdnEndpoint }
      ];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let mirror = await response.json();
      if (source.githubContents) {
        mirror = JSON.parse(decodeBase64Utf8(mirror.content));
      }
      if (mirror.closed === true) {
        return {
          closed: true,
          label: String(mirror.label || "蓝奏云国内分流"),
          notice: String(mirror.notice || LANZOU_CLOSED_NOTICE),
          noticeEn: String(mirror.noticeEn || LANZOU_CLOSED_NOTICE_EN),
          source: source.url.hostname
        };
      }
      const url = new URL(mirror.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
      return {
        label: String(mirror.label || "国内分流"),
        url: url.href,
        password: String(mirror.password || ""),
        source: source.url.hostname
      };
    } catch (error) {
      console.info(`Domestic mirror source unavailable: ${source.url.hostname}`, error.message);
    }
  }
  return null;
}

export async function loadMobileMirror(
  baseUrl = new URL("./", document.baseURI),
  { preferLive = false } = {}
) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const endpoint = new URL("api/mobile-mirror.json", siteBase);
  endpoint.searchParams.set("v", Date.now().toString());
  const liveEndpoint = new URL(MOBILE_MIRROR_RAW_URL);
  liveEndpoint.searchParams.set("v", Date.now().toString());
  const cdnEndpoint = new URL(MOBILE_MIRROR_CDN_URL);
  cdnEndpoint.searchParams.set("v", Date.now().toString());
  const apiEndpoint = new URL(MOBILE_MIRROR_API_URL);
  apiEndpoint.searchParams.set("v", Date.now().toString());

  // 与蓝奏云分流相同的多源回退顺序：
  //   preferLive 时优先 GitHub Contents API（静态 Pages 下唯一实时源）
  const sources = preferLive
    ? [
        { url: new URL("api/mobile-mirror", siteBase) },
        { url: apiEndpoint, githubContents: true },
        { url: endpoint },
        { url: liveEndpoint },
        { url: cdnEndpoint }
      ]
    : [
        { url: new URL("api/mobile-mirror", siteBase) },
        { url: endpoint },
        { url: liveEndpoint },
        { url: apiEndpoint, githubContents: true },
        { url: cdnEndpoint }
      ];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let mirror = await response.json();
      if (source.githubContents) {
        mirror = JSON.parse(decodeBase64Utf8(mirror.content));
      }
      // 链接未填写：分流尚未开放，网页不显示按钮
      if (!mirror.url) return null;
      const url = new URL(mirror.url);
      if (url.protocol !== "https:") throw new Error("Invalid URL");
      return {
        label: String(mirror.label || "移动云盘分流"),
        url: url.href,
        password: String(mirror.password || ""),
        source: source.url.hostname
      };
    } catch (error) {
      console.info(`Mobile mirror source unavailable: ${source.url.hostname}`, error.message);
    }
  }
  return null;
}

export async function loadQuarkMirror(
  baseUrl = new URL("./", document.baseURI),
  { preferLive = false } = {}
) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const endpoint = new URL("api/quark-mirror.json", siteBase);
  endpoint.searchParams.set("v", Date.now().toString());
  const liveEndpoint = new URL(QUARK_MIRROR_RAW_URL);
  liveEndpoint.searchParams.set("v", Date.now().toString());
  const cdnEndpoint = new URL(QUARK_MIRROR_CDN_URL);
  cdnEndpoint.searchParams.set("v", Date.now().toString());
  const apiEndpoint = new URL(QUARK_MIRROR_API_URL);
  apiEndpoint.searchParams.set("v", Date.now().toString());

  // 与蓝奏云/移动云盘分流相同的多源回退顺序：
  //   preferLive 时优先 GitHub Contents API（静态 Pages 下唯一实时源）
  const sources = preferLive
    ? [
        { url: new URL("api/quark-mirror", siteBase) },
        { url: apiEndpoint, githubContents: true },
        { url: endpoint },
        { url: liveEndpoint },
        { url: cdnEndpoint }
      ]
    : [
        { url: new URL("api/quark-mirror", siteBase) },
        { url: endpoint },
        { url: liveEndpoint },
        { url: apiEndpoint, githubContents: true },
        { url: cdnEndpoint }
      ];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let mirror = await response.json();
      if (source.githubContents) {
        mirror = JSON.parse(decodeBase64Utf8(mirror.content));
      }
      // 链接未填写：分流尚未开放，网页不显示按钮
      if (!mirror.url) return null;
      const url = new URL(mirror.url);
      if (url.protocol !== "https:") throw new Error("Invalid URL");
      return {
        label: String(mirror.label || "夸克网盘分流"),
        url: url.href,
        password: String(mirror.password || ""),
        source: source.url.hostname
      };
    } catch (error) {
      console.info(`Quark mirror source unavailable: ${source.url.hostname}`, error.message);
    }
  }
  return null;
}


