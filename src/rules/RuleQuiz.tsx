import { useRef, useState } from "react";
import type { DrawShape } from "@lichess-org/chessground/draw";
import type { Key } from "@lichess-org/chessground/types";
import { ulid } from "ulid";
import { Board } from "../board/Board";
import { Game } from "../game/Game";
import type { Progress } from "../progress/Progress";
import type { Review } from "../scheduler/Scheduler";
import { goldenRules } from "./catalogue";
import { gradeAnswer, quizItems, type QuizItem } from "./quiz";
import "./quiz.css";

const clock = Date.now;

export function RuleQuiz({
  store,
  coordinates,
  onSaved,
}: {
  store: Progress | null;
  coordinates: boolean;
  onSaved: () => Promise<void>;
}) {
  const [scope, setScope] = useState("all");
  const [run, setRun] = useState(0);
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Golden Rules quiz</h1>
          <p>
            Choose the principle illustrated by the position and its idea.
            Correct answers count as learned; this quiz does not schedule
            reviews.
          </p>
          <a href="#rules">Browse Golden Rules</a>
        </div>
      </header>
      <label className="quiz-filter">
        Quiz rules{" "}
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <option value="all">All 42 rules</option>
          {goldenRules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.shortForm}
            </option>
          ))}
        </select>
      </label>
      <QuizRun
        key={`${scope}-${run}`}
        items={quizItems.filter(
          (item) => scope === "all" || item.rule.id === scope,
        )}
        store={store}
        coordinates={coordinates}
        onSaved={onSaved}
        onRestart={() => setRun((value) => value + 1)}
      />
    </>
  );
}

function QuizRun({
  items,
  store,
  coordinates,
  onSaved,
  onRestart,
}: {
  items: QuizItem[];
  store: Progress | null;
  coordinates: boolean;
  onSaved: () => Promise<void>;
  onRestart: () => void;
}) {
  const [questions] = useState(() => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  });
  const [sessionId] = useState(ulid);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Review | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [startedAt] = useState(clock);
  const started = useRef(startedAt);
  const saving = useRef(false);
  const question = questions[index];
  async function save(review: Review) {
    if (!store || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await store.record(review);
      await onSaved();
      setSaved(true);
    } catch {
      setError("Could not save your answer. Retry before continuing.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function choose(ruleId: string) {
    if (answer || !store || saving.current) return;
    const review = gradeAnswer(question, ruleId, {
      attemptId: ulid(),
      sessionId,
      at: clock(),
      durationMs: Math.max(0, clock() - started.current),
    });
    setAnswer(review);
    if (review.grade === "good") setScore((value) => value + 1);
    void save(review);
  }
  if (!question)
    return (
      <section className="rule-section" aria-label="Quiz results">
        <h2>Quiz complete</h2>
        <p>
          {score} / {questions.length} correct
        </p>
        <p>
          Revisit the explanations for any rules you missed, then try again.
        </p>
        <button onClick={onRestart}>Try again</button>{" "}
        <a href="#rules">Review Golden Rules</a>
      </section>
    );
  const game = new Game(question.fen);
  const move = question.move ? game.play(question.move) : null;
  const position = game.fen;
  const annotations: DrawShape[] = question.move
    ? []
    : [
        ...(question.rule.arrows ?? []).map((arrow) => ({
          orig: arrow.from as Key,
          dest: arrow.to as Key,
          brush:
            arrow.color ??
            (arrow.kind === "move"
              ? "green"
              : arrow.kind === "plan"
                ? "blue"
                : "yellow"),
        })),
        ...(question.rule.circles ?? []).map((circle) => ({
          orig: circle.square as Key,
          brush: circle.color,
        })),
      ];
  return (
    <section className="rule-quiz" aria-label="Rule question">
      <div>
        <div className="rule-board" aria-label="Quiz example position">
          <Board
            position={position}
            orientation={question.fen.split(" ")[1] === "w" ? "white" : "black"}
            movableSide={undefined}
            legalDests={new Map()}
            shapes={[]}
            ideaShapes={annotations}
            locked
            check={game.check}
            turn={game.turn}
            coordinates={coordinates}
            animationMs={0}
            lastMove={move ? [move.from, move.to] : undefined}
            onMoveIntent={() => {}}
            onShapesChange={() => {}}
          />
        </div>
        <p>
          {question.move
            ? `Repertoire example: ${move?.san}`
            : `Example position · ${game.turn === "white" ? "White" : "Black"} to move`}
        </p>
      </div>
      <div className="rule-body">
        <p className="eyebrow">
          QUESTION {index + 1} OF {questions.length}
        </p>
        <h2>Which rule applies here?</h2>
        <p>{question.idea}</p>
        {!question.move &&
          question.rule.arrows?.map((arrow, i) => (
            <p key={i}>
              {arrow.kind === "move"
                ? "Move"
                : arrow.kind === "plan"
                  ? "Plan"
                  : "Ray"}
              : {arrow.label ?? `${arrow.from} -> ${arrow.to}`}
            </p>
          ))}
        <div className="quiz-choices">
          {question.choices.map((choice) => (
            <button
              key={choice.id}
              disabled={!store || !!answer || busy}
              onClick={() => choose(choice.id)}
            >
              {choice.shortForm}
            </button>
          ))}
        </div>
        {!store && (
          <p role="status">
            Progress storage is unavailable. Reload to start the quiz.
          </p>
        )}
        {answer && (
          <div className="quiz-feedback" role="status">
            <h3>{answer.grade === "good" ? "Correct" : "Not quite"}</h3>
            <strong>{question.rule.shortForm}</strong>
            <p>{question.rule.reason}</p>
            <p>
              <strong>Why the other rule does not apply:</strong>{" "}
              {question.distractorReason}
            </p>
            {question.rule.exception && (
              <p>
                <strong>Exception:</strong> {question.rule.exception}
              </p>
            )}
            <p>
              <a href="#rules">Explore this rule in Golden Rules</a>
            </p>
            <button
              disabled={!saved || busy}
              onClick={() => {
                setIndex((value) => value + 1);
                setAnswer(null);
                setSaved(false);
                started.current = clock();
              }}
            >
              {busy
                ? "Saving…"
                : index + 1 === questions.length
                  ? "See results"
                  : "Next question"}
            </button>
          </div>
        )}
        {error && (
          <p role="alert">
            {error}{" "}
            <button disabled={busy} onClick={() => answer && void save(answer)}>
              Retry save
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
