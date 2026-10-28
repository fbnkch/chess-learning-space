import { MiniBoard } from "../MiniBoard";
import { CoverageBar } from "../DataGraphic";
import { InfoTip } from "../InfoTip";
import { TrainingOptions } from "../TrainingOptions";
import { useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from "react";
import { monotonicFactory, ulid } from "ulid";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { Board } from "../board/Board";
import { Game, positionKey } from "../game/Game";
import { repertoire } from "../repertoire/bundled";
import { completionReview, drillRepertoire, lineStage } from "./stages";
import type { Review } from "../scheduler/Scheduler";
import type { SchedulerPort } from "../scheduler/Scheduler";
import type { RepertoireCard, Side } from "../repertoire/types";
import type { Key } from "@lichess-org/chessground/types";
import { playSound } from "../sound";
import type { Settings } from "../settings";
import {
  cohort,
  coverageCounter,
  coverageText,
  unlockReview,
} from "./progress";
import { puzzleOpeningGroups } from "../puzzles/openings";
import { OpeningSession } from "./OpeningSession";

const attemptId = monotonicFactory();
const clock = Date.now;
const openingGroups = [
  { id: "italian", name: "Italian", side: "white" as Side },
  { id: "london", name: "London", side: "white" as Side },
  { id: "sidelines", name: "1.e4 sidelines", side: "white" as Side },
  { id: "caro", name: "vs 1.e4 (Caro-Kann)", side: "black" as Side },
  { id: "qgd", name: "vs 1.d4 (QGD)", side: "black" as Side },
];
const allLines = [
  ...repertoire.lineMeta("white"),
  ...repertoire.lineMeta("black"),
];
const groupRepertoires = new Map(
  openingGroups.map((group) => [
    group.id,
    repertoire.selectLines(
      group.side,
      allLines.filter((l) => l.group === group.id).map((l) => l.id),
    ),
  ]),
);
const lineRepertoires = new Map(
  allLines.map((line) => [
    line.id,
    repertoire.selectLines(
      openingGroups.find((g) => g.id === line.group)!.side,
      [line.id],
    ),
  ]),
);
const defaultLine = (group: string) =>
  allLines.find(
    (l) =>
      l.id ===
      (group === "italian"
        ? "italian-pianissimo-main"
        : group === "london"
          ? "london-d5"
          : group === "caro"
            ? "caro-classical"
            : group === "qgd"
              ? "qgd-nc3"
              : "alapin-d5"),
  ) ?? allLines.find((l) => l.group === group)!;
export function Openings({
  store,
  settings,
  dueCount: totalDueCount,
  reviewCount,
  onReview,
}: {
  store:
    | (SchedulerPort<RepertoireCard> & {
        reviews(): Promise<Review[]> | Review[];
      })
    | null;
  settings: Settings;
  dueCount: number;
  reviewCount: number;
  onReview: () => Promise<void>;
}) {
  const requestedLine = new URLSearchParams(location.hash.split("?")[1]).get(
    "line",
  );
  const initialLine = allLines.find((line) => line.id === requestedLine);
  const initialGroup = openingGroups.find(
    (group) => group.id === initialLine?.group,
  );
  const [mode, setMode] = useState<"overview" | "learn" | "drill">("overview");
  const [error, setError] = useState("");
  const [side, setSide] = useState<Side>(initialGroup?.side ?? "white");
  const [group, setGroup] = useState(initialGroup?.id ?? "italian");
  const [lineId, setLineId] = useState(
    initialLine?.id ?? defaultLine("italian").id,
  );
  const groupLines = allLines.filter((l) => l.group === group);
  const line = groupLines.find((l) => l.id === lineId) ?? defaultLine(group);
  const selected = groupRepertoires.get(group)!;
  const selectedLine = lineRepertoires.get(line.id)!;
  const [log, setLog] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const launchedFromHome = useRef(false);
  const coverageByScope = useMemo(() => {
    const count = coverageCounter(repertoire, side, log);
    return new Map(
      [...groupRepertoires, ...lineRepertoires].map(([id, rep]) => [
        id,
        count(rep),
      ]),
    );
  }, [side, log]);
  const [cohortTime, refreshCohortTime] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const timer = window.setInterval(refreshCohortTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const cohortState = useMemo(() => {
    void cohortTime;
    return cohort(repertoire, side, log, settings.activeLines, clock);
  }, [side, log, settings.activeLines, cohortTime]);
  const activeIds = new Set(cohortState.active.map((e) => e.line.id));
  const locked = !activeIds.has(line.id);
  const lines = [...cohortState.active, ...cohortState.locked]
    .map((e) => e.line)
    .filter((l) => l.group === group);
  const nextLocked = cohortState.locked[0];
  const stage = lineStage(repertoire, side, line.id, log);
  const [dueIds, setDueIds] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    if (store)
      void Promise.resolve(store.reviews())
        .then(async (reviews) => {
          const cards = await store.due(Date.now());
          if (active) {
            setLog(reviews);
            setDueIds(cards.map((card) => card.id));
            setLoaded(true);
          }
        })
        .catch(() => {
          if (active) setError("Could not load your cards. Please try again.");
        });
    return () => {
      active = false;
    };
  }, [store, reviewCount, totalDueCount]);
  const groupCards = useMemo(
    () => drillRepertoire(selected, side, log, repertoire).cards(side),
    [selected, side, log],
  );
  const dueCount = groupCards.filter((card) => dueIds.includes(card.id)).length;
  const lineDueCount =
    stage !== "drill"
      ? 0
      : selectedLine.cards(side).filter((card) => dueIds.includes(card.id))
          .length;
  const groupReview = stage === "drill" && lineDueCount === 0 && dueCount > 0;
  const [learnPly, setLearnPly] = useState(0);
  const [session, setSession] = useState<OpeningSession | null>(null);
  const practicing = mode === "drill" && session?.context === "practice";
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [safety, setSafety] = useState<{
    uci?: string;
  } | null>(null);
  const [failurePromptShown, setFailurePromptShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [tick, redraw] = useReducer((n) => n + 1, 0);
  const learnGame = new Game(line.startFen);
  line.moves.slice(0, learnPly).forEach((uci) => learnGame.play(uci));
  const game = mode === "drill" && session ? session.game : learnGame;
  const displayGame = safety?.uci ? new Game(game.fen) : game;
  if (safety?.uci) displayGame.play(safety.uci);
  useEffect(() => {
    if (
      mode !== "drill" ||
      (session?.phase !== "prelude" && session?.phase !== "reply")
    )
      return;
    const timer = window.setTimeout(
      () => {
        if (session.phase === "reply") session.advanceReply();
        else session.advancePrelude();
        if (settings.sound) playSound(session.game.check ? "check" : "move");
        setShapes([]);
        redraw();
      },
      settings.reducedMotion ? 50 : Math.max(50, settings.animationMs + 20),
    );
    return () => window.clearTimeout(timer);
  }, [
    session,
    mode,
    tick,
    settings.reducedMotion,
    settings.animationMs,
    settings.sound,
  ]);
  const pendingGrade = Boolean(
    session?.feedback?.correct && !session.feedback.saved,
  );
  const cannotLeaveAttempt =
    Boolean(safety) ||
    busy ||
    Boolean(error && session?.feedback) ||
    pendingGrade;
  async function startDrill(practice = false, onlyLine = false) {
    if (!store || cannotLeaveAttempt || (locked && (practice || onlyLine)))
      return;
    setBusy(true);
    setError("");
    try {
      const scoped = practice
        ? selectedLine
        : drillRepertoire(
            onlyLine ? selectedLine : selected,
            side,
            log,
            repertoire,
          );
      const next = practice
        ? new OpeningSession(
            scoped,
            scoped.cards(side),
            ulid(),
            Date.now,
            attemptId,
            "practice",
          )
        : await OpeningSession.due(
            scoped,
            store,
            ulid(),
            Date.now,
            attemptId,
            (card) =>
              cohortState.active.findIndex((entry) =>
                lineRepertoires
                  .get(entry.line.id)!
                  .cards(side)
                  .some((c) => c.id === card.id),
              ),
          );
      setSession(next);
      setSafety(null);
      setFailurePromptShown(false);
      setMode("drill");
      setShapes([]);
      setHint("");
    } catch {
      setError("Could not load your cards. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  // A navigation intent is consumed once, after the persisted stage has loaded.
  const launchFromHome = useEffectEvent(() => {
    if (!store || !loaded || launchedFromHome.current) return;
    const intent = new URLSearchParams(location.hash.split("?")[1]);
    if (intent.get("start") !== "1") return;
    launchedFromHome.current = true;
    if (locked) return;
    if (stage === "learn") {
      setMode("learn");
      setShapes([]);
    } else {
      const groupScope = intent.get("scope") === "group";
      void startDrill(stage === "practice" || (!groupScope && !lineDueCount), !groupScope);
    }
  });
  useEffect(() => {
    if (!loaded || !store) return;
    const timer = window.setTimeout(() => launchFromHome(), 0);
    return () => window.clearTimeout(timer);
  }, [store, loaded]);
  async function saveAttempt(from: string, to: string) {
    if (!session || !store || busy) return;
    const result = session.attempt(from + to);
    if (!result) return;
    if (
      !result.correct &&
      session.context !== "practice" &&
      !settings.safetyCheck &&
      !failurePromptShown
    ) {
      setSafety({});
      setFailurePromptShown(true);
    }
    if (result.correct && settings.sound)
      playSound(session.game.check ? "check" : "move");
    setShapes([]);
    setHint("");
    redraw();
    // Clean attempts wait for the learner's Good/Easy choice; other grades save immediately.
    if (result.review.grade === "good") return;
    setBusy(true);
    try {
      session.saved(await store.record(result.review));
      await onReview();
    } catch {
      setError(
        "Your attempt could not be saved. Use Save attempt to retry before continuing.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function retrySave() {
    if (!store || !session?.feedback) return;
    setBusy(true);
    try {
      session.saved(await store.record(session.feedback.review));
      await onReview();
      setError("");
    } catch {
      setError(
        "Your attempt could not be saved. Use Save attempt to retry before continuing.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function finishCard(easy = false) {
    if (!session?.feedback || !store || busy || error) return;
    const result = session.feedback;
    setBusy(true);
    try {
      if (!result.saved) {
        if (easy) session.chooseEasy();
        session.saved(await store.record(result.review));
        await onReview();
      }
      session.next();
      setHint("");
      setShapes([]);
      redraw();
    } catch {
      setError(
        "Your attempt could not be saved. Use Save attempt to retry before continuing.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (mode !== "learn") return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            event.target.closest("input, textarea, select, [role=dialog]")))
      )
        return;
      const targets: Record<string, number> = {
        ArrowLeft: learnPly - 1,
        ArrowRight: learnPly + 1,
        ArrowUp: 0,
        ArrowDown: line.moves.length,
      };
      if (!(event.key in targets)) return;
      event.preventDefault();
      setLearnPly(Math.max(0, Math.min(line.moves.length, targets[event.key])));
      setShapes([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, learnPly, line]);
  const previousGame = new Game(line.startFen);
  line.moves
    .slice(0, Math.max(0, learnPly - 1))
    .forEach((uci) => previousGame.play(uci));
  const learnEdge = learnPly
    ? repertoire
        .edges(side, positionKey(previousGame.fen))
        .find((edge) => edge.uci === line.moves[learnPly - 1])
    : undefined;
  const feedback = session?.feedback;
  const seenInLesson = useRef(new Set<string>());
  const learnSession = useRef(ulid());
  useEffect(() => {
    if (mode !== "learn" || locked || !store) return;
    const card = selectedLine
      .cards(side)
      .find((c) => c.positionKey === positionKey(learnGame.fen));
    if (
      !card ||
      seenInLesson.current.has(card.id) ||
      log.some(
        (r) =>
          r.cardId === card.id &&
          r.context === "learn" &&
          !r.lineUnlocked &&
          !r.lineCompleted,
      )
    )
      return;
    seenInLesson.current.add(card.id);
    void store
      .record({
        ...completionReview(
          card,
          "learn",
          learnSession.current,
          clock(),
          attemptId(),
        ),
        lineCompleted: undefined,
      })
      .then(() => onReview())
      .catch(() => {
        seenInLesson.current.delete(card.id);
        setError("Could not save the discovered position. Please try again.");
      });
  }, [mode, locked, store, side, selectedLine, learnGame.fen, log, onReview]);
  async function unlockNext() {
    if (!store || busy || !nextLocked) return;
    setBusy(true);
    try {
      const card = repertoire
        .selectLines(side, [nextLocked.line.id])
        .cards(side)[0];
      await store.record(unlockReview(card, ulid(), clock(), attemptId()));
      await onReview();
      setError("");
    } catch {
      setError("Could not unlock the next line. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function completeLearn() {
    if (!store || busy || locked || learnPly !== line.moves.length) return;
    setBusy(true);
    try {
      await store.record(
        completionReview(
          selectedLine.cards(side)[0],
          "learn",
          ulid(),
          clock(),
          attemptId(),
        ),
      );
      await onReview();
      setMode("overview");
      setError("");
    } catch {
      setError("Could not save lesson completion. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function navigateLearn(ply: number) {
    setLearnPly(ply);
    setShapes([]);
  }
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Openings</h1>
          <p>
            {openingGroups.find((g) => g.id === group)?.name} &middot;{" "}
            {side === "white" ? "White" : "Black"}
            {mode !== "overview" && (
              <> &middot; {mode === "learn" ? "Learn" : practicing ? "Practice" : "Drill"}</>
            )}
          </p>
        </div>
        <div className="opening-header-actions">
          <span className="pill">{dueCount} cards due</span>
          {mode !== "overview" && (
            <button
              disabled={cannotLeaveAttempt}
              onClick={() => {
                setMode("overview");
                setSession(null);
                setShapes([]);
                setHint("");
              }}
            >Back to overview</button>
          )}
        </div>
      </header>
      <ol className="learning-stages" aria-label="Learning stages">
        {([
          ["learn", "Learn", "See the moves"],
          ["practice", "Practice", "Recall the line"],
          ["drill", "Drill", "Review due moves"],
        ] as const).map(([id, title, description], index) => (
          <li key={id} aria-current={stage === id ? "step" : undefined}>
            <span className="stage-number">{index + 1}</span>
            <span>{title}<small>{description}</small></span>
          </li>
        ))}
      </ol>
      {(mode === "overview" || session?.phase === "complete") && (
        <section className="opening-next" aria-label="Next learning step">
          <div>
            <h2>{stage === "learn" ? "Learn this opening" : stage === "practice" ? "Practice the whole line" : "Review the due moves"}</h2>
            <p>
              {stage === "learn"
                ? "See each move and its purpose. Complete the lesson to unlock Practice."
                : stage === "practice"
                  ? "Recall the whole line without hints. A clean run unlocks Drill."
                  : lineDueCount
                    ? "Recall the moves due in this line. Your reviews are saved as you go."
                    : groupReview
                      ? "Another line in this opening is due. Review those moves first."
                    : "Nothing due in this line. Practice it again, or return Home."}
            </p>
          </div>
          <button
            className="primary"
            disabled={!store || !loaded || locked || cannotLeaveAttempt}
            onClick={() => {
              if (stage === "learn") {
                setMode("learn");
                setShapes([]);
              } else if (groupReview) {
                void startDrill();
              } else void startDrill(stage === "practice" || !lineDueCount, true);
            }}
          >
            {stage === "learn" ? "Start lesson" : groupReview ? "Review group due moves" : stage === "practice" || !lineDueCount ? "Start practice" : "Review due moves"}
          </button>
        </section>
      )}
      <TrainingOptions
        title="Training options"
        compactOpen={mode === "overview"}
      >
        <div className="opening-tabs">
          <label>
            Color{" "}
            <select
              aria-label="Training colour"
              value={side}
              disabled={cannotLeaveAttempt}
              onChange={(event) => {
                const value = event.target.value as Side;
                const next = value === "black" ? "caro" : "italian";
                setSide(value);
                setGroup(next);
                setLineId(defaultLine(next).id);
                setLearnPly(0);
                setMode("overview");
                setSession(null);
                setShapes([]);
                setHint("");
              }}
            >
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
          <label>
            Opening{" "}
            <select
              aria-label="Opening"
              value={group}
              disabled={cannotLeaveAttempt}
              onChange={(event) => {
                const value = event.target.value;
                setGroup(value);
                setLineId(defaultLine(value).id);
                setLearnPly(0);
                setMode("overview");
                setSession(null);
                setShapes([]);
                setHint("");
              }}
            >
              {openingGroups
                .filter(
                  (g) =>
                    g.side === side && allLines.some((l) => l.group === g.id),
                )
                .map((g) => {
                  const scoped = drillRepertoire(
                    groupRepertoires.get(g.id)!,
                    side,
                    log,
                    repertoire,
                  );
                  const count = scoped
                    .cards(side)
                    .filter((c) => dueIds.includes(c.id)).length;
                  return (
                    <option key={g.id} value={g.id}>
                      {g.name} ({count} due)
                    </option>
                  );
                })}
            </select>
          </label>
          <label>
            Line{" "}
            <select
              aria-label="Opening line"
              value={line.id}
              disabled={cannotLeaveAttempt}
              onChange={(event) => {
                setLineId(event.target.value);
                setLearnPly(0);
                setShapes([]);
                setHint("");
                setSession(null);
                setMode("overview");
              }}
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} &middot;{" "}
                  {activeIds.has(l.id)
                    ? lineStage(repertoire, side, l.id, log)
                    : `Locked - next ${cohortState.locked.findIndex((e) => e.line.id === l.id) + 1}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        {locked && (
          <p className="lesson-status" aria-label="Line locked">
            Locked - next{" "}
            {cohortState.locked.findIndex((e) => e.line.id === line.id) + 1}.
            Use Unlock next line to expand your cohort.
          </p>
        )}
        <div className="opening-help">
          {!locked && (
            <InfoTip label="Why this line?">
              <span aria-label="Line priority">
                {cohortState.active.find((e) => e.line.id === line.id)?.reason}.
              </span>
            </InfoTip>
          )}
          {!practicing && (
            <details className="opening-plan">
              <summary>Line idea</summary>
              <p className="lesson-idea">{line.summary}</p>
              {puzzleOpeningGroups.some((g) => g.id === group) &&
                !cannotLeaveAttempt && (
                  <p>
                    <a href={`#puzzles?opening=${group}`}>
                      Practice opening puzzles
                    </a>
                  </p>
                )}
            </details>
          )}
          <InfoTip label="About opening progress">
            {reviewCount} attempts saved in this browser.
          </InfoTip>
        </div>
        <p className="lesson-status" aria-label="Line stage">
          Stage:{" "}
          <span className="pill">
            {stage === "learn"
              ? "Learn"
              : stage === "practice"
                ? "Practice"
                : "Drill"}
          </span>
        </p>
        {mode === "overview" && <div className="opening-tabs opening-action-buttons">
          <button
            disabled={!store || locked || cannotLeaveAttempt}
            onClick={() => {
              setMode("learn");
              setShapes([]);
            }}
          >
            Learn
          </button>
          <button
            disabled={!store || cannotLeaveAttempt || dueCount === 0}
            onClick={() => void startDrill()}
          >
            Drill due cards
          </button>
          <button
            disabled={
              !store || locked || cannotLeaveAttempt || lineDueCount === 0
            }
            onClick={() => void startDrill(false, true)}
          >
            Drill this line
          </button>
          <button
            disabled={
              !store || locked || cannotLeaveAttempt || stage === "learn"
            }
            onClick={() => void startDrill(true)}
          >
            Practice whole line
          </button>
        </div>}
      </TrainingOptions>
      {error && (
        <p role="alert">
          {error}{" "}
          {session?.feedback && (
            <button disabled={busy} onClick={() => void retrySave()}>
              Save attempt
            </button>
          )}
        </p>
      )}
      {mode === "learn" && (
        <div className="lesson-toolbar" role="group" aria-label="Lesson navigation">
          <div className="lesson-toolbar-actions">
            <span className="lesson-position">Move {learnPly} / {line.moves.length}</span>
            <button
              aria-label="Previous opening move"
              disabled={!learnPly}
              onClick={() => navigateLearn(learnPly - 1)}
            >Previous</button>
            <button
              className={learnPly < line.moves.length ? "primary" : undefined}
              aria-label="Next opening move"
              disabled={learnPly === line.moves.length}
              onClick={() => navigateLearn(learnPly + 1)}
            >Next move</button>
            {learnPly === line.moves.length && (
              <button
                className="primary"
                disabled={!store || busy}
                onClick={() => void completeLearn()}
              >Complete lesson</button>
            )}
          </div>
          <p className="current-lesson-idea" aria-live="polite" aria-atomic="true">
            {learnEdge?.comment ?? "Use Next move to see the move and its purpose."}
          </p>
        </div>
      )}
      {mode === "overview" ? (
        <section className="opening-intro">
          <h2>{line.name}</h2>
          <MiniBoard
            fen={(() => {
              const g = new Game(line.startFen);
              if (g.turn !== side && line.moves[0]) g.play(line.moves[0]);
              return g.fen;
            })()}
            orientation={side}
          />
        </section>
      ) : (
        <div className="play-layout">
          <section className="board-column" aria-label="Opening board">
            <Board
              position={displayGame.fen}
              orientation={side}
              movableSide={side}
              legalDests={game.destinations()}
              shapes={shapes}
              ideaShapes={
                mode === "learn"
                  ? learnEdge?.arrows.map((arrow) => ({
                      orig: arrow.from as Key,
                      dest: arrow.to as Key,
                      brush: { G: "green", R: "red", B: "blue", Y: "yellow" }[
                        arrow.color
                      ],
                    }))
                  : []
              }
              lastMove={game.lastMove}
              locked={
                !store ||
                mode === "learn" ||
                (session?.phase !== "move" &&
                  !(
                    session?.phase === "feedback" && !session.feedback?.correct
                  )) ||
                Boolean(safety) ||
                busy ||
                Boolean(error)
              }
              check={displayGame.check}
              turn={displayGame.turn}
              coordinates={settings.coordinates}
              animationMs={settings.reducedMotion ? 0 : settings.animationMs}
              onMoveIntent={(from, to) => {
                if (settings.safetyCheck && session?.context !== "practice") {
                  setSafety({ uci: from + to });
                } else void saveAttempt(from, to);
              }}
              onShapesChange={setShapes}
            />
          </section>
          <aside
            className="game-panel opening-panel"
            aria-label="Opening lesson"
          >
            <div className="panel-heading">
              <h2>{mode === "learn" ? "Learn the line" : practicing ? "Practice the line" : "Review due moves"}</h2>
              <span className="pill">{game.turn.toUpperCase()} TO MOVE</span>
            </div>
            {safety && (
              <section className="safety-check" aria-label="Safety Check">
                <h3>Is my move safe?</h3>
                <p>What does the opponent threaten?</p>
                <p className="muted">
                  Take a moment to scan checks, captures and hanging pieces.
                  This is ungraded.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    const uci = safety.uci;
                    setSafety(null);
                    if (uci) void saveAttempt(uci.slice(0, 2), uci.slice(2, 4));
                  }}
                >
                  Continue
                </button>
                <button
                  onClick={() => {
                    setSafety(null);
                    setShapes([]);
                    redraw();
                  }}
                >
                  Take back
                </button>
              </section>
            )}
            {mode === "learn" ? (
              <>
                <p className="lesson-status">
                  {side === "white" ? "White" : "Black"} move{" "}
                  {side === "white"
                    ? Math.ceil(learnPly / 2)
                    : Math.floor(learnPly / 2)}{" "}
                  /{" "}
                  {side === "white"
                    ? Math.ceil(line.moves.length / 2)
                    : Math.floor(line.moves.length / 2)}{" "}
                  | Ply {learnPly} / {line.moves.length}
                </p>
                <h3>
                  {learnPly
                    ? `${Math.ceil(learnPly / 2)}${learnPly % 2 ? "." : "..."} ${learnGame.notation.at(-1)?.san}`
                    : "Start with the center"}
                </h3>
                {Boolean(learnEdge?.ruleIds.length) && (
                  <p className="rule-tags">
                    Principles: {learnEdge?.ruleIds.join(", ")}
                  </p>
                )}
                <button onClick={() => navigateLearn(0)}>Restart lesson</button>
                <ol className="opening-moves">
                  {line.moves.map((uci, i) => {
                    const replay = new Game(line.startFen);
                    line.moves.slice(0, i).forEach((m) => replay.play(m));
                    return (
                      <li key={i}>
                        <button
                          aria-current={learnPly === i + 1 ? "step" : undefined}
                          onClick={() => navigateLearn(i + 1)}
                        >
                          {Math.floor(i / 2) + 1}
                          {i % 2 ? "..." : "."} {replay.toSan(uci)}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              session && (
                <>
                  <p className="lesson-status" role="status">
                    {session.phase === "complete" && (
                      <svg
                        className="session-complete-mark"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="m7 12 3 3 7-7" />
                      </svg>
                    )}
                    {session.phase === "prelude" || session.phase === "reply"
                      ? session.phase === "reply"
                        ? "Playing a reply... Input is locked."
                        : "Playing the prelude… Input is locked."
                      : session.phase === "complete"
                        ? "Session complete"
                        : session.phase === "move"
                          ? `Your move - ${side === "white" ? "White" : "Black"}`
                          : feedback?.correct
                            ? "Correct"
                            : "Try again"}
                  </p>
                  <p>
                    Card {Math.min(session.index + 1, session.cards.length)} /{" "}
                    {session.cards.length}
                  </p>
                  {feedback && (
                    <div className="lesson-feedback">
                      <h3>
                        {feedback.correct
                          ? "Well played"
                          : `Play ${new Game(repertoire.fen(session.card.side, session.card.positionKey)).toSan(feedback.solution)}`}
                      </h3>
                      {(!practicing || !feedback.correct) && (
                        <p>{feedback.idea}</p>
                      )}
                      {(!practicing || !feedback.correct) &&
                        feedback.ruleIds.length > 0 && (
                          <p className="rule-tags">
                            Principles: {feedback.ruleIds.join(", ")}
                          </p>
                        )}
                      <small>
                        {busy
                          ? "Saving…"
                          : feedback.saved
                            ? `Recorded: ${feedback.review.grade}`
                            : practicing
                              ? "Move recalled. Continue the line."
                              : "Clean move - choose Good or Easy."}
                      </small>
                      {feedback.correct ? (
                        <>
                          <button
                            disabled={
                              busy ||
                              Boolean(error) ||
                              session.phase === "reply"
                            }
                            className="primary"
                            onClick={() => void finishCard()}
                          >
                            Next card
                          </button>
                          {!practicing &&
                            feedback.review.grade === "good" &&
                            !feedback.saved && (
                              <button
                                disabled={
                                  busy ||
                                  Boolean(error) ||
                                  session.phase === "reply"
                                }
                                onClick={() => void finishCard(true)}
                              >
                                Easy
                              </button>
                            )}
                        </>
                      ) : (
                        <p>Try the correct move directly on the board.</p>
                      )}
                    </div>
                  )}
                  {!practicing && session.phase === "move" && (
                    <button
                      disabled={session.hintsUsed >= 2}
                      onClick={() => {
                        setHint(session.hint());
                        redraw();
                      }}
                    >
                      Hint {Math.min(2, session.hintsUsed + 1)} / 2
                    </button>
                  )}
                  {hint && <p className="lesson-idea">{hint}</p>}
                  {session.phase === "complete" && (
                    <p>
                      {session.summary.attempts} attempts |{" "}
                      {session.summary.correct} correct |{" "}
                      {session.summary.again} to revisit
                    </p>
                  )}
                  {session.phase === "complete" && (
                    <p className="lesson-idea">
                      {session.cards.length
                        ? practicing
                          ? stage === "drill"
                            ? "Practice complete. This line is ready for spaced reviews."
                            : "Your attempts are saved. Try a clean run to unlock Drill."
                          : "Reviews saved. Return Home for your next exercise."
                        : "Nothing due right now. You can still practice the whole line."}
                    </p>
                  )}
                  {session.phase === "complete" && (
                    <p><a href="#home">Back to your plan</a></p>
                  )}
                  <button
                    disabled={cannotLeaveAttempt}
                    onClick={() => {
                      session.reset();
                      setHint("");
                      setShapes([]);
                      redraw();
                    }}
                  >
                    {practicing ? "Restart practice" : "Reset drill"}
                  </button>
                </>
              )
            )}
          </aside>
        </div>
      )}
      <details className="opening-progress">
        <summary>Your progress &middot; cohort and coverage</summary>
        <p className="lesson-status">
          Shared positions count in each matching opening; one review updates
          them all.
        </p>
        <section className="cohort-summary" aria-label="Active cohort">
          <div>
            <strong>
              {cohortState.active.length} active {side} lines
            </strong>{" "}
            Starting target {settings.activeLines ?? 6}
          </div>
          <p>
            Weakest lines first: most lapses, then lowest ease. Progress stays
            unlocked.
          </p>
          <p>Next up: {nextLocked?.line.name ?? "All lines unlocked"}</p>
          <button
            disabled={!store || cannotLeaveAttempt || !nextLocked}
            onClick={() => void unlockNext()}
          >
            Unlock next line
          </button>
          <p className="muted">
            A stable cohort unlocks the next line automatically: every card at
            least 3 days, with no lapse in the last 7 days.
          </p>
        </section>
        <section className="coverage-grid" aria-label="Opening coverage">
          {openingGroups
            .filter((g) => g.side === side)
            .map((g) => (
              <article
                key={g.id}
                className="coverage-card"
                aria-label={`${g.name} coverage`}
              >
                <strong>
                  {g.name} &middot; {side}
                </strong>
                <CoverageBar {...coverageByScope.get(g.id)!} />
                <p>{coverageText(coverageByScope.get(g.id)!)}</p>
              </article>
            ))}
        </section>
        <details className="line-list">
          <summary>Lines &middot; {lines.length} in this opening</summary>
          <ol>
            {lines.map((l) => {
              const entry = [...cohortState.active, ...cohortState.locked].find(
                (e) => e.line.id === l.id,
              )!;
              const active = activeIds.has(l.id);
              return (
                <li key={l.id} aria-label={l.name}>
                  <button
                    disabled={cannotLeaveAttempt}
                    aria-current={line.id === l.id ? "true" : undefined}
                    onClick={() => {
                      setLineId(l.id);
                      setMode("overview");
                      setLearnPly(0);
                      setSession(null);
                      setShapes([]);
                      setHint("");
                    }}
                  >
                    {l.name}
                  </button>
                  <span>
                    {active
                      ? entry.reason
                      : `Locked - next ${cohortState.locked.findIndex((e) => e.line.id === l.id) + 1} - ${l.main ? "Main line" : "Reply weight order"}`}
                  </span>
                  <small>{coverageText(coverageByScope.get(l.id)!)}</small>
                </li>
              );
            })}
          </ol>
        </details>
      </details>
    </>
  );
}
