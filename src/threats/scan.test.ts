import { expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  generateScan,
  gradeScan,
  newThreats,
  eligiblePosition,
  seededShuffle,
  repertoirePositions,
  markKey,
  type Mark,
} from "./scan";
import { repertoire } from "../repertoire/bundled";
import { goldenRules } from "../rules/catalogue";
import { Repertoire } from "../repertoire/Repertoire";

it("keeps a capture arrow and its hanging square separate, with exact recall", () => {
  const scan = generateScan("4k3/8/8/8/8/8/r7/R3K3 w Q - 0 1");
  expect(scan.marks).toContainEqual(
    expect.objectContaining({ from: "a1", to: "a2", kind: "arrow" }),
  );
  expect(scan.marks).toContainEqual(
    expect.objectContaining({ square: "a2", kind: "square" }),
  );
  expect(gradeScan(scan.marks, scan.marks).pass).toBe(true);
  expect(gradeScan(scan.marks, []).recall).toBe(0);
  expect(gradeScan(scan.marks, scan.marks.slice(1)).missed).toEqual([
    scan.marks[0],
  ]);
});

it.each(["w", "b"])("does not count a pinned knight as a legal attacker with %s to move", (turn) => {
  const pinned = generateScan(`4r1k1/8/8/8/3q4/8/4N3/4K3 ${turn} - - 0 1`);
  expect(pinned.marks.map(markKey)).not.toContain("d4");
  expect(pinned.marks.map(markKey)).not.toContain("e2d4");
});

it("includes legal en passant and excludes an en-passant capture exposing the king", () => {
  expect(
    generateScan("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2").marks.map(markKey),
  ).toEqual(["d5", "e5d6"]);
  expect(
    generateScan("4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 2").marks.map(markKey),
  ).not.toContain("e5d6");
  // The flipped side never inherits the other side's en-passant right.
  expect(
    generateScan("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2").marks.map(markKey),
  ).not.toContain("d5e4");
});

it("collapses checking promotion choices and discovers a rook check behind a bishop", () => {
  const promotion = generateScan("7k/P7/8/8/8/8/8/4K3 w - - 0 1");
  expect(promotion.marks.filter((m) => markKey(m) === "a7a8")).toHaveLength(1);
  expect(promotion.marks.find((m) => markKey(m) === "a7a8")?.reasons).toContain(
    "check",
  );
  expect(generateScan("4k3/8/8/8/8/8/4B3/K3R3 w - - 0 1").marks).toContainEqual(
    expect.objectContaining({ from: "e2", to: "f3", reasons: ["check"] }),
  );
});

it("uses legal king recaptures, excludes kings as hanging, and skips illegal flipped positions", () => {
  const scan = generateScan("4k3/4p3/8/8/1B6/8/8/K7 w - - 0 1");
  expect(scan.marks.map(markKey)).not.toContain("e7"); // King defends pawn; bishop is more valuable.
  expect(scan.marks.map(markKey)).not.toContain("e8");
  const checked = generateScan("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1");
  expect(checked.skippedSide).toBe(true);
  expect(checked.marks.map(markKey)).toContain("e1e2");
  expect(checked.marks.map(markKey)).not.toContain("e2e1");
});

it("counts unique marks, permits one wrong mark, and reports misses and exact recall", () => {
  const a: Mark = { kind: "arrow", from: "e5", to: "d6" };
  const b: Mark = { kind: "square", square: "d5" };
  const x: Mark = { kind: "square", square: "a1" };
  const y: Mark = { kind: "square", square: "b1" };
  expect(gradeScan([a, b], [a, a, b, x])).toMatchObject({
    pass: true,
    found: 2,
    wrong: 1,
  });
  expect(gradeScan([a, b], [a, b, x, y]).pass).toBe(false);
  expect(gradeScan([a, b], [a])).toMatchObject({
    pass: false,
    recall: 0.5,
    missed: [b],
  });
});

it("marks a defended queen attacked by a pawn as hanging and finds no threats at the initial position", () => {
  expect(
    generateScan("4k3/8/8/2p5/3Q4/4P3/8/4K3 w - - 0 1").marks.map(markKey),
  ).toContain("d4");
  expect(
    generateScan("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
      .marks,
  ).toEqual([]);
});

it("automatically includes Black repertoire lines and their opponent moves", () => {
  const black = new Repertoire({
    black: {
      side: "black",
      contentVersion: "test",
      nodes: {},
      lines: [
        {
          id: "black",
          name: "Black fixture",
          group: "test",
          summary: "test",
          weight: 1,
          startFen: "4k3/8/8/3p4/8/8/4P3/4K3 w - - 0 1",
          moves: ["e2e4"],
        },
      ],
    },
  });
  for (const mode of ["scan", "changed"] as const) {
    const positions = repertoirePositions(black, mode);
    expect(positions).toHaveLength(1);
    expect(positions[0].title).toBe("Black fixture");
    expect(positions[0].required.map(markKey)).toContain("e4d5");
    if (mode === "changed")
      expect(positions[0].required.map(markKey)).not.toContain("d5e4");
  }
});

it("excludes comparisons with a checked side at either endpoint", () => {
  const before = "4k3/8/8/8/8/8/r7/4K3 b - - 0 1";
  const after = "4k3/8/8/8/8/8/4r3/4K3 w - - 1 2";
  expect(newThreats(before, after)).toEqual([]);
  expect(newThreats(after, before)).toEqual([]);
});

it("uses one to twelve required marks with stable seeded ordering and valid rule IDs", () => {
  expect(eligiblePosition([])).toBe(false);
  expect(
    eligiblePosition(Array(12).fill({ kind: "square", square: "a1" })),
  ).toBe(true);
  expect(
    eligiblePosition(Array(13).fill({ kind: "square", square: "a1" })),
  ).toBe(false);
  expect(seededShuffle([1, 2, 3, 4, 5], 9)).toEqual(
    seededShuffle([1, 2, 3, 4, 5], 9),
  );
  expect(seededShuffle([1, 2, 3, 4, 5], 9)).not.toEqual(
    seededShuffle([1, 2, 3, 4, 5], 10),
  );
  for (const mode of ["scan", "changed"] as const) {
    const positions = repertoirePositions(repertoire, mode);
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every((p) => eligiblePosition(p.required))).toBe(true);
    expect(
      positions.every((p) =>
        p.required.every((m) => goldenRules.some((r) => r.id === m.ruleId)),
      ),
    ).toBe(true);
    expect(
      new Set(
        positions.map((p) =>
          mode === "scan" ? p.key : `${p.before}>${p.key}`,
        ),
      ).size,
    ).toBe(positions.length);
  }
}, 20000);


it("ignores pinned defenders and discovers x-ray attacks after a capture", () => {
  expect(generateScan("2r1r2k/8/8/8/8/2R5/4N3/4K3 w - - 0 1").marks.map(markKey))
    .toContain("c3");
  // Kxe7 would expose the king to the rook behind the capturing bishop.
  expect(generateScan("4k3/4p3/8/8/1B6/8/8/K3R3 w - - 0 1").marks.map(markKey))
    .toContain("e7");
  // After ...Rxd4 the rook behind the victim can recapture along the opened file.
  expect(generateScan("3r3k/8/8/8/3R4/8/8/K2R4 b - - 0 1").marks.map(markKey))
    .not.toContain("d4");
});

it("handles capture promotions as one arrow with the victim's hanging square", () => {
  const marks = generateScan("1r5k/P7/8/8/8/8/8/4K3 w - - 0 1").marks;
  expect(marks.filter((m) => markKey(m) === "a7b8")).toHaveLength(1);
  expect(marks.map(markKey)).toContain("b8");
});

it.each(["London: g6 with d5", "Nimzowitsch: transpose to Italian"])(
  "%s never asks for the learner's newly available captures",
  (title) => {
    const line = repertoire.lineMeta("white").find((line) => line.name === title)!;
    expect(line).toBeDefined();
    const chess = new Chess(line.startFen);
    let compared = 0;
    for (const uci of line.moves) {
      const before = chess.fen();
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (move.color !== "b") continue;
      const marks = newThreats(before, chess.fen());
      for (const mark of marks) {
        expect(chess.get(mark.kind === "arrow" ? mark.from : mark.square)?.color)
          .toBe(mark.kind === "arrow" ? "b" : "w");
      }
      if (title.startsWith("London") && move.san === "Bg7") {
        // ...Bg7 leaves White's captures available, but creates no new Black threat.
        expect(marks).toEqual([]);
        compared++;
      }
      if (title.startsWith("Nimzowitsch") && move.san === "e5") {
        expect(marks.map(markKey)).not.toContain("f3e5");
        expect(marks.map(markKey)).not.toContain("e5");
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(0);
  },
);

it("counts all repertoire tasks with zero responding-side items and excludes check evasions", () => {
  const normal = repertoirePositions(repertoire, "scan");
  const changed = repertoirePositions(repertoire, "changed");
  let respondingSideItems = 0;
  for (const position of normal) expect(new Chess(position.fen).isCheck()).toBe(false);
  for (const position of changed) {
    const chess = new Chess(position.fen);
    expect(chess.isCheck()).toBe(false);
    expect(new Chess(position.before!).isCheck()).toBe(false);
    for (const mark of position.required) {
      const color = chess.get(mark.kind === "arrow" ? mark.from : mark.square)?.color;
      if (mark.kind === "arrow" ? color === chess.turn() : color !== chess.turn())
        respondingSideItems++;
    }
  }
  expect(respondingSideItems).toBe(0);
  console.info(`Repertoire scans: normal=${normal.length}, what-changed=${changed.length}, responding-side-items=${respondingSideItems}`);
}, 20000);


it("excludes repertoire check evasions and comparisons starting in check", () => {
  for (const fixture of [
    { side: "white" as const, startFen: "4k3/8/8/8/8/8/r7/4K3 b - - 0 1", moves: ["a2e2"] },
    { side: "black" as const, startFen: "4k3/8/8/8/8/8/4r3/4K3 w - - 0 1", moves: ["e1d1"] },
  ]) {
    const source = new Repertoire({
      [fixture.side]: {
        side: fixture.side, contentVersion: "test", nodes: {},
        lines: [{ id: "check", name: "Check fixture", group: "test", summary: "test", weight: 1,
          startFen: fixture.startFen, moves: fixture.moves }],
      },
    });
    expect(repertoirePositions(source, "changed")).toEqual([]);
    if (fixture.side === "white") expect(repertoirePositions(source, "scan")).toEqual([]);
  }
});
