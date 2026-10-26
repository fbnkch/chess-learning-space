import { effectiveReplyWeight, type ReplyWeights } from "../explorer/weights";
import { Game, positionKey } from "../game/Game";
import type { RepertoireCard, Graph, Side } from "./types";

export class Repertoire {
  constructor(
    private readonly graphs: Partial<Record<Side, Graph>>,
    private readonly weights: { rows: ReplyWeights[] } = { rows: [] },
  ) {}
  setReplyWeights(rows: ReplyWeights[]) {
    this.weights.rows = rows;
  }
  /** Keep shared card identities, but use only the chosen lines for replies and preludes. */
  selectLines(side: Side, lineIds: readonly string[]): Repertoire {
    const graph = this.graphs[side];
    if (!graph) return new Repertoire({}, this.weights);
    const lines = graph.lines.filter((line) => lineIds.includes(line.id));
    const allowed = new Map<string, Set<string>>();
    for (const line of lines) {
      const game = new Game(line.startFen);
      for (const uci of line.moves) {
        const key = positionKey(game.fen);
        const moves = allowed.get(key) ?? new Set<string>();
        moves.add(uci);
        allowed.set(key, moves);
        game.play(uci);
      }
    }
    return new Repertoire(
      {
        [side]: {
          ...graph,
          lines,
          nodes: Object.fromEntries(
            Object.entries(graph.nodes)
              .filter(([, node]) =>
                node.lines.some((m) => lineIds.includes(m.lineId)),
              )
              .map(([key, node]) => [
                key,
                {
                  ...node,
                  edges: node.edges.filter((edge) =>
                    allowed.get(key)?.has(edge.uci),
                  ),
                  lines: node.lines.filter((m) => lineIds.includes(m.lineId)),
                },
              ]),
          ),
        },
      },
      this.weights,
    );
  }
  ourMoves(side: Side, key: string) {
    return this.edges(side, key).filter((e) => e.kind === "ours");
  }
  replies(side: Side, key: string) {
    return this.edges(side, key).filter((e) => e.kind === "reply");
  }
  edges(side: Side, key: string) {
    return (this.graphs[side]?.nodes[key]?.edges ?? []).map((edge) =>
      edge.kind === "reply"
        ? {
            ...edge,
            weight: effectiveReplyWeight(
              this.weights.rows,
              key,
              edge.uci,
              edge.weight,
            ),
          }
        : edge,
    );
  }
  lineMeta(side: Side) {
    return this.graphs[side]?.lines ?? [];
  }
  isBook(side: Side, key: string) {
    return Boolean(this.graphs[side]?.nodes[key]);
  }
  fen(side: Side, key: string) {
    const node = this.graphs[side]?.nodes[key];
    if (!node) throw new Error("Unknown repertoire position");
    return node.fen;
  }
  cards(side: Side): RepertoireCard[] {
    return Object.keys(this.graphs[side]?.nodes ?? {})
      .filter((key) => this.ourMoves(side, key).length)
      .map((key) => ({
        id: `rep:${side}:${key}`,
        kind: "repertoire",
        side,
        positionKey: key,
        lineId: this.reachingLines(side, key)[0].id,
      }));
  }
  private reachingLines(side: Side, key: string) {
    const memberships = this.graphs[side]?.nodes[key]?.lines ?? [];
    return this.lineMeta(side)
      .filter((line) => memberships.some((m) => m.lineId === line.id))
      .sort((a, b) => b.weight - a.weight);
  }
  private cardLine(card: RepertoireCard) {
    const lines = this.reachingLines(card.side, card.positionKey);
    const line = lines.find((l) => l.id === card.lineId) ?? lines[0];
    if (!line) throw new Error("Card is no longer in the repertoire");
    return line;
  }
  prelude(card: RepertoireCard): string[] {
    const line = this.cardLine(card);
    const plies = this.graphs[card.side]!.nodes[card.positionKey].lines.filter(
      (m) => m.lineId === line.id,
    ).map((m) => m.ply);
    return line.moves.slice(0, Math.min(...plies));
  }
  startFen(card: RepertoireCard) {
    return this.cardLine(card).startFen;
  }
  deviation(moves: readonly string[], side: Side) {
    const game = new Game();
    for (let ply = 0; ply < moves.length; ply++) {
      const key = positionKey(game.fen),
        ours = game.turn === side;
      game.play(moves[ply]);
      if (!this.edges(side, key).some((e) => e.to === positionKey(game.fen)))
        return {
          ply,
          kind:
            this.edges(side, key).length === 0
              ? "line-end"
              : ours
                ? "our-deviation"
                : "unknown-reply",
        };
    }
    return null;
  }
}
