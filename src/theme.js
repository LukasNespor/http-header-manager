// Theme handling. Loaded synchronously in <head> so the stored theme is applied
// before the first paint.

const THEME_KEY = "theme";
const root = document.documentElement;

// chrome.storage is async, which would paint the wrong theme for a frame on
// every popup open. localStorage is synchronous, so it acts as a first-paint
// cache while chrome.storage stays the source of truth (it survives a cleared
// site data and is shared with incognito windows).
function readCachedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function cacheTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore — the theme still applies for this session.
  }
}

// "system" leaves data-theme unset so the prefers-color-scheme media query wins.
function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }
}

applyTheme(readCachedTheme());

document.addEventListener("DOMContentLoaded", async () => {
  const group = document.getElementById("theme");

  function select(theme) {
    for (const button of group.children) {
      button.setAttribute("aria-pressed", String(button.dataset.themeValue === theme));
    }
    applyTheme(theme);
  }

  group.addEventListener("click", (event) => {
    const theme = event.target.closest("[data-theme-value]")?.dataset.themeValue;
    if (!theme) return;

    select(theme);
    cacheTheme(theme);
    chrome.storage.local.set({ [THEME_KEY]: theme });
  });

  const stored = await chrome.storage.local.get(THEME_KEY);
  const theme = stored[THEME_KEY] || "system";
  cacheTheme(theme);
  select(theme);
});
