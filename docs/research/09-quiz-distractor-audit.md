# Golden Rules quiz distractor audit

All 42 resolved repertoire/catalogue examples were reviewed for PR #47.
Each now has an authored alternative and a position-specific reason in
`src/rules/quizDistractors.ts`, shown after either answer.

Changed alternative rule IDs (30 items):

- `one-move-per-piece`: `cct-scan` -> `push-passed-pawns`
- `knights-before-bishops`: `assume-best-move` -> `push-passed-pawns`
- `castle-early`: `rooks-open-files` -> `knight-on-rim`
- `develop-castling-side-first`: `trade-when-ahead` -> `push-passed-pawns`
- `avoid-lesser-piece-hits`: `bishops-open-knights-closed` -> `push-passed-pawns`
- `follow-principles-unknown-opening`: `count-attackers-defenders` -> `push-passed-pawns`
- `develop-with-tempo`: `least-valuable-piece` -> `centralize-queen-endgame`
- `dont-block-breaks`: `capture-when-sharp` -> `push-passed-pawns`
- `defend-when-winning`: `centralize-queen-endgame` -> `knight-on-rim`
- `attack-pinned-cheaply`: `real-not-hope-chess` -> `push-passed-pawns`
- `count-attackers-defenders`: `board-vision` -> `connected-passers-together`
- `least-valuable-piece`: `better-move-safe-first` -> `push-passed-pawns`
- `capture-when-sharp`: `ask-opponent-intent` -> `rook-endings-activity`
- `no-weaknesses-near-king`: `question-your-move` -> `push-passed-pawns`
- `push-passed-pawns`: `real-not-hope-chess` -> `knight-on-rim`
- `passed-pawn-zone`: `board-vision` -> `knight-on-rim`
- `king-active-endgame`: `better-move-safe-first` -> `centralize-queen-endgame`
- `king-first-pawn-endings`: `ask-opponent-intent` -> `rooks-open-files`
- `connected-passers-together`: `question-your-move` -> `opposite-bishops-draw`
- `opposite-bishops-draw`: `plan-four-five-moves` -> `rook-endings-activity`
- `rook-endings-activity`: `botvinnik-time-budget` -> `knight-on-rim`
- `centralize-queen-endgame`: `slow-critical-moves` -> `connected-passers-together`
- `real-not-hope-chess`: `botvinnik-time-budget` -> `push-passed-pawns`
- `board-vision`: `slow-critical-moves` -> `attack-pinned-cheaply`
- `better-move-safe-first`: `long-time-controls` -> `connected-passers-together`
- `ask-opponent-intent`: `one-move-per-piece` -> `push-passed-pawns`
- `question-your-move`: `knights-before-bishops` -> `connected-passers-together`
- `botvinnik-time-budget`: `one-move-per-piece` -> `rook-endings-activity`
- `slow-critical-moves`: `knights-before-bishops` -> `connected-passers-together`
- `long-time-controls`: `castle-early` -> `attack-pinned-cheaply`

The remaining 12 alternatives were retained after review and now also have authored reasons.
