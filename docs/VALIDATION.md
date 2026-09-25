# Prüfstand · 0.1.0

Datum: 25.09.2026. Reviewart: **Selbstreview**, keine unabhängige Freigabe. Plattform: macOS, Node 26.8.1, Python 3.14.

## Lokale Prüfung

- 15 Node-Tests mit einer simulierten World-/Dimension-/Entity-Schnittstelle: Tag/Nacht, Artenzahl, Abstände der Raben, Bewegungsrichtung, kleine Bewegungsschritte, Höhlen/Dächer/Höhenlimit, ungeladene Chunks, Mehrspieler-Limit, Gruppenwechsel, Lebensdauer, Dimensionswechsel, Abmelden, Script-Neustart, fehlschlagende Spawns/Teleports und spätere Erholung nach API-Fehlern.
- 9 Python-Tests: gültiges Paket, fehlende Textur, falscher Modellverweis, fehlender Script-Einstieg, notwendige Summonability, nativer Despawn-Timer, unerlaubte Sound-Ereignisse, beschädigte PNG-Daten sowie reproduzierbare verschachtelte Paketarchive.
- Statische Prüfung aller 21 JSON-Dateien: Manifest-Abhängigkeiten, UUIDs, Script-Imports, Übereinstimmung von Client-/Server-IDs, Modelle, Knochenhierarchie, Animationsreferenzen, UV-Grenzen und PNG-Prüfsummen.
- Verwendete Spiel-API-Signaturen mit dem offiziellen `@minecraft/server@2.0.0`-Paket abgeglichen, insbesondere `heightRange`, `getTopmostBlock`, `spawnEntity`, `tryTeleport` und `TeleportOptions`. Keine Beta-API erforderlich.
- Statische SVG-Vorschau aus den tatsächlichen Modellkoordinaten im Browser angesehen. Sie bestätigt nur Modellaufbau, Farbzuordnung und Silhouette in der separaten Vorschau.

Beim Selbstreview korrigiert: Die Entitäten müssen für `spawnEntity` summonable sein. Die beiden Raben erhalten deutlich getrennte Phasen statt fast gleicher Hash-Phasen. Nach einem fehlgeschlagenen Spawn wird die tatsächliche Entitätszahl neu gezählt, damit auch ein fehlgeschlagenes Aufräumen das Limit nicht umgeht. Kein Ausblenden anhand der clientseitigen Lebenszeit am Ende, weil diese bei erneutem Sichtkontakt neu beginnen kann.

Die nativen Entitätskomponenten und Molang-Ausdrücke wurden anhand der offiziellen Formate erstellt und auf Verweise geprüft. Diese Tests führen **weder die Bedrock-Engine noch ihren JSON-/Molang-Parser** aus. Sie sind kein Nachweis für fehlerfreien Import, korrektes Rendering, Geräuschfreiheit des gesamten Spiels oder eine bestimmte Bildrate.

## Noch auf Windows prüfen

Für neue Kandidaten diese Schritte erneut ausführen und einen eigenen Beleg nach
[releases/TEMPLATE.md](releases/TEMPLATE.md) anlegen. Die obigen Ergebnisse
gelten ausschließlich für den historischen Stand 0.1.0.

Für den aktuellen Entwicklungsstand zusätzlich [Eulen und Uhus prüfen](OWL_VALIDATION.md)
verwenden. Dessen Tag-/Nachtprüfung ersetzt den damaligen Schritt 4: Abends
verschwinden nur die Tagvögel; auf geeigneten Baumkronen übernehmen Eulen und Uhus.

1. `.mcaddon` importieren. Beide Vogelpakete in einer Testwelt zunächst ohne zusätzliches Grafikpaket aktivieren. Im Content-Log dürfen keine Fehler zu `lumen_birds`, Geometrie, Texturen, Script-Modulen oder Molang auftreten.
2. Tagsüber auf einer offenen Ebene warten. Zwei Raben, drei verschiedenfarbige kleine Vögel und ein höherer Adler sollen erscheinen. Flügel dürfen nicht vom Körper abreißen; Flugrichtung und Kopf müssen zusammenpassen. Auf Ruckeln durch Teleport-Interpolation achten.
3. Mindestens drei Minuten stehen bleiben und anschließend eine längere Strecke laufen. Gruppen müssen ausgetauscht werden, ohne dass sich immer mehr Vögel ansammeln. Ein sichtbarer Wechsel nach 45 Sekunden ist möglich und wird noch nicht vollständig ausgeblendet.
4. Tag, Abend, Nacht und Morgen beobachten. Ab Tageszeit 11500 müssen aktive Vögel verschwinden; ab 500 dürfen wieder Gruppen entstehen. Ein vorhandener Tageszyklus oder eine separate Testwelt mit Zeitbefehlen genügt.
5. Nah an einen Vogel herangehen und mindestens eine Minute zuhören. Kein Krächzen, Zwitschern oder Flügelsound. Vanilla-Papageien und andere Spielgeräusche dürfen unverändert hörbar sein.
6. Dächer, Höhle, hohe Berge, Waldkronen und schnell entladende Chunks prüfen. Keine Vögel sollen in Blöcken stecken bleiben. Netzunabhängigkeit und Wiederbetreten nach Speichern/Laden prüfen.
7. Nether/Ende betreten und zurückkehren. Alte Gruppen sollen entfernt werden; in den beiden anderen Dimensionen darf keine Gruppe entstehen. Falls Mehrspieler genutzt wird, nahe und weit entfernte Spieler sowie deren Abmelden testen.
8. Das gleiche Gebiet mit unveränderten Grafikeinstellungen jeweils mit und ohne Vogelpaket messen. Bedrock-Version, Auflösung, Hardware, Treiber, Grafikprofil und aktivierte Pakete dokumentieren; Durchschnitts-FPS und besonders ruckelige Momente notieren. Bei zugesicherter Kompatibilität zusätzliche Grafikpakete gesondert prüfen. Das bisherige Messziel WQHD, RX 9060 XT 16 GB und rund 80 FPS bleibt unbestätigt. Lumen Quality/Balanced aus `minecraft-look` ist eine optionale Testkombination.

## Bekannte Grenzen des damaligen Prüfstands 0.1.0

- Wetter und Biome wählen noch keine anderen Arten. Alle fünf Arten erscheinen in jeder geeigneten offenen Overworld-Umgebung.
- Die Vögel sind stilisierte Minecraft-Modelle mit flachen Palettenfarben, keine fotorealistischen Tiere.
- Die Geländeprüfung ist stichprobenartig. Eine blockierte Zielposition kann einen Vogel vorzeitig entfernen. Der Kopf/Körper wird kollisionsgeprüft, nicht die gesamte sichtbare Flügelspannweite.
- 18 ist das Controller-Limit für geladene Entitäten. Entladene alte Vögel werden erst beim Laden bereinigt. Der native 60-Sekunden-Timer läuft nur während Simulation.
- Die Gruppenverteilung bevorzugt bei mehr als drei weit getrennten Spielern die nach ID zuerst berücksichtigten Standorte. Für den vorgesehenen Einzelspielerbetrieb hat das keine Auswirkung.
- Import, Rendering, Script-Laufzeitkosten, tatsächliche Audioausgabe und FPS wurden noch nicht mit Bedrock gemessen.
