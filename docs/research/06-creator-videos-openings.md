# 06 — Creator-Videos zu unseren Eröffnungen (Transkript-Analyse)

Stand: 25.10.2026. Ersetzt die frühere Fassung, die nur Metadaten hatte.
Grundlage: 13 YouTube-Auto-Untertitel (ASR, unkorrigiert) aus `.scratch/yt/`.

**Kennzeichnung:** `[T mm:ss]` = im Transkript belegt, Zeitstempel ca. ±45 s (Beginn des Untertitelblocks). `[I]` = meine Inferenz oder Standardtheorie, nicht im Video. `[?]` = ASR-Fehler wahrscheinlich, Zugfolge unsicher.

## Kernbefunde

- **Remote Chess Academy (Italienisch) empfiehlt nicht Pianissimo, sondern 5.d4.** Das ist die Gambit-Linie, die unser `italian.pgn` mit 5.d3 bewusst vermeidet. Die reine Pianissimo-Linie ist jetzt durch zwei Videos belegt: Astaneh (`9Q2oa73y5PU`) bestätigt 5.d3 d6 6.O-O, Naroditsky (`Qewug63GIqc`) zeigt die Schwarz-Gegenangriffe (§1.6).
- **TemLSMDKSMw ("The BEST Beginner Chess Opening") ist laut Transkript die Ponziani (3.c3)**, nicht das Giuoco Pianissimo.
- **Caro-Kann: Die Quellen widersprechen sich.** Gegen 3.e5 empfiehlt Gotham sofortiges `...c5`; Big Greek und die Speedrun-Partie spielen zuerst `...Bf5`. Gegen 3.f3 empfehlen Gotham `...g6` und Big Greek `...e6`; Doc 04 nennt `...e5!`.
- **London:** Gotham, Rosen und die Sub-Partien stützen unseren B.2-Aufbau. Die Hauptfallen sind `...Qb6` (Antwort Nc3) und die Greek-Gift-Motive.
- **QGD:** Naroditsky liefert Schwarz-Ideen (Nd7 vor Nf6, Bd6/Bf5, ...c5 gegen den Springer auf e5) und die Carlsbad-Sicht aus Weiß. Unser B.4 deckt die Bf4-Setups nicht ab.
- **Alapin:** nur ein Gotham-Video. Im Repo ist Alapin kein Repertoire-Eintrag (nur in der alten Doc 06). Eine Entscheidung ist nötig.

## 0. Methodik und Vorbehalte

- Zitate sind ASR-Text (Englisch bzw. Deutsch). Creator-Notation ist oft falsch, z. B. "knight f3", "Bishop A3" (gemeint Ba3?), "queen age 5".
- Keine Engine- oder Brettprüfung (`python-chess` fehlt, nichts installiert). Alle SAN-Zugfolgen sind Rekonstruktionen und vor der Übernahme in `content/` am Brett oder in der Engine zu prüfen. Zeitgestempelte Hilfsdateien liegen außerhalb des Repos.
- **Attribution:**
  - `PBXGp_px9m4`: Der Titel nennt GMHikaru ("Slowkaru"). Das Transkript nennt keinen Namen. Die Phrase "educational speedrun series" passt zum Naroditsky-Format `[I]`. Ungeklärt.
  - `hGdovfC6EH4`: Der Titel lautet "Hikaru Teaches the Advanced Caro Kann". Das Transkript ist ein Kick-Livestream mit nur ca. zwei Caro-Passagen (ca. 00:00 und 13:00). Titel und Inhalt passen nicht zusammen.
  - `4azymOvz0xE`: Der Titel nennt Hikaru. Der Sprecher ist im Transkript nicht benannt. Format: Sub-Partien-Review.
  - `PMrqDK-H6G4` (Deutsch): sehr viele ASR-Fehler. Nur die Grundideen sind belastbar.
- **Ausgewertet (Transkript ohne Zeitstempel, siehe §1.6):** Astaneh, "Giuoco Pianissimo" (https://youtu.be/9Q2oa73y5PU) und Naroditsky, "Giuoco Piano" (https://youtu.be/Qewug63GIqc).
- **Entfernt:** Die alte Fassung enthielt Suchsnippet-Angaben, darunter ein Todesdatum zu Naroditsky, und eine Notiz "5.c3" zum Astaneh-Video. Beides war unbelegt bzw. ein Lesefehler und ist weg.

---

## 1. Italienisch (Weiß)

Hauptquelle: `qUews8fEGkc` (Remote Chess Academy, Igor Smirnov). Nebenquelle: `TemLSMDKSMw` (GothamChess, Ponziani). Pianissimo-Quellen: `9Q2oa73y5PU` (Astaneh) und `Qewug63GIqc` (Naroditsky), §1.6.

### 1.1 Empfohlene Linie und Zugfolgen

| Zug | Remote (`qUews8fEGkc`) | Unser `italian.pgn` | Anmerkung |
|---|---|---|---|
| 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 | identisch | identisch | 4...Nf6 "main line" `[T 03:03]` |
| 5.d4 | Stoß gegen Bc5 und e5 `[T 03:03]` | **5.d3** | Hauptunterschied |
| 5...exd4 6.cxd4 Bb4+ | "black pretty much has to trade"; "Bishop B4 check" `[T 03:03–03:48]` | — | Bb4+ fesselt Nc3 später |
| 7.Nc3 Nxe4 | Schwarz nimmt e4, Nc3 ist gefesselt `[T 04:34]` | — | |
| 8.O-O | "you simply castle" `[T 04:34]` | — | Entfesselt Nc3, droht Nxe4 |

Danach hat Schwarz 8...Nxc3 oder 8...Bxc3. Der Creator nennt die Nxc3-Variante die "Falle" und sagt, die meisten Gegner gingen den falschen Weg `[T 05:19]`. Die Fortsetzungen mit Qb3 und Ba3 bezeichnet er als buchmäßig bzw. korrekt `[T 06:04–07:34] [?]`. Unter Standardtheorie kennt man für 8...Bxc3 den Zug 9.d5 (Møller-Angriff) `[I]`. Im Video wird 9.d5 nicht eindeutig gezeigt.

Gegen passives 4...h6 empfiehlt er 5.b4 mit Angriff auf den Läufer und danach ein Bxf7-Opfer `[T 01:30–02:17] [?]`.

### 1.2 Hauptideen, Pläne, Fallen

- Initiative und Entwicklung statt Passivität: "the whole point of the Italian game is to seize the initiative" `[T 04:34]`.
- Fesselung und Druck auf der e-Linie: Bb4+ auf Nc3, Re1 `[T 03:48–04:34]`, Dame und Türme auf der e-Linie `[T 08:20–09:50]`.
- Matt- und Gabelmuster auf f7/e8: Rook-E8-Matt `[T 21:12]`, Bxf7-Opfer `[T 02:17]`.
- Heuristik "whoever plays D5 wins" `[T 12:51]`. Das ist eine Faustregel des Creators, keine Theorie `[I]`.
- Igor warnt vor Büchern: Der Buchzug werde als Fehler widerlegt. Lehre: Engine-Check `[T 06:04]`.

Ignorieren: Ein expliziter Ignore-Hinweis fehlt. Der Creator sagt aber, man solle nicht auswendig lernen, sondern die Ideen verstehen `[T 03:48]`.

### 1.3 Lernweise und typische Fehler

- Prinzipien statt Auswendiglernen: "we're not computers... if you understand the ideas behind moves" `[T 03:48]`. Entspricht Doc 01 §6.1.
- Typische Gegnerfehler im Video: greedy Nxc3 `[T 05:19]`, passives ...h6 `[T 01:30]`.
- Praktischer Rat: Entwicklung und Rochade vor dem Angriff; Königssicherheit prüfen `[T 04:34]` `[I]`.

### 1.4 Abweichungen zu unserem Repertoire

| Punkt | Unser Pianissimo | Remote | Bewertung für 1000 Elo |
|---|---|---|---|
| 5. Zug | 5.d3 (Pianissimo, Zentrum halten) | 5.d4 (Gambit-Stoß) | **5.d3 behalten.** Weniger erzwungene Theorie `[I]` |
| Druckmuster | Re1, Bb3/Bc4 auf f7 | Re1/Dame auf e-Linie, Bf7-Opfer | Muster als Trainer-Taktik übernehmen |
| Heuristik | Plan ohne Regel-Slogan | "wer d5 spielt, gewinnt" | Nur als Kommentar, nicht als Regel |
| Gegen 4...h6 | nicht im PGN | 5.b4 | Eigene Zeile nur, wenn wir Gegenzüge trainieren wollen |
| 5...O-O 6.O-O d5 (Schwarz-Hauptversuch) | nicht im PGN | 7.exd5 Nxd5 8.Re1 `[A5]` | **Ergänzen** als Kommentar- oder Nebenzweig |
| Gegen ...h6, ...g5, ...g4 | nicht im PGN | kein voreiliges h3, Bg3 halten `[N2–N3]` | Trainer-Notiz |

Fazit: Pianissimo bleibt. Astaneh bestätigt unseren 8-Zug-Stamm (§1.6), ergänzt werden sollte nur der 5...O-O/...d5-Zweig. Die Remote-Linie zeigt eine Alternative, die wir nicht spielen. Sie ist gut als Warnung vor dem Gambit-Stoß 5.d4 bei unserem Gegner `[I]`.

### 1.5 Nebenlinie: Ponziani (GothamChess, `TemLSMDKSMw`), 3.c3

- Titel: "The BEST Beginner Chess Opening" `[T 00:00]`. Gotham nennt 3...Nf6 die häufigste Antwort, 3...Bc5 "horrible" `[T 01:31]`.
- Best ist 3...d5, aber nur die vierthäufigste Antwort `[T 07:36–09:06]`.
- Standard für Weiß: 4.d4 `[T 03:03]`.
- Fallen: Bb5-Pin (Bishop B5 "game over") `[T 05:19]`; Qb6-Druck mit Schlagfolge und Gabel `[T 04:33–05:19]`; Qa4 gegen Nc6 `[T 07:36]`.
- Bewertung `[I]`: Nicht Teil des Pianissimo-Repertoires. Als Fallen-Modul ok, aber kein Ersatz. Gothams Aussage "get rid of that Italian" `[T 09:06]` ist seine Meinung.

### 1.6 Pianissimo-Videos: Astaneh (Weiß) und Naroditsky (Schwarz)

Transkripte ohne Zeitstempel. `[A n]` = grober Abschnitt A1 (Einleitung), A2 (drei Schwarzzüge), A3 (...a6), A4 (...d5, Nbd2/Bb3, Anand–Kramnik), A5 (...d5 mit Re1), A6 (a4 und Bb3, Carlsen–Anand), A7 (...Nh5, Bxe3), A8 (Schluss). `[N n]` = Naroditsky N1–N5. Zugfolgen aus dem Gesprochenen rekonstruiert, nicht am Brett geprüft.

- **Astaneh** (IM Alex Astaneh, ChessFactor): Pianissimo entsteht nach 4.d3 (konventionell) oder 4.c3, dann ...Nf6 und der andere Bauer `[A1]`. Unser 4.c3 Nf6 5.d3 ist derselbe Stand in anderer Reihenfolge `[I]`. Schwarz hat nach 5.d3 drei Züge: ...d6, ...a6, ...O-O `[A2]`. Hauptlinie 5...d6 6.O-O, dann meist ...a6 und ...Ba7 `[A3]`.
- **Pläne:** Bb3 als Standard, weil der Läufer auf der Diagonale bleibt und seltener angreifbar ist `[A3, A6]`. Springerwege Nbd2–f1–g3 oder (bei a4) Na3–c2–e3 `[A6]`. Re1 steht oft in der Stellung, die Nbd2 einschließt, und transponiert `[A6]`. Ein d4-Stoß gegen den Ba7 wird erwähnt, der Creator sagt nicht eindeutig, ob Weiß oder Schwarz dadurch profitiert `[A3, ?]`.
- **Schwarz-Gegenspiel:** Der Zug ...Nh5 zielt auf f4 `[A7]`. Gegen ...Nh5 nicht vorschnell Nxe5 (Dxh5 mit Gabel auf d3) `[A7]`. Der Tausch Bxe3 Nxe3 ist der Hauptweg; Astaneh nennt ca. 80 % Remis in Meisterpartien `[A7, A8]`.
- **Fallen und Versuche:** ...d5 nach 5...O-O 6.O-O: 7.exd5 Nxd5 8.Re1 ist seine Hauptlinie `[A5]`. Nbd2 mit Ne4 gegen den Bc5 `[A4]`. Anand–Kramnik 2018: Anand bot nach ca. 16 Zügen Remis an, die Stellung blieb ausgeglichen `[A4]`. Vor Qe2 gegen ...a5/...a4 warnt er `[A4]`.
- **Naroditsky** (Sensei-Speedrun, Schwarz-Sicht): Zeigt Schwarz-Gegenspiel gegen Weiß' Pianissimo. Nach Weiß' Bg5 antwortet er mit ...h6 und ...Be7 statt ...d6, weil ...d6 die Fesselung dauerhaft macht `[N2, ?]`. Weiß' Läufer muss nach g3 zurück, sonst steht er auf h4 schlecht `[N2]`.
- **Angriffsmuster Schwarz:** ...h6, ...g5, ...g4 (Haken) gegen Weiß' Rochade. "h3" nennt er einen ernsten Fehler, der den Haken öffnet `[N3]`. Für Weiß daraus `[I]`: nach ...h6 kein voreiliges h3, Bg3 halten, g4-Haken einplanen.
- **Lernprinzipien:** Nicht ständig rochieren, Königsmitte ist nicht automatisch gefährlich `[N4]`. Röntgen-Angriffe nicht immer gefährlich `[N5]`. Jede Figur fragen: "what is this piece doing here?" `[I]`.

---

## 2. London (Weiß)

Quellen: `49H728S_VjM` (GothamChess, 10-Minuten-London), `4azymOvz0xE` (Sub-Partien, Sprecher unbenannt), `_g1xMZhGOuc` (Eric Rosen, SLCC).

### 2.1 Linie und Zugfolgen

- Gotham: 1.d4 d5 2.Bf4 `[T 00:00]`. Ziel ist die Pyramide mit Bauern auf c3, e3, d4, dazu Bd3, Nf3 und Nd2 `[T 01:30]`.
- Gegen 2...Nf6: Nf3 verzögern `[T 00:45]`.
- Gegen 2...c5: Nd2 vor c3 ("the more modern approach") `[T 04:34]`.
- Gegen 2...c5 und 3...Qb6: Nc3, nicht Qxb2 `[T 03:02–03:48]`.
- Gegen ...g6 (King's Indian): Nc3, Qd2, lange Rochade, h4–h5 `[T 05:19–06:04]`.
- Sub-Partie: "pawns F2, E3, D4, ... bishops and knights developed on D3, F3, D2" `[T 03:49]`.
- Rosen: Bg3 gegen ...Bxg3 mit offener h-Linie, Bd3, g4–g5 `[T 12:24–13:11]`.
- Rosen: Qb6 mit Nc3 `[T 32:19–33:08]`.
- Rosen: Greek gift Bxh7 mit Qh5 und Ng5 `[T 16:59–17:45]`.
- Rosen: Ashwin-Falle mit Nc4, Druck auf d6 und zwei Drohungen (Ng5 und Be5) `[T 23:08–26:14]`.

### 2.2 Ideen, Fallen, Ignorieren

- Kontrolle von e5 ("million dollar square") `[T 01:30]`.
- Doppelbauern zur Mitte schlagen: "95 of the time" `[T 06:51 (4azym)]`, `[T 10:38 (Rosen)]`. Kandidat für Golden Rules.
- Ignorieren: exotische Gambits und Nebenzüge, die nur ablenken. Gotham: "just develop" `[T 07:36–09:07]`.
- Typische Sub-Fehler: passiver Be2 statt dem Schema `[T 04:34 (4azym)]`; Schlagen mit dem F-Bauern zum Rand `[T 06:51 (4azym)]`.

### 2.3 Lernweise

- Rosen: London ist "solid but sort of boring" `[T 00:55]`. Sein Ziel: Lust auf den Eröffnungstyp.
- Gotham: Erfahrung aufbauen, nicht auswendig lernen `[T 09:07]` `[I]`.
- Die Sub-Partien zeigen: Gute Partien scheitern an Ausnahmen (Qb6, Greek gift, Ng5). Deshalb ein Ausnahmen-Drill `[I]`.

### 2.4 Abweichungen zu Doc 04 B.2

| Punkt | Unser B.2 | Creator | Bewertung |
|---|---|---|---|
| 1...d5 2.Bf4 Nf6 3.e3 c5 4.c3 Nc6 5.Nd2 | identisch zur Gotham-Pyramide | bestätigt `[T 01:30]` | Keine Änderung nötig |
| 2...Nf6 | 3.e3 | Nf3 verzögern `[T 00:45]` | Hinweis ergänzen |
| 3...Qb6 (nach c5) | 4.Nc3 | Nc3 `[T 03:02]`, Rosen `[T 32:19]` | bestätigt |
| c3 vs. Nd2 | c3 dann Nd2 | Nd2 vor c3 "modern" `[T 04:34]` | Beides spielbar; Notiz ergänzen |
| ...Bd6 | 5.Bg3 | Bg3 mit H-Linien-Druck `[T 12:24]` | ok |
| ...g6 | nicht im Doc | Nc3, Qd2, O-O-O, h4–h5 `[T 05:19]` | Nicht ins Repertoire, zu scharf `[I]` |
| Traps | nicht enthalten | Greek gift `[T 16:59]`, Ashwin `[T 23:08]` | Trainer-Drill |

Fazit `[I]`: Das London-Repertoire hält. Die Lücke sind die Fallen.

---

## 3. Caro-Kann (Schwarz gegen 1.e4)

Quellen: `rmbU97iftC8` (Gotham, 10 Min), `ebfzL_GwiIE` (Gotham, "CRUSH"), `PBXGp_px9m4` (Speedrun, Urheber unklar), `PMrqDK-H6G4` (Big Greek, Deutsch), `hGdovfC6EH4` (Stream, Randnotizen).

### 3.1 Linie und Zugfolgen

| Zweig | Unser Doc 04 (5.1) | Creator |
|---|---|---|
| 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.Nf3 Nd7 7.Bd3 Bxd3 8.Qxd3 e6 9.O-O Ngf6 | Hauptlinie | Big Greek: 3.Nc3 dxe4 4.Nxe4 Bf5 als Hauptzug `[T 01:34]`; 5.Ng3 Bg6 6.h4 h6 7.Nf3 `[T 05:25–06:13]`; Abtausch Bd3 und e6 `[T 08:30]` |
| 3.e5 Bf5 4.Nf3 e6 5.Be2 c5 6.Be3 Qb6 | Hauptlinie | Big Greek: Bf5 Hauptzug, c5 sofort "etwas zu riskant" `[T 04:38, 09:06]`. Speedrun: Bf5, e6, dann c5 und Nc6 `[T 00:46–04:36]`. Gotham: c5 sofort, "fight the wedge" `[T 01:31–02:16]` |
| 3.exd5 cxd5 4.Bd3 Nc6 5.c3 | Abtausch | Gotham: Struktur bleibt symmetrisch `[T 01:32]`; Big Greek: Abtauschvariante `[T 15:19]` |
| 3.f3 dxe4 4.fxe4 e5! | Fantasy, Konter | Gotham: ...g6, Bg7, Qb6 `[T 04:35–05:22 (rmbU97), 08:24 (ebfzL)]`. Big Greek: ...e6 "der beste Zug" `[T 18:25–19:10]`. Gotham: e5 "tricky, not best by theory" `[T 13:46]` |
| 3.c4 (Panov) | 2.c4-Vorbereitung in B.3 | Gotham: e6, b6, Bb7 `[T 00:45–02:17]`; Big Greek: g6, Nc6 oder e6 `[T 13:02]` |
| 6.h4 (Bg6-Linie) | 6...h6, nicht h5 | Big Greek: h6 als Rückzugsfeld h7; Idee g4 fängt den Läufer nach e6 `[T 05:25]`. Gotham: h4 gegen Bf5-Linie mit h5 `[T 07:39]` |

### 3.2 Ideen, Fallen, Ignorieren

- Den Läufer früh vor die Bauernkette bringen, bevor e6 kommt `[T 01:31 (ebfzL)]`, `[T 01:34 (Big Greek)]`.
- Nicht früh Bauern schlagen. Erst entwickeln, sonst Initiative weg `[T 04:36 (PBXGp)]`.
- Gegner spielen die ersten 10 Züge vernünftig und blunderieren dann `[ca. 05:00 (PBXGp)]`.
- Ignorieren: tiefe Theorie. Gotham: unter 1700 kennt niemand die Theorie `[T 12:15 (ebfzL)]`. Big Greek: "es reicht ein paar grundsätzliche Ideen" `[T 11:32]`.

### 3.3 Lernweise

Gotham: Ideen, Bauernstruktur, Zusammenfassung `[T 00:00–00:45 (rmbU97)]`. Big Greek: "nicht verrückt machen", Gefühl statt Auswendiglernen `[T 11:32]`. Speedrun: offene Linien und Figurenaktivität `[I]`.

### 3.4 Abweichungen zu Doc 04 B.3

| Punkt | Unser Repertoire | Creator | Bewertung |
|---|---|---|---|
| 3.e5 | Bf5, e6, c5 | Bf5 (Big Greek, Speedrun); c5 sofort (Gotham) | Bf5 bleibt. c5 als Kommentar-Alternative |
| 3.f3 | e5! | g6 (Gotham), e6 (Big Greek), e5 "tricky" (Gotham) | Für 1000er eher e6 oder g6. e5 ist scharf `[I]`. Entscheidung dokumentieren |
| 6.h4 | h6 | h6 (Big Greek) vs. h5 (Gotham, andere Struktur) | Doc 04 präzisieren: h6 gilt in der Bg6-Linie |
| Panov | nur 2.c4-Vorbereitung | e6, b6, Bb7 | Als Ausweichlinie notieren |

---

## 4. QGD / ...d5 gegen 1.d4

Quellen: `lLkqjBOGgek` (Naroditsky, Speedrun gegen 1476, Schwarz), `d6tZXETpqT0` (Naroditsky, Carlsbad, Weiß).

### 4.1 Linie und Zugfolgen

- Unser B.4: 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5 (kein Creator-Vergleich).
- Naroditsky (Schwarz, `lLkq`): 1.d4 d5 2.c4 e6 3.Nf3 (...Be7 verhindert Bg5, dann ...Nf6) `[T 00:07–00:52]`. Danach 4.Bf4 Bd6 (Tausch der dunkelfeldigen Läufer) `[T 00:52–01:38]`. Dann ...Bf5 vor den Springern `[T 02:24]` und ...Nd7 vor ...Nf6, um Ne5 zu verhindern `[T 03:56]` `[?]`.
- Naroditsky (Weiß, `d6tZ`): Carlsbad-Struktur mit cxd5 früh; Bg5 als Hauptlinie `[T 00:52]`. Qc2 gegen ...Bf5 `[T 01:37]`. Nf3 oder Ne2 `[T 02:23]`. Pillsbury-Springer auf e5 mit f4 `[T 03:09]`.

### 4.2 Ideen, Fallen, Ignorieren

- Schwarz: Bd6 oder Bf5 vor den Springern; Nd7 vor Nf6; Zentrum halten; Ne5 verhindern `[T 02:24–03:56]`.
- Gegen den Pillsbury-Springer: ...c5 "at the root of the knight" `[T 26:51 (d6tZ)]`.
- Gegen den Minoritätsangriff (b4–b5): Bb7 statt Bb6 `[T 30:47 (d6tZ)]`; Bauernkette halten `[T 05:29 (lLkq)]`.
- Fallen für Weiß (und Warnung für uns): Bxh2 und Ng4+ `[T 24:30 (d6tZ)]`.
- Ignorieren: Naroditsky sagt, die Carlsbad-Theorie sei tief, das Konzept reiche `[T 15:22 (d6tZ)]` `[I]`.

### 4.3 Lernweise

Golden-Rule-Konflikt: "Don't be obsessed with that rule" `[T 01:38 (lLkq)]`. Typischer 1400er-Fehler: unspezifische Züge `[T 26:59 (lLkq)]`. Jede Figur fragen: "what is this piece doing here?" `[T 11:36 (lLkq)]`.

### 4.4 Abweichungen zu Doc 04 B.4

| Punkt | Unser B.4 | Creator | Bewertung |
|---|---|---|---|
| 3.Nc3 ... Bg5 Be7 e3 O-O Nf3 Nbd7 | Hauptlinie | Naroditsky (Weiß) hat Carlsbad, also cxd5 | Unser 8...dxc4 umgeht Carlsbad. Carlsbad-Modul als Ergänzung `[I]` |
| 3.Nf3 / Bf4-Setup mit Bd6 und Bf5 | fehlt | Naroditsky (Schwarz) `[T 00:52–02:24]` | Lücke. Ergänzen |
| Nd7 vor Nf6 | Nbd7 in Zug 6 | "Ne5 prevention" `[T 03:56]` | Identisch in der Idee |
| Minoritätsangriff-Gegenmittel | fehlt | ...c5, ...Bb7 `[T 26:51, 30:47]` | Trainer-Notiz |

---

## 5. Alapin (Weiß gegen Sizilianisch)

Quelle: `VxV8l3x7hOg` (GothamChess, "CRUSH the Sicilian: The ALAPIN").

### 5.1 Linie und Zugfolgen

- 1.e4 c5 2.c3: "two and only two moves ... good: d5 and Nf6" `[T 00:46]`.
- 2...d5: 3.exd5 Qxd5 4.Nf3 (Nc3 ist unmöglich, der c-Bauer steht auf c3) `[T 01:31–03:01]`. Dann ...Bg4 und Be2 gegen die Fesselung `[T 04:33]`.
- Springer über a3–c4–e3 für das Läuferpaar `[T 15:54]` `[?]`.
- 2...Nf6: 3.e5 Nd5 4.d4 ("d4 right away is generally the best move") `[T 08:20–09:07]`.
- Gotham: die zwei Hauptantworten Schwarz' lernen und mit Engine durchspielen `[T 15:13]`.

### 5.2 Ideen, Fallen, Ignorieren

- Früh ausgerückte Dame des Schwarzen ist ein Ziel `[T 03:01]`.
- Den Nd5-Vorstoß mit d4 sofort beantworten `[T 08:20]`.
- Ignorieren: volle Theorie. Die Zugfolgen am Brett durchgehen und dann Engine `[T 15:13]`.

### 5.3 Lernweise

- Zugfolgen im Reader oder am Brett durchspielen, Engine nach der Partie, dann Partien sammeln `[T 15:13]`.

### 5.4 Abweichungen

Keine Repo-Basis. Entscheidung nötig: (a) als Weiß-Repertoire ergänzen (Ticket #7) oder (b) aus dem Trainer-Umfang streichen. Bei (a) sind 2...d5 und 2...Nf6 die zwei Verzweigungen für den Trainer `[I]`.

---

## 6. Empfehlungen für unseren Content und Trainer

1. **[#7 White] Pianissimo 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Bb3 bestätigt.** Astaneh stützt 5.d3, 6.O-O, Bb3 und die Re1-Transposition. Die Remote-Linie 5.d4 nur als Warnung im Kommentar (Gambit-Stoß, Nxc3-Falle), nicht als eigener Zweig. Ergänzen: 5...O-O 6.O-O d5 7.exd5 Nxd5 8.Re1 als Nebenzweig, und Nbd2 (Weg f1–g3) als Plan nach 8.Bb3. Die Zugreihenfolge Re1/Nbd2 bleibt offen, Astaneh sagt beides transponiert.
2. **[#7 White] Ponziani (3.c3) nicht ins Kern-Repertoire.** Falls als Fallen-Modul, klar als Option markieren.
3. **[#7 London] Nc3 gegen ...Qb6 als Pflichtzug im Trainer.** Die Notiz zu Nd2 vor c3 ergänzen, weil Gotham sie als modern nennt.
4. **[#7 London] Trap-Modul.** Greek gift Bxh7 (Rosen `[T 16:59]`) und Ashwin-Falle (Rosen `[T 23:08]`) als Taktikaufgaben.
5. **[#8 Caro] 3.e5 mit Bf5 als Hauptlinie.** c5 sofort (Gotham) als Alternative im Kommentar. Die Warnung von Big Greek ist seine Einschätzung, keine Theorie `[I]`.
6. **[#8 Caro] 3.f3 entscheiden und dokumentieren.** Doc 04 (e5!) gegen Gotham (g6) und Big Greek (e6). Für 1000 Elo empfehle ich e6 oder g6 `[I]`, weil e5 laut Gotham "tricky" ist.
7. **[#8 Caro] 6.h4 präzisieren.** Doc 04 (h6) gilt in der Bg6-Linie. Gothams h5 bezieht sich auf eine andere Struktur. Zwei Muster getrennt führen.
8. **[#8 QGD] Bf4-Setup (...Nf6, ...Bd6, ...Bf5, ...Nd7) als Lücke in B.4 ergänzen.** Carlsbad-Gegenmittel (...c5 gegen den Springer auf e5, ...Bb7 gegen den Minoritätsangriff) als Trainer-Notiz.
9. **[Golden Rules] Regel A.0 #4 ("Move every piece once before any piece twice") mit Ausnahme versehen.** Bei geschlossenem Zentrum sind Doppelzüge ok (Naroditsky `[T 01:38]`). Das ist ein echter Konflikt, kein Fehler.
10. **[Golden Rules] Kandidat "Doppelbauern zur Mitte schlagen".** Rosen `[T 10:38]`, 4azym `[T 06:51]`. Als Heuristik kennzeichnen, nicht als Regel.
11. **[Golden Rules / Drohungs-Scan] Rosen `[T 26:14]`: "two threats, look for both".** Das ist Golden Rule #1 (alle Drohungen beider Seiten). Als Trainer-Aufgabe: Gegner-Drohungen zählen.
12. **[Opening Trainer / #7–8] Alapin-Entscheidung treffen.** Bei Ja: 2...d5 und 2...Nf6 als Hauptverzweigungen trainieren (Gotham `[T 00:46]`, `[T 08:20]`). Bei Nein: aus dem Trainer-Umfang streichen.

---

## 7. Quellen

- `TemLSMDKSMw`: GothamChess, "The BEST Beginner Chess Opening" (Ponziani). https://youtu.be/TemLSMDKSMw
- `qUews8fEGkc`: Remote Chess Academy, "Italian Game Chess Opening Explained in 20 Minutes". https://youtu.be/qUews8fEGkc
- `49H728S_VjM`: GothamChess, "Learn the London System | 10-Minute Chess Openings". https://www.youtube.com/watch?v=49H728S_VjM
- `4azymOvz0xE`: "Learn the London with Hikaru". https://www.youtube.com/watch?v=4azymOvz0xE
- `_g1xMZhGOuc`: Saint Louis Chess Club, Eric Rosen, "Beat Good Players with the London". https://www.youtube.com/watch?v=_g1xMZhGOuc
- `rmbU97iftC8`: GothamChess, "Learn the Caro-Kann Defense | 10-Minute Chess Openings". https://www.youtube.com/watch?v=rmbU97iftC8
- `ebfzL_GwiIE`: GothamChess, "How to CRUSH with the Caro-Kann!". https://www.youtube.com/watch?v=ebfzL_GwiIE
- `PBXGp_px9m4`: "SLOWKARU CROSSING 1000 WITH CARO KANN MASTERCLASS". https://www.youtube.com/watch?v=PBXGp_px9m4
- `hGdovfC6EH4`: "Hikaru Teaches the Advanced Caro Kann". https://www.youtube.com/watch?v=hGdovfC6EH4
- `PMrqDK-H6G4`: The Big Greek, "Lerne die CARO-KANN-Verteidigung" (Deutsch). https://www.youtube.com/watch?v=PMrqDK-H6G4
- `lLkqjBOGgek`: Daniel Naroditsky, "Queen's Gambit Declined | The Sensei Speedrun". https://www.youtube.com/watch?v=lLkqjBOGgek
- `d6tZXETpqT0`: Daniel Naroditsky, "What Is The Carlsbad?? | Queens Gambit Declined". https://www.youtube.com/watch?v=d6tZXETpqT0
- `VxV8l3x7hOg`: GothamChess, "CRUSH the Sicilian Defense: The ALAPIN". https://www.youtube.com/watch?v=VxV8l3x7hOg
- `9Q2oa73y5PU`: ChessFactor, IM Alex Astaneh, "Italian Game | The Giuoco Pianissimo". https://youtu.be/9Q2oa73y5PU
- `Qewug63GIqc`: Daniel Naroditsky, "Italian Game: Giuoco Piano | The Sensei Speedrun". https://youtu.be/Qewug63GIqc
