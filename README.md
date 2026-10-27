# Chess Learning Space

A personal chess training space for one player around 1000 Elo, built to fix two weak spots: openings and threats two or more moves ahead. It runs in the browser, keeps progress on your device, and works offline once loaded.

- **Openings:** White plays the Italian (Giuoco Pianissimo) and the London. Black plays the Caro-Kann and the QGD setup. Learn, Practice and Drill with spaced repetition.
- **Golden Rules:** 42 short rules with an example position each, plus a quiz.
- **Threat Scan:** train yourself to see checks, captures and hanging pieces on both sides.
- **Puzzles:** 50,000 Lichess puzzles by motif and rating, a Woodpecker mode, and puzzles from your own openings.
- **Games and Game Review:** import your Chess.com games, then review them with Stockfish (move classes, accuracy, mistake cards).
- **Home:** a short daily session and a flexible weekly plan, with no streaks.
- **Optional:** encrypted sync between devices, an LLM that rewords explanations, and Lichess explorer weights. All are off by default.

Progress is stored in IndexedDB in your browser and can be exported as JSON. Nothing leaves the device unless you turn on sync or an optional integration.

## Run locally

For everyday training, double-click `start.cmd` (or run `npm start`). It builds the app and opens it at http://127.0.0.1:4173. Always use this address: progress lives in IndexedDB, which is separate per origin, so the dev server on port 5173 has its own progress. To move progress between the two, export it in Settings on one and import it on the other.

For development, requires Node 24+ and npm 11. From the repository root:

```powershell
npm ci
npx playwright install chromium
npm run dev
```

Open http://127.0.0.1:5173. Progress and settings live in IndexedDB. Existing localStorage settings are copied on first open; localStorage remains a startup mirror. Free-play moves stay in memory and reset on reload. The app has no backend and makes no external runtime requests.

## Data & backup

Settings → **Data & backup** shows persistent/best-effort storage and the last export time. The first saved review requests persistent storage without blocking further reviews. Export JSON downloads a versioned backup of reviews, learned golden rules and settings. Secrets and derived SRS state are excluded through an explicit allow-list.

Import JSON validates the complete file (maximum 50 MiB), then asks for **Replace** (restore incoming reviews, learned rules and settings) or **Merge** (union attempts by `attemptId`, keep local conflicts and settings, and keep a rule learned if it was learned in either copy). A pre-import snapshot downloads before the atomic IndexedDB transaction; snapshot errors abort the import. Keep that file to undo an import. If another tab changes data during the download, retry the import so the snapshot covers those changes too. Browsers report download initiation, but cannot confirm that a user saved the file to disk.

Older backups use the same forward migrations as IndexedDB upgrades; newer schemas and unknown stores are rejected. Missing content is retained as retired cards, and schedules are rebuilt from the review log. A backup reminder appears after seven days or 200 attempts since the last backup; **Later** starts another seven-day/200-attempt window. Successful imports also reset that window because the imported file and snapshot cover the resulting data. A tab that encounters a database version change closes its connection and asks for a reload.

Schema v5 adds `ruleState` to the review log, metadata, settings and secrets stores. The store registry in `src/progress/stores.ts` owns each store's key, validation, merge policy and export flag; database upgrade, snapshot and restore all read from it. Future scan logs, personal cards, ratings and games are not created yet.

## Board controls

Settings opens with **Appearance mode** (System, Light or Dark) and **Color theme**
(Graphite, Violet, Forest or Sand). Changes apply immediately and stay on this
device. System follows the operating system; the other modes stay fixed.
The theme includes board colors, and JSON backup/restore includes the preference.

- Drag a piece, or click a piece and then its target. Legal targets are dots; captures are rings. Illegal moves return silently.
- Right-drag draws arrows; right-click draws circles. Shift/Ctrl selects red, Alt selects blue, both select yellow. Left-click clears marks.
- Choose queen, rook, bishop or knight when promoting. Cancel or Escape restores the original position without adding a move.
- Left/right arrows step backward/forward; up/down go to the first/last position. The move list and navigation buttons do the same. Playing from an earlier position replaces the future continuation.
- Flip board changes orientation. Board settings control sound, animation duration, coordinates and reduced motion. The OS reduced-motion preference supplies the initial default.
- Load a position accepts a standard FEN, including a Black-to-move position. Invalid input leaves the board unchanged.

## Modules

- `src/game/Game.ts`: the only rules boundary, backed by chess.js. Stores UCI history and a cursor; exposes FEN, legal destinations, SAN/UCI conversion, promotion choices, PGN parsing and navigation. `positionKey(fen)` implements ADR-0001, including legal-only en passant.
- `src/board/Board.tsx`: React/Chessground adapter. Receives the position, orientation, movable side, legal destinations, shapes, highlights and input lock. Emits move intents and shape changes; contains no chess rules. Callers remain responsible for updating the position after each intent, including rejection/cancellation.
- `src/App.tsx`: the app shell and free-play page. Promotion is a cancellable transaction; no move is committed before the learner chooses a piece. Hash routes switch between free play, openings and golden rules.
- `src/rules/`: the typed Golden Rules catalogue (42 principles with phase, reason, exception, creator, source, example FEN and arrows), the Top-10 ordering and the learned-state merge. `GoldenRules.tsx` renders read-only example boards and the learned toggle.
- `src/repertoire/`, `src/scheduler/`, `src/trainer/`: the PGN-compiled position graph, the SM-2 review scheduler and the Italian learn/drill session.
- `src/progress/`: IndexedDB behind the store registry, forward migrations, backup/export/import and the React progress hook.
- `src/PromotionPicker.tsx`, `src/SettingsPanel.tsx`, `src/settings.ts`, `src/sound.ts`: focused UI and browser adapters.
- `src/styles.css`, `src/board/board.css`, `src/pieces.css`: responsive dark-blue theme, board interaction states and piece mapping.

All bundled piece and sound assets, source references, checksums and licence texts are documented in [ATTRIBUTION.md](ATTRIBUTION.md). Sounds can be regenerated with `python scripts/generate-sounds.py`; Python is not needed to build or run the app.

## Checks

```powershell
npm run check:repertoire
npm run check:copy
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`check:repertoire` runs the copy check before the Stockfish audit. `check:copy` checks authored learning text in the rule catalogue, PGN comments and summaries, and non-JSX review, quiz, threat, engine and trainer modules. Rule reasons have at most 20 words, exceptions 15, move comments 25; summaries have at most two sentences. It rejects en/em dashes and the banned wording listed in `scripts/check-copy.mjs`. Keep PGN moves and annotations unchanged during copy edits. The security-reviewed LLM prompt is excluded.

For a focused domain check: `npm test -- src/game/Game.test.ts`. Playwright runs Chromium only and starts Vite automatically when port 5173 is free. `test-results/` contains traces on failure. The browser tests cover real mouse gestures, promotion/cancellation, drawings, navigation, settings, check highlights, invalid FEN, narrow layouts, the Italian lesson and drill, backups, and the Golden Rules learned state.

## Hosting and sync

`vercel.json` and `api/sync.ts` support a free Vercel Hobby deployment with optional end-to-end encrypted sync. See [docs/hosting.md](docs/hosting.md) and [ADR-0005](docs/adr/0005-optional-encrypted-sync.md).

## License

GNU Affero General Public License v3.0 or later, see [LICENSE](LICENSE). The app bundles Chessground (GPL-3.0-or-later) and Stockfish (GPL-3.0) and ports the Lichess accuracy formula (AGPL-3.0), so the whole work is offered under the AGPL. Asset and font attributions are in [ATTRIBUTION.md](ATTRIBUTION.md). Puzzle data comes from the Lichess puzzle database (CC0).
