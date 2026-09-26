# Lumen · Tiefsee-Abenteuer

Eine vorbereitete Bedrock-Testwelt mit 100 Blöcken tiefem Meer, vier
schwimmenden Dörfern, Tauchausrüstung, gelben U-Booten und dem Tiefenmaul mit
Geburtstagshut. Das Monster kann Dörfer verschlucken; ihre Häuser lassen sich
anschließend im Bauch erkunden. Kleinere Mutantenfische machen Tauchgänge gefährlich.

**Noch nicht in Minecraft geöffnet.** Die Weltdatei enthält neue Weltmetadaten,
eine leere Datenbank und die benötigten Pakete. Minecraft erzeugt das Meer beim
ersten Öffnen; das Weltskript baut Dörfer in Spielernähe auf. Binär-, Paket- und
Verhaltenstests ersetzen keine erfolgreiche Import- oder Spielprüfung.

## Öffnen unter Windows

1. Minecraft für Windows (Bedrock) ab **1.21.110** verwenden.
2. `Lumen-Tiefsee-Abenteuer-0.2.1.mcworld` aus dem aktuellen Kandidatenbuild
   auf den Windows-PC kopieren und doppelklicken beziehungsweise mit Minecraft öffnen.
3. Nach dem Import unter **Spielen → Welten** die Welt **Lumen · Tiefsee-Abenteuer**
   auswählen. Beide benötigten Pakete sind bereits der Welt zugeordnet.
4. Beim ersten Start kurz am Startplatz bleiben, bis das Dorf aufgebaut ist.
   Die Bildschirmanzeige nennt anschließend die Fundorte.

Es ist keine zusätzliche Installation der `.mcaddon` nötig. Die Welt ist ein
Teil des Releasekandidaten 0.2.1. Die Prüfung in Bedrock steht noch aus;
Experimente sind ausgeschaltet.

## Dörfer und Ausrüstung

Der Startplatz liegt auf einer hölzernen Plattform bei **X 0, Y 64, Z 0**.
Das Startdorf heißt **Hafenlicht**. Jedes Dorf besitzt drei Häuser, beleuchtete
Stege, zwei Dorfbewohner, eine Ausrüstungstruhe und ein U-Boot. Entfernte Dörfer
entstehen, sobald Spieler ihre Umgebung laden. Der Baufortschritt und die
Ausstattung werden für jeden Standort getrennt gespeichert.

| Dorf | Mittelpunkt des Stegs (X / Y / Z) |
|---|---|
| Hafenlicht | 0 / 64 / 0 |
| Ostwacht | 192 / 64 / 0 |
| Nebelhafen | −160 / 64 / 144 |
| Fernsteg | 64 / 64 / −192 |

Fertige und verschluckte Dörfer werden nicht automatisch neu aufgebaut.

- **Taucheranzug:** Truhe im westlichen Haus, ungefähr **X −13, Y 64, Z −1**.
  Helm, Oberteil mit Luftflaschen, Hose und Taucherstiefel in die vier
  Rüstungsplätze anlegen. **Helm und Luftflaschen zusammen** geben dauerhaft
  Wasseratmung und Nachtsicht in der Oberwelt; Hose und Stiefel sind dafür
  nicht erforderlich. Das Tragen in der Hand oder im Inventar genügt nicht.
  Nach dem Ablegen laufen die vom Anzug gewährten Effekte aus (höchstens
  15 Sekunden Wasseratmung und 30 Sekunden Nachtsicht). Längere Trankeffekte
  bleiben erhalten. Milch entfernt die Effekte kurzzeitig; bei
  angelegtem Helm und Oberteil werden sie im nächsten Tick erneuert.
  Die bisher „Schwimmflossen“ genannten Gegenstände werden beim Paketupdate
  unter derselben ID als Taucherstiefel angezeigt; keine neue Welt ist nötig.
  Brot und ein Steinschwert dienen als Starthilfe für die ersten Tauchgänge.
- **U-Boot:** Unter Wasser am Südoststeg, ungefähr **X 13, Y 60, Z 23**.
  Hineinschwimmen und mit dem Boot interagieren. Bewegen und dabei in die
  gewünschte Richtung schauen; nach unten/oben schauen und vorwärts bewegen
  lässt es tauchen/steigen. **Schleichen** steigt aus.

Diese Fundorte gelten für Hafenlicht. Bei den anderen Dörfern die jeweilige
X-/Z-Koordinate aus der Tabelle addieren.

Der Anzug verhindert keine Fischbisse. Das Boot schützt seine Insassen; nach
dem Aussteigen bleiben die kurzen Atem- und Sichteffekte zunächst erhalten.
Es braucht weder Treibstoff noch Munition. Das Boot bewegt sich nur durch
geprüften Wasserraum und hält vor Hindernissen beziehungsweise fehlenden Chunks.
Bedienung und Darstellung in erster und dritter Person bleiben im Spiel zu prüfen.
Die vier Anzugmodelle verwenden die Körperknochen der Bedrock-Rüstung. In der
Ich-Perspektive sind die Ärmel vorgesehen; Helm, Rumpf und Beine werden dort
ausgeblendet, damit die Kamera frei bleibt. In dritter Person und der
Inventarvorschau ist der vollständige ausgerüstete Anzug vorgesehen.

Technische Referenzen: [Bedrock-Attachables](https://learn.microsoft.com/en-us/minecraft/creator/documents/attachables?view=minecraft-bedrock-stable)
und das [offizielle Rüstungsskelett für Bedrock 1.21.110](https://github.com/Mojang/bedrock-samples/blob/v1.21.110.2/resource_pack/models/entity/player_armor.json).

## Wenn das Tiefenmaul ein Dorf verschluckt

In der Nähe eines fertigen Dorfs wird zunächst dessen Bauchbereich vorbereitet.
Dann warnt eine Bildschirmanzeige acht Sekunden vor dem Angriff. Das Tiefenmaul
erscheint für diese Szene ungefähr **56 Blöcke lang**, nähert sich, öffnet den
Kiefer und fährt in zwei Bahnen durch das Dorf. Haus- und Stegblöcke werden
schrittweise innerhalb des Mauls verschluckt. Auf der Wendestrecke bleibt der
Kiefer geschlossen. Zwischen Angriffen liegen mindestens drei Minuten.

Die verschluckten Originalblöcke werden mit ihren Blockzuständen im Bauch
nachgebildet, bevor sie draußen verschwinden. Bewohner werden in denselben
Bauchbereich versetzt. Spieler auf betroffenen Böden werden vor deren Entfernung
verschluckt; Schwimmer können durch das geöffnete Maul hineingeraten.

Im Bauch kannst du die Häuser und Stege zwischen Knochenrippen und leuchtenden
Wänden frei erkunden. Der **beleuchtete Ausgang im Norden** führt zurück zur
Meeresoberfläche. **Schleichen** ist der Notausgang; nach spätestens **drei
Minuten** beginnt die automatische Rettung. Atem- und Schadensschutz bleiben
während des Aufenthalts aktiv. Mehrere Spieler können denselben Bereich erkunden.

Auch spätere Begegnungen nahe einem verschluckten Dorf führen in dessen
gespeicherten Bauchbereich. Ohne verschlucktes Dorf gilt das kurze Bauch-Abenteuer
des normalen Monsters mit automatischer Rettung nach 20 Sekunden.

Der zentrale Startsteg von Hafenlicht bleibt erhalten. Dorfblöcke mit geändertem Typ,
gefüllte Truhen und Bauten außerhalb des ursprünglichen Dorfplans werden nicht
verschluckt. U-Boote bleiben draußen. Unterbricht Laden oder Speichern einen
Angriff, bleiben die schon verschluckten Dorfteile im Bauch; die Szene wird beim
Neustart beendet und nicht erneut abgespielt.

## Unter Wasser

Die Wasserwelt hat einen Boden bei **Y −38** und Wasser von **Y −37 bis Y 62**:
100 Wasserblöcke vom Grund bis zur Oberfläche. Die Dörfer bilden bebaute Inseln;
darüber hinaus ist diese Startwelt eine durchgehende Wasserwelt.

Das große Tiefenmaul kann in ausreichend freiem Wasser nahe Spielern erscheinen.
Es kann Schwimmer verschlucken; der Weg nach vorne durch sein Maul oder
Schleichen führt wieder hinaus. Details: [Monster-Prüfliste](MONSTER_VALIDATION.md).
Kleinere Mutantenfische kommen tiefer unten hinzu. Sie greifen Schwimmer in
Survival/Adventure an und lassen sich bekämpfen. Die bisherigen dekorativen
Forellen, Karpfen und Hechte bleiben friedlich.

| Mutant | Gefahr vor Rüstung und anderen Schutzeffekten |
|---|---|
| Tiefenbeißer | Schnell, 8 Lebenspunkte; ein Biss verursacht 2 Schadenspunkte mit mindestens 2 Sekunden Abstand. |
| Laternenmaul | Langsamer Anglerfisch mit Leuchtköder, 12 Lebenspunkte; ein Biss verursacht 3 Schadenspunkte mit mindestens 3 Sekunden Abstand. |

Beide erscheinen in der Abenteuerwelt ab Y 20 abwärts, solange passende Spieler
im Wasser sind. Höchstens sechs sind gleichzeitig geladen. Zusammen können sie
pro Spieler höchstens einen Treffer pro Sekunde versuchen. Im Schwierigkeitsgrad
**Friedlich** erscheinen keine Mutanten. Sie können vom Spieler besiegt werden;
der Taucheranzug bietet Rüstung, aber keine Unverwundbarkeit.

Die separate `.mcaddon` erzeugt in normalen neuen Landschaften das eigene
Lumen-Tiefseebiom. Diese vorbereitete Welt verwendet für ihre gleichmäßig tiefen
Wasserschichten das eingebaute tiefe Ozeanbiom. Dessen Wasserfarbe und Nebel
stammen aus Minecraft; Tiefe, Dörfer und Abenteuer werden mitgeliefert.

## Technische Grenzen und Wiederladen

- Nur das separat identifizierte Verhaltenspaket der Welt aktiviert Dorfbau,
  Dorfangriffe, Bauchbereiche und feindliche Tiefseefische. Das normale Add-on
  baut kein Dorf in einer vorhandenen Welt.
- Die begehbaren Bauchbereiche liegen technisch unter dem Meeresboden des
  jeweiligen Dorfs. Ein Teleport stellt das Verschlucken dar; die Gebäude bewegen
  sich nicht als Blöcke innerhalb der Monster-Entität. Ein Bereich umfasst den
  Inhalt eines Dorfs. Die Szene ist eine geskriptete Minecraft-Animation.
- Es werden keine Commands oder Ticking Areas verwendet. Nicht geladene Bereiche
  pausieren den Dorfbau; bereits belegte Bauplätze werden nicht überschrieben.
- Die Dorfausstattung ist ein einmaliger Fund. Nach dem Entnehmen wird die Truhe
  nicht ständig nachgefüllt; das geparkte Boot ist dauerhaft vorhanden.
- Bauchbereiche und verschluckte Häuser bleiben beim Wiederladen erhalten.
  Abgebaute Teile werden nicht nachgefüllt. Bei Spielern im Kopierziel wartet das Monster. Bei veränderten Zielblöcken,
  fehlenden Chunks oder Speicherfehlern stoppt der Angriff vor weiteren Entfernungen.
- Eigene Skripte und Kreaturen bleiben stumm. Vanilla-Dorfbewohner, Welt und
  Spieler behalten ihre normalen Geräusche.
- Die Weltpakete müssen aktiv bleiben. Bereits gebaute Dorfblöcke bleiben nach
  Abschalten erhalten; benutzerdefinierte Gegenstände und Kreaturen benötigen
  weiterhin das Add-on.

## Offene Windows-Prüfung

- [ ] `.mcworld` importiert und öffnet ohne Reparatur-/Inkompatibilitätsmeldung.
- [ ] Content-Log bleibt frei von Welt-, Item-, Attachables-, Entity- und Scriptfehlern.
- [ ] Meer reicht wirklich 100 Wasserblöcke tief; Startplatz liegt beim Dorf.
- [ ] Erster Start, langsames Laden und Neustart während des Baus sind sicher.
- [ ] Drei Häuser, Stege, Truhe, zwei Dorfbewohner und genau ein Startboot erscheinen.
- [ ] Alle vier Standorte besitzen eigene Ausrüstung und Boote; entfernte Dörfer
      entstehen erst beim Besuch. Gleichzeitige Besuche blockieren einander nicht.
- [ ] Vier Anzugteile einschließlich Taucherstiefeln lassen sich anlegen und sind
      in dritter Person und im Inventar sichtbar (klassischer und schmaler Skin).
      Ärmel bleiben in erster Person sichtbar; der Helm verdeckt die Kamera nicht.
- [ ] Helm, Luftflaschen, Hose und Stiefel folgen Gehen, Schleichen und Schwimmen.
- [ ] Helm und Luftflaschen schützen auch ohne Hose/Stiefel über einen längeren
      Tauchgang vor Luftverlust. Helm oder Oberteil allein reicht nicht aus.
      Nach Ablegen läuft der Schutz aus; nach Milch und Wiederladen kehrt er zurück.
      U-Boot-Insassen erhalten den Schutz weiterhin ohne Anzug.
- [ ] Paketupdate ersetzt vorhandene Flossen durch Stiefeldarstellung und Namen;
      Inventar, Ausrüstung und Vorratstruhen bleiben erhalten.
- [ ] Einsteigen, Tauchen, Drehen, Hindernisse, Aussteigen und Wiederladen funktionieren.
- [ ] Mutanten greifen Schwimmer an; Anzug allein verhindert keinen Schaden;
      Bootsinsassen und Creative-/Spectator-Spieler werden nicht angegriffen.
- [ ] Tiefenmaul, Rettung, Inventar und Tod/Respawn verhalten sich wie dokumentiert.
- [ ] Dorfangriff zeigt Warnung, Anfahrt, offenen Kiefer, schrittweises Verschlucken,
      geschlossene Wendemanöver und Abfahrt ohne Sprünge oder abgeschnittenes Modell.
- [ ] Verschluckte Häuser und Bewohner sind im Bauch auffindbar; mehrere Spieler
      können sich dort bewegen. Ausgang, Schleichen und Zeitlimit retten auch unter
      dem geschützten Startsteg zur Oberfläche.
- [ ] Gefüllte Truhen, fremde Bauten, Startsteg und Bootsinsassen bleiben erhalten.
      Fehlende Chunks, Speichern mitten im Angriff und Wiederverbinden im Bauch
      verursachen keine wiederholten Entfernungen oder Ausrüstungsduplikate.
- [ ] Mehrspieler, Dimensionswechsel und längere Fahrten ohne Duplikate oder Chunksperren.
- [ ] Welt speichern und erneut öffnen: keine neuen Häuser, keine Truhenfüllung,
      kein Ersatzboot. Bildrate und Erzeugungszeit auf dem Ziel-PC protokollieren.

Für einen Abnahmebeleg Minecraft-Version, Quellcommit, CI-Lauf und SHA-256 der
importierten Weltdatei nach [RELEASING.md](RELEASING.md) festhalten.
