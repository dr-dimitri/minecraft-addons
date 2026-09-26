# Forellen, Karpfen und Hechte auf Windows prüfen

Diese Prüfung gehört zum Releasekandidaten `0.2.0`. Der alte
Kandidat `birds-v0.1.1` enthält keine Fische. Vor einer Abnahme Quellcommit,
neue Kandidatenversion, CI-Lauf und SHA-256 der tatsächlich installierten Datei
nach [releases/TEMPLATE.md](releases/TEMPLATE.md) festhalten. Lokale Tests und die
[Modellvorschau](PREVIEW.svg) führen Bedrock nicht aus.

1. Beide Pakete in einer neuen Windows-Testwelt aktivieren. Im Content-Log dürfen
   keine Fehler zu `trout`, `carp`, `pike`, Skripten, Texturen, Emission oder
   Schwimmanimationen auftreten. Zunächst keine weiteren Grafikpakete aktivieren.
2. Tagsüber an einem freien Seeufer oder einem mindestens etwa 5 × 5 Blöcke
   breiten, zwei Blöcke tiefen Quellwasserbecken warten. Zwei Forellen und zwei
   Karpfen sollen erscheinen. Formen, Muster und Flossenbewegung vergleichen.
3. Dämmerung und Nacht prüfen: Ab Tick 11500 übernehmen zwei dunkle Hechte mit
   gelben Leuchtaugen. Ab Tick 500 erscheinen wieder Tagesfische. Augen aus
   mehreren Richtungen ansehen; der übrige Körper soll normal beleuchtet sein.
   Umgebende Blöcke werden durch die Augen nicht beleuchtet.
4. Mindestens zwei Minuten Schwimmen beobachten. Körper, Flossen und Schwanz
   müssen vollständig unter Wasser bleiben und zu Bewegung/Blickrichtung passen.
   Keine Fische durch Ufer, Boden oder Hindernisse; keine überholenden Fische
   durch andere Körper. Den sichtbaren Gruppenwechsel nach 45 Sekunden notieren.
5. Flache Pfütze, enge Rinne, dünnen Wasserstrom, Lava und wassergefüllte Treppen
   testen. Diese sind keine gültigen Schwimmräume. In einem freien Becken neben
   Wasserpflanzen prüfen; Pflanzen dürfen konservativ als Hindernisse gelten.
6. Wasser um einen Fisch entfernen oder einen festen Block in seinen Körper-
   beziehungsweise nächsten Schwimmbereich setzen. Er soll entfernt werden und
   nicht an Land schweben. Auch Wasser knapp unter der Oberfläche entfernen.
7. In tieferem Wasser tauchen, eine Unterwasserhöhle sowie negative Koordinaten
   prüfen. Fische dürfen nur im geladenen Wasserbereich erscheinen. Danach weit
   weggehen, zurückkehren, speichern/laden und die Dimension wechseln.
8. Vanilla-Fische und andere Add-ons bleiben unangetastet. Unsere Fische bleiben
   stumm, greifen nicht an und geben weder Beute noch Erfahrung; Eimerfang ist
   nicht vorgesehen. Im Nether/Ende erscheinen keine Add-on-Fische.
9. Wenn möglich Mehrspieler prüfen: nahe Spieler teilen einen Schwarm, höchstens
   drei Gruppen und zwölf geladene Fische; nachts normalerweise sechs Hechte.
   Gleichzeitig die Vogelgrenzen von 18 geladenen Tieren prüfen.
10. Mit denselben Grafikeinstellungen Bildrate und Ruckler mit/ohne Add-on messen,
    besonders bei gleichzeitigen Vogel- und Fischgruppen. Optionale Grafikpakete
    separat prüfen. Ergebnisse samt Bedrock-Version, Hardware und Content-Log
    festhalten; es gibt noch keine bestätigte Performance-Zusage.
