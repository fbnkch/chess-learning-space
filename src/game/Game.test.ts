import { describe, expect, it } from "vitest";
import { Game, positionKey } from "./Game";
describe("positionKey", () => {
  it("drops counters and an en-passant square with no legal capture", () => {
    expect(
      positionKey(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      ),
    ).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -");
  });
});

it("keeps legal en passant but removes a capture that exposes the king", () => {
  expect(positionKey("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 20")).toBe(
    "4k3/8/8/3pP3/8/8/8/4K3 w - d6",
  );
  expect(positionKey("k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 20")).toBe(
    "k3r3/8/8/3pP3/8/8/8/4K3 w - -",
  );
});
it("provides legal destinations and stores a played move as UCI", () => {
  const game = new Game();
  expect(game.destinations().get("e2")).toEqual(["e3", "e4"]);
  expect(game.destinations().has("e7")).toBe(false);
  expect(game.play("e2e4").san).toBe("e4");
  expect(game.moves).toEqual(["e2e4"]);
  expect(game.fen).toContain(" b KQkq ");
});

it("converts SAN and UCI without changing the position", () => {
  const game = new Game();
  expect(game.toUci("Nf3")).toBe("g1f3");
  expect(game.toSan("g1f3")).toBe("Nf3");
  expect(game.moves).toEqual([]);
  expect(() => game.play("e2e5")).toThrow();
  expect(game.moves).toEqual([]);
});
it("requires a promotion choice and allows underpromotion", () => {
  const game = new Game("7k/P7/8/8/8/8/8/7K w - - 0 1");
  expect(game.promotions("a7", "a8")).toEqual(["n", "b", "r", "q"]);
  expect(game.destinations().get("a7")).toEqual(["a8"]);
  expect(() => game.play("a7a8")).toThrow();
  expect(game.toSan("a7a8n")).toBe("a8=N");
  game.play("a7a8n");
  expect(game.moves).toEqual(["a7a8n"]);
  expect(game.fen).toMatch(/^N6k/);
});

it("navigates history and replaces only the future when exploring a new move", () => {
  const game = new Game();
  game.play("e2e4");
  game.play("e7e5");
  game.play("g1f3");
  game.goTo(1);
  expect(game.ply).toBe(1);
  expect(game.turn).toBe("black");
  expect(game.moves).toEqual(["e2e4", "e7e5", "g1f3"]);
  expect(() => game.play("e7e4")).toThrow();
  expect(game.moves).toHaveLength(3);
  game.play("c7c5");
  expect(game.moves).toEqual(["e2e4", "c7c5"]);
  expect(game.notation.map((move) => move.san)).toEqual(["e4", "c5"]);
  expect(() => game.goTo(9)).toThrow();
});
it("parses PGN to UCI, including a setup position and promotion", () => {
  const game = Game.fromPgn("1. e4 e5 2. Nf3 Nc6 *");
  expect(game.moves).toEqual(["e2e4", "e7e5", "g1f3", "b8c6"]);
  expect(game.ply).toBe(4);
  const promotion = Game.fromPgn(
    '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *',
  );
  expect(promotion.moves).toEqual(["a7a8q"]);
  promotion.goTo(0);
  expect(promotion.fen).toBe("7k/P7/8/8/8/8/8/7K w - - 0 1");
  expect(() => Game.fromPgn("1. e4 Ke7")).toThrow();
});

it("rejects a promotion suffix on an ordinary move without changing the game", () => {
  const game = new Game();
  const before = game.fen;
  expect(() => game.play("e2e4q")).toThrow();
  expect(game.fen).toBe(before);
  expect(game.moves).toEqual([]);
});

it("normalises transpositions while preserving side and castling rights", () => {
  const first = Game.fromPgn("1. d4 d5 2. c4 e6 *");
  const second = Game.fromPgn("1. c4 e6 2. d4 d5 *");
  expect(positionKey(first.fen)).toBe(positionKey(second.fen));
  expect(positionKey("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1")).not.toBe(
    positionKey("4k3/8/8/8/8/8/8/R3K2R w - - 0 1"),
  );
  expect(positionKey("4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 20")).toBe(
    "4k3/8/8/8/3Pp3/8/8/4K3 b - d3",
  );
});
it("plays castling and en passant through the same UCI interface", () => {
  const castle = new Game("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  expect(castle.destinations().get("e1")).toContain("g1");
  expect(castle.toUci("O-O")).toBe("e1g1");
  castle.play("e1g1");
  expect(castle.fen).toContain("R4RK1 b kq");
  const ep = new Game("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  expect(ep.toSan("e5d6")).toBe("exd6");
  ep.play("e5d6");
  expect(ep.fen).toMatch(/^4k3\/8\/3P4\/8/);
  expect(ep.lastMove).toEqual(["e5", "d6"]);
});

it("accepts PGN with a UTF-8 BOM", () => {
  expect(Game.fromPgn("\uFEFF1. e4 *").moves).toEqual(["e2e4"]);
});
it.each([
  ["0-0", "e1g1"],
  ["0-0-0", "e1c1"],
])("normalises castling %s in PGN", (san, uci) => {
  expect(
    Game.fromPgn(
      '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1"]\n\n1. ' +
        san +
        " *",
    ).moves,
  ).toEqual([uci]);
});
it("accepts a FEN header without SetUp", () => {
  expect(
    Game.fromPgn('[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *').moves,
  ).toEqual(["a7a8q"]);
});
it("rejects an illegal en passant square", () => {
  expect(() => positionKey("4k3/8/8/3pP3/8/8/8/4K3 w - d3 0 1")).toThrow();
});
it.each([
  ["7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", "Checkmate"],
  ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "Stalemate"],
  ["7k/8/8/8/8/8/8/K7 w - - 0 1", "Draw"],
])("reports terminal status for %s", (fen, status) => {
  expect(new Game(fen).status).toBe(status);
});
