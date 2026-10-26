import { useEffect, useRef, useState } from "react";
import type { DrawShape } from "@lichess-org/chessground/draw";
import { Board } from "../board/Board";
import { Game, type Square } from "../game/Game";
import { PromotionPicker } from "../PromotionPicker";
import { Hint } from "./hint";
import { reviewEngine } from "./browserReview";
import { Scheduler, MemoryProgress } from "../scheduler/Scheduler";
import type { Progress } from "../progress/Progress";
import type { Settings } from "../settings";
import { MistakeSession, type PersonalCard } from "./personalCards";

export function MistakePractice({
  card,
  store,
  settings,
  engineHint = false,
  onClose,
}: {
  card: PersonalCard;
  store?: Progress | null;
  settings: Settings;
  engineHint?: boolean;
  onClose: () => void;
}) {
  const [session] = useState(
    () =>
      new MistakeSession(
        card,
        new Scheduler(() => [card], store ?? new MemoryProgress()),
      ),
  );
  const [game, setGame] = useState(() => new Game(card.fen));
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState(0);
  const [hintText, setHintText] = useState("");
  const [hintBusy, setHintBusy] = useState(false);
  const hintRequest = useRef(false);
  const generation = useRef(0);
  const [help] = useState(
    () =>
      new Hint(
        card.fen,
        engineHint ? { engine: reviewEngine } : { solution: card.solution },
      ),
  );
  useEffect(
    () => () => {
      generation.current++;
      help.reset();
    },
    [help],
  );
  function resetHint() {
    generation.current++;
    help.reset();
    hintRequest.current = false;
    setHintBusy(false);
    setHint(0);
    setHintText("");
  }
  async function showHint() {
    if (busy || solved || hintRequest.current || help.step >= 2) return;
    hintRequest.current = true;
    const current = generation.current;
    setHintBusy(true);
    try {
      const text = await help.next();
      session.hint(help.move);
      setHint(help.step);
      setHintText(text);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("Hint unavailable. Please try again.");
    } finally {
      if (generation.current === current) {
        hintRequest.current = false;
        setHintBusy(false);
      }
    }
  }
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  async function submit(uci: string) {
    if (busy || solved) return;
    setBusy(true);
    resetHint();
    setPromotion(null);
    try {
      const correct = await session.submit(uci);
      if (correct) {
        const next = new Game(card.fen);
        next.play(uci);
        setGame(next);
        setSolved(true);
        setMessage("Correct.");
      } else
        setMessage(
          `Try again. Better was ${new Game(card.fen).toSan(card.solution[0])}.`,
        );
    } catch {
      setMessage("Could not save this attempt. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mistake-practice" aria-label="Retry position">
      <h2>
        {store && !engineHint ? "Personal mistake training" : "Retry position"}
      </h2>
      <p>Find the engine's better move.</p>
      <div className="retry-board">
        <Board
          position={game.fen}
          orientation={card.side}
          movableSide={card.side}
          legalDests={game.destinations()}
          shapes={shapes}
          lastMove={game.lastMove}
          locked={busy || solved}
          check={game.check}
          turn={game.turn}
          coordinates={settings.coordinates}
          animationMs={settings.reducedMotion ? 0 : settings.animationMs}
          onShapesChange={setShapes}
          onMoveIntent={(from, to) => {
            if (game.promotions(from as Square, to as Square).length)
              setPromotion({ from: from as Square, to: to as Square });
            else void submit(from + to);
          }}
        />
      </div>
      <p aria-live="polite">{message}</p>
      {hintText && (
        <p
          className="lesson-idea"
          aria-label="Position hint"
          aria-live="polite"
        >
          {hintText}
        </p>
      )}
      <button
        disabled={busy || solved || hintBusy || hint >= 2}
        onClick={() => void showHint()}
      >
        Hint {Math.min(2, hint + 1)} / 2
      </button>{" "}
      {hintBusy && <span role="status">Finding a hint...</span>}
      <button disabled={busy} onClick={onClose}>
        {store && !engineHint ? "Back to training" : "Back to review"}
      </button>
      {promotion && (
        <PromotionPicker
          color={card.side}
          onCancel={() => setPromotion(null)}
          onPick={(piece) => void submit(promotion.from + promotion.to + piece)}
        />
      )}
    </section>
  );
}

export function PersonalTraining({
  store,
  settings,
  onClose,
}: {
  store: Progress | null;
  settings: Settings;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<PersonalCard[] | null>(null);
  const [selected, setSelected] = useState<PersonalCard | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try {
      if (!store) throw new Error();
      const all = await store.personalCards();
      setCards(await new Scheduler(() => all, store).due(Date.now()));
    } catch {
      setError("Could not load personal cards. Please reload.");
    }
  }
  if (selected)
    return (
      <MistakePractice
        key={selected.id}
        card={selected}
        store={store}
        settings={settings}
        onClose={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  return (
    <section aria-label="Personal mistake training">
      <h2>Personal mistake training</h2>
      <button onClick={() => void load()}>Load due cards</button>{" "}
      <button onClick={onClose}>Back to games</button>
      {error && <p role="alert">{error}</p>}
      {cards && <p>{cards.length} personal cards due</p>}
      {cards?.map((card) => (
        <p key={card.id}>
          <button onClick={() => setSelected(card)}>
            Train {card.side} position ·{" "}
            {new Date(card.createdAt).toLocaleDateString("en")}
          </button>
        </p>
      ))}
    </section>
  );
}
