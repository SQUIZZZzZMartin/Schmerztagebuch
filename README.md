# Schmerztagebuch

Web-App für Mirkos Schmerztagebuch: Einträge mit Uhrzeit, Schmerzstärke (1–10), Körperstelle, Aktion,
Stimmung, Stress, Schmerzart, Dauer, Medikament und Notiz. Tagesverlauf als Kurve, Wochenleiste,
Export als CSV (Excel) oder JSON, Import von JSON-Exporten. Einträge lassen sich antippen, bearbeiten und löschen.

Ursprünglich von Jonas als Claude-Artifact gebaut; seit November 2026 hier auf GitHub Pages mit Firebase.

- **Seite:** https://squizzzzzmartin.github.io/Schmerztagebuch/
- **Firebase-Projekt:** `schmerztagebuch-3f45b` (Spark-Tarif, kostenlos), Firestore in `europe-west3` (Frankfurt)

## Aufbau
| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche und Gestaltung |
| `app.js` | Logik: Einträge, Kurve, Export, Import, Firebase-Anbindung |
| `firebase-config.js` | Firebase-Zugangsdaten (öffentlich, kein Geheimnis) und Tagebuch-Name |
| `firestore.rules` | Sicherheitsregeln – Kopie dessen, was in der Firebase-Konsole veröffentlicht ist |

Kein Build-Schritt: Änderungen pushen, GitHub Pages veröffentlicht automatisch.

## Daten in Firestore
`diaries/mirko/days/<JJJJ-MM-TT>` = `{ date, entries: [...], updatedAt }` – ein Dokument pro Tag.
Ein Tag ohne Einträge wird gelöscht. Firestore speichert offline zwischen, Einträge ohne Netz werden später übertragen.

## Sicherheit – aktueller Stand (Schritt 1: Testphase)
Die App meldet sich unsichtbar anonym bei Firebase an. Die Regeln erlauben nur den Bereich `diaries/mirko`
und prüfen das Datenformat. **Wer den Link kennt, kann die Einträge lesen und ändern.**

## Schritt 2: Anmeldung mit E-Mail + Passwort (geplant)
1. Firebase-Konsole → Authentication → Anmeldemethode → „E-Mail-Adresse/Passwort“ aktivieren.
2. Unter Authentication → Nutzer Mirkos Konto anlegen.
3. In `app.js` statt `signInAnonymously` ein Login-Formular (`signInWithEmailAndPassword`) + „Passwort vergessen“.
4. In `firestore.rules` `request.auth != null` ersetzen durch `request.auth.token.email == '<Mirkos E-Mail>'`
   (bzw. `request.auth.uid == '<UID>'`), danach anonyme Anmeldung wieder deaktivieren.

Die Daten bleiben am selben Ort; es ist keine Umstellung nötig.

## Lokal testen
`python3 -m http.server` im Ordner starten. Mit `firebaseConfig = null` läuft die App im Testmodus und speichert nur im Browser.
