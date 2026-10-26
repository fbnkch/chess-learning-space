import { MiniBoard } from "../MiniBoard";
import { useEffect, useRef, useState } from "react";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Key } from "@lichess-org/chessground/types";
import { Board } from "../board/Board";
import { Game } from "../game/Game";
import {
  goldenRules,
  phases,
  rulesByPhase,
  topRules,
  type GoldenRule,
  type RulePhase,
} from "./catalogue";

function RuleCard({
  rule,
  learned,
  disabled,
  coordinates,
  expanded,
  onExpand,
  onToggle,
}: {
  rule: GoldenRule;
  learned: boolean;
  disabled: boolean;
  coordinates: boolean;
  expanded: boolean;
  onExpand: () => void;
  onToggle: (learned: boolean) => Promise<void>;
}) {
  const [orientation, setOrientation] = useState<Color>("white");
  const [saving, setSaving] = useState(false);
  const [failedTarget, setFailedTarget] = useState<boolean | null>(null);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (expanded) card.current?.scrollIntoView({ block: "nearest" });
  }, [expanded]);
  async function save(next: boolean) {
    setSaving(true);
    setFailedTarget(null);
    try {
      await onToggle(next);
    } catch {
      setFailedTarget(next);
    } finally {
      setSaving(false);
    }
  }
  const phase = phases.find((entry) => entry.id === rule.phase)?.label;
  return (
    <article
      ref={card}
      id={`rule-${rule.id}`}
      className="rule-card"
      data-testid={`rule-${rule.id}`}
    >
      <div className="rule-body">
        <div className="rule-meta">
          {expanded && (
            <>
              {rule.priority !== null && (
                <span className="rule-top">TOP {rule.priority}</span>
              )}

              <span className="rule-creator">
                {rule.creators.length
                  ? rule.creators.join(" · ")
                  : "No single creator"}
              </span>
              {rule.sourceUrl ? (
                <a
                  className="rule-source"
                  href={rule.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source &#8599;
                </a>
              ) : (
                <span className="rule-unsourced">Unsourced</span>
              )}
            </>
          )}
        </div>
        <div className="rule-row">
          <MiniBoard
            fen={rule.exampleFen}
            orientation={
              rule.exampleFen.split(" ")[1] === "b" ? "black" : "white"
            }
            arrow={rule.arrows?.[0]}
          />
          <div>
            <span className="rule-phase">{phase}</span>
            <h3>{rule.shortForm}</h3>
          </div>
        </div>
        <div className="rule-actions">
          <button
            aria-expanded={expanded}
            aria-controls={`example-${rule.id}`}
            onClick={onExpand}
          >
            <span className={expanded ? undefined : "sr-only"}>
              {expanded ? "Hide example" : "Show example"}
            </span>
            {!expanded && <span aria-hidden="true">+</span>}
            <span className="sr-only">: {rule.shortForm}</span>
          </button>
          <button
            className={learned ? "rule-learned" : undefined}
            aria-label={`Mark ${rule.shortForm} as learned`}
            aria-pressed={learned}
            disabled={disabled || saving}
            onClick={() => void save(!learned)}
          >
            <span className={expanded ? undefined : "sr-only"}>
              {saving ? "Saving…" : learned ? "✓ Learned" : "Mark as learned"}
            </span>
            {!expanded && (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="m5 12 4 4 10-10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            )}
          </button>
          {failedTarget !== null && (
            <button onClick={() => void save(failedTarget)} disabled={saving}>
              Retry save
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="rule-detail" id={`example-${rule.id}`}>
          <RuleExample
            rule={rule}
            orientation={orientation}
            coordinates={coordinates}
            onFlip={() =>
              setOrientation(orientation === "white" ? "black" : "white")
            }
          />
          <div className="rule-body">
            <p className="rule-reason">{rule.reason}</p>
            {rule.exception && (
              <p className="rule-exception">
                <strong>Exception:</strong> {rule.exception}
              </p>
            )}
            {rule.exampleText && (
              <p className="rule-reason">
                <strong>Example:</strong> {rule.exampleText}
              </p>
            )}
            {!!rule.arrows?.length && (
              <ul className="rule-arrow-labels" aria-label="Board annotations">
                {rule.arrows.map((arrow, index) => (
                  <li key={index} data-kind={arrow.kind}>
                    {arrow.kind === "move"
                      ? "Move"
                      : arrow.kind === "plan"
                        ? "Plan"
                        : "Ray"}
                    : {arrow.label ?? `${arrow.from} → ${arrow.to}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function RuleExample({
  rule,
  orientation,
  coordinates,
  onFlip,
}: {
  rule: GoldenRule;
  orientation: Color;
  coordinates: boolean;
  onFlip: () => void;
}) {
  const game = new Game(rule.exampleFen);
  const shapes: DrawShape[] = [
    ...(rule.arrows ?? []).map((arrow) => ({
      orig: arrow.from as Key,
      dest: arrow.to as Key,
      brush:
        arrow.color ??
        (arrow.kind === "move"
          ? "green"
          : arrow.kind === "plan"
            ? "blue"
            : "yellow"),
      modifiers: { lineWidth: arrow.kind === "ray" ? 4 : 10 },
    })),
    ...(rule.circles ?? []).map((circle) => ({
      orig: circle.square as Key,
      brush: circle.color,
    })),
  ];
  return (
    <div className="rule-example">
      <div
        className="rule-board"
        aria-label={`Example position for ${rule.id}`}
      >
        <Board
          position={rule.exampleFen}
          orientation={orientation}
          movableSide={undefined}
          legalDests={new Map()}
          shapes={[]}
          ideaShapes={shapes}
          locked
          check={game.check}
          turn={game.turn}
          coordinates={coordinates}
          animationMs={0}
          onMoveIntent={() => {}}
          onShapesChange={() => {}}
        />
      </div>
      <div className="rule-board-controls">
        <span>{game.turn === "white" ? "White" : "Black"} to move</span>
        <button onClick={onFlip}>Flip board</button>
      </div>
    </div>
  );
}

export function GoldenRules({
  storageReady,
  learned,
  coordinates,
  onToggle,
}: {
  storageReady: boolean;
  learned: string[];
  coordinates: boolean;
  onToggle: (ruleId: string, learned: boolean) => Promise<void>;
}) {
  const learnedIds = new Set(learned);
  const [phaseFilter, setPhaseFilter] = useState<RulePhase | "all">("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [allOpen, setAllOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const matches = (rule: GoldenRule) =>
    stateFilter === "all" ||
    learnedIds.has(rule.id) === (stateFilter === "learned");
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Golden Rules</h1>

          <a href="#rules-quiz">Take the Golden Rules quiz</a>
        </div>
        <span className="pill">
          {goldenRules.filter((rule) => learnedIds.has(rule.id)).length} /{" "}
          {goldenRules.length} learned
        </span>
      </header>
      <section
        className="rule-section rule-top-entry"
        aria-labelledby="top-rules-heading"
        data-testid="top-rules"
      >
        <h2 id="top-rules-heading">Top 10 for 1000 Elo</h2>

        <ol>
          {topRules.map((rule) => (
            <li key={rule.id}>
              <button
                onClick={() => {
                  setPhaseFilter("all");
                  setStateFilter("all");
                  setAllOpen(true);
                  setExpandedId(rule.id);
                }}
              >
                <MiniBoard
                  fen={rule.exampleFen}
                  orientation={
                    rule.exampleFen.split(" ")[1] === "b" ? "black" : "white"
                  }
                  arrow={rule.arrows?.[0]}
                />
                <span>
                  {rule.shortForm}
                  <small>
                    {phases.find((p) => p.id === rule.phase)?.label}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <details
        className="all-rules"
        open={allOpen}
        onToggle={(e) => setAllOpen(e.currentTarget.open)}
      >
        <summary>All rules</summary>
        <div className="rule-filters">
          <label>
            Phase{" "}
            <select
              aria-label="Phase"
              value={phaseFilter}
              onChange={(event) =>
                setPhaseFilter(event.target.value as RulePhase | "all")
              }
            >
              <option value="all">All phases</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Learned state{" "}
            <select
              aria-label="Learned state"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
            >
              <option value="all">All rules</option>
              <option value="learned">Learned</option>
              <option value="unlearned">Unlearned</option>
            </select>
          </label>
        </div>
        {!goldenRules.some(
          (rule) =>
            (phaseFilter === "all" || rule.phase === phaseFilter) &&
            matches(rule),
        ) && <p role="status">No rules match these filters.</p>}
        {phases
          .filter((phase) => phaseFilter === "all" || phase.id === phaseFilter)
          .map((phase) => {
            const rules = rulesByPhase(phase.id).filter(matches);
            return rules.length ? (
              <section
                className="rule-section"
                aria-labelledby={`${phase.id}-heading`}
                key={phase.id}
              >
                <h2 id={`${phase.id}-heading`}>{phase.label}</h2>
                <div className="rule-grid">
                  {rules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      learned={learnedIds.has(rule.id)}
                      disabled={!storageReady}
                      coordinates={coordinates}
                      expanded={expandedId === rule.id}
                      onExpand={() =>
                        setExpandedId(expandedId === rule.id ? null : rule.id)
                      }
                      onToggle={(next) => onToggle(rule.id, next)}
                    />
                  ))}
                </div>
              </section>
            ) : null;
          })}
      </details>
    </>
  );
}
