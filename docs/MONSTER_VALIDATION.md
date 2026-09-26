# Tiefenmaul mit Geburtstagshut prüfen

Status: Entwicklungsstand, keine Bedrock-Abnahme. Automatisierte Tests prüfen
Code, Modellhülle und Paketverweise; sie führen Minecraft nicht aus.

Diese Liste beschreibt die normale Unterwasserbegegnung. Die separate
[Abenteuerwelt](ADVENTURE_WORLD.md) enthält zusätzlich die vergrößerte
Dorfszene und dauerhafte Bauchbereiche mit verschluckten Häusern. Dort gelten
die eigene Dorf-Prüfliste, mehrere gleichzeitige Besucher und drei Minuten
Aufenthalt vor der automatischen Rettung.

## Testaufbau

- Aktuellen lokalen Entwicklungsbuild in eine neue Windows-/Bedrock-Testwelt
  0.2.0 importieren; BP und RP aktivieren. Der historische Kandidat 0.1.1 enthält
  das Tiefenmaul nicht. Die Paket-UUIDs bleiben beim Update erhalten.
- Bedrock-Version, Quellcommit/Diff, SHA-256 des Builds, Plattform und Grafikmodus
  notieren. Das Add-on verwendet weiterhin die stabile Server-API 2.0.0.
- Tiefes offenes Wasser mit mindestens ungefähr 29 × 29 × 17 freien Wasserblöcken
  suchen. Am Wasserspiegel oder unter Wasser höchstens fünf Sekunden warten.
  Die Suche ist begrenzt und prüft keine komplette Welt oder Biomenamen.

## Darstellung und Begegnung

- [ ] Etwa 16 Blöcke langer eigener Körper; riesiges offenes Maul, weiße gestufte Zähne, gegliederte Flossen,
      bewegter Schwanz und Unterkiefer. Geformte Wangen/Augenhöhlen, Hautplatten,
      Kiemen und Bauchfalten sind sichtbar. Der Geburtstagshut sitzt auf dem Kopf,
      ist rosa-gold gestreift und hat eine Spitze mit Bommel. Die Zähne bleiben weiß
      und verwenden nicht die goldene Hutfarbe.
- [ ] Cyanfarbene Augen leuchten, ohne die Umgebung zu beleuchten. Keine eigenen
      Tiergeräusche. Keine Modellteile verschwinden bei Blickwinkelwechsel.
- [ ] Körper, alle Animationen und Hut bleiben bei jeder Blickrichtung im Wasser.
      Flaches Wasser, enge Becken, Lava, Wasserpflanzen, feste wassergefüllte
      Blöcke und ungeladene Bereiche verhindern den Spawn.
- [ ] Survival und Adventure: Direkt in die Maulöffnung schwimmen. Man landet
      im Bauch und schaut zum Maul. Das Monster hält an. Die Innenansicht zeigt
      einen offenen Weg; keine undurchsichtige Fläche versperrt das Bild. Auch seitlich
      und aufrecht schwimmend dürfen Zähne oder Kiefer den Körper nicht schneiden.
- [ ] Vorwärts durch das Maul schwimmen: Rettung an die freie Wasseroberfläche,
      Monster verschwindet, eine Minute kein erneutes Verschlucken.
- [ ] Schleichen löst den Notausgang aus. Ohne Bewegung erfolgt nach 20 Sekunden
      automatisch die Rettung. Inventar, Gesundheit und Spielmodus bleiben erhalten.
- [ ] Während des Aufenthalts sinkt die Luft nicht gefährlich ab; keine Schäden
      durch Ertrinken oder normale Schadensquellen. Vorhandene schwächere Resistenz
      wird danach mit verbleibender Zeit wiederhergestellt; stärkere bleibt erhalten.
      Kurzfristiger Zusatzschutz läuft nach dem Verlassen aus.
- [ ] Creative und Spectator werden nicht verschluckt. Im Mehrspielerbetrieb ist
      höchstens ein Spieler gleichzeitig im Bauch; andere Spieler bleiben frei.

## Fehler, Wiederladen und Leistung

- [ ] Im Bauch speichern/verlassen und neu verbinden: Rückkehr ohne Festsetzen.
- [ ] Als Passagier abmelden und wieder verbinden; dasselbe mit zwei Spielern testen.
- [ ] Wasser neben dem Monster entfernen oder blockieren: Monster verschwindet,
      Passagier wird gerettet. Bei blockierter Oberfläche wird ein anderer freier
      Punkt oder die weiterhin sichere Einstiegsposition benutzt.
- [ ] Wenn eine Rettung zunächst scheitert, bleibt der Schutz aktiv und die Rettung
      wird wiederholt. Kein Teleport in feste Blöcke oder ungeladene Bereiche.
- [ ] Ein externer Dimensionswechsel wird respektiert; kein Zurückziehen ins Meer.
- [ ] Paket deaktivieren: Nach Verschwinden der rein visuellen Hülle kann der Spieler
      frei schwimmen; kurzzeitige Effekte laufen aus. Vorher bevorzugt Notausgang nutzen.
- [ ] Nach mehrfachen Begegnungen/Wiederladen höchstens ein geladenes Tiefenmaul;
      weiterhin höchstens 18 Vögel und zwölf Fische. Keine Vanilla-Tiere entfernt.
- [ ] Content-Log auf Skript-, Entity-, Material- und Molang-Fehler prüfen.
- [ ] FPS und Tickverhalten mit/ohne Monster messen. Die große Wasserhülle wird alle
      fünf Ticks geprüft; Suchläufe sind auf 26.000 Blockabfragen pro Spieler begrenzt.
      Insbesondere mehrere weit entfernte Spieler und blockierte Becken prüfen.

## Verwendete Schnittstellen

Neue Aufrufe gegen die lokal vorhandenen offiziellen Typen von
`@minecraft/server@2.0.0` abgeglichen: `getEffect`, `addEffect`, `removeEffect`,
`getDynamicProperty`, `setDynamicProperty`, `getRotation`, `getGameMode`,
`isSneaking`, `getAbsoluteTime` und `onScreenDisplay.setActionBar`.
Für Dorfangriffe zusätzlich `setProperty`, `triggerEvent`, `Block.setPermutation`,
`BlockPermutation.getAllStates` und Container-Prüfungen gegen dieselben Typen
geprüft. Client-synchronisierte Entitätseigenschaften steuern Größe und Kiefer;
die Fress-Komponentengruppe ersetzt den normalen Timer durch 180 Sekunden.

- [Entity: Effekte, dynamische Daten und Teleports](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable)
- [Effektoptionen](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityeffectoptions?view=minecraft-bedrock-stable)
- [Player](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player?view=minecraft-bedrock-stable)
- [Entitätseigenschaften und Client-Synchronisierung](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable)
- [Komponentengruppen und ersetzte Timer](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/eventactions/add_component_group?view=minecraft-bedrock-stable)

Diese Prüfung ist keine Freigabe. Die Checkliste erst nach tatsächlicher Ausführung
abhaken und Belege an den getesteten Build binden.
