const params = new URLSearchParams(window.location.search);
const id = params.get("id") || window.location.hash.replace(/^#web-update-/, "");
const safeId = id && /^[a-z0-9._-]+$/i.test(id) ? id : null;

if (safeId) {
  window.location.replace(`./website-updates/${encodeURIComponent(safeId)}.html`);
} else {
  window.location.replace("./website-updates.html?v=20261025-11");
}

