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

let csrfToken = "";

function syncClosedState() {
  const closed = closedInput.checked;
  urlInput.required = !closed;
  urlInput.disabled = closed;
  passwordInput.disabled = closed;
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
  syncClosedState();
  statePanel.classList.add("hidden");
  form.classList.remove("hidden");
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
        noticeEn: noticeEnInput.value.trim()
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

loadSession().catch((error) => {
  console.error(error);
  statePanel.textContent = "后台连接失败，请稍后重试。";
});