# Chess Learning Space: premium direction

A quiet chess study table. Positions carry the identity; typography, space and
hairline rules organize the work. The board stays the strongest visual object.

## Palette

| Role | Hex | Contrast on page / raised |
| --- | --- | --- |
| Canvas | `#0c1523` | Background |
| Page | `#101b2c` | Background |
| Raised | `#19273b` | Background |
| Text | `#e8edf4` | 14.69 / 12.80 |
| Secondary | `#b6c6da` | 9.94 / 8.66 |
| Metadata | `#a1afc1` | 7.75 / 6.75 |
| Brass action / selection | `#e0b25a` | 8.79 / 7.66 |
| Link | `#9bc9ff` | 10.03 / 8.74 |
| Success, mint | `#8ed5bf` | 10.22 / 8.91 |
| Warning, peach | `#e9a190` | 8.20 / 7.15 |
| Danger, rose | `#f5a5a5` | 8.89 / 7.75 |

Primary buttons use `#151c26` ink on brass: **8.72:1**. Brass suggests clock
hardware against blue; it identifies an action or selected state. Success uses
mint, with labels and shapes alongside color. Links stay blue and underlined.
The 1px structural border is `#ffffff14`, about 8% white. Board squares stay
`#dee5e9` and `#5d7e9c`; last-move and selected overlays derive from `--accent`.
The icon generator reads that same token. Radius: 8/12/16px; spacing: a 4px grid.

## Type and positions

**Hanken Grotesk Variable** gives the interface an open, legible rhythm with
more character than the previous system font. Titles use 32px, weight 600 and
slight negative tracking; body uses 16px. **JetBrains Mono Variable** makes
SAN, PV, FEN and rating data easy to scan. All numerals are tabular. Only normal
Latin WOFF2 files ship, self-hosted through npm packages, with `font-display:
swap`, system fallbacks and a primary-font preload. The floor remains 12px; both font licenses ship in `public/fonts/`.

`MiniBoard` is static SVG: 64 squares, existing piece SVGs, real FEN, optional
last move or arrow, and the learner's color at the bottom. It replaces decorative
imagery on Today, Continue, game rows, rule rows and loaded exercise intros.
Thumbnails are decorative next to their labels; the component also accepts a
concise accessible label. No Chessground instances are created for thumbnails.
Rating history becomes a sparkline, coverage a thin bar and the last seven
training days seven dots, each with a screen-reader text equivalent.

## Text and motion

Default pages show a title, useful status and actions. No taglines or paragraphs
that repeat a heading. Help uses a named keyboard-accessible disclosure with
one sentence. Rules show their short form and phase; authored explanations and
examples open on demand. The full catalogue and Settings sections are closed
initially. Authored chess content, PGN comments and the LLM contract are unchanged.

| Empty-profile page | Maximum visible words |
| --- | ---: |
| Home, first screen / whole page | 60 / 180 |
| Openings, Puzzles, Games, Threat Scan | 90 each |
| Golden Rules | 150 |

Counts cover rendered main content, including below the fold, excluding closed
disclosures, option menus, decorative text and screen-reader-only labels. Tests
check 390x844 and 1280x800. Plain American English, active verbs, sentence case,
Practice/Drill/Learn, no en/em dashes, filler or exclamation marks in UI prose.
Authored SAN annotation marks remain intact.

Only the session-complete ring adds motion (600ms); reduced-motion preferences
remove it. Existing piece movement and drawing gestures retain their settings.
Touch targets remain at least 44px, with the previous contrast and overflow checks.
