import { isColorMode, isColorTheme, type ColorMode, type ColorTheme } from "./appearance";

export interface Settings {
  colorMode?: ColorMode;
  colorTheme?: ColorTheme;
  welcomeComplete?: boolean;
  startingOpening?: "italian" | "london" | "caro" | "qgd";
  planStartedAt?: number;
  planReviewedGames?: string[];
  planExternal?: { play: number; endgame: number };
  chessComUsername?: string;
  safetyCheck?: boolean;
  activeLines?: number;
  sound: boolean;
  animationMs: number;
  coordinates: boolean;
  reducedMotion: boolean;
}
const key = "chess-learning-space:settings:v1";
export function readSettings(): Settings {
  try {
    const defaults: Settings = {
      colorMode: "system",
      colorTheme: "graphite",
      chessComUsername: "fbnkch",
      activeLines: 6,
      sound: true,
      animationMs: 200,
      coordinates: true,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    };
    let value: unknown;
    try {
      value = JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return defaults;
    }
    if (!value || typeof value !== "object") return defaults;
    const saved = value as Partial<Settings>;
    return {
      colorMode: isColorMode(saved.colorMode) ? saved.colorMode : "system",
      colorTheme: isColorTheme(saved.colorTheme) ? saved.colorTheme : "graphite",
      welcomeComplete: saved.welcomeComplete === true,
      planReviewedGames:
        Array.isArray(saved.planReviewedGames) &&
        saved.planReviewedGames.every((id) => typeof id === "string")
          ? saved.planReviewedGames
          : undefined,
      startingOpening: ["italian", "london", "caro", "qgd"].includes(
        saved.startingOpening ?? "",
      )
        ? saved.startingOpening
        : undefined,
      planStartedAt:
        typeof saved.planStartedAt === "number" &&
        Number.isFinite(saved.planStartedAt) &&
        saved.planStartedAt >= 0
          ? saved.planStartedAt
          : undefined,
      planExternal:
        saved.planExternal &&
        Number.isInteger(saved.planExternal.play) &&
        saved.planExternal.play >= 0 &&
        saved.planExternal.play <= 2 &&
        Number.isInteger(saved.planExternal.endgame) &&
        saved.planExternal.endgame >= 0 &&
        saved.planExternal.endgame <= 1
          ? saved.planExternal
          : undefined,
      chessComUsername:
        typeof saved.chessComUsername === "string"
          ? saved.chessComUsername
          : "fbnkch",
      safetyCheck: saved.safetyCheck === true,
      activeLines:
        Number.isInteger(saved.activeLines) &&
        saved.activeLines! >= 3 &&
        saved.activeLines! <= 12
          ? saved.activeLines
          : 6,
      sound: typeof saved.sound === "boolean" ? saved.sound : defaults.sound,
      coordinates:
        typeof saved.coordinates === "boolean"
          ? saved.coordinates
          : defaults.coordinates,
      reducedMotion:
        typeof saved.reducedMotion === "boolean"
          ? saved.reducedMotion
          : defaults.reducedMotion,
      animationMs: [0, 100, 200, 400].includes(saved.animationMs ?? -1)
        ? saved.animationMs!
        : defaults.animationMs,
    };
  } catch {
    return {
      colorMode: "system",
      colorTheme: "graphite",
      chessComUsername: "fbnkch",
      activeLines: 6,
      sound: true,
      animationMs: 200,
      coordinates: true,
      reducedMotion: false,
    };
  }
}
export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable(): boolean {
  try {
    const probe = key + ":probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
