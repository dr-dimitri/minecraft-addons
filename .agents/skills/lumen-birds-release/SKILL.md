---
name: lumen-birds-release
description: Releases oder Hotfixes des eigenständigen Add-ons Stumme Himmelsvögel vorbereiten, auf Freigabereife prüfen und im autorisierten Umfang veröffentlichen. Umfasst Versionen, Birds-Tags, CI-Artefakte und Bedrock-Abnahme.
---

# Birds-Release durchführen

`AGENTS.md` und `docs/RELEASING.md` im Repo-Root lesen. Das dortige Verfahren
ist die Quelle für Versionsregeln, Befehle, Abnahme und Hotfixes.
Beabsichtigten Schritt aus dem Auftrag ableiten: Änderung prüfen,
Kandidat vorbereiten oder veröffentlichen. Nur bei materiell fehlenden Angaben
nachfragen; unabhängige lokale Vorbereitungen fortsetzen.

## Kandidat vorbereiten

1. Git-Status, Quellversion, vorhandene Tags und Changelog prüfen.
   Unversionierte Dateien sind kein sauberer Releasecommit. Keine Nutzerdateien
   durch Reset, Clean oder die überschreibenden Generatoren verwerfen.
2. Die Add-on-Version mit Tag `birds-vX.Y.Z` vorbereiten. Versionsquelle,
   `package.json`, generierte Manifeste und sichtbare Angaben
   synchronisieren; UUIDs und veröffentlichte Tags erhalten. Inhalte aus
   `Unreleased` in den konkreten Kandidatenabschnitt übernehmen.
3. Automatische Gates aus dem Releaseleitfaden ausführen. Für einen Kandidaten
   Python- und JS-Tests prüfen und Quell-/Ausgabedrift
   ausschließen. `python3 scripts/check_release.py --tag TAG` muss bestehen.
4. Vollständigen Wiederholungsbuild, Source-ZIP-Inhalt/-Wiederaufbau und
   Prüfsummen verifizieren. Wegen rekursiver Source-Packer einen sauberen
   Checkout verwenden. Nie alten lokalen `dist/*`-Bestand pauschal hochladen.
5. Konkrete Releasehinweise und den Abnahmebeleg nach
   `docs/releases/TEMPLATE.md` vorbereiten. Fehlende Engine-Tests als offen
   kennzeichnen; keine Freigabe aus den historischen Prüfberichten ableiten.

## Entwurf und Freigabe

Im autorisierten Umfang Tag und Entwurf erstellen. Der Tag-Workflow baut und
prüft das Add-on, übernimmt dessen geprüfte CI-Artefakte und legt
nur einen GitHub-Entwurf an. Workflowstatus und tatsächlich angehängte Dateien
prüfen. Bestehende Autorisierung gilt weiter; dieser Skill verlangt keine
zusätzliche Bestätigung für bereits beauftragte Schritte.

Für stabile Veröffentlichung echte Windows-/Bedrock-Abnahme mit Commit und
Artefakt-Hashes nachweisen. Ohne sie den Entwurf fertig vorbereiten und die
konkret fehlenden Nachweise nennen. Eine ausdrücklich gewünschte öffentliche
Testversion darf offene Prüfungen enthalten, muss sie sichtbar benennen und
als Pre-release markiert sein. Eine Vorbereitung allein autorisiert kein
öffentliches Release. Bei reiner Vorbereitung lokal stoppen, sofern Tag-Push
oder ein entfernter Entwurf nicht ebenfalls beauftragt sind.

Vor einer externen Mutation den bestehenden Tag-/Releasestatus lesen. Nach
unklarem Uploadausgang einmal den Zustand und vorhandene Hashes prüfen, dann
nur belegbar fehlende Dateien ergänzen. Keine blinden Wiederholungen, kein
`--clobber`, kein Ersetzen veröffentlichter Dateien. Bei widersprüchlichen
Artefakten den Upload stoppen und die Abweichung konkret berichten.

Nach Veröffentlichung Dateien herunterladen und Hashes sowie Status prüfen.
Bei Fehlern neue Patchversion und dokumentierten Update-/Wiederherstellungsweg
vorbereiten, nicht den alten Tag verschieben. Ergebnis nennt Produkt/Version,
Commit/Tag, durchgeführte Tests, Abnahmebeleg, Artefakte und erreichten Status
(lokaler Kandidat, Entwurf, Testversion oder stabile Veröffentlichung).
