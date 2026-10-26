import { Game } from "../game/Game";
import type { Engine, Line } from "../engine/types";
import { goldenRules } from "../rules/catalogue";
import { explain } from "./explain";

/** On-demand use case. Authored solutions bypass search; engine work shares its queue. */
export class Hint {
  step = 0;
  private controller = new AbortController();
  private steps?: [string, string];
  private pending?: Promise<void>;
  move?: string;
  constructor(
    readonly fen: string,
    private source: { solution: string[]; idea?: string } | { engine: Engine },
  ) {}
  reset() {
    this.controller.abort();
    this.controller = new AbortController();
    this.steps = undefined;
    this.pending = undefined;
    this.move = undefined;
    this.step = 0;
  }
  private async load(signal: AbortSignal) {
    let line: Line;
    let idea: string | undefined;
    if ("solution" in this.source) {
      line = { uci: this.source.solution, depth: 0, cp: 0 };
      idea = this.source.idea;
    } else {
      const result = await this.source.engine.analyse(
        { startFen: this.fen, moves: [] },
        { movetime: 300, multipv: 1, priority: "hint" },
        signal,
      );
      signal.throwIfAborted();
      line = result.lines[0];
      if (!line?.uci.length)
        throw new Error("No hint available. Try again.");
      const findings = explain(this.fen, line.uci[0], {
        best: line,
        played: { uci: [], cp: 0, depth: 0 },
      });
      const motif = findings.find((f) =>
        ["missed-mate", "missed-fork", "missed-pin", "missed-skewer"].includes(
          f.motif,
        ),
      );
      if (motif) {
        const rule = goldenRules.find((rule) => rule.id === motif.ruleId);
        idea = `Look for a ${motif.motif.slice(7)}.${rule ? ` Golden rule: ${rule.shortForm}` : ""}`;
      }
    }
    signal.throwIfAborted();
    const move = line.uci[0];
    const san = new Game(this.fen).toSan(move);
    this.move = move;
    this.steps = [
      idea?.trim() || `Look at the piece on ${move.slice(0, 2)}.`,
      `Play ${san} (${move.slice(0, 2)} \u2192 ${move.slice(2, 4)}).`,
    ];
  }
  async next() {
    const signal = this.controller.signal;
    this.pending ??= this.load(signal).catch((error) => {
      if (!signal.aborted) this.pending = undefined;
      throw error;
    });
    // Concurrent clicks reveal a single step, never skip directly to the move.
    const previous = this.step;
    await this.pending;
    signal.throwIfAborted();
    this.step = Math.min(2, previous + 1);
    return this.steps![this.step - 1];
  }
}
