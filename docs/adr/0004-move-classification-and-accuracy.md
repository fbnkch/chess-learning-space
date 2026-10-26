# ADR-0004: Normative move classification and accuracy

Status: accepted (2026-10-24). The thresholds are tunable constants. Changing them needs a new ADR revision.

## Context

The Chess.com classification uses a rating-dependent expected-points curve that is not public. Lichess publishes exact formulas. We need one unambiguous table to implement and test. The research (docs/research/03 §2) gives slightly different boundary notations, so this ADR is the normative source.

## Decision

**Perspective.**
- The Engine normalises `cp` and `mate` to White's view.
- The Coach converts every value to the mover's view before it compares anything.
- Mate scores map to win% 100 for mate-for and 0 for mate-against.
- `cp` is clamped to ±1000.

**Win%** (Lichess): `win = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`. Expected points are `ep = win / 100`.

**Inputs per move** (all from the mover's view, all analysed with the same budget, MultiPV ≥ 2 before the move):
- `epBefore` = `epBest` = the eval of the position before the move (= the eval of its best line).
- `epSecond` = the eval of the second-best line (missing when only one legal move exists).
- `epPlayed` = the eval of the position after the played move.
- The loss is `deltaEP = max(0, epBest - epPlayed)`. Negative noise is clamped to 0.
- **Sacrifice proof**: along the played move's PV (max 8 plies), the mover's material balance (P1 N3 B3 R5 Q9) drops by ≥ 2 at some ply and has not recovered at the end of the shown PV. A PV shorter than 4 plies never proves a sacrifice.
- **Mate**: "mate-for" means the engine reports a `mate` score in the mover's favour; the PV need not be played out to mate.

**Order of checks** (the first match wins):
1. **Book**: the position after the move is in the repertoire graph or in the bundled CC0 opening EPD set (≤ 16 plies). A Book move is excluded from accuracy.
2. **Brilliant**: `deltaEP ≤ 0.02`, the move sacrifices material (a net loss of ≥ 2 points within the PV under SEE-style counting), `epPlayed ≥ 0.50` and `epBefore ≤ 0.90`.
3. **Great**: `deltaEP ≤ 0.02`, `epSecond` exists and `epBest - epSecond ≥ 0.10` (the only good move). The "turns a lost game around" variant is dropped because with `epBefore = epBest` it cannot occur.
4. **Miss**: the opponent's previous move was Mistake or Blunder, `epBest ≥ 0.70` and `epPlayed ≤ 0.50`. A missed forced mate (mate-for before the move, no mate-for after it) also counts as Miss.
5. **Bands** (inclusive upper bounds):

| Class | deltaEP |
|---|---|
| Best | the played move is the engine's best move, or `deltaEP = 0` after clamping (checked before the bands) |
| Excellent | ≤ 0.02 |
| Good | ≤ 0.05 |
| Inaccuracy | ≤ 0.10 |
| Mistake | ≤ 0.20 |
| Blunder | > 0.20 |

**Accuracy** ("adapted Lichess formula"; the implementation ports `lila/modules/analyse/src/main/AccuracyPercent.scala` exactly, including window size by integer division, window assignment at the edges and weights, computed over all moves; only then are Book moves dropped from the aggregation. The port is tested against values computed by the Scala reference for 3 fixture games):
- Per-move accuracy is `clamp(103.1668100711649 * exp(-0.04354415386753951 * (winBefore - winAfter)) - 3.166924740191411 + 1, 0, 100)`. Both win values are from the mover's view.
- Game accuracy per side is the mean of the volatility-weighted mean and the harmonic mean. The window is `clamp((plies - 1) / 10, 2, 8)` and the weights are window standard deviations clamped to 0.5..12.
- Book moves are excluded.
- A game with fewer than 4 non-book moves for a side shows "n/a".

**Labelling.** The UI marks the classification as "approximation of Chess.com". The accuracy figure is labelled "Lichess formula".

## Consequences

The Coach is fully specified and tested with fixtures. Each fixture covers one class, a Black-to-move case, mate-for, mate-against, an "already won" case (+9 to +8.5 must not be a Blunder) and negative noise.
