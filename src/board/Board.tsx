import { useLayoutEffect, useRef } from "react";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import type { Color, Dests, Key } from "@lichess-org/chessground/types";
import { read, write } from "@lichess-org/chessground/fen";
import type { DrawShape } from "@lichess-org/chessground/draw";
import "@lichess-org/chessground/assets/chessground.base.css";
import "./board.css";

export interface BoardProps {
  position: string;
  provisionalMove?: { from: Key; to: Key };
  orientation: Color;
  movableSide: Color | "both" | undefined;
  legalDests: Dests;
  shapes: DrawShape[];
  ideaShapes?: DrawShape[];
  lastMove?: Key[];
  locked: boolean;
  check: boolean;
  turn: Color;
  coordinates: boolean;
  animationMs: number;
  onSquareClick?: (square: Key) => void;
  marking?: boolean;
  drawingEnabled?: boolean;
  onMoveIntent: (from: Key, to: Key) => void;
  onShapesChange: (shapes: DrawShape[]) => void;
}

/** Presentation only: the caller decides whether and how a move is committed. */
export function Board(props: BoardProps) {
  const element = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  // Stable callbacks let Chessground keep its listeners while React updates the game.
  const callbacks = useRef(props);
  useLayoutEffect(() => {
    callbacks.current = props;
  });
  useLayoutEffect(() => {
    if (!element.current) return;
    api.current = Chessground(element.current, {
      // Start at the target position; only subsequent FEN updates should animate.
      fen: callbacks.current.position,
      draggable: { showGhost: false },
      events: { select: (square) => callbacks.current.onSquareClick?.(square) },
      movable: {
        events: {
          after: (from, to) => callbacks.current.onMoveIntent(from, to),
        },
      },
      drawable: {
        onChange: (shapes) => callbacks.current.onShapesChange([...shapes]),
      },
    });
    return () => {
      api.current?.destroy();
      api.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    const pieces = read(props.position);
    if (props.provisionalMove) {
      const { from, to } = props.provisionalMove;
      const pawn = pieces.get(from);
      if (pawn) {
        pieces.delete(from);
        pieces.set(to, pawn);
      }
    }
    // Chessground uses literal SVG stroke attributes; resolve semantic tokens
    // here so the existing drawing contract and colour selectors stay intact.
    const palette = getComputedStyle(element.current!);
    const brushColor = (token: string) => palette.getPropertyValue(token).trim();
    const config: Config = {
      fen: write(pieces),
      orientation: props.orientation,
      turnColor: props.turn,
      check: props.check,
      lastMove: props.lastMove,
      coordinates: props.coordinates,
      animation: {
        enabled: props.animationMs > 0,
        duration: props.animationMs,
      },
      movable: {
        free: false,
        color: props.locked ? undefined : props.movableSide,
        dests: props.locked ? new Map() : new Map(props.legalDests),
        showDests: true,
        rookCastle: false,
      },
      premovable: { enabled: false },
      predroppable: { enabled: false },
      draggable: { enabled: !props.locked, showGhost: false },
      selectable: { enabled: !props.locked },
      drawable: {
        enabled: props.drawingEnabled ?? true,
        visible: true,
        eraseOnClick: !props.marking,
        shapes: [...props.shapes],
        autoShapes: [...(props.ideaShapes ?? [])],
        brushes: {
          green: {
            key: "green",
            color: brushColor("--annotation-move"),
            opacity: 1,
            lineWidth: 10,
          },
          red: {
            key: "red",
            color: brushColor("--annotation-danger"),
            opacity: 1,
            lineWidth: 10,
          },
          blue: {
            key: "blue",
            color: brushColor("--annotation-plan"),
            opacity: 1,
            lineWidth: 10,
          },
          yellow: {
            key: "yellow",
            color: brushColor("--annotation-ray"),
            opacity: 1,
            lineWidth: 10,
          },
        },
      },
      disableContextMenu: true,
    };
    const coordinatesChanged =
      api.current?.state.coordinates !== props.coordinates;
    // Notices and feedback can move the board without resizing it or scrolling.
    // Chessground otherwise keeps coordinates from before that layout change.
    api.current?.state.dom.bounds.clear();
    api.current?.set(config);
    // Coordinate nodes are built by redrawAll, not by Chessground's incremental render.
    if (coordinatesChanged) api.current?.redrawAll();
  });
  function markSquare(
    event: { preventDefault: () => void; stopPropagation: () => void },
    x: number,
    y: number,
  ) {
    if (!props.marking || props.locked) return;
    const square = api.current?.getKeyAtDomPos([x, y]);
    if (!square) return;
    // Chessground clears drawings on empty/enemy-square clicks even with
    // eraseOnClick disabled. Marking must bypass its move-selection handler.
    event.preventDefault();
    event.stopPropagation();
    props.onSquareClick?.(square);
  }
  return (
    <div
      className="board-frame"
      onMouseDownCapture={(event) => {
        if (event.button === 0 && !event.shiftKey)
          markSquare(event, event.clientX, event.clientY);
      }}
      onTouchStartCapture={(event) => {
        if (event.touches.length === 1) {
          const touch = event.touches[0];
          markSquare(event, touch.clientX, touch.clientY);
        }
      }}
    >
      <div
        ref={element}
        className="cg-wrap"
        data-testid="board"
        role="group"
        aria-label="Chess board"
      />
    </div>
  );
}
