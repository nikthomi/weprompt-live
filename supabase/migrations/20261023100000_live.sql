-- ═══════════════════════════════════════════════════════════════════════════
-- WePrompt Live – interaktive Abstimmungen für Workshops
--
-- Läuft im selben Supabase-Projekt wie Anmelde-Tool und Kursportal, ist aber
-- von beiden unabhängig: alle Objekte tragen das Präfix live_, es gibt keine
-- Verweise auf portal_- oder Anmelde-Tabellen. Gemeinsam ist nur auth.users
-- (dieselben Logins für Admins).
--
-- Grundsätze
-- - Teilnehmende sind anonym und haben keinen Datenbankzugang. Alles, was sie
--   tun, läuft über die Server-Routen der App (Service Role) und die
--   security-definer-Funktionen unten, die jede Eingabe selbst prüfen.
-- - Admins arbeiten mit ihrer Session; Row Level Security begrenzt sie auf
--   Personen in live_admins.
-- - Realtime: private Kanäle «live:<session>» (Zustand) und
--   «live-results:<session>» (nur «neue Antwort»). Senden kann nur die
--   Datenbank selbst; Clients können lediglich mithören.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- Admins
-- ───────────────────────────────────────────────────────────────────────────

create table public.live_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'moderator' check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now()
);
comment on table public.live_admins is 'WePrompt Live: wer Sessions verwalten darf. admin = zusätzlich Team verwalten und Sessions löschen.';

create or replace function public.live_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.live_admins where user_id = auth.uid())
$$;

create or replace function public.live_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.live_admins where user_id = auth.uid() and role = 'admin')
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Sessions und Fragen
-- ───────────────────────────────────────────────────────────────────────────

-- Kurzcode ohne verwechselbare Zeichen (kein 0/O, 1/I/L).
create or replace function public.live_generate_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.live_sessions where code = candidate);
  end loop;
  return candidate;
end $$;

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  -- Geheimer Link für die Präsentationsansicht (244 Bit Zufall).
  present_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (char_length(description) <= 2000),
  event_date date,
  status text not null default 'draft' check (status in ('draft', 'live', 'ended', 'archived')),
  -- Live-Zustand
  current_question_id uuid,
  voting_open boolean not null default false,
  results_visible boolean not null default false,
  show_qr boolean not null default false,
  auto_show_results boolean not null default true,
  state_version integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.live_sessions alter column code set default public.live_generate_code();
create index live_sessions_status_idx on public.live_sessions (status, created_at desc);

create table public.live_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  position integer not null default 0,
  type text not null check (type in ('wordcloud', 'choice', 'yesno', 'scale', 'open')),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (char_length(description) <= 1000),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_questions_session_idx on public.live_questions (session_id, position);

alter table public.live_sessions
  add constraint live_sessions_current_question_fk
  foreign key (current_question_id) references public.live_questions(id) on delete set null;

-- Gerät, das der Session beigetreten ist (anonyme Zufalls-ID aus dem Browser).
create table public.live_participants (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  participant_id uuid not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, participant_id)
);

-- Eine Antwort pro Gerät und Frage. Wortwolken speichern alle Begriffe einer
-- Person in einer Zeile, deshalb gilt die Regel für alle Fragetypen.
create table public.live_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  question_id uuid not null references public.live_questions(id) on delete cascade,
  participant_id uuid not null,
  value jsonb not null,
  status text not null default 'visible' check (status in ('visible', 'pending', 'hidden')),
  created_at timestamptz not null default now(),
  unique (question_id, participant_id)
);
create index live_responses_session_idx on public.live_responses (session_id);

-- Ausgeblendete Begriffe einer Wortwolke (Moderation).
create table public.live_hidden_words (
  question_id uuid not null references public.live_questions(id) on delete cascade,
  word_key text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, word_key)
);

-- Zähler für Rate Limits. unlogged: schnell, bei einem Neustart leer – genau richtig.
create unlogged table public.live_rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Zeitstempel und Zustandsversion
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger live_questions_touch before update on public.live_questions
  for each row execute function public.live_touch();

-- Jede Änderung am sichtbaren Zustand erhöht state_version. Clients verwerfen
-- dadurch veraltete Meldungen, die verspätet ankommen.
create or replace function public.live_sessions_before_update() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if (new.status, new.current_question_id, new.voting_open, new.results_visible, new.show_qr, new.title)
     is distinct from
     (old.status, old.current_question_id, old.voting_open, old.results_visible, old.show_qr, old.title)
     or new.state_version <> old.state_version then
    new.state_version := old.state_version + 1;
  end if;
  if new.status = 'live' and old.status <> 'live' then
    new.started_at := coalesce(new.started_at, now());
    new.ended_at := null;
  end if;
  if new.status = 'ended' and old.status <> 'ended' then
    new.ended_at := now();
    new.voting_open := false;
  end if;
  if new.status in ('draft', 'archived') then
    new.voting_open := false;
  end if;
  return new;
end $$;

create trigger live_sessions_before_update before update on public.live_sessions
  for each row execute function public.live_sessions_before_update();

-- Die aktuelle Frage muss zur Session gehören.
create or replace function public.live_sessions_check_question() returns trigger
language plpgsql as $$
begin
  if new.current_question_id is not null and not exists (
    select 1 from public.live_questions where id = new.current_question_id and session_id = new.id
  ) then
    raise exception 'Frage gehört nicht zu dieser Session' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger live_sessions_check_question before insert or update of current_question_id on public.live_sessions
  for each row execute function public.live_sessions_check_question();

-- ───────────────────────────────────────────────────────────────────────────
-- Öffentlicher Zustand: genau das, was Teilnehmende und Beamer sehen dürfen
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_public_state(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sessionId', s.id,
    'code', s.code,
    'title', s.title,
    'status', s.status,
    'votingOpen', s.voting_open and s.status = 'live',
    'resultsVisible', s.results_visible,
    'showQr', s.show_qr,
    'version', s.state_version,
    'question', case when s.status = 'live' and q.id is not null then jsonb_build_object(
      'id', q.id,
      'type', q.type,
      'title', q.title,
      'description', q.description,
      'config', q.config - 'internal',
      'number', (select count(*) from public.live_questions x where x.session_id = s.id and x.enabled and x.position <= q.position),
      'total', (select count(*) from public.live_questions x where x.session_id = s.id and x.enabled)
    ) end
  )
  from public.live_sessions s
  left join public.live_questions q on q.id = s.current_question_id
  where s.id = p_session_id
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Realtime
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_send(p_topic text, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform realtime.send(p_payload, p_event, p_topic, true);
  exception when others then
    -- Eine fehlgeschlagene Meldung darf nie eine Abstimmung verhindern.
    -- Die Clients holen den Zustand zusätzlich periodisch ab.
    raise warning 'live: Realtime-Meldung fehlgeschlagen: %', sqlerrm;
  end;
end $$;

create or replace function public.live_sessions_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.state_version <> old.state_version then
    perform public.live_send('live:' || new.id::text, 'state', public.live_public_state(new.id));
  end if;
  return null;
end $$;

create trigger live_sessions_broadcast after update on public.live_sessions
  for each row execute function public.live_sessions_broadcast();

-- Änderungen an Fragen einer laufenden Session (Text, Reihenfolge, aktiv):
-- Zustand neu senden, damit Handys und Beamer sofort die neue Fassung zeigen.
create or replace function public.live_questions_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions s set state_version = s.state_version + 1
  where s.status = 'live' and s.id in (select session_id from changed);
  return null;
end $$;

create trigger live_questions_changed_ins after insert on public.live_questions
  referencing new table as changed for each statement execute function public.live_questions_changed();
create trigger live_questions_changed_upd after update on public.live_questions
  referencing new table as changed for each statement execute function public.live_questions_changed();
create trigger live_questions_changed_del after delete on public.live_questions
  referencing old table as changed for each statement execute function public.live_questions_changed();

-- Neue oder moderierte Antwort: nur ein Hinweis an Beamer und Admin.
-- Die Ergebnisse holen sie gedrosselt selbst ab (eine Abfrage statt einer pro Stimme).
create or replace function public.live_responses_ping() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select distinct session_id, question_id from changed loop
    perform public.live_send('live-results:' || r.session_id::text, 'response', jsonb_build_object('questionId', r.question_id));
  end loop;
  return null;
end $$;

create trigger live_responses_ping_ins after insert on public.live_responses
  referencing new table as changed for each statement execute function public.live_responses_ping();
create trigger live_responses_ping_upd after update on public.live_responses
  referencing new table as changed for each statement execute function public.live_responses_ping();
create trigger live_responses_ping_del after delete on public.live_responses
  referencing old table as changed for each statement execute function public.live_responses_ping();

-- Ausgeblendete Begriffe: Beamer soll die Wortwolke neu laden.
create or replace function public.live_hidden_words_ping() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select distinct q.session_id, q.id from changed c join public.live_questions q on q.id = c.question_id loop
    perform public.live_send('live-results:' || r.session_id::text, 'response', jsonb_build_object('questionId', r.id));
  end loop;
  return null;
end $$;

create trigger live_hidden_words_ping_ins after insert on public.live_hidden_words
  referencing new table as changed for each statement execute function public.live_hidden_words_ping();
create trigger live_hidden_words_ping_del after delete on public.live_hidden_words
  referencing old table as changed for each statement execute function public.live_hidden_words_ping();

-- Mithören darf jede Person, die die Session-ID kennt (die gibt es erst nach dem
-- Beitritt mit dem Code). Die Kanäle tragen nur öffentliche Daten bzw. Hinweise.
-- Eine Policy zum Senden gibt es bewusst nicht.
create policy live_channels_listen on realtime.messages for select to anon, authenticated
  using (realtime.topic() ~ '^live(-results)?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

do $$ begin
  grant select on realtime.messages to anon;
exception when others then
  raise notice 'live: Rechte auf realtime.messages unverändert (%).', sqlerrm;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Rate Limit
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_rate_hit(p_key text, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into public.live_rate_limits as r (key, window_start, hits) values (p_key, win, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  -- Gelegentlich aufräumen.
  if random() < 0.01 then
    delete from public.live_rate_limits where window_start < now() - interval '1 hour';
  end if;
  return n <= p_limit;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Antworten prüfen und speichern
-- ───────────────────────────────────────────────────────────────────────────

-- Text bereinigen: Steuerzeichen weg, Leerraum zusammenfassen, trimmen.
create or replace function public.live_clean_text(p text) returns text
language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- Prüft eine Antwort gegen den Fragetyp und gibt die bereinigte Fassung zurück.
-- Ungültige Antworten lösen eine Exception mit errcode 22023 aus.
create or replace function public.live_normalize_answer(p_type text, p_config jsonb, p_value jsonb) returns jsonb
language plpgsql immutable as $$
declare
  ids text[];
  allowed text[];
  max_n integer;
  words text[] := '{}';
  w text;
  keys text[] := '{}';
  num numeric;
  lo integer;
  hi integer;
  txt text;
  max_len integer;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'invalid_answer' using errcode = '22023';
  end if;

  if p_type in ('choice', 'yesno') then
    if jsonb_typeof(p_value->'options') <> 'array' then raise exception 'invalid_answer' using errcode = '22023'; end if;
    select coalesce(array_agg(distinct x), '{}') into ids from jsonb_array_elements_text(p_value->'options') x;
    if p_type = 'yesno' then
      allowed := array['yes', 'no'];
      max_n := 1;
    else
      select coalesce(array_agg(o->>'id'), '{}') into allowed from jsonb_array_elements(coalesce(p_config->'options', '[]')) o;
      max_n := case when coalesce((p_config->>'multiple')::boolean, false)
                    then least(greatest(coalesce((p_config->>'maxChoices')::integer, cardinality(allowed)), 1), cardinality(allowed))
                    else 1 end;
    end if;
    if cardinality(ids) < 1 or cardinality(ids) > max_n or not (ids <@ allowed) then
      raise exception 'invalid_answer' using errcode = '22023';
    end if;
    return jsonb_build_object('options', to_jsonb(ids));
  end if;

  if p_type = 'scale' then
    if jsonb_typeof(p_value->'value') <> 'number' then raise exception 'invalid_answer' using errcode = '22023'; end if;
    num := (p_value->>'value')::numeric;
    lo := coalesce((p_config->>'min')::integer, 1);
    hi := coalesce((p_config->>'max')::integer, 5);
    if num <> trunc(num) or num < lo or num > hi then raise exception 'invalid_answer' using errcode = '22023'; end if;
    return jsonb_build_object('value', num::integer);
  end if;

  if p_type = 'wordcloud' then
    if jsonb_typeof(p_value->'words') <> 'array' then raise exception 'invalid_answer' using errcode = '22023'; end if;
    max_n := least(greatest(coalesce((p_config->>'maxWords')::integer, 1), 1), 10);
    for w in select public.live_clean_text(x) from jsonb_array_elements_text(p_value->'words') x loop
      continue when w = '';
      if char_length(w) > 40 then raise exception 'invalid_answer' using errcode = '22023'; end if;
      continue when lower(w) = any(keys);
      keys := keys || lower(w);
      words := words || w;
    end loop;
    if cardinality(words) < 1 or cardinality(words) > max_n then raise exception 'invalid_answer' using errcode = '22023'; end if;
    return jsonb_build_object('words', to_jsonb(words));
  end if;

  if p_type = 'open' then
    txt := public.live_clean_text(p_value->>'text');
    max_len := least(greatest(coalesce((p_config->>'maxLength')::integer, 280), 20), 500);
    if txt = '' or char_length(txt) > max_len then raise exception 'invalid_answer' using errcode = '22023'; end if;
    return jsonb_build_object('text', txt);
  end if;

  raise exception 'invalid_answer' using errcode = '22023';
end $$;

-- Beitritt per Code: registriert das Gerät und liefert den öffentlichen Zustand
-- plus, ob dieses Gerät die aktuelle Frage schon beantwortet hat.
create or replace function public.live_join(p_code text, p_participant_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.live_sessions;
  answered boolean := false;
begin
  select * into s from public.live_sessions where code = upper(btrim(p_code));
  if not found or s.status = 'archived' then
    return null;
  end if;
  if p_participant_id is not null then
    insert into public.live_participants (session_id, participant_id) values (s.id, p_participant_id)
    on conflict (session_id, participant_id) do update set last_seen_at = now();
    if s.current_question_id is not null then
      answered := exists (select 1 from public.live_responses where question_id = s.current_question_id and participant_id = p_participant_id);
    end if;
  end if;
  return public.live_public_state(s.id) || jsonb_build_object('answered', answered);
end $$;

-- Antwort abgeben. Gibt {ok, duplicate} oder {ok:false, error} zurück:
-- rate_limited | not_found | closed | invalid
create or replace function public.live_submit(p_question_id uuid, p_participant_id uuid, p_value jsonb, p_client_key text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q public.live_questions;
  s public.live_sessions;
  v jsonb;
  inserted integer;
begin
  if p_participant_id is null or p_question_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  -- Pro Gerät grosszügig, pro Netz (gemeinsames WLAN im Kursraum!) sehr grosszügig.
  if not public.live_rate_hit('p:' || p_participant_id::text, 30, 60) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if p_client_key is not null and not public.live_rate_hit('n:' || p_client_key, 1500, 60) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into q from public.live_questions where id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select * into s from public.live_sessions where id = q.session_id;
  if s.status <> 'live' or s.current_question_id is distinct from q.id or not s.voting_open or not q.enabled then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  begin
    v := public.live_normalize_answer(q.type, q.config, p_value);
  exception when sqlstate '22023' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end;

  insert into public.live_participants (session_id, participant_id) values (s.id, p_participant_id)
  on conflict (session_id, participant_id) do update set last_seen_at = now();

  insert into public.live_responses (session_id, question_id, participant_id, value, status)
  values (s.id, q.id, p_participant_id, v,
          case when q.type = 'open' and coalesce((q.config->>'moderation')::boolean, false) then 'pending' else 'visible' end)
  on conflict (question_id, participant_id) do nothing;
  get diagnostics inserted = row_count;

  return jsonb_build_object('ok', true, 'duplicate', inserted = 0);
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Ergebnisse
-- ───────────────────────────────────────────────────────────────────────────

-- p_admin = true: inklusive zurückgehaltener und ausgeblendeter Antworten
-- (mit Status) für die Moderation. Sonst nur, was auf den Beamer darf.
create or replace function public.live_question_results(p_question_id uuid, p_admin boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  q public.live_questions;
  respondents integer;
  result jsonb;
begin
  select * into q from public.live_questions where id = p_question_id;
  if not found then return null; end if;

  select count(*) into respondents from public.live_responses where question_id = q.id;

  if q.type in ('choice', 'yesno') then
    select coalesce(jsonb_object_agg(opt, n), '{}') into result from (
      select x as opt, count(*) as n
      from public.live_responses r, jsonb_array_elements_text(r.value->'options') x
      where r.question_id = q.id
      group by x
    ) t;
    return jsonb_build_object('type', q.type, 'respondents', respondents, 'counts', result);
  end if;

  if q.type = 'scale' then
    select coalesce(jsonb_object_agg(v, n), '{}') into result from (
      select (r.value->>'value') as v, count(*) as n from public.live_responses r where r.question_id = q.id group by 1
    ) t;
    return jsonb_build_object(
      'type', q.type, 'respondents', respondents, 'distribution', result,
      'average', (select round(avg((r.value->>'value')::numeric), 2) from public.live_responses r where r.question_id = q.id)
    );
  end if;

  if q.type = 'wordcloud' then
    select coalesce(jsonb_agg(jsonb_build_object('key', k, 'text', t, 'count', n, 'hidden', h) order by n desc, k), '[]') into result from (
      select g.k, g.t, g.n,
             exists (select 1 from public.live_hidden_words hw where hw.question_id = q.id and hw.word_key = g.k) as h
      from (
        select lower(w) as k, mode() within group (order by w) as t, count(*) as n
        from public.live_responses r, jsonb_array_elements_text(r.value->'words') w
        where r.question_id = q.id
        group by lower(w)
      ) g
      order by g.n desc, g.k
      limit 200
    ) t
    where p_admin or not h;
    return jsonb_build_object('type', q.type, 'respondents', respondents, 'words', result);
  end if;

  if q.type = 'open' then
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'text', r.value->>'text', 'status', r.status, 'at', r.created_at) order by r.created_at desc), '[]')
    into result
    from (
      select * from public.live_responses
      where question_id = q.id and (p_admin or status = 'visible')
      order by created_at desc
      limit 300
    ) r;
    return jsonb_build_object('type', q.type, 'respondents', respondents, 'items', result);
  end if;

  return null;
end $$;

-- Alles für eine Ansicht in einer Abfrage: Zustand, Zahlen, Ergebnis der aktuellen Frage.
create or replace function public.live_snapshot(p_session_id uuid, p_admin boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.live_sessions;
  show_results boolean;
begin
  select * into s from public.live_sessions where id = p_session_id;
  if not found then return null; end if;
  show_results := s.current_question_id is not null and (p_admin or s.results_visible);
  return public.live_public_state(s.id) || jsonb_build_object(
    'participants', (select count(*) from public.live_participants where session_id = s.id),
    'responses', case when s.current_question_id is null then 0
                      else (select count(*) from public.live_responses where question_id = s.current_question_id) end,
    'results', case when show_results then public.live_question_results(s.current_question_id, p_admin) end
  );
end $$;

-- Beamer: nur mit dem geheimen Präsentations-Token, nie mit Moderationsdaten.
create or replace function public.live_present(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid;
begin
  select id into sid from public.live_sessions where present_token = p_token and status <> 'archived';
  if sid is null then return null; end if;
  return public.live_snapshot(sid, false);
end $$;

-- Admin-Gegenstücke: prüfen selbst, ob die aufrufende Person Admin ist.
create or replace function public.live_admin_snapshot(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.live_is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  return public.live_snapshot(p_session_id, true);
end $$;

create or replace function public.live_admin_results(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.live_is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('questionId', q.id, 'results', public.live_question_results(q.id, true)) order by q.position), '[]')
    from public.live_questions q where q.session_id = p_session_id
  );
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Admin-Werkzeuge (laufen mit den Rechten der aufrufenden Person, also mit RLS)
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_duplicate_session(p_session_id uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  src public.live_sessions;
  new_id uuid;
begin
  select * into src from public.live_sessions where id = p_session_id;
  if not found then raise exception 'Session nicht gefunden' using errcode = 'P0002'; end if;
  insert into public.live_sessions (title, description, event_date, auto_show_results, created_by)
  values (left(src.title || ' (Kopie)', 160), src.description, null, src.auto_show_results, auth.uid())
  returning id into new_id;
  insert into public.live_questions (session_id, position, type, title, description, config, enabled)
  select new_id, position, type, title, description, config, enabled
  from public.live_questions where session_id = p_session_id;
  return new_id;
end $$;

-- security definer, weil Teilnehmende (live_participants) sonst nicht löschbar wären.
create or replace function public.live_reset_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.live_is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  delete from public.live_responses where session_id = p_session_id;
  delete from public.live_participants where session_id = p_session_id;
  delete from public.live_hidden_words where question_id in (select id from public.live_questions where session_id = p_session_id);
  update public.live_sessions
  set status = 'draft', current_question_id = null, voting_open = false, results_visible = false,
      show_qr = false, started_at = null, ended_at = null
  where id = p_session_id;
end $$;

-- Neue Reihenfolge in einer Anweisung (ein einziges Realtime-Update).
create or replace function public.live_reorder_questions(p_session_id uuid, p_ids uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.live_questions q set position = o.idx
  from unnest(p_ids) with ordinality as o(id, idx)
  where q.id = o.id and q.session_id = p_session_id and q.position is distinct from o.idx::integer;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ───────────────────────────────────────────────────────────────────────────

alter table public.live_admins enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_questions enable row level security;
alter table public.live_participants enable row level security;
alter table public.live_responses enable row level security;
alter table public.live_hidden_words enable row level security;
alter table public.live_rate_limits enable row level security;

create policy live_admins_read on public.live_admins for select to authenticated using (public.live_is_admin());
create policy live_admins_manage on public.live_admins for all to authenticated
  using (public.live_is_owner()) with check (public.live_is_owner());

create policy live_sessions_admin_read on public.live_sessions for select to authenticated using (public.live_is_admin());
create policy live_sessions_admin_insert on public.live_sessions for insert to authenticated with check (public.live_is_admin());
create policy live_sessions_admin_update on public.live_sessions for update to authenticated
  using (public.live_is_admin()) with check (public.live_is_admin());
create policy live_sessions_owner_delete on public.live_sessions for delete to authenticated using (public.live_is_owner());

create policy live_questions_admin on public.live_questions for all to authenticated
  using (public.live_is_admin()) with check (public.live_is_admin());

create policy live_participants_admin_read on public.live_participants for select to authenticated using (public.live_is_admin());

-- Antworten: Admins lesen, moderieren (Status) und löschen. Anlegen nur über live_submit.
create policy live_responses_admin_read on public.live_responses for select to authenticated using (public.live_is_admin());
create policy live_responses_admin_update on public.live_responses for update to authenticated
  using (public.live_is_admin()) with check (public.live_is_admin());
create policy live_responses_admin_delete on public.live_responses for delete to authenticated using (public.live_is_admin());

create policy live_hidden_words_admin on public.live_hidden_words for all to authenticated
  using (public.live_is_admin()) with check (public.live_is_admin());

-- live_rate_limits: keine Policy – nur die Funktionen oben greifen darauf zu.

-- Moderation darf nur den Status ändern, nie den Inhalt oder die Zuordnung.
create or replace function public.live_responses_guard() returns trigger
language plpgsql as $$
begin
  if (new.value, new.question_id, new.session_id, new.participant_id, new.created_at)
     is distinct from (old.value, old.question_id, old.session_id, old.participant_id, old.created_at) then
    raise exception 'Antworten können nur ein- oder ausgeblendet werden' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger live_responses_guard before update on public.live_responses
  for each row execute function public.live_responses_guard();

-- ───────────────────────────────────────────────────────────────────────────
-- Funktionsrechte: öffentliche Funktionen nur für die Service Role (Server)
-- ───────────────────────────────────────────────────────────────────────────

revoke execute on function public.live_generate_code() from public, anon, authenticated;
grant execute on function public.live_generate_code() to authenticated; -- Default beim Insert durch Admins
revoke execute on function public.live_public_state(uuid) from public, anon, authenticated;
revoke execute on function public.live_send(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.live_rate_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.live_join(text, uuid) from public, anon, authenticated;
revoke execute on function public.live_submit(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.live_question_results(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.live_snapshot(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.live_present(text) from public, anon, authenticated;
revoke execute on function public.live_admin_snapshot(uuid) from public, anon;
revoke execute on function public.live_admin_results(uuid) from public, anon;
revoke execute on function public.live_duplicate_session(uuid) from public, anon;
revoke execute on function public.live_reset_session(uuid) from public, anon;
revoke execute on function public.live_reorder_questions(uuid, uuid[]) from public, anon;
grant execute on function public.live_join(text, uuid), public.live_submit(uuid, uuid, jsonb, text),
  public.live_present(text), public.live_public_state(uuid), public.live_question_results(uuid, boolean),
  public.live_snapshot(uuid, boolean), public.live_rate_hit(text, integer, integer) to service_role;

-- Tabellen: anon hat keinerlei Zugriff (RLS ohne anon-Policy, zusätzlich Rechte entziehen).
revoke all on public.live_admins, public.live_sessions, public.live_questions, public.live_participants,
  public.live_responses, public.live_hidden_words, public.live_rate_limits from anon;
revoke all on public.live_rate_limits from authenticated;
