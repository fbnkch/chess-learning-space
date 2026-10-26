import { useId } from "react";

/** A position, not a second interactive board. FEN and orientation come from its owner. */
export function MiniBoard({
  fen,
  orientation = "white",
  lastMove,
  arrow,
  label,
}: {
  fen: string;
  orientation?: "white" | "black";
  lastMove?: readonly string[];
  arrow?: { from: string; to: string };
  label?: string;
}) {
  const marker = useId();
  const rows = fen.split(" ")[0].split("/");
  const pieces = rows.flatMap((row, rank) => {
    let file = 0;
    return [...row].flatMap((piece) => {
      if (/\d/.test(piece)) {
        file += Number(piece);
        return [];
      }
      const square = `${"abcdefgh"[file]}${8 - rank}`;
      return [{ piece, square, file: file++, rank }];
    });
  });
  const point = (square: string) => {
    const file = "abcdefgh".indexOf(square[0]);
    const rank = 8 - Number(square[1]);
    return orientation === "white" ? [file, rank] : [7 - file, 7 - rank];
  };
  return (
    <svg
      className="mini-board"
      viewBox="0 0 80 80"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {Array.from({ length: 64 }, (_, i) => (
        <rect
          key={i}
          x={(i % 8) * 10}
          y={Math.floor(i / 8) * 10}
          width="10"
          height="10"
          fill={
            (i + Math.floor(i / 8)) % 2
              ? "var(--square-dark)"
              : "var(--square-light)"
          }
        />
      ))}
      {lastMove?.map((square) => {
        const [x, y] = point(square);
        return (
          <rect
            key={square}
            x={x * 10}
            y={y * 10}
            width="10"
            height="10"
            fill="var(--last-move)"
          />
        );
      })}
      {pieces.map(({ piece, square }) => {
        const [x, y] = point(square);
        return (
          <image
            key={square}
            x={x * 10}
            y={y * 10}
            width="10"
            height="10"
            href={`/pieces/${piece === piece.toUpperCase() ? "w" : "b"}${piece.toUpperCase()}.svg`}
          />
        );
      })}
      {arrow &&
        (() => {
          const [x1, y1] = point(arrow.from),
            [x2, y2] = point(arrow.to);
          return (
            <>
              <defs>
                <marker
                  id={marker}
                  viewBox="0 0 6 6"
                  refX="5"
                  refY="3"
                  markerWidth="3"
                  markerHeight="3"
                  orient="auto"
                >
                  <path d="M0 0 6 3 0 6Z" fill="var(--annotation-move)" />
                </marker>
              </defs>
              <line
                x1={x1 * 10 + 5}
                y1={y1 * 10 + 5}
                x2={x2 * 10 + 5}
                y2={y2 * 10 + 5}
                stroke="var(--annotation-move)"
                strokeWidth="2"
                markerEnd={`url(#${marker})`}
              />
            </>
          );
        })()}
    </svg>
  );
}
