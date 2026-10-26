# Repertoire authoring

PGNs live in `content/white/` and `content/black/`; each side compiles into its own position graph (ADR-0001). Card identity is `rep:<side>:<positionKey>` (ADR-0002), independent of opening group or move order. Use the White branch conventions: `[OpeningGroup "italian|london|sidelines|caro|qgd"]`, `[Summary "..."]`, a stable `[LineId "..."]` and `[%line ...]`. Shared edges must have identical annotations; unannotated repeats are allowed. Each of our moves has a one-sentence idea and existing `[%rules ...]` IDs; use `[%cal ...]` for useful idea arrows. Cap each line at eight of our moves.

## White repertoire (#7)

The 28 authored lines contain at most eight White moves each. Stable line IDs are explicit in headers and comments; existing `italian-pianissimo-main` identity and card position keys are preserved. All prose is newly written. Lichess study PGNs were not copied.

### White coverage

- Italian: 6 lines (Pianissimo main, early ...d5, Two Knights 4.d3, ...Be7, ...d6, queen/bishop pressure pattern).
- London: 8 lines (...d5, ...Nf6, early ...c5, earliest ...Qb6, ...Qb6 after c3, KID-like ...g6, Grunfeld-like ...g6/...d5, Dutch).
- 1.e4 sidelines: 14 lines: Alapin 2, Alekhine 1, Exchange Caro 1, Exchange French 1, Modern 1, Nimzowitsch 2, Petrov 2, Philidor 1, Pirc 1, Scandinavian 2.

There are 144 unique White position cards. Opening counts overlap intentionally: Italian 24, London 41, sidelines 88. The root card is shared even between 1.e4 and 1.d4; selected opening graphs give it the correct move, hint and line context while retaining the same scheduling identity (ADR-0001/0002). Whole-line practice uses the chosen line; due drilling can use the chosen line or the whole opening group. Reset retains the session identity.

### White source decisions and factual checks

Priority: `docs/research/06-creator-videos-openings.md`, then `07-lichess-studies.md` as reference only, then 04 Part B and 01. The final coverage list in issue #1 supersedes the older alternatives in 04.

- Astaneh's Pianissimo stays: 4.c3 Nf6 5.d3; add 5...O-O 6.O-O d5 7.exd5 Nxd5 8.Re1. In that exchanged centre White no longer has an e4 pawn, so this branch has its own structure summary. Nbd2-f1-g3 is a later plan, beyond the eight-move cap. Do not add premature h3 as an automatic response to ...h6/...g5.
- The Remote Chess Academy 5.d4 gambit and Gotham's Ponziani are not replacements for this repertoire. The Two Knights line uses 4.d3 instead of the Fried Liver's forcing Ng5 branch.
- Alapin covers both 2...d5 and 2...Nf6, following Gotham's central plans. After ...Qxd5, Nf3 does **not** attack the queen: it develops and prepares d4. Nc3 is blocked by the c3 pawn.
- The London transcript recommendation Nc3 against ...Qb6 does **not** physically defend b2. We choose 1.d4 d5 2.Bf4 c5 3.e3 Qb6 4.Qc1, a direct defence. Qb3 is illegal here while c2 is occupied; after 3...Nc6 4.c3 Qb6 it becomes legal and is a separate queen-exchange line. The test verifies that ...Qxb2 remains legal after Nc3 and that Qc1 defends b2. This is a deliberate conservative alternative to the source's gambit, independently engine-checked.
- Against ...g6 the London uses quiet kingside castling instead of the source's sharper Qd2/O-O-O/h4 attack. KID-like ...d6/...e5 and Grunfeld-like ...d5/...c5 structures are separate.
- Scholar's Mate is taught as queen/bishop cooperation. In the authored ...Qf6 position, Nf3 blocks the queen from attacking f2; castling adds the f1 rook as a defender. Board tests check the actual attack geometry.
- The Petrov's 4.Qe2 attacks the knight and prepares a discovered check, rather than absolutely pinning the black knight (White's own Ne5 blocks the e-file). The authored ...Nf6? retreat is punished by Nc6+ and Nxd8; the prose explicitly notes ...Qe7 as another defence. The board test verifies the queen capture.
- Legal's mate is a conditional pattern in the Philidor summary, not a recommended blind queen sacrifice. The exact illustrative sequence is replayed to checkmate in the tests, with ...dxe5 mentioned as an alternative to greedy ...Bxd1.
- Bxh7+ is a calculation pattern with king escapes and defenders to inspect, not a promised win in the London setup.

Reply weights are position-specific **relative estimates**, guided by the club-level ranks in research 04 Part B, rather than measured explorer percentages. They appear only in [%weight n] tags; the trainer normalises the weights over the replies included at that position, so omitted replies are not simulated. Keep this qualification here, never in learner-facing move comments. Shared edges carry identical annotations across transpositions.

| Position | Authored reply weights |
| --- | --- |
| 1.e4 | ...e5 40, ...c5 21, ...e6 10, ...c6 9, ...d6 7, ...d5 4, ...Nf6 3, ...g6 3, ...Nc6 2 |
| 1.e4 e5 2.Nf3 | ...Nc6 60, ...Nf6 10, ...d6 8 |
| 1.e4 e5 2.Nf3 Nc6 3.Bc4 | ...Bc5 43, ...Nf6 33, ...Be7 7, ...d6 5 |
| Italian: 3...Bc5 4.c3 | ...Nf6 53, ...Qf6 2 |
| Italian: 4...Nf6 5.d3 | ...d6 50, ...O-O 30 |
| 1.d4 | ...Nf6 39, ...d5 33, ...f5 3 |
| 1.d4 d5 2.Bf4 | ...Nf6 35, ...c5 18 |
| 1.d4 Nf6 2.Bf4 | ...d5 35, ...g6 25 |
| 1.e4 c5 2.c3 | ...d5 35, ...Nf6 30 |
| Scandinavian: 1.e4 d5 2.exd5 Qxd5 3.Nc3 | ...Qa5 50, ...Qd6 25 |

The quieter ...Be7 and ...d6 Italian branches both retain d3, c3 and kingside castling. The older research move choices for these branches are superseded by issue #7's quiet-setup requirement.

## Black coverage (#8)

- Caro-Kann: 12 lines: Classical Nc3, Classical Nd2, Classical h4, Advance, Advance h4, Exchange, Panov, Fantasy, Two Knights (2.Nc3), early 2.Nf3, 2.c4, KIA-style 2.d3.
- QGD/setup: 11 lines: Nc3, Nf3, early Exchange/Carlsbad, QGD Bf4/Bd6, London, Colle, English transposition, Reti transposition, English without d4, Reti without d4, Exchange Bf4/Bf5.
- English/Reti entries include genuine non-transposing setups, so White need not cooperate with d4. Matching positions merge into one node and one card. The Reti reaches the common QGD position after an additional Nf3: the bare position after 1.d4 d5 2.c4 e6 cannot be identical to one with a knight already on f3.
- The trainer filters the same graph by group or line, retaining shared scheduling IDs; White and Black cards are both included in progress, backup retirement detection and scheduling. Choosing Black orients the board and input for Black.

## Black decisions and factual review

Priority: transcript-based research 06, research 07 as reference only, then research 01 and 04. Research 01's emphasis on safety and plans motivates short lines and conditional trap explanations.

- Advance: choose **3...Bf5**, then ...e6/...c5 (Big Greek and the Caro masterclass). Gotham's immediate ...c5 is playable but introduces different central tactics; one bishop-outside-chain plan is simpler at 1000 Elo.
- Fantasy: choose **3...e6** (Big Greek). Gotham's ...g6 and ...dxe4 4.fxe4 e5 are not additional repertoire answers; the latter is explicitly described as tricky in the transcript. We choose a solid centre and normal development.
- Classical: use ...dxe4 and ...Bf5 against both Nc3 and Nd2. After Ng3 Bg6 h4, **...h6** provides h7; after Advance e5 Bf5 h4, **...h5** stops h4-h5 in that distinct structure. Do not conflate these patterns. Board replay tests verify the retreat and a bishop capture if the retreat problem is ignored.
- Two Knights: choose ...dxe4 and ...Nf6 (including 2.Nf3 transposition); unlike the Classical there is no white pawn on d4 yet. This avoids adding the separate ...Bg4/h3/Bxf3 system from research 04. After Nxf6+ use ...exf6, develop Bd6 and castle. Early 2.c4 uses ...d5 and development before recapturing on d5. Panov uses ...Nf6/...e6/...Be7 and a blockade plan.
- QGD Nc3/Nf3: keep the classical ...Nf6/...Be7 development, with ...Nbd7 and ...c6. Naroditsky's **...Nbd7 before ...Ngf6** is applied to the **London ...e6/...Bd6** setup, not claimed as a universal move-order rule. QGD Bf4 gets ...Bd6; Exchange Bf4 gets ...Bf5. This preserves the source's two bishop-placement ideas while keeping one answer at each shared position.
- Carlsbad: recognise the pawn structure, the b4-b5 minority attack and c6 weakness; prepare ...c5 against d4 supporting a Pillsbury knight on e5. It is a plan to calculate, not an automatic move or a promise of equality.
- Elephant trap is a conditional **pattern**, not a recommended losing line: `1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Nbd7 5.cxd5 exd5 6.Nxd5? Nxd5! 7.Bxd8 Bb4+ 8.Qd2 Bxd2+ 9.Kxd2 Kxd8`. Tests replay it, verify both queens disappear and Black retains an extra knight. With White castled and the bishop on d6, ...Bb4 is no longer check: the test replays `...Nxd5?? Bxd8` in that different position. Queen captures must be checked against forcing replies, not inferred from a superficial pin.
- Nxe4: Classical and Two Knights both explicitly resolve the e4 exchanges; count attackers, recaptures and checks before any pawn grab. The test verifies the Two Knights recapture position. A separate replay proves the conditional smothered-mate pattern `1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Qe2 Ngf6?? 6.Nd6#`: the e7 pawn cannot capture because it is pinned to the king. This is a warning against careless development, not our selected ...Bf5 answer.

## Golden rules

All authored `[%rules]` references are validated directly against the exported `goldenRules` in `src/rules/catalogue.ts`. The branch snapshot has been removed; every rule tag, including reply annotations, is checked against the real catalogue.

## Reproduce the authoring check

Run `npm ci` with Node 24, then `npm run check:repertoire`. It launches the pinned `stockfish@19.0.1` lite-single WASM through its Node CLI, uses 50,000 nodes per position, 16 MB hash, MultiPV 1, and `ucinewgame` before each position. Every distinct graph position is checked, including roots, opponent-to-move positions and endpoints. Scores are converted to the repertoire side's perspective; a score below -1.00, a losing mate, a missing score or an engine failure fails the command. A fixed-budget authoring check is a quality gate, not proof of the prose or exhaustive chess correctness.

White result: 288 unique positions, 0 flags. Worst positions from White's perspective:

- -0.22, depth 13: `london-qb6`, ply 8, after 4...Nc6.
- -0.14, depth 14: `london-gruenfeld`, ply 15, after 8.Nbd2.
- -0.14, depth 12: `london-kid`, ply 11, after 6.O-O.

The script prints FEN, memberships and PV for its ten worst positions. Data tests independently parse each complete PGN using chess.js and compare all plies with the compiler, validate legal edges/rule references/stable IDs/annotation conflicts, and replay the tactical facts above. A regression covers semicolons within brace comments, which previously could swallow a following PGN move.

Black result: 240 unique positions, 120 unique cards, 0 flags. Worst positions from Black's perspective: Fantasy at ply 16 (-0.74, depth 12), Exchange Bf4/Bf5 at ply 12 (-0.60, depth 15), and after 1.e4 c6 (-0.53, depth 15). The combined check covers 528 positions across both sides.
