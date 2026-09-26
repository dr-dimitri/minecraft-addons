# Änderungen · Stumme Himmelsvögel

## [Unreleased]

- Forellen und Karpfen am Tag sowie dunkle Hechte mit gelben Leuchtaugen in
  Dämmerung/Nacht ergänzt: eigene Modelle, Schwimmanimationen und stumme
  dekorative Entitäten ohne Angriffe oder Beute.
- Fische schwimmen nur in geprüftem Wasserraum. Wasserverlust, Hindernisse,
  Tageszeitwechsel, Reise und Wiederladen räumen Gruppen auf. Eigenes Limit von
  zwölf geladenen Fischen in drei Gruppen; das Vogellimit bleibt bei 18.
- Im Review eine Kollision der gemischten Tagesgruppe behoben: Forellen und
  Karpfen halten durch ein gemeinsames Schwimmtempo über ihre Lebensdauer Abstand.
- Fisch-Prüfliste und Modellvorschau ergänzt; die tatsächliche Bedrock-Darstellung,
  Wassergrenzen, Leuchtaugen und Leistung bleiben noch zu prüfen.

- Tag- und Nachtgruppen entstehen nicht mehr unter niedrigen Dächern, auch wenn
  darüber Baumkronen liegen. Die Prüfung berücksichtigt den Block direkt über
  den Füßen schleichender oder schwimmender Spieler und lässt hohes Gras zu.
- Ungeeignete niedrige Bäume verhindern nicht mehr die Suche nach einem zweiten
  Sitzplatz auf einer geeigneten höheren Baumkrone.
- `npm test` nutzt die automatische Testsuche von Node, sodass der Aufruf auch
  mit Node 20 unter Windows ohne Shell-Platzhalterauflösung funktioniert.

- Eule und Uhu als eigene stumme Nachtvögel mit roten selbstleuchtenden Augen
  ergänzt. Sie wechseln in Dämmerung/Nacht zwischen Flug und Sitzen auf freien
  Laubblöcken; tagsüber bleiben die bisherigen fünf Arten aktiv.
- Sitzplätze, Tag-/Nachtwechsel und Baumverlust werden kontrolliert aufgeräumt.
  Höchstens drei Gruppen und insgesamt 18 geladene Vögel bleiben erhalten;
  Nachtgruppen bestehen aus zwei Tieren.
- Eigene Modelle, TGA-Paletten, weiche Sitz-/Fluganimationen und aktualisierte
  Vorschau ergänzt. Der alte Releasekandidat 0.1.1 bleibt unverändert; die
  neue Darstellung und das Augenleuchten benötigen noch eine Bedrock-Abnahme.
- Flächensortierung der Modellvorschau gegen Rundungsunterschiede zwischen
  unterstützten Python-Versionen abgesichert, damit der Neubau unverändert bleibt.

- CI prüft die Mindestversionen Python 3.10 / Node 20 und zusätzlich Python 3.14 /
  Node 24. Beide Kombinationen müssen vor der Release-Entwurfserstellung bestehen.
- Neues Kandidatengate automatisiert Wiederholungsbuild, Prüfsummen, Prüfung der
  eingebetteten Packs und vollständigen Quellen sowie Tests und Neubau aus dem
  Source-ZIP ohne Git-Checkout.
- Windows-Checkliste für den unveränderten Kandidaten 0.1.1 ergänzt. Die Prüfung
  im Spiel bleibt offen und wird vom Nutzer am Windows-PC durchgeführt.
- Vorgehensweise bei Änderungen in `AGENTS.md` dokumentiert: belegbare Bugfixes,
  passende Prüfungen, Review, autorisierter Commit/Push und überprüfte Releases
  mit klarer Trennung zwischen Entwurf, öffentlicher Testversion und Freigabe.

## [0.1.1] - Kandidat

- Niedrige Hausdächer werden bei der Standortprüfung erkannt; dort werden keine
  Vogelgruppen mehr für Spieler im Gebäude erzeugt.
- Freie Gruppen werden bei mehr als drei weit getrennten Spielern reihum vergeben,
  statt immer dieselben Spieler nach ihrer ID zu bevorzugen. Das Limit bleibt bei
  18 geladenen Vögeln.
- Das Source-ZIP nimmt nur vorgesehene Projektdateien auf. Lokale `.env`-Dateien,
  Logs und virtuelle Umgebungen werden nicht mehr versehentlich mitgepackt;
  passende symbolische Dateipfade führen zu einem Fehler.

- README um eine schrittweise Bedrock-Installation unter Windows ergänzt:
  Installationsdatei beziehen, importieren, beide Pakete aktivieren, Vögel finden
  sowie Hilfe bei Problemen, Ausschalten und Aktualisieren.

- Eigenständiges Repository `minecraft-addons` mit eigenen Projektvorgaben,
  Entwicklungs-/Release-Skills, CI und Releaseleitfaden. Das Grafikprojekt
  `minecraft-look` bleibt optional und wird nicht für Builds oder Tests benötigt.
- Source-ZIP enthält Lizenz, Projektvorgaben und vollständige Releaseunterlagen;
  macOS-Metadaten werden nicht gepackt.

## [0.1.0] - Testkandidat, Veröffentlichung nicht nachgewiesen

Bestandsbeschreibung beim Einführen dieses Changelogs: fünf Vogelarten in sechs
Exemplaren je Gruppe, maximal 18 geladene Vögel, stummer Tag-/Overworld-Controller,
Ressourcen- und Verhaltenspaket. Details und ausstehende Windows-Prüfungen stehen
in README und `docs/VALIDATION.md`. Keine bestätigte Freigabe im Spiel.
