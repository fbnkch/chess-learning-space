import { createHash } from "node:crypto";
import { Game, positionKey } from "../game/Game.ts";
import type { Edge, Graph, Side, IdeaArrow } from "./types.ts";

/** Files may contain multiple games; every main line and RAV has an authored identity. */
export function compileSide(files: readonly string[], side: Side): Graph {
  const graph: Graph = {
    side,
    contentVersion: createHash("sha256")
      .update(JSON.stringify([side, files]))
      .digest("hex"),
    nodes: {},
    lines: [],
  };
  const ids = new Set<string>();
  const occurrences: { from: string; edge: Edge; order: number }[] = [];
  let order = 0;
  const nodeFor = (game: Game) =>
    (graph.nodes[positionKey(game.fen)] ??= {
      fen: game.fen,
      edges: [],
      lines: [],
    });
  function compileGame(pgn: string) {
    const headers = Object.fromEntries(
      [...pgn.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)].map((m) => [m[1], m[2]]),
    );
    const tokens =
      pgn
        .replace(/^\uFEFF/, "")
        .replace(/^%[^\n]*/gm, "")
        .replace(/\[\w+\s+"[^"]*"\]/g, "")
        .replace(/\{[^}]*\}|;[^\n]*/g, (token) =>
          token.startsWith(";") ? "" : token,
        )
        .match(/\{[^}]*\}|\(|\)|\d+\.(?:\.\.)?|\.\.\.|\$\d+|[^\s(){}$]+/g) ??
      [];
    const start = new Game(headers.FEN);
    let cursor = 0;
    function walk(prefix: string[], variation: boolean) {
      const game = new Game(start.fen);
      prefix.forEach((uci) => game.play(uci));
      let lineId: string | undefined = variation ? undefined : headers.LineId;
      let pending: { from: string; edge: Edge; order: number } | undefined;
      function flush() {
        if (!pending) return;
        occurrences.push(pending);
        pending = undefined;
      }
      function finish() {
        flush();
        if (!lineId) throw new Error("Missing explicit line ID");
        if (ids.has(lineId)) throw new Error(`Duplicate line ID: ${lineId}`);
        ids.add(lineId);
        const line = {
          id: lineId,
          name: headers.Event ?? "Repertoire line",
          group: headers.OpeningGroup ?? "",
          summary: headers.Summary ?? "",
          startFen: start.fen,
          moves: [...game.moves],
          weight: Number(headers.Weight ?? 1),
          main: headers.Main === "true",
        };
        if (variation) graph.lines.push(line);
        else graph.lines.unshift(line);
        const replay = new Game(start.fen);
        nodeFor(replay).lines.push({ lineId, ply: 0 });
        line.moves.forEach((uci, i) => {
          replay.play(uci);
          nodeFor(replay).lines.push({ lineId: lineId!, ply: i + 1 });
        });
      }
      while (cursor < tokens.length) {
        const token = tokens[cursor++];
        if (token === ")") {
          if (!variation) throw new Error("Unexpected PGN variation end");
          finish();
          return;
        }
        if (token === "(") {
          if (!pending && !game.moves.length)
            throw new Error("Variation without preceding move");
          walk(game.moves.slice(0, -1), true);
          continue;
        }
        if (token.startsWith("{")) {
          const raw = token.slice(1, -1);
          const id = /\[%line\s+([^\]\s]+)\]/.exec(raw)?.[1];
          if (id) {
            if (lineId && lineId !== id)
              throw new Error("Conflicting line IDs");
            lineId = id;
          }
          if (pending) {
            const edge = pending.edge;
            const text = raw.replace(/\[%[^\]]*\]/g, "").trim();
            edge.comment = [edge.comment, text].filter(Boolean).join(" ");
            for (const match of raw.matchAll(/\[%rules\s+([^\]]*)\]/g))
              edge.ruleIds = [
                ...new Set([
                  ...edge.ruleIds,
                  ...match[1].split(/[\s,]+/).filter(Boolean),
                ]),
              ].sort();
            for (const match of raw.matchAll(/\[%weight\s+([^\]]+)\]/g)) {
              const weight = Number(match[1]);
              if (!Number.isFinite(weight) || weight <= 0)
                throw new Error("Invalid edge weight");
              edge.weight = weight;
            }
            for (const match of raw.matchAll(/\[%cal\s+([^\]]*)\]/g)) {
              for (const arrow of match[1].split(/[,\s]+/).filter(Boolean)) {
                if (!/^[GRBY][a-h][1-8][a-h][1-8]$/.test(arrow))
                  throw new Error("Invalid idea arrow");
                edge.arrows.push({
                  color: arrow[0] as IdeaArrow["color"],
                  from: arrow.slice(1, 3),
                  to: arrow.slice(3),
                });
              }
            }
          }
          continue;
        }
        if (/^(\d+\.|\.\.\.|\$|1-0$|0-1$|1\/2-1\/2$|\*$)/.test(token)) continue;
        flush();
        const from = positionKey(game.fen);
        nodeFor(game);
        const kind = game.turn === side ? "ours" : "reply";
        const uci = game.toUci(
          token.replace(/[!?]+$/g, "").replaceAll("0", "O"),
        );
        game.play(uci);
        nodeFor(game);
        pending = {
          from,
          order: order++,
          edge: {
            uci,
            to: positionKey(game.fen),
            kind,
            comment: "",
            ruleIds: [],
            arrows: [],
            weight: 1,
          },
        };
      }
      if (variation) throw new Error("Unclosed PGN variation");
      finish();
    }
    walk([], false);
  }
  for (const file of files) {
    const cleaned = file.replace(/^%[^\n]*/gm, "");
    const blocks = [...cleaned.matchAll(/(?:^\s*\[\w+\s+"[^"]*"\]\s*)+/gm)];
    if (!blocks.length) compileGame(cleaned);
    else
      blocks.forEach((block, i) =>
        compileGame(cleaned.slice(block.index, blocks[i + 1]?.index)),
      );
  }
  // Compare complete annotations only after all comments (including those after RAVs) are known.
  for (const { from, edge } of occurrences.sort((a, b) => a.order - b.order)) {
    edge.arrows = canonicalArrows(edge.arrows);
    const edges = graph.nodes[from].edges;
    const i = edges.findIndex((e) => e.uci === edge.uci);
    if (i < 0) edges.push(edge);
    // A transposing line may repeat a move without its annotation; that is not a conflict.
    else if (isBare(edge)) continue;
    else if (isBare(edges[i])) edges[i] = edge;
    else if (JSON.stringify(edges[i]) !== JSON.stringify(edge))
      throw new Error(`Conflicting annotations for ${edge.uci} at ${from}`);
  }
  return graph;
}
function canonicalArrows(arrows: IdeaArrow[]): IdeaArrow[] {
  const seen = new Map(arrows.map((a) => [`${a.color}${a.from}${a.to}`, a]));
  return [...seen.keys()].sort().map((key) => seen.get(key)!);
}
function isBare(edge: Edge) {
  return (
    !edge.comment &&
    !edge.ruleIds.length &&
    !edge.arrows.length &&
    edge.weight === 1
  );
}
export function compilePgn(pgn: string, side: Side): Graph {
  return compileSide([pgn], side);
}
