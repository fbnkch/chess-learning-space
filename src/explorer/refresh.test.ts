import { expect, it } from "vitest";
import { Game, positionKey } from "../game/Game";
import { compileSide } from "../repertoire/compiler";
import { Repertoire } from "../repertoire/Repertoire";
import { explorerPositions, refreshWeights } from "./refresh";
import { effectiveReplyWeight, explorerQuery, weightId } from "./weights";

it("walks only authored reply positions and shares transpositions by position key", () => {
  const rep = new Repertoire({
    white: compileSide(["{[%line a]} 1. e4 e5 2. Nf3 *"], "white"),
  });
  const positions = explorerPositions(rep);
  expect(positions).toHaveLength(1);
  expect(positions[0].key).toBe(positionKey(new Game().play("e2e4").after));
});
it("uses a refreshed UCI weight, preserving the bundled fallback for absent replies", () => {
  const game = new Game();
  game.play("e2e4");
  const key = positionKey(game.fen);
  const records = [
    {
      id: weightId(key, explorerQuery),
      positionKey: key,
      query: explorerQuery,
      fetchedAt: 100,
      weights: { e7e5: 12 },
    },
  ];
  expect(effectiveReplyWeight(records, key, "e7e5", 40)).toBe(12);
  expect(effectiveReplyWeight(records, key, "c7c5", 30)).toBe(30);
});
it("does not commit a partial refresh when a later position fails", async () => {
  const rep = new Repertoire({
    white: compileSide(["{[%line a]} 1. e4 e5 2. Nf3 Nc6 *"], "white"),
  });
  let calls = 0;
  const saved: unknown[] = [];
  await expect(
    refreshWeights(
      rep,
      "fake-token",
      {
        saveReplyWeights: async (rows) => {
          saved.push(rows);
        },
      },
      new AbortController().signal,
      {
        request: async () => {
          if (++calls === 2) throw new Error("offline");
          return { e7e5: 20 };
        },
        delay: async () => {},
      },
    ),
  ).rejects.toThrow();
  expect(saved).toEqual([]);
});
import { cohort } from "../trainer/progress";
import { weightedReply } from "../trainer/OpeningSession";
it("updates cohort ordering and pre-existing selected views through the same reply boundary", () => {
  const rep = new Repertoire({
    white: compileSide(
      [
        '[LineId "main"]\n[Main "true"]\n1. e4 e5 {[%weight 40]} 2. Nf3 *',
        '[LineId "sicilian"]\n1. e4 c5 {[%weight 30]} 2. Nf3 *',
        '[LineId "french"]\n1. e4 e6 {[%weight 20]} 2. d4 *',
        '[LineId "caro"]\n1. e4 c6 {[%weight 10]} 2. d4 *',
      ],
      "white",
    ),
  });
  const selected = rep.selectLines("white", ["sicilian", "caro"]);
  const game = new Game();
  game.play("e2e4");
  const key = positionKey(game.fen);
  expect(
    cohort(rep, "white", [], 3, () => 1000).locked.map((e) => e.line.id),
  ).toEqual(["caro"]);
  rep.setReplyWeights([
    {
      id: weightId(key, explorerQuery),
      positionKey: key,
      query: explorerQuery,
      fetchedAt: 100,
      weights: { c7c6: 90, c7c5: 0 },
    },
  ]);
  expect(
    cohort(rep, "white", [], 3, () => 1000).active.map((e) => e.line.id),
  ).toEqual(["main", "caro", "french"]);
  expect(weightedReply(selected.replies("white", key), () => 0.1)?.uci).toBe(
    "c7c6",
  );
  expect(rep.replies("white", key).find((e) => e.uci === "e7e5")?.weight).toBe(
    40,
  );
});
it("deduplicates transposed authored paths for Black and never requests our-to-move endpoints", () => {
  const rep = new Repertoire({
    black: compileSide(
      [
        '[LineId "d4"]\n1. d4 d5 2. c4 e6 3. Nf3 Nf6 *',
        '[LineId "c4"]\n1. c4 e6 2. d4 d5 3. Nf3 Nf6 *',
      ],
      "black",
    ),
  });
  const positions = explorerPositions(rep);
  expect(positions).toHaveLength(4);
  const keys = positions.map((p) => p.key);
  expect(new Set(keys).size).toBe(keys.length);
  expect(positions.every((p) => new Game(p.fen).turn === "white")).toBe(true);
});
it("maps only authored UCI replies and waits between sequential requests before one batch commit", async () => {
  const rep = new Repertoire({
    white: compileSide(["{[%line a]} 1. e4 e5 2. Nf3 Nc6 *"], "white"),
  });
  const events: string[] = [];
  let saved: import("./weights").ReplyWeights[] = [];
  await refreshWeights(
    rep,
    "fake",
    {
      saveReplyWeights: async (rows) => {
        events.push("commit");
        saved = rows;
      },
    },
    new AbortController().signal,
    {
      request: async () => {
        events.push("request");
        return { e7e5: 10, c7c5: 70, b8c6: 20 };
      },
      delay: async (ms) => {
        expect(ms).toBe(1000);
        events.push("delay");
      },
      clock: () => 100,
    },
  );
  expect(events).toEqual(["request", "delay", "request", "commit"]);
  expect(saved.map((r) => r.weights)).toEqual([{ e7e5: 10 }, { b8c6: 20 }]);
});
