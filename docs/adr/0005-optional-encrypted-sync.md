# ADR-0005: Optional encrypted sync

Status: accepted (2026-10-26)

## Context and amendment

This amends the browser-only product rule and ADR-0003's browser-only context.
Local learning remains offline-first. The only server code is `api/sync.ts`, an
optional same-origin Vercel Node function using a private Blob store. No account,
LLM proxy or mandatory network dependency is introduced. Off sends no sync requests.

## Keys and exact wire format (v1)

WebCrypto generates 32 random bytes, encoded as 43 canonical unpadded base64url
characters. Other devices accept the same code. Only `secrets["sync-code"]`
persists it. Mask/reveal/copy are explicit. Export, Replace, Merge and Undo never
include or modify secrets. A lost code cannot be recovered from the cloud.

HKDF-SHA256 uses the decoded seed, UTF-8 salt `chess-learning-space/sync/v1` and
separate UTF-8 info strings: `encryption` derives a nonextractable AES-256-GCM key;
`authentication` derives 32 auth-token bytes. Bearer auth is unpadded base64url of
those bytes. Namespace hash: lowercase hex SHA-256 of the **decoded auth-token
bytes**, not their ASCII base64url representation. The hash may be displayed.

Plaintext: UTF-8 JSON of the unchanged ADR-0003 standard export envelope, produced
by the shared allow-listed exporter. CompressionStream gzip precedes AES-GCM.
Every upload has a fresh random 12-byte IV. Binary wire layout:

- offsets 0..3: ASCII `CLSY` (hex `43 4c 53 59`)
- offset 4: version `01`
- offsets 5..16: IV
- offsets 17..end: ciphertext followed by the default 16-byte GCM tag

All 17 header bytes are authenticated as AES-GCM additional data. Total wire size
is capped at 4,000,000 bytes, below Vercel's 4.5 MB request/response limit.
Decompression is streamed and capped at the shared 50 MiB JSON limit. Strict
import validation, newer-schema rejection, semantic checks and record caps apply.
Malformed or undecryptable clouds cause no progress writes and give recovery steps.

## Endpoint contract

All methods require `Authorization: Bearer <43-character canonical base64url>`.
Bad auth returns 401. Optional `SYNC_ALLOWED_HASH` restricts the endpoint to a
complete 64-character namespace hash, compared in constant time. Invalid config
fails closed. Restricting the hash prevents strangers creating their own namespaces.
The server derives `sync/<full-hash>/snapshot.bin`; clients cannot choose paths.

| Request | Success | Conflict/empty |
| --- | --- | --- |
| GET /api/sync | 200 opaque bytes + ETag | 404 empty |
| PUT, X-Create-If-Absent: 1 | 200 + ETag; atomic create-if-absent | 412 exists |
| PUT, If-Match: etag | 200 + ETag; atomic compare-and-swap | 412 stale/missing |
| DELETE /api/sync | 204, idempotent | local data stays |

PUT requires exactly one precondition (428 otherwise), 33..4,000,000 body bytes
(400 too short, 413 too large). Other methods: 405; storage/config failure: 503.
Error bodies are generic; no credentials are logged; responses are no-store.
Same-origin requests need no CORS. The bearer grants namespace read/write/delete
but does not disclose the independent encryption key.

`handleSync(request, blobStore, allowedHash?)` injects storage/configuration.
The adapter uses current private `get` with `useCache:false` (avoid stale reads),
`put` with atomic `ifMatch` or `allowOverwrite:false`, and `del`. There is no
head-then-unconditional-write race or list call. Failed creation may need one
uncached GET to classify a collision reported by the SDK as a generic error.

## Merge, lifecycle and Undo

Pull -> decrypt -> shared validation -> mergeFromSync -> allow-listed snapshot
export -> gzip/encrypt -> conditional PUT. 412 repeats the entire sequence, with
at most three PUT attempts per run. Conflict exhaustion asks for Sync now.

`mergeFromSync` computes registry merges and validates the complete union before
writes, all in one IndexedDB transaction. Conflicting attempt IDs/games abort it.
Effective rule-state merging uses each side's quiz read model as manual Merge does.
Settings, backup bookkeeping and secrets stay local. The merge derives
firstReviewAt from the unioned review log in the same transaction and leaves
lastExportAt untouched. Sync-materialized rule states enter preImport's
ruleStatesAfterImport baseline unless that rule already has a genuine later
learner edit. Imported-only quiz learning therefore disappears on Undo.
Manual Undo keeps later sync-added work through existing later-work rules and
preserves current sync bookkeeping rather than rolling the quota counter back.
Every backup import (Replace or Merge), game import and Undo atomically increments a local,
monotonically increasing data epoch in metadata. It is never exported or restored
from a backup. Replace and Undo also persist a paused flag when sync is configured.
The engine captures the epoch before reading its snapshot, checks it across async
steps and before network writes, and passes it into mergeFromSync. That method
checks the epoch inside its read/write transaction, so a pull started before an
import/Undo cannot commit a pending merge afterwards. Same-page notifications and
BroadcastChannel invalidate active requests across connections/tabs; AbortSignal
cancels GET/PUT, and epoch checks also reject transports that ignore cancellation.

The pause survives reload, focus, timers and Sync now. SyncPanel requires an
explicit choice; there is no silent auto-resume:

- **Delete cloud copy and upload this device** requires confirmation. Turn off
  other devices and export JSON first. Reserve a capped PUT attempt, DELETE the
  cloud copy, then PUT a newly built device snapshot with X-Create-If-Absent: 1 and no
  intervening pull. Failure or conflict keeps sync paused; it never falls back to
  merging. Only a successful fresh upload clears the pause for the same epoch.
- **Resume and merge cloud data** explicitly warns that removed/undone data may
  return. It clears the pause for the current epoch and runs the normal pull/merge.

Aborting a request cannot recall a PUT already accepted by the server. The
persisted pause prevents reimporting it until the learner chooses; confirmed
DELETE plus a fresh PUT removes that cloud copy. Other enabled devices can still
reintroduce their data, hence the instruction to turn them off first.

Caches refresh through the existing UI revision path. Replays only merge and
cannot delete newer local union members. A new device cannot detect a server
replaying an older authenticated snapshot; sync is not versioned backup.

Registry rules preserve local winners for some mutable ties (fixed puzzle sets,
equal-count ratings and solution content). This is not a general CRDT for conflicting
edits. Disjoint append-only reviews/scans/games converge to the same union.

A persisted SHA-256 content revision detects local changes without altering every
training writer. It canonically sorts store rows, preserves record-internal array
order, and excludes device settings/bookkeeping. Work added after the exported
snapshot stays dirty. Start/focus pull, with five-minute focus throttling. A
120-minute timer and best-effort page-hidden trigger sync dirty data. Automatic
PUTs wait 120 minutes after the previous attempt; Sync now bypasses this interval.
Unchanged data does not upload on focus. Runs coalesce; Web Locks serialize tabs
where supported. Offline/failure never blocks local training. Hidden-page uploads
are best effort, not guaranteed unload delivery. Off deletes only the local code;
confirmed cloud deletion also turns off this device. Turn off other devices first.

## Quota guard

Each PUT attempt, including conflicts/uncertain replies, reserves locally BEFORE
network IO in one metadata transaction. Cap: 400 attempts per UTC calendar month
per browser profile, across codes/tabs. Import/Undo preserve counters; clearing
browser data resets them. Pulls can still merge after the cap. Next month resets.

One normal upload costs one advanced operation and stores one <=4 MB object per
code; no lists/multipart are used. 120-minute spacing permits 12/day or 372 in
31 days. Three browsers x 400 = 1,200 <= Hobby's 2,000 advanced operations,
leaving 800 for retries, deletion and other usage. **This is not an account-wide
guarantee**: more browsers, other apps and SDK/network retries can exhaust the
reserve. A trusted global meter would require more server-side state. Use the
hash restriction and monitor combined usage. Sync now bypasses only the interval;
a warning starts at 360 attempts in the current UTC month. GETs also consume simple ops,
transfer and Function resources. Hobby blocks access at limits until next month
instead of billing overages. Local learning and JSON backups remain available.

## Hosting security and verification

Hash routing needs no rewrites. `vercel.json` sets security headers and one-year
immutable caching for assets/puzzles/Stockfish; updates require versioned paths.
CSP allows self scripts and wasm-unsafe-eval, self/blob workers, inline board
styles and self/data/blob images. Arbitrary HTTPS wording endpoints and loopback
HTTP require connect-src https: plus explicit HTTP loopback hosts/ports. This
also permits explorer.lichess.ovh and api.chess.com; it is broader than a fixed
API allow-list. Browser scripts/extensions can still access local secrets.

Vercel sees auth tokens, ciphertext, namespace, size and timing; never the seed
or plaintext through this protocol. JSON backups are plaintext and include game
and player details. Keep backups and codes private, separately. Tests use fake
IndexedDB, an atomic memory Blob port, and two isolated Playwright contexts with
an intercepted endpoint. No real Blob/deployment/provider request is made.

Official sources checked 2026-10-26:
- https://vercel.com/docs/vercel-blob/using-blob-sdk
- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/functions/runtimes/node-js

Note: create-if-absent uses the custom `X-Create-If-Absent: 1` header. The standard `If-None-Match: *` is evaluated by Vercel's edge, which turns the successful 200 into a 304 and makes the client report a failure.
