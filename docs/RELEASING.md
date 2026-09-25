# Entwicklung und Release

Der Ablauf lautet: Änderung → Review und CI → versionierter Kandidat →
Release-Entwurf → Prüfung in Minecraft → bewusste Veröffentlichung. Ein grüner
Build ist eine technische Paketprüfung und ersetzt die Prüfung im Spiel nicht.
Alle Schritte sind in diesem Repository ausführbar.

## Produkt und Version

| Produkt | Versionsquelle | Weitere Versionsstellen | Tag | Artefakte |
|---|---|---|---|---|
| Stumme Himmelsvögel | `scripts/generate.py`: `VERSION` | `package.json`, README, CHANGELOG | `birds-vX.Y.Z` | `.mcaddon`, Source-ZIP, `SHA256SUMS.txt` |

Manifeste, Module und interne Packabhängigkeiten werden aus der Versionsquelle
erzeugt. `format_version`, `min_engine_version` und die Script-API-Version sind
unabhängige Kompatibilitätsangaben. Das optionale Grafikprojekt
[`minecraft-look`](https://github.com/dr-dimitri/minecraft-look) besitzt seinen
eigenen Build- und Releasezyklus. Ein zweiter Checkout ist nicht erforderlich.
Der Tag-Namensraum `birds-v` bleibt auch nach der Repository-Aufteilung erhalten.

Projektkonvention: `X.Y.Z` mit drei nichtnegativen Ganzzahlen ohne führende
Nullen. Patch für kompatible Fehlerkorrekturen, Minor für neue Funktionen,
Major für inkompatible Änderungen. Auch vor 1.0 inkompatible Änderungen
ausdrücklich dokumentieren und mindestens Minor erhöhen. Neue Mindestversionen
und Welt-/Installationsmigrationen in den Releasehinweisen nennen. Eine bereits
veröffentlichte Version wird nicht erneut verwendet. UUIDs bleiben bei Updates
erhalten; neue Identitäten bedeuten ein neues, bewusst separat installierbares Paket.

Für Testkandidaten dient der Release-Entwurf. Eine öffentliche Testversion erhält
zusätzlich GitHubs Pre-release-Markierung und klare Einschränkungen; Bedrock-Version
und Tag bleiben `X.Y.Z` bzw. `birds-vX.Y.Z`. Keine `-rc`-Werte in den ganzzahligen
Bedrock-Versionsarrays verwenden.

## Änderungen vorbereiten

1. Arbeitsbaum prüfen und fremde Änderungen bewahren. Bei neuen Agent-Branches
   `codex/` verwenden.
2. Quellen bearbeiten, erforderliche Regressionstests ergänzen und die Pakete
   regenerieren. Ausgabeverzeichnisse nicht als alleinige Quelle behandeln.
3. Nutzerrelevante Änderungen in `CHANGELOG.md` unter `Unreleased` dokumentieren.
   Erst beim Zusammenstellen des Kandidaten die Version erhöhen und Änderungen
   in `## [X.Y.Z] - Kandidat` verschieben. Keine Versionsanhebung für jeden
   einzelnen Entwicklungscommit erzwingen.
4. Anleitung, Kompatibilität und bekannte Grenzen abgleichen. Alte Prüfberichte
   bleiben historische Belege; neue Ergebnisse erhalten einen eigenen Beleg.
5. Quellen, generierte Dateien, Tests und Dokumentation gemeinsam reviewen und
   committen. Releasequellen müssen vollständig in Git vorliegen. `dist/` gehört
   nicht in Git. Vor einem Tag muss `git status --porcelain` leer sein.

## Lokale automatische Gates

Alle Befehle laufen vom Repository-Root mit Python ab 3.10 und Node ab 20.
Es ist kein `pip install` oder `npm install` nötig.

**Achtung:** Der Generator löscht seine Ausgabeordner; der Build regeneriert
zusätzlich selbst. Bei unbekannten oder unversionierten Änderungen eine
vollständige temporäre Kopie einschließlich dieser Dateien verwenden. `dist/`
und lokale Umgebungen dabei auslassen. Erst nach dem Vergleich neue Ausgaben
gezielt übernehmen.

```sh
python3 scripts/generate.py
python3 scripts/preview.py
python3 scripts/check_release.py
python3 -m unittest discover -s tests -v
npm test
python3 scripts/build.py
git status --porcelain --untracked-files=all -- behavior_pack resource_pack docs/PREVIEW.svg
```

Die letzte Ausgabe muss bei einem eingecheckten Kandidaten leer sein. Für eine
noch nicht eingecheckte Änderung die erwarteten Diffs prüfen und gemeinsam mit
den Quellen committen. Die CI erkennt auch neu erzeugte, nicht versionierte Dateien.

Vor einem Kandidaten zusätzlich:

Die folgenden Kontrollen führt `scripts/check_candidate.py` gemeinsam aus.
Im Git-Checkout verlangt es einen sauberen, vollständig eingecheckten Stand;
die Versionsnummer im Beispiel durch die des Kandidaten ersetzen:

```sh
python3 scripts/check_candidate.py --tag birds-v0.1.1
```

Ohne `--tag` eignet es sich auch für normale Entwicklungscommits. Es prüft
alle versionierten Dateien gegen die Source-ZIP-Dateiliste, vergleicht die
Archivbytes mit den Quellen und lehnt fremde Altdateien in `dist/` ab.
Vorhandene lokale Dateien werden dabei nicht automatisch gelöscht. Die
Reproduzierbarkeit wird innerhalb derselben Python-/zlib-Umgebung geprüft;
verschiedene Laufzeitkombinationen müssen untereinander nicht bytegleich bauen.

- Den vollständigen Build im selben sauberen Quellbestand und derselben
  Python-/zlib-Umgebung wiederholen. SHA-256 jedes erzeugten Archivs zwischen
  beiden Läufen vergleichen. Archiv-Unittests allein belegen keinen vollständigen
  Wiederholungsbuild. Das Ergebnis im Abnahmebeleg dokumentieren.
- Jede Zeile von `dist/SHA256SUMS.txt` gegen die Datei prüfen (Linux:
  `sha256sum -c SHA256SUMS.txt`, macOS: `shasum -a 256 -c SHA256SUMS.txt`, jeweils
  in `dist/`). Keine fremden Altversionen aus einem lokalen `dist/*` veröffentlichen.
- Archive öffnen: beide eingebetteten `.mcpack` im `.mcaddon`, Root-Manifeste,
  CRC und Versions-/UUID-Zuordnung prüfen. Source-ZIP-Inhalte auf private/lokale
  Dateien kontrollieren. Lizenz, Vorgaben, Releaseleitfaden und Abnahmevorlage
  müssen enthalten sein. Anschließend das Source-ZIP in einem frischen Verzeichnis
  entpacken und dort die obigen Tests und den Build ausführen. Der Source-Packer
  verwendet die erlaubten Projektpfade aus `SOURCE_PATTERNS` in `scripts/build.py`
  und lehnt passende symbolische Dateipfade ab; Verzeichnislinks werden nicht
  rekursiv verfolgt. Neue Quelldateitypen dort ergänzen. Weiterhin
  nur aus einem sauberen, geprüften Quellbestand bauen.

## CI und Release-Entwurf

`.github/workflows/build.yml` prüft bei Push und Pull Request die
Versionskonsistenz, Python- und JS-Tests, generierten Ausgaben und Prüfsummen,
den vollständigen Wiederholungsbuild und den eigenständigen Source-ZIP-Neubau.
Die Matrix verwendet Python 3.10 / Node 20 sowie Python 3.14 / Node 24; beide
Jobs geben ihre konkreten Laufzeitversionen aus und müssen erfolgreich sein.
Nur Python 3.14 / Node 24 lädt das Artefakt `lumen-silent-birds` hoch, damit die
Release-Dateien aus einer eindeutig festgelegten Umgebung stammen. Auf einem Release-Tag kommt
die strikte Tag-/Changelogprüfung hinzu. Erfolgreiche `birds-vX.Y.Z`-Tags
erzeugen einen **Entwurf**, keine öffentliche Freigabe. Die Pakete werden aus
dem geprüften CI-Lauf übernommen und nicht im Releasejob neu gebaut. Der
Releasejob wartet auf beide Matrixkombinationen. Ein einzelner grüner Matrixjob
genügt nicht zur Freigabe des Entwurfsjobs.

Beispiel für die lokale Tagprüfung (Version an den Kandidaten anpassen):

```sh
python3 scripts/check_release.py --tag birds-v0.1.0
```

Vor dem Tag das Review und die grüne CI des vorgesehenen Commits prüfen. Ein
autorisierter Releaseauftrag umfasst das Erstellen/Pushen des zugehörigen
annotierten Tags und die Erstellung des Entwurfs. Ein bloßer Auftrag zur
Vorbereitung endet lokal, sofern Tag-Push oder ein entfernter Entwurf nicht
ebenfalls beauftragt sind. Bestehende Tags, Releases und Dateien vor Mutationen
prüfen; bekannte Autorisierung nicht erneut erfragen.

Nach Tag-Push den Workflowlauf und Entwurf prüfen. Ein fehlgeschlagener oder
teilweise ausgeführter Upload bleibt ein Entwurf. Bei erneutem Lauf vorhandene
Dateien und Prüfsummen abgleichen, nur fehlende identische Kandidatenartefakte
ergänzen. Keine Tags verschieben und kein `--clobber` zur Fehlerbehebung nutzen.
Der Workflow überschreibt vorhandene Releases nicht und kann dann gezielt eine
manuelle Wiederaufnahme erfordern.

## Prüfung im Spiel und Freigabe

Den Entwurf auf Windows mit der vorgesehenen Bedrock-Version prüfen. Vorlage:
[`releases/TEMPLATE.md`](releases/TEMPLATE.md). Der Beleg bindet Ergebnisse an
Quellcommit, Dateinamen und SHA-256 der **tatsächlich getesteten** CI-Artefakte.
Belege als Releaseanhang/-text oder späteren Dokumentationscommit speichern;
den Kandidatentag zum Ergänzen eines Belegs nicht verschieben oder neu bauen.

- [VALIDATION.md](VALIDATION.md) ausführen, einschließlich Import beider Pakete,
  Content-Log, Animation/Flugruhe, Geräuschfreiheit, Lebensdauer, Tag/Nacht,
  Dimensions-/Chunkwechsel und Wiederladen.
- Zunächst mit dem Add-on allein prüfen. Bei zugesicherter Kompatibilität mit
  weiteren Paketen deren konkrete Versionen und Kombinationen ebenfalls prüfen
  und dokumentieren. Lumen WQHD ist eine optionale Kombination, keine Voraussetzung.
- Bestehende Welt vor einem Update sichern und das Update von der letzten
  veröffentlichten Version prüfen; beim Erst-Release ist dieser Punkt nicht anwendbar.
- Für eine stabile Freigabe dürfen keine offenen Import-, Script- oder
  Darstellungsblocker bleiben. Behauptungen zur Zielhardware oder FPS benötigen
  Messdaten. Offene Engineprüfungen schließen eine stabile Freigabe aus; eine
  ausdrücklich gewünschte öffentliche Testversion benennt sie sichtbar.

Vor der öffentlichen Freigabe Releasehinweise aus dem Changelog, Kompatibilität,
Installation/Update, Prüfumfang und bekannte Grenzen ergänzen. Nur die geprüften
Dateien veröffentlichen. Danach Release herunterladen und Prüfsummen sowie
sichtbare Version/Tag/Status kontrollieren. Automatische Tests erzwingen die
technische Seite; Review, Tagberechtigung und reale Abnahme benötigen zusätzlich
den eingehaltenen Prozess bzw. Repository-Einstellungen.

## Fehler nach einem Release

Bei einer fehlerhaften Veröffentlichung Nutzungshinweise und bekannte Probleme
am Release ergänzen. Reparatur als neue Patchversion vom betroffenen Stand
erstellen, alle relevanten Gates einschließlich Updatepfad erneut durchlaufen.
Veröffentlichte Tags und Binärdateien nicht stillschweigend ersetzen. Ein
Git-Revert ist kein sicheres Downgrade einer bereits aktualisierten Bedrock-Welt;
Wiederherstellung aus einer Sicherung oder eine vorwärts gerichtete Korrektur
mit höherer Version vorsehen.

## Einmalige Repository-Einrichtung

Diese Dateien konfigurieren keine entfernten GitHub-Einstellungen. Nach dem
ersten erfolgreichen CI-Lauf Review vor Merge und den Prüfjob als erforderlichen
Statuscheck im Standardbranch hinterlegen; Force-Push/Branchlöschung begrenzen.
Tag-Erstellung und Änderungen an `birds-v*` auf die Releaseverantwortlichen
beschränken. Die tatsächliche Verfügbarkeit und Einrichtung der Regeln im
Repository prüfen; nicht allein aufgrund dieser Dokumentation als aktiv melden.

## Projektlokale Skills

`AGENTS.md` enthält die dauerhaften Vorgaben; `.agents/skills/` enthält die
aufgabenspezifischen Abläufe: `$lumen-birds-development` und
`$lumen-birds-release`. Die Entwurfserstellung nutzt die dokumentierten Optionen
von [`gh release create`](https://cli.github.com/manual/gh_release_create).
