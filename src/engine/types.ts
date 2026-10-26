export type Position = { startFen: string; moves: readonly string[] };
export type Budget = (
  | { depth: number; movetime?: never }
  | { movetime: number; depth?: never }
) & { multipv: number; priority?: "hint" | "background"; timeoutMs?: number };
export type Line = { uci: string[]; depth: number } & (
  | { cp: number; mate?: never }
  // White-view mate distance; zero means the root side to move is mated.
  // winner is +1 for White, -1 for Black, including when mate is zero.
  | { mate: number; winner: 1 | -1; cp?: never }
);
export type Analysis = { lines: Line[]; complete: boolean };
export interface Engine {
  analyse(
    position: Position,
    budget: Budget,
    signal?: AbortSignal,
  ): Promise<Analysis>;
}
export interface UciWorker {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage(command: string): void;
  terminate(): void;
}
