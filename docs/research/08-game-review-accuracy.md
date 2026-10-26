# Game Review: reference calculations and cache decisions

Issue #13, ADR-0004. These are synthetic fixture games: their evaluation series
are deliberately simple, so expected values can be checked without Stockfish.
`src/review/accuracy.test.ts` contains the literal reference answers. Inputs are
White win percentages including the initial position; either side's mover-view
loss is obtained by flipping the sign for Black. Percentages can be converted to
centipawns with `ln(win / (100 - win)) / 0.00368208` when desired.

## Reference and exact details

The port follows [AccuracyPercent.scala at lila e19c044](https://github.com/lichess-org/lila/blob/e19c044af145c833d3a9133fa8f9418b1159767d/modules/analyse/src/main/AccuracyPercent.scala),
and [scalalib Maths](https://github.com/lichess-org/scalalib/blob/master/lila/src/main/scala/Maths.scala).
Scala was not run here. The following worksheet evaluates the Scala formulas
directly; decimal arithmetic was checked with Python's `math.exp`/`math.sqrt`,
independently of the TypeScript implementation. Tests use fixed answers, not
answers calculated by calling the implementation under test.

- `A(d) = clamp(103.1668100711649 × exp(-0.04354415386753951 × d) - 3.166924740191411 + 1, 0, 100)`; improving/equal moves have accuracy 100.
- Window size is integer division: `clamp(floor((number of evals - 1) / 10), 2, 8)`.
  This is the Scala expression `cps.size - 1`, where `cps` includes the initial
  position. Thus a 40-ply game has 41 evaluations and a size-4 window.
- Prepend `windowSize - 2` copies of the first window to all full sliding windows.
  For size 4, weights for plies 1, 2 and 3 all use evaluations 0..3; ply 4 uses 1..4.
- Standard deviation is population deviation (`/ n`, not `/ (n - 1)`), clamped to 0.5..12.
- Compute each weight on the complete original series. Only then remove Book moves.
- Harmonic mean is `n / sum(1 / max(1, accuracy))`, including the floor of 1.
  Final accuracy is `(weightedMean + harmonicMean) / 2`.
- The app's ADR adaptations are Book exclusion and n/a below four non-Book moves
  per side. Mate-for maps to 100%, mate-against to 0% before aggregation.

## Three worked fixture games

1. **Flat eight-ply game.** Evaluations `[50,50,50,50,50,50,50,50,50]`, White starts,
   no Book moves. Window size 2; all deviations are 0, hence all weights are 0.5.
   All eight move accuracies are 100. Each side has weighted mean 100 and
   harmonic mean `4 / (4 / 100) = 100`. Final: **White 100, Black 100**.

2. **Alternating eight-ply losses.** Evaluations `[50,40,50,40,50,40,50,40,50]`,
   White starts, no Book moves. Every mover loses 10 win-percentage points;
   `exp(-0.4354415386753951) = 0.646978...`, giving
   `A(10) = 64.57982845372067`. Every window has deviation 5, so each side's
   weighted and harmonic means are that same number. Final:
   **White 64.57982845372067, Black 64.57982845372067**. Starting Black instead
   makes every move an improvement, and both sides score 100.

3. **Mixed forty-ply game with six initial Book moves.** Start with nine 50s,
   append `[40,60,55,65,45,55,35,60,50,50]` three times, then `[40,60]`.
   White starts; exclude plies 1..6 only at aggregation. Window size 4. Weights
   for plies 1..8 are 0.5. Ply 9 uses `[50,50,50,40]`: mean 47.5, squared
   deviations sum 75, deviation `sqrt(75/4) = 4.330127018922194`. Ply 10 uses
   `[50,50,40,60]`: deviation `sqrt(200/4) = 7.0710678118654755`.
   Continuing these sliding-window calculations and substituting each mover's
   loss into A gives the following worksheet totals:

| Quantity after Book exclusion | White | Black |
| --- | ---: | ---: |
| Moves | 17 | 17 |
| Sum of weights | 132.01737889106715 | 133.64455824540585 |
| Sum of accuracy × weight | 7590.478767119841 | 8008.474486133807 |
| Sum of `1 / max(1, accuracy)` | 0.3017961196715154 | 0.3225444255526011 |
| Weighted mean | 57.4960571924629 | 59.92368556771451 |
| Harmonic mean | 56.32941874303536 | 52.705917861933756 |
| Final accuracy | **56.91273796774913** | **56.31480171482413** |

Additional tests cover zero accuracies (weighted mean 0, harmonic mean 1,
therefore final 0.5), integer division, edge weights, short games and Book-only
games. Classification fixtures cover every class, inclusive bands, ordering,
negative noise, Black perspective, mate signs/zero, +9 to +8.5, and legal
material-exchange PVs that prove or disprove a sacrifice.

## Runtime choices

- No CC0 opening EPD/TSV set exists in this checkout. Book detection uses the
  union of the two repertoire graphs through ply 16, with the shared `positionKey`.
- Review calls the existing StockfishEngine with depth 12, MultiPV 2, background
  priority and full start FEN plus move history for every position. No second
  engine implementation or worker protocol was added.
  Leaving the page aborts analysis and terminates its worker; the raw/derived
  caches stay available when the learner returns.
- `src/engine/AnalysisCache.ts` keeps complete raw analyses under the existing
  analysis-key semantics plus budget, MultiPV and engine version. It persists
  disposable facts in localStorage with a bounded cache; cancellation retains
  only positions whose analyses already completed. Reopening a cancelled game,
  including after reload, reuses those facts.
- `src/engine/ReviewCache.ts` caches complete derived reviews. Keys include
  start FEN/full game history, budget, engine version, coachVersion and repertoire
  content versions. A coach/content change recomputes classifications and
  accuracy from cached raw analysis; an engine/budget change recomputes analysis.
- Both caches are excluded from the Progress registry and backups. They fall
  back to memory if storage is blocked/full; they may be evicted and rebuilt.
  There is no IndexedDB store change and no schema v9 migration is needed.
- Terminal checkmate, stalemate, insufficient material, fifty-move and
  repetition draws are handled with chess.js and full history. The recorded
  final position is not evaluated as an ongoing game after a draw.
- The only caller is the explicit post-game Review page. Exploring a variation
  does not analyse or classify it. Explanations/motif detection remain issue #14.
- Playwright replaces the browser composition module with a delayed fake
  Engine; it exercises the real review pipeline, persistence and UI without a
  long WASM run. Existing engine smoke tests still use the real WASM build.

Council review belongs to the parent integration workflow. This implementation
sub-agent does not recursively delegate reviews or open a pull request.
