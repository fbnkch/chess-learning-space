# Chess Learning Space

A personal, browser-only chess learning web app for one player (~1000 Elo on Chess.com, username `fbnkch`). Weak spots are the opening and missing threats two or more moves ahead.

## Product rules

- UI and learning content are in English. Agent-to-user chat is in German.
- Look and feel follow Chess.com in a dark-blue theme. Piece movement and interactions (drag and click-click moves, highlights, right-click arrows and circles, animations) behave like Chess.com. Lichess is the fallback reference.
- Offline-first: progress lives in IndexedDB or localStorage, with a JSON export and import. The only optional backend is `api/sync.ts` on Vercel, storing end-to-end encrypted progress in a private Blob store. All learning works without sync; secrets stay local and settings never merge across devices. See ADR-0005 and `docs/hosting.md`.
- Engine: Stockfish WASM (lite, single-threaded) runs in a Web Worker. The coach acts only in the post-game **Game Review** and through an on-demand **Hint**. It never gives live feedback after each move.
- Move explanations are rule-based by default and reference the golden rules. An optional LLM (the user's own key or a local Ollama) only rephrases engine facts and never invents moves.
- Repertoire: White plays the Italian (Giuoco Pianissimo) and the London. Black plays the Caro-Kann against 1.e4 and the QGD/...d5 setup against 1.d4. Each opening covers the replies most common up to 1500.
- Research backing these decisions lives in `docs/research/`.

## Workflow

- One branch per feature or ticket. Never commit directly to `main`.
- Commits and pushes on feature branches are allowed. PRs are squash-merged into `main` once the council review and all checks are green (standing approval from the user).
- No AI attribution in commits, PRs or merge messages.
- Reviews go through the council (DeepSeek, Gemini, GPT Sol, Opus).
- Before declaring work done, run `npm run check:repertoire` (includes `check:copy`), typecheck, tests, lint, build, and a browser check of the UI.
- Learning copy uses short American English and the product term Practice. Run `npm run check:copy` for rule reason/exception and PGN comment limits, summary sentence counts, banned wording and en/em dashes. Keep PGN moves, annotation directives and non-summary headers unchanged; preserve the LLM prompt contract and validation.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues of `fbnkch/chess-learning-space`, accessed through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
