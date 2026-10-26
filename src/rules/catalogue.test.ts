import { Chess, validateFen, type Square } from "chess.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compilePgn } from "../repertoire/compiler";
import type { Side } from "../repertoire/types";
import { goldenRules, phases, topRules } from "./catalogue";

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("Golden Rules catalogue", () => {
  it("has unique, stable kebab-case IDs", () => {
    const ids = goldenRules.map((rule) => rule.id);
    expect(ids).toHaveLength(new Set(ids).size);
    for (const id of ids) expect(id).toMatch(kebab);
  });

  it("groups every rule by a known phase and has about forty rules", () => {
    expect(goldenRules.length).toBeGreaterThanOrEqual(40);
    const known = new Set(phases.map((phase) => phase.id));
    for (const rule of goldenRules) expect(known.has(rule.phase)).toBe(true);
    for (const phase of phases)
      expect(goldenRules.some((rule) => rule.phase === phase.id)).toBe(true);
  });

  it("has exactly the Top 10 priorities 1 to 10 in order", () => {
    expect(topRules).toHaveLength(10);
    expect(topRules.map((rule) => rule.priority)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    for (const rule of goldenRules)
      if (rule.priority !== null)
        expect(Number.isInteger(rule.priority)).toBe(true);
  });

  it("requires rule text and permits empty exceptions", () => {
    for (const rule of goldenRules) {
      expect(rule.shortForm.trim(), rule.id).not.toBe("");
      expect(rule.reason.trim(), rule.id).not.toBe("");
      expect(rule.exception, rule.id).toBeTypeOf("string");
    }
  });

  it("links only to real, documented sources or names the rule as unsourced", () => {
    const research = readFileSync(
      resolve(
        "docs/research",
        readdirSync("docs/research").find((file) => file.startsWith("04"))!,
      ),
      "utf8",
    );
    const sources = new Set(research.match(/https:\/\/[^\s|`]+/g));
    for (const rule of goldenRules) {
      if (rule.sourceUrl === null) expect(rule.creators, rule.id).toBeDefined();
      else expect(sources.has(rule.sourceUrl), rule.id).toBe(true);
    }
  });

  it("shows a legal example position with valid arrows", () => {
    for (const rule of goldenRules) {
      const check = validateFen(rule.exampleFen);
      expect(check.ok, `${rule.id}: ${check.error}`).toBe(true);
      const chess = new Chess(rule.exampleFen);
      expect(chess.moves().length, rule.id).toBeGreaterThan(0);
      // The side that just moved may not be left in check.
      const [board, turn, castling] = rule.exampleFen.split(" ");
      const flipped = new Chess(
        `${board} ${turn === "w" ? "b" : "w"} ${castling} - 0 1`,
      );
      expect(flipped.isCheck(), rule.id).toBe(false);
      for (const arrow of rule.arrows ?? []) {
        expect(arrow.from, rule.id).toMatch(/^[a-h][1-8]$/);
        expect(arrow.to, rule.id).toMatch(/^[a-h][1-8]$/);
        expect(arrow.from, rule.id).not.toBe(arrow.to);
        expect(["move", "plan", "ray"], rule.id).toContain(arrow.kind);
        if (arrow.kind === "move") {
          expect(chess.get(arrow.from as Square)?.color, rule.id).toBe(
            chess.turn(),
          );
          expect(
            chess
              .moves({ verbose: true })
              .some((move) => move.from === arrow.from && move.to === arrow.to),
            `${rule.id}: ${arrow.from}-${arrow.to}`,
          ).toBe(true);
        } else expect(arrow.label?.trim(), rule.id).toBeTruthy();
      }
    }
  });
  it("illustrates opposite-coloured bishops with pawns still present", () => {
    const chess = new Chess(
      goldenRules.find(
        (rule) => rule.id === "opposite-bishops-draw",
      )!.exampleFen,
    );
    const bishops = chess
      .board()
      .flat()
      .filter((piece) => piece?.type === "b");
    expect(bishops).toHaveLength(2);
    expect(
      new Set(bishops.map((piece) => chess.squareColor(piece!.square))).size,
    ).toBe(2);
    expect(
      chess
        .board()
        .flat()
        .some((piece) => piece?.type === "p"),
    ).toBe(true);
  });
});

describe("repertoire rule references", () => {
  const ids = new Set(goldenRules.map((rule) => rule.id));
  const content = resolve("content");
  for (const side of ["white", "black"] as Side[]) {
    const directory = resolve(content, side);
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory).filter((name) =>
      name.endsWith(".pgn"),
    )) {
      it(`only references catalogue rules in ${side}/${file}`, () => {
        const graph = compilePgn(
          readFileSync(resolve(directory, file), "utf8"),
          side,
        );
        const referenced = [
          ...new Set(
            Object.values(graph.nodes).flatMap((node) =>
              node.edges.flatMap((edge) => edge.ruleIds),
            ),
          ),
        ];
        expect(referenced.length).toBeGreaterThan(0);
        for (const id of referenced) expect(ids.has(id), id).toBe(true);
      });
    }
  }
});
