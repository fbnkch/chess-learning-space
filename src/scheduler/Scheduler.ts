import type { Card } from "../repertoire/types";

const MAX_INTERVAL_DAYS = 3650;
export type Grade = "again" | "hard" | "good" | "easy";
export interface Review {
  attemptId: string;
  sessionId: string;
  cardId: string;
  lineId?: string;
  at: number;
  grade: Grade;
  lineCompleted?: boolean;
  discoveryMode?: "visits";
  lineUnlocked?: boolean;
  context:
    | "rule-quiz"
    | "learn"
    | "repertoire"
    | "practice"
    | "woodpecker"
    | "puzzle"
    | "mistake";
  hintsUsed: number;
  durationMs: number;
  schedulingEligible: boolean;
  puzzle?: {
    rating: number;
    rd: number;
    rated: boolean;
    setId?: string;
    cycle?: number;
  };
}
export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  due: number;
}
export type ScheduledCard<T extends Card = Card> = T & { state?: SrsState };
export interface SchedulerPort<T extends Card = Card> {
  due(now: number): Promise<ScheduledCard<T>[]>;
  record(review: Review): Promise<Review>;
}
export interface ReviewStore {
  reviews(): Promise<Review[]> | Review[];
  record(review: Review): Promise<Review>;
}
export class Scheduler<T extends Card> implements SchedulerPort<T> {
  constructor(
    private readonly cards: (log: readonly Review[]) => readonly T[],
    private readonly store: ReviewStore,
  ) {}
  async due(now: number) {
    const log = await this.store.reviews();
    return dueCards(this.cards(log), log, now);
  }
  reviews() {
    return this.store.reviews();
  }
  record(review: Review) {
    return this.store.record(review);
  }
}
export function dayStart(at: number): number {
  const date = new Date(at);
  if (date.getHours() < 4) date.setDate(date.getDate() - 1);
  date.setHours(4, 0, 0, 0);
  return date.getTime();
}
export function transition(
  previous: SrsState | undefined,
  review: Review,
): SrsState {
  const old = previous ?? {
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    due: 0,
  };
  let { ease, intervalDays, reps, lapses } = old;
  if (review.grade === "again") {
    reps = 0;
    lapses++;
    ease = Math.max(1.3, ease - 0.2);
    intervalDays = 1;
  } else if (review.grade === "hard") {
    ease = Math.max(1.3, ease - 0.15);
    intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
    reps++;
  } else {
    const good =
      reps === 0 ? 1 : reps === 1 ? 3 : Math.round(intervalDays * ease);
    intervalDays = Math.round(good * (review.grade === "easy" ? 1.3 : 1));
    if (review.grade === "easy") ease += 0.15;
    reps++;
  }
  ease = Math.round(ease * 100) / 100;
  const date = new Date(review.at);
  // Cap at ten years so long clean streaks never overflow the Date range.
  intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);
  date.setDate(date.getDate() + intervalDays);
  return { ease, intervalDays, reps, lapses, due: dayStart(date.getTime()) };
}
export function ordered(log: readonly Review[]): Review[] {
  return [...log].sort(
    (a, b) =>
      a.at - b.at ||
      (a.attemptId < b.attemptId ? -1 : a.attemptId > b.attemptId ? 1 : 0),
  );
}
export function rebuild(log: readonly Review[]): Map<string, SrsState> {
  const states = new Map<string, SrsState>();
  const seen = new Set<string>();
  for (const review of ordered(log)) {
    const identity = JSON.stringify([review.sessionId, review.cardId]);
    if (review.schedulingEligible && !seen.has(identity)) {
      states.set(review.cardId, transition(states.get(review.cardId), review));
      seen.add(identity);
    }
  }
  return states;
}
/** Also applied inside the IndexedDB transaction, so two tabs cannot both be first. */
export function eligibleReview(review: Review, log: readonly Review[]): Review {
  const existing = log.find((r) => r.attemptId === review.attemptId);
  if (existing) return existing;
  return {
    ...review,
    schedulingEligible:
      review.context !== "rule-quiz" &&
      review.context !== "learn" &&
      review.context !== "woodpecker" &&
      review.context !== "practice" &&
      (review.context !== "puzzle" ||
        review.grade === "again" ||
        log.some((r) => r.cardId === review.cardId && r.schedulingEligible)) &&
      !log.some(
        (r) =>
          r.cardId === review.cardId &&
          r.sessionId === review.sessionId &&
          r.schedulingEligible,
      ),
  };
}
export function dueCards<T extends Card>(
  cards: readonly T[],
  log: readonly Review[],
  now: number,
): ScheduledCard<T>[] {
  const states = rebuild(log);
  const firstLines = new Map<string, string>();
  for (const review of ordered(log))
    if (
      review.schedulingEligible &&
      review.lineId &&
      !firstLines.has(review.cardId)
    )
      firstLines.set(review.cardId, review.lineId);
  return cards
    .map((card) => ({
      ...card,
      ...(card.kind === "repertoire" && firstLines.has(card.id)
        ? { lineId: firstLines.get(card.id) }
        : {}),
      state: states.get(card.id),
    }))
    .filter((card) => !card.state || card.state.due <= now)
    .sort(
      (a, b) =>
        (a.state ? 0 : 1) - (b.state ? 0 : 1) ||
        (a.state?.due ?? 0) - (b.state?.due ?? 0),
    );
}
export function retiredCardIds(
  cards: readonly Card[],
  log: readonly Review[],
): string[] {
  const active = new Set(cards.map((card) => card.id));
  return [...new Set(log.map((review) => review.cardId))].filter(
    (id) => !active.has(id),
  );
}
export class MemoryProgress implements ReviewStore {
  private log: Review[];
  constructor(reviews: readonly Review[] = []) {
    this.log = [...reviews];
  }
  async record(review: Review): Promise<Review> {
    const stored = eligibleReview(review, this.log);
    if (!this.log.some((r) => r.attemptId === review.attemptId))
      this.log.push(stored);
    return stored;
  }
  reviews() {
    return [...this.log];
  }
}
