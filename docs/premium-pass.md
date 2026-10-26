# Premium pass implementation record

Base: `main` at `424b3ce`. Branch: `feat/premium-pass`.

The visual direction and contrast table are in [design-direction.md](design-direction.md)
and [design-tokens.md](design-tokens.md). Hanken Grotesk and JetBrains Mono are
normal Latin variable WOFF2 fonts, served locally. The brass primary action has
8.72:1 label contrast. Thumbnails use real positions and existing piece artwork.

## Copy measurement

Baseline counts are the desktop empty-profile measurements supplied in the task,
not a new measurement of the old branch. New counts come from
`e2e/copy-budget.spec.ts`: rendered main content including below the fold, with
closed disclosures, select options, decorative elements and accessible-only text
excluded. Opening a disclosure makes its text count; there is no authored-content
selector exemption in the test.

| Page | Before, desktop | After, 390px | After, 1280px |
| --- | ---: | ---: | ---: |
| Home, whole page | 436 | 57 | 54 |
| Home, first screen | Not supplied | 45 | 51 |
| Openings | 301 | 37 | 35 |
| Puzzles | 172 | 64 | 74 |
| Games | 167 | 35 | 35 |
| Threat Scan | 143 | 74 | 78 |
| Golden Rules | 1,358 | 94 | 94 |

All requested budgets pass. Different compact counts reflect the visible
navigation and configuration disclosures; hidden content is not erased.

## Verification and visual review

The screenshot matrix lives in `test-results/design-design-foundations-and-screenshots-at-{390,820,1280}-chromium/`.
Each width uses heights 844, 1180 and 800 respectively. It includes Home empty,
Home populated with real seeded review logs, Openings overview/Learn/Drill,
Puzzles, Threat Scan, Games, Golden Rules, Review and Settings. Additional captures
cover the configured Home, populated Games, Review board, board orientations and
320px with doubled text.

The T3 preview opened, but two snapshot attempts returned
`Preview automation snapshot timed out after 15000ms.` The requested Playwright
browser and saved screenshots provide the visual inspection instead.

All requested views were inspected at all three sizes; none was left visually
unverified. The repeated positions and quieter separators give the app a specific
chess identity. Visual inspection prompted four corrections: a compact opening
selector so its board preview fits the first phone screen, one primary action in
Welcome, a one-line Games empty state with an action, and readable placeholders
plus aligned Continue thumbnails. Learn, Drill and Review keep the board as their
main object; compact controls remain below it in normal scroll flow.

| Check | Result |
| --- | --- |
| `npm ci` | Exit 0; 213 packages installed, audit found 0 vulnerabilities |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm run check:copy` | Exit 0; 5,582 items, no banned authored wording or en/em dashes |
| `npm run check:repertoire` | Exit 0; every position meets the -1.00 threshold, no flags |
| `npx vitest run` | Exit 0; 52 files, 403 tests passed (26.84s) |
| `npm run build` | Exit 0; 231 modules, 415ms bundling; existing >500kB chunk warning remains |
| `PLAYWRIGHT_PORT=5207 npx playwright test --workers=1` | Exit 0; 93 passed (6.5m) |
| Targeted hosting/Practice/puzzles/quiz/threat regression run | Exit 0; 23 passed (1.8m) |
| Production browser CSP/font checks | Both fonts load from the same origin; no startup/engine CSP violation or startup console error; external scripts remain blocked |
| `git diff --check 424b3ce` | Exit 0 |

No required check was skipped. Early runs found changed disclosure paths and the
startup CSP issues above; the final complete suite passes with the original
behavioral assertions retained. Build splitting remains outside this visual pass.

## Review against standards and specification

- Navigation hashes, game input, scheduler rules, engine behavior, storage formats,
  sync protocol and import/export behavior are retained. The new dashboard fields
  are derived display data only; thumbnails do not write progress.
- Authored rule catalogue, PGNs, explanation templates and LLM prompt are unchanged.
  Full rule details, help and Settings sections use disclosures. Tests take the
  new visible navigation steps and retain their original behavioral assertions.
- SVG thumbnails rotate squares, artwork, highlights and arrows together; unit
  checks cover white/black coordinates, piece count and accessible labeling.
- Small-text contrast, 12px floor, coarse-pointer targets, overflow and reduced
  motion retain the existing checks. Graphics have accessible text equivalents.
- The stronger startup CSP check exposed two pre-existing issues: Chromium ignores
  the invalid `http://[::1]:*` source, and Zod's caught Eval probe still emits a
  security-policy violation. The ignored source is removed and a first-import
  validation prelude sets Zod's supported `jitless` mode. Production validation
  already fell back to the same interpreter under CSP. No policy is relaxed and
  Stockfish code is unchanged.
- Font assets and piece artwork are same-origin. The production hosting test
  loads both font faces under the real CSP and checks console errors and CSP
  violations before deliberately testing a blocked external script.
- No service worker, external runtime font request, new backend, feature, route,
  authored chess content or broad architecture change was added. No PR was opened
  or merged; the requested feature branch alone is published.
- CodeRabbit CLI is not installed. This implementation subagent reviews Standards
  and Spec locally; the council review remains the parent workflow, with no
  recursive delegation.

## Changed files

62 files:

- `docs/design-direction.md`
- `docs/design-tokens.md`
- `docs/premium-pass.md`
- `e2e/backup.spec.ts`
- `e2e/black-openings.spec.ts`
- `e2e/board.spec.ts`
- `e2e/cohort-coverage.spec.ts`
- `e2e/copy-budget.spec.ts`
- `e2e/dashboard.spec.ts`
- `e2e/design.spec.ts`
- `e2e/explorer.spec.ts`
- `e2e/games.spec.ts`
- `e2e/hosting.spec.ts`
- `e2e/openings.spec.ts`
- `e2e/practice-stage.spec.ts`
- `e2e/puzzles.spec.ts`
- `e2e/review.spec.ts`
- `e2e/rules-quiz.spec.ts`
- `e2e/rules.spec.ts`
- `e2e/sync.spec.ts`
- `e2e/threats.spec.ts`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/assets/icon-180.png`
- `public/assets/icon-192.png`
- `public/assets/icon-512.png`
- `public/assets/icon.svg`
- `public/fonts/hanken-grotesk-license.txt`
- `public/fonts/jetbrains-mono-license.txt`
- `scripts/check-copy.mjs`
- `scripts/generate-icons.mjs`
- `src/App.tsx`
- `src/DataGraphic.tsx`
- `src/InfoTip.tsx`
- `src/MiniBoard.test.ts`
- `src/MiniBoard.tsx`
- `src/SettingsPanel.tsx`
- `src/board/board.css`
- `src/import/Games.tsx`
- `src/import/games.css`
- `src/main.tsx`
- `src/plan/Dashboard.tsx`
- `src/plan/dashboard.css`
- `src/plan/dashboardData.ts`
- `src/plan/planner.ts`
- `src/puzzles/Puzzles.tsx`
- `src/puzzles/puzzles.css`
- `src/review/MistakePractice.tsx`
- `src/review/ReviewPage.tsx`
- `src/review/review.css`
- `src/rules/GoldenRules.tsx`
- `src/rules/RuleQuiz.tsx`
- `src/rules/quiz.css`
- `src/styles.css`
- `src/sync/SyncPanel.tsx`
- `src/sync/sync.css`
- `src/threats/ThreatScan.tsx`
- `src/threats/threats.css`
- `src/trainer/Openings.tsx`
- `src/validation.ts`
- `vercel.json`

Logical implementation commits:
- `592fbf8` Define brass palette, local fonts and position graphics
- `fb1d9d4` Trim page copy and show real training positions
- `88dca7d` Keep startup validation within the hosting CSP
- Final documentation commit records the checks and visual review.
