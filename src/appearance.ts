import type { Settings } from "./settings";

export const colorModes = ["system", "light", "dark"] as const;
export const colorThemes = ["graphite", "violet", "forest", "sand"] as const;
export type ColorMode = (typeof colorModes)[number];
export type ColorTheme = (typeof colorThemes)[number];
export const themeChoices: { id: ColorTheme; name: string; description: string }[] = [
  { id: "graphite", name: "Graphite", description: "Neutral gray, cool blue" },
  { id: "violet", name: "Violet", description: "Soft purple, T3-inspired" },
  { id: "forest", name: "Forest", description: "Sage green, natural tones" },
  { id: "sand", name: "Sand", description: "Warm stone, copper" },
];
export const isColorMode = (value: unknown): value is ColorMode =>
  colorModes.some((mode) => mode === value);
export const isColorTheme = (value: unknown): value is ColorTheme =>
  colorThemes.some((theme) => theme === value);

/** Apply before React renders and whenever the local appearance preference changes. */
export function applyAppearance(settings: Pick<Settings, "colorMode" | "colorTheme">) {
  const mode = settings.colorMode ?? "system";
  let systemDark = false;
  try {
    systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    // Browser capability failures must never prevent local training.
  }
  const scheme = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  const root = document.documentElement;
  root.dataset.colorScheme = scheme;
  root.dataset.colorTheme = settings.colorTheme ?? "graphite";
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    getComputedStyle(root).getPropertyValue("--canvas").trim(),
  );
}

/** A system preference change affects System mode only. */
export function observeAppearance(settings: Pick<Settings, "colorMode" | "colorTheme">) {
  applyAppearance(settings);
  if (settings.colorMode && settings.colorMode !== "system") return;
  try {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyAppearance(settings);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  } catch {
    // Older or restricted browsers keep the initial scheme.
  }
}
