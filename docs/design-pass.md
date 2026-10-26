# Design pass implementation notes

## Review / future PR description

Compact users previously lost navigation entirely; they can now switch among
five persistent labelled tabs and reach Threat Scan, Free play and Settings in
at most two taps. The desktop sidebar keeps every section. Existing hashes,
training logic, storage formats and engine behaviour stay unchanged.

The dark-blue Chess.com-inspired palette and board-first training layout remain.
Home now prioritises a single session action, full-width timed Today rows and one
Continue card. Weekly plan and Progress are native disclosures, open by default
at 1100px and wider; the empty-profile Welcome card remains first.

Typography uses rem and a 12px floor; compact body paragraphs use 16px and
secondary text 13px. Semantic colours distinguish content links from primary
and selected state. See [the token table](design-tokens.md) for computed ratios.
Controls have 44px compact/coarse-pointer and 28px desktop minimum heights, with
48px content-link rows and 56px session rows. Navigation icons use inline SVG.

Compact training options are native disclosures, expanded for the opening
overview and collapsed during an exercise, so the board remains prominent.
The frame uses the available width with 12px page gutters and a viewport-height
budget. Controls stay below the board and content reserves tab/safe-area space.

Hosting assets include viewport-fit=cover, theme colour, a manifest, SVG favicon
and 180/192/512px PNGs generated from one SVG with
`node scripts/generate-icons.mjs`. No service worker or runtime dependency added.
The pre-existing icon link pointed to a missing file; that asset now exists.

### Foundation references used

These are the supplied `apple-design/references/hig/` files, read from
the Apple Human Interface Guidelines pages used by the apple-design review skill:

- [tab-bars.md — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): persistent navigation, labels, few tabs, no overflow tab.
- [buttons.md — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): comfortable hit regions and one prominent next action.
- [typography.md — Typography](https://developer.apple.com/design/human-interface-guidelines/typography): readable minimum sizes and scalable text.
- [color.md — Color](https://developer.apple.com/design/human-interface-guidelines/color): semantic meaning and contrast.
- [accessibility.md — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): larger text, focus, adequate controls and non-colour state cues.
- [layout.md — Layout](https://developer.apple.com/design/human-interface-guidelines/layout): available-space adaptation and safe areas.
- [writing.md — Writing](https://developer.apple.com/design/human-interface-guidelines/writing): consistent sentence case, Practice spelling, concise labels and actionable errors.

Apple foundations are applied to this browser app. Native platform appearance,
Liquid Glass, light mode and app-specific platform APIs are outside this product's
scope. Product names such as Threat Scan, Golden Rules and Game Review remain
proper names; normal labels use sentence case.

### Verification

`e2e/design.spec.ts` checks all eight hash destinations plus imported-game Review
at 390x844, 820x1180 and 1280x800: document overflow, responsive navigation,
visible text sizes, and HTML control heights. Compact contexts use `hasTouch`.
It additionally covers two-tap section access, native disclosures, 320px layout
with 200% root text size, Learn/Practice/Drill, and both board orientations.
Existing assertions remain intact; selectors/text expectations change only for
the visible copy updates (Practice, practiced, Opening puzzles, Free play).

Screenshots are written to `test-results/design-*` by Playwright. Home (Welcome
and configured), Openings (overview and Learn), Puzzles, Threat Scan, Games,
Rules and imported-game Review were visually inspected at 390x844, 820x1180
and 1280x800. Practice, Drill and Free play were additionally inspected at both
compact sizes. The 320px doubled-text screenshots were checked for wrapping.
No requested screen was left visually unverified. The board controls remain in
normal document flow below the board; scroll to reach them on compact screens.
The persistent tabs never cover the end of that content.

Pixel sampling of the saved coordinate screenshots at 390 and 820px in both
orientations confirms square RGB (222,229,233)/(93,126,156), coordinate ink
(24,45,68) and opaque backing (16,27,44). Original light ink on the dark square
was 3.34:1; on the new backing it is 13.57:1. Dark ink on light squares is
11.01:1. No square colours or drawing gestures changed.

Final checks on the rebased design pass (all exit 0):

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npx vitest run` | 47 files, 376 tests passed (28.41s) |
| `npm run build` | Passed; 220 modules, existing >500kB chunk warning remains |
| `npm run check:repertoire` | 528 positions, 0 flags; all meet -1.00 threshold |
| `npm run check:copy` | 1591 items passed; also included in repertoire check |
| `PLAYWRIGHT_PORT=5204 npx playwright test --workers=1` | 88 passed (5.4m) |
| Targeted empty-exception regression after final quiz polish | 1 passed (3.4s) |
| `git diff --check` | Passed |

Existing dependencies were already installed and all commands resolved the
lockfile versions, so `npm ci` was unnecessary. No checks were skipped.
Build bundle splitting is outside this visual pass; no dependencies were added.

### Review scope and limits

Implementation was reviewed against both the ten audit findings and engineering
standards: no engine, move, scheduler, persistence or routing logic changed; SVG brush
colours resolve semantic CSS tokens while preserving literal stroke attributes; no
new runtime dependencies; native controls and disclosures retain keyboard access;
focus and reduced-motion rules remain. The CodeRabbit CLI is not installed.
Council review belongs to the parent workflow; this implementation sub-agent does
not recursively delegate or open a PR.

T3 preview navigation succeeded, but snapshot twice returned
`Preview automation snapshot timed out after 15000ms.` Visual verification uses
the explicitly requested Playwright browser and saved screenshots instead.

### Scope decisions

No service worker, runtime dependency, backend, route migration, accent redesign
or copy-cutting premium pass was added. Authored PGNs and the LLM contract remain
unchanged. Existing aria-labels and test IDs stay stable. American English was
applied to visible interface copy; product names retain their defined spelling.
The new empty-exception test opens all five affected rules and verifies their
reason text and absence of an exception label, plus a populated-rule control and empty-exception quiz feedback.

Work was preserved in three logical commits before rebasing onto `origin/main`
`c42ee16` (PR #50); a final polish/verification commit records the completed pass.
No PR was opened or merged. Council review stays with the parent workflow.

### Changed files

- `docs/design-pass.md`
- `docs/design-tokens.md`
- `e2e/board.spec.ts`
- `e2e/dashboard.spec.ts`
- `e2e/design.spec.ts`
- `e2e/engine.spec.ts`
- `e2e/games.spec.ts`
- `e2e/openings.spec.ts`
- `e2e/practice-stage.spec.ts`
- `e2e/puzzles.spec.ts`
- `e2e/threats.spec.ts`
- `index.html`
- `public/assets/icon-180.png`
- `public/assets/icon-192.png`
- `public/assets/icon-512.png`
- `public/assets/icon.svg`
- `public/manifest.webmanifest`
- `scripts/generate-icons.mjs`
- `src/App.tsx`
- `src/Icon.tsx`
- `src/TrainingOptions.tsx`
- `src/board/Board.tsx`
- `src/board/board.css`
- `src/engine/EngineBoard.tsx`
- `src/explorer/ExplorerSettings.tsx`
- `src/import/Games.tsx`
- `src/import/games.css`
- `src/llm/Rephrase.tsx`
- `src/plan/Dashboard.tsx`
- `src/plan/dashboard.css`
- `src/puzzles/Puzzles.tsx`
- `src/puzzles/puzzles.css`
- `src/review/ReviewPage.tsx`
- `src/review/review.css`
- `src/rules/GoldenRules.tsx`
- `src/rules/RuleQuiz.tsx`
- `src/styles.css`
- `src/threats/ThreatScan.tsx`
- `src/threats/threats.css`
- `src/trainer/Openings.tsx`
