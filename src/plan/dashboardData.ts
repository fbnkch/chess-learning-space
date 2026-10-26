import { learnedRuleIds } from "../rules/quiz";
import type { Progress } from "../progress/Progress";
import type { Scheduler } from "../scheduler/Scheduler";
import type { RepertoireCard } from "../repertoire/types";
import type { PuzzleTraining } from "../puzzles/PuzzleTraining";
import { dayStart } from "../scheduler/Scheduler";
import { Scheduler as CardScheduler } from "../scheduler/Scheduler";
import { Game, positionKey } from "../game/Game";
import { repertoire } from "../repertoire/bundled";
import { cachedReview } from "../review/browserReview";
import { ratingHistory } from "../puzzles/rating";
import { cohort, coverage } from "../trainer/progress";
import { drillRepertoire, lineStage } from "../trainer/stages";
import { woodpeckerProgress } from "../puzzles/training";
import { lastOpening, planSession, weeklyProgress } from "./planner";
import type { Settings } from "../settings";

const replyTargets = new Map(
  (["white", "black"] as const).map((side) => {
    const targets = new Set<string>();
    for (const line of repertoire.lineMeta(side)) {
      const game = new Game(line.startFen);
      for (const uci of line.moves) {
        for (const edge of repertoire.replies(side, positionKey(game.fen)))
          targets.add(edge.to);
        game.play(uci);
      }
    }
    return [side, targets] as const;
  }),
);

export async function loadDashboard(
  store: Progress,
  scheduler: Scheduler<RepertoireCard>,
  puzzles: PuzzleTraining,
  settings: Settings,
  clock: () => number,
) {
  const now = clock();
  const [log, openingDue, puzzleDue, puzzle, scans, rules, games, personal] =
    await Promise.all([
      scheduler.reviews(),
      scheduler.due(now),
      puzzles.due(now),
      puzzles.snapshot(),
      store.scans(),
      store.ruleStates(),
      store.games(),
      store.personalCards(),
    ]);
  const mistakeDue = await new CardScheduler(() => personal, {
    reviews: () => log,
    record: (r) => scheduler.record(r),
  }).due(now);
  const due = {
    openings: openingDue.length,
    puzzles: puzzleDue.length,
    mistakes: mistakeDue.length,
  };
  const sides = (["white", "black"] as const).map((side) => ({
    side,
    coverage: coverage(repertoire, side, log),
    cohort: cohort(repertoire, side, log, settings.activeLines, () => now),
  }));
  const last = lastOpening(log);
  const lastLine = sides
    .flatMap(({ side }) =>
      repertoire.lineMeta(side).map((line) => ({ ...line, side })),
    )
    .find((line) => line.id === last?.lineId);
  const fallback = sides
    .flatMap(({ side, cohort }) =>
      cohort.active.map(({ line }) => ({ ...line, side })),
    )
    .find((line) => line.group === (settings.startingOpening ?? "italian"));
  const nextLine = lastLine ?? fallback;
  function preview(line: NonNullable<typeof nextLine>) {
    const game = new Game(line.startFen);
    const due = new Set(openingDue.map((c) => c.positionKey));
    // First due learner position, otherwise the next unseen learner position.
    const visited = new Set(
      log
        .filter((r) => r.context === "learn" && r.lineId === line.id)
        .map((r) => r.cardId),
    );
    const positions: {
      fen: string;
      orientation: "white" | "black";
      lastMove?: string[];
      position: string;
    }[] = [];
    for (const move of line.moves) {
      if (game.turn === line.side)
        positions.push({
          fen: game.fen,
          orientation: line.side,
          lastMove: game.lastMove,
          position: positionKey(game.fen),
        });
      game.play(move);
    }
    return (
      positions.find((p) => due.has(p.position)) ??
      (lineStage(repertoire, line.side, line.id, log) !== "learn"
        ? positions[0]
        : undefined) ??
      positions.find(
        (p) =>
          !repertoire
            .cards(line.side)
            .filter((c) => c.positionKey === p.position)
            .some((c) => visited.has(c.id)),
      ) ??
      positions[0]
    );
  }
  const continueLine = nextLine
    ? {
        title: nextLine.name,
        preview: preview(nextLine),
        stage: lineStage(repertoire, nextLine.side, nextLine.id, log),
        href: `#openings?line=${encodeURIComponent(nextLine.id)}`,
      }
    : null;
  const setLog = [...log]
    .sort((a, b) => b.at - a.at)
    .find((r) => r.puzzle?.setId);
  const set =
    puzzle.sets.find((s) => s.id === setLog?.puzzle?.setId) ?? puzzle.sets[0];
  const continueSet = set
    ? {
        set,
        progress: woodpeckerProgress(set, log),
        href: `#puzzles?mode=woodpecker&set=${encodeURIComponent(set.id)}`,
      }
    : null;
  let covered = 0,
    moves = 0;
  const reviews = games
    .map((game) => {
      const parsed = Game.fromPgn(game.pgn);
      if (game.colour) {
        const ours = game.colour === "white" ? "w" : "b";
        for (const move of parsed.notation) {
          if (Number(move.before.split(" ")[5]) > 6) break;
          const after = positionKey(move.after);
          if (move.color !== ours) {
            moves++;
            const known =
              repertoire
                .replies(game.colour, positionKey(move.before))
                .some((edge) => edge.to === after) ||
              replyTargets.get(game.colour)!.has(after);
            if (!known) break;
            covered++;
          } else if (
            !repertoire
              .ourMoves(game.colour, positionKey(move.before))
              .some((edge) => edge.to === after)
          )
            break;
        }
      }
      return { game, review: cachedReview(parsed) };
    })
    .sort(
      (a, b) =>
        a.game.date.localeCompare(b.game.date) ||
        a.game.id.localeCompare(b.game.id),
    );
  const analysis = reviews.flatMap(({ game, review }) =>
    review && game.colour
      ? [
          {
            id: game.id,
            date: game.date,
            accuracy: review.accuracy[game.colour],
            blunders: review.moves.filter(
              (m) => m.side === game.colour && m.classification === "Blunder",
            ).length,
          },
        ]
      : [],
  );
  const weekly = weeklyProgress(log, scans, settings, () => now);
  const dueIds = new Set(openingDue.map((card) => card.id));
  const openingSteps = sides.flatMap(({ side }) => {
    const allLines = repertoire.lineMeta(side);
    const groups = new Set(allLines.map((line) => line.group));
    return [...groups].flatMap((group) => {
      const lines = allLines.filter((line) => line.group === group);
      const selected = repertoire.selectLines(
        side,
        lines.map((line) => line.id),
      );
      const drill = drillRepertoire(selected, side, log, repertoire);
      const count = drill
        .cards(side)
        .filter((card) => dueIds.has(card.id)).length;
      if (!count) return [];
      const line = drill.lineMeta(side)[0];
      return [
        {
          preview: preview({ ...line, side }),
          id: `openings-${side}-${group}`,
          title: `Recall due ${side} openings: ${group} (${count})`,
          minutes: 5,
          href: `#openings?line=${encodeURIComponent(line.id)}`,
        },
      ];
    });
  });
  const session = planSession(due).flatMap((step) => {
    if (step.id === "openings") return openingSteps;
    return [
      step.id === "lesson" && continueLine
        ? {
            ...step,
            href: continueLine.href,
            preview: continueLine.preview,
            title: `${continueLine.stage === "learn" ? "Learn" : "Continue"} ${continueLine.title}`,
          }
        : step.id === "tactics" && mistakeDue[0]
          ? {
              ...step,
              preview: {
                fen: mistakeDue[0].fen,
                orientation: mistakeDue[0].side,
              },
            }
          : step,
    ];
  });
  const required = scans.reduce((sum, s) => sum + s.required, 0);
  return {
    days: Array.from({ length: 7 }, (_, i) => {
      const date = new Date(dayStart(now));
      date.setDate(date.getDate() - 6 + i);
      const start = dayStart(date.getTime());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        label: date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        count: new Set(
          [...log.filter((r) => !r.lineUnlocked), ...scans]
            .filter((r) => r.at >= start && r.at < end.getTime() && r.at <= now)
            .map((r) => r.sessionId),
        ).size,
      };
    }),
    due,
    session,
    weekly,
    sides,
    continueLine,
    continueSet,
    analysis,
    analysisDone: analysis.filter(
      (r) => !settings.planReviewedGames?.includes(r.id),
    ).length,
    pendingGames: reviews.filter((r) => !r.review).length,
    rating: puzzle.rating.rating,
    ratingHistory: ratingHistory(log),
    recall: required
      ? scans.reduce((sum, s) => sum + s.found, 0) / required
      : null,
    learnedRules: learnedRuleIds(rules, log).length,
    gameCoverage: moves ? covered / moves : null,
    empty:
      !log.length &&
      !scans.length &&
      !games.length &&
      !personal.length &&
      !rules.some((r) => r.learned) &&
      !puzzle.sets.length,
  };
}
export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
