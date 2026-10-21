// Site theme (Settings › Appearance and the header toggle): light, dark, or "auto" =
// follow the device. Saved in localStorage under "theme" (the key the header already used).

export type ThemeMode = "light" | "dark" | "auto";

const KEY = "theme";
const EVENT = "capimax:theme";

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "auto" ? v : "light";
  } catch {
    return "light";
  }
}

const systemDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "auto" && systemDark());
  document.documentElement.classList.toggle("dark", !!dark);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { mode, dark: !!dark } }));
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* private mode: still applies for this page */
  }
  apply(mode);
}

export const isDarkNow = () => document.documentElement.classList.contains("dark");

/** Listen for theme changes (from Settings, the header, or the device in auto mode). */
export function onThemeChange(cb: (s: { mode: ThemeMode; dark: boolean }) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Apply the saved theme once at startup and follow the device while in auto mode. */
export function initTheme() {
  apply(getThemeMode());
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (getThemeMode() === "auto") apply("auto");
  });
}
