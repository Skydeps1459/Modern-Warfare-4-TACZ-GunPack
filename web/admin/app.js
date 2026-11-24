const statePanel = document.querySelector("#admin-state");
const form = document.querySelector("#mirror-form");
const accountName = document.querySelector("#account-name");
const labelInput = document.querySelector("#mirror-label");
const closedInput = document.querySelector("#mirror-closed");
const noticeInput = document.querySelector("#mirror-notice");
const noticeEnInput = document.querySelector("#mirror-notice-en");
const urlInput = document.querySelector("#mirror-url");
const passwordInput = document.querySelector("#mirror-password");
const saveStatus = document.querySelector("#save-status");
const mobileForm = document.querySelector("#mobile-form");
const mobileLabelInput = document.querySelector("#mobile-label");
const mobileUrlInput = document.querySelector("#mobile-url");
const mobilePasswordInput = document.querySelector("#mobile-password");
const mobileSaveStatus = document.querySelector("#mobile-save-status");
const quarkForm = document.querySelector("#quark-form");
const quarkLabelInput = document.querySelector("#quark-label");
const quarkUrlInput = document.querySelector("#quark-url");
const quarkPasswordInput = document.querySelector("#quark-password");
const quarkSaveStatus = document.querySelector("#quark-save-status");
const acceleratorForm = document.querySelector("#accelerator-form");
const acceleratorEnabledInput = document.querySelector("#accelerator-enabled");
const acceleratorSaveStatus = document.querySelector("#accelerator-save-status");

let csrfToken = "";

function syncClosedState() {
  const closed = closedInput.checked;
  // 关闭态下链接仍可编辑：提前维护好链接，取消关闭后即可启用
  urlInput.required = !closed;
  noticeInput.disabled = !closed;
  noticeEnInput.disabled = !closed;
}

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
  closedInput.checked = payload.mirror.closed === true;
  noticeInput.value = payload.mirror.notice || "";
  noticeEnInput.value = payload.mirror.noticeEn || "";
  urlInput.value = payload.mirror.url || "";
  passwordInput.value = payload.mirror.password || "";
  const mobile = payload.mobileMirror || {};
  mobileLabelInput.value = mobile.label || "移动云盘分流";
  mobileUrlInput.value = mobile.url || "";
  mobilePasswordInput.value = mobile.password || "";
  syncClosedState();
  statePanel.classList.add("hidden");
  form.classList.remove("hidden");
  const quark = payload.quarkMirror || {};
  quarkLabelInput.value = quark.label || "夸克网盘分流";
  quarkUrlInput.value = quark.url || "";
  quarkPasswordInput.value = quark.password || "";
  mobileForm.classList.remove("hidden");
  quarkForm.classList.remove("hidden");
  acceleratorEnabledInput.checked = payload.accelerator?.enabled === true;
  acceleratorForm.classList.remove("hidden");
}

closedInput.addEventListener("change", syncClosedState);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveStatus.textContent = "正在提交到 GitHub…";
  saveStatus.className = "";

  const closed = closedInput.checked;
  const body = closed
    ? {
        closed: true,
        label: labelInput.value.trim(),
        notice: noticeInput.value.trim(),
        noticeEn: noticeEnInput.value.trim(),
        url: urlInput.value.trim(),
        password: passwordInput.value.trim()
      }
    : {
        label: labelInput.value.trim(),
        url: urlInput.value.trim(),
        password: passwordInput.value.trim()
      };

  const response = await fetch("/api/admin/domestic-mirror", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    saveStatus.textContent = payload.error || `保存失败（HTTP ${response.status}）`;
    saveStatus.className = "error";
    return;
  }

  saveStatus.textContent = closed
    ? "已提交关闭状态，GitHub Pages 将自动更新。"
    : "已提交，GitHub Pages 将自动更新。";
  saveStatus.className = "success";
});

mobileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  mobileSaveStatus.textContent = "正在提交到 GitHub…";
  mobileSaveStatus.className = "";

  const response = await fetch("/api/admin/mobile-mirror", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({
      label: mobileLabelInput.value.trim(),
      url: mobileUrlInput.value.trim(),
      password: mobilePasswordInput.value.trim()
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    mobileSaveStatus.textContent = payload.error || `保存失败（HTTP ${response.status}）`;
    mobileSaveStatus.className = "error";
    return;
  }

  mobileSaveStatus.textContent = mobileUrlInput.value.trim()
    ? "已提交，GitHub Pages 将自动更新。"
    : "已保存（链接为空，网页暂不显示该按钮）。";
  mobileSaveStatus.className = "success";
});

quarkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  quarkSaveStatus.textContent = "正在提交到 GitHub…";
  quarkSaveStatus.className = "";

  const response = await fetch("/api/admin/quark-mirror", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({
      label: quarkLabelInput.value.trim(),
      url: quarkUrlInput.value.trim(),
      password: quarkPasswordInput.value.trim()
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    quarkSaveStatus.textContent = payload.error || `保存失败（HTTP ${response.status}）`;
    quarkSaveStatus.className = "error";
    return;
  }

  quarkSaveStatus.textContent = quarkUrlInput.value.trim()
    ? "已提交，GitHub Pages 将自动更新。"
    : "已保存（链接为空，网页暂不显示该按钮）。";
  quarkSaveStatus.className = "success";
});

acceleratorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  acceleratorSaveStatus.textContent = "正在提交到 GitHub…";
  acceleratorSaveStatus.className = "";

  const enabled = acceleratorEnabledInput.checked;
  const response = await fetch("/api/admin/accelerator", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({ enabled })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    acceleratorSaveStatus.textContent = payload.error || `保存失败（HTTP ${response.status}）`;
    acceleratorSaveStatus.className = "error";
    return;
  }

  acceleratorSaveStatus.textContent = enabled
    ? "已打开加速下载，GitHub Pages 将自动更新。"
    : "已关闭加速下载（保留 GitHub 原链），GitHub Pages 将自动更新。";
  acceleratorSaveStatus.className = "success";
});

loadSession().catch((error) => {
  console.error(error);
  statePanel.textContent = "后台连接失败，请稍后重试。";
});