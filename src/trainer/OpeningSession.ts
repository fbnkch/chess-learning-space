import { goldenRules } from "../rules/catalogue";
import { Game, positionKey } from "../game/Game";
import type { Repertoire } from "../repertoire/Repertoire";
import type { RepertoireCard, Edge } from "../repertoire/types";
import type { Review, SchedulerPort } from "../scheduler/Scheduler";

export interface Attempt {
  saved?: boolean;
  correct: boolean;
  solution: string;
  idea: string;
  ruleIds: string[];
  review: Review;
}
export function weightedReply(
  edges: readonly Edge[],
  random: () => number,
): Edge | undefined {
  const total = edges.reduce((sum, edge) => sum + edge.weight, 0);
  let pick = random() * total;
  return edges.find((edge) => (pick -= edge.weight) < 0) ?? edges.at(-1);
}
/** No timers, browser or storage: callers animate prelude ticks and persist emitted reviews. */
export class OpeningSession {
  game = new Game();
  phase: "prelude" | "move" | "reply" | "feedback" | "complete" = "complete";
  index = 0;
  feedback: Attempt | null = null;
  hintsUsed = 0;
  private prelude: string[] = [];
  private startedAt = 0;
  readonly cards: RepertoireCard[];
  readonly summary = { attempts: 0, correct: 0, again: 0 };
  private readonly failed = new Set<string>();
  private readonly savedIds = new Set<string>();
  constructor(
    private readonly repertoire: Repertoire,
    cards: readonly RepertoireCard[],
    readonly sessionId: string,
    private readonly clock: () => number,
    private readonly attemptId: () => string,
    readonly context: "repertoire" | "practice" = "repertoire",
    private readonly random: () => number = Math.random,
  ) {
    this.cards = [...cards];
    if (context === "practice")
      this.cards.sort(
        (a, b) => repertoire.prelude(a).length - repertoire.prelude(b).length,
      );
    this.setup();
  }
  static async due(
    repertoire: Repertoire,
    port: SchedulerPort<RepertoireCard>,
    sessionId: string,
    clock: () => number,
    id: () => string,
    priority: (card: RepertoireCard) => number = () => 0,
  ) {
    const due = new Set((await port.due(clock())).map((card) => card.id));
    return new OpeningSession(
      repertoire,
      [...repertoire.cards("white"), ...repertoire.cards("black")]
        .filter((card) => due.has(card.id))
        .sort((a, b) => priority(a) - priority(b)),
      sessionId,
      clock,
      id,
    );
  }
  get card() {
    return this.cards[this.index];
  }
  private setup() {
    this.feedback = null;
    this.hintsUsed = 0;
    if (!this.card) {
      this.phase = "complete";
      return;
    }
    this.game = new Game(this.repertoire.startFen(this.card));
    this.prelude = this.repertoire.prelude(this.card);
    if (this.context === "practice" && this.index > 0) {
      this.prelude.forEach((uci) => this.game.play(uci));
      this.phase = "move";
    } else this.phase = this.prelude.length ? "prelude" : "move";
    this.startedAt = this.clock();
  }
  advancePrelude() {
    if (this.phase !== "prelude") return;
    this.game.play(this.prelude[this.game.ply]);
    if (this.game.ply === this.prelude.length) {
      this.phase = "move";
      this.startedAt = this.clock();
    }
  }
  hint() {
    if (this.phase !== "move" || this.context === "practice") return "";
    this.hintsUsed = Math.min(2, this.hintsUsed + 1);
    const edge = this.repertoire.ourMoves(
      this.card.side,
      this.card.positionKey,
    )[0];
    if (this.hintsUsed > 1)
      return `${this.game.toSan(edge.uci)}: ${edge.comment}`;
    // Step 1 must not reveal the move: authored comments often name it, so
    // offer the golden-rule idea and the piece to look at instead.
    const rule = goldenRules.find((r) => edge.ruleIds.includes(r.id));
    const piece = `Look at the piece on ${edge.uci.slice(0, 2)}.`;
    return rule ? `${rule.shortForm}. ${piece}` : piece;
  }
  attempt(uci: string): Attempt | null {
    if (this.phase === "feedback" && !this.feedback?.correct) this.retry();
    if (this.phase !== "move") return null;
    const edges = this.repertoire.ourMoves(
      this.card.side,
      this.card.positionKey,
    );
    const trial = new Game(this.game.fen);
    let accepted: Edge | undefined;
    try {
      trial.play(uci);
      accepted = edges.find((edge) => edge.to === positionKey(trial.fen));
    } catch {
      /* wrong or illegal */
    }
    const edge = accepted ?? edges[0];
    const review: Review = {
      attemptId: this.attemptId(),
      sessionId: this.sessionId,
      cardId: this.card.id,
      lineId: this.card.lineId,
      at: this.clock(),
      grade: !accepted ? "again" : this.hintsUsed ? "hard" : "good",
      context: this.context,
      hintsUsed: this.hintsUsed,
      durationMs: Math.max(0, this.clock() - this.startedAt),
      schedulingEligible: false, // Assigned only by the store transaction.
    };
    if (
      this.context === "practice" &&
      accepted &&
      this.index === this.cards.length - 1 &&
      this.failed.size === 0
    )
      review.lineCompleted = true;
    if (!accepted && !this.failed.has(this.card.id)) {
      this.failed.add(this.card.id);
      if (this.context !== "practice") this.cards.push(this.card);
    }
    if (accepted) this.game.play(uci);
    this.phase =
      accepted &&
      this.repertoire.replies(this.card.side, positionKey(this.game.fen)).length
        ? "reply"
        : "feedback";
    this.feedback = {
      correct: Boolean(accepted),
      solution: edge.uci,
      idea: edge.comment,
      ruleIds: edge.ruleIds,
      review,
    };
    return this.feedback;
  }
  /** Called with the authoritative stored record, including on an idempotent save retry. */
  saved(review: Review) {
    if (this.feedback?.review.attemptId === review.attemptId) {
      this.feedback.review = review;
      this.feedback.saved = true;
    }
    if (this.savedIds.has(review.attemptId)) return;
    this.savedIds.add(review.attemptId);
    this.summary.attempts++;
    if (review.grade === "again") this.summary.again++;
    else this.summary.correct++;
  }
  chooseEasy() {
    if (
      this.context !== "practice" &&
      this.feedback?.correct &&
      !this.feedback.saved &&
      this.feedback.review.grade === "good"
    )
      this.feedback.review.grade = "easy";
  }
  advanceReply() {
    if (this.phase !== "reply") return;
    const edge = weightedReply(
      this.repertoire.replies(this.card.side, positionKey(this.game.fen)),
      this.random,
    );
    if (edge) this.game.play(edge.uci);
    this.phase = "feedback";
  }
  retry() {
    if (this.phase === "feedback" && !this.feedback?.correct) {
      this.feedback = null;
      this.phase = "move";
      this.startedAt = this.clock();
    }
  }
  next() {
    if (this.phase !== "feedback" || !this.feedback?.correct) return;
    this.index++;
    this.setup();
  }
  /** Repeating within this session never schedules the same card twice. */
  reset() {
    if (this.context === "practice") {
      this.failed.clear();
      this.summary.attempts = this.summary.correct = this.summary.again = 0;
    }
    this.index = 0;
    this.setup();
  }
}
