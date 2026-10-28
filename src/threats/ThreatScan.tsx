import { MiniBoard } from "../MiniBoard";
import { InfoTip } from "../InfoTip";
import { TrainingOptions } from "../TrainingOptions";
import { useEffect, useMemo, useRef, useState } from "react";
import { ulid } from "ulid";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { Board } from "../board/Board";
import { Game, type Square } from "../game/Game";
import { repertoire } from "../repertoire/bundled";
import type { Progress } from "../progress/Progress";
import type { Settings } from "../settings";
import {
  gradeScan,
  repertoirePositions,
  type Mark,
  type ScanAttempt,
  type ScanMode,
  type ScanPosition,
} from "./scan";
import "./threats.css";
import { loadManifest, loadPuzzles } from "../puzzles/data";
import { puzzleScanPositions } from "../puzzles/scanPositions";
import type { PuzzleRow } from "../puzzles/types";

function shape(mark: Mark, brush: string): DrawShape {
  return mark.kind === "arrow"
    ? { orig: mark.from, dest: mark.to, brush }
    : { orig: mark.square, brush };
}
function Exercise({
  position,
  mode,
  settings,
  store,
  sessionId,
  onSaved,
  onNext,
}: {
  position: ScanPosition;
  mode: ScanMode;
  settings: Settings;
  store: Progress | null;
  sessionId: string;
  onSaved: () => void;
  onNext: () => void;
}) {
  const [revealed, setRevealed] = useState(mode === "scan");
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [squares, setSquares] = useState<Mark[]>([]);
  const [history, setHistory] = useState<
    { shapes: DrawShape[]; squares: Mark[] }[]
  >([]);
  const [startedAt, setStartedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  const [result, setResult] = useState<ReturnType<typeof gradeScan> | null>(
    null,
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const attempt = useRef<ScanAttempt | null>(null);
  const saving = useRef(false);
  const game = new Game(revealed ? position.fen : position.before);
  const remaining = Math.max(0, 30 - Math.floor((now - startedAt) / 1000));
  useEffect(() => {
    if (mode !== "changed") return;
    const timer = window.setTimeout(() => {
      setRevealed(true);
      setStartedAt(Date.now());
      setNow(Date.now());
    }, 650);
    return () => window.clearTimeout(timer);
  }, [mode]);
  useEffect(() => {
    if (mode !== "changed" || !revealed || result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [mode, revealed, result]);
  async function save(record: ScanAttempt) {
    if (!store || saving.current) return;
    saving.current = true;
    setError("");
    try {
      await store.recordScan(record);
      setSaved(true);
      onSaved();
    } catch {
      setError("Could not save your scan. Please retry before continuing.");
    } finally {
      saving.current = false;
    }
  }
  function check() {
    if (attempt.current || !revealed || !store) return;
    const marks: Mark[] = [
      ...squares,
      ...shapes.map(
        (s): Mark =>
          s.dest
            ? { kind: "arrow", from: s.orig as Square, to: s.dest as Square }
            : { kind: "square", square: s.orig as Square },
      ),
    ];
    const grade = gradeScan(position.required, marks);
    setResult(grade);
    const record: ScanAttempt = {
      attemptId: ulid(),
      sessionId,
      at: Date.now(),
      positionKey: position.key,
      mode,
      required: position.required.length,
      found: grade.found,
      wrong: grade.wrong,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
    attempt.current = record;
    void save(record);
  }
  useEffect(() => {
    if (mode === "changed" && revealed && remaining === 0 && !result) check();
  });
  function remember() {
    setHistory((previous) => [...previous, { shapes, squares }]);
  }
  const active = revealed && !result;
  return (
    <div className="play-layout threat-layout">
      <section className="board-column" aria-label="Threat Scan board">
        <Board
          position={game.fen}
          orientation={position.side}
          turn={game.turn}
          check={game.check}
          movableSide={undefined}
          legalDests={new Map()}
          locked={!active}
          marking
          drawingEnabled={active}
          coordinates={settings.coordinates}
          animationMs={settings.reducedMotion ? 0 : settings.animationMs}
          lastMove={revealed ? position.lastMove : undefined}
          shapes={shapes}
          ideaShapes={[
            ...squares.map((mark) => shape(mark, "green")),
            ...(result?.missed.map((mark) => shape(mark, "blue")) ?? []),
          ]}
          onMoveIntent={() => {}}
          onSquareClick={(square) => {
            if (!active) return;
            remember();
            setSquares((old) =>
              old.some((m) => m.kind === "square" && m.square === square)
                ? old.filter((m) => m.kind !== "square" || m.square !== square)
                : [...old, { kind: "square", square: square as Square }],
            );
          }}
          onShapesChange={(next) => {
            if (active) {
              remember();
              setShapes(next);
            }
          }}
        />
        <div className="board-toolbar">
          <span>Orange: your marks</span>
          <span className="missed-legend">
            Mint: missed arrows / hanging squares
          </span>
        </div>
      </section>
      <aside className="game-panel threat-panel" aria-label="Scan controls">
        <div className="panel-heading">
          <h2>{mode === "changed" ? "What changed?" : "Scan both sides"}</h2>
        </div>
        <p className="lesson-status">{position.title}</p>
        {mode === "changed" && (
          <p className="scan-timer" role="timer" aria-label="Time remaining">
            {revealed ? `${remaining}s` : "Watch the opponent’s move…"}
          </p>
        )}
        <p>
          {mode === "changed"
            ? "Mark the opponent's new checks and captures, and your pieces that became hanging."
            : "Find every legal check and capture for White and Black, plus every hanging piece."}
        </p>
        <p className="exercise-instruction">
          Right-drag checks and captures, then click hanging pieces to mark
          their squares.
        </p>
        <InfoTip label="What counts as hanging?">
          A hanging piece can be captured without a legal recapture or by a
          lower-valued piece.
        </InfoTip>
        {!revealed && (
          <MiniBoard fen={game.fen} orientation={position.side} />
        )}
        <p>
          {shapes.length + squares.length} marks · {position.required.length}{" "}
          required
        </p>
        {!result ? (
          <>
            <button
              className="primary"
              disabled={!revealed || !store}
              onClick={check}
            >
              Check
            </button>
            <button
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1)!;
                setShapes(previous.shapes);
                setSquares(previous.squares);
                setHistory(history.slice(0, -1));
              }}
            >
              Undo mark
            </button>
            <button
              disabled={!shapes.length && !squares.length}
              onClick={() => {
                remember();
                setShapes([]);
                setSquares([]);
              }}
            >
              Clear marks
            </button>
          </>
        ) : (
          <section
            className="scan-result"
            aria-label="Scan result"
            role="status"
          >
            <h3>{result.pass ? "Scan passed" : "Keep scanning"}</h3>
            <p>
              Recall: {result.found}/{position.required.length} (
              {Math.round(result.recall * 100)}%) · {result.wrong} wrong
            </p>
            <p>Pass: find every required mark with at most one wrong mark.</p>
            {result.missed.length > 0 && (
              <>
                <p>Missed items are drawn in mint.</p>
                <ul>
                  {result.missed.map((mark) => (
                    <li key={JSON.stringify(mark)}>
                      {mark.kind === "arrow"
                        ? `${mark.from} → ${mark.to}`
                        : `${mark.square}: hanging piece`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p>{saved ? "Attempt saved" : "Saving…"}</p>
            <button className="primary" disabled={!saved} onClick={onNext}>
              Next
            </button>
            {saved && <a className="training-return" href="#home">Back to your plan</a>}
          </section>
        )}
        {error && (
          <p role="alert">
            {error}{" "}
            <button
              onClick={() => attempt.current && void save(attempt.current)}
            >
              Retry save
            </button>
          </p>
        )}
        <a href="#rules">Golden rule: checks, captures, threats (cct-scan)</a>
      </aside>
    </div>
  );
}
export function ThreatScan({
  settings,
  store,
}: {
  settings: Settings;
  store: Progress | null;
}) {
  const [mode, setMode] = useState<ScanMode>("scan");
  const [index, setIndex] = useState(0);
  const [sessionId] = useState(ulid);
  const [count, setCount] = useState(0);
  const [source, setSource] = useState("repertoire");
  const [puzzles, setPuzzles] = useState<PuzzleRow[]>([]);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (source !== "puzzles") return;
    const controller = new AbortController();
    void loadManifest(controller.signal)
      .then((manifest) => loadPuzzles(manifest, "fork", controller.signal))
      .then(setPuzzles)
      .catch((error: Error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      });
    return () => controller.abort();
  }, [source]);
  const positions = useMemo(
    () =>
      source === "puzzles"
        ? puzzleScanPositions(puzzles.slice(0, 64), mode)
        : repertoirePositions(repertoire, mode),
    [mode, source, puzzles],
  );
  useEffect(() => {
    let active = true;
    void store?.scans().then((scans) => {
      if (active) setCount(scans.length);
    });
    return () => {
      active = false;
    };
  }, [store]);
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Threat Scan</h1>
        </div>
        <span className="pill">
          {count} {count === 1 ? "scan" : "scans"} saved
        </span>
      </header>
      <TrainingOptions title="Scan options">
        <div className="opening-tabs">
          <label>
            Source{" "}
            <select
              aria-label="Scan source"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setIndex(0);
                setLoadError("");
              }}
            >
              <option value="repertoire">Repertoire</option>
              <option value="puzzles">Puzzles · Forks</option>
            </select>
          </label>
          <label>
            Mode{" "}
            <select
              aria-label="Scan mode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as ScanMode);
                setIndex(0);
              }}
            >
              <option value="scan">Threat Scan</option>
              <option value="changed">What changed? · 30 seconds</option>
            </select>
          </label>
          <span>
            Position {index + 1} / {positions.length}
          </span>
        </div>
      </TrainingOptions>
      {positions.length ? (
        <Exercise
          key={`${source}-${mode}-${index}`}
          mode={mode}
          position={positions[index % positions.length]}
          settings={settings}
          store={store}
          sessionId={sessionId}
          onSaved={() => setCount((n) => n + 1)}
          onNext={() => setIndex((n) => (n + 1) % positions.length)}
        />
      ) : (
        <p>
          {loadError ||
            (source === "puzzles" && !puzzles.length
              ? "Loading puzzle positions…"
              : "No suitable positions available.")}
        </p>
      )}
    </>
  );
}
