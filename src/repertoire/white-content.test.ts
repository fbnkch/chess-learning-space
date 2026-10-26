import { readFileSync, readdirSync } from "node:fs";
import { Chess } from "chess.js";
import { expect, it } from "vitest";
import { Game, positionKey } from "../game/Game";
import { compileSide } from "./compiler";
import { Repertoire } from "./Repertoire";
import { goldenRules } from "../rules/catalogue";

const sources = readdirSync("content/white")
  .filter((f) => f.endsWith(".pgn"))
  .sort()
  .map((f) => readFileSync(`content/white/${f}`, "utf8"));
const graph = compileSide(sources, "white");
const rep = new Repertoire({ white: graph });
const expectedIds = [
  "italian-pianissimo-main",
  "italian-central-break",
  "italian-two-knights",
  "italian-be7",
  "italian-d6",
  "italian-scholar-defence",
  "philidor-main",
  "petrov-main",
  "petrov-trick",
  "alapin-d5",
  "alapin-nf6",
  "french-exchange",
  "caro-exchange",
  "scandinavian-qa5",
  "scandinavian-qd6",
  "pirc-classical",
  "modern-classical",
  "alekhine-main",
  "nimzowitsch-e5",
  "nimzowitsch-d5",
  "london-d5",
  "london-nf6",
  "london-early-c5",
  "london-qb6",
  "london-qb6-exchange",
  "london-kid",
  "london-gruenfeld",
  "london-dutch",
];
it("covers the White families with explicit stable IDs, plans and at most eight of our moves", () => {
  expect(graph.lines.map((l) => l.id).sort()).toEqual([...expectedIds].sort());
  for (const line of graph.lines) {
    expect(line.moves.length).toBeLessThanOrEqual(16);
    expect(line.summary).toMatch(/Structure:|Pattern:/);
    expect(line.summary).toMatch(/Plan:/);
    expect(["italian", "london", "sidelines"]).toContain(line.group);
  }
  // An independent PGN reader catches lost plies and comment-tokenisation mistakes.
  for (const source of sources)
    for (const block of source
      .split(/(?=^\[Event )/m)
      .filter((s) => s.trim())) {
      const chess = new Chess();
      chess.loadPgn(block, { strict: true });
      const id = /\[LineId "([^"]+)"\]/.exec(block)![1];
      expect(block).toContain(`[%line ${id}]`);
      expect(graph.lines.find((l) => l.id === id)!.moves).toEqual(
        chess
          .history({ verbose: true })
          .map((m) => m.from + m.to + (m.promotion ?? "")),
      );
    }
});
it("has legal consistent shared edges, explained White moves, valid rule IDs and estimated reply weights", () => {
  const ruleIds = goldenRules.map((rule) => rule.id);
  for (const node of Object.values(graph.nodes)) {
    expect(new Set(node.edges.map((e) => e.uci)).size).toBe(node.edges.length);
    for (const edge of node.edges) {
      const game = new Game(node.fen);
      game.play(edge.uci);
      expect(positionKey(game.fen)).toBe(edge.to);
      for (const id of edge.ruleIds) expect(ruleIds).toContain(id);
      if (edge.kind === "ours") {
        expect(edge.comment.length).toBeGreaterThan(20);
        expect(edge.ruleIds.length).toBeGreaterThan(0);
      } else {
        expect(edge.weight).toBeGreaterThan(0);
        expect(edge.comment).not.toMatch(/estimate|explorer data/i);
      }
    }
  }
  expect(() => compileSide([...sources].reverse(), "white")).not.toThrow();
});
it("scopes shared cards, hints, replies and preludes to the selected opening without changing identities", () => {
  const italian = rep.selectLines("white", ["italian-pianissimo-main"]);
  const london = rep.selectLines("white", ["london-d5"]);
  const root = positionKey(new Game().fen);
  expect(italian.ourMoves("white", root).map((e) => e.uci)).toEqual(["e2e4"]);
  expect(london.ourMoves("white", root).map((e) => e.uci)).toEqual(["d2d4"]);
  expect(italian.cards("white")[0].id).toBe(london.cards("white")[0].id);
  expect(italian.cards("white")).toHaveLength(8);
  expect(london.cards("white")).toHaveLength(8);
  for (const card of london.cards("white")) {
    expect(card.lineId).toBe("london-d5");
    const game = new Game();
    london.prelude(card).forEach((move) => game.play(move));
    expect(positionKey(game.fen)).toBe(card.positionKey);
  }
  const shuffled = new Repertoire({
    white: compileSide([...sources].reverse(), "white"),
  });
  expect(
    shuffled
      .cards("white")
      .map((c) => c.id)
      .sort(),
  ).toEqual(
    rep
      .cards("white")
      .map((c) => c.id)
      .sort(),
  );
});
it("checks the tactical teaching patterns on the board rather than trusting engine scores", () => {
  const legal = new Chess();
  for (const san of "e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#".split(
    " ",
  ))
    legal.move(san);
  expect(legal.isCheckmate()).toBe(true);
  const petrov = new Chess();
  for (const san of "e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6 Nc6+ Be7 Nxd8".split(" "))
    petrov.move(san);
  expect(petrov.get("d8")?.type).toBe("n");
  expect(
    petrov
      .board()
      .flat()
      .some((p) => p?.color === "b" && p.type === "q"),
  ).toBe(false);
  const scholar = new Chess();
  for (const san of "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Qf6".split(" "))
    scholar.move(san);
  expect(scholar.attackers("f2", "b")).toEqual(["c5"]); // Nf3 blocks Qf6.
  scholar.move("O-O");
  expect(scholar.attackers("f2", "w")).toContain("f1");
  const london = new Chess();
  for (const san of "d4 d5 Bf4 c5 e3 Qb6 Nc3".split(" ")) london.move(san);
  expect(london.attackers("b2", "w")).not.toContain("c3");
  expect(london.moves()).toContain("Qxb2");
  london.undo();
  london.move("Qc1");
  expect(london.attackers("b2", "w")).toContain("c1");
  const twoKnights = graph.lines.find((l) => l.id === "italian-two-knights")!;
  expect(twoKnights.moves[6]).toBe("d2d3");
});

it("validates every authored rules tag against the live Golden Rules catalogue", () => {
  const ids = new Set(goldenRules.map((rule) => rule.id));
  for (const source of sources) {
    for (const tag of source.matchAll(/\[%rules\s+([^\]]+)\]/g)) {
      for (const id of tag[1].split(/[\s,]+/).filter(Boolean))
        expect(ids.has(id), id).toBe(true);
    }
    expect(source).not.toMatch(/reply weight is an estimate/i);
  }
});
it("uses quiet Italian setups and position-specific reply frequencies", () => {
  for (const id of ["italian-be7", "italian-d6"]) {
    const line = graph.lines.find((line) => line.id === id)!;
    expect(line.moves.slice(6, 12).filter((_, i) => i % 2 === 0).sort()).toEqual(
      ["d2d3", "c2c3", "e1g1"].sort(),
    );
  }
  function replies(moves: string[]) {
    const game = new Game();
    moves.forEach((move) => game.play(move));
    return Object.fromEntries(
      rep.replies("white", positionKey(game.fen)).map((edge) => [edge.uci, edge.weight]),
    );
  }
  expect(replies(["e2e4", "e7e5", "g1f3"])).toEqual({
    b8c6: 60, g8f6: 10, d7d6: 8,
  });
  expect(replies(["d2d4"])).toEqual({ d7d5: 33, g8f6: 39, f7f5: 3 });
});
it("describes semi-open files only where the opponent still has a pawn", () => {
  for (const id of ["scandinavian-qa5", "scandinavian-qd6", "nimzowitsch-d5"]) {
    const line = graph.lines.find((line) => line.id === id)!;
    const game = new Game();
    line.moves.forEach((move) => game.play(move));
    const board = new Chess(game.fen);
    expect(board.get("e6")).toEqual({ type: "p", color: "b" });
    expect(
      board.board().flat().some((piece) =>
        piece?.type === "p" && piece.color === "w" && piece.square.startsWith("e"),
      ),
    ).toBe(false);
    const before = new Game();
    line.moves.slice(0, -1).forEach((move) => before.play(move));
    expect(
      rep.ourMoves("white", positionKey(before.fen))
        .find((edge) => edge.uci === "f1e1")?.comment,
    ).toContain("semi-open e-file");
  }
  const line = graph.lines.find((line) => line.id === "london-qb6-exchange")!;
  const game = new Chess();
  line.moves.slice(0, 11).forEach((move) =>
    game.move({ from: move.slice(0, 2), to: move.slice(2, 4) }),
  );
  expect(game.get("a7")).toEqual({ type: "p", color: "b" });
  expect(game.get("a2")).toBeUndefined();
  expect(line.summary).toContain("semi-open a-file");
});
