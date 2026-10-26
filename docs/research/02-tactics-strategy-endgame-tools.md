# Taktik, Strategie, Endspiel und Tooling für einen persönlichen Schach-Lernraum

**Zielgruppe:** ~1000 Elo (Chess.com), Regeln sicher, Schwächen: versteckte Drohungen ab 2 Zügen, Eröffnung. **Ziel:** Lerninhalte priorisieren und technische Bausteine auswählen. **Stand:** 2026-10 (Zahlen sind Momentaufnahmen).

## 0. Leitentscheidung

Bei 1000 Elo ist der größte Hebel **nicht** mehr Eröffnungswissen, sondern:

1. **Blunder-Rate senken** (jeder 2. verlorene Punkt kommt aus einem Ein-Züger).
2. **Drohungen des Gegners sehen** — das ist ein *Scan-Ritual*, keine Intelligenzfrage.
3. **Einfache Endspiele gewinnen** (Bauer + Turm), statt sie zu fürchten.

Die App sollte deshalb **Rituale erzwingen** (Checkliste vor jedem Zug) statt nur Content auszuspielen. Das ist der eigentliche Produktvorteil gegenüber Lichess/Chess.com.

## 1. Taktische Motive und Drohungs-Erkennung

### 1.1 Motiv-Taxonomie (mit Lichess-Puzzlezahlen als Häufigkeitsproxy)

Zahlen = Anzahl öffentlicher Puzzles mit diesem Tag (Lichess, 2026-10). Sie zeigen, was trainiert werden muss.

| Motiv | Definition (kurz) | Erkennungssignal im Brettbild | Lichess-Theme | Puzzles |
|---|---|---|---|---|
| Gabel / Fork | Eine Figur greift ≥2 Ziele an | Springer auf Königs-/Damenlinie, ungedeckte Figuren auf gleicher „Rösselsprung-Distanz" | `fork` | 848.001 |
| Fesselung / Pin | Figur kann nicht ziehen, ohne Wertigeres zu entblößen | König/Dame hinter Figur auf Linie/Diagonale | `pin` | 390.846 |
| Spieß / Skewer | Umkehrung: Wertiges vorne, Billiges hinten | König vor Dame auf einer Linie | `skewer` | 144.926 |
| Abzug / Discovered Attack | Figur zieht weg, dahinter wird angegriffen | Turm/Läufer „lauscht" durch eine eigene Figur | `discoveredAttack` | 333.203 |
| Doppelschach | Abzug + Schach gleichzeitig | Nur König ziehen hilft | `doubleCheck` | 33.719 |
| Überlastung / Overloading | Figur hat zwei Aufgaben, eine fällt | Ein Verteidiger deckt zwei Dinge | `deflection` (Lichess fasst beides) | 278.688 |
| Ablenkung / Deflection | Verteidiger wird weggezogen | „Wenn der Sb6 weg wäre …" | `deflection` | 278.688 |
| Zwischenzug / Intermezzo | Nicht den erwarteten Schlagzug, sondern erst Schach/Drohung | Nach Schlagabtausch: gibt es ein Schach? | `intermezzo` | 79.863 |
| Hängende Figur | Ungedeckt oder unzureichend gedeckt | Zähl-Regel: Angreifer < Verteidiger | `hangingPiece` | 255.571 |
| Grundreihenmatt | Matt auf der 1./8. Reihe | Eigener König ohne Luftloch | `backRankMate` | 212.566 |
| Ruhiger Zug | Drohung ohne Schach/Schlag aufbauen | „Was ist der stille Killerzug?" | `quietMove` | 264.652 |
| Verteidigungszug | Einziger Zug, der hält | Nach Gegnerzug: was droht konkret? | `defensiveMove` | 385.717 |
| Figurenfang | Figur hat keine Felder mehr | Eingeschlossene Dame/Springer am Rand | `trappedPiece` | 74.500 |
| Räumung, Anziehung, Linienöffnung | Vorbereitende Opfer | „Erst das Feld räumen" | `clearance`, `attraction` | 83.558 / 230.590 |

**Produktkonsequenz:** Themes sind bei Lichess **frei und offline verfügbar** (siehe §4). Die App kann daraus einen kuratierten Motiv-Lehrpfad bauen, ohne eigene Puzzle-Redaktion.

### 1.2 Der Denkprozess: was „Drohungen 2+ Züge voraus" wirklich bedeutet

Kernbefund aus der Heisman-Literatur (NM Dan Heisman, „Novice Nook", `danheisman.com`):

- **„Real Chess" vs. „Hope Chess":** Man prüft *vor* dem eigenen Zug, ob man alle gegnerischen Drohungen beantworten kann. Wer zieht und dann hofft, spielt „Hope Chess" — und wird nie deutlich besser. Zitat: *„In Real Chess you make sure you can meet all of your opponent's threats before he makes them; otherwise, it is Hope Chess."*
- **„Sanity Check":** Nach der Entscheidung, vor dem Ausführen, noch einmal frisch auf das Brett schauen — genau der Blunder-Check. Heisman empfiehlt explizit: erst aufschreiben, dann neu gucken.
- **Quiescence-Fehler:** Der häufigste 1000er-Fehler ist nicht falsche Berechnung, sondern **zu frühes Aufhören** der Variante (mitten im Schlagabtausch). Deshalb: Varianten immer bis zur „ruhigen Stellung" rechnen.
- **„You can't play what you don't see":** Board Vision ist trainierbar und Voraussetzung für alles andere.
- **Kandidatenzüge:** Nicht den ersten guten Zug spielen, sondern 2–3 Kandidaten bilden und vergleichen; Zeit gezielt auf taktische/kritische Züge legen.

**CCT-Scan** (Checks, Captures, Threats) ist die verbreitete Kurzform desselben Rituals (populär durch de la Maza, *Rapid Chess Improvement*, 2002; Heisman nennt es „Safety"/„Sanity Check"):

```
Für JEDEN Zug (eigener und gegnerischer):
1. Checks   – welche Schachs gibt es (für mich / gegen mich)?
2. Captures – welche Schlagzüge gibt es, und ist der Schlag sicher (Zähl-Regel)?
3. Threats  – welche direkten Drohungen entstehen (Matt in 1, Figurengewinn)?
4. Gegner   – was ist sein BESTER Zug? Welche Drohung entsteht dadurch?
5. Blunder-Check – erst jetzt den eigenen Zug final prüfen.
```

Schritt 4 ist der eigentliche Hebel für das Spielniveau 1000 → 1400: nicht „was will ich?", sondern **„was will er, wenn er gut spielt?"**

### 1.3 Visualisierung trainieren

- **Varianten blind nachspielen:** 2–3 Züge im Kopf, dann Brett aufdecken und vergleichen. Kurz, täglich, frustrierend effektiv.
- **Board-Vision-Drills:** Feldnamen, Springer-Distanz, diagonale Linien ohne Figuren.
- **„Was hängt alles?"-Drill:** Aus einer Stellung in 10 Sekunden alle ungedeckten Figuren beider Seiten nennen.
- **Ruhige Züge sehen:** Lichess-Theme `quietMove` gezielt trainieren — das ist die Brücke von „Taktik" zu „Drohungen 2 Züge voraus".

### 1.4 Woodpecker Method (Wiederholung)

Aus `chessable.com/blog/the-woodpecker-method` (beschreibt das Buch von GM Axel Smith & GM Hans Tikkanen):

- **Ein fester Satz** von Übungen (z. B. 300–1000), **nicht** ständig neue Puzzles.
- **Zyklus 1:** Satz in ~4 Wochen lösen (Rechenzeit erlaubt).
- **Zyklen 2–7:** denselben Satz erneut lösen, **jede Runde halbiert die Zeit**, bis der ganze Satz an einem Tag durchläuft.
- Begründung: aktives Abrufen aus dem Gedächtnis (Retrieval Practice) + Spaced Repetition + Deliberate Practice. Tikkanen holte damit 3 GM-Normen in 7 Wochen.

**Für die App:** Das ist direkt implementierbar als **SRS-Modus über einen fixen Set** (nicht nur „neue Puzzles"), mit pro Zyklus sinkendem Zeitbudget. Braucht: Set-Verwaltung, Zyklus-Timer, Statistik „Züge/Sekunde" und Fehlerliste pro Zyklus.

### 1.5 Trainingsprotokoll (konkret, wöchentlich)

| Einheit | Dauer | Inhalt |
|---|---|---|
| CCT-Drill | 5 min | 10 Stellungen, nur beantworten: „Welche Drohungen hat der Gegner?" |
| Taktik-Set | 15 min | 20–30 Puzzles im Woodpecker-Zyklus, Rating 800–1400 |
| Motiv-Fokus | 10 min | 1 Theme pro Woche (`fork` → `pin` → `hangingPiece` → `backRankMate` …) |
| Langpartie + Endspiel | 10 min | 1×/Woche 15+10, danach eigene Blunders mit Engine; Endspiel siehe §3 |

## 2. Mittelspiel-Strategie für 1000–1500

### 2.1 Silmans Imbalances (Rangfolge nach Wichtigkeit)

Silman bewertet Stellungen nicht über Material/Entwicklung, sondern über **Differenzen** („imbalances"). Reihenfolge (via Wikipedia, nach Dana Mackenzie):

1. **Überlegene Minorfigur** (guter Springer vs. schlechter Läufer)
2. **Bauernstruktur** (schwache Felder, rückständige/vereinzelte Doppelbauern, Bauernmehrheit)
3. **Raumkontrolle**
4. **Material** (bei Silman der wichtigste Einzelfaktor, weil er alle Phasen beeinflusst)
5. **Offene Linien/Diagonalen/Felder**
6. **Entwicklung**
7. **Initiative** (dynamisch — verfällt, wenn nicht genutzt)

**Silmans 5-Schritt-Denkprozess** (aus *How to Reassess Your Chess*):
1. Taktische Drohungen beider Seiten prüfen.
2. Positive/negative Imbalances beider Seiten benennen.
3. Seite des Bretts wählen.
4. **Nicht rechnen** — erst eine „Fantasiestellung" träumen (was wäre ideal?).
5. Dann Kandidatenzüge berechnen, die dorthin führen.

Das ist für eine App fast 1:1 als **geführtes Formular** abbildbar: 5 Pflichtfelder vor dem Zug, die man ausfüllt, bevor der Zug erlaubt ist.

### 2.2 Prioritäten für 1000–1500 (das reicht für ~+200 Elo)

1. **Figurenaktivität vor Material:** Jede Figur braucht eine Aufgabe. „Verbessere deine schlechteste Figur" ist der einzige Plan, den man immer hat.
2. **Schwache Felder:** Felder, die kein Bauer mehr decken kann (Farbkomplex!). Ein Springer auf so einem Feld ist oft > Bauer.
3. **Bauernstruktur lesen:** vereinzelt (isolated) → Blockadefeld davor; rückständig → Angriffsziel auf halboffener Linie; Doppelbauer → offene Linie als Kompensation; Bauernmehrheit → Endspielplan.
4. **Offene Linie + Turm:** Türme gehören auf offene/halboffene Linien, notfalls über Vorbereitung.
5. **Raum = Zeit:** Mehr Raum heißt, der Gegner hat weniger gute Felder; nicht sofort abtauschen.
6. **Königssicherheit:** Luftloch, keine Bauernzüge vor dem eigenen König ohne Grund.
7. **Abwickeln, wenn vorne:** Tausch in ein gewonnenes Endspiel ist bei 1000–1500 der zuverlässigste Weg.

### 2.3 Pläne finden: drei Fragen als Entscheidungsbaum

```
1. Ist eine Taktik da? (CCT)           → wenn ja: rechnen, nicht planen.
2. Habe ich einen konkreten Angriff?   → Figuren zum König, Öffnen der Linien.
3. Sonst: Wo ist mein schlechtestes
   Stück und wo sein schlechtestes?    → verbessern / angreifen.
```

Ergänzend: **Prophylaxe** (was will er?) ist bei diesem Niveau stärker als eigene Pläne — konsistent mit der Diagnose „übersieht versteckte Drohungen".

### 2.4 Eröffnung (nur so viel wie nötig)

Bei 1000 reicht **kein** Theoriewissen, sondern **3 feste Systeme** (1 weiß, 2 schwarz) mit bekannten Ideen und den ersten 6–8 Zügen. Wichtiger als Varianten: die **Idee** jedes Zuges in einem Satz notieren — die App kann das als Pflichtfeld abfragen.

## 3. Endspiel-Grundlagen in Prioritätsreihenfolge

Struktur orientiert an de la Villa, *100 Endgames You Must Know* (New in Chess) und der Lichess-Practice-Reihenfolge — beide sortieren vom „muss jeder können" zum „nice to have".

### Stufe 1 — Matt setzen (kann man nicht oft genug)
1. König + Dame vs. König
2. König + Turm vs. König
3. **König + 2 Läufer** vs. König (Technik: Treppe)
4. König + Läufer + Springer vs. König (schwer — zuletzt, aber einmal verstanden haben)

### Stufe 2 — Bauerndiagramme (Fundament, ~80 % aller Endspiele hängen daran)
5. **Quadratregel**: Reicht der König, um den Freibauern zu stoppen? (Quadrat = Bauer bis Umwandlungsfeld; König im Quadrat = hält)
6. **Schlüsselfelder** vor dem Bauern (nicht auf die 5./6. Reihe ziehen, sondern davor)
7. **Opposition** („wer am Zug ist, verliert sie"): Grundlage für Fernopposition, Diagonale
8. **Gedeckter Freibauer** (mächtigster Bauerntyp)
9. **Freibauer außerhalb** (Ablenkungsopfer → König binden)
10. **Durchbruch** (Breakthrough: Bauernopfer für Umwandlung)
11. **Zugzwang** vermeiden/erzwingen; Remis-Falle „falscher Läufer" (Läufer deckt Eckfeld nicht)

### Stufe 3 — Turmendspiele (häufigster Endspieltyp!)
12. **Lucena-Stellung**: Turm auf die 4. Reihe, König raus, Brückenbau — *die* Gewinnmethode
13. **Philidor-Stellung**: Verteidigung mit Turm auf der 3. Reihe + König nah — *die* Remismethode
14. **7. Reihe / Turmbauer am Rand** („short side vs. long side"-Verteidigung)
15. **Vancura-Verteidigung** (Turm seitlich, Angriff auf Bauern → Remis)
16. Turm + Bauer vs. Turm: aktiv verteidigen, Turm hinter den Freibauern
17. Turm + 2 Bauern, Bauernmehrheiten: aktiver König, Bauernopfer zum Durchbruch

### Stufe 4 — Leichtfiguren & Damen
18. Läuferendspiele: **falscher Läufer**, Mehrbauer am Rand, Bauern auf der Farbe des Läufers
19. Springerendspiele: Springer vs. Randbauer, Blockade
20. Damenendspiele: Dauerschach kennen, Damen abtauschen wenn materiell vorne

### Trainingsform
- **Technik-Paare**: jede Stellung zweimal üben — einmal als Gewinnseite, einmal als Verteidigungsseite mit Remisziel. Das ist der Unterschied zwischen „kennen" und „können".
- **Lichess Practice** hat genau diese Progression als spielbare Drills (Opposition, Key Squares, Lucena/Philidor, 7th-Rank Rook Pawn).

## 4. Technische Bausteine für die eigene App

### 4.1 Bibliotheken

| Bibliothek | Zweck | Lizenz | URL |
|---|---|---|---|
| **chess.js** (`npm i chess.js`) | Zuggenerierung, Legalität, Schach/Matt/Remis, SAN/FEN/PGN — TypeScript | **BSD-2-Clause** (permissiv) | https://github.com/jhlywa/chess.js |
| **chessground** (`@lichess-org/chessground`) | Lichess' eigenes Brett, 10 kB gzip, 0 Dependencies, Pfeile/Kreise | **GPL-3.0** ⚠️ | https://github.com/lichess-org/chessground |
| **react-chessboard** | Fertiges React-Brett, schnellster Einstieg | **MIT** | https://github.com/Clariity/react-chessboard |
| **Stockfish WASM** (`stockfish`, Stockfish.js) | Engine im Browser, Bewertung/Best-Move | **GPL-3.0** ⚠️ | https://github.com/nmrugg/stockfish.js |
| **Stockfish** (Referenz) | Upstream-Engine | GPL-3.0 | https://github.com/official-stockfish/Stockfish |

**Lizenz-Fallen (wichtig für die Architektur-Entscheidung):**
- **chessground ist GPL-3.0.** Wer es einbindet und die App *verteilt* (öffentlich hostet), muss den Quellcode offenlegen. Für den rein privaten Gebrauch unkritisch; für „irgendwann veröffentlichen" ist **react-chessboard (MIT)** die sichere Wahl.
- **Stockfish ist GPL-3.0.** Einbinden im Browser ist ok, aber bei Distribution greifen die GPL-Pflichten. Alternative für „nur Bewertung": Server-seitig aufrufen oder Lichess-Cloud-Eval-API nutzen.
- **WASM-Gotcha:** Multithreaded Stockfish braucht Cross-Origin-Isolation (`COOP`/`COEP`-Header). Die **Single-Threaded-Variante** (~94 MB voll, ~1.6 MB „lite") läuft ohne diesen Header — für eine Lern-App meist die richtige Wahl.

### 4.2 Offene Daten

| Datensatz | Inhalt | Lizenz | URL |
|---|---|---|---|
| **Lichess Puzzle DB** | **6.157.341** Puzzles, CSV, Felder: `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate` | **CC0** (Public Domain) | https://database.lichess.org/#puzzles |
| **Puzzle-Themes / Generator** | Theme-Namen + Beschreibungen; wie Tags entstehen | Open Source | https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml · https://github.com/ornicar/lichess-puzzler |
| **chess-openings** | **3.865** benannte Eröffnungen (ECO a–e.tsv), Felder `eco,name,pgn,uci,epd` | **CC0** | https://github.com/lichess-org/chess-openings |
| **Lichess Opening Explorer API** | Zugstatistiken aus Meister- und Lichess-Partien pro Stellung; Endpunkte `/masters`, `/lichess`, `/player` | frei, kein Key | https://github.com/lichess-org/api (Spec: `doc/specs/lichess-api.yaml`) |
| **Lichess API gesamt** | Partien, Puzzles, Studien, Analysen | frei (Token für persönliche Daten) | https://lichess.org/api |

**Praxis-Hinweise zur Puzzle-DB:**
- Download ist `.csv.zst` (Zstandard) — einmalig dekomprimieren, dann filtern.
- `Moves` sind **UCI**, nicht SAN → mit chess.js in SAN umwandeln für die Anzeige.
- `FEN` ist die Stellung **vor** dem Gegnerzug: erst den ersten Zug anwenden, *dann* dem Nutzer zeigen (klassischer Implementierungsfehler).
- `Themes` ist space-separiert → beim Import in Array normalisieren. Empfehlung: auf **Rating 700–1500** + gewünschte Themes filtern und in SQLite/JSON ablegen; aus 6 Mio. werden ~200k–400k lokale Aufgaben, offline und ohne Rate-Limits.

### 4.3 Minimal-Architektur (Empfehlung)

```
Frontend:  React + Vite
Brett:     react-chessboard (MIT)  →  später evtl. chessground, wenn GPL ok
Regeln:    chess.js (BSD-2)
Engine:    Stockfish.js single-threaded, lazy geladen (nur beim "Analyse"-Button)
Daten:     SQLite/JSON, lokal aus Lichess-Puzzle-CSV + chess-openings destilliert
State:     Fortschritt pro Theme, SRS-Queue, Woodpecker-Zyklen, Fehler-Log
```

Bewusst **kein** Backend in v1: alles lokal, keine Accounts, keine Sync-Probleme. Die drei Kern-Features, die den Unterschied machen:

1. **Pflicht-CCT-Panel** vor jedem Zug (5 Felder, ausfüllbar in <15 s) — trainiert genau die diagnostizierte Schwäche.
2. **Woodpecker-Modus** über ein fixes Set mit Zyklus-Timer.
3. **Eigene-Partien-Import** (PGN) mit automatischer Blunder-Erkennung über Stockfish + „welches Motiv war es?"-Tagging gegen die Lichess-Theme-Liste.

## 5. Quellen

**Denkprozess / Taktik**
- Heisman, Thought Process Principles: http://www.danheisman.com/thought-process-principles.html
- Heisman, Tactics and Safety (u. a. „Seeds of Tactical Destruction", „Quiescence Error"): http://www.danheisman.com/tactics-and-safety.html
- Heisman, Finding Safe Moves: http://www.danheisman.com/finding-safe-moves.html · Werküberblick: https://en.wikipedia.org/wiki/Dan_Heisman
- Lichess Puzzle Themes (alle Themes + Beschreibung + Anzahl): https://lichess.org/training/themes
- Motive: https://en.wikipedia.org/wiki/Chess_tactic · [Fork](https://en.wikipedia.org/wiki/Fork_(chess)) · [Pin](https://en.wikipedia.org/wiki/Pin_(chess)) · [Skewer](https://en.wikipedia.org/wiki/Skewer_(chess)) · [Discovered attack](https://en.wikipedia.org/wiki/Discovered_attack) · [Zwischenzug](https://en.wikipedia.org/wiki/Zwischenzug) · [Overloading](https://en.wikipedia.org/wiki/Overloading_(chess))
- Woodpecker Method (Zyklen erklärt): https://www.chessable.com/blog/the-woodpecker-method/ · Verlagsseite: https://www.qualitychess.co.uk/products/31/the_woodpecker_method_by_axel_smith_and_hans_tikkanen/

**Mittelspiel**
- Silman, Strategy of Imbalances + Denktechnik: https://en.wikipedia.org/wiki/Jeremy_Silman
- Überblick: https://en.wikipedia.org/wiki/Chess_strategy · https://en.wikipedia.org/wiki/Chess_middlegame
- Bauernstruktur/schwache Felder: https://en.wikipedia.org/wiki/Pawn_structure · [Isolated pawn](https://en.wikipedia.org/wiki/Isolated_pawn) · [Outpost](https://en.wikipedia.org/wiki/Outpost_(chess))
- Heisman, Middlegame Principles: http://www.danheisman.com/middlegame-principles.html

**Endspiel**
- De la Villa, *100 Endgames You Must Know*: https://www.newinchess.com/100-endgames-you-must-know
- Lichess Practice (Endspiel-Drills in Lernreihenfolge): https://lichess.org/practice
- Techniken: [Opposition](https://en.wikipedia.org/wiki/Opposition_(chess)) · [Quadratregel](https://en.wikipedia.org/wiki/Rule_of_the_square) · [Lucena](https://en.wikipedia.org/wiki/Lucena_position) · [Philidor](https://en.wikipedia.org/wiki/Philidor_position) · [Endspiel-Überblick](https://en.wikipedia.org/wiki/Chess_endgame)
- Gratis-Klassiker: Capablanca, *Chess Fundamentals* (Public Domain): https://www.gutenberg.org/ebooks/33870

**Technik / Daten**
- Lichess Open Database (Puzzles CC0, 6.157.341): https://database.lichess.org/
- Puzzle-Themes + Generator: https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml · https://github.com/ornicar/lichess-puzzler
- chess-openings (CC0, 3.865 Einträge): https://github.com/lichess-org/chess-openings
- Lichess API + Opening-Explorer-Spec: https://github.com/lichess-org/api · Server: https://github.com/lichess-org/lila-openingexplorer
- chess.js (BSD-2): https://github.com/jhlywa/chess.js · react-chessboard (MIT): https://github.com/Clariity/react-chessboard
- chessground (GPL-3.0): https://github.com/lichess-org/chessground
- Stockfish.js (GPL-3.0): https://github.com/nmrugg/stockfish.js · Upstream: https://github.com/official-stockfish/Stockfish

**Einschränkung:** Chess.com-Artikel-Deep-Links liefern ohne Login oft 404; die Quality-Chess-Produktseite ist durch Bot-Schutz nicht lesbar. Beides ist oben nur als Verlags-/Existenznachweis verlinkt, inhaltlich abgesichert über die übrigen Quellen. Der Opening-Explorer-Endpunkt antwortete aus diesem Netzwerk mit 401 — die Endpunktnamen stammen aus der offiziellen API-Spec.
