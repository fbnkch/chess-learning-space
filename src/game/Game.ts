import { Chess, type Move, type Square } from "chess.js";

export type { Square } from "chess.js";

/** ADR-0001: counters do not identify a position; only legal en passant does. */
export function positionKey(fen: string): string {
  return new Chess(fen).fen().split(" ").slice(0, 4).join(" ");
}

export class Game {
  private chess: Chess;
  private history: string[] = [];
  private cursor = 0;
  readonly startFen: string;
  constructor(fen?: string) {
    this.chess = new Chess(fen);
    this.startFen = this.chess.fen();
  }
  static fromPgn(pgn: string): Game {
    pgn = pgn
      .replace(/^\uFEFF/, "")
      .replace(/\b0-0(?:-0)?\b/g, (castle) => castle.replaceAll("0", "O"));
    if (/\[FEN\s+"/.test(pgn) && !/\[SetUp\s+"/.test(pgn))
      pgn = '[SetUp "1"]\n' + pgn;
    const parsed = new Chess();
    parsed.loadPgn(pgn, { strict: true });
    const moves = parsed.history({ verbose: true });
    const game = new Game(moves[0]?.before ?? parsed.fen());
    for (const move of moves)
      game.play(move.from + move.to + (move.promotion ?? ""));
    return game;
  }
  get ply(): number {
    return this.cursor;
  }
  get turn(): "white" | "black" {
    return this.chess.turn() === "w" ? "white" : "black";
  }
  get check(): boolean {
    return this.chess.isCheck();
  }
  get status(): string {
    if (this.chess.isCheckmate()) return "Checkmate";
    if (this.chess.isStalemate()) return "Stalemate";
    if (this.chess.isDraw()) return "Draw";
    return this.check
      ? "Check"
      : `${this.turn === "white" ? "White" : "Black"} to move`;
  }
  get lastMove(): [Square, Square] | undefined {
    const move = this.history[this.cursor - 1];
    return move
      ? [move.slice(0, 2) as Square, move.slice(2, 4) as Square]
      : undefined;
  }
  get notation(): Move[] {
    const replay = new Game(this.startFen);
    return this.history.map((move) => replay.play(move));
  }
  goTo(ply: number): void {
    if (!Number.isInteger(ply) || ply < 0 || ply > this.history.length)
      throw new Error("Invalid history position");
    const replay = new Game(this.startFen);
    for (const move of this.history.slice(0, ply)) replay.play(move);
    this.chess = replay.chess;
    this.cursor = ply;
  }
  get fen(): string {
    return this.chess.fen();
  }
  get moves(): readonly string[] {
    return [...this.history];
  }
  destinations(): Map<Square, Square[]> {
    const result = new Map<Square, Square[]>();
    for (const move of this.chess.moves({ verbose: true })) {
      const targets = result.get(move.from) ?? [];
      if (!targets.includes(move.to)) targets.push(move.to);
      result.set(move.from, targets);
    }
    return result;
  }
  toUci(san: string): string {
    const move = new Chess(this.fen).move(san);
    return move.from + move.to + (move.promotion ?? "");
  }
  toSan(uci: string): string {
    return new Game(this.fen).play(uci).san;
  }
  promotions(from: Square, to: Square): string[] {
    return this.chess
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to && move.promotion)
      .map((move) => move.promotion!);
  }
  play(uci: string): Move {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))
      throw new Error("Invalid UCI move");
    // chess.js ignores promotion suffixes on ordinary moves; reject those intents.
    if (
      uci[4] &&
      !this.promotions(
        uci.slice(0, 2) as Square,
        uci.slice(2, 4) as Square,
      ).includes(uci[4])
    ) {
      throw new Error("Invalid promotion");
    }
    const move = this.chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    });
    this.history = this.history.slice(0, this.cursor);
    this.history.push(move.from + move.to + (move.promotion ?? ""));
    this.cursor++;
    return move;
  }
}
