import { loadManifest, loadPuzzles } from "../puzzles/data";
import { PuzzleSession } from "../puzzles/PuzzleSession";
import { repertoirePositions } from "../threats/scan";
import { repertoire } from "../repertoire/bundled";
import { MiniBoard } from "../MiniBoard";
import { Sparkline, CoverageBar, WeekDots } from "../DataGraphic";
import { Icon } from "../Icon";
import { useEffect, useState } from "react";
import type { Progress } from "../progress/Progress";
import type { Scheduler } from "../scheduler/Scheduler";
import type { RepertoireCard } from "../repertoire/types";
import type { PuzzleTraining } from "../puzzles/PuzzleTraining";
import type { Settings } from "../settings";
import { goldenRules } from "../rules/catalogue";
import { loadDashboard, type DashboardData } from "./dashboardData";
import { weeklyTemplate } from "./planner";

const clock = Date.now;
let firstScan: ReturnType<typeof repertoirePositions>[number] | undefined;
function scanPreview() {
  firstScan ??= repertoirePositions(repertoire, "scan")[0];
  return firstScan;
}
const percent = (value: number | null) =>
  value === null ? "Not enough data yet" : `${Math.round(value * 100)}%`;
export function Dashboard({
  store,
  scheduler,
  puzzles,
  settings,
  onSave,
  onBackup,
}: {
  store: Progress | null;
  scheduler: Scheduler<RepertoireCard> | null;
  puzzles: PuzzleTraining | null;
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onBackup: () => void;
}) {
  const [exercisePreviews, setExercisePreviews] = useState<
    Record<
      string,
      { fen: string; orientation: "white" | "black"; lastMove?: string[] }
    >
  >({});
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const scan = scanPreview();
      if (!controller.signal.aborted && scan)
        setExercisePreviews((current) => ({
          ...current,
          threats: {
            fen: scan.fen,
            orientation: scan.side,
            lastMove: scan.lastMove,
          },
        }));
      try {
        const manifest = await loadManifest(controller.signal);
        const rows = await loadPuzzles(manifest, "fork", controller.signal);
        const row = rows.find((r) => r[3] >= 600 && r[3] <= 1700);
        if (row && !controller.signal.aborted) {
          const session = new PuzzleSession(row);
          session.advance();
          setExercisePreviews((current) => ({
            ...current,
            tactics: {
              fen: session.game.fen,
              orientation: session.side,
              lastMove: session.game.lastMove,
            },
          }));
        }
      } catch {
        /* Optional thumbnails must never block the training plan. */
      }
    })();
    return () => controller.abort();
  }, []);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<Settings | null>(null);
  const [opening, setOpening] = useState<
    NonNullable<Settings["startingOpening"]>
  >(settings.startingOpening ?? "italian");
  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (store && scheduler && puzzles)
      void loadDashboard(store, scheduler, puzzles, settings, clock)
        .then((value) => {
          if (active) {
            setData(value);
            setError("");
          }
        })
        .catch(() => {
          if (active)
            setError(
              "Could not load the dashboard. Your training modules are still available.",
            );
        });
    return () => {
      active = false;
    };
  }, [store, scheduler, puzzles, settings, tick]);
  async function save(next: Settings) {
    setPendingSettings(next);
    setBusy(true);
    try {
      await onSave(next);
      setError("");
    } catch {
      setError(
        "Could not save your plan. Storage may be full. Export a backup in Settings and try again.",
      );
    } finally {
      setBusy(false);
      setPendingSettings(null);
    }
  }
  const expanded = false;
  const firstRun = data?.empty && !settings.welcomeComplete;
  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <div className="home-heading-row">
            <h1>Home</h1>
            <nav className="home-actions" aria-label="Home actions">
              <a href="#free-play">
                <Icon name="board" /> Free play
              </a>
              <button onClick={onBackup} aria-controls="board-settings">
                <Icon name="settings" /> Settings
              </button>
            </nav>
          </div>
        </div>
      </header>
      {error && (
        <p role="alert">
          {error} <button onClick={() => setTick((n) => n + 1)}>Retry</button>
        </p>
      )}
      {!data && !error && <p role="status">Loading your training plan…</p>}
      {firstRun && (
        <section className="dashboard-card welcome" aria-label="Welcome">
          <p>Choose an opening to learn your first line.</p>
          <label className="sr-only" htmlFor="starting-opening">
            Starting opening
          </label>
          <select
            id="starting-opening"
            value={opening}
            onChange={(e) => setOpening(e.target.value as typeof opening)}
          >
            <option value="italian">White · Italian (recommended)</option>
            <option value="london">White · London</option>
            <option value="caro">Black · Caro-Kann</option>
            <option value="qgd">Black · QGD / …d5</option>
          </select>
          <div className="dashboard-actions">
            <button
              className="primary"
              disabled={busy || !store}
              onClick={() =>
                void save({
                  ...settings,
                  welcomeComplete: true,
                  startingOpening: opening,
                })
              }
            >
              Choose this opening
            </button>
          </div>
          <details className="storage-info">
            <summary>Where is my data?</summary>
            <p>
              Progress stays in this browser; export a backup in Settings to
              keep a copy.
            </p>
            <button onClick={onBackup}>Open backup settings</button>
          </details>
        </section>
      )}
      {data && (
        <>
          <div className="dashboard-columns">
            <section className="dashboard-card today-plan" aria-label="Today">
              <div className="section-title">
                <h2>Today</h2>
                <WeekDots days={data.days} />
              </div>
              {firstRun ? (
                <p className="first-lesson-note">Choose an opening above to begin.</p>
              ) : (
                <section className="recommended-step" aria-label="Recommended next step">
                  <span className="study-kicker">Start here</span>
                  <h2>{data.nextStep.title}</h2>
                  <p>{data.nextStep.instruction}</p>
                  <a className="primary session-start" href={data.nextStep.href}>
                    {data.nextStep.action} <Icon name="chevron" />
                  </a>
                </section>
              )}
              {!firstRun && <h3 className="other-practice-heading">Then, if you have time</h3>}
              <ol className="session-list">
                {(firstRun ? [] : data.session.filter((step) =>
                  !step.id.startsWith("openings") &&
                  step.id !== "lesson" &&
                  step.href !== data.nextStep.href,
                )).map((step) => (
                  <li key={step.id}>
                    <a href={step.href} aria-label={step.title}>
                      {"preview" in step && step.preview ? (
                        <MiniBoard {...step.preview} />
                      ) : (
                        exercisePreviews[step.id] && (
                          <MiniBoard {...exercisePreviews[step.id]} />
                        )
                      )}
                      <span>
                        {step.title}
                        <small>~{step.minutes} min</small>
                      </span>
                      <Icon name="chevron" />
                    </a>
                  </li>
                ))}
              </ol>
              <details className="session-details" open={expanded}>
                <summary>Session details</summary>
                <p>
                  Start with a few due cards. Stop whenever you like; the rest
                  stays ready.
                </p>
                <p>
                  <a href="#puzzles?opening=repertoire">Opening puzzles</a>
                </p>
                <p>
                  {data.weekly.todaySessions} training sessions today (day
                  starts at 04:00).
                </p>
                {(() => {
                  const focus = weeklyTemplate.find(
                    (area) =>
                      (area.id === "analysis"
                        ? data.analysisDone
                        : data.weekly[area.id]) < area.target,
                  );
                  return focus ? (
                    <p>
                      Next weekly focus: <a href={focus.href}>{focus.title}</a>{" "}
                      · ~{focus.minutes} min. {focus.focus}
                    </p>
                  ) : (
                    <p>
                      Your weekly areas are complete. Continue reviewing or
                      start your next flexible week.
                    </p>
                  );
                })()}
                <p className="muted">
                  No streaks, deadlines or catch-up debt. A break simply means
                  continuing here.
                </p>
              </details>
            </section>
            <section
              className="dashboard-card study-position"
              aria-label="Where you left off"
            >
              <div className="section-title">
                <h2>Your repertoire</h2>
                {data.continueLine && (
                  <span className="study-stage">{data.continueLine.stage}</span>
                )}
              </div>
              {data.continueLine && (
                <a
                  className="continue-position"
                  href={data.continueLine.href + "&start=1"}
                  aria-label={data.continueLine.title}
                >
                  <div className="study-board">
                    <MiniBoard {...data.continueLine.preview} />
                  </div>
                  <span className="study-caption">
                    <span>{data.continueLine.title}</span>
                    <Icon name="chevron" />
                  </span>
                  <span className="score-strip">
                    Line starts: {data.continueLine.notation}
                  </span>
                </a>
              )}
              <details className="continue-details" open={expanded}>
                <summary>More ways to continue</summary>
                {data.continueSet ? (
                  <p>
                    <a href={data.continueSet.href}>
                      Continue Woodpecker · {data.continueSet.set.motif}
                    </a>
                    Cycle {data.continueSet.progress.cycle} ·{" "}
                    {data.continueSet.progress.index}/
                    {data.continueSet.set.puzzleIds.length} completed
                  </p>
                ) : (
                  <p>
                    <a href="#puzzles">Build your first Woodpecker set</a>
                  </p>
                )}
                <p>
                  <a href="#games">
                    {data.pendingGames} imported games ready for Game Review
                  </a>
                </p>
                <button onClick={onBackup}>Export or restore a backup</button>
              </details>
            </section>
          </div>
          <details
            className="dashboard-card dashboard-disclosure"
            aria-label="Weekly plan"
            open={expanded}
          >
            <summary>
              <h2>Weekly plan</h2>
            </summary>
            <p>
              Your weekly plan stays flexible. Miss a week? Unfinished work
              will still be here. Start a new week when you're ready; your
              training history stays intact.
            </p>
            <div className="weekly-grid">
              {weeklyTemplate.map((area) => {
                const count = area.external
                  ? ((pendingSettings ?? settings).planExternal?.[area.id] ?? 0)
                  : area.id === "analysis"
                    ? data.analysisDone
                    : data.weekly[area.id];
                return (
                  <article key={area.id}>
                    <h3>
                      <a
                        href={area.href}
                        {...(area.external
                          ? { target: "_blank", rel: "noreferrer" }
                          : {})}
                      >
                        {area.title}
                      </a>
                    </h3>
                    <p>{area.focus}</p>
                    <progress
                      aria-label={`${area.title} progress`}
                      max={area.target}
                      value={Math.min(area.target, count)}
                    />
                    <p>
                      {Math.min(area.target, count)} / {area.target} sessions ·
                      ~{area.minutes} min each
                    </p>
                    {area.external && (
                      <label>
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={count >= area.target}
                          onChange={(e) =>
                            void save({
                              ...settings,
                              planExternal: {
                                play: settings.planExternal?.play ?? 0,
                                endgame: settings.planExternal?.endgame ?? 0,
                                [area.id]: e.target.checked ? area.target : 0,
                              },
                            })
                          }
                        />{" "}
                        Completed this week's {area.title.toLowerCase()}
                      </label>
                    )}
                  </article>
                );
              })}
            </div>
            <button
              disabled={busy}
              onClick={() =>
                void save({
                  ...settings,
                  planStartedAt: clock(),
                  planReviewedGames: data.analysis.map((r) => r.id),
                  planExternal: { play: 0, endgame: 0 },
                })
              }
            >
              Start next flexible week
            </button>
          </details>
          <details
            className="dashboard-card dashboard-disclosure"
            aria-label="Progress dashboard"
            open={expanded}
          >
            <summary>
              <h2>Progress</h2>
            </summary>
            <div className="metric-grid">
              <article>
                <h3>Due reviews</h3>
                <strong>
                  {data.due.openings + data.due.puzzles + data.due.mistakes}
                </strong>
                <p>
                  <a href="#openings">{data.due.openings} openings</a> ·{" "}
                  <a href="#puzzles?mode=due">{data.due.puzzles} puzzles</a> ·{" "}
                  <a href="#games?mistakes=1">{data.due.mistakes} mistakes</a>
                </p>
              </article>
              <article>
                <h3>Puzzle rating</h3>
                <strong>{Math.round(data.rating)}</strong>
                <Sparkline values={data.ratingHistory.map((r) => r.rating)} />
              </article>
              <article>
                <h3>Threat Scan recall</h3>
                <strong>{percent(data.recall)}</strong>
                <p>Found / required marks across all scans</p>
              </article>
              <article>
                <h3>Golden Rules learned</h3>
                <strong>
                  {data.learnedRules} / {goldenRules.length}
                </strong>
                <p>
                  <a href="#rules">Revisit a principle</a>
                  {" ? "}
                  <a href="#rules-quiz">Take the Golden Rules quiz</a>
                </p>
              </article>
              <article>
                <h3>Repertoire in your games</h3>
                <strong>{percent(data.gameCoverage)}</strong>
                <p>
                  Share of opponent replies covered through move six, before a
                  game leaves your repertoire. Only imported games with a known
                  color count.
                </p>
              </article>
              {data.sides.map(({ side, coverage: c, cohort }) => (
                <article key={side}>
                  <h3>{side} repertoire</h3>
                  <CoverageBar {...c} />
                  <strong>
                    {c.mastered} / {c.total} mastered
                  </strong>
                  <p>
                    {c.discovered} discovered · {c.practised} practiced ·{" "}
                    {c.drill} in Drill · {cohort.active.length} active lines
                  </p>
                </article>
              ))}
            </div>
            <h3>Game Review trends</h3>
            <p>
              Accuracy uses the Lichess formula. Move labels are close to
              Chess.com. Trends use cached completed reviews; clearing that
              cache removes them.
            </p>
            {data.analysis.length ? (
              <div className="trend-table">
                <table>
                  <caption>Latest reviewed games, oldest to newest</caption>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Your accuracy</th>
                      <th>Your blunders per game</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.analysis.slice(-5).map((r) => (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>
                          {r.accuracy === null
                            ? "n/a"
                            : `${r.accuracy.toFixed(1)}%`}
                        </td>
                        <td>{r.blunders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                Review an imported game to start your accuracy and blunder
                trends.
              </p>
            )}
          </details>
        </>
      )}
    </div>
  );
}
