const SERVER = "http://127.0.0.1:8765/command";

async function getPlayerFrameId(tabId) {
  const { playerFrameReports = {} } = await chrome.storage.local.get(["playerFrameReports"]);
  const reports = playerFrameReports[String(tabId)] || {};
  const now = Date.now();
  const candidates = Object.entries(reports)
    .filter(([, item]) => item.area > 0 && now - item.seenAt < 7000)
    .sort((a, b) => b[1].area - a[1].area);
  return candidates.length ? Number(candidates[0][0]) : 0;
}

async function sendToFrame(tabId, frameId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, { frameId }, (response) => {
      const error = chrome.runtime.lastError;
      resolve({ response, error: error?.message || null });
    });
  });
}

async function pressKeyInTab(tabId, key, frameId) {
  const target = { tabId };
  const code = key === "f" ? "KeyF" : key;
  const keyCode = key === "f" ? 70 : 0;
  const playerFrameId = frameId ?? await getPlayerFrameId(tabId);
  await sendToFrame(tabId, playerFrameId, { type: "focus-player" });
  await chrome.debugger.attach(target, "1.3");
  try {
    await chrome.debugger.sendCommand(target, "Page.bringToFront");
    await new Promise((resolve) => setTimeout(resolve, 120));
    const keyData = {
      key, code, modifiers: 0,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      text: key.length === 1 ? key : undefined,
      unmodifiedText: key.length === 1 ? key : undefined
    };
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", { ...keyData, type: "rawKeyDown" });
    if (key.length === 1) await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", { ...keyData, type: "char" });
    await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", { ...keyData, type: "keyUp" });
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

async function togglePlayerFullscreen(tabId) {
  const { keepPlayerFullscreen = false } = await chrome.storage.local.get(["keepPlayerFullscreen"]);
  const enabled = !keepPlayerFullscreen;
  await chrome.storage.local.set({ keepPlayerFullscreen: enabled });
  await pressKeyInTab(tabId, "f");
  return enabled;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "get-target") {
    chrome.storage.local.get(["targetTabId", "targetTitle", "targetUrl"], sendResponse);
    return true;
  }

  if (message?.type === "player-frame-report" && sender.tab?.id != null && sender.frameId != null) {
    (async () => {
      const { playerFrameReports = {} } = await chrome.storage.local.get(["playerFrameReports"]);
      const byTab = { ...(playerFrameReports[String(sender.tab.id)] || {}) };
      byTab[String(sender.frameId)] = {
        area: Math.max(0, Number(message.area) || 0),
        url: sender.url || "",
        seenAt: Date.now()
      };
      const cutoff = Date.now() - 7000;
      for (const [frameId, item] of Object.entries(byTab)) {
        if (item.seenAt < cutoff) delete byTab[frameId];
      }
      playerFrameReports[String(sender.tab.id)] = byTab;
      await chrome.storage.local.set({ playerFrameReports });
      sendResponse({ ok: true });
    })().catch((error) => {
      console.warn("[Anime Remote] Errore rilevamento player", error);
      sendResponse({ ok: false });
    });
    return true;
  }

  if (message?.type === "link-current-tab") {
    const tab = message.tab;
    if (!tab?.id) {
      sendResponse({ ok: false, error: "Scheda non disponibile" });
      return;
    }
    chrome.storage.local.set({
      targetTabId: tab.id,
      targetTitle: tab.title || "Scheda senza titolo",
      targetUrl: tab.url || "",
      keepPlayerFullscreen: false
    }, () => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "unlink-tab") {
    chrome.storage.local.remove(["targetTabId", "targetTitle", "targetUrl", "keepPlayerFullscreen"], () => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "fullscreen-reapply" && sender.tab?.id) {
    (async () => {
      try {
        const { targetTabId, keepPlayerFullscreen } = await chrome.storage.local.get(["targetTabId", "keepPlayerFullscreen"]);
        if (sender.tab.id === targetTabId && keepPlayerFullscreen) {
          await pressKeyInTab(targetTabId, "f", sender.frameId);
          sendResponse({ ok: true });
        } else sendResponse({ ok: false, ignored: true });
      } catch (error) {
        console.warn("[Anime Remote] Non riesco a reinviare F", error);
        sendResponse({ ok: false, error: String(error) });
      }
    })();
    return true;
  }

  if (message?.type === "poll-linked-tab" && sender.tab?.id) {
    (async () => {
      try {
        const { targetTabId } = await chrome.storage.local.get(["targetTabId"]);
        if (sender.tab.id !== targetTabId) {
          sendResponse({ ok: false, ignored: true });
          return;
        }
        const response = await fetch(SERVER, { cache: "no-store" });
        const data = await response.json();
        if (!data.command) {
          sendResponse({ ok: true, command: null });
          return;
        }
        if (data.command === "fullscreen") {
          const enabled = await togglePlayerFullscreen(targetTabId);
          sendResponse({ ok: true, command: data.command, enabled });
          return;
        }

        // Episodio precedente/successivo riguarda la pagina; i comandi video vanno al player selezionato.
        const frameId = ["next", "previous"].includes(data.command)
          ? 0
          : await getPlayerFrameId(targetTabId);
        const result = await sendToFrame(targetTabId, frameId, { type: "remote-command", command: data.command });
        sendResponse({ ok: !result.error, command: data.command, frameId, error: result.error });
      } catch (error) {
        console.warn("[Anime Remote] Errore nel ponte", error);
        sendResponse({ ok: false, error: String(error) });
      }
    })();
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(["targetTabId", "playerFrameReports"], ({ targetTabId, playerFrameReports = {} }) => {
    delete playerFrameReports[String(tabId)];
    if (targetTabId === tabId) chrome.storage.local.remove(["targetTabId", "targetTitle", "targetUrl", "keepPlayerFullscreen"]);
    chrome.storage.local.set({ playerFrameReports });
  });
});
