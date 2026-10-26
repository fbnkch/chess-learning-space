import type { Repertoire } from "../repertoire/Repertoire";
import type { RepertoireCard, Side } from "../repertoire/types";
import type { Review } from "../scheduler/Scheduler";
export type LineStage = "learn" | "practice" | "drill";
/** A scheduled shared position belongs to its recorded line, not every reaching line. */
export function lineStage(
  rep: Repertoire,
  side: Side,
  lineId: string,
  log: readonly Review[],
): LineStage {
  const cards = rep.cards(side);
  const relevant = log.filter((r) => {
    const card = cards.find((c) => c.id === r.cardId);
    return card && (r.lineId ?? card.lineId) === lineId;
  });
  if (
    relevant.some(
      (r) =>
        r.schedulingEligible ||
        (r.context === "practice" &&
          r.lineCompleted &&
          r.grade === "good" &&
          r.hintsUsed === 0),
    )
  )
    return "drill";
  return relevant.some((r) => r.context === "learn" && r.lineCompleted)
    ? "practice"
    : "learn";
}
export function drillRepertoire(
  rep: Repertoire,
  side: Side,
  log: readonly Review[],
  stageSource: Repertoire = rep,
) {
  return rep.selectLines(
    side,
    rep
      .lineMeta(side)
      .filter((l) => lineStage(stageSource, side, l.id, log) === "drill")
      .map((l) => l.id),
  );
}
export function drillCards(
  rep: Repertoire,
  log: readonly Review[],
): RepertoireCard[] {
  return (["white", "black"] as const).flatMap((side) =>
    drillRepertoire(rep, side, log).cards(side),
  );
}
export function completionReview(
  card: RepertoireCard,
  context: "learn" | "practice",
  sessionId: string,
  at: number,
  attemptId: string,
): Review {
  return {
    cardId: card.id,
    lineId: card.lineId,
    context,
    sessionId,
    at,
    attemptId,
    grade: "good",
    hintsUsed: 0,
    durationMs: 0,
    schedulingEligible: false,
    lineCompleted: true,
    ...(context === "learn" ? { discoveryMode: "visits" as const } : {}),
  };
}
