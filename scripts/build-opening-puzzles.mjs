import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  puzzleOpenings,
  puzzleOpeningGroups,
} from "../src/puzzles/openings.ts";

/** Derived only from the pinned, committed training buckets; never needs the raw CSV. */
export async function buildOpeningPuzzles(source, out) {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", out), "utf8"),
  );
  if (manifest.sha256 !== source.sha256)
    throw Error("Puzzle manifest snapshot mismatch");
  const rows = [],
    observedTags = new Set();
  const counts = Object.fromEntries(puzzleOpeningGroups.map((g) => [g.id, 0]));
  for (const chunk of manifest.chunks) {
    const bytes = await readFile(new URL(chunk.file, out));
    // Git may check text chunks out with CRLF on Windows. Pin canonical LF.
    const hash = createHash("sha256")
      .update(bytes.toString("utf8").replaceAll("\r\n", "\n"))
      .digest("hex");
    if (source.openingSelection.inputChecksums[chunk.file] !== hash)
      throw Error(
        `Opening selection input checksum mismatch: ${chunk.file}; deliberately review a repin`,
      );
    for (const row of JSON.parse(bytes)) {
      const groups = puzzleOpenings(row[9]);
      if (!groups.length) continue;
      rows.push(row);
      for (const id of groups) counts[id]++;
      for (const tag of row[9].split(" ")) if (tag) observedTags.add(tag);
    }
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [id, count] of Object.entries(counts))
    if (!count) throw Error(`No opening puzzles for ${id}`);
  const data = {
    snapshotSha256: source.sha256,
    counts,
    observedTags: [...observedTags].sort(),
    rows,
  };
  await writeFile(
    new URL("opening-puzzles.json", out),
    JSON.stringify(data) + "\n",
  );
  console.log(`Opening puzzles: ${rows.length}; ${JSON.stringify(counts)}`);
}
