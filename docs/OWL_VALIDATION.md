# Eulen und Uhus im Entwicklungsstand prüfen

Diese zusätzliche Prüfung gilt für die neue Nachtfunktion unter `Unreleased`.
Der bisherige Kandidat `birds-v0.1.1` enthält sie noch nicht. Vor einer neuen
Abnahme den verwendeten Quellcommit, die neue Kandidatenversion und SHA-256 der
tatsächlich installierten Datei nach [releases/TEMPLATE.md](releases/TEMPLATE.md)
festhalten. Die alten Nachweise werden nicht auf diesen Stand übertragen.

Noch offen: Import, Content-Log, Darstellung der TGA-Texturen, Augenleuchten,
Animationsübergänge und tatsächliche Flugruhe in Minecraft Bedrock.

## Zusätzliche Schritte in einer Windows-Testwelt

1. Beide Pakete aktivieren und zunächst keine zusätzlichen Grafikpakete nutzen.
   Im Content-Log nach Fehlern zu `owl`, `eagle_owl`, `perched`, Texturen,
   Materialien, Geometrie und Animationscontrollern suchen.
2. Tagsüber auf einer freien Fläche die bisherigen fünf Arten beobachten.
   Eulen und Uhus sollen zwischen Tageszeit-Tick 500 und vor 11500 fehlen.
3. Zur Dämmerung an einen Waldrand gehen. Ab Tick 11500 soll eine Nachtgruppe
   mit einer Eule und einem größeren Uhu entstehen; die Tagvögel verschwinden.
   Auch direkt unter einer freien Baumkrone testen. In geschlossenen Gebäuden
   und Höhlen unter Bäumen sollen keine neuen Gruppen entstehen. Zusätzlich
   schleichend unter einer niedrigen Decke aus oberen Stufen mit Laub darüber
   prüfen. Auch tagsüber darf dort keine Gruppe entstehen. Hohes Gras auf
   freiem Gelände oder unter einer freien Baumkrone soll Gruppen weiter zulassen.
4. Eine einzelne breite Baumkrone und einen Wald prüfen. Beide Tiere benötigen
   jeweils einen freien Laubplatz mit zwei Luftblöcken darüber. Fehlen passende
   Sitzplätze in der Nähe, darf keine Nachtgruppe entstehen. Dachziegel, Stein
   oder andere feste Blöcke sind keine Sitzplätze. Eine geeignete hohe Krone
   muss auch dann zwei Plätze liefern können, wenn ein deutlich niedrigerer
   Nachbarbaum für die vorgesehene Flughöhe ungeeignet ist.
5. Mindestens zwei Minuten beobachten: Sitzen mit angelegten Flügeln, sanftes
   Aufsteigen, Rundflug, Absenken und erneutes Sitzen. Füße sollen auf dem Laub
   stehen; keine dauerhaft schlagenden Flügel im Sitzen oder abgetrennten Körperteile.
   Der 40-Sekunden-Zyklus läuft für die beiden Tiere versetzt. Nach höchstens
   45 Sekunden wird die Gruppe ersetzt; einen sichtbaren Wechsel dokumentieren.
6. Augen aus der Nähe bei Dunkelheit ansehen: Beide Arten sollen zwei rote,
   selbstleuchtende Augen zeigen; der übrige Körper bleibt normal beleuchtet.
   Keine Beleuchtung der umliegenden Blöcke erwarten. Standardgrafik und ein
   optional genutztes Grafikprofil getrennt prüfen, inklusive Content-Log.
7. Den Laubblock unter einem sitzenden Vogel entfernen oder den freien Sitzplatz
   blockieren. Der betroffene Vogel soll spätestens bei der nächsten Sitzprüfung
   nach ungefähr einer Sekunde verschwinden und nicht dauerhaft schweben.
8. Sonnenaufgang beobachten: Bis vor Tick 500 dürfen Nachtvögel erscheinen;
   ab 500 werden sie entfernt und an freien Standorten wieder Tagvögel erzeugt.
9. Während einer Nachtgruppe speichern/laden, weit weggehen/zurückkehren sowie
   die Dimension wechseln. Keine Vervielfachung, keine Vögel im Nether/Ende.
   Geräuschfreiheit prüfen. Falls möglich mehrere Spieler testen: höchstens
   drei Gruppen, nachts normalerweise sechs Tiere, insgesamt nie mehr als
   18 geladene Vögel einschließlich noch nicht entfernbarer Altentitäten.

Bedrock-Version, Grafikprofil, aktivierte Pakete, genaue Fehlermeldungen und
Beobachtungen gemeinsam zurückmelden. Die allgemeinen Prüfungen einschließlich
Leistungsmessung stehen in [VALIDATION.md](VALIDATION.md). Die statische
[Modellvorschau](PREVIEW.svg) zeigt Formen und Posen, aber kein Engine-Rendering.
