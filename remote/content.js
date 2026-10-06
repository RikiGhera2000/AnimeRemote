function getVideos() {
  const videos = [...document.querySelectorAll("video")];
  videos.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return (br.width * br.height) - (ar.width * ar.height);
  });
  return videos;
}

function getVideo() {
  return getVideos().find((video) => {
    const rect = video.getBoundingClientRect();
    const style = getComputedStyle(video);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }) || null;
}

function reportPlayerFrame() {
  const video = getVideo();
  if (!video) return;
  const rect = video.getBoundingClientRect();
  chrome.runtime.sendMessage({ type: "player-frame-report", area: rect.width * rect.height }, () => void chrome.runtime.lastError);
}

function sendKey(key, code = key) {
  const options = { key, code, bubbles: true, cancelable: true };
  document.dispatchEvent(new KeyboardEvent("keydown", options));
  document.dispatchEvent(new KeyboardEvent("keyup", options));
}

function findEpisodeButton(words) {
  const candidates = document.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]');
  for (const element of candidates) {
    const text = (element.innerText || element.value || element.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").toLowerCase();
    if (text && words.some((word) => text.includes(word))) return element;
  }
  return null;
}

function clickEpisode(direction) {
  const words = direction === "next" ? ["successivo", "next"] : ["precedente", "previous", "prev"];
  const button = findEpisodeButton(words);
  if (button) button.click();
  else console.warn(`[Anime Remote] Pulsante episodio ${direction} non trovato in questo frame`);
}

async function handleCommand(command) {
  const video = getVideo();
  switch (command) {
    case "play_pause":
      if (video) {
        if (video.paused) await video.play().catch((error) => console.warn("[Anime Remote] Play bloccato dal sito", error));
        else video.pause();
      } else sendKey(" ", "Space");
      break;
    case "back10":
      if (video) video.currentTime = Math.max(0, video.currentTime - 10);
      else sendKey("ArrowLeft");
      break;
    case "forward10":
      if (video) video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      else sendKey("ArrowRight");
      break;
    case "next": clickEpisode("next"); break;
    case "previous": clickEpisode("previous"); break;
    case "volume_up":
      if (video) video.volume = Math.min(1, video.volume + 0.1);
      else sendKey("ArrowUp");
      break;
    case "volume_down":
      if (video) video.volume = Math.max(0, video.volume - 0.1);
      else sendKey("ArrowDown");
      break;
    case "mute":
      if (video) video.muted = !video.muted;
      else sendKey("m", "KeyM");
      break;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "focus-player") {
    const video = getVideo();
    if (video) {
      window.focus();
      if (!video.hasAttribute("tabindex")) video.tabIndex = -1;
      video.focus({ preventScroll: true });
      sendResponse({ focused: true, frame: location.href });
    } else sendResponse({ focused: false });
    return;
  }
  if (message?.type === "remote-command") {
    void handleCommand(message.command).then(() => {
      reportPlayerFrame();
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});

let reapplyTimer = null;
let lastReapplyAt = 0;
async function maybeReapplyFullscreen() {
  const { keepPlayerFullscreen = false } = await chrome.storage.local.get(["keepPlayerFullscreen"]);
  if (!keepPlayerFullscreen || !getVideo() || document.fullscreenElement) return;
  const now = Date.now();
  if (now - lastReapplyAt < 1800) return;
  lastReapplyAt = now;
  chrome.runtime.sendMessage({ type: "fullscreen-reapply" }, () => void chrome.runtime.lastError);
}

const observer = new MutationObserver(() => {
  reportPlayerFrame();
  clearTimeout(reapplyTimer);
  reapplyTimer = setTimeout(() => void maybeReapplyFullscreen(), 350);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("loadedmetadata", reportPlayerFrame, true);
setTimeout(reportPlayerFrame, 500);
setInterval(reportPlayerFrame, 2000);
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) setTimeout(() => void maybeReapplyFullscreen(), 400);
});

chrome.storage.local.get(["keepPlayerFullscreen"], ({ keepPlayerFullscreen }) => {
  if (keepPlayerFullscreen) setTimeout(() => void maybeReapplyFullscreen(), 600);
});

if (window.top === window) {
  setInterval(() => chrome.runtime.sendMessage({ type: "poll-linked-tab" }, () => void chrome.runtime.lastError), 500);
}
