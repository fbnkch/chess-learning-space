import type { Line } from "./types";

/** Scores in UCI are relative to the root side to move, not the PV's last side. */
export function parseInfo(
  text: string,
  turn: "white" | "black",
): { multipv: number; line: Line } | undefined {
  if (
    !text.startsWith("info ") ||
    /\b(string|lowerbound|upperbound)\b/.test(text)
  )
    return;
  const depth = text.match(/\bdepth (\d+)\b/);
  const score = text.match(/\bscore (cp|mate) (-?\d+)\b/);
  const pv = text.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?(?:\s|$))+)/);
  if (
    !depth ||
    !score ||
    (!pv && !(Number(depth[1]) === 0 && Number(score[2]) === 0))
  )
    return;
  const value = Number(score[2]) * (turn === "white" ? 1 : -1) || 0;
  return {
    multipv: Number(text.match(/\bmultipv (\d+)\b/)?.[1] ?? 1),
    line: {
      depth: Number(depth[1]),
      uci: pv ? pv[1].trim().split(/\s+/) : [],
      ...(score[1] === "cp"
        ? { cp: value }
        : {
            mate: value,
            winner: (value === 0
              ? turn === "white"
                ? -1
                : 1
              : value > 0
                ? 1
                : -1) as 1 | -1,
          }),
    },
  };
}
