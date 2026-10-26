import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { Chess } from "chess.js";
import { Game, positionKey } from "../game/Game";
import { compileSide } from "./compiler";
import { Repertoire } from "./Repertoire";
import { goldenRules } from "../rules/catalogue";

const sources = () =>
  readdirSync("content/black")
    .filter((f) => f.endsWith(".pgn"))
    .sort()
    .map((f) => readFileSync(`content/black/${f}`, "utf8"));
it("covers both Black opening groups with legal, explained moves and catalogue rules", () => {
  const graph = compileSide(sources(), "black");
  expect(new Set(graph.lines.map((l) => l.group))).toEqual(
    new Set(["caro", "qgd"]),
  );
  expect(graph.lines.map((l) => l.id)).toEqual(
    expect.arrayContaining([
      "caro-classical",
      "caro-nd2",
      "caro-advance",
      "caro-exchange",
      "caro-panov",
      "caro-fantasy",
      "caro-two-knights",
      "caro-nf3",
      "caro-c4",
      "caro-kia",
      "qgd-nc3",
      "qgd-nf3",
      "qgd-exchange",
      "qgd-bf4",
      "qgd-bf5",
      "qgd-london",
      "qgd-colle",
      "qgd-english",
      "qgd-reti",
      "qgd-english-fianchetto",
      "qgd-reti-fianchetto",
    ]),
  );
  for (const line of graph.lines) {
    expect(line.summary.length).toBeGreaterThan(80);
    expect(line.moves.filter((_, i) => i % 2 === 1).length).toBeLessThanOrEqual(
      8,
    );
  }
  for (const node of Object.values(graph.nodes))
    for (const edge of node.edges) {
      const game = new Game(node.fen);
      game.play(edge.uci);
      expect(positionKey(game.fen)).toBe(edge.to);
      if (edge.kind === "ours") {
        expect(edge.comment.length).toBeGreaterThan(20);
        expect(edge.ruleIds.length).toBeGreaterThan(0);
      }
      for (const id of edge.ruleIds)
        expect(goldenRules.some((r) => r.id === id)).toBe(true);
      expect(edge.comment).not.toMatch(/weight|estimate/i);
    }
  for (const source of sources())
    for (const pgn of source.split(/(?=\[Event )/).filter((x) => x.trim())) {
      const chess = new Chess();
      chess.loadPgn(pgn);
      expect(
        graph.lines.find((l) => l.id === chess.getHeaders().LineId)?.moves,
      ).toEqual(
        chess
          .history({ verbose: true })
          .map((m) => m.from + m.to + (m.promotion ?? "")),
      );
    }
});
it("merges d4, English and Reti move orders into one QGD node and one Black card", () => {
  const graph = compileSide(sources(), "black");
  const rep = new Repertoire({ black: graph });
  const paths = [
    "1. d4 d5 2. c4 e6 3. Nf3 *",
    "1. c4 e6 2. d4 d5 3. Nf3 *",
    "1. Nf3 d5 2. d4 e6 3. c4 *",
  ];
  const keys = paths.map((p) => positionKey(Game.fromPgn(p).fen));
  expect(new Set(keys).size).toBe(1);
  expect(graph.nodes[keys[0]].lines.length).toBeGreaterThanOrEqual(3);
  expect(
    rep.cards("black").filter((c) => c.positionKey === keys[0]),
  ).toHaveLength(1);
  const white = compileSide(
    ['[LineId "white-london"]\n1. d4 d5 2. Bf4 e6 *'],
    "white",
  );
  const both = new Repertoire({ black: graph, white });
  const key = positionKey(Game.fromPgn("1. d4 d5 *").fen);
  expect(both.ourMoves("black", key)).toHaveLength(0);
  expect(both.replies("black", key).some((e) => e.uci === "c1f4")).toBe(true);
  expect(both.ourMoves("white", key).map((e) => e.uci)).toEqual(["c1f4"]);
  expect(both.replies("white", key)).toHaveLength(0);
});
it("verifies the bishop-safety and central capture patterns on the actual board", () => {
  const classical = new Chess();
  classical.loadPgn(
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7",
  );
  expect(classical.get("h7")).toMatchObject({ type: "b", color: "b" });
  const trapped = new Chess();
  trapped.loadPgn(
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 e6 7. h5 Bf5 8. Nxf5",
  );
  expect(trapped.get("f5")).toMatchObject({ type: "n", color: "w" });
  const elephant = new Chess();
  elephant.loadPgn(
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7 5. cxd5 exd5 6. Nxd5 Nxd5 7. Bxd8 Bb4+ 8. Qd2 Bxd2+ 9. Kxd2 Kxd8",
  );
  expect(
    elephant
      .board()
      .flat()
      .filter((p) => p?.type === "q"),
  ).toHaveLength(0);
  expect(
    elephant
      .board()
      .flat()
      .filter((p) => p?.type === "n" && p.color === "b"),
  ).toHaveLength(2);
  expect(
    elephant
      .board()
      .flat()
      .filter((p) => p?.type === "n" && p.color === "w"),
  ).toHaveLength(1);
  const falseTrap = new Chess();
  falseTrap.loadPgn(
    "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Bd6 5. e3 O-O 6. Bd3 c6 7. Nf3 Nbd7 8. O-O h6 9. cxd5 exd5 10. Nxd5 Nxd5 11. Bxd8",
  );
  expect(falseTrap.get("d8")).toMatchObject({ type: "b", color: "w" });
  expect(falseTrap.moves()).not.toContain("Bb4+");
  const central = new Chess();
  central.loadPgn("1. e4 c6 2. Nc3 d5 3. Nf3 dxe4 4. Nxe4 Nf6 5. Nxf6+ exf6");
  expect(central.get("f6")).toMatchObject({ type: "p", color: "b" });
});

it("demonstrates why the e-file pin matters before a routine knight development", () => {
  const chess = new Chess();
  chess.loadPgn(
    "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Qe2 Ngf6 6. Nd6#",
  );
  expect(chess.isCheckmate()).toBe(true);
  expect(chess.get("e7")).toMatchObject({ type: "p", color: "b" });
});
