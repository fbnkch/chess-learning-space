import { Game, positionKey } from "../game/Game";
import type { Repertoire } from "../repertoire/Repertoire";
import type { Line, RepertoireCard, Side } from "../repertoire/types";
import { rebuild, type Review } from "../scheduler/Scheduler";
import { completionReview, drillRepertoire, lineStage } from "./stages";

export function cohortSize(value?: number): number {
  return Number.isInteger(value) && value! >= 3 && value! <= 12 ? value! : 6;
}
/** First opponent choice with alternatives, not an arbitrary line-level weight. */
function branchWeight(rep: Repertoire, side: Side, line: Line): number {
  const game = new Game(line.startFen);
  for (const move of line.moves) {
    const replies = rep.replies(side, positionKey(game.fen));
    if (replies.length > 1)
      return replies.find((e) => e.uci === move)?.weight ?? 0;
    game.play(move);
  }
  return 0;
}
export interface CohortLine {
  line: Line;
  reason: string;
  stable: boolean;
  lapses: number;
  ease: number;
}
export function cohort(
  rep: Repertoire,
  side: Side,
  log: readonly Review[],
  limit: number | undefined,
  clock: () => number,
): { active: CohortLine[]; locked: CohortLine[] } {
  const now = clock();
  const history = log.filter((r) => r.at <= now);
  const states = rebuild(history);
  const weights = new Map(
    rep.lineMeta(side).map((l) => [l.id, branchWeight(rep, side, l)]),
  );
  const ordered = [...rep.lineMeta(side)].sort(
    (a, b) =>
      Number(Boolean(b.main)) - Number(Boolean(a.main)) ||
      weights.get(b.id)! - weights.get(a.id)! ||
      a.id.localeCompare(b.id, "en"),
  );
  const entries = ordered.map((line) => {
    const cards = rep.selectLines(side, [line.id]).cards(side);
    const ids = new Set(cards.map((c) => c.id));
    const lapses = cards.reduce(
      (sum, card) => sum + (states.get(card.id)?.lapses ?? 0),
      0,
    );
    const ease = Math.min(...cards.map((c) => states.get(c.id)?.ease ?? 2.5));
    const stable =
      cards.length > 0 &&
      cards.every((c) => (states.get(c.id)?.intervalDays ?? 0) >= 3) &&
      !history.some(
        (r) =>
          ids.has(r.cardId) &&
          r.context === "repertoire" &&
          r.grade === "again" &&
          now - r.at < 7 * 86400000,
      );
    return {
      line,
      lapses,
      ease,
      stable,
      reason:
        lapses || ease < 2.5
          ? `${lapses} lapses · ${ease.toFixed(2)} ease: practice recall`
          : stable
            ? "Stable: every interval ≥ 3 days; no lapse in 7 days"
            : "New or practicing recall",
    };
  });
  const active = new Set(
    entries.slice(0, cohortSize(limit)).map((e) => e.line.id),
  );
  const cardIds = new Set(rep.cards(side).map((c) => c.id));
  for (const entry of entries) {
    if (
      lineStage(rep, side, entry.line.id, history) !== "learn" ||
      history.some(
        (r) =>
          cardIds.has(r.cardId) && r.lineId === entry.line.id && r.lineUnlocked,
      )
    )
      active.add(entry.line.id);
  }
  // A stable cohort admits at most one next line per evaluation, even with shared cards.
  for (const entry of entries) {
    if (active.has(entry.line.id)) continue;
    if (!entries.filter((e) => active.has(e.line.id)).every((e) => e.stable))
      break;
    active.add(entry.line.id);
    break;
  }
  return {
    active: entries
      .filter((e) => active.has(e.line.id))
      .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease),
    locked: entries.filter((e) => !active.has(e.line.id)),
  };
}
export function unlockReview(
  card: RepertoireCard,
  sessionId: string,
  at: number,
  attemptId: string,
): Review {
  return {
    ...completionReview(card, "learn", sessionId, at, attemptId),
    lineCompleted: undefined,
    lineUnlocked: true,
  };
}
export interface Coverage {
  total: number;
  discovered: number;
  practised: number;
  drill: number;
  mastered: number;
}
/** Count trainable positions once per scope; shared positions use OR membership. */
export function coverage(
  rep: Repertoire,
  side: Side,
  log: readonly Review[],
  stageSource = rep,
): Coverage {
  return coverageCounter(stageSource, side, log)(rep);
}
/** Build shared sets once, then count any opening/line scope cheaply. */
export function coverageCounter(
  stageSource: Repertoire,
  side: Side,
  log: readonly Review[],
) {
  const states = rebuild(log);
  const discovered = new Set(
    log
      .filter(
        (r) => r.context === "learn" && !r.lineUnlocked && !r.lineCompleted,
      )
      .map((r) => r.cardId),
  );
  // Older lessons only recorded completion. Their full lesson remains discovered.
  const sourceIds = new Set(stageSource.cards(side).map((c) => c.id));
  const completed = stageSource
    .lineMeta(side)
    .filter((l) =>
      log.some(
        (r) =>
          r.context === "learn" &&
          r.lineCompleted &&
          r.lineId === l.id &&
          r.discoveryMode === undefined &&
          sourceIds.has(r.cardId),
      ),
    );
  for (const line of completed)
    for (const card of stageSource.selectLines(side, [line.id]).cards(side))
      discovered.add(card.id);
  const practised = new Set(
    log
      .filter((r) => r.context === "practice" || r.context === "repertoire")
      .map((r) => r.cardId),
  );
  const drill = new Set(
    drillRepertoire(stageSource, side, log)
      .cards(side)
      .map((c) => c.id),
  );
  return (rep: Repertoire): Coverage => {
    const cards = rep.cards(side);
    return {
      total: cards.length,
      discovered: cards.filter((c) => discovered.has(c.id)).length,
      practised: cards.filter((c) => practised.has(c.id)).length,
      drill: cards.filter((c) => drill.has(c.id)).length,
      mastered: cards.filter((c) => (states.get(c.id)?.intervalDays ?? 0) >= 21)
        .length,
    };
  };
}
export function coverageText(value: Coverage): string {
  return `${value.discovered}/${value.total} positions discovered · ${value.practised} practiced · ${value.drill} in Drill · ${value.mastered} mastered`;
}
