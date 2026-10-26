import { Game } from "../game/Game";
import type { Line } from "./types";
export function whiteAdvantage(line: Line): boolean {
  return line.mate !== undefined ? line.winner === 1 : line.cp >= 0;
}
export function score(line: Line): string {
  if (line.mate !== undefined)
    return `${line.winner === -1 ? "-" : ""}M${Math.abs(line.mate)}`;
  return (line.cp / 100).toFixed(1);
}
export function san(fen: string, moves: string[]): string {
  const game = new Game(fen);
  const result: string[] = [];
  for (const [index, move] of moves.entries()) {
    try {
      const number = game.fen.split(" ")[5];
      const prefix =
        game.turn === "white"
          ? `${number}. `
          : index === 0
            ? `${number}... `
            : "";
      result.push(prefix + game.play(move).san);
    } catch {
      break;
    }
  }
  return result.join(" ");
}
