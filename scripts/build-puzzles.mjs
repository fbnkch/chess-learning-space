import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Decompress } from "fzstd";
import { motifs } from "../src/puzzles/types.ts";

const source = JSON.parse(
  await readFile(
    new URL("../content/puzzles/SOURCE.json", import.meta.url),
    "utf8",
  ),
);
const out = new URL("../public/puzzles/", import.meta.url);
const { buildOpeningPuzzles } = await import("./build-opening-puzzles.mjs");
if (process.argv.includes("--openings-only")) {
  await buildOpeningPuzzles(source, out);
  process.exit(0);
}
const cache = new URL("../.cache/puzzles/", import.meta.url);
await mkdir(cache, { recursive: true });
const archive = new URL("lichess_db_puzzle.csv.zst", cache);
try {
  await access(archive);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const response = await fetch(source.url);
  if (!response.ok || !response.body)
    throw Error(`Download failed: ${response.status}`, { cause: error });
  const temp = new URL("download.part", cache);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
  await rename(temp, archive);
}
const hash = createHash("sha256");
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest("hex") !== source.sha256)
  throw Error(
    "Puzzle snapshot checksum mismatch: Lichess has published a newer export. The committed chunks in public/puzzles stay valid; to refresh them, deliberately repin (update url date, sha256 and snapshotDate in content/puzzles/SOURCE.json) and review the diff. Never silently repin.",
  );
const buckets = Object.fromEntries(motifs.map((m) => [m, []]));
const present = new Set();
const ids = new Set();
let pending = "";
const decoder = new TextDecoder();
// RFC4180 quoted fields (the source has no embedded newlines).
function csv(line) {
  return [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) =>
    m[1].startsWith('"') ? m[1].slice(1, -1).replaceAll('""', '"') : m[1],
  );
}
const z = new Decompress((data) => {
  pending += decoder.decode(data, { stream: true });
  const lines = pending.split("\n");
  pending = lines.pop();
  for (const line of lines) {
    const c = csv(line.trim());
    if (c[0] === "PuzzleId" || !c[0]) continue;
    const tags = c[7].split(" ");
    for (const tag of tags) present.add(tag);
    if (
      +c[3] < 600 ||
      +c[3] > 1700 ||
      +c[4] > 100 ||
      +c[5] < 80 ||
      +c[6] < 100 ||
      ids.has(c[0])
    )
      continue;
    const choices = motifs
      .filter((m) => tags.includes(m) && buckets[m].length < 2273)
      .sort((a, b) => buckets[a].length - buckets[b].length);
    if (!choices.length) continue;
    buckets[choices[0]].push([
      c[0],
      c[1],
      c[2],
      +c[3],
      +c[4],
      +c[5],
      +c[6],
      c[7],
      c[8],
      c[9] ?? "",
    ]);
    ids.add(c[0]);
  }
});
for await (const chunk of createReadStream(archive)) z.push(chunk);
z.push(new Uint8Array(), true);
if (pending.trim()) throw Error("Snapshot must end with a complete CSV record");
const droppedMotifs = source.requestedMotifs.filter((m) => !present.has(m));
const active = motifs.filter((m) => present.has(m));
for (const m of active)
  if (buckets[m].length < 300)
    throw Error(`Insufficient ${m}: ${buckets[m].length}`);
await mkdir(out, { recursive: true });
const manifest = {
  snapshotDate: source.snapshotDate,
  sha256: source.sha256,
  droppedMotifs,
  total: ids.size,
  counts: {},
  chunks: [],
};
for (const motif of active) {
  const rows = buckets[motif];
  const file = `${motif}.json`;
  await writeFile(new URL(file, out), JSON.stringify(rows) + "\n");
  manifest.counts[motif] = rows.length;
  manifest.chunks.push({ motif, file, count: rows.length });
}
await writeFile(
  new URL("manifest.json", out),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify(manifest, null, 2));

await buildOpeningPuzzles(source, out);
