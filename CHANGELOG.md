# Änderungen · Stumme Himmelsvögel

## [Unreleased]

## [0.2.1] - Kandidat

- Drei Spawn-Lücken behoben: Fische finden kleine freie Becken auch zwischen
  den bisherigen Suchpunkten; Eulen und Uhus finden zwei getrennte Sitzplätze
  auf kleinen Baumkronen ohne vorherigen Rastertreffer. Das Tiefenmaul prüft
  zusätzlich die übersprungenen Höhen und findet dadurch geeignete Bereiche
  mit 17 Wasserlagen auch vom Ufer aus.
- Im abschließenden Review einen weiteren Suchfehler behoben: Das Tiefenmaul
  prüft zuerst die bisherigen Tiefen an allen Nachbarpositionen. Eine blockierte
  Position verbraucht damit nicht vorzeitig das Budget durch die neue Nachsuche.
- Regressionstests für versetzte Spielerpositionen, negative Koordinaten und
  unterschiedliche Wassertiefen ergänzt. Wasserhüllen, Tierlimits und das
  Suchbudget des Tiefenmauls bleiben erhalten. Die Windows-Prüflisten enthalten
  die neuen Fälle; deren tatsächliche Bedrock-Abnahme steht aus.
- Verbindlichen Abschluss jedes Änderungsauftrags in `AGENTS.md` festgehalten:
  Review, Bugfixing, Prüfungen, Commit/Push, neuer Release und Bereinigung
  erledigter lokaler und GitHub-Branches. Die Bedrock-Abnahme bleibt Voraussetzung
  für eine stabile Veröffentlichung.

## [0.2.0] - Kandidat

- Vier getrennt gespeicherte Wasserdörfer mit Häusern, Bewohnern,
  Tauchausrüstung und U-Booten. Entfernte Standorte entstehen beim Besuch;
  verschluckte Dörfer und entnommene Vorräte werden nicht neu erzeugt.
- Das Tiefenmaul nähert sich mit Warnung als etwa 56 Blöcke großer Gigant und
  verschluckt Dorfblöcke schrittweise im geöffneten Maul. Ein eigener Controller
  teilt sein Limit mit dem normalen Monster. Startsteg, veränderte Blöcke,
  gefüllte Truhen und fremde Bauten bleiben erhalten.
- Verschluckte Häuser und Stege werden vor ihrer Entfernung in dauerhafte,
  begehbare Bauchbereiche kopiert; Bewohner und betroffene Spieler gelangen
  ebenfalls hinein. Beleuchteter Ausgang, Schleichen und Rettung nach drei
  Minuten ermöglichen die Flucht. Die Darstellung benötigt noch Bedrock-Prüfung.
- Bei der Fehlersuche blockierte Dorfstarts, Bewohnerrettung bei entfernten
  Dörfern, Spielerrettung beim ersten verschluckten Bodenblock und den
  Notausstieg unter der Startplattform mit Regressionstests abgesichert.
  Ungeladene Bauchbereiche blockieren keine anderen Dörfer mehr; belegte
  Kopierziele und erschöpfte Baukontingente pausieren das Verschlucken.

- Zwei kleinere feindliche Tiefseefische für die Abenteuerwelt: schneller
  Tiefenbeißer und leuchtendes Laternenmaul. Höchstens sechs geladene Mutanten
  verfolgen Schwimmer ab Y 20 abwärts und verursachen normalen, durch Rüstung
  verringerten Schaden. Friedlich, Creative/Spectator und Bootsinsassen sind
  ausgenommen; dekorative Fische behalten ihr Verhalten.
- U-Bootfahrer vom Verschlucken ausgeschlossen und die Rettung aus dem
  Tiefenmaul bis zur Oberfläche der 100 Blöcke tiefen See erweitert. Beide
  Integrationsfehler mit vorher scheiternden Regressionstests behoben.

- Eigenständige Tiefsee-Abenteuerwelt als `.mcworld` mit 100 Wasserlagen,
  schwimmendem Dorf, zwei Dorfbewohnern, Ausrüstungstruhe und gelbem U-Boot
  vorbereitet. Dorfbau ist auf das eigene Weltpaket begrenzt und fortsetzbar;
  das normale Add-on baut keine Dörfer in Bestandswelten.
- Vier tragbare Tauchausrüstungsteile mit eigenen Modellen und Symbolen;
  vollständiges Set gibt Wasseratmung und Nachtsicht. Das U-Boot lässt sich
  durch Bewegungsinput und Blickrichtung steuern und schützt seine Insassen.
- Build, Prüfsummen und Kandidatengate um die Weltdatei erweitert. Neue Welt-
  und LevelDB-Metadaten werden selbst erzeugt; keine fremden Weltdaten enthalten.
  Minecraft-Import, Dorfaufbau und tatsächliches Spielen sind noch nicht geprüft.

- Tiefseebiom mit 100 Wasserblöcken von Y −37 bis Y 62, festem Boden bei Y −38,
  dunkelblauem Wasser und eigenem Unterwassernebel ergänzt. Es ersetzt Teile
  tiefer, ungefrorener Ozeane bei neuer Welterzeugung. Vorhandene Chunks werden
  nicht umgebaut; Grenzen können steil und an Chunks ausgerichtet sein.
- Mindestversion wegen des stabilen Biomersatzes auf Bedrock 1.21.110 angehoben;
  Script API 2.0.0 und bestehende Paket-UUIDs bleiben erhalten. Tests prüfen
  sämtliche Beckenkoordinaten, Referenzen und die Aufnahme ins Quellcodearchiv.
  Tatsächliche Welterzeugung und Leistung sind noch in Bedrock zu prüfen.

- Tiefenmaul aufwändiger modelliert: gestufte weiße Zähne, geformte Wangen und
  Augenhöhlen, erhabene Hautplatten, Kiemen, Bauchfalten und gegliederte Flossen
  mit Flossenstrahlen. Der Geburtstagshut behält eigene rosa-goldene Farben.
- Zahnspitzen aus dem vollständigen Spielerkorridor entfernt; der Fluchtweg
  bleibt auch während der Kieferbewegung frei. Wasserhülle und opakes Weiß
  aller Zahnflächen werden zusätzlich geprüft.

- Eigenes Meeresungeheuer „Tiefenmaul“ ergänzt: etwa 16 Blöcke lang, riesiges
  Maul, hohler Bauch, cyanfarbene Leuchtaugen und rosa-goldener Geburtstagshut.
- In Survival/Adventure kann die Maulöffnung einen Spieler verschlucken. Atem-
  und Schadensschutz, Schwimmen zum Ausgang, Schleichen als Notausgang und
  automatische Rettung nach 20 Sekunden machen daraus ein Bauch-Abenteuer.
  Rückkehrdaten überstehen Wiederladen; fehlgeschlagene Rettungen werden erneut
  versucht. Die tatsächliche Schutzwirkung muss noch in Bedrock geprüft werden.
- Eigenes Limit von einem geladenen Meeresungeheuer, bei Tag und Nacht in großem
  geprüftem Wasserraum. Vögel/Fische behalten ihre bisherigen Limits und ihr
  Verhalten. Die Tiercontroller ändern keine Blöcke und nutzen keine Commands,
  fremden Assets oder neue API-Version.
- Modell-, Paket- und Verhaltenstests sowie eine Windows-Prüfliste ergänzt;
  Innenansicht, Schwimmen, Schutz, Rettung, Hütchen und Leistung sind noch offen.

- Forellen und Karpfen am Tag sowie dunkle Hechte mit gelben Leuchtaugen in
  Dämmerung/Nacht ergänzt: eigene Modelle, Schwimmanimationen und stumme
  dekorative Entitäten ohne Angriffe oder Beute.
- Fische schwimmen nur in geprüftem Wasserraum. Wasserverlust, Hindernisse,
  Tageszeitwechsel, Reise und Wiederladen räumen Gruppen auf. Eigenes Limit von
  zwölf geladenen Fischen in drei Gruppen; das Vogellimit bleibt bei 18.
- Im Review eine Kollision der gemischten Tagesgruppe behoben: Forellen und
  Karpfen halten durch ein gemeinsames Schwimmtempo über ihre Lebensdauer Abstand.
- Fisch-Prüfliste und Modellvorschau ergänzt; die tatsächliche Bedrock-Darstellung,
  Wassergrenzen, Leuchtaugen und Leistung bleiben noch zu prüfen.

- Tag- und Nachtgruppen entstehen nicht mehr unter niedrigen Dächern, auch wenn
  darüber Baumkronen liegen. Die Prüfung berücksichtigt den Block direkt über
  den Füßen schleichender oder schwimmender Spieler und lässt hohes Gras zu.
- Ungeeignete niedrige Bäume verhindern nicht mehr die Suche nach einem zweiten
  Sitzplatz auf einer geeigneten höheren Baumkrone.
- `npm test` nutzt die automatische Testsuche von Node, sodass der Aufruf auch
  mit Node 20 unter Windows ohne Shell-Platzhalterauflösung funktioniert.

- Eule und Uhu als eigene stumme Nachtvögel mit roten selbstleuchtenden Augen
  ergänzt. Sie wechseln in Dämmerung/Nacht zwischen Flug und Sitzen auf freien
  Laubblöcken; tagsüber bleiben die bisherigen fünf Arten aktiv.
- Sitzplätze, Tag-/Nachtwechsel und Baumverlust werden kontrolliert aufgeräumt.
  Höchstens drei Gruppen und insgesamt 18 geladene Vögel bleiben erhalten;
  Nachtgruppen bestehen aus zwei Tieren.
- Eigene Modelle, TGA-Paletten, weiche Sitz-/Fluganimationen und aktualisierte
  Vorschau ergänzt. Der alte Releasekandidat 0.1.1 bleibt unverändert; die
  neue Darstellung und das Augenleuchten benötigen noch eine Bedrock-Abnahme.
- Flächensortierung der Modellvorschau gegen Rundungsunterschiede zwischen
  unterstützten Python-Versionen abgesichert, damit der Neubau unverändert bleibt.

- CI prüft die Mindestversionen Python 3.10 / Node 20 und zusätzlich Python 3.14 /
  Node 24. Beide Kombinationen müssen vor der Release-Entwurfserstellung bestehen.
- Neues Kandidatengate automatisiert Wiederholungsbuild, Prüfsummen, Prüfung der
  eingebetteten Packs und vollständigen Quellen sowie Tests und Neubau aus dem
  Source-ZIP ohne Git-Checkout.
- Windows-Checkliste für den unveränderten Kandidaten 0.1.1 ergänzt. Die Prüfung
  im Spiel bleibt offen und wird vom Nutzer am Windows-PC durchgeführt.
- Vorgehensweise bei Änderungen in `AGENTS.md` dokumentiert: belegbare Bugfixes,
  passende Prüfungen, Review, autorisierter Commit/Push und überprüfte Releases
  mit klarer Trennung zwischen Entwurf, öffentlicher Testversion und Freigabe.

## [0.1.1] - Kandidat

- Niedrige Hausdächer werden bei der Standortprüfung erkannt; dort werden keine
  Vogelgruppen mehr für Spieler im Gebäude erzeugt.
- Freie Gruppen werden bei mehr als drei weit getrennten Spielern reihum vergeben,
  statt immer dieselben Spieler nach ihrer ID zu bevorzugen. Das Limit bleibt bei
  18 geladenen Vögeln.
- Das Source-ZIP nimmt nur vorgesehene Projektdateien auf. Lokale `.env`-Dateien,
  Logs und virtuelle Umgebungen werden nicht mehr versehentlich mitgepackt;
  passende symbolische Dateipfade führen zu einem Fehler.

- README um eine schrittweise Bedrock-Installation unter Windows ergänzt:
  Installationsdatei beziehen, importieren, beide Pakete aktivieren, Vögel finden
  sowie Hilfe bei Problemen, Ausschalten und Aktualisieren.

- Eigenständiges Repository `minecraft-addons` mit eigenen Projektvorgaben,
  Entwicklungs-/Release-Skills, CI und Releaseleitfaden. Das Grafikprojekt
  `minecraft-look` bleibt optional und wird nicht für Builds oder Tests benötigt.
- Source-ZIP enthält Lizenz, Projektvorgaben und vollständige Releaseunterlagen;
  macOS-Metadaten werden nicht gepackt.

## [0.1.0] - Testkandidat, Veröffentlichung nicht nachgewiesen

Bestandsbeschreibung beim Einführen dieses Changelogs: fünf Vogelarten in sechs
Exemplaren je Gruppe, maximal 18 geladene Vögel, stummer Tag-/Overworld-Controller,
Ressourcen- und Verhaltenspaket. Details und ausstehende Windows-Prüfungen stehen
in README und `docs/VALIDATION.md`. Keine bestätigte Freigabe im Spiel.
