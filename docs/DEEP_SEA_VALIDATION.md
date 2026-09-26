# Tiefsee im Entwicklungsstand prüfen

Diese Liste ist eine offene Bedrock-Prüfung, kein Abnahmebericht. Automatische
Tests werten die JSON-Features aus; sie führen Minecraft nicht aus.

## Voraussetzungen

- Minecraft Bedrock für Windows ab 1.21.110, beide aktuellen Packs aktiv.
- Neue Testwelt oder noch nicht erzeugte Ozeangebiete. Keine Experimente nötig.
- Content-Log einschalten und Minecraft-Version, Quellstand sowie SHA-256 der
  tatsächlich importierten Datei notieren.

## Welt und Tiefe

- [ ] Import und Aktivierung ohne Biom-, Feature-, Material- oder Nebelfehler.
- [ ] Lumen-Tiefsee entsteht in Teilen tiefer, ungefrorener Ozeane der Overworld.
- [ ] Im Becken liegen 100 Wasserblöcke von Y −37 bis einschließlich Y 62.
      Der feste Tiefenschieferboden liegt bei Y −38.
- [ ] Mehrere Spalten und Chunkgrenzen einschließlich negativer Koordinaten
      prüfen; kein Luftspalt, Lavarest oder schwebender Gesteinsrest im Becken.
- [ ] Angrenzende normale Biome bleiben außerhalb der betroffenen Chunks
      erhalten. Steile Chunkkanten visuell beurteilen.
- [ ] Bereits gespeicherte Chunks werden beim Nachladen nicht vertieft.
- [ ] Nether und Ende enthalten keine neuen Tiefseebecken.
- [ ] Wasserfarbe und Nebel wechseln passend zum Biom, ohne fremde Biome zu ändern.

Der Featurebaum ersetzt den neuen Beckenraum vollständig, auch dort liegende
Teile natürlicher Strukturen. Die Reihenfolge anderer Features kann das Resultat
beeinflussen. Das muss insbesondere neben Monumenten und Unterwasserhöhlen
geprüft werden. Nach Entfernen des Add-ons bleiben erzeugte Blöcke bestehen.

## Tiere und Leistung

- [ ] Tiefenmaul findet freie große Wasserbereiche; Hut und Flossen bleiben im
      Wasser. Verschlucken und Flucht nach [Monster-Prüfliste](MONSTER_VALIDATION.md).
- [ ] Fische und Vögel behalten Tageszeiten, Limits und Geräuschfreiheit.
- [ ] Mehrere neue Tiefsee-Chunks nacheinander und mit mehreren Spielern laden;
      Erzeugungszeit, Bildrate und Content-Log auf dem Ziel-PC protokollieren.
- [ ] Welt speichern, erneut öffnen und Becken/Tiere erneut prüfen.

Jeder betroffene Chunk fordert 25.600 Wasser- und 256 Bodenplatzierungen an.
Ein erfolgreicher JSON-Test belegt keine ausreichende Erzeugungsgeschwindigkeit.

## Technische Grundlage

Die [Höhenkomponente](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/biomesreference/examples/components/minecraftbiomes_overworld_height?view=minecraft-bedrock-stable)
vertieft modernes Terrain nicht. Deshalb erzeugt `scripts/deep_sea.py` nach der
Oberflächenphase ein eigenes Becken über verschachtelte, deterministische
[Scatter-Features](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraft_scatter_feature?view=minecraft-bedrock-stable).
Die zwei getrennten Bereiche für Wasser und Boden überschneiden sich nicht.
`tests/test_deep_sea.py` prüft die vollständige Fläche und alle Referenzen.
