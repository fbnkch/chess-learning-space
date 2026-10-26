/** Repertoire-reviewed Lichess tags; see content/puzzles/OPENINGS.md. */
export const puzzleOpeningGroups = [
  {
    id: "italian",
    name: "Italian",
    tags: ["Italian_Game"],
    variations: [
      "Giuoco_Pianissimo",
      "Giuoco_Piano",
      "Classical_Variation",
      "Two_Knights_Defense",
      "Hungarian_Defense",
      "Paris_Defense",
    ].map((tag) => "Italian_Game_" + tag),
  },
  {
    id: "london",
    name: "London",
    tags: [
      "London_System",
      "Indian_Defense_London_System",
      "Indian_Defense_Accelerated_London_System",
      "Queens_Pawn_Game_London_System",
      "Queens_Pawn_Game_Accelerated_London_System",
    ],
    variations: [
      "London_System",
      "London_System_Other_variations",
      "Indian_Defense_London_System",
      "Indian_Defense_Accelerated_London_System",
      "Queens_Pawn_Game_London_System",
      "Queens_Pawn_Game_Accelerated_London_System",
    ],
  },
  {
    id: "caro",
    name: "Caro-Kann",
    tags: ["Caro-Kann_Defense"],
    variations: [
      "Advance_Variation",
      "Exchange_Variation",
      "Panov_Attack",
      "Accelerated_Panov_Attack",
      "Two_Knights_Attack",
      "Classical_Variation",
      "Main_Line",
      "Modern_Variation",
      "Maroczy_Variation",
      "Breyer_Variation",
    ].map((tag) => "Caro-Kann_Defense_" + tag),
  },
  {
    id: "qgd",
    name: "QGD",
    tags: ["Queens_Gambit_Declined"],
    variations: [
      "Queens_Knight_Variation",
      "Normal_Defense",
      "Three_Knights_Variation",
      "Traditional_Variation",
      "Modern_Variation",
      "Exchange_Variation",
      "Harrwitz_Attack",
      "Orthodox_Defense",
      "Neo-Orthodox_Variation",
      "Charousek_Variation",
      "Barmen_Variation",
      "Miles_Variation",
    ].map((tag) => "Queens_Gambit_Declined_" + tag),
  },
] as const;
export type PuzzleOpening = (typeof puzzleOpeningGroups)[number]["id"];
export type OpeningFilter = "all" | "repertoire" | PuzzleOpening;
export function puzzleOpenings(tags: string): PuzzleOpening[] {
  const tokens = tags.split(/\s+/);
  return puzzleOpeningGroups
    .filter((group) => {
      const familyTags = tokens.filter((tag) =>
        group.tags.some(
          (family) => tag === family || tag.startsWith(family + "_"),
        ),
      );
      // Upstream emits both a family and a variation. A family must never
      // override an unreviewed variation, including a more specific subvariation.
      const variations = familyTags.filter(
        (tag) =>
          !group.tags.some((family) => tag === family) ||
          group.variations.some((allowed) => tag === allowed),
      );
      return (
        variations.length > 0 &&
        variations.every((tag) =>
          group.variations.some((allowed) => tag === allowed),
        )
      );
    })
    .map((group) => group.id);
}

export function openingFilter(value: string | null): OpeningFilter {
  return value === "repertoire" ||
    puzzleOpeningGroups.some((g) => g.id === value)
    ? (value as OpeningFilter)
    : "all";
}
