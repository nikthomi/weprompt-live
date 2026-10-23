# WePrompt Live

Interaktive Abstimmungen für WePrompt-Workshops unter **live.weprompt.ch** – eine schlanke Mentimeter-Alternative. Die Kursleitung zeigt einen QR-Code, Teilnehmende antworten ohne Konto auf dem Handy, die Ergebnisse erscheinen sofort auf dem Beamer.

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, Supabase (Postgres mit RLS, Auth, Realtime), Vercel. QR-Codes mit `qrcode`, Wortwolke mit `d3-cloud`, Sortieren mit `@dnd-kit`, PNG-Export mit `html-to-image`.

## Drei Oberflächen

| Ansicht | Adresse | Zugriff |
|---|---|---|
| Teilnahme (mobil) | `/` (Code eingeben), `/join/ABC123` | ohne Login |
| Präsentation (Beamer) | `/present/<geheimer Token>` | ohne Login, nur wer den Link hat; keine Admin-Funktionen |
| Admin | `/admin` – Sessions, Fragen-Editor, Live-Steuerung, Ergebnisse, Team | Supabase-Login + Eintrag in `live_admins` |

Live-Steuerung per Tastatur: ← → Fragen wechseln · O Abstimmung öffnen/schliessen · E Ergebnisse zeigen/ausblenden · Q QR-Code auf dem Beamer. Auf dem Beamer: F = Vollbild.

## Fragetypen

| Typ | Eingabe am Handy | Darstellung | Konfiguration |
|---|---|---|---|
| Wortwolke | 1–5 Begriffe (je max. 40 Zeichen) | Wortwolke ohne Überlappung, häufige Begriffe grösser; Gross-/Kleinschreibung und Leerzeichen werden zusammengefasst | Begriffe pro Person; Begriffe lassen sich live ausblenden |
| Multiple Choice | Auswahlkacheln | animierte Balken mit Stimmen und Prozent | 2–12 Optionen, Einfach- oder Mehrfachauswahl, max. auswählbar |
| Ja/Nein | zwei grosse Kacheln | zwei grosse Prozentzahlen über geteiltem Balken | – |
| Skala | Zahlenkacheln | Säulen pro Wert, Durchschnitt gross und als Markierung | 1–5 oder 1–10, Beschriftung der Enden |
| Offene Frage | Textfeld (20–500 Zeichen) | Antwortkarten als Sprechblasen, neue Karten blenden ein | Länge, Zurückhalten bis zur Freigabe; Antworten ausblenden/löschen |

Bei Mehrfachauswahl beziehen sich die Prozente auf die Personen, die abgestimmt haben (Summe kann über 100 % liegen); das steht auch unter dem Diagramm.

## Architektur

```
Handy ──GET /api/join/CODE──┐                       ┌── Realtime «live:<session>»  ──► Handys, Beamer, Admin
      ──POST /api/answer────┤  Next.js (Vercel)     │     (vollständiger öffentlicher Zustand)
Beamer ─GET /api/present/T──┤  Service Role ──► Postgres-Funktionen ──┤
Admin ── Supabase-Session (RLS) ───────────────────► Tabellen live_*  └── Realtime «live-results:<session>»
                                                                           (nur «neue Antwort») ──► Beamer, Admin
```

- **Teilnehmende haben keinen Datenbankzugang.** Alles läuft über drei Server-Routen, die security-definer-Funktionen aufrufen (`live_join`, `live_submit`, `live_present`). Diese prüfen jede Eingabe selbst; die Routen prüfen zusätzlich die Form (zod).
- **Admins** arbeiten mit ihrer Session; Row Level Security erlaubt nur Personen in `live_admins`.
- **Realtime:** Datenbank-Trigger senden bei jeder Zustandsänderung den öffentlichen Zustand auf einen *privaten* Kanal. Clients dürfen mithören (Policy auf `realtime.messages`), aber nicht senden. Ein Fragewechsel erreicht die Handys deshalb ohne zusätzliche Abfrage.
- **Ergebnisse gedrosselt:** Für jede Antwort geht nur ein kurzer Hinweis an Beamer und Admin; diese laden das aggregierte Ergebnis höchstens alle 0,7–0,8 s neu (eine Abfrage statt einer pro Stimme). Handys bekommen diese Hinweise nicht.
- **Ausfallsicher:** Ohne Realtime-Verbindung fragen alle Ansichten alle 3–4 s nach; beim Wiederverbinden und beim Zurückkehren in den Tab wird der Zustand neu geladen (Handys mit zufälliger Verzögerung bis 0,6 s, damit nicht alle gleichzeitig kommen). `state_version` verhindert, dass verspätete Meldungen einen neueren Zustand überschreiben.

## Datenmodell (`supabase/migrations/20261023100000_live.sql`)

| Tabelle | Inhalt |
|---|---|
| `live_admins` | `user_id` (auth.users), E-Mail, Rolle `admin` (zusätzlich Team und Löschen) oder `moderator` |
| `live_sessions` | Titel, Beschreibung, Datum, Status (`draft` / `live` / `ended` / `archived`), 6-stelliger Code ohne verwechselbare Zeichen, geheimer Präsentations-Token, Live-Zustand (aktuelle Frage, Abstimmung offen, Ergebnisse sichtbar, QR-Code), `state_version` |
| `live_questions` | Session, Position, Typ, Text, Zusatztext, Konfiguration (JSON), aktiv |
| `live_participants` | anonyme Gerätekennung je Session (für «x Personen dabei») |
| `live_responses` | eine Zeile pro Gerät und Frage – **`unique (question_id, participant_id)`**; Wert (JSON), Moderationsstatus |
| `live_hidden_words` | ausgeblendete Begriffe einer Wortwolke |
| `live_rate_limits` | Zähler für Rate Limits (unlogged, wird stündlich ausgedünnt) |

Das Projekt teilt sich die Supabase-Instanz mit Anmelde-Tool und Kursportal, ist aber unabhängig: nur `live_`-Objekte, keine Verweise auf andere Tabellen. Gemeinsam ist nur `auth.users` (dieselben Logins).

## Sicherheit und Datenschutz

- **Mehrfachabstimmungen:** Jedes Gerät erhält beim Beitritt eine zufällige UUID (nur im Browser gespeichert). Die Datenbank erlaubt pro Frage genau eine Antwort pro Kennung (Unique-Constraint, `on conflict do nothing`); Wiederholungen werden als «doppelt» bestätigt, zählen aber nicht. **Kein Schutz gegen Absicht:** Ein anderer Browser oder ein privates Fenster ergibt eine neue Kennung.
- **Rate Limits:** 30 Antworten pro Minute und Gerät, 1500 pro Minute und Netz (gemeinsames WLAN im Kursraum!). Die Netz-Kennung ist ein gesalzener Hash der IP, die IP selbst wird nie gespeichert. Dazu ein Honeypot-Feld und Grössenlimits.
- **Serverseitige Validierung:** `live_normalize_answer` prüft jede Antwort gegen die Frage (gültige Optionen, Anzahl, Skalenbereich, Länge) und bereinigt Text (Steuerzeichen, Leerraum). Antworten werden nur für die aktive Frage bei offener Abstimmung angenommen.
- **XSS:** Freitext wird als reiner Text gespeichert und von React escaped; nirgends wird Nutzer-HTML gerendert. CSV-Exporte entschärfen Formeln (`=`, `+`, `-`, `@`).
- **Öffentliche Endpunkte** liefern nur den öffentlichen Zustand und aggregierte Ergebnisse, nie Einzelantworten mit Kennung, nie Admin-Daten. Zurückgehaltene und ausgeblendete Antworten erreichen den Beamer nicht. Ergebnisse gibt der Beamer nur aus, wenn sie eingeblendet sind.
- **Präsentationslink** ist ein 244-Bit-Zufallstoken, getrennt vom Teilnahmecode, und wird mit `Referrer-Policy: no-referrer` ausgeliefert.
- **Header:** HSTS, `nosniff`, `X-Frame-Options: DENY` (ausser Beamer), eingeschränkte Permissions-Policy.
- **Datensparsamkeit (DSG):** Keine Namen, keine E-Mail-Adressen, keine IPs von Teilnehmenden. Im Export erscheinen Teilnehmende als T1, T2 … Gelöschte Sessions löschen alle zugehörigen Antworten (Cascade). Empfehlung: Sessions nach der Auswertung archivieren und nicht mehr benötigte löschen.

## Tests

```bash
npm test                                          # 24 Datenbanktests (PGlite, ohne Zugangsdaten)
npm run loadtest -- http://localhost:3010 100     # Lasttest gegen eine laufende Instanz
```

Die Datenbanktests (`tests/db/live.test.ts`) laufen in PGlite mit einem Nachbau der Supabase-Umgebung: Validierung je Fragetyp, Doppelabgaben, geschlossene Abstimmungen, Rate Limit, 100 gleichzeitige Stimmen, Realtime-Meldungen, Rechte von anon / eingeloggt / Moderation / Admin, Duplizieren, Zurücksetzen, Sortieren, Moderation.

### Lasttest mit 100 Teilnehmenden (23.10.2026, lokale Instanz gegen das produktive Supabase-Projekt)

Jede simulierte Person tritt über `/api/join` bei und hält eine eigene Realtime-Verbindung. Pro Frage: aktivieren, alle 100 antworten gleichzeitig, jede Person sendet ein zweites Mal, dann wird in der Datenbank nachgezählt.

| Messung | Ergebnis |
|---|---|
| 100 Beitritte gleichzeitig | 0 Fehler, median 578 ms |
| 100 Realtime-Verbindungen | in 0,5 s aufgebaut |
| Fragewechsel bis zu allen 100 Handys | 100/100 erhalten, median 86–181 ms, max 185 ms |
| 100 gleichzeitige Antworten | 0,4–0,5 s für alle, median 266–374 ms, p95 ≤ 504 ms |
| 100 Wiederholungen | alle als «doppelt» bestätigt, keine zusätzliche Stimme |
| Nachgezählt | 100 von 100 bei allen vier Fragetypen |
| Antwort nach dem Schliessen | abgelehnt (HTTP 409) |

In einem von fünf Läufen schlug eine einzelne Wiederholung mit HTTP 500 fehl (nicht reproduzierbar, Stimme war bereits gezählt). Die Route protokolliert solche Fälle jetzt. Mehrere Läufe direkt hintereinander vom selben Rechner lösen erwartungsgemäss das Netz-Rate-Limit aus (HTTP 429); zwischen zwei Läufen eine Minute warten.

## Einrichtung

1. **Datenbank:** `supabase/migrations/20261023100000_live.sql` im SQL-Editor des WePrompt-Supabase-Projekts ausführen (am 23.10.2026 erledigt).
2. **Umgebung:** `.env.example` nach `.env.local` kopieren und ausfüllen (gleiche Supabase-Werte wie Anmelde-Tool/Kursportal).
3. **Erste Admin-Person:** `npm run admin -- info@deeds.ch` – legt das Konto an (falls nötig), macht es zum Admin und gibt einen Link zum Passwortsetzen aus (1 Stunde gültig). Weitere Personen danach im Admin unter «Team»; sie setzen ihr Passwort über «Passwort vergessen».
4. **Lokal:** `npm install && npm run dev` (Port 3000). `/dev/vorschau` zeigt alle Beamer-Zustände mit Beispieldaten (nur Entwicklung).

### Vercel und Domain

1. Neues Vercel-Projekt aus diesem Repository (Framework Next.js, Region `fra1` via `vercel.json`).
2. Umgebungsvariablen aus `.env.example` setzen, `NEXT_PUBLIC_APP_URL=https://live.weprompt.ch`, eigener `RATE_LIMIT_SALT`.
3. Domain `live.weprompt.ch` im Vercel-Projekt hinzufügen; bei Hostpoint einen CNAME `live` → `cname.vercel-dns.com` anlegen.
4. Für Passwort-Mails: `RESEND_API_KEY` (Domain weprompt.ch ist bei Resend verifiziert) und `LIVE_FROM_EMAIL`.

Supabase Auth braucht keine zusätzliche Redirect-URL: Die Passwort-Links laufen über `/auth/confirm` mit `token_hash`.

## Betrieb und Wartung

- **Kapazität:** Jedes Handy hält eine Realtime-Verbindung. Supabase Free erlaubt 200 gleichzeitige Verbindungen pro Projekt, Pro 500 – das Kontingent teilt sich Live mit Kursportal und Anmelde-Tool. Für Workshops mit 10–100 Personen reicht beides; bei mehreren grossen Sessions gleichzeitig den Plan prüfen. Nachrichten: pro Fragewechsel eine Nachricht je Handy, pro Antwort eine je Beamer/Admin.
- **Vor dem Workshop:** Session duplizieren statt neu bauen, Fragen kurz durchklicken, Präsentation im zweiten Fenster öffnen (F = Vollbild), QR-Code zum Start zeigen.
- **Nach dem Workshop:** Session beenden, Ergebnisse exportieren (CSV, PNG je Frage), dann archivieren.
- **Zurücksetzen** löscht alle Antworten einer Session (z. B. nach einem Probedurchlauf).
- **Aktualisieren:** Next.js-Hinweise in `AGENTS.md` beachten (Version 16 mit geänderten APIs). Nach Änderungen an der Migration `npm test`, vor Workshops `npm run loadtest`.
- **Grenzen:** Kein Schutz gegen absichtliche Mehrfachteilnahme mit mehreren Browsern. Antworten lassen sich nach dem Absenden nicht ändern. Die Wortwolke zeigt höchstens 120 Begriffe, die Kartenansicht die neuesten 40 freigegebenen Antworten.

## Projektstruktur

```
supabase/migrations/      Schema, Funktionen, RLS, Realtime-Policy
tests/db/                 Datenbanktests in PGlite mit Supabase-Nachbau
scripts/                  make-admin.mjs, loadtest.mjs, rt-check.mjs (Realtime-Probe)
src/proxy.ts              Session-Erneuerung und Login-Weiterleitung für /admin
src/lib/                  Typen, Supabase-Clients, Realtime-Hook, CSV, Validierung
src/app/join/[code]/      Teilnehmer-App
src/app/present/[token]/  Beamer
src/app/api/              join, answer, present (öffentlich, Service Role)
src/app/admin/            Sessions, Editor, Live-Steuerung, Ergebnisse, Export, Team
src/components/results/   Wortwolke, Balken, Ja/Nein, Skala, Antwortkarten
src/components/Stage.tsx  Bühne für Beamer und Admin-Vorschau
```
