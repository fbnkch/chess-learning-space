export const motifs = [
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "deflection",
  "hangingPiece",
  "defensiveMove",
  "quietMove",
  "mateIn1",
  "mateIn2",
  "mateIn3",
  "backRankMate",
  "smotheredMate",
  "attraction",
  "clearance",
  "interference",
  "intermezzo",
  "trappedPiece",
  "xRayAttack",
  "doubleCheck",
  "capturingDefender",
  "exposedKing",
] as const;
export type Motif = (typeof motifs)[number];
/** Compact on-disk row; original Lichess fields, including all tags. */
export type PuzzleRow = [
  id: string,
  fen: string,
  moves: string,
  rating: number,
  rd: number,
  popularity: number,
  plays: number,
  themes: string,
  gameUrl: string,
  openingTags: string,
];
export interface PuzzleManifest {
  snapshotDate: string;
  sha256: string;
  total: number;
  droppedMotifs: string[];
  chunks: { file: string; count: number; motif: Motif }[];
  counts: Record<Motif, number>;
}
