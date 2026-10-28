# Chess Learning Space: premium direction

A quiet chess study table. Positions carry the identity; typography, space and
hairline rules organize the work. The board stays the strongest visual object.

## Study desk refinement (2026-10-27)

Reference: [Designeer](https://designeer.xyz/) and its inspiration collection.
The catalogue's compact sidebar, framed previews and restrained separators inform
the composition; its gallery previews loaded only partially during inspection.
No external components, images, fonts or dependencies are copied into the app.

Home pairs an ordered training list with one large, real repertoire position.
The existing session action sits inside Today. Continue retains the existing
position, orientation, stage and destination from the dashboard read model.
Session numbers express the actual recommended order. Weekly plan and Progress
remain native keyboard-operable disclosures. The sidebar uses a framed knight
mark and a quiet bordered selection. Home titles scale from 32 to 44px; the
existing self-hosted typefaces, palette and board interactions stay in use.

Below 600px the two columns stack; the session action remains first. A single
decorative SVG position is enlarged rather than adding an interactive board.
Dashboard styles load after the shared foundations from the application entry.
No new animation is introduced. Existing copy budgets, touch-target, overflow,
navigation, populated-profile and 200% text checks cover the refinement.

## Appearance and palettes (2026-10-27)

The learner's request for a new palette and selectable light/dark modes supersedes
this document's original fixed navy/brass direction. The single source for color
tokens is now `src/appearance.css`; `src/styles.css` owns shared geometry and type.

Settings offers System, Light and Dark independently of four palettes: Graphite
(neutral gray and cool blue), Violet (soft purple, inspired by T3 Code's theme
selection), Forest (sage and natural tones), and Sand (warm stone and copper).
All eight combinations include coordinated surfaces, text, actions, borders,
status colors and board squares. Semantic success/warning/danger colors adapt to
light/dark mode. Drawing colors and evaluation colors keep their chess meaning.

System + Graphite is the default. Preferences use the existing local settings
store and startup mirror; the appearance is applied before the React tree renders.
System mode subscribes to operating-system changes. Explicit Light/Dark choices
ignore those changes. Settings stay local during sync and Merge; explicit backup
Replace follows the existing settings restore behavior. Optional schema fields
keep older backups valid. Invalid startup preferences fall back to the defaults.

Native radio groups provide arrow-key navigation and visible focus on the whole
option. Text, secondary text, links, status colors and primary-button labels meet
4.5:1 against their relevant surfaces in the eight-palette browser matrix. Board
coordinates use an independent dark backing so light mode cannot erase them.
No animation or runtime dependency is added. Static installed-app icons use the
Graphite identity and versioned asset paths; browser chrome follows the active
canvas color. PNGs are regenerated with `node scripts/generate-icons.mjs`.

## Type and positions

**IBM Plex Sans Variable** carries controls and body text. **IBM Plex Serif**
(normal 400) gives page titles and the recommended action a quieter chess-club
voice. Display titles scale from 32 to 48px; body uses 16px. **JetBrains Mono Variable** makes
SAN, PV, FEN and rating data easy to scan. All numerals are tabular. Only normal
Latin WOFF2 files ship, self-hosted through npm packages, with `font-display:
swap`, system fallbacks and a primary-font preload. The floor remains 12px; all font licenses ship in `public/fonts/`.

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

## Guided study refinement (2026-10-28)

The learner chose a modern chess-club direction: quiet type, fewer symbols and a
clear route into practice. Desktop navigation is grouped into Practice, Study
and Review and uses text labels; compact navigation retains a consistent 1.5px
SVG set. Existing light/dark modes and all four palettes stay available.

Home recommends one next action from real progress: due opening reviews first,
then the selected unfinished line's Learn or Practice stage, otherwise tactics.
When the recent line is already in Drill, the next unfinished active line is
recommended, preferring the selected opening. Direct starts on reviewed lines
with nothing due open whole-line Practice instead of an empty drill.
Optional further exercises remain visible underneath. The large repertoire
position carries a score-strip of the line's actual starting moves. No new
session-completion state, storage or rating behavior is introduced.

Opening links with start=1 consume their intent once after the saved log loads;
the actual persisted stage decides Learn versus Practice/Drill. Locked lines do
not auto-start. Group-review links retain the existing group scope. The visible
Learn / Practice / Drill path explains what each stage does. The recommended
stage action is outside configuration disclosures. Saving a lesson returns to
an explicit Practice action; completed exercises offer a return to the plan.
During a lesson or review, alternate mode buttons give way to one explicit
Back to overview action. If the selected line has no due moves but another
line in its opening does, the overview recommends the group review first.

Lesson navigation stays above the board and remains sticky on larger screens.
On phones it stays in normal flow so long comments cannot cover the board.
Next move advances the lesson; Complete lesson appears on the last
move. Authored explanations remain visible next to these controls, with no
additional hints in whole-line Practice. Essential puzzle/scan instructions are
visible rather than hidden in help. All attempts and unlocks still use ADR-0002.
