# Asset attribution

Verified from upstream sources on 2026-10-28. No Chess.com assets are used.

| Files | Author/source | Licence | Changes |
| --- | --- | --- | --- |
| `public/assets/icon-v{2,3}.svg` and `public/assets/icon-v{2,3}-{180,192,512}.png` | Original artwork for Chess Learning Space | No third-party asset | Hand-drawn vector knight profile; PNGs generated from the SVG |
| `public/pieces/{w,b}{K,Q,R,B,N,P}.svg` (12 files) | Colin M. L. Burnett (cburnett), via Lichess lila | GPL-2.0-or-later | None |
| `public/sounds/move.wav`, `capture.wav`, `check.wav` and `scripts/generate-sounds.py` | Original synthesized sounds created for Chess Learning Space | CC0-1.0 | Original work; no third-party samples |
| Chessground JS and base CSS (npm `@lichess-org/chessground` 9.2.3) | Thibault Duplessis and Lichess contributors | GPL-3.0-or-later | Base CSS imported; independent blue theme layered on top |

## Verification and reproducibility

- Pieces and their licence declaration are pinned to lila commit `7ee0938942be063ca0b70084e70108bd1bea661a`.
- [Upstream licence table](https://raw.githubusercontent.com/lichess-org/lila/7ee0938942be063ca0b70084e70108bd1bea661a/COPYING.md) explicitly lists `public/piece/cburnett` as GPLv2+. A copy is included at `public/licenses/lila-COPYING.md`.
- [Piece source directory](https://github.com/lichess-org/lila/tree/7ee0938942be063ca0b70084e70108bd1bea661a/public/piece/cburnett). SVG files are the preferred editable source; `public/pieces/SOURCE.json` records SHA-256 checksums.
- [Scoped Chessground npm package](https://www.npmjs.com/package/@lichess-org/chessground/v/9.2.3) and its installed package declaration specify GPL-3.0-or-later; the existing GPL-3.0 licence text still applies. Version 9.2.3 is pinned with integrity in `package-lock.json`.
- Migration check: [upstream releases](https://github.com/lichess-org/chessground/releases) and the published 9.2.3 source/types retain the 9.2.1 API used here (including `events.select`, `eraseOnClick`, destinations, shapes and base CSS). Only the import namespace changes. Use the compatible 9.x successor rather than mixing in 10.x API changes. The npm website returned HTTP 403 during verification, so package metadata/source were obtained through the npm registry CLI.
- The lila copying table does not clearly offer its standard sound set under a free licence, so those sounds were not copied. The three original WAV files can be reproduced with `python scripts/generate-sounds.py`. Their source and resulting sounds are dedicated to the public domain under CC0-1.0.
- Licence texts are included in `public/licenses/`: GPL-2.0, GPL-3.0 and CC0-1.0. GPL-2.0 was obtained from gnu.org, GPL-3.0 and CC0 from the SPDX licence-list repository.
- Noto Sans (npm `@fontsource-variable/noto-sans`) is bundled as a self-hosted Latin WOFF2 file under the SIL Open Font License 1.1. Its licence is in `public/fonts/`. The app falls back to the system sans-serif font.

Chessground (GPL-3.0-or-later) and the Stockfish build (GPL-3.0) are distributed with the app, and the game accuracy port is derived from AGPL-3.0 code, so the source of any public deployment must be public (see `docs/hosting.md`).

## Game accuracy formula

`src/review/accuracy.ts` ports the algorithm in Lichess lila
[`AccuracyPercent.scala`](https://github.com/lichess-org/lila/blob/e19c044af145c833d3a9133fa8f9418b1159767d/modules/analyse/src/main/AccuracyPercent.scala)
(lila authors, AGPL-3.0-or-later), with the ADR-0004 Book exclusion and minimum
sample size. Population deviation and harmonic-mean semantics follow
[`scalalib/Maths.scala`](https://github.com/lichess-org/scalalib/blob/master/lila/src/main/scala/Maths.scala)
(Thibault Duplessis, MIT). Reference calculations are documented in
`docs/research/08-game-review-accuracy.md`. Licence texts are included in
`public/licenses/AGPL-3.0.txt` and `public/licenses/scalalib-MIT.txt`.

## Stockfish engine

`public/stockfish/stockfish-19-lite-single.js` and `.wasm` are unmodified
nmrugg/stockfish.js **19.0.1** from npm `stockfish@19.0.1`, pinned exactly in
package.json and package-lock.json. Stockfish authors and Nathan Rugg;
GPL-3.0 (licence text: `public/licenses/GPL-3.0.txt`).

- Source and build instructions: https://github.com/nmrugg/stockfish.js/tree/v19.0.1
- Package archive: https://registry.npmjs.org/stockfish/-/stockfish-19.0.1.tgz
- Exact SHA-256 digests are recorded below and in `public/stockfish/SOURCE.json`.
- Reproduce by `npm ci`, then copy only `node_modules/stockfish/bin/stockfish-19-lite-single.{js,wasm}` into `public/stockfish/`. Verify both SHA-256 values before replacing files.
- These adjacent static assets work in Vite dev and build without COOP/COEP.
- `stockfish-19-lite-single.js`: `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a`
- `stockfish-19-lite-single.wasm`: `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de`
