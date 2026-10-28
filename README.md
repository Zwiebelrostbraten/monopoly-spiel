# Stadtvermögen

Ein eigenständig gestaltetes, inoffizielles deutsches Monopoly-artiges Brettspiel für **2–4 Menschen am selben Gerät**. Vollständig statisch: HTML, CSS und native JavaScript-Module, ohne Backend, Konten, Laufzeit-Abhängigkeiten, CDNs oder externe Schriftarten.

**Unofficial fan project.** MONOPOLY is a trademark of Hasbro. This project is not affiliated with, sponsored by, or endorsed by Hasbro. The interface, CSS city illustration, favicon and concise card descriptions are original; no official logos, character art, board artwork or rulebook passages are included.

## Spielen / Play

Öffne die veröffentlichte GitHub-Pages-Seite oder starte lokal einen HTTP-Server:

```sh
cd /opt/data/projects/monopoly-spiel
python3 -m http.server 8080
# http://localhost:8080
```

Alternativ: `npm start` (startet denselben Python-Server). Ein direktes Öffnen über `file://` unterstützt die verwendeten ES-Module nicht zuverlässig. Zum Spielen ist kein `npm install` erforderlich.

Choose 2–4 names and illustrated figures. Eight original metallic SVG objects have visible, labelled selection buttons; choosing an occupied figure swaps the two selections. Player color rings distinguish figures on shared squares. Legacy symbol avatars resolve only when displayed, preserving existing saves. Automatic starting rolls determine who goes first, rerolling tied leaders. Roll, resolve the square and explicitly end the turn before passing the device. There are no computer opponents or network sessions. Every square opens its deed or explanation. On phones, **“Alle Felder groß ansehen”** opens a readable, keyboard-accessible list of all 40 squares. Click a player to inspect their portfolio; click an owned property to build, sell or manage its mortgage.

## Speichern / Saves

Jede abgeschlossene Aktion wird automatisch unter `stadtvermoegen-v1` im `localStorage` des Browsers gespeichert, einschließlich Kartenreihenfolge, Handelsangebot und Schuldenwarteschlange. Ein Neuladen setzt genau dort fort. Alte offene Vergaben und deren Warteschlangeneinträge werden beim Laden automatisch übersprungen, ohne Spielneustart oder Änderung von Guthaben, Besitz, Karten und Gebäudevorrat. Offene Gebote wurden im bisherigen Code erst beim Zuschlag abgezogen; es ist daher keine Rückzahlung nötig. Andere Speicherzustände bleiben unverändert. Würfelergebnisse werden vor der Animation gespeichert; ein Neuladen während der Animation würfelt nicht erneut. Ein neues Spiel ersetzt den bisherigen Stand nach Bestätigung. Bei blockiertem Speicher zeigt das Spiel eine Meldung. Gelöschte Browserdaten oder ein anderer Browser, Host oder Port haben einen anderen beziehungsweise keinen Spielstand. Verwendet einen aktiven Spieltab pro Ursprung.

No game data is sent to a server. The save is local to this browser origin, not a cloud backup. The new-game dialog offers a JSON export for manual archival/developer recovery; there is no file-import interface.

## Regelumfang

Die Umsetzung verwendet das klassische deutsche Brett (Badstraße bis Schlossallee, Südbahnhof, Westbahnhof, Nordbahnhof, Hauptbahnhof) in der **1.500 Startgeld / 200 beim Überqueren / 400 direkt auf LOS**-Skalierung. `M` bedeutet hier reine Spieleinheiten, keine reale Währung. Editionen unterscheiden sich insbesondere bei Kartenthemen und Werk-Mietwürfen; dies ist keine Behauptung identischer Übereinstimmung mit jeder veröffentlichten Ausgabe.

- 40 Felder, 22 Straßen mit vollständigen sechs Mietstufen, vier Bahnhöfe, zwei Werke, acht Farbgruppen. Einkommensteuer 200, Zusatzsteuer 100; kein Frei-Parken-Topf.
- Freie Grundstücke zum Listenpreis kaufen oder ablehnen. Bei Ablehnung oder fehlendem Kaufgeld bleiben sie unbesessen bei der Bank; der Zug geht weiter.
- Doppelte unbebaute Miete bei vollständigem Farbsatz, auch wenn eine andere Straße dieses Satzes belastet ist. Keine Miete auf dem belasteten Grundstück selbst. Bahnhofsmieten 25/50/100/200. Werkmieten mit **neuem Mietwurf**, ×4 oder ×10; die besondere Werk-Karte verlangt ×10. Bahnhofskarten verdoppeln die Bahnhofsmiete.
- Pasch gibt einen weiteren Wurf, der dritte Pasch führt sofort ins Gefängnis. Gefängnis: vorher 50 zahlen oder eine Frei-Karte verwenden, sonst bis zu drei Paschversuche. Erfolgreicher Gefängnispasch ohne Zusatzwurf; dritter Fehlversuch erzwingt 50 und Bewegung mit genau diesem Wurf. Schulden können diese Bewegung unterbrechen, ohne sie zu verlieren.
- Hausregel: Vorwärts direkt auf LOS gibt insgesamt 400 M (200 Gehalt + 200 Bonus), auch per Karte. Jede Vorwärts-Überquerung gibt 200 M. Rückwärtsbewegung, Stillstand und direkte Einweisung zahlen nichts. „Drei zurück“ löst das erreichte Feld einschließlich weiterer Karten aus.
- Je 16 gemischte Ereignis- und Gemeinschaftskarten: Bewegung, Bankzahlungen, Reparaturen, Zahlungen an/von jeder anderen Person, Gefängnis und je eine handelbare Frei-Karte. Benutzte Karten kommen unter ihren Stapel. Frei-Karten bleiben bis Nutzung, Handel oder Insolvenz außerhalb des Stapels. Die Beschreibungen sind eigenständig formuliert.
- Gleichmäßiger Aufbau und Abbau, vier Häuser vor dem Hotel, vollständige unbelastete Gruppe vor dem Bau. Fester Bestand von 32 Häusern und zwölf Hotels. Hotelbau gibt vier Häuser zurück; Hotelabstieg verlangt vier verfügbare Häuser. Ganze Gruppen können als Einheit zum halben Gesamtbaupreis liquidiert werden. Knappe Gebäude werden in Kaufreihenfolge zum Listenpreis vergeben, solange der Vorrat reicht.
- Hypothek: halber Kaufpreis, vorher sämtliche Gruppenbebauung verkaufen. Ablösen: Hypothekenwert plus 10 %, auf ganze M aufgerundet. Belastete Übernahme nach Handel oder Insolvenz: neuer Besitzer wählt sofortiges Ablösen oder 10 % Übernahmezinsen; bei Behalten kostet späteres Ablösen erneut Hypothekenwert plus 10 %.
- Handel mit beliebigen Kombinationen aus Grundstücken, beiderseitigem Bargeld und Frei-Karten. Explizites Angebot und Zustimmung der anderen Person; vor Zustimmung keine Übertragung. Keine Gebäude im Handel; vor einem Grundstückshandel müssen alle Gebäude seiner Gruppe verkauft sein.
- Unbezahlte Forderungen pausieren die Aktionswarteschlange. Die betroffene Person kann verkaufen, belasten oder handeln; anschließend wird die Forderung genau einmal beglichen. Mehrpersonen-Kartenzahlungen werden einzeln abgewickelt, auch wenn eine andere als die aktive Person zahlen muss.
- Insolvenz liquidiert Gebäude zum halben Baupreis. Wenn vorhandene Hypothekenreserven die Schuld noch decken, werden sie zur Tilgung genutzt, statt eine zahlungsfähige Person ausscheiden zu lassen. Sonst erhält ein Spielergläubiger Bargeld, Grundstücke, Hypotheken und Frei-Karten. Bankschulden führen zur Rückgabe der Frei-Karten und unbelasteten Rückgabe der Grundstücke an die Bank. Ausgeschiedene Personen werden übersprungen. Bei nur einer verbleibenden Person endet das Spiel mit einer Gewinneranzeige.

### Bewusste digitale Festlegungen / Practical limits

Mieten werden automatisch eingefordert. Aktionen sind nacheinander organisiert; neue Handelsangebote sind vor dem Würfeln, nach der Feldabwicklung oder bei Schulden möglich. Unsere Hausregeln (400 M direkt auf LOS, freie Grundstücke bleiben bei abgelehntem Kauf in der Bank, Gebäude in Kaufreihenfolge) weichen bewusst von den Standardregeln ab. Keine Kredite, Mietverzicht-Abkommen, Tempo-Würfel oder Zeitlimits.

The local pass-and-play consent step assumes people respect whose turn it is to confirm; there are no private accounts or anti-cheating controls. Small board labels serve as an overview on phones; the large field list and deed dialogs provide readable details. Reduced-motion preferences remove dice shaking, token steps and card transitions. Optional sound is synthesized locally and starts off.

## Quellen / Rule and data references

Consulted during implementation, 28 October 2026. Only factual rule effects, names and numeric schedules are represented; no source wording or artwork is reproduced.

1. [Published German Hasbro standard rules, ©2013, reference 051300009398](https://www.spielregeln-spielanleitungen.de/wp-content/uploads/2018/01/monopoly.pdf): classic turn flow, new utility rent roll, 1.500/200 scale, stock, building, mortgage, trading, bankruptcy and jail. The optional speed die described there is intentionally excluded.
2. [German standard game property schedules (published comparison table)](https://de.wikipedia.org/wiki/Monopoly#%C3%9Cbersicht_%C3%BCber_Mieten,_Kaufpreise_und_Hypothekenwerte): cross-check of all classic German street names and numeric property tiers.
3. [World of Monopoly: German classic editions](https://www.worldofmonopoly.com/albert/brd_classic_games.htm): collector's documentation of the post-war German board and four station names.
4. [Published German 16/16 card effects, Monopoly Vogtland](https://monopoly-vogtland.de/downloads/kartentexte_vogtland.pdf): comparison of conventional card amounts/effects. Destination names in this implementation use the classic German board. Descriptions in `data.js` are original paraphrases.

## Tests & structure

Node.js 22+ (verified on Node 26), no test dependencies:

```sh
npm test
node --check app.js
node --check engine.js
```

`engine.js` contains the serializable rule model and action queue; `data.js` contains board/deck facts; `app.js` binds the model to the UI; `visuals.js` contains original SVG geometry and legacy avatar resolution. `act(state, 'roll', {dice: [1, 2]})` provides deterministic dice, and a fourth RNG argument controls utility rolls and other random actions. `createGame` accepts an RNG for deck shuffling. The UI uses copy-then-commit actions so a rejected command never partially changes the saved state.

The suite covers focused model cases, three visual regression cases, one static entry check and a simulation test executing **24 seeded complete 2–4-player games**. The simulation's test-only policy includes consenting consolidation trades to encourage completion; it is not shipped as an AI opponent. It checks cash, deed ownership, 32/12 stock, card conservation, save/restore and a terminal winner after each action.

Optional real-browser verification uses Playwright installed **outside** the repository:

```sh
npm install --prefix "$HOME/.cache/stadt-browser" playwright
"$HOME/.cache/stadt-browser"/node_modules/.bin/playwright install chromium
# Keep python3 -m http.server 8080 running in another terminal.
PLAYWRIGHT_MODULE="$HOME/.cache/stadt-browser/node_modules/playwright/index.mjs" \
  node scripts/browser-smoke.mjs
```

Set `CHROMIUM_PATH` to an existing browser executable when appropriate, `GAME_URL` for a different server, and `SCREENSHOT_DIR` for optional desktop/mobile captures. This checks figure selection/swaps, 44px selection targets, unchanged legacy saves, four separate color-ringed figures on corner/street squares contained within their fields at 1440/1024/1000/820/768/390/320 widths, actual keyboard/click flows, purchases and rents, purchase declines for 2–4 players, legacy save migration, direct LOS, construction, mortgages, consent trades including cards, mortgage transfer choices, jail debt, card movement, bankruptcy/win, reload persistence and 1440/390/320 layouts, and fails on console/page/HTTP errors.


The same environment variables work with `node scripts/ui-consistency.mjs`. This focused browser suite checks setup, populated games, all action states and dialog types at 320/390/768/1024/1440 widths, shared spacing and panel padding, aligned page shells, 44px controls, stable hover geometry, visible focus, modal feedback, trade validation, export, save failures and 200% text scaling. Both browser suites share `scripts/ui-geometry.mjs`.

`style.css` owns the UI tokens: 4/8/12/16/24/32/48px spacing, 8px panels/dialogs, 6px controls, a 44px minimum control height, cool white/graphite surfaces, mint/deep-green boards, red actions and bold system sans headings. Components precede responsive adjustments in one stylesheet. The miniature board has a separate proportional scale; occupied tracks reserve room for pieces. On phones pieces cover the miniature field label; the accessible field overview and deed dialog retain all names, prices and management actions. Only dynamic colors and board coordinates/tracks are supplied through inline custom properties.

## GitHub Pages

Deploy **branch `main`, folder `/ (root)`** under repository Settings → Pages. `index.html` and `.nojekyll` are already at the root; no Actions build, bundling, package installation or backend is required. All asset links are relative and work under `/monopoly-spiel/`.


### Hell- und Dunkelmodus

Der Schalter im Kopf und in geöffneten Dialogen wechselt nur die Darstellung; Alt+Umschalt+D wechselt auch ohne Fokuswechsel. Ohne eigene Auswahl folgt das Spiel der Systemdarstellung einschließlich späterer Systemwechsel. Eine ausdrückliche Auswahl wird separat unter `stadtvermoegen-theme` gespeichert. Der Spielstand unter `stadtvermoegen-v1` bleibt unverändert. Bei blockiertem Speicher funktioniert die Auswahl für die laufende Sitzung. `theme.js` setzt die Darstellung vor dem Laden der Styles, einschließlich nativer Steuerelemente und Browser-Themenfarbe.

Browserprüfungen mit vorhandenem Playwright/Chromium: `node scripts/theme-check.mjs` sowie jeweils `THEME=light` und `THEME=dark` für `scripts/browser-smoke.mjs` und `scripts/ui-consistency.mjs`. Alle unterstützen `GAME_URL`; Playwright-Pfad und Chromium-Pfad können mit `PLAYWRIGHT_MODULE` und `CHROMIUM_PATH` gesetzt werden. Die Geometrieprüfung kontrolliert außerdem berechnete Textkontraste, Theme-Metadaten, vier Kopfaktionen, Panelgrenzen, Lesereihenfolge und acht unterschiedliche Gruppenfarben. Die Theme-Prüfung deckt Systemwechsel, Persistenz, blockierten Speicher und unveränderte Dialogeingaben/Fokus sowie Spielstandbytes ab.
