import { Chess, type Move, type Square } from "chess.js";
import { Game } from "../game/Game";
import type { Line } from "../engine/types";
import { san } from "../engine/presentation";

export interface Finding {
  motif: string;
  text: string;
  ruleId: string;
  squares: Square[];
  fen: string;
  line: string[];
}
const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function material(chess: Chess, side: string) {
  return chess
    .board()
    .flat()
    .reduce(
      (sum, p) => sum + (p ? values[p.type] * (p.color === side ? 1 : -1) : 0),
      0,
    );
}
function replay(fen: string, line: string[]) {
  const game = new Game(fen);
  try {
    const moves = line.map((m) => game.play(m));
    return { moves, chess: new Chess(game.fen) };
  } catch {
    return null;
  }
}

/** Only post-game engine facts. A truncated/illegal PV never proves a motif. */
export function explain(
  fen: string,
  uci: string,
  review: { best: Line; played: Line },
): Finding[] {
  const side = new Chess(fen).turn();
  const winner = side === "w" ? 1 : -1;
  const findings: Finding[] = [];
  const best = replay(fen, review.best.uci);
  const line = [uci, ...review.played.uci];
  const played = replay(fen, line);
  const add = (
    motif: string,
    text: string,
    ruleId: string,
    moves: string[],
    proof: Move[],
  ) =>
    findings.push({
      motif,
      text,
      ruleId,
      fen,
      line: moves,
      squares: [...new Set(proof.flatMap((m) => [m.from, m.to]))],
    });
  if (
    played &&
    review.played.mate !== undefined &&
    review.played.winner !== winner
  ) {
    add(
      "allowed-mate",
      "The engine reports forced mate for the opponent after this move.",
      "king-safe-before-attack",
      line,
      played.moves,
    );
  }
  if (
    best &&
    review.best.mate !== undefined &&
    review.best.winner === winner &&
    !(review.played.mate !== undefined && review.played.winner === winner)
  ) {
    add(
      "missed-mate",
      "The engine move preserves the missed forced mate.",
      "cct-scan",
      review.best.uci,
      best.moves,
    );
  }
  // A quiet endpoint is essential: do not turn an unfinished exchange or a
  // compensated sacrifice into a claim that a piece was simply lost.
  if (
    played &&
    line.length >= 4 &&
    !played.chess.isCheck() &&
    !played.chess.moves({ verbose: true }).some((m) => m.captured) &&
    review.played.cp !== undefined &&
    review.played.cp * winner < -50
  ) {
    const loss = material(new Chess(fen), side) - material(played.chess, side);
    if (loss >= 1) {
      add(
        "material-loss",
        `Material balance falls by ${loss} points in this ${line.length}-ply engine line.`,
        "count-attackers-defenders",
        line,
        played.moves,
      );
      const capture = played.moves[1];
      const capturedPosition = capture ? new Chess(capture.after) : null;
      if (
        capture?.captured &&
        values[capture.captured] > 1 &&
        (values[capture.piece] < values[capture.captured] ||
          !capturedPosition
            ?.moves({ verbose: true })
            .some((m) => m.captured && m.to === capture.to)) &&
        !played.moves
          .slice(2)
          .some((m) => m.color === side && (m.captured || m.promotion)) &&
        !played.moves.slice(2).some((m) => m.to === capture.to && m.captured)
      ) {
        add(
          "hanging-piece",
          `The opponent captures on ${capture.to} without compensation in this line.`,
          "better-move-safe-first",
          line,
          played.moves,
        );
      }
    }
  }
  if (best && best.moves.length >= 3) {
    const first = best.moves[0];
    const followUp = best.moves[2];
    let legalCaptures: Move[] = [];
    const after = new Chess(first.after);
    // Legal captures, not geometric attacks: a pinned attacker cannot fork.
    if (!after.isCheck()) {
      const fields = after.fen().split(" ");
      fields[1] = side;
      fields[3] = "-";
      legalCaptures = new Chess(fields.join(" "))
        .moves({ verbose: true })
        .filter((m) => m.captured);
      const attacks = legalCaptures.filter(
        (m) => m.from === first.to && m.captured && values[m.captured] >= 3,
      );
      const targets = new Set(attacks.map((m) => m.to));
      if (
        targets.size >= 2 &&
        followUp.from === first.to &&
        targets.has(followUp.to) &&
        followUp.captured
      ) {
        add(
          "missed-fork",
          `The better move attacks ${[...targets].join(" and ")}; the engine line confirms the follow-up capture.`,
          "cct-scan",
          review.best.uci,
          best.moves,
        );
      }
    }
    if (["b", "r", "q"].includes(first.piece)) {
      const file = first.to.charCodeAt(0) - 97,
        rank = Number(first.to[1]) - 1;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        if (
          (first.piece === "b" && (!dx || !dy)) ||
          (first.piece === "r" && dx && dy)
        )
          continue;
        const targets: { square: Square; type: keyof typeof values }[] = [];
        for (
          let x = file + dx, y = rank + dy;
          x >= 0 && x < 8 && y >= 0 && y < 8;
          x += dx, y += dy
        ) {
          const square = (String.fromCharCode(97 + x) + (y + 1)) as Square;
          const piece = after.get(square);
          if (!piece) continue;
          if (piece.color === side) break;
          targets.push({ square, type: piece.type });
          if (targets.length === 2) break;
        }
        if (targets.length !== 2) continue;
        const [front, rear] = targets;
        // The proving PV must actually exploit the alignment, not merely show it.
        if (
          followUp.from !== first.to ||
          !followUp.captured ||
          (followUp.to !== rear.square && followUp.to !== front.square) ||
          (front.type !== "k" &&
            !legalCaptures.some(
              (m) => m.from === first.to && m.to === front.square,
            ))
        )
          continue;
        const pin =
          rear.type === "k" ||
          (front.type !== "k" && values[rear.type] > values[front.type]);
        const skewer =
          front.type === "k" || values[front.type] > values[rear.type];
        if (pin || skewer)
          add(
            pin ? "missed-pin" : "missed-skewer",
            `The better move aligns ${front.square} and ${rear.square}; the engine line confirms a capture through this ${pin ? "pin" : "skewer"}.`,
            "attack-pinned-cheaply",
            review.best.uci,
            best.moves,
          );
      }
    }
  }
  if (
    played?.moves[1] &&
    (played.moves[1].captured || played.moves[1].san.includes("+"))
  ) {
    add(
      "opponent-threat",
      `The engine replies ${played.moves[1].san} after this move.`,
      "ask-opponent-intent",
      line,
      played.moves,
    );
  }
  if (!findings.length) {
    const move = best?.moves[0];
    const evaluation =
      review.played.cp === undefined
        ? "a mate score"
        : `${(review.played.cp / 100).toFixed(1)} pawns from White's perspective`;
    add(
      "engine",
      `Better was ${move?.san ?? "the engine move"}; the played move leaves an engine score of ${evaluation}. This line proves no tactical motif.`,
      "assume-best-move",
      best ? review.best.uci : [],
      best?.moves ?? [],
    );
  }
  return findings;
}

export function provingLine(finding: Finding) {
  return san(finding.fen, finding.line);
}
