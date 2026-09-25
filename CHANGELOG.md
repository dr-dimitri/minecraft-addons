# Änderungen · Stumme Himmelsvögel

## [Unreleased]

- Noch keine weiteren Änderungen.

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
