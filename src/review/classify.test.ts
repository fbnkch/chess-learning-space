import { describe, expect, it } from "vitest";
import { classify, expectedPoints, provesSacrifice } from "./classify";

describe("ADR-0004 classification", () => {
  it("clamps engine noise to Best and keeps an already won game out of Blunder", () => {
    expect(classify({ epBest: 0.5, epPlayed: 0.51 })).toBe("Best");
    expect(
      classify({
        epBest: expectedPoints({ cp: 900 }, "white"),
        epPlayed: expectedPoints({ cp: 850 }, "white"),
      }),
    ).toBe("Excellent");
  });
  const fixtures = [
    ["Book", { epBest: 0.8, epPlayed: 0.1, book: true, sacrifice: true }],
    [
      "Brilliant",
      { epBest: 0.7, epPlayed: 0.7, sacrifice: true, epSecond: 0.1 },
    ],
    ["Great", { epBest: 0.7, epPlayed: 0.69, epSecond: 0.5 }],
    ["Miss", { epBest: 0.7, epPlayed: 0.5, previous: "Mistake" }],
    ["Best", { epBest: 0.5, epPlayed: 0.5 }],
    ["Excellent", { epBest: 0.5, epPlayed: 0.49 }],
    ["Good", { epBest: 0.5, epPlayed: 0.46 }],
    ["Inaccuracy", { epBest: 0.5, epPlayed: 0.42 }],
    ["Mistake", { epBest: 0.5, epPlayed: 0.35 }],
    ["Blunder", { epBest: 0.5, epPlayed: 0.2 }],
  ] as const;
  it.each(fixtures)("classifies %s", (label, input) =>
    expect(classify(input)).toBe(label),
  );
  it("uses inclusive upper band boundaries", () => {
    for (const [loss, label] of [
      [0.02, "Excellent"],
      [0.05, "Good"],
      [0.1, "Inaccuracy"],
      [0.2, "Mistake"],
    ] as const)
      expect(classify({ epBest: loss, epPlayed: 0 })).toBe(label);
    expect(classify({ epBest: 0.5, epPlayed: 0.48 })).toBe("Excellent");
    expect(classify({ epBest: 0.7, epPlayed: 0.7, epSecond: 0.6 })).toBe(
      "Great",
    );
  });
  it("converts Black cp and mate scores including mate zero to mover perspective", () => {
    expect(expectedPoints({ cp: -200 }, "black")).toBeCloseTo(
      0.676211637485,
      10,
    );
    expect(expectedPoints({ cp: -2000 }, "black")).toBe(
      expectedPoints({ cp: -1000 }, "black"),
    );
    expect(expectedPoints({ mate: 0, winner: -1 }, "black")).toBe(1);
    expect(expectedPoints({ mate: -3, winner: -1 }, "white")).toBe(0);
    expect(
      classify({
        epBest: 1,
        epPlayed: 0.98,
        mateForBefore: true,
        mateForAfter: false,
      }),
    ).toBe("Miss");
    expect(classify({ epBest: 0, epPlayed: 0, mateForAfter: false })).toBe(
      "Best",
    );
  });
  it("does not promote unproven sacrifices, missing second lines or ordinary missed opportunities", () => {
    expect(classify({ epBest: 0.95, epPlayed: 0.95, sacrifice: true })).toBe(
      "Best",
    );
    expect(classify({ epBest: 0.7, epPlayed: 0.7 })).toBe("Best");
    expect(classify({ epBest: 0.8, epPlayed: 0.5, previous: "Good" })).toBe(
      "Blunder",
    );
    expect(classify({ epBest: 0.5, epPlayed: 0.2, playedBest: true })).toBe(
      "Best",
    );
  });
  it("requires four legal plies and a material deficit still present at PV end", () => {
    // White offers a bishop; Black's pawn takes it. Quiet continuations prove the net loss.
    const fen = "4k3/8/8/3p4/8/8/6B1/4K3 w - - 0 1";
    const pv = ["g2d5", "e8d7", "d5e4", "d7d6"];
    expect(provesSacrifice(fen, pv, "white")).toBe(false);
    const sacrifice = ["g2e4", "d5e4", "e1d2", "e8d7"];
    expect(provesSacrifice(fen, sacrifice, "white")).toBe(true);
    expect(provesSacrifice(fen, sacrifice.slice(0, 3), "white")).toBe(false);
    expect(provesSacrifice(fen, [...sacrifice, "a1a8"], "white")).toBe(false);
    // Equal rook exchange: the initial drop recovers, so no Brilliant.
    expect(
      provesSacrifice(
        "4k3/8/8/3r4/8/8/3R4/3RK3 w - - 0 1",
        ["d2d4", "d5d4", "d1d4", "e8e7"],
        "white",
      ),
    ).toBe(false);
  });
});
