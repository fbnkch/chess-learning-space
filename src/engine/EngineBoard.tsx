import { useEffect, useRef, useState, type ReactNode } from "react";
import { Game } from "../game/Game";
import { StockfishEngine } from "./Engine";
import { createPortal } from "react-dom";
import { score, san, whiteAdvantage } from "./presentation";
import type { Analysis } from "./types";

/** Explicit analysis only. A position change hides the old result immediately. */
export function EngineBoard({
  game,
  orientation,
  children,
  controlsTarget,
}: {
  game: Game;
  orientation: "white" | "black";
  children: ReactNode;
  controlsTarget: HTMLElement | null;
}) {
  const [enabled, setEnabled] = useState(false);
  const [result, setResult] = useState<{
    key: string;
    analysis?: Analysis;
    error?: string;
    loading?: boolean;
    elapsed?: number;
  }>();
  const engine = useRef<StockfishEngine | null>(null);
  const request = useRef<AbortController | null>(null);
  const key = JSON.stringify([game.startFen, game.moves.slice(0, game.ply)]);
  const currentFen = game.fen;
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [key],
  );
  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );
  const visible = result?.key === key ? result : undefined;
  const best = visible?.analysis?.lines[0];
  const whiteShare = best
    ? best.mate !== undefined
      ? best.winner === 1
        ? 100
        : 0
      : 50 + 50 * Math.tanh(best.cp / 400)
    : 50;
  async function analyse() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    engine.current ??= new StockfishEngine();
    setResult({ key, loading: true });
    const started = performance.now();
    try {
      const analysis = await engine.current.analyse(
        { startFen: game.startFen, moves: game.moves.slice(0, game.ply) },
        { movetime: 500, multipv: 2, priority: "hint" },
        controller.signal,
      );
      if (!analysis.complete)
        throw new Error("Incomplete analysis. Please retry");
      if (!controller.signal.aborted)
        setResult({
          key,
          analysis,
          elapsed: Math.round(performance.now() - started),
        });
    } catch (error) {
      if (!controller.signal.aborted)
        setResult({
          key,
          error: error instanceof Error ? error.message : "Engine unavailable",
        });
    }
  }
  return (
    <>
      <div className={`engine-board ${enabled ? "engine-visible" : ""}`}>
        {enabled && (
          <div
            className={`eval-bar ${orientation}`}
            role="img"
            aria-label={
              best
                ? `Evaluation from White's view: ${score(best)}`
                : "Evaluation pending"
            }
          >
            <div className="eval-white" style={{ height: `${whiteShare}%` }} />
            {best && (
              <span
                className={
                  whiteAdvantage(best) === (orientation === "white")
                    ? "leading-bottom"
                    : "leading-top"
                }
              >
                {score(best)}
              </span>
            )}
          </div>
        )}
        {children}
      </div>
      {controlsTarget &&
        createPortal(
          <section className="engine-controls" aria-label="Engine analysis">
            <button
              aria-pressed={enabled}
              onClick={() => {
                setEnabled(!enabled);
                if (!enabled) void analyse();
                else request.current?.abort();
              }}
            >
              Engine
            </button>
            {enabled && (
              <>
                <button
                  onClick={() => void analyse()}
                  disabled={visible?.loading}
                >
                  Analyze position
                </button>
                <div aria-live="polite">
                  {visible?.loading ? (
                    <p>Analysing…</p>
                  ) : visible?.error ? (
                    <p role="alert">
                      Engine unavailable: {visible.error}. Try again.
                    </p>
                  ) : best ? (
                    <>
                      <ol className="engine-lines" data-testid="engine-lines">
                        {visible.analysis!.lines.map((line, index) => (
                          <li key={index}>
                            <strong>{score(line)}</strong>{" "}
                            {san(currentFen, line.uci)}{" "}
                            <small>depth {line.depth}</small>
                          </li>
                        ))}
                      </ol>
                      <small data-testid="analysis-time">
                        Analysis: {visible.elapsed} ms · Stockfish 19 lite ·
                        White’s view
                      </small>
                    </>
                  ) : (
                    <p>Position changed. Analyze when you are ready.</p>
                  )}
                </div>
              </>
            )}
          </section>,
          controlsTarget,
        )}
    </>
  );
}
