---
name: lumen-birds-development
description: Das Lumen-Add-on Stumme Himmelsvögel entwickeln oder korrigieren, einschließlich Flugcontroller, Entitäten, Modelle, Animationen und Bedrock-Paketprüfung.
---

# Stumme Himmelsvögel entwickeln

`AGENTS.md` im Repo-Root lesen. Controller in `src/`
bearbeiten; Geometrien, Paletten, Animationen, Entitäten und Manifeste werden in
`scripts/generate.py` gepflegt. `behavior_pack/`, `resource_pack/` und
`docs/PREVIEW.svg` sind generierte Ausgaben.

## Umsetzung und Grenzen

- Vor einem Build den Arbeitsbaum prüfen: `build.py` regeneriert beide Packs
  und die Vorschau und löscht dabei Packordner. Unbekannte direkte Änderungen
  zuerst in einer vollständigen temporären Kopie vergleichen.
- Bei Controlleränderungen den relevanten Lebenszyklus in `src/manager.js`,
  `src/flight.js` und der API-Anbindung `src/main.js` nachvollziehen. Fehlerpfade
  wie Spawn-/Teleportfehler und nachträglich wieder geladene Entitäten erhalten.
- Bestehende Begrenzung auf geladene Entitäten, Tag/Overworld, stumme Darstellung
  und nativen Despawn bewahren, sofern der Auftrag das Verhalten nicht gezielt
  ändert. Änderungen solcher Grenzen samt Tests und README ausdrücklich erklären.
- Bei Verwendung neuer Bedrock-API-Aufrufe offizielle Dokumentation und passende
  `@minecraft/server`-Typen prüfen. Mocks können ungültige Engine-Aufrufe nicht
  ausschließen. Die aktuelle stabile API 2.0.0 nicht grundlos anheben.

## Prüfen

Vom Repository-Root aus:

```sh
python3 scripts/generate.py
npm test
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```

Kein `npm install` nötig. JS-Verhaltenstests als `tests/*.test.js` ergänzen;
Python prüft die Paket-/Ressourcenebene. Beide Testebenen bei Codeänderungen
ausführen. Die Vorschau bei Modelländerungen ansehen, ohne sie als Beleg für
Molang, Bedrock-Interpolation oder Audio auszugeben.

Nutzerrelevante Änderungen in `CHANGELOG.md` unter `Unreleased` erfassen.
Releasevorbereitung mit `$lumen-birds-release` erfolgt nach `docs/RELEASING.md` im Repo-Root: eigene
Birds-Version, synchrones `package.json`, unveränderte BP-/RP-/Modul-UUIDs und
passende Manifestabhängigkeiten. Das optionale Grafikprojekt `minecraft-look` wird unabhängig entwickelt
und ist für Build oder Test nicht erforderlich. Offene Windows-Checks aus `docs/VALIDATION.md` berichten.
