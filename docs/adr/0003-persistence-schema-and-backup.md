# ADR-0003: Single schema version, forward migrations, safe import, durable backup

Status: accepted (2026-10-24)

## Context

All progress lives in the browser only. Browsers can evict IndexedDB under storage pressure, and Safari does so after 7 days without a visit. A careless import or schema change can wipe months of review history.

## Decision

- There is one `schemaVersion` covering all IndexedDB stores. Migrations run forward only, and the IndexedDB upgrade and the JSON import share the same migration code path.
- The export envelope is `{format: "chess-learning-space", schemaVersion, appVersion, contentVersions, exportedAt, data}`.
- Secrets are never exported. That covers the Lichess token and the LLM key, and the export uses an explicit allow-list of stores.
- Import:
  - An export with a newer `schemaVersion` than the app is rejected.
  - Older exports are migrated first.
  - The user picks "replace" or "merge" explicitly; Replace needs a second confirmation describing the overwrite and Undo. Merge follows the per-store rules below (review entries are de-duplicated by `attemptId` only).
  - Validation before any write: max file size 50 MB, schema validation of every record (runtime schema, e.g. zod), every `cardId` referenced by the review log must be resolvable or is kept as a retired card, unknown stores are rejected.
  - The import runs in one transaction, so an invalid file changes nothing.
  - In the same transaction as every import, the complete current exportable data is saved as one `preImport` record with timestamp and mode. Failure (including quota failure) aborts the import. "Undo last import" asks for confirmation and atomically restores that record, keeping every review and scan recorded and learned-rule state updated after the import (the copy remembers which review and scan IDs the import added and the exact post-import rule state; imported timestamps alone cannot identify later edits). A new import replaces the previous Undo point, and the UI says so. Any schema upgrade discards the Undo point instead of replaying an old-format copy. An extra downloaded snapshot is best-effort; when the file picker is available, writing and closing the selected file is awaited.
  - Merge rules per store:

| Store | Key | Merge rule |
|---|---|---|
| reviewLog | `attemptId` | union (de-duplicated by `attemptId`) |
| scanLog | `attemptId` | union |
| personalCards | `cardId` | union; on conflict keep the earlier `createdAt`, union their tags |
| ruleState (learned) | `ruleId` | learned if learned in either; earliest `learnedAt`, latest `updatedAt` |
| puzzleRating | singleton | keep the side with more rated attempts |
| woodpeckerSets | set ID | union; existing local fixed set wins on conflict |
| settings | singleton | keep current (local) settings |
| games (imported) | game URL / PGN hash; canonical fingerprint | union by ID, or by fingerprint when one side has no verified game URL; identical records deduplicate; different records with the same ID reject the complete import before any write |
| derived caches (SRS state, engine and coach caches) | – | never imported; rebuilt after import |
- After the first review transaction commits, the app calls `navigator.storage.persist()` without awaiting it before accepting further reviews, stores its result in metadata, and shows the result ("storage: persistent / best-effort") in Settings.
- One store registry defines keys, validation, merge and export rules and drives database upgrade, snapshot and restore. Validation checks format/version first, allow-listed names next, then migrates unknown records before strict and semantic validation. Review IDs are ULIDs, practice/woodpecker cannot schedule, and review dates may be at most one day ahead of the injected clock. Import only accepts data that passed this validation in the same session. The 200,000-review cap (about ten years of daily training) and the one-day clock tolerance are deliberate limits; revisit them if a real backup hits either.
- Merge adds missing keys and keeps local settings and export bookkeeping. Replace keeps local settings when absent from the file; only Replace resets export bookkeeping.
- The app stores `lastExportAt` and nudges for a backup after 7 days or 200 reviews without an export. Dismissal snoozes the banner for 3 days without moving that deadline. Export re-requests persistence when storage is best-effort.
- Optional, in Chromium only: an auto-backup to a user-chosen local file through the File System Access API.
- Database upgrades are version-stepped: v1 creates stores, v2 adds the `[sessionId, cardId]` review index, v3 adds settings/secrets, v4 adds the private `preImport` safety copy, v5 adds the learned-rule state, v6 adds the append-only scanLog, v7 adds the puzzleRating singleton and fixed woodpeckerSets (detailed below), and v8 adds imported games keyed by Chess.com URL or a SHA-256 hash of canonical PGN headers, start position and mainline UCI moves. Each game also stores a SHA-256 fingerprint of start position, mainline UCI moves, normalised players, date, start time and result to deduplicate across sources; a fingerprint match counts as a duplicate only when at least one side has no verified Chess.com URL, so two different game URLs (an identical rematch) always stay two games. Backup validation recomputes identity, fingerprint and result from PGN. Undo tracks imported game IDs and keeps games added after a backup import. The optional Safety Check preference defaults to off when absent in older settings. Existing stores are read in the versionchange transaction, passed through the shared forward migration path and rewritten atomically. Blocked upgrades ask the learner to close other tabs; unexpected termination reopens the connection.
- `onversionchange` is handled, so a second open tab closes its connection and asks for a reload.
- v7 adds the `puzzleRating` singleton and fixed `woodpeckerSets`. Rating updates share the review write transaction; first encounters are determined from the complete puzzle review history, including hinted, SRS and Woodpecker attempts. Puzzle opponent rating/RD and the stored rating eligibility are review facts, so rating history can be derived without a second time-series store. Woodpecker reviews carry a set ID and cycle number; cycle time is the sum of attempt durations, ending at success, failure or the first Hint. Undo restores the previous rating and reapplies later rated work; later sets and cycle attempts survive.

## Consequences

- Roundtrip tests and migration tests are mandatory for every schema change.
- The persistence work (including export/import and `persist()`) is part of the first tracer-bullet ticket, because the risk of data loss starts with the first stored review.

## v9: Personal mistake cards (issue #14)

The registry adds `personalCards`, keyed by `cardId`. The shared v8 -> v9
migration initialises it empty and preserves all existing stores. Each card
stores its side, normalised position key, full FEN, legal engine solution,
creation time and tags. Its core `id` equals `cardId` and uses ADR-0002 identity.
Merge keeps local solution content on conflict, the earlier creation time and
the union of tags. Export/import validate card identity and every solution move.
Undo records the exact post-import card baseline and restores later additions
and changes, merged with pre-import cards. Schema upgrades discard old Undo copies.

## v10: Golden Rules quiz (issue #18)

The v9 -> v10 migration preserves all data without adding a store. The existing
reviewLog registry schema accepts `rule-quiz` context and `rule:<ruleId>:example-v1`
identities. Backup validation rejects scheduling quiz entries, non-binary grades
and hints. Successful quiz history feeds the learned-rule read model. Existing
attempt-ID union, roundtrip and Undo semantics therefore apply to quiz progress;
later quiz attempts survive Undo and imported-only attempts are removed. As on
every schema upgrade, the old-format Undo point is discarded.

For Merge, ruleState's learned-in-either rule includes each side's independently
computed read model: explicit marks plus successful quiz reviews strictly newer
than any explicit unlearn on that side. Merge those effective states with earliest
learnedAt and latest updatedAt (including quiz success times), then write the
result into the existing ruleState store. Do not compare one side's unlearn mark
against the other side's quiz history before applying the OR rule. Consequence, accepted deliberately: merging an older backup in which a rule was still learned re-learns a rule the learner unlearned locally since then (the same as for explicit learned marks). The learner can unlearn it again, or Undo the import. Replace keeps
the incoming marks and log as supplied. The exact post-import ruleState baseline
includes the merged result, so Undo restores pre-import marks while retaining
later local changes and quiz attempts. Later local unlearn still takes effect;
there is no additional independently mutable learned-state store.

## v11: Lichess explorer reply weights (issue #19)

Add registry store `replyWeights` (key `id`, since 11). The shared forward v10 ->
v11 migration initialises it empty and preserves all prior records. Records carry
the normalised position key, canonical supported query parameters, fetch timestamp
and legal UCI reply percentages; strict backup validation also checks ID identity,
unique records, percentage bounds and a one-day future-date tolerance.

Export allow-list decision: include weights because they are public aggregate
statistics needed for offline ordering. The Lichess token stays exclusively in
`secrets`, excluded from export/import and preImport copies. Merge keeps the newer
fetch date per position/query, with local winning ties. Replace accepts incoming
weights. A refresh commits its complete batch atomically and does not create an
import Undo point. Undo of an import restores the previous weights and retains
local refreshes made afterwards, comparing records against the exact post-import
baseline. As with earlier upgrades, old-format Undo copies are discarded.
See [Lichess explorer](../lichess-explorer.md) for query, auth and fallback details.
