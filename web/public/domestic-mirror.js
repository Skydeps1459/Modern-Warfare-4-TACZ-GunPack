import { uiText } from "./i18n.js?v=20261101-1";

const boundMirrors = new WeakMap();
let toastTimer = null;

function ensureToast() {
  let toast = document.querySelector("#domestic-copy-toast");
  if (toast) return toast;
  toast = document.createElement("div");
  toast.id = "domestic-copy-toast";
  toast.className = "copy-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;
  document.body.append(toast);
  return toast;
}

function showToast(message) {
  const toast = ensureToast();
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("is-visible");
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 3600);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}

export function bindDomesticMirrorCopy(link, mirror) {
  if (!link || !mirror?.password) return;
  boundMirrors.set(link, mirror);
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  if (link.dataset.copyPasswordBound === "1") return;
  link.dataset.copyPasswordBound = "1";
  link.addEventListener("click", async () => {
    const currentMirror = boundMirrors.get(link);
    if (!currentMirror?.password) return;
    try {
      await copyText(currentMirror.password);
      showToast(uiText(
        `蓝奏云密码 ${currentMirror.password} 已复制，请在新页面输入。`,
        `Lanzou Cloud password ${currentMirror.password} copied. Enter it on the new page.`
      ));
    } catch (error) {
      console.error(error);
      showToast(uiText(
        `无法自动复制，请手动输入密码：${currentMirror.password}`,
        `Could not copy automatically. Enter the password manually: ${currentMirror.password}`
      ));
    }
  });
}

