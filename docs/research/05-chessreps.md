# Chessreps: Produktanalyse und Abgleich mit unserem Plan

Stand: 2026-10-25. Recherche nur über öffentliche Seiten, Store-Listings und Suchergebnisse. Nichts wurde mit eigenem Konto getestet.

## Kurzfazit

Chessreps ist ein Opening-Repetition-Trainer (iOS-App "Chessreps - Master Openings" plus Web). Es lehrt fertige Kurse (25+ kuratierte Repertoires plus Community-Kurse) per Learn, Practice, Drill, Time, Puzzles und Arena. Die Ideen, die für uns relevant sind, sind der stufenweise Übergang von Hinweisen zu reinem Abruf, die Auswahl der "Problemlinien" (Cohort) und der Fortschrittszähler pro Kurs. Eigene Importe aus Chess.com, Lichess-Partien oder Engine-Review habe ich bei Chessreps nicht gefunden; dort liegt unser Vorteil.

## Quellenlage und Einschränkungen

- **Website:** Die Startseite ist dünn. Die Unterseiten `/features`, `/pricing`, `/faq`, `/blog` und `/docs/api` liefern HTTP 404. Brauchbar waren `/about` und `/opening/london`.
- **App Store:** Die Beschreibung ist Marketing-Text des Herstellers. Sie ist die ausführlichste Feature-Quelle.
- **API/Agent-Endpunkte:** Nur Discovery-Endpunkte sind öffentlich. Es gibt keine Schemas und keine Auth-Details außer OAuth-Metadaten.
- **Reviews:** Keine unabhängigen Reviews, keine Reddit-Threads und kein YouTube-Video zur App gefunden. Die Suche lieferte fast nur Store-Listings.
- **Unklar:** Preise widersprechen sich (siehe Abschnitt 3). Die Datenquelle wird unterschiedlich benannt (Lichess im Store, "massive game database" auf der About-Seite).
- **Verwechslungsgefahr:** Die App "Chessreps - Opening Repetition" (ein anderer Entwickler, 3000+ Linien, gegen den Computer) ist nicht dasselbe Produkt.

## 1. Produkt und Trainingsschleife

**Was es ist:** Ein Spaced-Repetition-Trainer für Eröffnungsrepertoires. Der Store nennt es "Chessreps is the fast, fun, and science-backed way to build a bulletproof opening repertoire" (Quelle: App Store). Der Entwickler ist laut Store-Eintrag CHESSREPS, LLC; die About-Seite spricht von einem einzelnen Gründer.

**Linien-Eingabe und Import:** Die Kurse sind kuratiert (25+, "new ones added weekly") oder Community-Kurse, die andere Nutzer anlegen (API-Feld `author`, `upvotes`). Der Store nennt zusätzlich "combine lines from multiple sources", ohne Details. Ein eigener Kurs-Editor oder ein PGN-/Chess.com-Import ist nicht belegt.

**Kursstruktur (Beispiel London, `/opening/london`):** 64 Linien. Auf der Seite stehen Hauptlinie und Nebenvarianten, z. B. `1. d4 d5 2. Bf4 Nf6 3. e3 e6 4. Nf3 c5 5. Nbd2 Nc6 6. c3`. Jede Linie hat kurze Erklärungen ("fun, tweet-sized blurbs"), die nach Zügen annotiert sind (z. B. zu `2... c5`, `5... Qb6`).

**Drill-Logik (nach Herstellerangaben):**
- **Learn:** Man spielt gegen den Bot. Bei neuen Stellungen oder Fehlern erscheinen die Erklärungen. Ein "smart system" wählt die Linien, bei denen man am meisten Hilfe braucht, in eine "practice cohort". Die Kohorte wächst mit dem Fortschritt "from a few lines to ALL the lines in the course" (About-Seite).
- **Practice:** Wiederholen gelernter Linien ohne Hinweise, "to build long-term memory before drills" (About-Seite). Die Seite nennt "perfect your lines 1 line away" als Kurzbeschreibung.
- **Drill:** Wie viele Linien man hintereinander ohne Hinweise richtig spielt. Store: "Test yourself under pressure, climb leaderboards".
- **Time Trials:** 60 Sekunden. "Correct answers add precious seconds, but the clock speeds up."
- **Puzzles:** "tactical situations taken from real games where the opening was played" (About-Seite).
- **Arena:** Auf der London-Seite als Modus gelistet, Inhalt nicht erklärt.
- **Hint Mode:** Schalter auf der Kursseite.

**Spaced Repetition ("Reps"):** Der Store sagt nur: "Our 'Reps' system reinforces your repertoire until recall becomes automatic." Intervalle, Algorithmus (SM-2 oder anders), Bewertungsskala und Fälligkeitslogik sind nicht öffentlich. Nicht spekulieren, bevor man es getestet hat.

**Auswahl der Gegnerzüge:** Die Website sagt "the most common moves your opponents will actually throw at you" und "drills all 64 lines against the moves real opponents play". Der Store sagt "Train against moves your opponents actually play" und "Drills come from real games at your level". Eine Rating-Stufe, Gewichtung nach Häufigkeit oder die konkrete Datenbank wird nicht genannt. Der Hinweis "Lichess games" steht nur im Store.

**Fehlerbehandlung:** Laut About-Seite bekommt man im Learn-Modus Erklärungen, wenn man "slip up". Konsequenzen in Drill und Practice (z. B. Streak-Reset) sind nicht beschrieben.

**"From your games":** Nicht gefunden. Die Puzzles kommen aus Partien, die Stellungen des Repertoires enthalten, nicht aus den eigenen Partien des Nutzers.

**Module außerhalb des Trainers:** Puzzles (2 pro London-Kurs), Leaderboards (täglich, wöchentlich, Allzeit), Fortschritt ("strengths, weaknesses, and improvement over time"), adaptive Schwierigkeit (ohne Details). Ein Coach, eine Partie-Analyse oder ein Wochenplan wird nicht erwähnt.

## 2. UX- und Interaktionsmuster

- **Kursübersicht mit Zählern:** Die London-Seite zeigt "Learn 0/64 discovered", "Drill 0/3 lines", "Time 0/3 lines", "Puzzles 0/2 lines", "Arena 0/2 lines". Jeder Modus hat also einen eigenen Abdeckungszähler. Das ist günstig und einfach umzusetzen.
- **Stufenmodell:** Learn (Hinweise) → Practice (ohne Hinweise) → Drill und Time (Tempo/Druck). Das ist die klarste Progressionsidee der App.
- **Cohort-Mechanik:** Eine kleine aktive Menge von Linien, die mit Fortschritt wächst. Das reduziert die Überforderung bei 64 Linien.
- **Kurze Erklärungen pro Linie:** Gamifizierte Erklärungen kurz gehalten, an Züge gebunden.
- **Gamification:** Leaderboards (täglich/wöchentlich/Allzeit), Time-Trial-Zeitbonus, Fortschrittszähler. Es gibt keine Streak- oder Tageszielangabe in den Quellen.
- **Store-Bewertungen:** Je nach Storefront sehr unterschiedlich (4.9 bei 2.3K, 4.8 bei 142, 3.9 bei 27 bei anderen Listings). Nicht als Qualitätsbeleg werten.

## 3. Datenquellen und Preise

- **Datenquelle:** Store: "Powered by real moves from millions of Lichess games". About-Seite: "a massive game database" (nicht benannt). Die Angaben widersprechen sich nicht direkt, sind aber unvollständig. Ob Ratingfilter oder Popularität gewichtet werden, ist nicht belegt.
- **Masters-Datenbank:** Nicht erwähnt.
- **Chess.com-/Lichess-Import eigener Partien:** Nicht erwähnt.
- **Public API:** Nur `GET /api/health`, `GET /api/agent/openings` (Suche nach Kursen mit Feldern id, name, slug, description, color, url, ohne Züge) und `GET /api/agent/community-courses` (Felder id, name, description, color `w`/`b`, lineCount, author, upvotes, url). Nicht im Scope für uns.
- **Preise, widersprüchlich:**
  - Website-About: $4.99/Monat oder $34.99/Jahr, "unlocks ALL 25+ current courses".
  - App Store: "Chessreps PRO" als Abo. Membership-Einträge Weekly $6.99, Monthly $7.99 (doppelt gelistet), Yearly $49.99 (doppelt gelistet). Die Zuordnung ist nicht klar.
  - Die Website-Unterseite `/pricing` liefert 404, es gibt keine kanonische Preisseite.
  - Kostenloser Einstieg: "The first lines are free" (London-Seite). Welche Linien genau frei sind, steht nicht da.
- **Limits:** Keine Tageslimits oder Anzahl freier Drills gefunden.

## 4. Abgleich mit unserem Plan

Legende: **Haben** = steht im Plan. **Teilweise** = Ansatz vorhanden, Detail fehlt. **Nicht** = nicht im Plan.

| Idee (Chessreps) | Status bei uns | Empfehlung | Modul | Begründung in einem Satz |
|---|---|---|---|---|
| Stufenmodell Learn → Practice (ohne Hinweise) → Drill | Teilweise: Learn und Drill ja, ohne Hinweise-Stufe | Adopt | Opening Trainer | Ein 1000er braucht erst Verständnis mit Hilfe, dann Abruf ohne Hilfe, bevor Tempo zählt. |
| Kohorte aktiver Linien, wächst mit Fortschritt | Nicht (wir haben fällige Karten im SM-2, keine begrenzte aktive Menge) | Adopt | Scheduler, Opening Trainer | Eine begrenzte Startmenge (z. B. 5 bis 10 Linien) verhindert Überforderung bei großen Repertoires. |
| Schwächste Linien priorisieren ("smart system") | Teilweise: SM-2 Ease/Lapses implizieren das | Adapt | Scheduler | Die Priorität sollte aus Fehlern und Lapses kommen und sichtbar sein, nicht aus einer Blackbox. |
| Abdeckungszähler pro Modus ("0/64 discovered") | Nicht explizit | Adopt | Repertoire, Training Plan | Ein Zähler für entdeckte Knoten im Stellungsgraph zeigt Lernfortschritt ohne Zusatzaufwand. |
| Kurze, zugbezogene Erklärungen | Teilweise: Golden-Rules-Katalog und regelbasierte Erklärungen | Adapt | Repertoire (Knoten-Annotation), Opening Trainer | Erklärungen pro Knoten, die auf eine Golden Rule verweisen, passen zu unserem Ziel. |
| Hint-Schalter auf Kursebene | Teilweise: zweistufiger Hint, aber nicht als Modus-Schalter | Adapt | Opening Trainer | Ein Schalter pro Session ist gut für den Wechsel Learn/Practice. |
| Opening-Puzzles aus Repertoire-Positionen | Teilweise: Lichess-Puzzles ohne Eröffnungsbezug | Adapt | Puzzles | Puzzles, die an Repertoire-Stellungen anknüpfen, verbinden Eröffnung und Taktik, die uns schwer fällt; Filter über Lichess-Themen prüfen (vorher verifizieren, welche Themen die Puzzle-Datenbank führt). |
| Popularitätsgewichtete Gegnerzüge | Haben (Lichess-Explorer, Popularität) | Haben, bestätigen | Opening Trainer, Repertoire | Chessreps macht dasselbe, unsere Version ist transparenter. |
| Ratingstufe der Gegnerzüge | Teilweise: unser Plan nennt keine Ratingstufe für Replies | Adapt | Opening Trainer | Replies bis 1500 zu gewichten passt zu unserem Repertoire-Scope (bis 1500). |
| Time Trials (60 s) | Nicht | Skip (vorerst) | Opening Trainer | Zeitdruck ist für Eröffnungsabruf bei 1000 Elo kaum nötig und erhöht nur Frust. |
| Leaderboards | Nicht | Skip | — | Ein Nutzer, kein Social-Bezug. |
| Arena | Unklar (Modus nur als Name gelistet) | Skip, bis Details bekannt | — | Ohne Beschreibung nicht bewertbar. |
| Community-/kuratierte Kurse | Nicht (eigene Repertoires) | Skip | Repertoire | Unser Repertoire ist bewusst persönlich und auf die eigenen Schwächen zugeschnitten. |
| Public API, MCP, Agent-Skills | Nicht | Skip | — | Browser-only ohne Backend, und es gibt keinen Nutzen für den Lerner. |
| Eigene Partien aus Chess.com importieren, Game Review | Haben (wir sind hier weiter) | Haben, nicht ändern | Import, Game Review | Chessreps bietet das nicht, es ist unser Kernvorteil für Repertoire-Abweichungen. |
| Fortschrittsdaten (Stärken/Schwächen über Zeit) | Teilweise: Weekly Plan | Adapt | Training Plan | Eine einfache Übersicht je Eröffnung reicht, keine Dashboards. |
| Freemium-Paywall | Nicht relevant | Skip | — | Eigene Nutzung, keine Monetarisierung. |

## 5. Priorisierung für ein 1000-Elo-Lerner in der Eröffnung

1. **Practice-Stufe ohne Hinweise** vor Drill einführen (Opening Trainer, Scheduler).
2. **Aktive Kohorte** begrenzt starten und mit Stabilität erweitern (Scheduler).
3. **Abdeckungszähler** pro Repertoire und Modus (Repertoire, Training Plan).
4. **Knoten-Erklärungen** kurz und an Golden Rules gebunden (Repertoire).
5. **Opening-Puzzles** aus Repertoire-Stellungen, nach Prüfung der Themen-Tags (Puzzles).

Nicht übernehmen: Zeitdruck, Leaderboards, Community-Kurse, API.

## 6. Offene Fragen (vor Übernahme prüfen)

- Welcher Algorithmus steckt hinter "Reps" (Intervalle, Bewertungsskala)? Nicht öffentlich. Testen mit kostenloser Version, falls vorhanden.
- Wird Rating-Band oder Popularität bei den Gegnerzügen gewichtet? Nicht belegt.
- Was bedeutet "Arena"? Nicht beschrieben.
- Preise: Website ($4.99/$34.99) und App Store ($7.99/$49.99) passen nicht zusammen. Nicht als gesicherte Fakten verwenden.

## Quellen

- Startseite: https://www.chessreps.com/ (dünn, nur Überblick)
- About: https://www.chessreps.com/about
- London-Kurs: https://www.chessreps.com/opening/london
- App Store (Hauptapp): https://apps.apple.com/app/id6744000612
- App Store (andere App "Opening Repetition"): https://apps.apple.com/us/app/-/id1512314971
- Discovery-Endpunkte: https://www.chessreps.com/api/openapi.json, https://www.chessreps.com/api/agent/openings, https://www.chessreps.com/api/agent/community-courses, https://www.chessreps.com/.well-known/agent-skills/index.json
- Nicht abrufbar (HTTP 404): /features, /pricing, /faq, /blog, /docs/api, /llms.txt
- Suche ohne unabhängige Reviews, Reddit- oder YouTube-Treffer: Web-Suche "chessreps" (Ergebnisse vor allem App-Store-Listings)
