import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MiniBoard } from "./MiniBoard";

const fen = "7k/8/8/8/8/8/8/R6K w - - 0 1";
describe("MiniBoard", () => {
  it("draws 64 squares and the actual FEN pieces using same-origin artwork", () => {
    const svg = renderToStaticMarkup(createElement(MiniBoard, { fen }));
    expect(svg.match(/<rect /g)).toHaveLength(64);
    expect(svg.match(/<image /g)).toHaveLength(3);
    expect(svg).toContain(
      'x="0" y="70" width="10" height="10" href="/pieces/wR.svg"',
    );
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("cg-board");
  });
  it("rotates pieces, highlights and arrows together for Black, with an accessible label", () => {
    const svg = renderToStaticMarkup(
      createElement(MiniBoard, {
        fen,
        orientation: "black",
        lastMove: ["a1", "a2"],
        arrow: { from: "a1", to: "a2" },
        label: "Black to move",
      }),
    );
    expect(svg).toContain(
      'x="70" y="0" width="10" height="10" href="/pieces/wR.svg"',
    );
    expect(svg).toContain(
      'x="70" y="10" width="10" height="10" fill="var(--last-move)"',
    );
    expect(svg).toContain('x1="75" y1="5" x2="75" y2="15"');
    expect(svg).toContain('role="img" aria-label="Black to move"');
    expect(svg).not.toContain('aria-hidden="true"');
  });
});
