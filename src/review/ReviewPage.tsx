import { Rephrase } from "../llm/Rephrase";
import { useEffect, useRef, useState } from "react";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { Board } from "../board/Board";
import { Game, type Square } from "../game/Game";
import { PromotionPicker } from "../PromotionPicker";
import type { ImportedGame } from "../import/Import";
import type { Settings } from "../settings";
import { score, san } from "../engine/presentation";
import { analyseGame, cachedReview, releaseReview } from "./browserReview";
import { expectedPoints, type Classification } from "./classify";
import type { GameReview } from "./Review";
import "./review.css";
import type { Progress } from "../progress/Progress";
import { repertoire } from "../repertoire/bundled";
import { goldenRules } from "../rules/catalogue";
import { explain, provingLine } from "./explain";
import { repertoireDeviation } from "./deviation";
import { createMistakeCard, type PersonalCard } from "./personalCards";
import { MistakePractice } from "./MistakePractice";

const icons: Record<Classification, string> = {
  Book: "▤",
  Brilliant: "!!",
  Great: "!",
  Best: "★",
  Excellent: "✓",
  Good: "•",
  Inaccuracy: "?!",
  Mistake: "?",
  Miss: "↗",
  Blunder: "??",
};
export function ReviewPage({
  record,
  store,
  settings,
  onClose,
}: {
  record: ImportedGame;
  store: Progress | null;
  settings: Settings;
  onClose: () => void;
}) {
  const [game] = useState(() => {
    const g = Game.fromPgn(record.pgn);
    g.goTo(0);
    return g;
  });
  const [result, setResult] = useState<GameReview | undefined>(() =>
    cachedReview(game),
  );
  const [retry, setRetry] = useState<PersonalCard | null>(null);
  const [savedCard, setSavedCard] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [rule, setRule] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [variation, setVariation] = useState<Game | null>(null);
  const [, render] = useState(0);
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [progress, setProgress] = useState({
    done: 0,
    total: game.moves.length + 1,
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      releaseReview();
    },
    [],
  );
  const shown = variation ?? game;
  const notation = game.notation;
  const evaluation = !variation ? result?.evaluations[ply] : undefined;
  const selected = !variation && ply > 0 ? result?.moves[ply - 1] : undefined;
  const orientation = record.colour ?? "white";
  function navigate(target: number) {
    setSavedCard("");
    setRule(null);
    game.goTo(Math.max(0, Math.min(game.moves.length, target)));
    setPly(game.ply);
    setVariation(null);
    setShapes([]);
    setPromotion(null);
  }
  /** Inside a variation, step back one explored move; its first move returns to the game. */
  function back() {
    if (!variation) return navigate(ply - 1);
    if (variation.ply > 1) {
      variation.goTo(variation.ply - 1);
      render((n) => n + 1);
      return;
    }
    const moves = [...variation.moves].slice(0, variation.ply);
    if (moves.length <= 1) return navigate(ply);
    const branch = new Game(variation.startFen);
    moves.slice(0, -1).forEach((m) => branch.play(m));
    setVariation(branch);
    setShapes([]);
    setPromotion(null);
  }
  function play(uci: string) {
    const branch = variation ?? new Game(game.fen);
    branch.play(uci);
    setVariation(branch);
    setShapes([]);
    setPromotion(null);
    render((n) => n + 1);
  }
  async function start() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setRunning(true);
    setError("");
    try {
      const value = await analyseGame(
        game,
        controller.signal,
        (done, total) => {
          if (!controller.signal.aborted) setProgress({ done, total });
        },
      );
      if (!controller.signal.aborted) setResult(value);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Analysis failed. Please try again.",
        );
    } finally {
      if (request.current === controller && !controller.signal.aborted)
        setRunning(false);
    }
  }
  const findings =
    selected &&
    ["Inaccuracy", "Mistake", "Blunder", "Miss"].includes(
      selected.classification,
    )
      ? explain(notation[ply - 1].before, game.moves[ply - 1], selected)
      : [];
  const deviation = record.colour
    ? repertoireDeviation(game, record.colour, repertoire)
    : null;
  if (retry)
    return (
      <MistakePractice
        key={retry.id}
        card={retry}
        store={store}
        engineHint
        settings={settings}
        onClose={() => setRetry(null)}
      />
    );
  return (
    <section
      className="review-page"
      aria-label="Game Review"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          promotion ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          if (event.key === "ArrowLeft") back();
          else if (variation && variation.ply < variation.moves.length) {
            variation.goTo(variation.ply + 1);
            render((n) => n + 1);
          } else navigate(ply + 1);
        }
      }}
    >
      <header className="page-header">
        <div>
          <h1>Game Review</h1>
          <p>
            {record.white} vs {record.black} · {record.result} · {record.date}
          </p>
        </div>
        <button onClick={onClose}>Back to games</button>
      </header>
      {deviation && (
        <div className="review-deviation">
          <button onClick={() => navigate(deviation.ply + 1)}>
            {deviation.kind === "our-deviation"
              ? "You left your repertoire"
              : deviation.kind === "unknown-reply"
                ? "Opponent deviated (unknown reply)"
                : "Repertoire line ended"}{" "}
            at move {notation[deviation.ply].before.split(" ")[5]}
          </button>
          {deviation.bookMoves.length > 0 && (
            <p>
              Book move{deviation.bookMoves.length > 1 ? "s" : ""}:{" "}
              {deviation.bookMoves
                .map((m) => new Game(notation[deviation.ply].before).toSan(m))
                .join(", ")}
            </p>
          )}
          {deviation.reentries.map((p) => (
            <p key={p}>
              <button onClick={() => navigate(p + 1)}>
                Transposed back into repertoire at move{" "}
                {notation[p].before.split(" ")[5]}
              </button>
            </p>
          ))}
        </div>
      )}
      {!record.colour && (
        <p className="muted">
          Player color unknown; repertoire deviation and personal cards need an
          identified player.
        </p>
      )}
      <div className="review-summary">
        <div>
          <h2>Accuracy</h2>
          <p className="muted">Lichess formula</p>
        </div>
        {(["white", "black"] as const).map((side) => (
          <div className="review-accuracy" key={side}>
            <span>{side === "white" ? "White" : "Black"}</span>
            <strong>
              {result?.accuracy[side] == null
                ? "n/a"
                : `${result.accuracy[side].toFixed(1)}%`}
            </strong>
          </div>
        ))}
        <p className="muted">
          Book moves excluded. At least 4 non-book moves per side.
        </p>
      </div>
      <div className="review-actions">
        {!result && !running && (
          <button className="primary" onClick={() => void start()}>
            {progress.done || error ? "Resume analysis" : "Start analysis"}
          </button>
        )}
        {running && (
          <>
            <progress
              aria-label="Game analysis progress"
              value={progress.done}
              max={progress.total}
            />
            <span role="status">
              Analysing position {progress.done} / {progress.total}
            </span>
            <button
              onClick={() => {
                request.current?.abort();
                setRunning(false);
              }}
            >
              Cancel analysis
            </button>
          </>
        )}
        {result && (
          <span role="status">Analysis complete · saved in engine cache</span>
        )}
        {!result && !running && progress.done > 0 && (
          <span role="status">
            Analysis paused. Completed positions are cached.
          </span>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="play-layout review-layout">
        <div className="review-board-column">
          <div className="review-board">
            <div
              className={`review-eval ${orientation}`}
              role="img"
              aria-label={`Evaluation from White's perspective: ${evaluation ? score(evaluation) : "not analysed"}`}
            >
              <div
                style={{
                  height: `${evaluation ? expectedPoints(evaluation, "white") * 100 : 50}%`,
                }}
              />
              <span>{evaluation ? score(evaluation) : "-"}</span>
            </div>
            <Board
              position={shown.fen}
              orientation={orientation}
              movableSide={shown.turn}
              legalDests={shown.destinations()}
              shapes={shapes}
              lastMove={shown.lastMove}
              locked={false}
              check={shown.check}
              turn={shown.turn}
              coordinates={settings.coordinates}
              animationMs={settings.reducedMotion ? 0 : settings.animationMs}
              onShapesChange={setShapes}
              onMoveIntent={(from, to) => {
                if (shown.promotions(from as Square, to as Square).length)
                  setPromotion({ from: from as Square, to: to as Square });
                else play(from + to);
              }}
            />
          </div>
          <div className="history-controls">
            <button
              aria-label="First position"
              onClick={() => navigate(0)}
              disabled={!ply && !variation}
            >
              ⇤
            </button>
            <button
              aria-label="Previous move"
              onClick={back}
              disabled={!ply && !variation}
            >
              ‹
            </button>
            <span>
              {ply} / {notation.length}
            </span>
            <button
              aria-label="Next move"
              onClick={() => {
                if (variation && variation.ply < variation.moves.length) {
                  variation.goTo(variation.ply + 1);
                  render((n) => n + 1);
                } else navigate(ply + 1);
              }}
              disabled={ply === notation.length && !variation}
            >
              ›
            </button>
            <button
              aria-label="Last position"
              onClick={() => navigate(notation.length)}
              disabled={ply === notation.length && !variation}
            >
              ⇥
            </button>
          </div>
          {variation && (
            <div className="review-variation">
              <p>
                Exploring:{" "}
                {san(
                  variation.startFen,
                  [...variation.moves].slice(0, variation.ply),
                )}
              </p>
              <button onClick={() => navigate(ply)}>Return to game</button>
            </div>
          )}
          {result && (
            <EvalGraph review={result} ply={ply} navigate={navigate} />
          )}
        </div>
        <aside className="game-panel review-panel">
          <div className="panel-heading">
            <h2>Move classifications</h2>
          </div>
          <p className="review-label muted">approximation of Chess.com</p>
          <div className="move-list review-moves" aria-label="Review move list">
            <ol>
              {notation.map((move, i) => {
                const label = result?.moves[i].classification;
                return (
                  <li
                    className={move.color === "w" ? "white-move" : "black-move"}
                    key={i}
                  >
                    <span className="move-number">
                      {move.before.split(" ")[5]}
                      {move.color === "w" ? "." : "…"}
                    </span>
                    <button
                      aria-current={
                        !variation && ply === i + 1 ? "step" : undefined
                      }
                      aria-label={`${i + 1}: ${move.san}${label ? `, ${label}` : ""}`}
                      onClick={() => navigate(i + 1)}
                    >
                      {move.san}{" "}
                      {label && (
                        <span
                          className={`classification ${label.toLowerCase()}`}
                          title={label}
                        >
                          {icons[label]}
                          <span className="sr-only"> {label}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="review-detail" aria-live="polite">
            {selected ? (
              <>
                <h3
                  className={`classification ${selected.classification.toLowerCase()}`}
                >
                  {icons[selected.classification]} {selected.classification}
                </h3>
                <p>Expected points lost: {(selected.loss * 100).toFixed(1)}%</p>
                {findings.length > 0 && (
                  <Rephrase
                    key={`${ply}:${variation ? "variation" : "main"}`}
                    store={store}
                    findings={findings}
                    classification={selected.classification}
                    fen={notation[ply - 1].before}
                    best={selected.best.uci}
                  />
                )}
                {findings.map((finding, i) => (
                  <article className="review-finding" key={i}>
                    <p>{finding.text}</p>
                    {finding.squares.length > 0 && (
                      <p>Evidence squares: {finding.squares.join(", ")}</p>
                    )}
                    <p>
                      Proving line:{" "}
                      {provingLine(finding) || "No legal line supplied"}
                    </p>
                    <a
                      href={`#rule-${finding.ruleId}`}
                      onClick={(event) => {
                        event.preventDefault();
                        setRule(finding.ruleId);
                      }}
                    >
                      Golden rule:{" "}
                      {goldenRules.find((r) => r.id === finding.ruleId)
                        ?.shortForm ?? finding.ruleId}
                    </a>
                  </article>
                ))}
                {rule && (
                  <aside id={`rule-${rule}`} aria-label="Golden rule">
                    <h4>{goldenRules.find((r) => r.id === rule)?.shortForm}</h4>
                    <p>{goldenRules.find((r) => r.id === rule)?.reason}</p>
                  </aside>
                )}
                {findings.length > 0 && selected.best.uci.length > 0 && (
                  <>
                    <button
                      onClick={() => {
                        const branch = new Game(notation[ply - 1].before);
                        selected.best.uci.forEach((m) => branch.play(m));
                        branch.goTo(1);
                        setVariation(branch);
                        setShapes([]);
                      }}
                    >
                      Replay better line
                    </button>{" "}
                    <button
                      onClick={() =>
                        setRetry(
                          createMistakeCard(
                            notation[ply - 1].before,
                            selected.best.uci,
                            Date.now(),
                            findings.map((f) => f.ruleId),
                          ),
                        )
                      }
                    >
                      Retry position
                    </button>
                  </>
                )}
                {record.colour === selected.side &&
                  ["Mistake", "Blunder"].includes(selected.classification) &&
                  selected.best.uci.length > 0 && (
                    <p>
                      <button
                        disabled={!store || savingCard}
                        onClick={async () => {
                          if (!store) return;
                          setSavingCard(true);
                          try {
                            await store.savePersonalCard(
                              createMistakeCard(
                                notation[ply - 1].before,
                                selected.best.uci,
                                Date.now(),
                                findings.map((f) => f.ruleId),
                              ),
                            );
                            setSavedCard("Added to training.");
                          } catch {
                            setSavedCard(
                              "Could not save this card. Please try again.",
                            );
                          } finally {
                            setSavingCard(false);
                          }
                        }}
                      >
                        Add to training
                      </button>
                    </p>
                  )}
                {savedCard && <p aria-live="polite">{savedCard}</p>}

                <p>
                  Engine best:{" "}
                  {san(notation[ply - 1].before, selected.best.uci) ||
                    "Terminal position"}
                </p>
              </>
            ) : (
              <p>
                {variation
                  ? "Explore freely. Return to the game for its evaluation."
                  : "Select a move or a point on the graph."}
              </p>
            )}
          </div>
          <p className="board-tips">
            Book detection: repertoire only, through 16 plies.
            <br />
            Use arrow keys to navigate. Move pieces to explore; no live coach
            feedback.
          </p>
        </aside>
      </div>
      {promotion && (
        <PromotionPicker
          color={shown.turn}
          onCancel={() => setPromotion(null)}
          onPick={(piece) => play(promotion.from + promotion.to + piece)}
        />
      )}
    </section>
  );
}
function EvalGraph({
  review,
  ply,
  navigate,
}: {
  review: GameReview;
  ply: number;
  navigate: (ply: number) => void;
}) {
  const points = review.evaluations.map((e, i) => ({
    x: 12 + (i * 576) / Math.max(1, review.moves.length),
    y: 110 - expectedPoints(e, "white") * 100,
  }));
  return (
    <div className="review-graph">
      <h3>Evaluation · White's perspective</h3>
      <svg viewBox="0 0 600 120" role="group" aria-label="Evaluation graph">
        <line x1="0" y1="60" x2="600" y2="60" className="graph-zero" />
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          className="graph-line"
        />
        <line
          x1={points[ply].x}
          y1="5"
          x2={points[ply].x}
          y2="115"
          className="graph-selection"
        />
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - 288 / Math.max(1, review.moves.length)}
            y="0"
            width={576 / Math.max(1, review.moves.length)}
            height="120"
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`Position ${i}, evaluation ${score(review.evaluations[i])}`}
            aria-pressed={i === ply}
            onClick={() => navigate(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(i);
              }
            }}
          >
            <title>
              Position {i}: {score(review.evaluations[i])}
            </title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
