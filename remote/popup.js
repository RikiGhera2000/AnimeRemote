const statusBox = document.getElementById("status");
const linkButton = document.getElementById("link");
const unlinkButton = document.getElementById("unlink");

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const target = await chrome.runtime.sendMessage({ type: "get-target" });
  const linked = target?.targetTabId != null;
  if (linked) {
    statusBox.innerHTML = `<div class="title">🟢 Collegata: ${escapeHtml(target.targetTitle || "Scheda")}</div><div class="url">${escapeHtml(target.targetUrl || "")}</div>`;
    linkButton.textContent = tab?.id === target.targetTabId ? "Scheda già collegata" : "Collega questa scheda al posto di quella attuale";
  } else {
    statusBox.textContent = "⚪ Nessuna scheda collegata";
    linkButton.textContent = "Collega questa scheda";
  }
  linkButton.disabled = !tab?.id || tab.url?.startsWith("chrome://");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

linkButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.runtime.sendMessage({ type: "link-current-tab", tab });
  await refresh();
});

unlinkButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "unlink-tab" });
  await refresh();
});

refresh();
