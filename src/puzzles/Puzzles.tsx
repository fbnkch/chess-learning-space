import { MiniBoard } from "../MiniBoard";
import { InfoTip } from "../InfoTip";
import { TrainingOptions } from "../TrainingOptions";
import { useEffect, useReducer, useState, useRef } from "react";
import { ulid } from "ulid";
import type { PuzzleTraining } from "./PuzzleTraining";
import type { Review } from "../scheduler/Scheduler";
import { initialRating } from "./rating";
import {
  duePuzzles,
  puzzleReview,
  woodpeckerProgress,
  type PuzzleMode,
  type WoodpeckerSet,
} from "./training";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { Board } from "../board/Board";
import type { Square } from "../game/Game";
import { PromotionPicker } from "../PromotionPicker";
import type { Settings } from "../settings";
import { playSound } from "../sound";
import { PuzzleSession } from "./PuzzleSession";
import {
  loadManifest,
  loadPuzzles,
  loadOpeningPuzzles,
  motifLabel,
} from "./data";
import type { Motif, PuzzleManifest, PuzzleRow } from "./types";
import {
  openingFilter,
  puzzleOpenings,
  puzzleOpeningGroups,
  type OpeningFilter,
} from "./openings";
import "./puzzles.css";

function Exercise({
  puzzle,
  settings,
  onNext,
  onRecord,
  createReview,
  ready,
}: {
  puzzle: PuzzleRow;
  settings: Settings;
  onNext: () => void;
  onRecord: (review: Review) => Promise<void>;
  createReview: (session: PuzzleSession, durationMs: number) => Review;
  ready: boolean;
}) {
  const [session] = useState(() => new PuzzleSession(puzzle));
  const [startedAt] = useState(Date.now);
  const [hint, setHint] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saving = useRef(false);
  const completedReview = useRef<Review | null>(null);
  const [, refresh] = useReducer((n) => n + 1, 0);
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [animating, setAnimating] = useState(false);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const game = session.game;
  const phase = session.phase;
  const automatic = ["setup", "reply", "replay"].includes(phase);
  useEffect(() => {
    if (!automatic || animating) return;
    const timer = setTimeout(
      () => {
        session.advance();
        setAnimating(true);
        setShapes([]);
        setHint("");
        if (settings.sound) playSound(session.game.check ? "check" : "move");
        refresh();
      },
      Math.max(250, settings.reducedMotion ? 0 : settings.animationMs) + 150,
    );
    return () => clearTimeout(timer);
  }, [
    session,
    phase,
    game.ply,
    automatic,
    animating,
    settings.animationMs,
    settings.reducedMotion,
    settings.sound,
  ]);
  useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(
      () => setAnimating(false),
      settings.reducedMotion ? 0 : settings.animationMs,
    );
    return () => clearTimeout(timer);
  }, [animating, settings.animationMs, settings.reducedMotion]);
  function submit(uci: string) {
    session.submit(uci);
    if (session.phase === "solved" || session.phase === "failed") void save();
    setPromotion(null);
    setShapes([]);
    setHint("");
    if (settings.sound) playSound(session.game.check ? "check" : "move");
    refresh();
  }
  const finished = ["failed", "solved", "reviewed"].includes(phase);
  async function save() {
    if (saved || saving.current || !ready) return;
    saving.current = true;
    completedReview.current ??= createReview(
      session,
      Math.max(0, Date.now() - startedAt),
    );
    try {
      await onRecord(completedReview.current);
      setSaved(true);
      setSaveError("");
    } catch {
      setSaveError("Could not save this attempt. Retry before continuing.");
    } finally {
      saving.current = false;
    }
  }
  const message =
    phase === "setup"
      ? "Watch the opponent’s move."
      : animating && phase === "solving"
        ? "Opponent’s reply…"
        : phase === "solving"
          ? `${session.side === "white" ? "White" : "Black"} to move. Find the best continuation.`
          : phase === "reply"
            ? "Opponent’s reply…"
            : phase === "solved"
              ? "Puzzle solved."
              : phase === "failed"
                ? "Attempt failed. Study the solution, then replay it."
                : phase === "replay"
                  ? "Replaying the solution…"
                  : "Solution complete.";
  return (
    <div className="play-layout puzzle-layout">
      <section className="board-column" aria-label="Puzzle board">
        <div className="player">
          <strong>{session.side === "white" ? "Black" : "White"}</strong>
          <small>Opponent</small>
        </div>
        <Board
          position={game.fen}
          orientation={session.side}
          movableSide={session.side}
          legalDests={game.destinations()}
          shapes={shapes}
          lastMove={game.lastMove}
          locked={!ready || phase !== "solving" || animating || !!promotion}
          check={game.check}
          turn={game.turn}
          coordinates={settings.coordinates}
          animationMs={settings.reducedMotion ? 0 : settings.animationMs}
          onShapesChange={setShapes}
          onMoveIntent={(from, to) => {
            if (phase !== "solving" || animating) return;
            if (game.promotions(from as Square, to as Square).length)
              setPromotion({ from: from as Square, to: to as Square });
            else submit(from + to);
          }}
        />
        <div className="player">
          <strong>{session.side === "white" ? "White" : "Black"}</strong>
          <small>You · Solver</small>
        </div>
      </section>
      <aside className="game-panel puzzle-panel" aria-label="Puzzle controls">
        <div className="panel-heading">
          <h2>Find the continuation</h2>
          <span className="pill">{puzzle[3]}</span>
        </div>
        <div className="puzzle-content">
          <p role="status">{message}</p>
          <p className="exercise-instruction">
            Calculate the full line before moving.
          </p>
          {phase === "setup" && (
            <MiniBoard
              fen={game.fen}
              orientation={session.side}
              lastMove={game.lastMove}
            />
          )}
          <button
            disabled={
              !ready ||
              phase !== "solving" ||
              animating ||
              session.hintStep >= 2
            }
            onClick={() => {
              setHint(session.hint() ?? "");
              void save();
              refresh();
            }}
          >
            Hint {Math.min(2, session.hintStep + 1)} / 2
          </button>
          {hint && (
            <p className="puzzle-hint" aria-label="Puzzle hint">
              {hint}
            </p>
          )}
          {session.hintsUsed > 0 && (
            <small>Hint used: failure for rating and spaced repetition</small>
          )}
          {saved && <small role="status">Attempt saved</small>}
          {saved && finished && <a className="training-return" href="#home">Back to your plan</a>}
          {saveError && (
            <p role="alert">
              {saveError}{" "}
              <button onClick={() => void save()}>Retry save</button>
            </p>
          )}
          {finished && (
            <>
              <h3>Solution</h3>
              <p aria-label="Puzzle solution">
                {session.solution().slice(1).join(" · ")}
              </p>
              <button
                onClick={() => {
                  session.replay();
                  setShapes([]);
                  setHint("");
                  refresh();
                }}
              >
                Replay solution
              </button>
            </>
          )}
          <button
            className="primary"
            disabled={!ready || ((finished || session.hintsUsed > 0) && !saved)}
            onClick={onNext}
          >
            Next puzzle
          </button>
          <a href="#rules">Golden rule: checks, captures, threats</a>
          <small>Puzzle {puzzle[0]} · Lichess / CC0</small>
        </div>
      </aside>
      {promotion && (
        <PromotionPicker
          color={session.side}
          onPick={(piece) => submit(promotion.from + promotion.to + piece)}
          onCancel={() => {
            setPromotion(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
export function Puzzles({
  settings,
  training,
  onReview,
}: {
  settings: Settings;
  training: PuzzleTraining | null;
  onReview: () => Promise<void>;
}) {
  const [manifest, setManifest] = useState<PuzzleManifest | null>(null);
  const [opening, setOpening] = useState<OpeningFilter>(() =>
    openingFilter(
      new URLSearchParams(location.hash.split("?")[1]).get("opening"),
    ),
  );
  const [motif, setMotif] = useState<Motif>("fork");
  const [openingMotif, setOpeningMotif] = useState<Motif | "all">("all");
  const [min, setMin] = useState(600);
  const [max, setMax] = useState(1700);
  const [rows, setRows] = useState<PuzzleRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<PuzzleMode>(() => {
    const mode = new URLSearchParams(location.hash.split("?")[1]).get("mode");
    return mode === "due" || mode === "woodpecker" ? mode : "rated";
  });
  const [rating, setRating] = useState(initialRating);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sets, setSets] = useState<WoodpeckerSet[]>([]);
  const [setId, setSetId] = useState("");
  const [size, setSize] = useState(10);
  const [sessionId, setSessionId] = useState(ulid);
  const [now, setNow] = useState(Date.now);
  const [attemptId, setAttemptId] = useState(ulid);
  const [woodIndex, setWoodIndex] = useState(0);
  const [woodCycle, setWoodCycle] = useState(1);
  const [dueQueue, setDueQueue] = useState<string[]>([]);
  const activeSet = sets.find((s) => s.id === setId);
  const due = duePuzzles(reviews, now);
  const progress = activeSet ? woodpeckerProgress(activeSet, reviews) : null;
  useEffect(() => {
    if (!training) return;
    let active = true;
    void training
      .snapshot()
      .then(({ rating, reviews: log, sets }) => {
        if (!active) return;
        setRating(rating);
        setReviews(log);
        setSets(sets);
        if (
          new URLSearchParams(location.hash.split("?")[1]).get("mode") === "due"
        )
          setDueQueue(
            duePuzzles(log, Date.now()).map((card) => card.id.slice(7)),
          );
        if (sets.length) {
          const requested = new URLSearchParams(
            location.hash.split("?")[1],
          ).get("set");
          const set = sets.find((s) => s.id === requested) ?? sets[0],
            progress = woodpeckerProgress(set, log);
          setSetId(set.id);
          setWoodIndex(progress.index);
          setWoodCycle(progress.cycle);
        }
      })
      .catch(() => {
        if (active)
          setError("Could not read puzzle progress. Reload to retry.");
      });
    return () => {
      active = false;
    };
  }, [training]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadManifest(controller.signal)
      .then(setManifest)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);
  // Rated mode fetches one motif; Due resolves only the IDs needed by its queue.
  const dueIds = dueQueue.join(",");
  const bucket = mode === "woodpecker" && activeSet ? activeSet.motif : motif;
  useEffect(() => {
    if (!manifest) return;
    const controller = new AbortController();
    const load = async () => {
      if (mode === "rated" && opening !== "all")
        return loadOpeningPuzzles(controller.signal);
      if (mode !== "due")
        return loadPuzzles(manifest, bucket, controller.signal);
      const wanted = new Set(dueIds.split(",").filter(Boolean));
      const found: PuzzleRow[] = [];
      for (const chunk of manifest.chunks) {
        if (!wanted.size) break;
        const rows = await loadPuzzles(
          manifest,
          chunk.motif,
          controller.signal,
        );
        for (const row of rows) if (wanted.delete(row[0])) found.push(row);
      }
      return found;
    };
    void load()
      .then((rows) => {
        if (!controller.signal.aborted) setRows(rows);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [manifest, bucket, retry, mode, dueIds, opening]);
  const filtered = rows?.filter((row) => {
    if (row[3] < min || row[3] > max) return false;
    if (mode !== "rated" || opening === "all") return true;
    const groups = puzzleOpenings(row[9]);
    return (
      (opening === "repertoire"
        ? groups.length > 0
        : groups.includes(opening)) &&
      (openingMotif === "all" || row[7].split(" ").includes(openingMotif))
    );
  });
  const puzzle =
    mode === "woodpecker" && activeSet
      ? rows?.find((row) => row[0] === activeSet.puzzleIds[woodIndex])
      : mode === "due"
        ? rows?.[index % rows.length]
        : filtered?.[index % filtered.length];
  function restart() {
    setIndex(0);
    setSessionId(ulid());
    setAttemptId(ulid());
    setError("");
  }
  async function createSet() {
    if (!training || !manifest) return;
    try {
      const motifRows = await loadPuzzles(manifest, motif);
      const candidates = motifRows.filter(
        (row) => row[3] >= min && row[3] <= max,
      );
      if (!candidates.length) {
        setError("No puzzles in this rating range. Try widening the range.");
        return;
      }
      const set: WoodpeckerSet = {
        id: ulid(),
        puzzleIds: candidates
          .slice(0, Math.max(1, Math.min(1000, size)))
          .map((row) => row[0]),
        motif,
        createdAt: Date.now(),
      };
      await training.saveSet(set);
      setRows(motifRows);
      setSets((sets) => [...sets, set]);
      setSetId(set.id);
      setWoodIndex(0);
      setWoodCycle(1);
      restart();
    } catch {
      setError("Could not save your Woodpecker set. Please retry.");
    }
  }
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Puzzles</h1>
        </div>
        <div className="puzzle-rating" aria-label="Puzzle rating">
          <strong>{Math.round(rating.rating)}</strong>
          <span>Rating · RD {Math.round(rating.rd)}</span>
          <small>{rating.ratedAttempts} rated attempts</small>
        </div>
      </header>
      <TrainingOptions title="Puzzle options">
        <div className="opening-tabs puzzle-modes" aria-label="Puzzle modes">
          {(["rated", "due", "woodpecker"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={mode === value}
              onClick={() => {
                if (value === mode) return;
                setMode(value);
                if (value === "due") setDueQueue(due.map((c) => c.id.slice(7)));
                setRows(null);
                restart();
                if (value === "woodpecker" && progress) {
                  setWoodIndex(progress.index);
                  setWoodCycle(progress.cycle);
                }
              }}
            >
              {value === "rated"
                ? "Rated"
                : value === "due"
                  ? `Due puzzles (${due.length})`
                  : "Woodpecker"}
            </button>
          ))}
        </div>
        {mode === "rated" && (
          <div className="opening-tabs puzzle-filters">
            <label>
              Opening source{" "}
              <select
                aria-label="Puzzle opening"
                value={opening}
                onChange={(e) => {
                  setOpening(openingFilter(e.target.value));
                  setRows(null);
                  restart();
                }}
              >
                <option value="all">All puzzles</option>
                <option value="repertoire">From my openings</option>
                {puzzleOpeningGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            {opening !== "all" && (
              <p>
                From games with these Lichess opening tags. Tactics may occur
                later, for either color.
              </p>
            )}
          </div>
        )}
        {mode !== "due" && (
          <div className="opening-tabs puzzle-filters">
            <label>
              Motif{" "}
              <select
                aria-label="Puzzle motif"
                value={
                  mode === "rated" && opening !== "all" ? openingMotif : motif
                }
                onChange={(e) => {
                  if (mode === "rated" && opening !== "all")
                    setOpeningMotif(e.target.value as Motif | "all");
                  else {
                    setMotif(e.target.value as Motif);
                    if (mode === "rated" || !activeSet) setRows(null);
                  }
                  restart();
                }}
              >
                {mode === "rated" && opening !== "all" && (
                  <option value="all">All motifs</option>
                )}
                {manifest?.chunks.map((c) => (
                  <option key={c.motif} value={c.motif}>
                    {motifLabel(c.motif)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Min rating{" "}
              <input
                aria-label="Minimum puzzle rating"
                type="number"
                min="600"
                max="1700"
                step="50"
                value={min}
                onChange={(e) => {
                  setMin(+e.target.value);
                  restart();
                }}
              />
            </label>
            <label>
              Max rating{" "}
              <input
                aria-label="Maximum puzzle rating"
                type="number"
                min="600"
                max="1700"
                step="50"
                value={max}
                onChange={(e) => {
                  setMax(+e.target.value);
                  restart();
                }}
              />
            </label>
            {mode === "woodpecker" && (
              <>
                <label>
                  Set size{" "}
                  <input
                    aria-label="Woodpecker set size"
                    type="number"
                    min="1"
                    max="1000"
                    value={size}
                    onChange={(e) => setSize(+e.target.value)}
                  />
                </label>
                <button
                  disabled={
                    !training ||
                    !manifest ||
                    !Number.isInteger(size) ||
                    size < 1 ||
                    size > 1000
                  }
                  onClick={() => void createSet()}
                >
                  Create fixed set
                </button>
              </>
            )}
          </div>
        )}
        {mode === "rated" && (
          <InfoTip label="About puzzle ratings">
            Only first encounters are rated; hints count as a loss and missed
            puzzles return tomorrow at 04:00.
          </InfoTip>
        )}
        {mode === "woodpecker" && (
          <section
            className="woodpecker-summary"
            aria-label="Woodpecker progress"
          >
            <p>
              A fixed set, repeated in cycles. Aim to beat your previous time.
              Unrated; spaced repetition stays unchanged.
            </p>
            {sets.length > 0 && (
              <label>
                Fixed set{" "}
                <select
                  aria-label="Woodpecker set"
                  value={setId}
                  onChange={(e) => {
                    const set = sets.find((s) => s.id === e.target.value)!;
                    const p = woodpeckerProgress(set, reviews);
                    setSetId(set.id);
                    setWoodIndex(p.index);
                    setWoodCycle(p.cycle);
                    if (set.motif !== activeSet?.motif) setRows(null);
                    restart();
                  }}
                >
                  {sets.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      Set {i + 1} · {motifLabel(s.motif)} · {s.puzzleIds.length}{" "}
                      puzzles
                    </option>
                  ))}
                </select>
              </label>
            )}
            {activeSet && (
              <>
                <p>
                  Cycle {woodCycle} · Puzzle {woodIndex + 1} /{" "}
                  {activeSet.puzzleIds.length}
                </p>
                {progress?.cycles.map((c) => (
                  <p key={c.cycle}>
                    Cycle {c.cycle}: {(c.durationMs / 1000).toFixed(1)}s ·{" "}
                    {Math.round((100 * c.correct) / c.completed)}% accuracy
                    {c.cycle > 1
                      ? c.durationMs < progress.cycles[c.cycle - 2].durationMs
                        ? " · Faster"
                        : " · Try to beat the previous cycle"
                      : " · Your time to beat"}
                  </p>
                ))}
              </>
            )}
          </section>
        )}
      </TrainingOptions>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            Retry
          </button>
        </p>
      ) : mode === "woodpecker" && !activeSet ? (
        <p>
          Create a fixed set from the selected motif and rating range to begin.
        </p>
      ) : !rows ? (
        <p role="status">Loading puzzles…</p>
      ) : !puzzle ? (
        <p role="status">
          {mode === "due"
            ? "No due puzzles. Failed or hinted puzzles return tomorrow at 04:00. Unavailable content keeps its history."
            : opening !== "all" && mode === "rated"
              ? "No puzzles match this opening, motif and rating range. Try another motif or widen the range."
              : "No puzzles in this rating range. Try widening the range."}
        </p>
      ) : (
        <Exercise
          key={`${mode}-${puzzle[0]}-${attemptId}`}
          puzzle={puzzle}
          settings={settings}
          ready={!!training}
          createReview={(session, durationMs) => {
            const review = puzzleReview(
              puzzle,
              sessionId,
              mode,
              session.phase === "failed",
              session.hintsUsed,
              durationMs,
              Date.now(),
              mode === "woodpecker" && activeSet
                ? { setId: activeSet.id, cycle: woodCycle }
                : undefined,
            );
            return { ...review, attemptId };
          }}
          onRecord={async (review) => {
            if (!training) throw new Error("Storage unavailable");
            await training.record(review);
            const { rating, reviews: log } = await training.snapshot();
            setRating(rating);
            setReviews(log);
            await onReview();
          }}
          onNext={() => {
            if (mode === "woodpecker" && activeSet) {
              const p = woodpeckerProgress(activeSet, reviews);
              setWoodIndex(p.index);
              setWoodCycle(p.cycle);
            } else if (mode === "due") {
              const remaining = (rows ?? []).filter((row) =>
                due.some((card) => card.id === `puzzle:${row[0]}`),
              );
              // Keep loaded content: an unfinished puzzle remains due and can
              // be revisited after the other cards without triggering a reload.
              setRows(remaining);
              setIndex(remaining.findIndex((row) => row[0] === puzzle[0]) + 1);
            } else setIndex((n) => n + 1);
            setSessionId(ulid());
            setAttemptId(ulid());
          }}
        />
      )}
    </>
  );
}
