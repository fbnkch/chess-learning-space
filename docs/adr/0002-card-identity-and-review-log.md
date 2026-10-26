# ADR-0002: Stable card identity and an append-only review log

Status: accepted (2026-10-24)

## Context

The repertoire content is code, and it will be edited often. If card progress were keyed by node index or move path, the first content edit would orphan it. Puzzles, personal mistake positions and repertoire positions all share one scheduler. Switching the SRS algorithm later (for example from SM-2 to FSRS) must not lose any history.

## Decision

- Card IDs are derived from content, never from storage order:
  - repertoire card: `rep:<side>:<positionKey>` (a position where the learner is to move and the repertoire has an "ours" edge)
  - personal mistake card: `mistake:<side>:<positionKey>`
  - puzzle card: `puzzle:<lichessPuzzleId>`
- Bundled content (the repertoire and puzzles) is read-only and versioned. Personal cards are stored data. Both share the `Card` core (`id`, `kind`, optional `side`). Repertoire cards additionally carry `positionKey` and a display/prelude `lineId`; mistake and puzzle cards need no line. `lineId` is optional on a review and belongs to repertoire/learn/practice context only.
- Every attempt is appended to a **review log**: `{attemptId (ULID), sessionId, cardId, at, grade, context, hintsUsed, durationMs, schedulingEligible}`. Only the first scheduling attempt per card per session has `schedulingEligible: true`. The store decides this exactly once in its write transaction, using the `[sessionId, cardId]` index; a retry with the same attemptId returns the stored record unchanged. Session and replay only read that stored flag. Non-eligible entries never claim a replay identity. The trainer owns one session ID per drill run, independent of renders. The SM-2 scheduling state is a cache derived from the log by replaying eligible entries ordered by `(at, attemptId)` using plain code-unit comparison for the ULID tie-break; it can be rebuilt at any time.
- Grades: `again | hard | good | easy`. Mapping:
  - Repertoire drill: a wrong move → `again`; a correct move after using a Hint → `hard`; clean → `good`. `easy` is never auto-assigned, only offered as an optional button after a clean attempt.
  - Puzzle: any wrong move or any hint → `again` (hints count as failure, story 51); clean → `good`.
  - Personal mistake cards: same as repertoire drill.
- Scheduling algorithm (SM-2 variant), state `{ease, intervalDays, reps, lapses, due}`:
  - New card: `ease 2.5, intervalDays 0, reps 0`.
  - `again`: `reps 0, lapses+1, ease = max(1.3, ease - 0.2), intervalDays 1`.
  - `hard`: `ease = max(1.3, ease - 0.15)`, `intervalDays = max(1, round(intervalDays * 1.2))`, `reps+1`.
  - `good`: `reps 0 → 1 day`, `reps 1 → 3 days`, otherwise `round(intervalDays * ease)`; `reps+1`.
  - `easy`: compute and round the `good` interval first, then multiply it by 1.3 and round again; `ease + 0.15`. Ease is rounded to two decimal places after every update. Intervals are capped at 3650 days.
  - `due` = start of the local day (boundary 04:00) of `at + intervalDays`. The first review of a new card is therefore always the next day.
- The Scheduler is pure and its clock is injected. Its public narrow port is `due(now)`, `record(review)` and read-only `reviews()` for stage derivation. Its injected card source receives the log and includes only cards from Drill-stage lines. It composes an injected card-source function with the append-only Progress log; Progress itself only exposes append/reviews/metadata and lifecycle operations, with no card source or due calculation. The Opening Trainer, Puzzles and Training Plan use this port and never touch the Progress store directly.
- A repertoire card is always drilled in context. The app auto-plays the line's prelude moves up to the card's position, and then the learner moves.
- Each side/line progresses **Learn -> Practice -> Drill**, derived only from the review log. Completing the Learn lesson explicitly writes a `context: "learn"`, `lineCompleted: true` entry using that line's first card and `lineId`. This entry is never scheduling eligible. Reaching the last displayed move enables Complete lesson; navigation itself does not complete the lesson.
- Practice recalls every learner move in the selected line in order, with automatic replies. Comments, plans, idea arrows and Hint are hidden; a wrong move reveals the solution and idea for retry. Any mistake prevents promotion for that entire run, including after a successful retry. Reset starts a new run for clean recall. The last correct attempt of a clean run carries `lineCompleted: true`, `context: "practice"`, `grade: "good"`, `hintsUsed: 0`; saving it unlocks Drill. Practice never offers Easy or changes SRS.
- Only cards belonging to at least one Drill-stage line enter scheduling and due counts. A newly unlocked card is due immediately, with no SRS state until its first Drill review. Shared/transposed positions keep one card identity, but completion promotes only the recorded side/line, never every line sharing that position. Shared due cards are counted only within unlocked lines.
- Migration-free compatibility: a line with an existing eligible review stays in Drill. Its recorded `lineId` identifies that line; old entries without a line ID use the full repertoire's default reaching line for that card. An eligible review on a shared position does not promote all reaching lines. Completion entries use existing card IDs, so they survive export/import without a new store, mutable stage field or database migration.
- Whole-line practice uses `context: "practice"` and is never scheduling eligible. Failed drill cards are requeued once at the end of the same session, so those repeated attempts never reschedule. Clean attempts are saved when the learner chooses the default Good (Next card) or optional Easy; wrong/hinted attempts are saved immediately.
- Woodpecker cycle attempts go into the log with `context: "woodpecker"` and do not change SRS intervals.

- Cohort and Coverage are read models of the graph and log, without another store or mutable progress flags. `activeLines` in existing settings is the starting/target size for new lines per side (default 6, valid 3-12), not a cap on preserved progress or later unlocks. Authored `Main` metadata takes priority; remaining lines follow their first branching reply weight, then stable line ID. Every Practice/Drill line remains active. Manual admission writes `context: "learn", lineUnlocked: true` on the line's first card, without `lineCompleted`; it never schedules or counts as discovery. Existing log export/merge/Undo semantics preserve these events. Automatic admission adds at most one next line per evaluation and side, even when all lines share stable cards. It derives from all active cards having interval >= 3 days and no repertoire `again` in the last seven elapsed days, using an injected clock. Unstarted automatic admissions are recomputed; once the learner completes Learn or starts scheduling, progress cannot re-lock.
- Coverage counts unique trainable positions per scope: Learn visits (or completed legacy lessons), any Practice/repertoire attempt, OR-membership in a Drill-stage line, and replayed interval >= 21 days respectively. Learn visits use ordinary non-completion, non-scheduling Learn entries. New Learn entries carry `discoveryMode: "visits"`, preserved by backup export/import. Only legacy completions without that marker discover the full line; visit presence or absence on the recorded line is not a legacy signal because shared visits are deduplicated per position. Completing a new lesson does not discover skipped positions. A manual unlock is excluded. Shared position counts do not change side/line stages.

## Consequences

- Progress survives content edits as long as the position still exists. If an edit removes a position, its cards are reported as retired, never deleted silently.
- Rebuilding the scheduler state from the log enables later algorithm changes and analytics such as blunder rate and accuracy trends.

## Golden Rules quiz (issue #18)

- Quiz attempts reuse the append-only review log with `context: "rule-quiz"`
  and stable IDs `rule:<ruleId>:example-v1`. These identify an authored example
  for a rule, never an array index. Retired rule IDs remain exportable history.
- The two-choice recognition quiz uses tagged authored repertoire moves where
  available and catalogue example positions otherwise. It never invents engine
  moves. General thinking/time principles also include their authored scenario.
- Correct answers map to `good`, incorrect answers to `again`. Both are always
  non-scheduling, including retries. Quiz results do not affect puzzle rating,
  opening stages or due counts. Answers save once per question; a failed save
  retries the same attempt ID before allowing the next question.
- Learned rules derive from explicit learned marks plus successful quiz reviews.
  Failures never erase learned progress. An explicit unlearn mark overrides
  earlier quiz successes until another successful answer. This read model is
  shared by Home, navigation and Golden Rules, so import/merge/Undo need no
  second mutable learned-state write.
- On backup Merge, derive each side's learned state independently before merging:
  explicit marks plus quiz successes newer than that side's unlearn mark. Apply
  learned-in-either to these read models, using earliest effective learnedAt and
  latest updatedAt (including successful quiz timestamps). Materialise the merged
  result only into the existing ruleState store; no second mutable state is added.
  A subsequent local unlearn still suppresses earlier successes. Undo restores
  pre-import marks and removes imported-only reviews, preserving later local work.
- Every quiz example has an explicitly authored distractor rule ID and a reason
  it does not apply to that example, shown in feedback. Phase alone is not evidence
  that an alternative is wrong; overlapping threat/safety thinking rules must not
  be used as distractors for each other.
