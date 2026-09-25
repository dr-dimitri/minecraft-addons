# minecraft-addons · Lumen Stumme Himmelsvögel

Optionales Vogel-Add-on für Minecraft Bedrock unter Windows, **Testversion 0.1.1**. Es ergänzt Raben, Blaumeisen, Rotkehlchen, Stieglitze und einen kreisenden Steinadler. Die Vögel sind dekorativ und erhalten keine Geräusche. Das Add-on funktioniert eigenständig. Das optionale Lumen-Grafikpaket wird im separaten Repository [minecraft-look](https://github.com/dr-dimitri/minecraft-look) entwickelt; eine gemeinsame Nutzung ist vorbereitet und muss im Spiel noch geprüft werden.

**Lokal geprüft, noch nicht in Minecraft ausgeführt.** Auf diesem Mac stehen Minecraft für Windows und die RX 9060 XT nicht zur Verfügung. Import, Animationen, Geräuschfreiheit im Spiel und Bildrate sind daher noch auf dem Ziel-PC zu prüfen. Die Modelle sind bewusst im kantigen Minecraft-Stil gestaltet; es sind keine fotorealistischen Tiermodelle.

![Originale Modellgeometrie, außerhalb von Minecraft gerendert](docs/PREVIEW.svg)

## Installation in Minecraft Bedrock unter Windows

**Der Ablauf: Installationsdatei besorgen → in Minecraft öffnen → beide Pakete in einer Welt aktivieren.** Der Import allein schaltet die Vögel noch nicht ein.

### 1. Das brauchst du

- **Minecraft für Windows (Bedrock Edition)**. Im Minecraft Launcher wählst du „Minecraft für Windows“. Diese Erweiterung lässt sich nicht in der Java Edition verwenden.
- Laut Paketmanifest mindestens **Bedrock 1.21.90**. Die Mindestversion ist eine technische Voraussetzung; sie bedeutet nicht, dass jede neuere Version bereits mit diesem Add-on getestet wurde.
- Die Datei **`Lumen-Silent-Birds-0.1.1.mcaddon`**. Sie enthält alles, was Minecraft für die Erweiterung benötigt.

Für die Installation einer fertigen Datei brauchst du weder Python noch Node.js. Cheats und experimentelle Funktionen sind für dieses Add-on nicht erforderlich. Auch das separate Lumen-Grafikpaket wird nicht benötigt.

Die folgende Anleitung ist für Windows geschrieben. Für Handys, Konsolen und Realms gibt es in diesem Projekt noch keine geprüfte Installationsanleitung.

### 2. Die richtige Datei besorgen

Wenn dir die `.mcaddon`-Datei bereits vorliegt, speichere sie auf deinem Windows-PC, zum Beispiel im Ordner **Downloads**, und fahre mit Schritt 3 fort.

Andernfalls gibt es diese Möglichkeiten:

- **Veröffentlichte Version:** Öffne die [Releases dieses Projekts](https://github.com/dr-dimitri/minecraft-addons/releases). Falls dort eine Version mit Installationsdatei verfügbar ist, lade unter **Assets** die Datei mit der Endung **`.mcaddon`** herunter. Beachte die Hinweise zur jeweiligen Version. Ein Release-Entwurf ist noch keine öffentliche Veröffentlichung.
- **Testbuild aus GitHub Actions:** Öffne [Check and package birds](https://github.com/dr-dimitri/minecraft-addons/actions/workflows/build.yml), wähle einen erfolgreichen Lauf für den gewünschten Stand und lade unter **Artifacts** das Archiv **`lumen-silent-birds`** herunter. Dafür musst du bei GitHub angemeldet sein und Zugriff auf das Repository haben. Entpacke dieses heruntergeladene ZIP und verwende daraus die `.mcaddon`-Datei. Ein erfolgreicher Build ersetzt keinen Test in Minecraft.
- **Selbst bauen:** Folge dem Abschnitt [Selbst bauen](#selbst-bauen). Danach findest du die Installationsdatei im Unterordner `dist/`.

**Achte auf die Dateiendung:** `Source-…zip`, „Source code (zip)“ und GitHubs „Code → Download ZIP“ enthalten Quellcode. Diese Archive kannst du nicht direkt in Minecraft installieren oder einfach in `.mcaddon` umbenennen. Der Ordner `dist/` wird beim Bauen angelegt und ist nicht im Git-Repository enthalten.

### 3. In Minecraft importieren

1. Starte **Minecraft für Windows** und bleibe im Hauptmenü.
2. Öffne im Windows-Explorer den Ordner mit `Lumen-Silent-Birds-0.1.1.mcaddon`.
3. Öffne die Datei per **Doppelklick**. Falls Windows nach einer Anwendung fragt, wähle **Minecraft**. Alternativ verwende **Rechtsklick → Öffnen mit → Minecraft**, sofern angeboten.
4. Warte, bis Minecraft den erfolgreichen Import meldet. Die Datei enthält zwei Pakete: ein **Verhaltenspaket** für den Flug und ein **Ressourcenpaket** für das Aussehen der Vögel.

Die `.mcaddon`-Datei selbst musst du nicht entpacken. Nach dem Import stehen die Pakete in den Welteinstellungen zur Auswahl. Das Öffnen von Add-on-Dateien und die Zuordnung zu diesen beiden Paketbereichen beschreibt auch die [offizielle Installationshilfe](https://learn.microsoft.com/de-de/minecraft/creator/documents/addonpackinstallation).

### 4. Beide Pakete in einer Welt aktivieren

Verwende für diese Testversion zunächst **eine neue Testwelt**. Wenn du eine vorhandene Welt nutzen möchtest, erstelle vorher eine Sicherung oder eine Weltkopie.

1. Wähle in Minecraft **Spielen**.
2. Erstelle eine neue Welt und öffne deren Einstellungen. Bei einer vorhandenen Welt öffnest du die Einstellungen über das **Stiftsymbol** neben dem Weltnamen.
3. Öffne **Verhaltenspakete → Meine Pakete** beziehungsweise **Verfügbar**.
4. Wähle **„Lumen · Stumme Himmelsvögel“** und klicke auf **Aktivieren**.
5. Öffne anschließend **Ressourcenpakete → Aktiv**. Prüfe, ob das zugehörige Lumen-Vogelpaket dort ebenfalls aufgeführt ist. Falls es noch fehlt, wähle es unter **Meine Pakete** beziehungsweise **Verfügbar** aus und aktiviere es.
6. Starte die Welt. Für den ersten Test sollten nur die beiden Vogelpakete als zusätzliche Pakete aktiv sein.

**Beide Pakete müssen in derselben Welt aktiv sein.** Das Ressourcenpaket liefert Modelle und Texturen; das Verhaltenspaket erzeugt und bewegt die Vögel. Die Aktivierung gilt für die jeweilige Welt. Die Bezeichnungen der Menüs können je nach Minecraft-Version etwas abweichen.

### 5. Die Vögel finden

Gehe **tagsüber in der Oberwelt** auf eine freie Fläche und schaue nach oben. Über dir sollte genügend freier Himmel sein; vermeide zunächst Dächer, dichte Baumkronen und Felsüberhänge. Nach ungefähr fünf Sekunden sollte eine Gruppe auftauchen. Direkt bei Sonnenaufgang oder kurz vor Sonnenuntergang ist der Controller noch beziehungsweise schon inaktiv.

Eine vollständige Gruppe enthält **zwei Raben, eine Blaumeise, ein Rotkehlchen, einen Stieglitz und einen Steinadler**. Der Adler fliegt höher als die übrigen Vögel. Sie kreisen über einem festen Bereich und folgen dir nicht. Du musst keine Gegenstände herstellen und keine Befehle eingeben.

Bei Nacht sowie im Nether und im Ende erscheinen keine neuen Gruppen. Dass die Vögel keine eigenen Geräusche machen, ist beabsichtigt.

## Wenn etwas nicht funktioniert

| Problem | Das kannst du prüfen |
|---|---|
| Beim Doppelklick öffnet sich ein Archivprogramm. | Verwende „Öffnen mit → Minecraft“. Prüfe, ob die Datei tatsächlich auf `.mcaddon` endet und Minecraft für Windows installiert ist. |
| Du hast nur ein ZIP heruntergeladen. | Ein Actions-Artefakt zuerst entpacken und die enthaltene `.mcaddon` öffnen. Ein Quellcode-ZIP dagegen muss erst gebaut werden. |
| Minecraft meldet einen fehlgeschlagenen Import. | Notiere die genaue Fehlermeldung. Prüfe Minecraft-Version und Dateiname und lade die vollständige Installationsdatei erneut herunter. |
| Das Paket fehlt in den Welteinstellungen. | Prüfe, ob der Import erfolgreich war und ob du Minecraft für Windows verwendest. Verlasse die Welteinstellungen und öffne sie erneut. |
| Das Paket ist importiert, aber es erscheinen keine Vögel. | Kontrolliere beide Pakete unter „Aktiv“ in dieser Welt. Teste tagsüber auf einer freien Fläche in der Oberwelt und warte einige Sekunden. |
| Vögel fehlen teilweise oder verschwinden wieder. | Gruppen werden regelmäßig ersetzt. Hindernisse oder nicht geladene Bereiche können einzelne Vögel verhindern. Pro Controller sind höchstens 18 geladene Vögel vorgesehen. |
| Modelle, Texturen oder Bewegungen sehen falsch aus. | Prüfe das Ressourcenpaket und teste in einer neuen Welt nur mit den beiden Vogelpaketen. Die Darstellung im Spiel ist für diese Testversion noch nicht abgenommen. |

Wenn der Fehler bleibt, halte **Minecraft-Version, Add-on-Version, Fehlermeldung und die anderen aktiven Pakete** fest. Die ausführliche Prüfanleitung steht in [VALIDATION.md](docs/VALIDATION.md).

## Ausschalten und später aktualisieren

**Ausschalten:** Verlasse die Welt, öffne ihre Einstellungen und deaktiviere zuerst das Vogel-Verhaltenspaket und anschließend das zugehörige Ressourcenpaket. Es gibt keinen eigenen Vogelregler im Grafikstil-Menü.

**Aktualisieren:** Sichere deine Welt, lies die Hinweise der neuen Version und importiere deren `.mcaddon`-Datei. Prüfe anschließend beide aktiven Pakete und teste zuerst mit einer Weltkopie. Ein Updatepfad im Spiel ist noch nicht abgenommen.

## Was am Himmel passiert

| Vogel | Aussehen und Flug |
|---|---|
| Zwei Raben | Dunkle blau-schwarze Federn, kräftiger Schnabel, Flügelschläge im Wechsel mit kurzen Gleitphasen. |
| Blaumeise | Blaue Flügel, gelbe Brust und heller Kopfstreifen; schnelle Flügelschläge. |
| Rotkehlchen | Orangefarbene Brust und braunes Gefieder; kleiner, lebhafter Flug. |
| Stieglitz | Roter Kopf und gelbe Flügelzeichnung; schnelle Flügelschläge. |
| Ein Steinadler | Braunes Gefieder, goldener Kopf, breite Schwingen mit einzelnen Federspitzen; weite Kreise über den kleineren Vögeln. |

Eine Gruppe besteht aus sechs Vögeln. Nahe Spieler teilen sich eine Gruppe; höchstens drei Gruppen bzw. **18 gleichzeitig geladene Vögel** werden durch den Controller erzeugt. Vögel entstehen nur tagsüber in der Oberwelt, zwischen Tageszeit-Tick 500 und 11500. Bei Nacht werden aktive Vögel entfernt; Nether und Ende erhalten keine Schwärme. Bei mehr als drei weit getrennten Spielern wechselt die Vergabe freier Gruppen, damit nicht dauerhaft dieselben Spieler leer ausgehen. Regen wird in dieser Version noch nicht gesondert berücksichtigt.

Die Flugbahnen bleiben an einem festen Ort in der Landschaft. Die Vögel verfolgen den Spieler nicht. Bei Ortswechsel, Dimensionswechsel oder Verlassen der Welt wird aufgeräumt. Eine Gruppe lebt höchstens 45 Sekunden und kann danach ersetzt werden. Es kann dadurch einen sichtbaren Wechsel geben. Felsüberhänge, Gebäude oder nicht geladene Bereiche können dazu führen, dass weniger Vögel erscheinen oder ein Vogel vorzeitig verschwindet.

Die Vögel haben keine Angriffe, Zähmung, Beute, Erfahrungspunkte oder Fortpflanzung. Sie verändern keine Blöcke. Es sind zusätzliche Entitäten, deshalb ist das Add-on mehr als eine reine Shader-Einstellung. Eigene Geräuschdateien, Sound-Ereignisse und geerbte Papageien-Geräusche sind nicht enthalten; andere Minecraft-Geräusche werden nicht stummgeschaltet.

## Leistung und technische Grenzen

Die Modelle bestehen aus wenigen Quadern und verwenden je eine 64 × 16 Pixel große Farbpalette. Die Flügel bewegen sich durch clientseitige Molang-Animationen. Ein Skript setzt Flugposition und Blickrichtung mit kleinen `tryTeleport`-Schritten pro Spieltick. Ob der Bedrock-Client diese Schritte ausreichend flüssig darstellt, ist Teil der noch offenen Sichtprüfung.

Alle fünf Sekunden prüft der Controller Spielernähe, freie Bereiche und verwaiste Vögel. Er erzeugt keine Ticking Areas und lädt keine Chunks absichtlich nach. Zusätzlich entfernt ein nativer 60-Sekunden-Timer Vögel, wenn das Skript ausfällt. Dieser Timer zählt nur, während die Entität simuliert wird. Entitäten in entladenen Chunks sind weder vollständig zählbar noch sofort entfernbar; nach dem Laden werden sie vom Controller entfernt. Das Limit von 18 bezieht sich deshalb auf geladene Entitäten.

Das Ziel von ungefähr 80 FPS bei WQHD auf der RX 9060 XT 16 GB bleibt ein **Messziel**, kein bestätigtes Ergebnis. Anleitung für die ausstehende Prüfung: [VALIDATION.md](docs/VALIDATION.md).

## Selbst bauen

Dieser Abschnitt ist nur nötig, wenn du keine fertige `.mcaddon`-Datei verwendest oder am Add-on entwickeln möchtest.

Du brauchst Python ab 3.10 und Node.js ab 20 für die Tests. Lade den Quellcode herunter und entpacke ihn, oder klone dieses Repository. Öffne dann ein Terminal im Projektordner, in dem `package.json` und die Ordner `scripts/` und `src/` liegen. Führe diese Befehle nacheinander aus; fahre nur fort, wenn der vorherige Schritt ohne Fehler beendet wurde. Keine zusätzlichen Bibliotheken, kein `npm install` und kein Netzwerk beim Build nötig.

Der Generator überschreibt `behavior_pack/` und `resource_pack/`. Wenn du dort selbst Dateien bearbeitet hast, sichere deine Änderungen vor dem Bauen.

```text
python scripts/generate.py
python scripts/preview.py
python scripts/check_release.py
npm test
python -m unittest discover -s tests -v
python scripts/build.py
```

Unter Windows kann `py -3` statt `python` verwendet werden, etwa `py -3 scripts/build.py`. Öffne nach erfolgreichem Build `dist/Lumen-Silent-Birds-0.1.1.mcaddon` wie in Schritt 3 beschrieben. Der Build erzeugt das `.mcaddon`, ein eigenständig nutzbares Quellcode-ZIP und SHA-256-Prüfsummen in `dist/`. Die Archive haben feste Zeitstempel und werden bei unverändertem Quellstand bytegleich gebaut.

`src/` enthält den Flugcontroller. `scripts/generate.py` pflegt Modelle, Farbpaletten, Flügelanimationen, Manifest und Entitätskomponenten. `behavior_pack/` und `resource_pack/` werden daraus erzeugt; direkte Änderungen dort werden beim Build ersetzt. `docs/PREVIEW.svg` wird aus derselben Modellgeometrie gerendert, mit vereinfachter Beleuchtung und einer festen Flügelpose. UUIDs bei Updates beibehalten und für einen neuen Releasekandidaten die Versionsnummer in Generator und `package.json` synchron erhöhen.

Die eigene Repository-CI prüft das Add-on unabhängig vom Grafikprojekt. Tags nach `birds-vX.Y.Z` erzeugen nach erfolgreicher Prüfung einen Release-Entwurf; die Windows-Abnahme bleibt ein eigener Schritt. Projektvorgaben: [AGENTS.md](AGENTS.md), Änderungen: [CHANGELOG.md](CHANGELOG.md), Releaseleitfaden: [RELEASING.md](docs/RELEASING.md). Das eigenständig baubare Source-ZIP enthält auch diese Dokumente, die Abnahmevorlage und die [Lizenz](LICENSE).

## Technische Quellen

- [Stabile Script API 2.0.0 in Bedrock 1.21.90](https://www.minecraft.net/it-it/article/minecraft-1-21-90-bedrock-changelog)
- [Pack-Manifest und Script-Abhängigkeiten](https://learn.microsoft.com/minecraft/creator/reference/content/addonsreference/packmanifest?view=minecraft-bedrock-stable)
- [Dimension: Entitäten und Geländeabfragen](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable), [Entity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable), [TeleportOptions](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/teleportoptions?view=minecraft-bedrock-stable)
- [Clientseitige Animationen](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationsoverview?view=minecraft-bedrock-stable)
- [Timer](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_timer?view=minecraft-bedrock-stable), [Instant Despawn](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_instant_despawn?view=minecraft-bedrock-stable), [Damage Sensor](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_damage_sensor?view=minecraft-bedrock-stable)
