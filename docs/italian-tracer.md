# Italian tracer (#3)

Content source: `content/white/italian.pgn`. The Vite `repertoire-pgn` plugin compiles it
to a bundled, side-scoped position graph; the browser never parses the PGN.
The compiler supports recursive annotation variations and merges position keys.

Authored line (eight White moves):

`1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Bb3`

The move order is a standard C54 Giuoco Pianissimo continuation, cross-checked
against [ChessOpeningsLab](https://www.chessopeningslab.com/openings/italian-game/classical-variation/giuoco-pianissimo/)
and [ChessAlgo](https://chessalgo.com/openings/italian-game-classical-variation-giuoco-pianissimo-main-line/).
Ideas are authored locally, with placeholder principle IDs pending #6.
Reply weights are bundled estimates (all 1 for this single, unbranched line).
No engine verification is claimed; engine integration is outside #3.

## Module boundaries

- Repertoire: side-scoped queries, stable position cards, contextual preludes,
  removed-line fallback and deviation classification.
- Scheduler: pure SM-2 transitions and deterministic log replay. Local calendar
  days start at 04:00; calendar arithmetic preserves the boundary across DST.
- OpeningSession: due/new queue through the scheduler port, explicit prelude
  ticks, resulting-position judgement, hints, retry/reset and emitted reviews.
- Progress: IndexedDB v1 through `idb`, transactionally enforced first attempt
  per card/session, immutable attempt IDs, retained retired-card logs and
  persistence request/status. SRS state is derived, never persisted as truth.
- `migrateProgress`: the shared forward-only data migration path for database
  upgrades and the future import implementation. v0 is the empty database.

`due(now)` includes unseen cards after due reviewed cards. Practising the whole
line starts a new session; resetting an existing drill retains its session ID
and first-attempt history. Every attempt is logged, including retries. The
initial line ID travels with reviews so future sessions retain that context.

## Follow-up scope

Export/import, backup snapshots and their UI belong to #4. Engine analysis and
golden-rule catalogue validation are deliberately absent. Reviews should go
through the parent orchestrator's council; an implementation sub-agent must not
recursively delegate.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and
`npm run test:e2e`. Unit seams cover legal compiled data, queries/transpositions,
the transition table/day boundary, deterministic replay, grading, migrations,
reopening IndexedDB, concurrent connections and retired-card retention.
Playwright covers learning all plies and drilling all eight cards with a wrong
move, rejected-position restoration, locked preludes and progress after reload.
