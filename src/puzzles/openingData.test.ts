import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { puzzleOpenings, puzzleOpeningGroups } from "./openings";
import type { PuzzleManifest, PuzzleRow } from "./types";
import source from "../../content/puzzles/SOURCE.json";

it("derives every opening puzzle unchanged from checksummed buckets and documented tags", () => {
  const manifest: PuzzleManifest = JSON.parse(
    readFileSync("public/puzzles/manifest.json", "utf8"),
  );
  const data: {
    snapshotSha256: string;
    counts: Record<string, number>;
    observedTags: string[];
    rows: PuzzleRow[];
  } = JSON.parse(readFileSync("public/puzzles/opening-puzzles.json", "utf8"));
  const outputBytes = readFileSync("public/puzzles/opening-puzzles.json");
  expect(createHash("sha256").update(outputBytes).digest("hex")).toBe(
    source.openingSelection.output.sha256,
  );
  expect(outputBytes.length).toBe(source.openingSelection.output.sizeBytes);
  expect(data.rows.length).toBe(source.openingSelection.output.count);
  expect(data.counts).toEqual(source.openingSelection.output.counts);
  expect(data.snapshotSha256).toBe(source.sha256);
  const checksums: Record<string, string> =
    source.openingSelection.inputChecksums;
  const families: Record<string, string[]> = source.openingSelection.families;
  const allowed: Record<string, string[]> =
    source.openingSelection.allowedVariations;
  for (const group of puzzleOpeningGroups) {
    expect(group.tags).toEqual(families[group.id]);
    expect(group.variations).toEqual(allowed[group.id]);
  }
  const expected: PuzzleRow[] = [];
  for (const chunk of manifest.chunks) {
    const bytes = readFileSync(`public/puzzles/${chunk.file}`);
    expect(
      createHash("sha256")
        .update(bytes.toString("utf8").replaceAll("\r\n", "\n"))
        .digest("hex"),
    ).toBe(checksums[chunk.file]);
    const rows: PuzzleRow[] = JSON.parse(bytes.toString());
    // Independently use the recorded selection, not the production matcher.
    expected.push(
      ...rows.filter((row) =>
        Object.entries(families).some(([id, prefixes]) => {
          const tokens = row[9]
            .split(" ")
            .filter((tag) =>
              prefixes.some(
                (prefix) => tag === prefix || tag.startsWith(prefix + "_"),
              ),
            )
            .filter(
              (tag) => !prefixes.includes(tag) || allowed[id].includes(tag),
            );
          return (
            tokens.length > 0 &&
            tokens.every((tag) => allowed[id].includes(tag))
          );
        }),
      ),
    );
  }
  expected.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  expect(data.rows).toEqual(expected);
  expect(data.rows).toHaveLength(1120);
  expect(new Set(data.rows.map((r) => r[0])).size).toBe(1120);
  expect(data.counts).toEqual({
    italian: 362,
    london: 237,
    caro: 383,
    qgd: 138,
  });
  const counts: Record<string, number> = {};
  for (const row of data.rows) {
    const openings = puzzleOpenings(row[9]);
    expect(openings.length).toBeGreaterThan(0);
    for (const opening of openings)
      counts[opening] = (counts[opening] ?? 0) + 1;
  }
  expect(counts).toEqual(data.counts);
  expect(data.observedTags).toEqual(
    [
      ...new Set(data.rows.flatMap((r) => r[9].split(" ").filter(Boolean))),
    ].sort(),
  );
});

it("excludes known off-repertoire puzzles while retaining covered opponent replies", () => {
  const data = JSON.parse(
    readFileSync("public/puzzles/opening-puzzles.json", "utf8"),
  ) as { rows: PuzzleRow[] };
  const manifest = JSON.parse(
    readFileSync("public/puzzles/manifest.json", "utf8"),
  ) as PuzzleManifest;
  const original: PuzzleRow[] = manifest.chunks.flatMap((chunk) =>
    JSON.parse(readFileSync(`public/puzzles/${chunk.file}`, "utf8")),
  );
  const ids = new Set(data.rows.map((row) => row[0]));
  for (const [id, tag] of [
    ["07Qdz", "Queens_Gambit_Declined_Albin_Countergambit"],
    ["05ejA", "Queens_Gambit_Declined_Chigorin_Defense"],
    ["0CPh5", "Italian_Game_Evans_Gambit"],
  ]) {
    expect(original.find((row) => row[0] === id)?.[9]).toContain(tag);
    expect(ids.has(id), id).toBe(false);
  }
  expect(
    data.rows.some((row) =>
      /Queens_Gambit_Accepted|Slav_Defense|Evans_Gambit|Albin_Countergambit|Chigorin_Defense/.test(
        row[9],
      ),
    ),
  ).toBe(false);
  for (const [id, opening] of [
    ["04zUx", "italian"],
    ["03BHm", "italian"],
    ["02y2Z", "london"],
    ["04hML", "caro"],
    ["01Vfj", "caro"],
    ["00s16", "caro"],
    ["0BSoM", "caro"],
    ["036j9", "caro"],
    ["0Du21", "qgd"],
    ["0NlEl", "qgd"],
  ]) {
    const row = data.rows.find((row) => row[0] === id);
    expect(row, id).toBeDefined();
    expect(puzzleOpenings(row![9])).toEqual([opening]);
  }
});
