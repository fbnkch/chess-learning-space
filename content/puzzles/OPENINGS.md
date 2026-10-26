# Opening puzzles (issue #27)

Selection uses the original Lichess OpeningTags in column 10 of the pinned
curated motif buckets. It filters reviewed variation tokens against the learner's
choices in content/white/*.pgn and content/black/*.pgn. Both solver colours remain
eligible. A tag describes an opening branch, not a guarantee that the puzzle's
later position or full game path matches a repertoire line.

## Repertoire decisions

- Italian (content/white/italian.pgn): 3.Bc4, 4.c3 against ...Bc5,
  followed by d3; against the Two Knights (...Nf6), 4.d3 then c3.
  Hungarian (...Be7) and Paris (...d6) are covered opponent choices.
  Giuoco Piano, Classical Variation and Two Knights Defense are accepted at
  their recorded coarse level: they name ...Bc5, c3 and ...Nf6 respectively.
  They do not prove that White later chose d3. Explicit Evans (b4), Scotch (d4),
  Ng5/Fried Liver and other unreviewed White systems are excluded.
- London (content/white/london.pgn): Bf4 before e3, with Nf3 and c3/Nbd2;
  ...d5, ...Nf6, early ...c5/...Qb6, ...g6 and ...f5 are opponent choices.
  Classical and accelerated aliases describe compatible move orders.
  No Jobava/Nc3 or other unreviewed named White system is admitted.
- Caro-Kann (content/black/caro.pgn): ...c6/...d5; against Nc3/Nd2,
  ...dxe4 and ...Bf5 (Classical, Main Line, Modern at their coarse tag level).
  Advance gets ...Bf5; Exchange ...cxd5; Panov ...Nf6/...e6;
  Accelerated Panov is covered by caro-c4; Two Knights gets ...dxe4/...Nf6
  and ...exf6; Fantasy (upstream Maroczy) gets ...e6; Breyer/d3 gets ...d5/...e5.
  Tartakower, Bronstein-Larsen and Karpov are alternative Black choices after
  the classical Nxe4, so the Two Knights ...Nf6 line does not admit them.
  Uncovered opponent sidelines and ambiguous Other_variations are omitted.
- QGD (content/black/qgd.pgn): ...d5/...e6/...Nf6, normally ...Be7,
  ...O-O/...Nbd7/...c6; Exchange gets ...exd5, Bf4 may get ...Bd6.
  Queens Knight, Normal, Traditional, Modern, Three Knights Variation,
  Exchange, Harrwitz, Orthodox/Neo-Orthodox, Miles and compatible
  Charousek/Barmen development orders retain this setup.
  Albin, Chigorin, Baltic, Marshall, Austrian, Tarrasch, Semi-Tarrasch,
  Ragozin, Vienna, Lasker and the other denied tags change Black's choices.
  Three_Knights (the early ...dxc4 Vienna branch) differs from the accepted
  Three_Knights_Variation. QGA, Slav and Semi-Slav are never selected.
  The repertoire's later ...c6 after ...Be7 is not a licence for a Slav setup.

Tag definitions were checked against the [Lichess opening database](https://github.com/lichess-org/chess-openings)
as well as the authored PGNs. This is a conservative tag policy, not path inference.

## Exact allow/deny lists

Each list below uses full upstream tokens. Only listed exact allow tokens count;
all unlisted variations and descendants are denied by default. No prefix allow
can silently admit a new system. Bare Italian/Caro/QGD family tokens and their
Other_variations cannot establish membership. London aliases are themselves
specific system tokens, so bare aliases and London_System_Other_variations count.
When both a family and a variation appear, the family cannot override a denial.
Every variation token belonging to a candidate family must be allowed; unrelated
upstream parent tokens (e.g. Queens_Pawn_Game) do not veto London.

### Italian: 362 puzzles

Allow:

- `Italian_Game_Giuoco_Pianissimo`
- `Italian_Game_Giuoco_Piano`
- `Italian_Game_Classical_Variation`
- `Italian_Game_Two_Knights_Defense`
- `Italian_Game_Hungarian_Defense`
- `Italian_Game_Paris_Defense`

Denied observed variations (in addition to all unlisted tags):

- `Italian_Game_Anti-Fried_Liver_Defense`
- `Italian_Game_Blackburne-Kostic_Gambit`
- `Italian_Game_Deutz_Gambit`
- `Italian_Game_Evans_Gambit`
- `Italian_Game_Evans_Gambit_Declined`
- `Italian_Game_Jerome_Gambit`
- `Italian_Game_Other_variations`
- `Italian_Game_Rosentreter_Gambit`
- `Italian_Game_Rousseau_Gambit`
- `Italian_Game_Schilling-Kostic_Gambit`
- `Italian_Game_Scotch_Gambit`
- `Italian_Game_Scotch_Gambit_Declined`
- `Italian_Game_Scotch_Invitation_Declined`

### London: 237 puzzles

Allow:

- `London_System`
- `London_System_Other_variations`
- `Indian_Defense_London_System`
- `Indian_Defense_Accelerated_London_System`
- `Queens_Pawn_Game_London_System`
- `Queens_Pawn_Game_Accelerated_London_System`

Denied observed variations (in addition to all unlisted tags):

None in the pinned buckets; unlisted named systems, including Jobava, are denied.

### Caro-Kann: 383 puzzles

Allow:

- `Caro-Kann_Defense_Advance_Variation`
- `Caro-Kann_Defense_Exchange_Variation`
- `Caro-Kann_Defense_Panov_Attack`
- `Caro-Kann_Defense_Accelerated_Panov_Attack`
- `Caro-Kann_Defense_Two_Knights_Attack`
- `Caro-Kann_Defense_Classical_Variation`
- `Caro-Kann_Defense_Main_Line`
- `Caro-Kann_Defense_Modern_Variation`
- `Caro-Kann_Defense_Maroczy_Variation`
- `Caro-Kann_Defense_Breyer_Variation`

Denied observed variations (in addition to all unlisted tags):

- `Caro-Kann_Defense_Alekhine_Gambit`
- `Caro-Kann_Defense_Alien_Gambit`
- `Caro-Kann_Defense_Bronstein-Larsen_Variation`
- `Caro-Kann_Defense_Campomanes_Attack`
- `Caro-Kann_Defense_Endgame_Offer`
- `Caro-Kann_Defense_Euwe_Attack`
- `Caro-Kann_Defense_Forgacs_Variation`
- `Caro-Kann_Defense_Goldman_Variation`
- `Caro-Kann_Defense_Hillbilly_Attack`
- `Caro-Kann_Defense_Karpov_Variation`
- `Caro-Kann_Defense_Masi_Variation`
- `Caro-Kann_Defense_Other_variations`
- `Caro-Kann_Defense_Rasa-Studier_Gambit`
- `Caro-Kann_Defense_Tartakower_Variation`
- `Caro-Kann_Defense_Toikkanen_Gambit`
- `Caro-Kann_Defense_Ulysses_Gambit`
- `Caro-Kann_Defense_von_Hennig_Gambit`

### QGD: 138 puzzles

Allow:

- `Queens_Gambit_Declined_Queens_Knight_Variation`
- `Queens_Gambit_Declined_Normal_Defense`
- `Queens_Gambit_Declined_Three_Knights_Variation`
- `Queens_Gambit_Declined_Traditional_Variation`
- `Queens_Gambit_Declined_Modern_Variation`
- `Queens_Gambit_Declined_Exchange_Variation`
- `Queens_Gambit_Declined_Harrwitz_Attack`
- `Queens_Gambit_Declined_Orthodox_Defense`
- `Queens_Gambit_Declined_Neo-Orthodox_Variation`
- `Queens_Gambit_Declined_Charousek_Variation`
- `Queens_Gambit_Declined_Barmen_Variation`
- `Queens_Gambit_Declined_Miles_Variation`

Denied observed variations (in addition to all unlisted tags):

- `Queens_Gambit_Declined_Albin_Countergambit`
- `Queens_Gambit_Declined_Alekhine_Variation`
- `Queens_Gambit_Declined_Austrian_Attack`
- `Queens_Gambit_Declined_Austrian_Defense`
- `Queens_Gambit_Declined_Baltic_Defense`
- `Queens_Gambit_Declined_Cambridge_Springs_Defense`
- `Queens_Gambit_Declined_Capablanca_Variation`
- `Queens_Gambit_Declined_Chigorin_Defense`
- `Queens_Gambit_Declined_Janowski_Variation`
- `Queens_Gambit_Declined_Lasker_Defense`
- `Queens_Gambit_Declined_Marshall_Defense`
- `Queens_Gambit_Declined_Other_variations`
- `Queens_Gambit_Declined_Ragozin_Defense`
- `Queens_Gambit_Declined_Semi-Tarrasch_Defense`
- `Queens_Gambit_Declined_Tarrasch_Defense`
- `Queens_Gambit_Declined_Three_Knights`
- `Queens_Gambit_Declined_Vienna_Variation`

## Provenance and rebuilding

All original fields/tags remain intact. The catalogue records every selected tag,
counts and the source snapshot SHA-256. SOURCE.json records the exact allowlists,
input checksums and derived output counts/hash. There are 1,120 unique puzzles;
IDs remain puzzle:<Lichess ID>, sharing first-encounter rating and SRS with motif mode.

Rebuild with npm run build:puzzles -- --openings-only using committed motif chunks.
The deterministic script verifies input checksums and the manifest snapshot before
writing. The full npm run build:puzzles also verifies the original archive first.
Original chunks and manifest must remain byte-identical; no CSV or repin is needed.
Rows use code-unit ID order. Repeated derivation produces the same bytes.

Input hashes normalise CRLF to LF, matching Git blobs on Windows and full archive
builds. The derived file disables newline conversion to preserve its output hash.
The catalogue is lazy loaded for Rated opening filters; Due resolves the same IDs
from the original chunks. Woodpecker keeps its fixed motif sets. Opening pages and
Home Today link these filters; no progress store or schema changes are needed.

Generated catalogue: 284,626 bytes (73,922 bytes gzip). SHA-256:
`5eddf7c8fcfbed9145fc28ff3270c80e40d4a5e11d4118ffbed5ca95c181a82b`.
