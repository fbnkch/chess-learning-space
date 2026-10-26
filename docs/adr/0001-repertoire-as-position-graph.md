# ADR-0001: Repertoire is a position graph keyed by normalised position

Status: accepted (2026-10-24)

## Context

The repertoire has many move orders that reach the same position. 1.d4 d5 2.c4 e6, 1.c4 e6 2.d4 d5 and 1.Nf3 d5 2.d4 ... e6 3.c4 all end in the same QGD position, and the Caro-Kann and London have similar cases. If the repertoire were a tree keyed by move path, a transposition would count as a wrong move, the same position would show up as two cards, and the repertoire-deviation check in Game Review would give the wrong answer.

## Decision

- Every module identifies positions with one function, `positionKey(position)`, which lives in the Game module. The key is the first four FEN fields (placement, side to move, castling rights, en-passant square). The en-passant square is kept only when an en-passant capture is actually legal, and the move counters are dropped.
- There are two repertoire graphs, one per training side: `white` (Italian + London) and `black` (Caro-Kann + QGD setup). The same position can occur in both (e.g. 1.d4 d5 2.Bf4 is ours-to-reply in `black` and a played edge in `white`), so every query takes the side, and "ours/reply" is only meaningful within one side's graph.
- Each side's repertoire is a directed graph. Nodes are `positionKey`s. Edges are UCI moves, each with metadata: comment or idea, golden-rule IDs, whether the move is "ours" or a "reply", and an optional popularity weight. Positions reached by different move orders merge into one node.
- In a drill, any move whose resulting `positionKey` is a known child node counts as correct, even when it is not the edge the line used.
- Repertoire content is authored as annotated PGN files: the main line plus variations, with comments and `[%rules ...]`-style tags for the golden-rule IDs. A build step compiles these files into the position graph. Data tests check the result.
- Every authored main line and variation has an explicit stable `LineId` tag or `[%line id]` command; missing or duplicate IDs and conflicting annotations on a shared edge fail compilation (arrows are compared as a sorted, de-duplicated set, and a repeat of the move without any annotation is not a conflict). PGN files live in one folder per side (`content/white/`, `content/black/`). The compiler combines PGN files per side, hashes their content, and emits node memberships `{lineId, ply}`.
- Lines (named move paths such as "Italian: Giuoco Pianissimo main") are metadata over the graph. They are used for learning order and display, not for identity.
- Repertoire, Scheduler cards and deviation detection all use the same `positionKey`.
- The engine cache uses a separate **analysis key**: the full FEN (halfmove and fullmove counters included) plus, for game review, a hash of the moves since the last irreversible move (capture or pawn move). The positionKey alone discards draw-relevant history.
- Draw rules: drills, puzzles and Threat Scan ignore threefold repetition and the 50-move rule for move legality. Stalemate or checkmate ends an attempt (a stalemate in a mate puzzle is a failure). Game Review honours all draw rules.
- Prelude for a card: the shortest path to the card's position within the card's line (`lineId` retained in the first repertoire review context; if the line was removed, the highest-weighted line reaching the position).

## Consequences

- Transposition handling and card de-duplication need no extra code.
- Authors keep writing ordinary PGN with standard tools.
- Two different lines that pass through the same position share that position's card. This is intended.
