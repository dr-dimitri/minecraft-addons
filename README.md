# minecraft-addons · Lumen Stumme Himmelsvögel

Optionales Tier-Add-on für Minecraft Bedrock unter Windows. Der aktuelle **Releasekandidat 0.2.1** enthält sieben Vogelarten sowie Forellen, Karpfen und unheimliche Hechte mit gelben Leuchtaugen. Diese Tiere sind dekorativ und stumm. Am Tag fliegen Raben, Blaumeisen, Rotkehlchen, Stieglitze und Steinadler; in Dämmerung und Nacht übernehmen Eulen und Uhus. Dazu kommen das **Tiefenmaul** mit Geburtstagshut und Bauch-Abenteuer sowie eine 100 Blöcke tiefe See. Die separate [Abenteuerwelt](docs/ADVENTURE_WORLD.md) ergänzt vier schwimmende Dörfer, Taucheranzüge, U-Boote und zwei gefährliche Mutantenfische. Verschluckte Dorfhäuser lassen sich im Bauch des Monsters erkunden. Das Add-on funktioniert eigenständig. Das optionale Lumen-Grafikpaket wird im separaten Repository [minecraft-look](https://github.com/dr-dimitri/minecraft-look) entwickelt; eine gemeinsame Nutzung muss im Spiel noch geprüft werden.

**Lokal geprüft, noch nicht in Minecraft ausgeführt.** Auf diesem Mac stehen Minecraft für Windows und die RX 9060 XT nicht zur Verfügung. Import, Animationen, Geräuschfreiheit im Spiel und Bildrate sind daher noch auf dem Ziel-PC zu prüfen. Die Modelle sind bewusst im kantigen Minecraft-Stil gestaltet; es sind keine fotorealistischen Tiermodelle.

Der **Releasekandidat 0.2.1** enthält alle hier beschriebenen Funktionen. Seine Windows-/Bedrock-Abnahme steht noch aus; automatische Tests ersetzen sie nicht. Der ältere Kandidat 0.1.1 und seine [historische Windows-Checkliste](docs/releases/0.1.1-windows-checklist.md) bleiben unverändert. Aktuelle Prüfungen stehen in [VALIDATION.md](docs/VALIDATION.md) und der [Anleitung zur Abenteuerwelt](docs/ADVENTURE_WORLD.md).

![Originale Modellgeometrie, außerhalb von Minecraft gerendert](docs/PREVIEW.svg)

## Installation in Minecraft Bedrock unter Windows

**Der Ablauf: Installationsdatei besorgen → in Minecraft öffnen → beide Pakete in einer Welt aktivieren.** Der Import allein schaltet die Vögel noch nicht ein.

### 1. Das brauchst du

- **Minecraft für Windows (Bedrock Edition)**. Im Minecraft Launcher wählst du „Minecraft für Windows“. Diese Erweiterung lässt sich nicht in der Java Edition verwenden.
- Der aktuelle Entwicklungsstand benötigt mindestens **Bedrock 1.21.110** für den stabilen Biomersatz. Der alte Kandidat 0.1.1 benötigte 1.21.90. Die Mindestversion ist eine technische Voraussetzung; sie bedeutet nicht, dass jede neuere Version bereits mit diesem Add-on getestet wurde.
- Die Datei **`Lumen-Silent-Birds-0.2.1.mcaddon`**. Sie enthält alles, was Minecraft für die Erweiterung benötigt.

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
2. Öffne im Windows-Explorer den Ordner mit `Lumen-Silent-Birds-0.2.1.mcaddon`.
3. Öffne die Datei per **Doppelklick**. Falls Windows nach einer Anwendung fragt, wähle **Minecraft**. Alternativ verwende **Rechtsklick → Öffnen mit → Minecraft**, sofern angeboten.
4. Warte, bis Minecraft den erfolgreichen Import meldet. Die Datei enthält zwei Pakete: ein **Verhaltenspaket** für die Tiere und ihre Bewegung und ein **Ressourcenpaket** für ihr Aussehen.

Die `.mcaddon`-Datei selbst musst du nicht entpacken. Nach dem Import stehen die Pakete in den Welteinstellungen zur Auswahl. Das Öffnen von Add-on-Dateien und die Zuordnung zu diesen beiden Paketbereichen beschreibt auch die [offizielle Installationshilfe](https://learn.microsoft.com/de-de/minecraft/creator/documents/addonpackinstallation).

### 4. Beide Pakete in einer Welt aktivieren

Verwende für diese Testversion zunächst **eine neue Testwelt**. Wenn du eine vorhandene Welt nutzen möchtest, erstelle vorher eine Sicherung oder eine Weltkopie.

1. Wähle in Minecraft **Spielen**.
2. Erstelle eine neue Welt und öffne deren Einstellungen. Bei einer vorhandenen Welt öffnest du die Einstellungen über das **Stiftsymbol** neben dem Weltnamen.
3. Öffne **Verhaltenspakete → Meine Pakete** beziehungsweise **Verfügbar**.
4. Wähle **„Lumen · Stumme Himmelsvögel“** und klicke auf **Aktivieren**.
5. Öffne anschließend **Ressourcenpakete → Aktiv**. Prüfe, ob das zugehörige Lumen-Vogelpaket dort ebenfalls aufgeführt ist. Falls es noch fehlt, wähle es unter **Meine Pakete** beziehungsweise **Verfügbar** aus und aktiviere es.
6. Starte die Welt. Für den ersten Test sollten nur die beiden Vogelpakete als zusätzliche Pakete aktiv sein.

**Beide Pakete müssen in derselben Welt aktiv sein.** Das Ressourcenpaket liefert Modelle und Texturen; das Verhaltenspaket erzeugt und bewegt die Tiere. Der Paketname „Lumen · Stumme Himmelsvögel“ bleibt auch für die ergänzten Fische bestehen. Die Aktivierung gilt für die jeweilige Welt. Die Bezeichnungen der Menüs können je nach Minecraft-Version etwas abweichen.

### 5. Die Vögel finden

Gehe **tagsüber in der Oberwelt** auf eine freie Fläche und schaue nach oben. Über dir sollte genügend freier Himmel sein; vermeide zunächst Dächer, dichte Baumkronen und Felsüberhänge. Nach ungefähr fünf Sekunden sollte eine Gruppe auftauchen. Direkt bei Sonnenaufgang oder kurz vor Sonnenuntergang sind die Tagvögel noch beziehungsweise schon inaktiv.

Eine vollständige Gruppe enthält **zwei Raben, eine Blaumeise, ein Rotkehlchen, einen Stieglitz und einen Steinadler**. Der Adler fliegt höher als die übrigen Vögel. Sie kreisen über einem festen Bereich und folgen dir nicht. Du musst keine Gegenstände herstellen und keine Befehle eingeben.

**Neu im Entwicklungsstand:** In der Dämmerung und nachts kannst du an einem Waldrand nach Eulen und Uhus Ausschau halten. Der Controller sucht in der Nähe zwei freie Sitzplätze auf Laubblöcken. Ohne passende Baumkronen erscheint keine Nachtgruppe. Eule und Uhu wechseln zwischen Sitzen mit angelegten Flügeln, Abheben, einem kleinen Rundflug und Landen. Ihre roten Augen sind selbstleuchtend; sie beleuchten keine umliegenden Blöcke. Wie der Effekt in deiner Bedrock-Grafikeinstellung aussieht, muss noch im Spiel geprüft werden.

Die [zusätzliche Windows-Checkliste für Eulen und Uhus](docs/OWL_VALIDATION.md) beschreibt die Prüfung von Sitzplätzen, Leuchtaugen, Animationen und Tag-/Nachtwechsel.

Im aktuellen Entwicklungsstand findet eine ergänzte Suche auch kleine Baumkronen
zwischen den bisherigen Suchpunkten. Zwei freie, mindestens zwei Blöcke
auseinanderliegende Laubplätze bleiben erforderlich.

Im Nether und im Ende erscheinen weiterhin keine Gruppen. Dass alle Vögel einschließlich Eulen und Uhus keine eigenen Geräusche machen, ist beabsichtigt.

### 6. Die Fische finden

Gehe im aktuellen Entwicklungsstand an einen See, einen breiten Fluss oder einen Teich in der Oberwelt. Eine freie Wasserfläche von mindestens etwa **5 × 5 Blöcken und zwei Blöcken Tiefe** bietet Platz für die kreisende Schwimmgruppe. Warte bis zu fünf Sekunden und schaue unter die Wasseroberfläche. Auch beim Tauchen können Gruppen in der Nähe entstehen.

Tagsüber schwimmen **zwei Forellen und zwei Karpfen** zusammen. In Dämmerung und Nacht übernehmen **zwei dunkle Hechte mit gelben, selbstleuchtenden Augen**. Die Augen beleuchten keine umliegenden Blöcke. Flache Pfützen, enge Rinnen, Lava, dünne Wasserströme und mit Wasser gefüllte feste Blöcke sind keine Schwimmräume. Wasserpflanzen können den freien Raum verkleinern; teste zunächst in einem freien Becken.

Für deinen Windows-Test gibt es eine [Fisch-Prüfliste](docs/FISH_VALIDATION.md) mit Wasser-, Tageszeit-, Darstellungs- und Fehlerprüfungen.

Im aktuellen Entwicklungsstand werden kleine freie Becken auch dann gefunden,
wenn ihre Mitte zwischen den bisherigen Suchpunkten liegt. Die Suche bleibt auf
zwölf Blöcke in X-/Z-Richtung um dich und ähnliche Höhe begrenzt.

### 7. Das Tiefenmaul und sein Bauch-Abenteuer

**Neu im Entwicklungsstand:** Das eigene Meeresungeheuer ist etwa **16 Blöcke lang**,
hat ein riesiges offenes Maul mit gestuften weißen Zähnen, cyanfarbene Leuchtaugen
und einen rosa-goldenen Geburtstagshut. Wangen, Augenhöhlen, erhabene Hautplatten,
Kiemen, Bauchfalten und gegliederte Flossen formen den Körper. Es kann bei Tag und
Nacht in der Oberwelt erscheinen. Suche in einem tiefen, freien Ozeanbereich: Seine gesamte Schwimmbahn einschließlich Hut
benötigt ungefähr **29 × 29 Blöcke freie Wasserfläche und 17 Blöcke Tiefe**.
Auch ein entsprechend großes künstliches Becken ist geeignet; es gibt keinen
Biomefilter. Suche und Darstellung im Spiel sind noch nicht abgenommen.

Im aktuellen Entwicklungsstand prüft die Suche zusätzlich die bisher
übersprungenen Höhen bis 24 Blöcke unter deiner Position. Damit können auch
geeignete Bereiche mit genau 17 Wasserlagen vom Ufer aus gefunden werden.

Beim normalen Unterwasser-Monster gilt: Schwimme in Survival oder Adventure direkt vor das Maul. Gerätst du in die
Maulöffnung, wirst du in den hohlen Bauch versetzt. Das Monster hält währenddessen
an. **Schwimme geradeaus durch das Maul**, um wieder zur Wasseroberfläche zu gelangen.
Eine Bildschirmanzeige erklärt den Weg. **Schleichen löst jederzeit den Notausgang
aus**; nach spätestens 20 Sekunden beginnt die automatische Rettung. Pro Monster
ist ein Spieler gleichzeitig im Bauch. Creative und Spectator werden ignoriert.

Der Bauch ist ein Modellraum im vorhandenen Wasser. Atemschutz, Resistenz V,
Feuerresistenz und Sättigung schützen während des Aufenthalts. Es gibt keinen
Schadensangriff, keinen Inventarverlust und keine Spielmodusänderung. Kurzzeitige
Schutzeffekte laufen nach der Rettung aus; vorhandene schwächere Resistenz wird
mit ihrer verbleibenden Laufzeit wiederhergestellt. Nach dem Entkommen gilt eine
Minute Schutz vor erneutem Verschlucken. Das Monster verschwindet bei der Rettung.

Rückkehrdaten werden vor dem Verschlucken am Spieler gespeichert. Bei Wiederladen,
Abmelden, Wasserverlust oder Verschwinden des Monsters wird eine freie
Wasseroberfläche gesucht; ersatzweise die weiterhin freie Einstiegsposition.
Bei einem fehlgeschlagenen Teleport bleibt die Rettung mit Schutz aktiv und wird
wiederholt. Ein externer Dimensionswechsel wird respektiert. Weltblöcke und
Inventar bleiben unangetastet. Ohne aktive Skripte kann keine laufende Rettung
garantiert werden; das Modell hat keine physischen Wände und hält dann niemanden fest.

**Noch nicht in Bedrock geprüft:** Verschlucken, Innenansicht, Schutzwirkung,
Schwimmen, Notausgang, Rettung und Leistung müssen auf Windows tatsächlich
getestet werden. Die [Monster-Prüfliste](docs/MONSTER_VALIDATION.md) enthält die Fälle.
Die Inhalte sind eine eigene Umsetzung; es werden keine Mythicus-Dateien verwendet.

### 8. Die Tiefsee

In neu erzeugten Gebieten ersetzt das Add-on Teile tiefer, ungefrorener Ozeane
durch das Biom **Lumen-Tiefsee**. Es erhält dunkelblaues Wasser, eigenen
Unterwassernebel und ein Becken mit **100 Wasserblöcken Tiefe**: Wasser von
Y −37 bis Y 62, ein fester Tiefenschieferboden bei Y −38. Gespeicherte Chunks
werden nicht nachträglich vertieft. Das Tiefenmaul kann den großen Wasserraum
wie andere passende Ozeanbereiche nutzen.

Die Vertiefung erfolgt bei der Welterzeugung und kann dabei natürliche
Strukturteile im Becken ersetzen. An den Grenzen sind steile, an Chunks
ausgerichtete Wände möglich. Nachfolgende Vanilla-Features und die tatsächliche
Bedrock-Erzeugung sind noch zu prüfen. Die Einstellung garantiert keine bestimmte
Entfernung zum Weltspawn. Die [Tiefsee-Prüfliste](docs/DEEP_SEA_VALIDATION.md)
beschreibt Tiefe, Grenzen und die ausstehende Leistungsmessung.

Die vorbereitete **Tiefsee-Abenteuerwelt** bietet einen direkten Start am
Startdorf mit Tauchausrüstung und U-Boot sowie drei weitere Dörfer. Das
Tiefenmaul kann diese in einer größeren Oberflächenszene schrittweise verschlucken.
Die verschluckten Häuser und Bewohner bleiben in begehbaren Bauchbereichen
erhalten. Dort führen ein beleuchteter Ausgang, Schleichen oder die automatische
Rettung nach drei Minuten zurück ins Meer. Installation, Koordinaten und Grenzen
stehen in [ADVENTURE_WORLD.md](docs/ADVENTURE_WORLD.md).

## Wenn etwas nicht funktioniert

| Problem | Das kannst du prüfen |
|---|---|
| Beim Doppelklick öffnet sich ein Archivprogramm. | Verwende „Öffnen mit → Minecraft“. Prüfe, ob die Datei tatsächlich auf `.mcaddon` endet und Minecraft für Windows installiert ist. |
| Du hast nur ein ZIP heruntergeladen. | Ein Actions-Artefakt zuerst entpacken und die enthaltene `.mcaddon` öffnen. Ein Quellcode-ZIP dagegen muss erst gebaut werden. |
| Minecraft meldet einen fehlgeschlagenen Import. | Notiere die genaue Fehlermeldung. Prüfe Minecraft-Version und Dateiname und lade die vollständige Installationsdatei erneut herunter. |
| Das Paket fehlt in den Welteinstellungen. | Prüfe, ob der Import erfolgreich war und ob du Minecraft für Windows verwendest. Verlasse die Welteinstellungen und öffne sie erneut. |
| Das Paket ist importiert, aber es erscheinen keine Vögel. | Kontrolliere beide Pakete unter „Aktiv“ in dieser Welt. Teste tagsüber auf einer freien Fläche in der Oberwelt und warte einige Sekunden. |
| Vögel fehlen teilweise oder verschwinden wieder. | Gruppen werden regelmäßig ersetzt. Hindernisse oder nicht geladene Bereiche können einzelne Vögel verhindern. Pro Controller sind höchstens 18 geladene Vögel vorgesehen. |
| Nachts erscheinen keine Eulen oder Uhus. | Prüfe, ob du einen Build mit der neuen Funktion verwendest (der alte Kandidat 0.1.1 enthält sie nicht). Teste in der Oberwelt an einem Waldrand mit freien Baumkronen; Dächer, zu hohe Bäume oder fehlende geladene Sitzplätze verhindern Nachtgruppen. |
| Es erscheinen keine Fische. | Verwende den aktuellen Entwicklungsstand und ein freies, ausreichend großes Wasserbecken. Gehe näher ans Ufer und auf Wasserniveau; die Suche ist auf die direkte Umgebung und ähnliche Höhe begrenzt. Prüfe die Tageszeit: Forellen/Karpfen am Tag, Hechte nachts. |
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
| Eule (neu) | Kompakter Körper, runder Gesichtsschleier und rote Leuchtaugen; nachts Wechsel zwischen Baumkrone und Rundflug. |
| Uhu (neu) | Größer als die Eule, mit markanten Federohren und roten Leuchtaugen; sitzt und fliegt in der Dämmerung und nachts. |

Eine Taggruppe besteht aus sechs Vögeln; eine Nachtgruppe aus einer Eule und einem Uhu. Nahe Spieler teilen sich eine Gruppe; höchstens drei Gruppen und insgesamt **18 gleichzeitig geladene Vögel** werden durch den Controller erzeugt. Tagsüber sind damit bis zu 18 Vögel, nachts bis zu sechs Eulen/Uhus vorgesehen. Die Tagvögel sind zwischen Tageszeit-Tick 500 und vor 11500 aktiv. Von Tick 11500 über die Nacht bis vor Tick 500 übernehmen Eulen und Uhus. Beim Wechsel wird die vorherige Gruppe entfernt. Nether und Ende erhalten keine Schwärme. Bei mehr als drei weit getrennten Spielern wechselt die Vergabe freier Gruppen, damit nicht dauerhaft dieselben Spieler leer ausgehen. Regen wird in dieser Version noch nicht gesondert berücksichtigt.

Die Flugbahnen bleiben an einem festen Ort in der Landschaft. Die Vögel verfolgen den Spieler nicht. Bei Ortswechsel, Dimensionswechsel oder Verlassen der Welt wird aufgeräumt. Eine Gruppe lebt höchstens 45 Sekunden und kann danach ersetzt werden. Es kann dadurch einen sichtbaren Wechsel geben. Felsüberhänge, Gebäude oder nicht geladene Bereiche können dazu führen, dass weniger Vögel erscheinen oder ein Vogel vorzeitig verschwindet.

Eulen und Uhus nutzen einen 40-Sekunden-Zyklus: zunächst sitzen, über sechs Sekunden aufsteigen, einen 14-sekündigen Kreis fliegen, über sechs Sekunden landen und wieder sitzen. Die beiden Tiere beginnen versetzt, sodass Flug und Sitzen gleichzeitig sichtbar sein können. Sitzplätze werden regelmäßig erneut geprüft; verschwindet das Laub oder wird der Platz blockiert, wird der betroffene Vogel entfernt. Auch gesetzte Laubblöcke können als Sitzplatz dienen, weil der Controller die Blöcke prüft und keine vollständigen Bäume rekonstruiert.

Die Vögel haben keine Angriffe, Zähmung, Beute, Erfahrungspunkte oder Fortpflanzung. Sie verändern keine Blöcke. Es sind zusätzliche Entitäten, deshalb ist das Add-on mehr als eine reine Shader-Einstellung. Eigene Geräuschdateien, Sound-Ereignisse und geerbte Papageien-Geräusche sind nicht enthalten; andere Minecraft-Geräusche werden nicht stummgeschaltet.

## Was im Wasser passiert

| Fisch | Aussehen und Verhalten |
|---|---|
| Forelle | Schlank, silbrig und gepunktet; schwimmt tagsüber mit bewegten Flossen und Schwanz. |
| Karpfen | Kräftiger goldbrauner Körper mit Barteln; Teil derselben Tagesgruppe. |
| Hecht | Dunkler, länglicher Körper, langer Kiefer und gelbe Leuchtaugen; in Dämmerung und Nacht aktiv. |

Fische haben ein eigenes Limit von **zwölf geladenen Tieren in höchstens drei Gruppen**. Tagsüber sind bis zu zwölf Fische, nachts bis zu sechs Hechte vorgesehen. Zusammen mit dem Vogellimit sind höchstens 30 geladene Vögel und Fische vorgesehen. Das Tiefenmaul hat zusätzlich ein eigenes Limit von einem geladenen Exemplar (insgesamt höchstens 31 Tiere). Nahe Spieler teilen sich eine Gruppe; weit entfernte Standorte werden reihum versorgt. Die Tageszeiten entsprechen denen der Vögel.

Schwimmbahnen bleiben an einem festen Ort und verfolgen den Spieler nicht. Vor dem Erzeugen wird der gesamte benötigte Wasserraum geprüft; vor jeder Bewegung werden aktueller und nächster Körperbereich erneut geprüft. Wird Wasser entfernt oder durch ein Hindernis ersetzt, verschwindet der betroffene Fisch. Gruppen werden nach spätestens 45 Sekunden ausgetauscht und bei Tageszeitwechsel, größerer Entfernung, Dimensionswechsel oder Wiederladen aufgeräumt. Ein nativer 60-Sekunden-Timer bleibt als Rückfallebene erhalten.

Die Hechte wirken nur unheimlich: Sie greifen weder Spieler noch andere Tiere an. Forellen, Karpfen und Hechte sind dekorativ, stumm, nicht fangbar und nicht per Eimer sammelbar; es gibt keine Beute, Erfahrungspunkte oder Fortpflanzung. Vanilla-Fische und deren Verhalten bleiben unverändert.

In der Abenteuerwelt kommen getrennt davon höchstens **sechs feindliche Mutanten**
hinzu: Tiefenbeißer und Laternenmaul. Damit sind bis zu 37 eigene Tiere geladen;
das U-Boot und die Dorfbewohner zählen separat. Mutanten greifen Schwimmer ab
Y 20 abwärts an. U-Bootfahrer, Creative/Spectator und Friedlich sind ausgenommen.
Tauchausrüstung und Kämpfe sind in der [Weltanleitung](docs/ADVENTURE_WORLD.md) erklärt.

## Leistung und technische Grenzen

Die Modelle bestehen aus Quadern und verwenden Farbpaletten mit 64 × 8 oder 64 × 16 Pixeln. Flügel, Fischflossen und Schwänze bewegen sich durch clientseitige Molang-Animationen. Für die Nachtvögel wird der Sitzstatus an den Client übertragen; ein Animationscontroller blendet die Flug- und Sitzpose ineinander. Eulen, Hechte und das Tiefenmaul verwenden TGA-Texturen mit einer Emissionsmaske nur für die Augen; beim Laternenmaul leuchtet auch der Köder. Skripte setzen Position und Blickrichtung mit kleinen `tryTeleport`-Schritten: Vögel und dekorative Fische pro Tick, Tiefenmaul und Mutanten alle fünf Ticks. Das U-Boot verwendet native Bewegungsimpulse. Ob der Bedrock-Client diese Schritte ausreichend flüssig darstellt, ist Teil der noch offenen Sichtprüfung.

Alle fünf Sekunden prüfen die Controller Spielernähe, freie Bereiche und verwaiste Tiere. Sie erzeugen keine Ticking Areas und laden keine Chunks absichtlich nach. Fischkörper werden konservativ mit umliegenden Wasserblöcken geprüft; Mehrfachabfragen teilen sich nur innerhalb desselben Ticks einen Zwischenspeicher. Die Wassersuche prüft ein begrenztes Raster bis zwölf Blöcke je Horizontalrichtung und sechs Blöcke unter bis zwei Blöcke über der Spielerhöhe. Kleine oder ungünstig zum Raster liegende Becken können unentdeckt bleiben.

Die nativen 60-Sekunden-Timer zählen nur, während die Entität simuliert wird. Entitäten in entladenen Chunks sind weder vollständig zählbar noch sofort entfernbar; nach dem Laden werden sie aufgeräumt. Die Limits von 18 Vögeln und zwölf Fischen beziehen sich deshalb auf geladene Entitäten. Das Tiefenmaul prüft zusätzlich eine Wasserhülle von elf Blöcken je Horizontalrichtung und acht Blöcken vertikal; seine Suche ist auf 26.000 Blockabfragen pro Spieler und Suchlauf begrenzt. Sie prüft ein Raster bis 16 Blöcke je Horizontalrichtung und bis 24 Blöcke unter Spielerhöhe. Der große Prüfbereich und die Tiere benötigen eine neue Leistungsmessung im Spiel.

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

Unter Windows kann `py -3` statt `python` verwendet werden, etwa `py -3 scripts/build.py`. Öffne nach erfolgreichem Build `dist/Lumen-Silent-Birds-0.2.1.mcaddon` wie in Schritt 3 beschrieben. Für die vorbereitete Abenteuerwelt öffne stattdessen `dist/Lumen-Tiefsee-Abenteuer-0.2.1.mcworld`; sie bringt beide Pakete mit. Der Build erzeugt außerdem ein eigenständig nutzbares Quellcode-ZIP und SHA-256-Prüfsummen in `dist/`. Die Archive haben feste Zeitstempel und werden bei unverändertem Quellstand bytegleich gebaut.

`src/` enthält die Tier- und Abenteuersteuerung sowie die Prüfungen für Sitzplätze und Wasser. `scripts/generate.py` pflegt Modelle, Farbpaletten, Animationen, Manifest und Entitätskomponenten; `scripts/deep_sea.py` erzeugt Biom, Becken und Nebel. `behavior_pack/` und `resource_pack/` werden daraus erzeugt; direkte Änderungen dort werden beim Build ersetzt. `docs/PREVIEW.svg` wird aus derselben Modellgeometrie mit vereinfachter Beleuchtung und festen Posen gerendert. UUIDs bei Updates beibehalten und für einen neuen Releasekandidaten die Versionsnummer in Generator und `package.json` synchron erhöhen.

Die eigene Repository-CI prüft das Add-on unabhängig vom Grafikprojekt. Tags nach `birds-vX.Y.Z` erzeugen nach erfolgreicher Prüfung einen Release-Entwurf; die Windows-Abnahme bleibt ein eigener Schritt. Projektvorgaben: [AGENTS.md](AGENTS.md), Änderungen: [CHANGELOG.md](CHANGELOG.md), Releaseleitfaden: [RELEASING.md](docs/RELEASING.md). Das eigenständig baubare Source-ZIP enthält auch diese Dokumente, die Abnahmevorlage und die [Lizenz](LICENSE).

## Technische Quellen

- [Stabiler Biomersatz ab Bedrock 1.21.110](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/biomesreference/examples/components/minecraftbiomes_replace_biomes?view=minecraft-bedrock-stable)
- [Moderne Höhenkomponente ohne Geländeverformung](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/biomesreference/examples/components/minecraftbiomes_overworld_height?view=minecraft-bedrock-stable), [Scatter-Features und relative Koordinaten](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraft_scatter_feature?view=minecraft-bedrock-stable)
- [Passendes offizielles Biom-Beispiel für 1.21.110](https://github.com/Mojang/bedrock-samples/blob/v1.21.110.2/behavior_pack/biomes/deep_ocean.biome.json)
- [Stabile Script API 2.0.0 in Bedrock 1.21.90](https://www.minecraft.net/it-it/article/minecraft-1-21-90-bedrock-changelog)
- [Pack-Manifest und Script-Abhängigkeiten](https://learn.microsoft.com/minecraft/creator/reference/content/addonsreference/packmanifest?view=minecraft-bedrock-stable)
- [Dimension: Entitäten und Geländeabfragen](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable), [Entity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable), [TeleportOptions](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/teleportoptions?view=minecraft-bedrock-stable)
- [Raycast-Optionen für die Prüfung niedriger Dächer](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockraycastoptions?view=minecraft-bedrock-stable)
- [Blockzustände einschließlich Wasserstand](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/intrinsicblockstateslist?view=minecraft-bedrock-stable), [BlockPermutation.getState](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockpermutation?view=minecraft-bedrock-stable)
- [Emissive Materialien](https://learn.microsoft.com/en-us/minecraft/creator/documents/material-files?view=minecraft-bedrock-stable), [synchronisierte Entity Properties](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable)
- [Clientseitige Animationen](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationsoverview?view=minecraft-bedrock-stable)
- [Timer](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_timer?view=minecraft-bedrock-stable), [Instant Despawn](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_instant_despawn?view=minecraft-bedrock-stable), [Damage Sensor](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_damage_sensor?view=minecraft-bedrock-stable)
