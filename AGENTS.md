<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Übergabe für Coding-Agents (Codex, Claude Code u. a.)

WePrompt Live ist eine schlanke Mentimeter/Kahoot-Alternative für WePrompt-Workshops (Marke von deeds). Live unter **https://live.weprompt.ch**. Ausführliche Beschreibung, Datenmodell, Sicherheit und Messwerte: `README.md`. Diese Datei sagt, wie man hier arbeitet.

## Befehle

```bash
npm install
npm test            # 35 Datenbanktests in PGlite – brauchen keine Zugangsdaten
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (inkl. React-Compiler-Regeln, siehe unten)
npm run build
npm run dev         # braucht .env.local (siehe .env.example)
```

Vor jedem Commit: `npm test`, `npm run typecheck`, `npm run lint` müssen grün sein.

## Architektur in fünf Sätzen

- Next.js 16 (App Router), TypeScript, Tailwind 4, Supabase (Postgres + RLS, Auth, Realtime, Storage), Vercel (Region fra1).
- Teilnehmende sind anonym und haben **keinen** Datenbankzugang: Sie sprechen nur mit `src/app/api/{join,answer,present}`, die per Service Role security-definer-Funktionen aufrufen (`live_join`, `live_submit`, `live_present`). Diese Funktionen prüfen jede Eingabe selbst.
- Admins arbeiten mit ihrer Supabase-Session; RLS erlaubt nur Personen in `live_admins`.
- Realtime: DB-Trigger senden den öffentlichen Zustand auf private Kanäle `live:<session>` (Zustand) und `live-results:<session>` (nur «neue Antwort»). Clients hören nur zu; Ergebnisse werden gedrosselt nachgeladen.
- Fragetypen: `wordcloud`, `choice`, `yesno`, `scale`, `open`, `quiz` (zwei frei beschriftbare Antworten, Timer, Bild, Auflösung), `board` (manuelle Wortwolke: Leinwand mit Begriffen und Kategorien).

Wichtige Orte: `supabase/migrations/` (Schema, Funktionen, RLS), `src/lib/types.ts` (alle Formen), `src/components/Stage.tsx` (Beamer und Admin-Vorschau), `src/app/join/[code]/Participant.tsx` (Handy), `src/app/admin/sessions/[id]/live/LiveControl.tsx` (Live-Steuerung), `src/components/board/` (Leinwand).

## Regeln, die man leicht bricht

1. **Datenbank nur über neue Migrationen ändern.** Nie eine bestehende Migration editieren, sondern eine neue Datei `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` anlegen und Tests dazu in `tests/db/` schreiben. Es gibt keinen CLI-Zugang zur Produktion: Die Migration führt eine Person im Supabase-SQL-Editor (Projekt «weprompt») aus. **Erst die Migration, dann deployen** – sonst trifft neuer Code auf die alte Datenbank.
2. **Geteiltes Supabase-Projekt.** Dieselbe Instanz nutzen das Anmelde-Tool (registration.weprompt.ch) und das Kursportal (workshop.weprompt.ch). Hier nur Objekte mit Präfix `live_` anlegen oder ändern; nichts an `portal_*`, `events`, `registrations` usw.
3. **Nichts Geheimes an Teilnehmende.** Was über `live_public_state` und Realtime geht, sieht jede Person mit dem Code. Die richtige Quiz-Antwort (`config.correct`) wird dort bis zur Auflösung entfernt – neue geheime Felder genauso behandeln.
4. **Deploy = `git push origin main`.** Vercel baut automatisch. Keine Vercel-CLI verwenden.
5. **Keine Zugangsdaten ins Repo.** `.env*` ist ignoriert (ausser `.env.example`).
6. **Next.js 16:** `params`/`searchParams` sind Promises, Middleware heisst `src/proxy.ts`. Im Zweifel `node_modules/next/dist/docs/` lesen.
7. **React-Compiler-Lint ist streng:** kein `setState` direkt im Effect-Body, kein `Date.now()`/Zufall beim Rendern, keine Refs beim Rendern lesen. Muster im Code: Werte in Event-Callbacks setzen, `useSyncExternalStore` für Browser-Speicher (siehe `src/lib/participant.ts`), Zeit über `src/lib/clock.ts`.
8. **Hydration:** Teilnehmer-Seiten werden auf dem Server gerendert. Nichts aus `localStorage` in die erste Darstellung.

## Design

Das WePrompt-Designsystem ist verbindlich (Werte in `src/app/globals.css`): violett `#6B11FE` als Grund, amber `#F6CA70` für Inhalte/Daten, coral `#F64462` **nur** für Handlungen (Buttons), mist `#F2F0ED`, black `#1E1E1E`. Titel in Bricolage Grotesque, Text in Inter. Keine Schatten, keine Verläufe. Der Kunde wünscht ein **ruhiges** Design: wenige Farben, viel Weissraum, keine deaktivierten coral Knöpfe (lieber ausblenden), Coral sparsam.

## Sprache

Oberfläche, Kommentare und Commit-Nachrichten auf Deutsch mit Schweizer Rechtschreibung: «ss» statt «ß», Anführungszeichen «…», Teilnehmende mit **du** ansprechen, keine Emojis. Markenname immer «WePrompt».

## Prüfen ohne Login

Nur im Entwicklungsmodus gibt es Vorschauen mit Beispieldaten: `/dev/vorschau` (alle Beamer-Zustände), `/dev/handy?z=choice|quiz|quiz-auf|board|…` (Handy), `/dev/steuerung` (Live-Steuerung), `/dev/leinwand` (Leinwand-Editor), `/dev/editor` (Quiz-Editor). Gegen die echte Instanz: `scripts/e2e-quiz-board.mjs` und `npm run loadtest` (beide brauchen die Service-Role-Variablen).
