# Design tokens

Dark-only, browser-only Chess Learning Space. The board remains the visual anchor.
Tokens live in `src/styles.css` in the existing `:root`. Legacy `--bg`, `--panel`
and `--muted` alias `--surface`, `--surface-raised` and `--text-subtle`.

Contrast uses the WCAG sRGB relative-luminance formula. Ratios below compare an
opaque foreground with the two main surfaces; surfaces and structural borders
are not text colours. All text tokens exceed 4.5:1 on both surfaces, including
small text. Disabled controls retain their existing subdued appearance.

| Token | Value | Role | On surface | On raised surface |
| --- | --- | --- | ---: | ---: |
| `--surface` | `#101b2c` | Page background | 1.00:1 | 1.15:1 |
| `--surface-raised` | `#19273b` | Cards, panels, dialogs | 1.15:1 | 1.00:1 |
| `--border` | `#ffffff14` | Structural separators; not a text colour | 1.25:1 | 1.27:1 |
| `--text` | `#e8edf4` | Primary text | 14.69:1 | 12.80:1 |
| `--text-muted` | `#b6c6da` | Secondary text | 9.94:1 | 8.66:1 |
| `--text-subtle` | `#a1afc1` | Metadata and eyebrows | 7.75:1 | 6.75:1 |
| `--accent` | `#e0b25a` | Primary actions, selected and active state | 8.79:1 | 7.66:1 |
| `--link` | `#9bc9ff` | Underlined content links | 10.03:1 | 8.74:1 |
| `--success` | `#8ed5bf` | Positive review classifications | 10.22:1 | 8.91:1 |
| `--warning` | `#e9a190` | Warnings and imperfect moves | 8.20:1 | 7.15:1 |
| `--danger` | `#f5a5a5` | Errors and blunders | 8.89:1 | 7.75:1 |
| `--info` | `#99c6e8` | Informational badges and progress | 9.54:1 | 8.32:1 |

Primary-action labels use `#151c26` on the accent fill (8.72:1).
Active navigation uses the accent on `#23364a` (6.29:1).
The 3px focus-visible ring remains; active state also has an inset stripe or border.
Decorative labels use muted text; links are blue and underlined. Session rows
have a chevron and a full-width hit region; primary navigation uses labelled SVGs.

## Type and touch

| Token | Size / line height at 16px root |
| --- | --- |
| `--text-xs` | 12 / 16px |
| `--text-sm` | 14 / 20px |
| `--text-base` | 16 / 24px |
| `--text-lg` | 18 / 26px |
| `--text-xl` | 24 / 30px |
| `--text-2xl` | 32 / 38px |

Sizes and matching `--leading-*` tokens use rem; unstyled body text uses 1.5 leading. Compact body paragraphs are at least
16px, secondary small text at least 13px, eyebrows and tab labels at least 12px.
Compact/coarse-pointer HTML controls are at least 44px high, Today rows at least
56px, content link rows at least 48px; desktop controls are at least 28px.
Control groups use at least 8px gaps. The tab bar reserves safe-area padding.
The page reserves text-scalable space below content so tabs cannot cover its end.

## Board coordinates

The original coordinate colour `#dee5e9` on the pixel-sampled dark square
`#5d7e9c` was 3.34:1, a real failure for small text.
The original alternating ink colours are preserved. Light ink gets a small
opaque `--surface` backing behind the label: 13.57:1. Dark ink `#182d44`
on the light square remains 11.01:1. Square colours are unchanged.
Both orientations are captured and sampled by the design verification workflow.
Chessground snaps the actual board to whole device-pixel squares (less than 8px
below its available frame width at device scale 1); tests account for this while
asserting the frame uses the full viewport width minus the 24px page gutters.

## Supporting palette

Every CSS colour declaration resolves through the same `:root`, including SVG
annotation brushes (resolved to literal SVG attributes for Chessground).
The chess-piece SVG artwork and generated brand artwork keep their own pixels;
these are image assets rather than application theme colours. Board square colours and annotation semantics stay independent from the action accent; last-move and selection overlays derive from it.

Only `--accent` needs changing to replace the action colour. Its hover, shadow,
selected tint and border derive with `color-mix`; `--on-accent` is the label ink
and should be contrast-checked against a future accent.

| Token | Value | Role |
| --- | --- | --- |
| `--sidebar` | `#0c1523` | sidebar |
| `--square-light` | `#dee5e9` | square light |
| `--square-dark` | `#5d7e9c` | square dark |
| `--last-move` | `color-mix(in srgb, var(--accent) 48%, transparent)` | last move |
| `--border-strong` | `#59718f` | border strong |
| `--control` | `#25354c` | control |
| `--control-hover` | `#344860` | control hover |
| `--selected-surface` | `#23364a` | selected surface |
| `--on-accent` | `#151c26` | on accent |
| `--player-light` | `#d8e1e8` | player light |
| `--player-ink` | `#263b51` | player ink |
| `--eval-dark` | `#20252c` | eval dark |
| `--eval-light` | `#f2f1ed` | eval light |
| `--info-surface` | `#18374b` | info surface |
| `--annotation-move` | `#f7941d` | annotation move |
| `--annotation-danger` | `#ff4055` | annotation danger |
| `--annotation-plan` | `#27efc0` | annotation plan |
| `--annotation-ray` | `#fff129` | annotation ray |
| `--board-ink` | `#182d44` | board ink |
| `--board-selection` | `color-mix(in srgb, var(--accent) 54%, transparent)` | board selection |
| `--board-destination` | `#182d4470` | board destination |
| `--board-check-core` | `#e24848ee` | board check core |
| `--board-check-edge` | `#e2484888` | board check edge |
| `--shadow-board` | `#0004` | shadow board |
| `--shadow-dialog` | `#0008` | shadow dialog |
| `--scrim` | `#07101caa` | scrim |
| `--border-quiet` | `#ffffff06` | border quiet |
| `--accent-hover` | `color-mix(in srgb, var(--accent), white 15%)` | accent hover |
| `--accent-shadow` | `color-mix(in srgb, var(--accent), black 32%)` | accent shadow |
| `--accent-soft` | `color-mix(in srgb, var(--accent) 9%, transparent)` | accent soft |
| `--accent-border` | `color-mix(in srgb, var(--accent) 33%, transparent)` | accent border |
| `--info-soft` | `color-mix(in srgb, var(--info) 7%, transparent)` | info soft |
| `--info-fill` | `color-mix(in srgb, var(--info) 19%, transparent)` | info fill |
| `--warning-border` | `color-mix(in srgb, var(--warning) 40%, transparent)` | warning border |

Opaque coordinate ink/background contrast: `--square-light` on `--surface`
13.57:1; `--board-ink` on `--square-light` 11.01:1. Primary label contrast is
8.72:1; content link contrast remains 8.74:1 or better. Structural borders and
translucent overlays are not text colours. `transparent` is used only for absent
paint and gradient cutouts.


## Premium pass additions

Canvas `--canvas: #0c1523`, page `--surface: #101b2c` and raised
`--surface-raised: #19273b` form three levels. Structural borders use 8% white;
they do not carry text or the only indication of a selected control. Radius tokens
are 8/12/16px. Spacing tokens use a 4px grid; board coordinates keep their
pixel geometry.

Hanken Grotesk variable (100-900) is the primary face; titles use 600.
JetBrains Mono variable (100-800) handles SAN, FEN, PV and rating values.
Only normal Latin WOFF2 files ship (34.70/40.40kB), with swap and system fallbacks.
The primary face is preloaded from the same origin. All text uses tabular numerals.

The only added interface animation is a 600ms session-complete ring.
System and in-app reduced-motion settings remove it. Existing chess-piece movement
settings and board interactions are retained. Icons are regenerated from the semantic
accent by `node scripts/generate-icons.mjs`.
