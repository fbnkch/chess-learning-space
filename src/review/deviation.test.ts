import { expect, it } from "vitest";
import { compilePgn } from "../repertoire/compiler";
import { Repertoire } from "../repertoire/Repertoire";
import { Game } from "../game/Game";
import { repertoireDeviation } from "./deviation";

it("distinguishes our deviation, unknown replies and line ends, and records re-entry", () => {
  const rep = new Repertoire({
    white: compilePgn('[LineId "test"]\n\n1. e4 e5 2. Nf3 *', "white"),
  });
  expect(repertoireDeviation(Game.fromPgn("1. d4 *"), "white", rep)?.kind).toBe(
    "our-deviation",
  );
  expect(
    repertoireDeviation(Game.fromPgn("1. e4 c5 *"), "white", rep)?.kind,
  ).toBe("unknown-reply");
  expect(
    repertoireDeviation(Game.fromPgn("1. e4 e5 2. Nf3 Nc6 *"), "white", rep)
      ?.kind,
  ).toBe("line-end");
  expect(
    repertoireDeviation(Game.fromPgn("1. e4 e5 2. Nf3 *"), "white", rep),
  ).toBeNull();
  const result = repertoireDeviation(
    Game.fromPgn("1. Nf3 e5 2. e4 *"),
    "white",
    rep,
  );
  expect(result?.ply).toBe(0);
  expect(result?.reentries).toEqual([2]);
});
