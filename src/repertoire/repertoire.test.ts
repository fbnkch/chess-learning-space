import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { Game, positionKey } from "../game/Game";
import { compilePgn, compileSide } from "./compiler";
import { Repertoire } from "./Repertoire";

it("compiles the authored Italian into eight explained White cards and legal edges", () => {
  const graph = compilePgn(
    readFileSync("content/white/italian.pgn", "utf8"),
    "white",
  );
  const rep = new Repertoire({ white: graph }).selectLines("white", [
    "italian-pianissimo-main",
  ]);
  expect(rep.cards("white")).toHaveLength(8);
  expect(
    graph.lines.find((l) => l.id === "italian-pianissimo-main")!.moves,
  ).toHaveLength(15);
  for (const node of Object.values(graph.nodes)) {
    for (const edge of node.edges) {
      const game = new Game(node.fen);
      game.play(edge.uci);
      expect(positionKey(game.fen)).toBe(edge.to);
      if (edge.kind === "ours") expect(edge.comment.length).toBeGreaterThan(15);
    }
  }
  expect(rep.ourMoves("black", positionKey(new Game().fen))).toEqual([]);
  const last = rep.cards("white")[7];
  expect(rep.prelude(last)).toHaveLength(14);
  expect(rep.prelude({ ...last, lineId: "removed-line" })).toEqual(
    rep.prelude(last),
  );
  expect(last.id).toBe(`rep:white:${last.positionKey}`);
});

it("reports deviations through resulting positions and recognises the normal line end", () => {
  const rep = new Repertoire({
    white: compilePgn("{[%line main]} 1. e4 e5 2. Nf3 *", "white"),
  });
  expect(rep.deviation(["e2e4", "e7e5", "g1f3"], "white")).toBeNull();
  expect(rep.deviation(["d2d4"], "white")).toEqual({
    ply: 0,
    kind: "our-deviation",
  });
  expect(rep.deviation(["e2e4", "c7c5"], "white")).toEqual({
    ply: 1,
    kind: "unknown-reply",
  });
  expect(rep.deviation(["e2e4", "e7e5", "g1f3", "b8c6"], "white")).toEqual({
    ply: 3,
    kind: "line-end",
  });
});

it("merges transpositions from PGN variations and keeps side-scoped replies", () => {
  const graph = compilePgn(
    "{[%line main]} 1. d4 d5 2. c4 e6 ({[%line alternative]} 2... Nf6 3. Nf3 e6) 3. Nf3 Nf6 *",
    "white",
  );
  const rep = new Repertoire({ white: graph });
  const key = positionKey(Game.fromPgn("1. d4 d5 2. c4 e6 3. Nf3 Nf6 *").fen);
  expect(Object.keys(graph.nodes).filter((k) => k === key)).toHaveLength(1);
  expect(graph.lines).toHaveLength(2);
  expect(
    rep.replies("white", positionKey(Game.fromPgn("1. d4 d5 2. c4 *").fen)),
  ).toHaveLength(2);
  expect(() => compilePgn("{[%line main]} 1. e4 Ke7 *", "white")).toThrow();
});

it("requires stable explicit identities for every main line and variation", () => {
  expect(() => compilePgn("1. e4 *", "white")).toThrow(
    /Missing explicit line ID/,
  );
  expect(() =>
    compilePgn("{[%line main]} 1. e4 e5 (1... c5) *", "white"),
  ).toThrow(/Missing explicit line ID/);
  expect(() =>
    compileSide(
      ['[LineId "same"]\n1. e4 *', '[LineId "same"]\n1. d4 *'],
      "white",
    ),
  ).toThrow(/Duplicate/);
});
it("compiles multiple games/files into one hashed graph with precomputed memberships", () => {
  const source =
    '[Event "King pawn"]\n[LineId "e4"]\n1. e4 *\n\n[Event "Queen pawn"]\n[LineId "d4"]\n1. d4 *';
  const graph = compileSide([source, '[LineId "c4"]\n1. c4 *'], "white");
  expect(graph.lines.map((l) => l.id).sort()).toEqual(["c4", "d4", "e4"]);
  const root = graph.nodes[positionKey(new Game().fen)];
  expect(root.edges).toHaveLength(3);
  expect(root.lines.map((l) => l.lineId).sort()).toEqual(["c4", "d4", "e4"]);
  expect(root.lines.every((l) => l.ply === 0)).toBe(true);
  expect(compileSide([source], "white").contentVersion).toBe(
    compileSide([source], "white").contentVersion,
  );
  expect(graph.contentVersion).not.toBe(
    compileSide([source], "white").contentVersion,
  );
});
it("merges repeated comments and supports black move tokens, inline NAGs, escape lines and arrows", () => {
  const graph = compilePgn(
    "{[%line main]}\n% ignored escape line\n1. e4$1 {Take space. [%rules centre]} {Open the bishop. [%rules development] [%cal Gf1c4,Rc4f7]} 1. ... e5 {[%weight 3]} *",
    "white",
  );
  const first = graph.nodes[positionKey(new Game().fen)].edges[0];
  expect(first.comment).toBe("Take space. Open the bishop.");
  expect(first.ruleIds).toEqual(["centre", "development"]);
  expect(first.arrows).toEqual([
    { color: "G", from: "f1", to: "c4" },
    { color: "R", from: "c4", to: "f7" },
  ]);
  expect(graph.nodes[first.to].edges[0].weight).toBe(3);
  expect(() =>
    compilePgn("{[%line main]} 1. e4 1... e5 *", "white"),
  ).not.toThrow();
});
it.each(["{Different idea.}", "{[%rules centre]}", "{[%weight 2]}"])(
  "rejects conflicting shared-edge annotation %s",
  (annotation) => {
    expect(() =>
      compileSide(
        [
          "{[%line first]} 1. e4 {Centre. [%rules space] [%weight 3]} *",
          `{[%line second]} 1. e4 ${annotation} *`,
        ],
        "white",
      ),
    ).toThrow(/Conflicting annotations/);
  },
);

it("retains comments on the main move before and after a variation", () => {
  const graph = compilePgn(
    "{[%line main]} 1. e4 {Take space.} ({[%line alternative]} 1. d4) {Open the bishop.} e5 *",
    "white",
  );
  expect(
    graph.nodes[positionKey(new Game().fen)].edges.find(
      (edge) => edge.uci === "e2e4",
    )?.comment,
  ).toBe("Take space. Open the bishop.");
});

it("treats arrow order, duplicate arrows and unannotated repeats of a shared edge as one annotation", () => {
  const a = '[LineId "a"]\n1. e4 {Centre. [%cal Ge2e4,Gd2d4]} e5 *';
  const b =
    '[LineId "b"]\n1. e4 {Centre. [%cal Gd2d4,Ge2e4,Gd2d4]} e5 2. Nf3 *';
  const bare = '[LineId "c"]\n1. e4 e5 2. Nc3 *';
  const graph = compileSide([bare, a, b], "white");
  const [e4] = Object.values(graph.nodes).flatMap((n) =>
    n.edges.filter((e) => e.uci === "e2e4"),
  );
  expect(e4.comment).toBe("Centre.");
  expect(e4.arrows.map((x) => x.from + x.to)).toEqual(["d2d4", "e2e4"]);
  expect(() =>
    compileSide([a, '[LineId "d"]\n1. e4 {Different idea.} *'], "white"),
  ).toThrow(/Conflicting annotations/);
});

it("preserves semicolons inside brace comments when compiling multiple authored games", () => {
  const graph = compilePgn(
    '[LineId "one"]\n1. e4 {Take space; free the bishop.} e5 2. Nf3 *\n\n[LineId "two"]\n1. d4 d5 *',
    "white",
  );
  expect(graph.lines.find((l) => l.id === "one")!.moves).toEqual([
    "e2e4",
    "e7e5",
    "g1f3",
  ]);
  expect(
    new Repertoire({ white: graph })
      .ourMoves("white", positionKey(new Game().fen))
      .find((e) => e.uci === "e2e4")!.comment,
  ).toBe("Take space; free the bishop.");
});
