import { useSync } from "./sync/useSync";
import { SyncPanel } from "./sync/SyncPanel";
import { Icon } from "./Icon";
import { ExplorerSettings } from "./explorer/ExplorerSettings";
import { WordingSettings } from "./llm/WordingSettings";
import { RuleQuiz } from "./rules/RuleQuiz";
import { EngineBoard } from "./engine/EngineBoard";
import { Fragment, useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Square } from "./game/Game";
import type { Key } from "@lichess-org/chessground/types";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { Board } from "./board/Board";
import { Game } from "./game/Game";
import { PromotionPicker } from "./PromotionPicker";
import { SettingsPanel } from "./SettingsPanel";
import {
  readSettings,
  saveSettings,
  storageAvailable,
  type Settings,
} from "./settings";
import { playSound } from "./sound";
import { Openings } from "./trainer/Openings";
import { GoldenRules } from "./rules/GoldenRules";
import { useProgress } from "./progress/useProgress";
import { BackupPanel } from "./progress/BackupPanel";

import { ThreatScan } from "./threats/ThreatScan";
import { Puzzles } from "./puzzles/Puzzles";
import { Games } from "./import/Games";
import { Dashboard } from "./plan/Dashboard";
import { observeAppearance } from "./appearance";
type Page =
  | "rule-quiz"
  | "home"
  | "free-play"
  | "openings"
  | "rules"
  | "threats"
  | "puzzles"
  | "games";

function pageFromHash(): Page {
  const route = location.hash.split("?")[0];
  if (route === "#games") return "games";
  if (route === "#puzzles") return "puzzles";
  if (route === "#openings") return "openings";
  if (route === "#threats") return "threats";
  if (route === "#rules-quiz") return "rule-quiz";
  if (route === "#rules") return "rules";
  if (route === "#free-play") return "free-play";
  return "home";
}

export function App() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const [engineControls, setEngineControls] = useState<HTMLDivElement | null>(
    null,
  );
  const [page, setPage] = useState<Page>(pageFromHash);
  const [game, setGame] = useState(() => new Game());
  const [, refresh] = useReducer((n) => n + 1, 0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [settings, setSettings] = useState(readSettings);
  useEffect(
    () => observeAppearance({
      colorMode: settings.colorMode,
      colorTheme: settings.colorTheme,
    }),
    [settings.colorMode, settings.colorTheme],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(storageAvailable);
  const applySettings = useCallback((settings: Settings) => {
    setSettings(settings);
    setSaved(saveSettings(settings));
  }, []);
  const progress = useProgress(applySettings);
  const sync = useSync(progress.store, progress.imported);
  const moveList = useRef<HTMLDivElement>(null);
  const [fen, setFen] = useState("");
  const [error, setError] = useState("");
  const navigate = useCallback(
    (ply: number) => {
      game.goTo(Math.max(0, Math.min(game.moves.length, ply)));
      setPromotion(null);
      setShapes([]);
      refresh();
    },
    [game],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        page !== "free-play" ||
        promotion ||
        settingsOpen ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        (event.target instanceof HTMLElement &&
          event.target.isContentEditable) ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      const targets: Record<string, number> = {
        ArrowLeft: game.ply - 1,
        ArrowRight: game.ply + 1,
        ArrowUp: 0,
        ArrowDown: game.moves.length,
      };
      if (event.key in targets) {
        event.preventDefault();
        navigate(targets[event.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, navigate, promotion, settingsOpen, page]);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      settings.reducedMotion,
    );
  }, [settings.reducedMotion]);
  useEffect(() => {
    moveList.current
      ?.querySelector("[aria-current=step]")
      ?.scrollIntoView({ block: "nearest" });
  });
  function commit(uci: string) {
    try {
      const move = game.play(uci);
      if (settings.sound)
        playSound(game.check ? "check" : move.captured ? "capture" : "move");
    } catch {
      /* Rejected intents leave the authoritative position untouched. */
    }
    setPromotion(null);
    setShapes([]);
    refresh();
  }
  function moveIntent(fromKey: Key, toKey: Key) {
    if (!/^[a-h][1-8]$/.test(fromKey) || !/^[a-h][1-8]$/.test(toKey)) return;
    const from = fromKey as Square,
      to = toKey as Square;
    if (game.promotions(from, to).length) {
      setPromotion({ from, to });
      refresh();
    } else commit(from + to);
  }
  function updateSettings(next: Settings) {
    setSettings(next);
    setSaved(saveSettings(next));
    if (progress.store)
      void progress.store.saveSettings(next).catch(() => setSaved(false));
  }
  function loadPosition() {
    try {
      setGame(new Game(fen.trim()));
      setError("");
      setPromotion(null);
      setShapes([]);
    } catch {
      setError("Invalid FEN. Check the position and try again.");
    }
  }
  const notation = game.notation;
  const player = (color: "white" | "black") => (
    <div className="player">
      <div className={`avatar ${color}`} aria-hidden="true">
        {color === "white" ? "\u2654" : "\u265a"}
      </div>
      <div>
        <strong>{color === "white" ? "White" : "Black"}</strong>
        <small>Free play</small>
      </div>
      <span className={`color-badge ${color}`}>
        {color === "white" ? "WHITE" : "BLACK"}
      </span>
    </div>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Chess Learning Space home">
          <Icon name="knight" />
          <div>
            Chess<span>Learning Space</span>
          </div>
        </a>
        <nav aria-label="Main navigation">
          {([
            { route: "home", label: "Home" },
            { route: "free-play", label: "Free play" },
            { route: "openings", label: "Openings", section: "Practice", count: progress.dueCount },
            { route: "puzzles", label: "Puzzles" },
            { route: "threats", label: "Threat Scan" },
            { route: "rules", label: "Golden Rules", section: "Study", count: progress.learnedRules.length },
            { route: "games", label: "Games", section: "Review" },
          ] as const).map((item) => (
            <Fragment key={item.route}>
              {"section" in item && <p className="nav-label">{item.section}</p>}
              <a
                href={`#${item.route}`}
                className={page === item.route ? "nav-active" : undefined}
                aria-current={page === item.route ? "page" : undefined}
              >
                {item.label}
                {"count" in item && <span className="nav-count">{item.count}</span>}
              </a>
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-expanded={settingsOpen}
            aria-controls="board-settings"
          >
            <Icon name="settings" /> Settings
          </button>
          <div className="profile">
            <div className="profile-avatar">F</div>
            <div>
              <strong>fbnkch</strong>
            </div>
          </div>
        </div>
      </aside>
      <nav className="compact-tabs" aria-label="Compact navigation">
        {(
          [
            ["home", "Home", "home"],
            ["openings", "Openings", "openings"],
            ["puzzles", "Tactics", "puzzles"],
            ["games", "Games", "games"],
            ["rules", "Rules", "rules"],
          ] as const
        ).map(([route, label, icon]) => {
          const active =
            page === route ||
            (route === "puzzles" && page === "threats") ||
            (route === "rules" && page === "rule-quiz");
          return (
            <a
              key={route}
              href={`#${route}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
      <main id="free-play">
        {(page === "puzzles" || page === "threats") && (
          <nav className="tactics-segments" aria-label="Tactics modes">
            <a
              href="#puzzles"
              aria-current={page === "puzzles" ? "page" : undefined}
            >
              Puzzles
            </a>
            <a
              href="#threats"
              aria-current={page === "threats" ? "page" : undefined}
            >
              Threat Scan
            </a>
          </nav>
        )}
        {!online && (
          <p role="status">
            You're offline. Training and saved progress still work. Importing
            Chess.com games and opening external links require internet.
          </p>
        )}
        {progress.nudge && (
          <aside className="backup-nudge" aria-label="Backup reminder">
            <div>
              <strong>Keep your progress safe</strong>
              <p>
                It is time for a backup. Export a copy to keep outside this
                browser.
              </p>
            </div>
            <button onClick={() => setSettingsOpen(true)}>Back up now</button>
            <button
              aria-label="Dismiss backup reminder"
              onClick={() =>
                void progress
                  .dismissNudge()
                  .catch(() =>
                    progress.reportError(
                      "Could not dismiss the backup reminder. Try again.",
                    ),
                  )
              }
            >
              Later
            </button>
          </aside>
        )}
        {progress.error && <p role="alert">{progress.error}</p>}
        {progress.retiredCount > 0 && (
          <p>
            {progress.retiredCount} retired cards. Their review history is
            preserved.
          </p>
        )}
        {page === "home" ? (
          <Dashboard
            key={progress.revision}
            store={progress.store}
            scheduler={progress.scheduler}
            puzzles={progress.puzzles}
            settings={settings}
            onSave={async (next) => {
              if (!progress.store) throw new Error("Storage unavailable");
              await progress.store.saveSettings(next);
              applySettings(next);
            }}
            onBackup={() => setSettingsOpen(true)}
          />
        ) : page === "games" ? (
          <Games
            key={progress.revision}
            store={progress.error ? null : progress.store}
            settings={settings}
          />
        ) : page === "puzzles" ? (
          <Puzzles
            key={progress.revision}
            settings={settings}
            training={progress.error ? null : progress.puzzles}
            onReview={async () => {
              if (progress.store) await progress.refresh(progress.store);
            }}
          />
        ) : page === "openings" ? (
          <Openings
            key={progress.revision}
            store={progress.error ? null : progress.scheduler}
            settings={settings}
            dueCount={progress.dueCount}
            reviewCount={progress.reviewCount}
            onReview={async () => {
              if (progress.store) await progress.refresh(progress.store);
            }}
          />
        ) : page === "threats" ? (
          <ThreatScan
            key={progress.revision}
            settings={settings}
            store={progress.error ? null : progress.store}
          />
        ) : page === "rule-quiz" ? (
          <RuleQuiz
            key={progress.revision}
            store={progress.store}
            coordinates={settings.coordinates}
            onSaved={async () => {
              if (progress.store) await progress.refresh(progress.store);
            }}
          />
        ) : page === "rules" ? (
          <GoldenRules
            storageReady={Boolean(progress.store)}
            coordinates={settings.coordinates}
            learned={progress.learnedRules}
            onToggle={async (ruleId, learned) => {
              try {
                await progress.setRuleLearned(ruleId, learned);
              } catch {
                progress.reportError(
                  "Could not save your learned rule. Please try again.",
                );
                throw new Error("Learned-rule save failed");
              }
            }}
          />
        ) : (
          <>
            <header className="page-header">
              <div>
                <h1>Free play</h1>

                <p>
                  <a href="#openings">
                    Openings: {progress.dueCount} cards due
                  </a>
                </p>
              </div>
              <button
                className="settings-toggle"
                onClick={() => setSettingsOpen(!settingsOpen)}
                aria-expanded={settingsOpen}
                aria-controls="board-settings"
              >
                Board settings
              </button>
            </header>
            <div className="play-layout">
              <section className="board-column" aria-label="Free play">
                {player(orientation === "white" ? "black" : "white")}
                <EngineBoard
                  game={game}
                  orientation={orientation}
                  controlsTarget={engineControls}
                >
                  <Board
                    position={game.fen}
                    provisionalMove={promotion ?? undefined}
                    orientation={orientation}
                    movableSide={game.turn}
                    legalDests={game.destinations()}
                    shapes={shapes}
                    lastMove={game.lastMove}
                    locked={promotion !== null}
                    check={game.check}
                    turn={game.turn}
                    coordinates={settings.coordinates}
                    animationMs={
                      settings.reducedMotion ? 0 : settings.animationMs
                    }
                    onMoveIntent={moveIntent}
                    onShapesChange={setShapes}
                  />
                </EngineBoard>
                {player(orientation)}
                <div className="board-toolbar">
                  <span role="status" className="position-status">
                    <i />
                    {game.status}
                  </span>
                  <button
                    onClick={() =>
                      setOrientation(
                        orientation === "white" ? "black" : "white",
                      )
                    }
                    title="Flip board"
                  >
                    &#8635; <span>Flip board</span>
                  </button>
                </div>
              </section>
              <aside className="game-panel" aria-label="Game controls">
                <div ref={setEngineControls} />
                <div className="panel-heading">
                  <span aria-hidden="true">&#9776;</span>
                  <h2>Moves</h2>
                  <span className="pill">FREE PLAY</span>
                </div>
                <div
                  ref={moveList}
                  className="move-list"
                  aria-label="Move list"
                >
                  {notation.length === 0 ? (
                    <div className="empty-moves">
                      <Icon name="openings" />
                      <h3>A fresh board</h3>
                      <p>Make your first move to start exploring.</p>
                    </div>
                  ) : (
                    <ol>
                      {notation.map((move, index) => (
                        <li
                          key={index}
                          className={
                            move.color === "w" ? "white-move" : "black-move"
                          }
                        >
                          {(move.color === "w" || index === 0) && (
                            <span className="move-number">
                              {move.before.split(" ")[5]}
                              {move.color === "w" ? "." : "\u2026"}
                            </span>
                          )}
                          <button
                            aria-label={`Go to move ${index + 1}: ${move.san}`}
                            aria-current={
                              game.ply === index + 1 ? "step" : undefined
                            }
                            onClick={() => navigate(index + 1)}
                          >
                            {move.san}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="history-controls">
                  <button
                    aria-label="First position"
                    disabled={game.ply === 0}
                    onClick={() => navigate(0)}
                  >
                    &#8676;
                  </button>
                  <button
                    aria-label="Previous move"
                    disabled={game.ply === 0}
                    onClick={() => navigate(game.ply - 1)}
                  >
                    &#8249;
                  </button>
                  <span>
                    {game.ply} / {game.moves.length}
                  </span>
                  <button
                    aria-label="Next move"
                    disabled={game.ply === game.moves.length}
                    onClick={() => navigate(game.ply + 1)}
                  >
                    &#8250;
                  </button>
                  <button
                    aria-label="Last position"
                    disabled={game.ply === game.moves.length}
                    onClick={() => navigate(game.moves.length)}
                  >
                    &#8677;
                  </button>
                </div>
                <div className="panel-actions">
                  <button
                    className="primary"
                    onClick={() => {
                      setGame(new Game());
                      setPromotion(null);
                      setShapes([]);
                      setError("");
                    }}
                  >
                    New board
                  </button>
                </div>
                <div className="board-tips">
                  <h3>Room to think</h3>
                  <p>Drag a piece or click a piece and its target.</p>
                  <p>
                    Right-click a square to mark it. Drag with the right button
                    to draw an arrow. Hold Shift or Alt to choose another color.
                  </p>
                  <p>Use left / right arrow keys to step through your moves.</p>
                </div>
                <details className="position-tools">
                  <summary>Load a position</summary>
                  <label htmlFor="fen">FEN position</label>
                  <textarea
                    id="fen"
                    value={fen}
                    onChange={(e) => setFen(e.target.value)}
                    spellCheck={false}
                  />
                  <button onClick={loadPosition}>Load position</button>
                  {error && <p role="alert">{error}</p>}
                </details>
              </aside>
            </div>
          </>
        )}
        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            saved={saved}
            onClose={() => setSettingsOpen(false)}
          >
            <details className="settings-section">
              <summary>Opening explorer</summary>
              <ExplorerSettings
                store={progress.store}
                onRefreshed={progress.imported}
              />
            </details>
            <details className="settings-section">
              <summary>Coach wording</summary>
              <WordingSettings store={progress.store} />
            </details>
            <details className="settings-section">
              <summary>Cloud sync</summary>
              <SyncPanel
                store={progress.store}
                engine={sync.engine}
                status={sync.status}
              />
            </details>
            <details className="settings-section">
              <summary>Backup and storage</summary>
              <BackupPanel
                backup={progress.error ? null : progress.backup}
                storage={progress.storage}
                lastExportAt={progress.lastExportAt}
                onExport={async () => {
                  if (progress.store) await progress.refresh(progress.store);
                }}
                onImported={progress.imported}
              />
            </details>
          </SettingsPanel>
        )}
      </main>
      {promotion && (
        <PromotionPicker
          color={game.turn}
          onPick={(piece) => commit(promotion.from + promotion.to + piece)}
          onCancel={() => {
            setPromotion(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
