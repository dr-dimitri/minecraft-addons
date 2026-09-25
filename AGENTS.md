# Projektvorgaben für minecraft-addons

Dieses eigenständige Repository enthält das Bedrock-Add-on **Lumen · Stumme
Himmelsvögel**. Das optionale Grafikprojekt `minecraft-look` wird separat
entwickelt und versioniert; für Build, Test und Release ist dessen Checkout
nicht erforderlich.

## Quellen und Änderungen

- Controllerquellen liegen in `src/`; `scripts/generate.py` erzeugt Modelle,
  Paletten, Animationen, Entitäten und Manifeste. `behavior_pack/`,
  `resource_pack/` und `docs/PREVIEW.svg` sind generierte, mitzuversionierende
  Ausgaben. Änderungen an den Quellen vornehmen und neu erzeugen.
- `scripts/build.py` ruft Generator und Preview selbst auf und überschreibt beide
  Packordner. Vorher Git-Status prüfen. Unbekannte Änderungen dort zuerst in einer
  vollständigen temporären Kopie einschließlich unversionierter Dateien vergleichen.
  Keine Nutzerarbeit durch Regeneration verwerfen.
- `dist/` bleibt Buildausgabe und wird nicht eingecheckt. Das Source-ZIP sammelt
  Dateien rekursiv. Releasebuilds nur aus einem sauberen, geprüften Checkout ohne
  private Dateien, virtuelle Umgebungen oder lokale Logs erstellen.
- `VERSION` in `scripts/generate.py` und `version` in `package.json` synchron
  halten. Ressourcen-/Verhaltenspaket, Module und interne Packabhängigkeiten
  tragen dieselbe Produktversion. Header- und Modul-UUIDs erhalten.
- Die aktuelle stabile API-Abhängigkeit ist `@minecraft/server` 2.0.0. API und
  technische Mindestversion nur bei begründetem Bedarf ändern und dann gegen
  offizielle Dokumentation/Typen prüfen. Nicht an eine Grafikpaketversion koppeln.
- Bestehendes Verhalten erhalten, sofern der Auftrag es nicht gezielt ändert:
  stumme dekorative Vögel, keine Blockänderungen, keine Commands, keine absichtlich
  geladenen Chunks, Tag/Overworld, höchstens 18 geladene Vögel sowie Aufräumen bei
  Nacht, Dimensionswechsel und Wiederladen. Nativen Despawn als Rückfallebene erhalten.
- Fremde Assets benötigen nachvollziehbare Herkunft und Rechtehinweise. Die
  bestehenden Modelle und Paletten sind eigene Projektinhalte; `NOTICE.md` und
  `LICENSE` bei geänderter Herkunft entsprechend pflegen.

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

Projektlokale Skills unter `.agents/skills/`:

- `lumen-birds-development`: Vogelcontroller, Modelle und Add-on-Pakete ändern.
- `lumen-birds-release`: Releasekandidaten prüfen, versionieren und veröffentlichen.

## Code Review Rules

Als Fehler behandeln: ausschließlich generierte Dateien geändert; rotierte
Bestands-UUIDs; inkonsistente Produktversionen; unaufgelöste Ressourcenverweise;
unbegründete Änderungen an Vanilla-Verhalten; unbelegte In-Game- oder
Performancebehauptungen; Upload alter oder ungeprüfter Artefakte; automatische
öffentliche Freigabe vor der Abnahme; lokale Abhängigkeiten vom Grafikrepository.
