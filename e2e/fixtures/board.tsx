import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Board } from "../../src/board/Board";
import { Game } from "../../src/game/Game";
import type { Key } from "@lichess-org/chessground/types";
import type { DrawShape } from "@lichess-org/chessground/draw";
import "../../src/styles.css";
import "../../src/appearance.css";

export function Fixture() {
  const [notice, setNotice] = useState(false);
  const [locked, setLocked] = useState(false);
  const [side, setSide] = useState<"white" | "black">("white");
  const [intent, setIntent] = useState("");
  const [square, setSquare] = useState("");
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [castle, setCastle] = useState(false);
  const [game] = useState(() => new Game());
  const [castleDests] = useState(
    () => new Map<Key, Key[]>([["e1", ["f1", "g1", "h1"]]]),
  );
  return (
    <>
      <button onClick={() => setNotice(true)}>Show layout notice</button>
      {notice && <div style={{ height: 120 }}>A notice above the board</div>}
      <label>
        Locked
        <input
          type="checkbox"
          checked={locked}
          onChange={(e) => setLocked(e.target.checked)}
        />
      </label>
      <label>
        Movable side
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as "white" | "black")}
        >
          <option>white</option>
          <option>black</option>
        </select>
      </label>
      <button
        onClick={() =>
          setShapes([
            { orig: "a1", dest: "a4", brush: "green" },
            { orig: "c3", brush: "red" },
          ])
        }
      >
        Inject shapes
      </button>
      <button onClick={() => setCastle(true)}>Castling destinations</button>
      <output data-testid="intent">{intent}</output>
      <output data-testid="square">{square}</output>
      <output data-testid="original-dests">
        {castle && castleDests.get("e1")?.join(",")}
      </output>
      <div style={{ width: 480 }}>
        <Board
          position={castle ? "4k3/8/8/8/8/8/8/4K2R w K - 0 1" : game.fen}
          orientation="white"
          turn="white"
          movableSide={side}
          legalDests={castle ? castleDests : game.destinations()}
          locked={locked}
          check={false}
          coordinates
          animationMs={0}
          shapes={shapes}
          onShapesChange={setShapes}
          onMoveIntent={(from, to) => setIntent(from + to)}
          onSquareClick={setSquare}
        />
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
