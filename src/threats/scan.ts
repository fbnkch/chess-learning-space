import { Chess, type Square, type PieceSymbol } from "chess.js";
import { Game, positionKey } from "../game/Game";
import type { Side } from "../repertoire/types";
import type { Repertoire } from "../repertoire/Repertoire";

export type Mark =
  | { kind: "arrow"; from: Square; to: Square }
  | { kind: "square"; square: Square };
export type Finding = Mark & { ruleId: "cct-scan"; reasons: string[] };
export type ScanMode = "scan" | "changed";
export interface ScanAttempt {
  attemptId: string;
  sessionId: string;
  at: number;
  positionKey: string;
  mode: ScanMode;
  required: number;
  found: number;
  wrong: number;
  durationMs: number;
}
export const markKey = (mark: Mark) =>
  mark.kind === "arrow" ? `${mark.from}${mark.to}` : mark.square;
const values: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: Infinity,
};

/** Legal checks/captures and hanging pieces, with recaptures tested after each capture.
 * A checked side cannot legally pass: omit its opponent's hypothetical move list.
 * Promotions and capture-checks share one drawable arrow, retaining all reasons.
 */
export function generateScan(fen: string): {
  marks: Finding[];
  skippedSide: boolean;
} {
  const chess = new Chess(fen);
  const marks = new Map<string, Finding>();
  function add(mark: Mark, reason: string) {
    const key = markKey(mark);
    const previous = marks.get(key);
    if (previous) {
      if (!previous.reasons.includes(reason)) previous.reasons.push(reason);
    } else marks.set(key, { ...mark, ruleId: "cct-scan", reasons: [reason] });
  }
  const skippedSide = chess.isCheck();
  const flipped = chess.fen().split(" ");
  flipped[1] = chess.turn() === "w" ? "b" : "w";
  flipped[3] = "-";
  const positions = skippedSide
    ? [chess]
    : [chess, new Chess(flipped.join(" "))];
  for (const side of positions) {
    for (const move of side.moves({ verbose: true })) {
      const arrow: Mark = { kind: "arrow", from: move.from, to: move.to };
      if (move.captured) {
        add(arrow, "capture");
        // En passant lands beside the victim, rather than on its square.
        const victimSquare: Square = move.isEnPassant()
          ? (`${move.to[0]}${move.from[1]}` as Square)
          : move.to;
        const victim = side.get(victimSquare)!;
        let hanging = values[move.piece] < values[victim.type];
        if (!hanging) {
          side.move(move);
          hanging = !side.moves({ verbose: true }).some(
            (reply) => reply.to === move.to && !!reply.captured,
          );
          side.undo();
        }
        if (hanging)
          add({ kind: "square", square: victimSquare }, "hanging piece");
      }
      if (/[+#]$/.test(move.san)) add(arrow, "check");
    }
  }
  return {
    marks: [...marks.values()].sort((a, b) =>
      markKey(a) < markKey(b) ? -1 : 1,
    ),
    skippedSide,
  };
}
export function gradeScan(
  required: readonly Mark[],
  submitted: readonly Mark[],
) {
  const expected = new Map(required.map((mark) => [markKey(mark), mark]));
  const actual = new Map(submitted.map((mark) => [markKey(mark), mark]));
  const missed = [...expected]
    .filter(([key]) => !actual.has(key))
    .map(([, mark]) => mark);
  const found = expected.size - missed.length;
  const wrong = [...actual.keys()].filter((key) => !expected.has(key)).length;
  return {
    pass: missed.length === 0 && wrong <= 1,
    recall: expected.size ? found / expected.size : 1,
    found,
    wrong,
    missed,
  };
}
/** Only threats by the opponent who just moved, against the responding learner. */
function threatsBy(fen: string, marks: readonly Finding[], mover: "w" | "b") {
  const chess = new Chess(fen);
  return marks.filter((mark) =>
    mark.kind === "arrow"
      ? chess.get(mark.from)?.color === mover
      : chess.get(mark.square)?.color !== mover,
  );
}
export function newThreats(before: string, after: string): Finding[] {
  if (new Chess(before).isCheck() || new Chess(after).isCheck()) return [];
  const mover = new Chess(before).turn();
  const known = new Set(threatsBy(before, generateScan(before).marks, mover).map(markKey));
  return threatsBy(after, generateScan(after).marks, mover).filter(
    (mark) => !known.has(markKey(mark)),
  );
}
export interface ScanPosition {
  side: Side;
  fen: string;
  key: string;
  title: string;
  before?: string;
  lastMove?: [Square, Square];
  required: Finding[];
}
export function eligiblePosition(required: readonly Mark[]) {
  return required.length >= 1 && required.length <= 12;
}
/** Stable source ordering plus seeded Fisher-Yates; no ambient randomness. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((state / 4294967296) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function repertoirePositions(
  repertoire: Repertoire,
  mode: ScanMode,
  seed = 9,
): ScanPosition[] {
  const positions = new Map<string, ScanPosition>();
  const seen = new Set<string>();
  const cache = new Map<string, Finding[]>();
  function scan(fen: string) {
    const key = positionKey(fen);
    let marks = cache.get(key);
    if (!marks) {
      marks = generateScan(fen).marks;
      cache.set(key, marks);
    }
    return marks;
  }
  for (const side of ["white", "black"] as const) {
    for (const line of repertoire.lineMeta(side)) {
      const game = new Game(line.startFen);
      for (const uci of line.moves) {
        const before = game.fen;
        const opponentMoved = game.turn !== side;
        game.play(uci);
        if (mode === "changed" && !opponentMoved) continue;
        const key = positionKey(game.fen);
        const identity =
          mode === "scan" ? key : `${positionKey(before)}>${key}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        // Ordinary scans are not check-evasion tasks. Neither endpoint of a
        // comparison may rely on an illegal hypothetical pass.
        if (game.check || (mode === "changed" && new Chess(before).isCheck())) continue;
        const mover = new Chess(before).turn();
        const known = mode === "changed"
          ? new Set(threatsBy(before, scan(before), mover).map(markKey))
          : new Set<string>();
        const candidates = mode === "changed"
          ? threatsBy(game.fen, scan(game.fen), mover)
          : scan(game.fen);
        const required = candidates.filter((mark) => !known.has(markKey(mark)));
        if (eligiblePosition(required) && !positions.has(identity))
          positions.set(identity, {
            side,
            fen: game.fen,
            key,
            title: line.name,
            required,
            before: mode === "changed" ? before : undefined,
            lastMove: game.lastMove,
          });
      }
    }
  }
  return seededShuffle([...positions.values()], seed);
}
