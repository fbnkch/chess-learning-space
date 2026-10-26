# Engine spike (#5)

## Public seam

`StockfishEngine.analyse({ startFen, moves }, budget, signal?)` returns
`{ complete, lines: [{ uci, cp | mate, depth }] }`. All scores are from White's view.
Mate remains a signed mate distance, and every mate line also includes `winner`:
`+1` for White, `-1` for Black. **`mate: 0` means the root side to move is
already mated**; use `winner`, never the sign of zero, for mate-for/against in
ADR-0004. Stalemate returns `{ depth: 0, cp: 0, uci: [] }`.

Lines come from the deepest complete MultiPV depth, ordered by PV index.
Completeness requires indices 1 through min(requested MultiPV, legal move
count), or the single terminal score when no legal moves exist. A deeper
partial iteration cannot replace a shallower complete snapshot. If no complete
depth was received, `complete: false` explicitly identifies the partial/empty
result; consumers must not infer a forced move from it. Free Play offers retry.

`moves` is the actual UCI history from
`startFen`, not SAN. The Game module validates the path and determines the root
side to move. Returned values are independent copies.

Budget is exactly one of `{ depth, multipv }` or `{ movetime, multipv }`.
Optional `timeoutMs` overrides the search deadline for that request.
Optional `priority: "hint"` pre-empts a background search; the interrupted
background request resumes from the beginning after hints finish. Default
priority is background. Callers cancelling obsolete positions use AbortSignal.
The Free Play component also keys displayed results to its current history, so
an obsolete promise cannot overwrite the current position.

The injected UciWorker factory is the test seam. Request IDs identify jobs;
`stop` drains through `bestmove` before another search starts. Each search has
an `isready` barrier. Startup/readiness default to 15 s; search uses
`max(15000, depth * 1500)` or `max(15000, movetime + 5000)` milliseconds.
The request `timeoutMs` takes precedence over the constructor override. A stop
has a 2 s grace period; expiry replaces the worker. Crashes reject the affected
request (except a pre-empted background search,
which is re-queued even if its worker crashes during stop-grace) and
restart the worker for the next job, with callbacks fenced by worker identity.
Disposing rejects all outstanding requests and releases the worker.

Identical in-flight analysis keys share one search. Each subscriber receives an
independent result copy and can abort independently; only the final subscriber's
abort stops the shared search. A joining hint promotes the shared job. Deadline
settings follow the first subscriber, since they do not change the analysis key.

The in-memory LRU stores 128 complete, nonempty results by default. The key
includes the final full
FEN, FNV-1a 64-bit hash of UCI moves since the last pawn move/capture, exact
budget, MultiPV and engine version. Different repetitions and counters cannot
share a position-only cache entry. This is intentionally separate from the
repertoire positionKey (ADR-0001).

## Build and licence

Unmodified npm `stockfish@19.0.1`, `stockfish-19-lite-single.js` and `.wasm`.
`public/stockfish/SOURCE.json` pins source commit and SHA-256; ATTRIBUTION.md
records the same digests and GPL-3.0 source/licence links. Assets are adjacent
static public files, identical in Vite dev/build. Unit tests verify both the
vendored files and installed npm files against the manifest. No isolation
headers, backend, CDN, SharedArrayBuffer or additional worker wrapper is needed.

## Free Play

Engine starts disabled. Enabling it requests 500 ms, MultiPV 2; the white/black
eval bar follows board orientation and lines use Game's SAN conversion with
move numbers from the root FEN. Mate text is `M3` / `-M3`, never `M-3`.
The label follows the leading side's board end. A persistent 40 px gutter
contains the 34 px bar; toggling analysis cannot resize the board. Controls and
scrollable PVs live in the game panel, which scrolls within the desktop viewport.
Moving,
loading or navigating hides the old result and cancels its request. A new
analysis requires the explicit Analyse position button. There is no live coach
feedback. Errors offer retry. The fake Engine and fake worker use a Chromium
capture of startpos, depth 12, MultiPV 2, with Stockfish 19.0.1.

## Verification (Windows, Node 24)

- `npm ci`: installed baseline successfully; exact Stockfish added afterwards.
- `npm run typecheck`, `npm run lint`, `npm test` (94 tests), `npm run build`: green.
- `$env:PLAYWRIGHT_PORT='5191'; npm run test:e2e -- --workers=1`: full Chromium suite (27 tests).
  The port override avoids other worktrees' running dev servers; default remains 5173.
- Real FEN smoke: **604 ms** including worker startup for movetime 500 / MultiPV 2.
  Standalone desktop/mobile inspection measured 593 ms; no horizontal overflow at 390 px.
- Smoke verifies absence of COOP/COEP and crossOriginIsolated=false, two SAN
  lines, result invalidation, explicit re-analysis and toggle-off cleanup.
- Visual checks: desktop 1440 px and mobile 390 px, using repository Playwright.
  T3 preview evaluate worked, but snapshot twice timed out, so Playwright was
  used for screenshots. Screenshots are temporary test-results artifacts.

Implementation review checked issue #5 and ADRs (Spec axis) plus cancellation,
worker lifetime, immutable results, errors, source integrity and module seams
(Standards axis). CodeRabbit CLI is not installed. As the implementation child,
no recursive council was launched; the parent can run the repository council
review against this branch. No PR or merge is part of this task.

Council fix regressions additionally cover terminal stalemate and mate-zero for
both root turns with the real WASM, incomplete/out-of-order MultiPV snapshots,
non-caching of partial/empty output, independent single-flight cancellation,
stop-phase aborts and crash recovery, budget-derived deadlines and overrides,
castling/promotion UCI histories, and actual runtime `info string` diagnostics.
The engine cache version is asserted against SOURCE.json. Presentation tests
cover signed mate text and root-FEN move numbering. The 1400x860 browser check
verifies a stable board size, bounded game panel, visible bottom player and
toolbar, score-label fit and label placement after flipping; a Black-mate case
checks the opposite leading side. CodeRabbit remains unavailable locally;
Standards and Spec were checked directly without recursive delegation.
