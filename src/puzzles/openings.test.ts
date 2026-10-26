import { describe, expect, it } from "vitest";
import { openingFilter, puzzleOpenings } from "./openings";

describe("opening puzzle membership", () => {
  it("recognises the actual Lichess repertoire families and London aliases", () => {
    expect(
      puzzleOpenings("Italian_Game Italian_Game_Giuoco_Pianissimo"),
    ).toEqual(["italian"]);
    expect(puzzleOpenings("Indian_Defense_London_System")).toEqual(["london"]);
    expect(
      puzzleOpenings("Queens_Pawn_Game_Accelerated_London_System"),
    ).toEqual(["london"]);
    expect(puzzleOpenings("London_System_Other_variations")).toEqual([
      "london",
    ]);
    expect(puzzleOpenings("Caro-Kann_Defense_Advance_Variation")).toEqual([
      "caro",
    ]);
    expect(puzzleOpenings("Queens_Gambit_Declined_Exchange_Variation")).toEqual(
      ["qgd"],
    );
  });
});

it("does not mistake similarly named openings or partial tokens for our repertoire", () => {
  for (const tag of [
    "",
    "Four_Knights_Game_Italian_Variation",
    "English_Opening_Caro-Kann_Defensive_System",
    "Not_Italian_Game",
    "Italian_Games",
    "Kings_Gambit_Declined",
  ])
    expect(puzzleOpenings(tag)).toEqual([]);
});

it("accepts only supported opening deep links", () => {
  expect(openingFilter("italian")).toBe("italian");
  expect(openingFilter("repertoire")).toBe("repertoire");
  expect(openingFilter("sicilian")).toBe("all");
  expect(openingFilter(null)).toBe("all");
});

it("rejects variations that replace our repertoire moves even with a family tag", () => {
  for (const tag of [
    "Italian_Game_Evans_Gambit",
    "Italian_Game_Evans_Gambit_Declined",
    "Italian_Game_Scotch_Gambit",
    "Italian_Game_Two_Knights_Defense_Knight_Attack",
    "Italian_Game_Classical_Variation_Center_Attack",
    "Queens_Gambit_Declined_Albin_Countergambit",
    "Queens_Gambit_Declined_Chigorin_Defense",
    "Queens_Gambit_Declined_Baltic_Defense",
    "Queens_Gambit_Declined_Marshall_Defense",
    "Queens_Gambit_Declined_Tarrasch_Defense",
    "Queens_Gambit_Declined_Semi-Tarrasch_Defense",
    "Queens_Gambit_Declined_Ragozin_Defense",
    "Queens_Gambit_Declined_Semi-Slav_Defense",
    "Queens_Gambit_Accepted",
    "Slav_Defense",
    "Semi-Slav_Defense",
    "Caro-Kann_Defense_Tartakower_Variation",
    "Caro-Kann_Defense_Karpov_Variation",
    "Caro-Kann_Defense_Bronstein-Larsen_Variation",
    "Caro-Kann_Defense_Masi_Variation",
    "London_System_Jobava_System",
    "Queens_Pawn_Game_London_System_Jobava_System",
    "Italian_Game_Unreviewed_Variation",
  ]) {
    const family = tag.startsWith("Italian_Game_")
      ? "Italian_Game"
      : tag.startsWith("Queens_Gambit_Declined_")
        ? "Queens_Gambit_Declined"
        : tag.startsWith("Caro-Kann_Defense_")
          ? "Caro-Kann_Defense"
          : "";
    expect(puzzleOpenings(family + " " + tag), tag).toEqual([]);
  }
});
