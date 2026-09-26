# Projektvorgaben für minecraft-addons

Dieses eigenständige Repository enthält das Bedrock-Add-on **Lumen · Stumme
Himmelsvögel**. Das optionale Grafikprojekt `minecraft-look` wird separat
entwickelt und versioniert; für Build, Test und Release ist dessen Checkout
nicht erforderlich.

## Arbeitsablauf bei Änderungen

1. **Auftrag und Ausgangsstand prüfen.** Git-Status, Branch und vorhandene
   Änderungen lesen. Umfang von Korrektur, Commit/Push und Release aus dem
   Nutzerauftrag ableiten; bereits erteilte Autorisierung weiter beachten.
   Fremde Änderungen erhalten und keine unbekannten Dateien pauschal übernehmen.
2. **Praxisrelevante Fehler belegen.** Betroffene Quellen, Aufrufer und Tests
   untersuchen. Konkreten Auslöser, tatsächliches Verhalten und erwartetes
   Ergebnis festhalten. Bei Bugfixes möglichst einen Regressionstest ergänzen,
   der vor der Korrektur scheitert und danach besteht. Vermutungen und bekannte
   Einschränkungen nicht ohne Prüfung als neue Fehler ausgeben.
3. **Gezielt korrigieren.** Änderungen an den maßgeblichen Quellen vornehmen;
   generierte Pakete anschließend neu erzeugen. API-Annahmen bei Bedarf gegen
   offizielle Dokumentation und die verwendeten Typdefinitionen prüfen. Die
   unterstützten Mindestversionen von Python und Node berücksichtigen.
4. **Dokumentation mitführen.** Nutzerrelevante Änderungen unter `Unreleased`
   im Changelog erfassen und betroffene README-/Prüfanweisungen aktualisieren.
   Historische Prüfberichte nicht nachträglich zu aktuellen Testbelegen machen.
   Die Produktversion erst für einen neuen Releasekandidaten erhöhen.
5. **Passend prüfen.** Bei Code-, Paket-, CI- oder Releasewerkzeugänderungen
   die Befehle unter „Prüfung“ ausführen. Bei reinen Dokumentationsänderungen
   genügen Inhalts-, Link- und Diffprüfung. Tests erst nach weiteren Änderungen,
   Fehlern oder offenen Befunden erneut ausführen.
6. **Den vollständigen Diff reviewen.** `git diff --check` ausführen; Quellen,
   generierte Dateien, Tests und Dokumentation gemeinsam prüfen. UUIDs,
   Versionsgleichheit und unveränderte Verhaltensgrenzen kontrollieren. Private
   Dateien, lokale Umgebungen, Logs und `dist/` nicht einchecken.
7. **Im autorisierten Umfang abschließen.** Vor dem Commit den gestagten Diff
   prüfen. Nach einem beauftragten Push den entfernten Commit und die CI für
   genau diesen Stand kontrollieren; CI-Fehler untersuchen und beheben. Ein Push
   allein ist noch keine erfolgreiche Prüfung und erzeugt keinen Releaseauftrag.
8. **Ergebnis nachvollziehbar berichten.** Behobene Fehler, ausgeführte Tests,
   offene In-Game-Prüfungen sowie gegebenenfalls Commit, CI-Link und erreichten
   Releasestatus nennen. Bei einem Releaseauftrag zusätzlich den folgenden
   Ablauf unter „Release und Skills“ vollständig ausführen.

## Quellen und Änderungen

- Controllerquellen liegen in `src/`; `scripts/generate.py` erzeugt Modelle,
  Paletten, Animationen, Entitäten und Manifeste. `behavior_pack/`,
  `resource_pack/` und `docs/PREVIEW.svg` sind generierte, mitzuversionierende
  Ausgaben. Änderungen an den Quellen vornehmen und neu erzeugen.
- `scripts/deep_sea.py` enthält Biom und Tiefseebecken; `scripts/diving.py`
  pflegt Tauchausrüstung und U-Boot. `scripts/world_template.py` erzeugt eigene
  Weltmetadaten und ein separates Welt-Verhaltenspaket mit festen eigenen UUIDs.
  Dessen `ADVENTURE_WORLD`-Flag aktiviert den einmaligen Dorfaufbau. Im normalen
  Add-on muss das Flag ausgeschaltet bleiben; bestehende Paket-UUIDs erhalten.
- `scripts/build.py` ruft Generator und Preview selbst auf und überschreibt beide
  Packordner. Vorher Git-Status prüfen. Unbekannte Änderungen dort zuerst in einer
  vollständigen temporären Kopie einschließlich unversionierter Dateien vergleichen.
  Keine Nutzerarbeit durch Regeneration verwerfen.
- `dist/` bleibt Buildausgabe und wird nicht eingecheckt. Das Source-ZIP verwendet
  die erlaubten Projektpfade aus `SOURCE_PATTERNS` in `scripts/build.py`.
  Bei neuen Quelldateitypen deren Aufnahme und den eigenständigen Wiederaufbau
  prüfen. Releasebuilds nur aus einem sauberen, geprüften Checkout ohne private
  Dateien, virtuelle Umgebungen oder lokale Logs erstellen.
- `VERSION` in `scripts/generate.py` und `version` in `package.json` synchron
  halten. Ressourcen-/Verhaltenspaket, Module und interne Packabhängigkeiten
  tragen dieselbe Produktversion. Header- und Modul-UUIDs erhalten.
- Die aktuelle stabile API-Abhängigkeit ist `@minecraft/server` 2.0.0. API und
  technische Mindestversion nur bei begründetem Bedarf ändern und dann gegen
  offizielle Dokumentation/Typen prüfen. Nicht an eine Grafikpaketversion koppeln.
- Bestehendes Verhalten erhalten, sofern der Auftrag es nicht gezielt ändert:
  stumme dekorative Vögel, keine Blockänderungen, keine Commands, keine absichtlich
  geladenen Chunks, nur Overworld, höchstens 18 geladene Vögel sowie Aufräumen bei
  Aktivitätswechsel, Dimensionswechsel und Wiederladen. Tagvögel sind nur tagsüber
  aktiv; Eulen und Uhus in Dämmerung/Nacht mit geprüften Sitzplätzen auf Laub. Nativen Despawn als Rückfallebene erhalten.
- Fische werden getrennt verwaltet: Forellen/Karpfen am Tag, Hechte in Dämmerung
  und Nacht, höchstens zwölf geladene Fische in drei Gruppen zusätzlich zum
  Vogellimit. Wasserraum und vollständigen Körperbereich vor Spawn und Bewegung
  prüfen; keine Fische in Lava, Luft oder wassergefüllten festen Blöcken.
  Auch Fische bleiben stumm und dekorativ, ohne Angriffe, Beute oder Fangfunktion.
  Änderungen an Fischmodellen gegen die Wasser-Prüfhülle einschließlich aller
  Animations- und Blickwinkel prüfen; Zwischenspeicher nie über Ticks behalten.
- Fremde Assets benötigen nachvollziehbare Herkunft und Rechtehinweise. Die
  bestehenden Modelle und Paletten sind eigene Projektinhalte; `NOTICE.md` und
  `LICENSE` bei geänderter Herkunft entsprechend pflegen.
- Feindliche Mutantenfische werden in `src/mutant_fish.js` getrennt verwaltet:
  nur in der aktivierten Abenteuerwelt ab Y 20 abwärts, höchstens sechs geladen,
  kein Spawn in Friedlich, keine Angriffe auf Creative/Spectator oder Bootsinsassen.
  Native Schadensberechnung, Trefferabstände und geprüfte Wasserhülle erhalten.
  Die dekorativen Fische dürfen durch diese Ausnahme nicht feindlich werden.
- Die beauftragte Tiefsee verändert Blöcke während neuer Welterzeugung.
  Im ausdrücklich aktivierten Weltpaket baut `src/ocean_village.js` vier Dörfer;
  `src/belly_rooms.js` baut Bauchkammern und kopiert verschluckte Dorfblöcke;
  `src/village_feast.js` entfernt ausschließlich geprüfte ursprüngliche Dorfblöcke
  nach bestätigter Kopie und Spielerrettung. Gefüllte Container, fremde Blöcke
  und der zentrale Startsteg bleiben erhalten. Fortschritt dauerhaft speichern;
  bei Wiederladen keine Entfernungen erneut abspielen. Die Oberflächenszene
  teilt das Monsterlimit und verwendet eine größere Darstellung mit eigener
  Maulprüfung. Die normale Unterwasser-Prüfhülle bleibt unverändert.
  Andere Tiercontroller und U-Boot verändern weiterhin keine Blöcke. `.mcworld`
  mit eingebetteten Packs, Welt-UUIDs, 100 Wasserlagen und Dorf-Opt-in mitprüfen.
  Eine leere korrekt kodierte Weltdatenbank belegt keinen Bedrock-Import.

## Prüfung

Python ab 3.10 und Node ab 20 verwenden. Keine Zusatzpakete oder Downloads nötig.
Vom Repository-Root aus:

```sh
python3 scripts/generate.py
python3 scripts/preview.py
python3 scripts/check_release.py
npm test
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```

`npm test` benötigt keine Installation. Python und Node prüfen getrennte Ebenen;
beide sind bei Code-, Paket-, CI- und Releasewerkzeugänderungen erforderlich.
Neue JS-Tests als `*.test.js` anlegen. Reine Textkorrekturen benötigen keinen
Paketbuild. Die vollständigen Kandidatengates stehen in `docs/RELEASING.md`.

Die CI prüft Python 3.10 / Node 20 und Python 3.14 / Node 24. Beide Kombinationen
führen zusätzlich `python3 scripts/check_candidate.py` aus: vollständiger
Wiederholungsbuild, Prüfsummen, eingebettete Packs, vollständiges Source-ZIP
und dessen Tests/Neubau in einem frischen Verzeichnis ohne Git. Lokal dieses
Gate erst aus einem sauberen, vollständig eingecheckten Stand ausführen; mit
`--tag birds-vX.Y.Z` auch den Releasebezug prüfen. Releaseartefakte stammen nur
aus der Kombination Python 3.14 / Node 24, nachdem beide Prüfjobs bestanden sind.

Lokale Validatoren, Mocks und `docs/PREVIEW.svg` führen Minecraft nicht aus.
Import, Content-Log, Darstellung, Audio und FPS nur nach tatsächlicher Prüfung
als bestanden melden. Historische Prüfberichte sind keine neue Abnahme. Die
Windows-Prüfung steht in `docs/VALIDATION.md`; Kandidatenbelege nach
`docs/RELEASING.md` führen.

## Release und Skills

Änderungen zunächst in `CHANGELOG.md` unter `Unreleased` erfassen. Versionierung,
Tags nach `birds-vX.Y.Z`, Abnahme, Veröffentlichung und Hotfixes richten sich nach
`docs/RELEASING.md`. Neue Arbeitsbranches verwenden `codex/` als Präfix. Externe
Aktionen nur im Umfang des Nutzerauftrags ausführen; Releasevorbereitung allein
ist keine Veröffentlichung. Bereits erteilte Autorisierung gilt weiter.

Für einen beauftragten Release:

1. Vorhandene lokale und entfernte Tags sowie GitHub-Releases prüfen. Eine neue,
   passende Version wählen; veröffentlichte Tags und Artefakte nicht ersetzen.
2. Versionsquelle, `package.json`, generierte Manifeste und sichtbare Angaben
   synchronisieren. Änderungen aus `Unreleased` in den Kandidatenabschnitt
   übernehmen und `scripts/check_release.py --tag birds-vX.Y.Z` ausführen.
3. Den geprüften Kandidaten vollständig committen. Aus einem sauberen Checkout
   `python3 scripts/check_candidate.py --tag birds-vX.Y.Z` ausführen. Das Gate
   baut zweimal, vergleicht Archivhashes, prüft `SHA256SUMS.txt` und eingebettete
   Packs sowie den vollständigen Source-ZIP-Inhalt und führt daraus Tests und
   Build ohne Git-Checkout aus.
4. Commit pushen und die erfolgreiche CI genau dieses Commits abwarten. Erst
   danach den annotierten Tag `birds-vX.Y.Z` erstellen und pushen. Auch den
   Tag-Workflow bis zum Ergebnis prüfen.
5. Den erzeugten Release-Entwurf vervollständigen: Änderungen, Installation,
   Kompatibilität, Grenzen und Prüfbeleg nach `docs/releases/TEMPLATE.md`.
   Belege an Quellcommit, CI-Lauf und SHA-256 der tatsächlichen CI-Artefakte
   binden. Releaseanhänge herunterladen und mit den geprüften CI-Dateien
   vergleichen; keine ungeprüften lokalen Altartefakte hochladen.
6. Ohne echte Windows-/Bedrock-Abnahme den Entwurf fertigstellen und die offenen
   Prüfungen benennen. Eine ausdrücklich gewünschte öffentliche Testversion
   als Pre-release mit sichtbaren Einschränkungen veröffentlichen. Eine stabile
   Freigabe benötigt die dokumentierte Abnahme. Nach Veröffentlichung Status,
   Version, Downloads und Prüfsummen erneut kontrollieren.

Projektlokale Skills unter `.agents/skills/`:

- `lumen-birds-development`: Vogelcontroller, Modelle und Add-on-Pakete ändern.
- `lumen-birds-release`: Releasekandidaten prüfen, versionieren und veröffentlichen.

## Code Review Rules

Als Fehler behandeln: ausschließlich generierte Dateien geändert; rotierte
Bestands-UUIDs; inkonsistente Produktversionen; unaufgelöste Ressourcenverweise;
unbegründete Änderungen an Vanilla-Verhalten; unbelegte In-Game- oder
Performancebehauptungen; Upload alter oder ungeprüfter Artefakte; automatische
öffentliche Freigabe vor der Abnahme; lokale Abhängigkeiten vom Grafikrepository.
