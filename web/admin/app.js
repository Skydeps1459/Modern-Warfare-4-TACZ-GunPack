const statePanel = document.querySelector("#admin-state");
const form = document.querySelector("#mirror-form");
const cdnForm = document.querySelector("#cdn-form");
const accountName = document.querySelector("#account-name");
const labelInput = document.querySelector("#mirror-label");
const urlInput = document.querySelector("#mirror-url");
const passwordInput = document.querySelector("#mirror-password");
const saveStatus = document.querySelector("#save-status");
const cdnEnabledInput = document.querySelector("#cdn-enabled");
const cdnLabelInput = document.querySelector("#cdn-label");
const cdnModeInput = document.querySelector("#cdn-mode");
const cdnUrlInput = document.querySelector("#cdn-url");
const cdnPasswordInput = document.querySelector("#cdn-password");
const cdnSaveStatus = document.querySelector("#cdn-save-status");

let csrfToken = "";

async function loadSession() {
  const response = await fetch("/api/admin/session", {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    statePanel.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "需要 GitHub 登录。";
    const login = document.createElement("a");
    login.className = "button";
    login.href = payload.loginUrl || "/auth/github";
    login.textContent = "使用 GitHub 登录";
    statePanel.append(message, login);
    return;
  }

  if (!response.ok) {
    statePanel.textContent = payload.error || "后台尚未完成 OAuth 配置。";
    return;
  }

  csrfToken = payload.csrfToken;
  accountName.textContent = payload.user.login;
  labelInput.value = payload.mirror.label || "";
  urlInput.value = payload.mirror.url || "";
  passwordInput.value = payload.mirror.password || "";
  const cdn = payload.cdnMirror || {};
  cdnEnabledInput.checked = cdn.enabled === true;
  cdnLabelInput.value = cdn.label || "腾讯云CDN加速";
  cdnModeInput.value = cdn.mode === "prefix" ? "prefix" : "direct";
  cdnUrlInput.value = cdn.url || "";
  cdnPasswordInput.value = cdn.password || "";
  statePanel.classList.add("hidden");
  form.classList.remove("hidden");
  cdnForm.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveStatus.textContent = "正在提交到 GitHub…";
  saveStatus.className = "";

  const response = await fetch("/api/admin/domestic-mirror", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({
      label: labelInput.value.trim(),
      url: urlInput.value.trim(),
      password: passwordInput.value.trim()
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    saveStatus.textContent = payload.error || `保存失败（HTTP ${response.status}）`;
    saveStatus.className = "error";
    return;
  }

  saveStatus.textContent = "已提交，GitHub Pages 将自动更新。";
  saveStatus.className = "success";
});

cdnForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  cdnSaveStatus.textContent = "正在提交到 GitHub…";
  cdnSaveStatus.className = "";

  const response = await fetch("/api/admin/cdn-mirror", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({
      enabled: cdnEnabledInput.checked,
      label: cdnLabelInput.value.trim(),
      mode: cdnModeInput.value === "prefix" ? "prefix" : "direct",
      url: cdnUrlInput.value.trim(),
      password: cdnPasswordInput.value.trim()
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    cdnSaveStatus.textContent = payload.error || `保存失败（HTTP ${response.status}）`;
    cdnSaveStatus.className = "error";
    return;
  }

  cdnSaveStatus.textContent = cdnEnabledInput.checked
    ? "已提交，GitHub Pages 将自动更新。"
    : "已保存（未启用，网页暂不显示该按钮）。";
  cdnSaveStatus.className = "success";
});

loadSession().catch((error) => {
  console.error(error);
  statePanel.textContent = "后台连接失败，请稍后重试。";
});
