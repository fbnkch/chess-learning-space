import type { PuzzleManifest, PuzzleRow, Motif } from "./types";
export function motifLabel(motif: string): string {
  if (motif === "deflection") return "Deflection (incl. overloading ideas)";
  return motif
    .replace(/([A-Z])/g, " $1")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
export async function loadManifest(
  signal?: AbortSignal,
): Promise<PuzzleManifest> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}puzzles/manifest.json`,
    { signal },
  );
  if (!response.ok)
    throw Error(
      "Could not load puzzle catalogue. Check your connection and retry.",
    );
  return response.json();
}
/** A motif fetches just its own training bucket. No puzzle data enters the JS bundle. */
export async function loadPuzzles(
  manifest: PuzzleManifest,
  motif: Motif,
  signal?: AbortSignal,
): Promise<PuzzleRow[]> {
  const chunk = manifest.chunks.find((c) => c.motif === motif);
  if (!chunk) throw Error("This motif is unavailable.");
  const response = await fetch(
    `${import.meta.env.BASE_URL}puzzles/${chunk.file}`,
    { signal },
  );
  if (!response.ok)
    throw Error("Could not load puzzles. Check your connection and retry.");
  return response.json();
}

/** The small derived opening set is independent of the original motif buckets. */
export async function loadOpeningPuzzles(
  signal?: AbortSignal,
): Promise<PuzzleRow[]> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}puzzles/opening-puzzles.json`,
    { signal },
  );
  if (!response.ok)
    throw Error(
      "Could not load opening puzzles. Check your connection and retry.",
    );
  const data: { rows: PuzzleRow[] } = await response.json();
  return data.rows;
}
