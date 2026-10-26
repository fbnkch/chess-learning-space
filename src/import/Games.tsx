import { MiniBoard } from "../MiniBoard";
import { InfoTip } from "../InfoTip";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { Board } from "../board/Board";
import { Game } from "../game/Game";
import type { Settings } from "../settings";
import type { Progress } from "../progress/Progress";
import { repertoire } from "../repertoire/bundled";
import {
  importChessCom,
  importPgn,
  type ImportedGame,
  type ImportResult,
} from "./Import";
import "./games.css";
import { PersonalTraining } from "../review/MistakePractice";
import { ReviewPage } from "../review/ReviewPage";
import { cachedReview } from "../review/browserReview";

const lines = {
  white: repertoire.lineMeta("white"),
  black: repertoire.lineMeta("black"),
};
export function Games({
  store,
  settings,
}: {
  store: Progress | null;
  settings: Settings;
}) {
  const [training, setTraining] = useState(
    () =>
      new URLSearchParams(location.hash.split("?")[1]).get("mistakes") === "1",
  );
  const currentRun = useRef<AbortController | null>(null);
  const [games, setGames] = useState<ImportedGame[]>([]);
  const [selection, setSelection] = useState<ImportedGame | null>(null);
  const [reviewing, setReviewing] = useState<ImportedGame | null>(null);
  const [mode, setMode] = useState("last");
  const [last, setLast] = useState(10);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pgn, setPgn] = useState("");
  const pgnInput = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<ImportResult["errors"]>([]);
  // Parsing an entire PGN library must not run on every textarea keystroke.
  const reviewed = useMemo(
    () =>
      new Set(
        reviewing
          ? []
          : games
              .filter((g) => cachedReview(Game.fromPgn(g.pgn)))
              .map((g) => g.id),
      ),
    [games, reviewing],
  );
  useEffect(() => {
    let active = true;
    if (store)
      void store
        .games()
        .then((value) => {
          if (active) setGames(value);
        })
        .catch(() => {
          if (active) setError("Could not load your games. Please reload.");
        });
    return () => {
      active = false;
      currentRun.current?.abort();
    };
  }, [store]);
  async function run(parse: (signal: AbortSignal) => Promise<ImportResult>) {
    if (!store) return;
    currentRun.current?.abort();
    const controller = new AbortController();
    currentRun.current = controller;
    const { signal } = controller;
    setBusy(true);
    setError("");
    setMessage("");
    setErrors([]);
    try {
      const result = await parse(signal);
      signal.throwIfAborted();
      const added = await store.importGames(result.games, signal);
      const saved = await store.games();
      signal.throwIfAborted();
      setGames(saved);
      setErrors(result.errors);
      setMessage(
        `${added} games imported. ${result.duplicates + result.games.length - added} duplicates skipped. ${result.skipped} ongoing or variant games skipped.`,
      );
    } catch (e) {
      if (signal.aborted) return;
      setError(
        e instanceof Error ? e.message : "Import failed. Please try again.",
      );
    } finally {
      if (currentRun.current === controller && !signal.aborted) setBusy(false);
    }
  }
  const finalPositions = useMemo(
    () => new Map(games.map((g) => [g.id, Game.fromPgn(g.pgn).fen])),
    [games],
  );
  const sorted = [...games].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  if (training)
    return (
      <PersonalTraining
        store={store}
        settings={settings}
        onClose={() => setTraining(false)}
      />
    );
  if (reviewing)
    return (
      <ReviewPage
        key={reviewing.id}
        record={reviewing}
        store={store}
        settings={settings}
        onClose={() => setReviewing(null)}
      />
    );
  return (
    <section className="games-page">
      <button onClick={() => setTraining(true)}>Train personal mistakes</button>
      <header className="page-header">
        <div>
          <h1>Games</h1>
        </div>
        <span className="pill">{games.length} SAVED</span>
      </header>
      <div className="game-imports">
        <form
          className="import-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run((signal) =>
              importChessCom(
                settings.chessComUsername ?? "fbnkch",
                mode === "last" ? { last } : { month },
                { fetch: window.fetch.bind(window), lines, signal },
              ),
            );
          }}
        >
          <h2>Import from Chess.com</h2>
          <InfoTip label="About Chess.com imports">
            Import public games for {settings.chessComUsername ?? "fbnkch"};
            change the username in Settings.
          </InfoTip>
          <label>
            Import range
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="last">Last N games</option>
              <option value="month">A month</option>
            </select>
          </label>
          {mode === "last" ? (
            <label>
              Number of games
              <input
                type="number"
                min={1}
                max={1000}
                required
                value={last}
                onChange={(e) => setLast(Number(e.target.value))}
              />
            </label>
          ) : (
            <label>
              Month
              <input
                type="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
          )}
          <button className="primary" disabled={!store || busy}>
            Import games
          </button>
        </form>
        <form
          className="import-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run((signal) =>
              importPgn(
                pgn,
                settings.chessComUsername ?? "fbnkch",
                lines,
                signal,
              ),
            );
          }}
        >
          <h2>Paste PGN</h2>
          <label>
            One or more games
            <textarea
              ref={pgnInput}
              rows={4}
              maxLength={50 * 1024 * 1024}
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={'[Event "My game"]\n1. e4 e5 …'}
              spellCheck={false}
            />
          </label>
          <button disabled={!store || busy || !pgn.trim()}>Import PGN</button>
        </form>
      </div>
      <div aria-live="polite">
        {busy && (
          <p role="status">
            Importing games… Chess.com requests run one at a time.
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
      {error && <p role="alert">{error}</p>}
      {errors.length > 0 && (
        <div role="alert">
          <p>Some games could not be imported:</p>
          <ul>
            {errors.map((e) => (
              <li key={e.game}>
                Game {e.game}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {selection && (
        <GameViewer
          key={selection.id}
          record={selection}
          settings={settings}
          onClose={() => setSelection(null)}
        />
      )}
      <section className="games-library" aria-label="Saved games">
        <h2>
          Games <span className="muted">{games.length}</span>
        </h2>
        {games.length === 0 ? (
          <div className="empty-games">
            <p>Import a game to review it.</p>
            <button onClick={() => pgnInput.current?.focus()}>
              Paste a game
            </button>
          </div>
        ) : (
          <div className="games-table">
            <table>
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Players / opening</th>
                  <th>Date</th>
                  <th>Your color</th>
                  <th>Time control</th>
                  <th>Review</th>
                  <th>
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.result}</strong>
                    </td>
                    <td>
                      <strong>
                        {g.white} vs {g.black}
                      </strong>
                      <small>{g.opening}</small>
                    </td>
                    <td>
                      <MiniBoard
                        fen={finalPositions.get(g.id)!}
                        orientation={g.colour ?? "white"}
                      />
                      {g.date}
                    </td>
                    <td>{g.colour ?? "Unknown"}</td>
                    <td>{g.timeControl}</td>
                    <td>
                      <span className="pill">
                        {reviewed.has(g.id) ? "Reviewed" : "Not reviewed"}
                      </span>
                      <button
                        aria-label={`Review game ${g.white} vs ${g.black} on ${g.date}`}
                        onClick={() => setReviewing(g)}
                      >
                        Review
                      </button>
                    </td>
                    <td>
                      <button
                        aria-label={`Open game ${g.white} vs ${g.black} on ${g.date}`}
                        onClick={() => setSelection(g)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
function GameViewer({
  record,
  settings,
  onClose,
}: {
  record: ImportedGame;
  settings: Settings;
  onClose: () => void;
}) {
  const [game] = useState(() => {
    const g = Game.fromPgn(record.pgn);
    g.goTo(0);
    return g;
  });
  const [ply, setPly] = useState(0);
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const notation = game.notation;
  function navigate(target: number) {
    game.goTo(Math.max(0, Math.min(game.moves.length, target)));
    setPly(game.ply);
    setShapes([]);
  }
  return (
    <section
      className="game-viewer"
      aria-label="Game viewer"
      onKeyDown={(e) => {
        if (
          document.querySelector("dialog[open]") ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey
        )
          return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          navigate(ply + (e.key === "ArrowLeft" ? -1 : 1));
        }
      }}
      tabIndex={0}
    >
      <div className="panel-heading">
        <h2>
          {record.white} vs {record.black}
        </h2>
        <button onClick={onClose}>Close viewer</button>
      </div>
      <div className="play-layout">
        <div className="board-column">
          <Board
            position={game.fen}
            orientation={record.colour ?? "white"}
            movableSide={undefined}
            legalDests={new Map()}
            shapes={shapes}
            lastMove={game.lastMove}
            locked
            check={game.check}
            turn={game.turn}
            coordinates={settings.coordinates}
            animationMs={settings.reducedMotion ? 0 : settings.animationMs}
            onMoveIntent={() => {}}
            onShapesChange={setShapes}
          />
        </div>
        <aside className="game-panel">
          <div className="panel-heading">
            <h3>Moves</h3>
            <span className="pill">{record.result}</span>
          </div>
          <div className="move-list" aria-label="Game move list">
            <ol>
              {notation.map((move, i) => (
                <li
                  className={move.color === "w" ? "white-move" : "black-move"}
                  key={i}
                >
                  {(move.color === "w" || i === 0) && (
                    <span className="move-number">
                      {move.before.split(" ")[5]}
                      {move.color === "w" ? "." : "…"}
                    </span>
                  )}
                  <button
                    aria-current={ply === i + 1 ? "step" : undefined}
                    onClick={() => navigate(i + 1)}
                  >
                    {move.san}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="history-controls">
            <button
              aria-label="First position"
              disabled={ply === 0}
              onClick={() => navigate(0)}
            >
              ⇤
            </button>
            <button
              aria-label="Previous move"
              disabled={ply === 0}
              onClick={() => navigate(ply - 1)}
            >
              ‹
            </button>
            <span aria-live="polite">
              {ply} / {notation.length}
            </span>
            <button
              aria-label="Next move"
              disabled={ply === notation.length}
              onClick={() => navigate(ply + 1)}
            >
              ›
            </button>
            <button
              aria-label="Last position"
              disabled={ply === notation.length}
              onClick={() => navigate(notation.length)}
            >
              ⇥
            </button>
          </div>
          <p className="board-tips">
            {record.opening} · {record.timeControl}
            <br />
            Use the move buttons or left / right arrow keys inside this viewer.
          </p>
        </aside>
      </div>
    </section>
  );
}
