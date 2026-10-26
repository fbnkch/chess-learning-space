import { ulid } from "ulid";
import { z } from "zod";
import { Game, positionKey } from "../game/Game";
import type { Card, Side } from "../repertoire/types";
import type { SchedulerPort } from "../scheduler/Scheduler";

export interface PersonalCard extends Card {
  kind: "mistake";
  cardId: string;
  side: Side;
  positionKey: string;
  fen: string;
  solution: string[];
  createdAt: number;
  tags: string[];
}
export function createMistakeCard(
  fen: string,
  solution: string[],
  createdAt: number,
  tags: string[],
): PersonalCard {
  const game = new Game(fen),
    side = game.turn,
    key = positionKey(fen);
  if (!solution.length) throw new Error("A mistake card needs a solution");
  solution.forEach((move) => game.play(move));
  const id = `mistake:${side}:${key}`;
  return {
    id,
    cardId: id,
    kind: "mistake",
    side,
    positionKey: key,
    fen,
    solution,
    createdAt,
    tags: [...new Set(tags)],
  };
}
export const personalCardSchema = z
  .strictObject({
    id: z.string(),
    cardId: z.string(),
    kind: z.literal("mistake"),
    side: z.enum(["white", "black"]),
    positionKey: z.string(),
    fen: z.string().max(200),
    solution: z
      .array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/))
      .min(1)
      .max(256),
    createdAt: z.number().int().nonnegative().max(8_000_000_000_000_000),
    tags: z.array(z.string().min(1).max(100)).max(100),
  })
  .refine((card) => {
    try {
      const expected = createMistakeCard(
        card.fen,
        card.solution,
        card.createdAt,
        card.tags,
      );
      return (
        expected.id === card.id &&
        card.cardId === card.id &&
        expected.positionKey === card.positionKey &&
        expected.side === card.side
      );
    } catch {
      return false;
    }
  });
export function mergePersonalCards(
  local: PersonalCard[],
  incoming: PersonalCard[],
): PersonalCard[] {
  const result = new Map(local.map((card) => [card.cardId, card]));
  for (const card of incoming) {
    const old = result.get(card.cardId);
    result.set(
      card.cardId,
      old
        ? {
            ...old,
            createdAt: Math.min(old.createdAt, card.createdAt),
            tags: [...new Set([...old.tags, ...card.tags])],
          }
        : card,
    );
  }
  const merged = [...result.values()];
  // A union of two valid cards can exceed the tag limit; reject it before any
  // write so a later export always stays importable.
  for (const card of merged) personalCardSchema.parse(card);
  return merged;
}
/** One session owns the retry identities; Progress decides scheduling atomically. */
export class MistakeSession {
  private sessionId = ulid();
  private started: number;
  hintsUsed = 0;
  private saving = false;
  private solved = false;
  private hintedMove?: string;
  constructor(
    readonly card: PersonalCard,
    private scheduler: SchedulerPort<PersonalCard>,
    private clock = Date.now,
  ) {
    this.started = clock();
  }
  hint(move?: string) {
    if (this.saving || this.solved || this.hintsUsed >= 2) return;
    if (move) {
      new Game(this.card.fen).play(move);
      this.hintedMove = move;
    }
    this.hintsUsed++;
  }
  async submit(uci: string) {
    if (this.saving || this.solved) return false;
    const game = new Game(this.card.fen);
    game.play(uci);
    const correct = [this.card.solution[0], this.hintedMove].some((move) => {
      if (!move) return false;
      const expected = new Game(this.card.fen);
      expected.play(move);
      return positionKey(game.fen) === positionKey(expected.fen);
    });
    this.saving = true;
    try {
      await this.scheduler.record({
        attemptId: ulid(),
        sessionId: this.sessionId,
        cardId: this.card.id,
        at: this.clock(),
        grade: correct ? (this.hintsUsed ? "hard" : "good") : "again",
        context: "mistake",
        hintsUsed: this.hintsUsed,
        durationMs: Math.max(0, this.clock() - this.started),
        schedulingEligible: false,
      });
      this.solved = correct;
      if (!correct) {
        this.started = this.clock();
      }
      return correct;
    } finally {
      this.saving = false;
    }
  }
}
