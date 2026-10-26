# Stockfish als Live-Coach: Engine, Zugklassifikation und Erklärungen

**Kontext:** rein browserbasierte Lern-App (React/TS, kein Backend, privat), ~1000 Elo, chess.js + react-chessboard.
**Ziel:** Bewertung nach jedem eigenen Zug (Brilliant … Blunder) plus Begründung *warum* — und Nachanalyse importierter Chess.com-Partien. **Stand:** 2026-10; Preise/Versionen sind Momentaufnahmen.

## 0. Leitentscheidung

| Baustein | Empfehlung | Aufwand |
|---|---|---|
| Engine im Browser | `stockfish-19-lite-single` als Web Worker, MultiPV 2–3 | **einfach** |
| Live-Bewertung pro Zug | `go movetime 300` bzw. `depth 12–13` | **einfach** |
| Zugklassifikation | Eigenes Expected-Points-Modell (Win%-Delta, Chess.com-Schwellen) | **mittel** |
| Accuracy-Zahl | Lichess-Formel 1:1 (Win%, Per-Move-Accuracy, Harmonic+Weighted Mean) | **mittel** |
| Brilliant/Great/Miss | Heuristiken (Opfer, einziger Zug, verpasste Chance) | **mittel–schwer** (Tuning) |
| Erklärung ohne LLM | Regelkatalog + chess.js-Motive + deutsche Textbausteine | **mittel** |
| Erklärung mit LLM | Engine-Fakten → LLM formuliert nur; optional, per User-Key | **einfach** (API) / **mittel** (Ollama) |
| Ganze Partie nachanalysieren | 80 Stellungen × 1–3 s, Fortschritt, IndexedDB-Cache | **mittel** |
| Multi-Threaded NNUE (94 MB) | **nicht nötig** — COOP/COEP-Friktion ohne Mehrwert | **schwer** (unnötig) |

Kernaussage: **Die Engine ist der leichteste Teil.** Der Aufwand liegt in Klassifikationslogik, Sonderfällen und guten deutschen Erklärtexten.

## 1. Stockfish im Browser

### 1.1 Pakete (nmrugg/stockfish.js, aktuell v19.0.1)

| Variante | Größe (js+wasm) | Threads | COOP/COEP | Bewertung |
|---|---|---|---|---|
| `stockfish-19-lite-single.js` | ≈1,7 MB | nein | nein | **Standardwahl**: stark genug, einfaches Hosting |
| `stockfish-19-lite.js` | ≈1,6 MB | ja | **ja** | schneller, aber Header-Zwang |
| `stockfish-19-single.js` / `stockfish-19.js` | ≈94 MB | nein / ja | nein / **ja** | zu groß bzw. unnötig |
| `stockfish-19-asm.js` | ≈3 MB | nein | nein | nur Notfall (langsam) |

- Multi-Threading braucht `Cross-Origin-Opener-Policy: same-origin` **und** `Cross-Origin-Embedder-Policy: require-corp` (sonst kein `SharedArrayBuffer`); bei Single-Thread hat `setoption name Threads` **keine Wirkung**.
- Lite nutzt ein kleineres NNUE-Netz („quite a bit weaker"), ist aber weit über jedem Menschen — für 1000-Elo-Feedback irrelevant. Der Autor empfiehlt selbst **lite single-threaded** als Default. `.js` und `.wasm` müssen **nebeneinander** liegen, MIME `application/wasm`.

### 1.2 Einbindung mit Vite

```ts
// Dateien nach public/stockfish/ (dev + build identisch); kein ?worker-Import,
// weil der Worker seine .wasm relativ zu sich selbst lädt.
const worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
worker.onmessage = (e) => parseUci(String(e.data));
worker.postMessage('uci');
worker.postMessage('setoption name MultiPV value 3');
worker.postMessage('position fen ' + fen);
worker.postMessage('go depth 18');
```

- Alternative: `vite-plugin-static-copy` (`dest: 'stockfish'`).
- Für Multi-Threaded später: `server.headers` / `preview.headers` in `vite.config.ts` — dann brauchen aber auch Fonts/CDN-Bilder `crossorigin`/CORP.
- Fertiger TS-Wrapper: `jalpp/stockfishts` (MIT); eigener Wrapper ist ~100 Zeilen.

### 1.3 UCI-Nutzung

| Ziel | Kommando | Anmerkung |
|---|---|---|
| Bewertung + beste Linie | `go depth 18` | deterministisch, reproduzierbar |
| Alternative Züge | `setoption name MultiPV value 3` | 3 `info ... multipv k`-Blöcke, je mit `pv` |
| Live-Latenz begrenzen | `go movetime 300` | harte Obergrenze, Tiefe variiert |
| Hash | `setoption name Hash value 32` | 32–64 MB reichen |
| Matt | `score mate N` | getrennt von `score cp` parsen |

Wichtig: `score cp` ist **immer aus Sicht der am Zug befindlichen Seite** (`pov = turn === 'w' ? cp : -cp`); `mate N` auf ±10000 cp mappen (oder Win% = 100/0), sonst falsche Deltas. Ein Worker, eine Warteschlange, kein paralleles `go`.

**Gemessene Werte** (dieser Rechner, Node 24, identisches WASM, 1 Thread, Hash 32 MB, ohne Browser-Overhead):

| Test | Zeit | Tiefe | nps |
|---|---|---|---|
| Startstellung, depth 18 | 465 ms | 18 | 811 k |
| Startstellung, depth 22 | 1.945 ms | 22 | 788 k |
| Mittelspiel, depth 18, MultiPV 1 | 427 ms | 18 | 777 k |
| Mittelspiel, depth 18, **MultiPV 3** | 941 ms | 18 | 859 k |
| Taktisch scharf, depth 18, MultiPV 3 | 2.872 ms | 18 | 729 k |
| Mittelspiel, depth 20, MultiPV 3 | 1.787 ms | 20 | 872 k |

Im Browser-Worker ist mit **etwa 1/2 bis 1/3** davon zu rechnen (unabhängige Messung: Browser ≈2,5× langsamer als Node). Konsequenzen:

- **Live:** `movetime 300–400`, MultiPV 2 → ~0,3–0,5 s, Tiefe 11–14. Reicht für „gut/schlecht".
- **Vollanalyse:** 81 Stellungen × 1–3 s ≈ **1,5–4 min pro Partie** (MultiPV 3, depth 16–18). Taktisch scharfe Stellungen kosten 3× mehr → `movetime` ist berechenbarer als fixe Tiefe.

### 1.4 Lizenz

- Stockfish ist **GPL-3.0**, der JS-Kleber von nmrugg MIT, das npm-Paket insgesamt GPL-3.0 — **hier praktisch irrelevant:** nicht veröffentlicht = keine Distribution = keine GPL-Pflichten.
- Falls je veröffentlicht: Engine als separate, unveränderte Worker-Datei ausliefern und als GPL-3-Komponente mit Quellenlink deklarieren („aggregation") — oder kommerzielle Lizenz.
- Unkritisch: chess.js (BSD-2), react-chessboard (MIT), Lichess-Opening-Daten (CC0).

## 2. Zugklassifikation: wie es die Großen machen

### 2.1 Lichess (vollständig offen, exakte Formeln)

```
Win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)      // cp geklemmt auf ±1000
MoveAccuracy = 103.1668100711649 * exp(-0.04354415386753951 * (Win%_before - Win%_after))
               - 3.166924740191411 + 1                       // +1 uncertainty bonus, clamp [0,100]
GameAccuracy = (volatility-weighted mean + harmonic mean) / 2
             // Gewicht = Stddev der Win% im Fenster; Fenstergröße (plies-1)/10, geklemmt 2..8
             // Gewicht selbst geklemmt 0.5..12
```

- Urteile (`Advice.scala`): Win%-Verlust **≥ 10 → Inaccuracy, ≥ 20 → Mistake, ≥ 30 → Blunder** (Prozentpunkte, nicht cp).
- Darum ist „+2,4 → +0,6" nicht automatisch ein Blunder: erst der Win%-Abfall entscheidet. Bereits umgesetzt: `NoRaincheck/chess-accuracy` (Python), `StephenB1988/chess-tools` (MIT, inkl. Chess.com-Import).

### 2.2 Chess.com (Expected Points, „Classification V2")

Öffentlich dokumentiert sind nur die Schwellen, **nicht** die ratingabhängige Win%-Kurve:

| Klasse | Verlust an Expected Points |
|---|---|
| Best / Excellent | 0,00 – 0,02 |
| Good | 0,02 – 0,05 |
| Inaccuracy | 0,05 – 0,10 |
| Mistake | 0,10 – 0,20 |
| Blunder | 0,20 – 1,00 |

- Expected Points = Gewinnchance **abhängig von der Ratingstufe des Spielers** und der Engine-Bewertung (0,00…1,00). Derselbe Zug wird bei 700 anders klassifiziert als bei 2700 — dieser Teil ist **nicht reproduzierbar**, nur approximierbar.
- **Brilliant** = guter Figurenopfer-Zug; danach nicht schlechter, vorher nicht schon komplett gewonnen; großzügiger bei niedrigem Rating. **Great** = spielentscheidend (verloren→gleich, gleich→gewonnen, oder der einzige gute Zug). **Miss** = gegnerischen Fehler nicht ausgenutzt. **Book** = Theorie, zählt nicht in die Accuracy.

### 2.3 Empfohlene Klassifikation für die App (Näherung, klar als solche labeln)

```
1. Buchzug? -> "Book", nicht werten.
2. deltaEP = ep(bestMove) - ep(playedMove),  ep = Win%/100
3. Schwelle: <=0.00 Best | <=0.02 Excellent | <=0.05 Good
             <=0.10 Inaccuracy | <=0.20 Mistake | >0.20 Blunder
4. Sonderfälle vorher prüfen:
   Brilliant:  deltaEP<=0.02 UND Materialopfer >= 2 Punkte in der PV
               UND ep(danach) >= 0.50 UND ep(vorher) <= 0.90
   Great:      deltaEP<=0.02 UND zweitbeste Alternative deltaEP >= 0.10
               (oder Übergang verloren<0.35 -> >=0.50)
   Miss:       Gegnerzug war Mistake/Blunder (deltaEP >= 0.10)
               UND ep(best) >= 0.70 UND ep(played) <= 0.50
   MissedMate: PV des besten Zugs endet in Matt, gespielter Zug nicht.
```

Zwei Fallen, die fast jeden Klon erwischen:
- **Schon gewonnen/verloren:** ohne Win%-Kurve wird +9,0 → +8,5 als „Blunder" markiert. Immer Win% als Delta, nie cp.
- **Tiefenrauschen:** „vorher" und „nachher" mit identischem Budget/Tiefe bewerten, sonst entstehen Scheinfehler.

### 2.4 Open-Source-Nachbauten (Referenz, nicht kopieren)

| Projekt | Was drin ist | Lizenz |
|---|---|---|
| `wrnbenji/chess-analyzer` | **Nächster Volltreffer:** React+Vite, Stockfish-WASM depth 18 MultiPV 3, Chess.com-API, Motiverkennung, Phasen-Accuracy, Trainingsmodus | MIT |
| `nvidiarogforce-art/Chess.com-game-analyzer` | TS/React, Expected-Points (2/5/10/20 %), `classify.ts`, Brilliant ≥3 Punkte, IndexedDB-Cache, 148 Tests | GPL-3.0 |
| `H0NEYP0T-466/ChessReviewEngine` | Python/FastAPI + React, cp-Schwellen (10/20/40/100/200), WebSocket-Fortschritt | MIT |
| `jalpp/stockfishts` | TS-Wrapper für Stockfish.js | MIT |

Import: **Chess.com PubAPI** ist read-only, ohne Auth und laut Doku aus Browsern nutzbar (`api.chess.com/pub/player/{user}/games/{yyyy}/{mm}`), PGN im Feld `pgn`.

## 3. Erklärungen ohne LLM (regelbasiert)

Kern des Produkts: Die Engine liefert *Fakten* (PV, Bewertungen), chess.js liefert *Geometrie*. Daraus lassen sich ~90 % der 1000-Elo-Fehler präzise benennen.

### 3.1 Detektoren (alle aus PV + Brettbild berechenbar)

| Detektor | Signal | Aufwand |
|---|---|---|
| Hängende Figur | Nach meinem Zug: `attackers(sq, Gegner).length > defenders`, Figur > billigster Angreifer; `attackers()==0` = ungedeckt | trivial |
| Materialverlust in der PV | Materialbilanz am Ende der Gegner-PV (6–8 ply) vs. jetzt | trivial |
| Verpasste Gabel | Beste PV beginnt mit Zug, nach dem die Figur ≥2 Figuren mit höherem Wert angreift | leicht |
| Verpasste Fesselung/Spieß | PV-Zug erzeugt Linie König/Dame ↔ Figur ↔ Ziel | leicht |
| Mattdrohung übersehen | Stellung nach meinem Zug: Engine sieht `mate` für Gegner ≤ 3 | leicht (1 Eval) |
| „Gegner droht X" | Stellung nach meinem Zug, Gegner-PV[0] → was würde er tun? | leicht (1 Eval) |
| Mattzug verpasst | `bestmove`-PV endet in `mate 0/1`, mein Zug nicht | trivial |
| Grundreihe / Abzug / Doppelschach | letzte Reihe ohne Luftloch + Turm/Dame auf der Linie; `move.flags` + `isCheck()` | leicht |
| Einziger Zug | MultiPV: Alternative 2 hat deltaEP ≥ 0.10 | trivial (schon berechnet) |

**Vorhandene Implementierungen:** `wrnbenji/chess-analyzer` (MIT) macht genau das — Motive „with pure chess logic (no extra engine calls)" auf gespieltem *und* bestem Zug. `mcarbonell/chess-movegen-js` (MIT) markiert in der Move-Generierung `hanging`, `winningCapture`, Pins. `chess-detect` (Python) ist die vollständigste Motiv-Taxonomie als Vorbild. **Für TypeScript gibt es keine fertige Bibliothek** — der Katalog ist selbst zu schreiben (~300–500 Zeilen); chess.js `attackers`, `isAttacked`, `board` reichen als Bausteine.

### 3.2 Textbausteine (deterministisch, deutsch, immer wahr)

Prioritätskette — erster Treffer, max. 2 Sätze:

```
1. Matt verpasst      "Du hattest Matt in 2 mit Sxh7+ — der Zug war da."
2. Matt zugelassen    "Nach deinem Zug droht ...Dxf2#. Sg5 deckt f2."
3. Hängende Figur     "Dein Läufer auf c4 steht ungedeckt und wird von ...Sxe4 gewonnen."
4. Materialverlust    "Die beste Antwort ...Sxe4 gewinnt einen Bauern; nach 3 Zügen stehst du -2."
5. Verpasste Taktik   "Stattdessen gewann Sd5! eine Figur: die Gabel trifft c7 und e7."
6. Verpasste Chance   "Der Gegner hat gerade gepatzt (...Qxb2?). Sd5! gewann die Dame."
7. Stellungsurteil    "Der Zug gibt die einzige offene Linie auf; Sd5! hielt den Ausgleich."
```

Alle Platzhalter (Figur, Feld, SAN, Materialwert, Win%-Delta) kommen aus **berechneten** Fakten; dazu immer der beste Zug mit `pv`-Kurznotation und ein „Warum"-Halbsatz (deckt/schützt/greift an/gewinnt Zeit).

### 3.3 Grenzen

- Rein positionelle Fehler („falsches Feld für den Springer") bleiben bei „Engine bevorzugt Sd5 (Plan: Druck auf e5)". Motive über 3+ Züge (Prophylaxe, Zugzwang) werden nicht erkannt — genau hier ist der LLM-Baustein sinnvoll, **als Formulierungsschicht, nicht als Ersatz**.

## 4. Erklärungen mit LLM

### 4.1 Architektur: „Fakten rein, Sprache raus"

```
{ fen_before, played_san, eval_before_cp, eval_after_cp, winpct_before, winpct_after, classification,
  best_san, best_pv[3-5], alternates[{san,pv,deltaEP}], motifs_played[], motifs_best[], material_delta, threats[] }
        ↓  (nur diese JSON-Fakten, kein ganzes PGN, keine Bilder)
"Formuliere 2 Sätze auf Deutsch für einen 1000-Elo-Spieler. Nutze ausschließlich
 diese Fakten. Erfinde keine Züge, Felder oder Zahlen. Nenne den besseren Zug
 und warum er besser ist."
```

~350–600 Input- und ~100–150 Output-Tokens pro Zug; Systemprompt (Stilregeln, Glossar) einmal + Prompt-Caching.

**Halluzinations-Schutz (Pflicht):**
1. Output als JSON (`{headline, reason, better_move}`), nicht als Freitext.
2. Jede erwähnte SAN-Figur gegen chess.js validieren: Ist der Zug in `fen_before` legal? Kommt das Feld im Zug vor?
3. Zahlen nur aus den übergebenen Fakten (Whitelist-Regex).
4. Bei Verstoß **still auf Textbaustein zurückfallen** (3.2) — der Nutzer sieht nie Unsinn.
5. `temperature` 0–0.3, kurze Antworten erzwingen.

### 4.2 Optionen

| Option | CORS / Setup | Latenz | Bewertung |
|---|---|---|---|
| **Anthropic direkt aus dem Browser** | Header `anthropic-dangerous-direct-browser-access: true` (SDK: `dangerouslyAllowBrowser: true`), offiziell unterstützt | 0,6–1,5 s | **beste Option** für „eigener Key" |
| OpenAI direkt | Chat Completions liefert `Access-Control-Allow-Origin: null` (funktioniert, nicht zugesichert); Responses-API gar nicht | 0,6–1,5 s | fragil, nicht empfehlen |
| **Ollama lokal** | `localhost:11434`, default `127.0.0.1`/`0.0.0.0`; andere Origin nur mit `OLLAMA_ORIGINS` (Windows: Systemvariable + Neustart) | 2–10 s (CPU) | gut für offline, Hürde im Setup |
| **WebLLM** (WebGPU) | 0,35–0,7 GB Modell-Download beim ersten Start, IndexedDB-Cache, nur Chrome/Edge | 1–4 s | Nische; kleine Modelle erklären Schach **schwach** |
| Regelbasiert (Abschnitt 3) | nichts | 0 ms | **Default**, immer verfügbar |

Key im Browser ist bei einer **privaten, lokal gehosteten** App unkritisch (Key gehört dem Nutzer, `localStorage`), bei Veröffentlichung ein No-Go → Feature standardmäßig aus, hinter „Key eintragen".

### 4.3 Kosten pro Partie (grobe Rechnung)

Annahme: 15 erklärte Züge (nur Inaccuracy/Mistake/Blunder/Miss/Brilliant), je 500 In / 130 Out, Systemprompt ~800 Tokens gecacht.

| Modell | Preis (In/Out pro MTok) | Kosten/Partie |
|---|---|---|
| Claude Haiku 5.5 | $0,10 / $0,50 | **≈ $0,002** (< 0,2 Cent) |
| Claude Haiku 4.5 · Sonnet 5.5 · GPT-6 Luna | $1/$5 · $2/$10 · $0,50/$1 | $0,017 · $0,033 · $0,006 |
| Ollama / WebLLM | 0 | 0 (nur Strom + Download) |

Live-Modus mit Erklärung nach *jedem* Zug (~40 Züge): **< 1 Cent/Partie** mit Haiku 5.5. Selbst 500 Partien kosten < 1 EUR — Geld ist nicht der Engpass, Latenz und Qualität sind es.

## 5. Empfohlene Reihenfolge

1. **Engine-Skelett** (einfach, ~0,5 Tag): lite-single in `public/`, Worker-Wrapper mit Promise-Queue, `analyse(fen, {depth|movetime, multipv}) → {cp, mate, pv[], lines[]}`. Erst in Node testen, dann im Browser.
2. **Vollanalyse-Pipeline** (mittel, ~2 Tage): PGN → FEN-Liste → 1 Eval pro Stellung → IndexedDB-Cache (Key = FEN+depth+multipv) → Fortschritt.
3. **Klassifikation + Accuracy** (mittel, ~2 Tage): Win%, deltaEP-Tabelle, Book über CC0-Opening-Daten, Lichess-Accuracy. Mit 5 echten Partien gegen Chess.com/Lichess kalibrieren — Ziel ist die gleiche *Reihenfolge* der Fehler, nicht 1 % Genauigkeit.
4. **Regel-Erklärungen** (mittel, ~3 Tage): Detektor-Katalog + Prioritätskette + deutsche Bausteine. Das macht die App besser als ein reiner Eval-Graph.
5. **Live-Modus** (einfach, ~1 Tag): nach jedem eigenen Zug `movetime 300`, MultiPV 2 → Klassifikation + Baustein, ohne die UI zu blockieren.
6. **Brilliant/Great/Miss tunen** (schwer, laufend): eigene + Referenzpartien; Sonderfälle (schon gewonnen, Matt statt Material) zuerst.
7. **LLM-Formulierung** (einfach, ~1 Tag): optional, BYO-Key, JSON + Validierung + Fallback. Erst nach 4., nie statt 4.

**Nicht bauen:** Multi-Threaded-NNUE, eigenes WebLLM-Modell, Chess.com-Farbschema-Kopie, „Estimated Rating" aus Accuracy (Marketing, empirisch wackelig).

## Quellen

- **stockfish.js** (Varianten, Größen, COOP/COEP, UCI, Lizenz): https://github.com/nmrugg/stockfish.js · https://www.npmjs.com/package/stockfish · https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1 — Engine selbst GPL-3.0: https://github.com/official-stockfish/Stockfish
- **Lichess:** Formeln https://lichess.org/page/accuracy · Win% https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/eval.scala · Accuracy-Code https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala · Schwellen https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala
- **Chess.com:** Klassifikation https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc · Game Review https://support.chess.com/en/articles/8584089-how-does-game-review-work · PubAPI https://www.chess.com/announcements/view/published-data-api
- **Referenzprojekte:** Browser+Analyse (MIT) https://github.com/wrnbenji/chess-analyzer · Expected Points TS (GPL-3.0) https://github.com/nvidiarogforce-art/Chess.com-game-analyzer · cp-Schwellen (MIT) https://github.com/H0NEYP0T-466/ChessReviewEngine · Lichess-Accuracy Python (MIT) https://github.com/StephenB1988/chess-tools · https://github.com/NoRaincheck/chess-accuracy · TS-Wrapper (MIT) https://github.com/jalpp/stockfishts
- **Motive:** chess-detect (Vorbild) https://pypi.org/project/chess-detect/ · Hanging/Pin-Flags (MIT) https://github.com/mcarbonell/chess-movegen-js · chess.js API https://jhlywa.github.io/chess.js/ · ECO (CC0) https://github.com/lichess-org/chess-openings
- **Hosting:** Vite Assets https://vite.dev/guide/assets · static-copy https://github.com/sapphi-red/vite-plugin-static-copy · COOP/COEP https://web.dev/articles/cross-origin-isolation-guide
- **LLM:** Anthropic Browser-CORS https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/ · https://github.com/anthropics/anthropic-sdk-typescript/issues/248 · Preise https://platform.claude.com/docs/en/about-claude/pricing · OpenAI-CORS https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791 · Ollama https://docs.ollama.com/faq · WebLLM https://github.com/mlc-ai/web-llm · https://webllm.mlc.ai/
- Browser-vs-Node-Benchmark: https://github.com/sonnysangha/Castle-3d-multiplayer-with-ai-vercel-eve-nextjs-clerk/blob/main/docs/research/stockfish.md
