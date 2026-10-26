# Curated puzzle snapshot

Run `npm ci`, then `npm run build:puzzles` with Node 24. The builder downloads
the CC0 Lichess archive into the gitignored `.cache/puzzles/`, verifies the
SHA-256 in `SOURCE.json`, and stream-decompresses it with `fzstd`. This also
handles the archive's skippable Zstandard frames without a system install.

The upstream URL changes. Keep the matching cached archive for future rebuilds;
a different checksum fails rather than silently switching datasets. To update
the snapshot, explicitly review the new date, checksum and theme inventory.

The builder inventories the entire original Themes column. Requested themes
absent from the snapshot are recorded in the manifest. `overloading` was the
only absent theme and is excluded from the training allow-list; Deflection is
shown as “Deflection (incl. overloading ideas)” without changing original tags.

Quality filters: rating 600–1700, rating deviation ≤100, popularity ≥80,
at least 100 plays. Each eligible row goes into its least-filled original motif
bucket, up to 2,273 rows per bucket. This produces 50,006 distinct puzzles.
Every retained motif must have at least 300 puzzles or the build fails.
Manifest counts refer to these disjoint training buckets. All other original
themes remain tags. OpeningTags are retained for later repertoire filtering.

Compact JSON rows follow the field order documented in `SOURCE.json` and
`src/puzzles/types.ts`. The files in `public/puzzles/` are the distributed
dataset; they are fetched per motif and never imported into the app bundle.
`npm test` checks every solution for legality, counts, filters and duplicates.
