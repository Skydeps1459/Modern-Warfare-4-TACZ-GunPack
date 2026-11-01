export function isEnglish() {
  return typeof document !== "undefined"
    && document.documentElement.lang.toLowerCase().startsWith("en");
}

export function intlLocale() {
  return isEnglish() ? "en-US" : "zh-CN";
}

export function uiText(zh, en) {
  return isEnglish() ? en : zh;
}

export function siteBaseUrl() {
  const base = document.documentElement.dataset.siteBase || "./";
  return new URL(base, document.baseURI);
}
