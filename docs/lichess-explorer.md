# Lichess explorer reply weights

## Authentication finding

Verified integration fact supplied for issue #19 (2026-10-26): an unauthenticated
GET to `https://explorer.lichess.ovh/lichess` **and** `/masters` returns
**HTTP 401 Authorization Required**. This implementation accepts that verified
finding; it does not repeat the unauthenticated probe. The explorer requires a
Lichess personal API token, sent as `Authorization: Bearer <token>`. No scopes
are needed. Older research describing authentication as unresolved is superseded
by this finding. `/masters` is not used by the app.

The learner creates and pastes their own token in Settings. No developer or agent
needs to receive it. The masked field is optional: all training works without it.
Save Lichess token writes only the `lichess-explorer-token` record in the existing
IndexedDB `secrets` store. Saving an empty field clears the stored value. It never
enters settings, localStorage, exports, imports or Undo snapshots, following the
pattern in [llm-wording.md](llm-wording.md). Requests use a fixed HTTPS origin,
reject redirects, omit cookies, and never report raw errors or response bodies.

## Explicit refresh and query

Only **Refresh reply weights from Lichess** initiates network access. Saving a
token, opening Settings, startup, import and training never initiate a refresh.
Requests use `/lichess`, `variant=standard`, `ratings=1000,1200,1400`,
`speeds=blitz,rapid`, `moves=8`, `topGames=0`, `recentGames=0`, plus the position
FEN. The Explorer's `moves` parameter is the small top-moves limit (8).
The ratings are the available 200-point bucket selectors around the learner's
level: the 1000, 1200 and 1400 buckets, rather than an exact individual Elo cutoff
or a conversion from Chess.com Elo. No master-game or bullet data is requested.

Walk only the authored move paths in each side's graph, taking positions before
an opponent move. Merge duplicate normalised `positionKey`s (including across
sides), then request each position once. Never traverse combinations created only
by merging transpositions. Match returned UCI moves to authored reply edges at
that key; ignore unrepresented moves and never add repertoire lines.

Weight = 100 × reply game count / all games at that position, using white + draws
+ black counts. These percentages share the scale of the bundled `[%weight]`
estimates. A reply absent from the top 8, or a position with no games, keeps its
bundled estimate. A returned zero is a real refreshed zero. Sampling normalises
the resulting weights among available authored replies.

Requests are sequential with one second between positions. HTTP 429 waits at
least 60 seconds, then 120 seconds, or longer when Retry-After asks for it (seconds
or HTTP date). There are at most three attempts per position. A requested pause
longer than five minutes ends the run without retrying early. Each request has a
20-second timeout. Cancel, closing Settings, hash navigation and page exit abort
the in-flight request or delay.

## Atomicity, fallback and persistence

A run collects all results in memory and commits **all or nothing** in one
IndexedDB transaction. Auth, network, timeout, exhausted 429, malformed/illegal
data or cancellation before commit leaves stored weights untouched. Errors use
fixed safe English messages. No real network calls occur in tests; all tokens
are dummy fixtures. Existing weights remain active throughout a partial run.

Schema v11 adds the public `replyWeights` store, keyed by position + canonical
query parameters. Each record contains positionKey, query, fetchedAt (epoch ms),
and UCI-to-percentage weights. The registry drives upgrade, export, restore and
validation. The v10 -> v11 migration initialises this store without losing data;
older Undo snapshots are discarded on upgrade as required by ADR-0003.

Weights are **exportable**: they are public aggregate statistics, not credentials,
and a backup should preserve the learner's ordering offline. Merge keeps the newer
fetch date per position/query; local wins equal-date ties. Replace takes the
backup. Validation checks canonical position identity, legal UCI moves, supported
query parameters, record ID, bounded percentages, unique records and dates (at
most one day ahead of the validation clock). Undo restores the pre-import weights
and preserves subsequent local refresh records, identified against the exact
post-import baseline; imported-only records disappear. Merge rules retain newer
pre-import data when resolving later changes.

`effectiveReplyWeight` is the single fallback decision at the Repertoire edge
boundary, shared by selected-line views. Existing reply sampling, first branching
reply cohort ordering, coverage's line ordering and Home's cohort/continue choice
therefore consume the same weights. Authored main lines still come first. Startup
and import/Undo reload the weights locally, without network activity.

Background: [golden rules and common lines](research/04-golden-rules-and-common-lines.md)
and [Lichess studies](research/07-lichess-studies.md). Statistics do not verify
study content or change authored chess explanations.
