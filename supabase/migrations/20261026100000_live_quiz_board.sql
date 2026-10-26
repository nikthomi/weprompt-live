-- ═══════════════════════════════════════════════════════════════════════════
-- WePrompt Live – Quiz (Richtig/Falsch mit Timer) und manuelle Wortwolke
--
-- quiz:  Aussage, optional mit Bild, richtige Antwort und Timer. Die richtige
--        Antwort bleibt bis zur Auflösung serverseitig verborgen.
-- board: Die Kursleitung schreibt Begriffe auf, verschiebt sie frei auf der
--        Leinwand und ordnet sie in Kategorien (Flächen). Keine Eingabe am Handy.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.live_questions drop constraint live_questions_type_check;
alter table public.live_questions add constraint live_questions_type_check
  check (type in ('wordcloud', 'choice', 'yesno', 'scale', 'open', 'quiz', 'board'));

-- Ende der Antwortzeit (Quiz mit Timer) und ob die Lösung gezeigt wird.
alter table public.live_sessions add column voting_deadline timestamptz;
alter table public.live_sessions add column reveal boolean not null default false;

-- ───────────────────────────────────────────────────────────────────────────
-- Manuelle Wortwolke: Begriffe und Kategorien auf der Leinwand
-- Koordinaten relativ zur 16:9-Fläche (0–1): Begriffe mit Mittelpunkt x/y,
-- Kategorien mit linker oberer Ecke x/y sowie Breite w und Höhe h.
-- ───────────────────────────────────────────────────────────────────────────

create table public.live_board_items (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.live_questions(id) on delete cascade,
  kind text not null check (kind in ('word', 'category')),
  text text not null check (char_length(btrim(text)) between 1 and 80),
  x real not null default 0.5 check (x between 0 and 1),
  y real not null default 0.5 check (y between 0 and 1),
  w real check (w is null or w between 0.05 and 1),
  h real check (h is null or h between 0.05 and 1),
  size smallint not null default 2 check (size between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_board_items_question_idx on public.live_board_items (question_id);

create trigger live_board_items_touch before update on public.live_board_items
  for each row execute function public.live_touch();

alter table public.live_board_items enable row level security;
create policy live_board_items_admin on public.live_board_items for all to authenticated
  using (public.live_is_admin()) with check (public.live_is_admin());
revoke all on public.live_board_items from anon;

-- Änderungen an der Leinwand: Hinweis an Beamer und Admin (wie bei Antworten).
create or replace function public.live_board_ping() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select distinct q.session_id, q.id from changed c join public.live_questions q on q.id = c.question_id loop
    perform public.live_send('live-results:' || r.session_id::text, 'response', jsonb_build_object('questionId', r.id));
  end loop;
  return null;
end $$;

create trigger live_board_ping_ins after insert on public.live_board_items
  referencing new table as changed for each statement execute function public.live_board_ping();
create trigger live_board_ping_upd after update on public.live_board_items
  referencing new table as changed for each statement execute function public.live_board_ping();
create trigger live_board_ping_del after delete on public.live_board_items
  referencing old table as changed for each statement execute function public.live_board_ping();

-- ───────────────────────────────────────────────────────────────────────────
-- Zustand: Timer und Auflösung werden in der Datenbank gesetzt, nicht im
-- Browser – so zählt für alle dieselbe Uhr.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_sessions_before_update() returns trigger
language plpgsql as $$
declare
  q_type text;
  q_seconds integer;
begin
  new.updated_at := now();

  -- Neue Frage oder Abstimmung wieder geöffnet: Lösung verbergen, Timer neu starten.
  if new.current_question_id is distinct from old.current_question_id
     or (new.voting_open and not old.voting_open) then
    new.reveal := false;
    new.voting_deadline := null;
    if new.current_question_id is not null and new.voting_open then
      select type, coalesce((config->>'seconds')::integer, 0) into q_type, q_seconds
      from public.live_questions where id = new.current_question_id;
      if q_type = 'quiz' and q_seconds > 0 then
        new.voting_deadline := now() + make_interval(secs => q_seconds);
      end if;
    end if;
  end if;

  -- Auflösen schliesst die Abstimmung.
  if new.reveal and not old.reveal then
    new.voting_open := false;
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

  if (new.status, new.current_question_id, new.voting_open, new.results_visible, new.show_qr, new.title, new.reveal, new.voting_deadline)
     is distinct from
     (old.status, old.current_question_id, old.voting_open, old.results_visible, old.show_qr, old.title, old.reveal, old.voting_deadline)
     or new.state_version <> old.state_version then
    new.state_version := old.state_version + 1;
  end if;
  return new;
end $$;

-- Öffentlicher Zustand: die richtige Quiz-Antwort erst nach der Auflösung.
create or replace function public.live_public_state(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sessionId', s.id,
    'code', s.code,
    'title', s.title,
    'status', s.status,
    'votingOpen', s.voting_open and s.status = 'live' and (s.voting_deadline is null or s.voting_deadline > now()),
    'resultsVisible', s.results_visible,
    'showQr', s.show_qr,
    'reveal', s.reveal,
    'deadline', case when s.voting_deadline is not null then floor(extract(epoch from s.voting_deadline) * 1000) end,
    'serverNow', floor(extract(epoch from now()) * 1000),
    'version', s.state_version,
    'question', case when s.status = 'live' and q.id is not null then jsonb_build_object(
      'id', q.id,
      'type', q.type,
      'title', q.title,
      'description', q.description,
      'config', case when s.reveal then q.config - 'internal' else q.config - 'internal' - 'correct' end,
      'number', (select count(*) from public.live_questions x where x.session_id = s.id and x.enabled and x.position <= q.position),
      'total', (select count(*) from public.live_questions x where x.session_id = s.id and x.enabled)
    ) end
  )
  from public.live_sessions s
  left join public.live_questions q on q.id = s.current_question_id
  where s.id = p_session_id
$$;

-- Quiz-Antworten haben dieselbe Form wie Ja/Nein; die manuelle Wortwolke nimmt keine an.
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

  if p_type in ('choice', 'yesno', 'quiz') then
    if jsonb_typeof(p_value->'options') <> 'array' then raise exception 'invalid_answer' using errcode = '22023'; end if;
    select coalesce(array_agg(distinct x), '{}') into ids from jsonb_array_elements_text(p_value->'options') x;
    if p_type in ('yesno', 'quiz') then
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

-- Antworten nach Ablauf des Timers oder nach der Auflösung zählen nicht.
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
  if s.status <> 'live' or s.current_question_id is distinct from q.id or not s.voting_open or not q.enabled
     or s.reveal or (s.voting_deadline is not null and s.voting_deadline <= now()) then
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

-- Beitritt: zusätzlich die eigene Antwort auf die aktuelle Frage (für die Quiz-Auflösung am Handy).
create or replace function public.live_join(p_code text, p_participant_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.live_sessions;
  mine jsonb;
begin
  select * into s from public.live_sessions where code = upper(btrim(p_code));
  if not found or s.status = 'archived' then
    return null;
  end if;
  if p_participant_id is not null then
    insert into public.live_participants (session_id, participant_id) values (s.id, p_participant_id)
    on conflict (session_id, participant_id) do update set last_seen_at = now();
    if s.current_question_id is not null then
      select value into mine from public.live_responses where question_id = s.current_question_id and participant_id = p_participant_id;
    end if;
  end if;
  return public.live_public_state(s.id) || jsonb_build_object('answered', mine is not null, 'myAnswer', mine);
end $$;

create or replace function public.live_question_results(p_question_id uuid, p_admin boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  q public.live_questions;
  respondents integer;
  result jsonb;
begin
  select * into q from public.live_questions where id = p_question_id;
  if not found then return null; end if;

  if q.type = 'board' then
    select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.kind, 'text', b.text, 'x', b.x, 'y', b.y, 'w', b.w, 'h', b.h, 'size', b.size)
                              order by b.kind desc, b.created_at), '[]')
    into result from public.live_board_items b where b.question_id = q.id;
    return jsonb_build_object('type', q.type, 'respondents', 0, 'items', result);
  end if;

  select count(*) into respondents from public.live_responses where question_id = q.id;

  if q.type in ('choice', 'yesno', 'quiz') then
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

-- Beamer: Quiz-Zahlen erst nach der Auflösung, die Leinwand immer.
create or replace function public.live_snapshot(p_session_id uuid, p_admin boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.live_sessions;
  q_type text;
  show_results boolean;
begin
  select * into s from public.live_sessions where id = p_session_id;
  if not found then return null; end if;
  select type into q_type from public.live_questions where id = s.current_question_id;
  show_results := s.current_question_id is not null and (
    p_admin
    or q_type = 'board'
    or (q_type = 'quiz' and s.reveal)
    or (q_type <> 'quiz' and s.results_visible)
  );
  return public.live_public_state(s.id) || jsonb_build_object(
    'participants', (select count(*) from public.live_participants where session_id = s.id),
    'responses', case when s.current_question_id is null then 0
                      else (select count(*) from public.live_responses where question_id = s.current_question_id) end,
    'results', case when show_results then public.live_question_results(s.current_question_id, p_admin) end
  );
end $$;

-- Admin-Vorschau braucht die richtige Antwort auch vor der Auflösung.
create or replace function public.live_admin_snapshot(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  snap jsonb;
begin
  if not public.live_is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  snap := public.live_snapshot(p_session_id, true);
  if snap->'question' is not null and snap->'question' <> 'null'::jsonb then
    snap := jsonb_set(snap, '{question,config}',
      (select config - 'internal' from public.live_questions where id = (snap->'question'->>'id')::uuid));
  end if;
  return snap;
end $$;

-- Duplizieren übernimmt auch die vorbereitete Leinwand (Kategorien und Begriffe).
create or replace function public.live_duplicate_session(p_session_id uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  src public.live_sessions;
  new_id uuid;
  q record;
  new_q uuid;
begin
  select * into src from public.live_sessions where id = p_session_id;
  if not found then raise exception 'Session nicht gefunden' using errcode = 'P0002'; end if;
  insert into public.live_sessions (title, description, event_date, auto_show_results, created_by)
  values (left(src.title || ' (Kopie)', 160), src.description, null, src.auto_show_results, auth.uid())
  returning id into new_id;
  for q in select * from public.live_questions where session_id = p_session_id order by position loop
    insert into public.live_questions (session_id, position, type, title, description, config, enabled)
    values (new_id, q.position, q.type, q.title, q.description, q.config, q.enabled)
    returning id into new_q;
    insert into public.live_board_items (question_id, kind, text, x, y, w, h, size)
    select new_q, kind, text, x, y, w, h, size from public.live_board_items where question_id = q.id;
  end loop;
  return new_id;
end $$;

-- Zurücksetzen: Begriffe der Leinwand weg, vorbereitete Kategorien bleiben.
create or replace function public.live_reset_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.live_is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  delete from public.live_responses where session_id = p_session_id;
  delete from public.live_participants where session_id = p_session_id;
  delete from public.live_hidden_words where question_id in (select id from public.live_questions where session_id = p_session_id);
  delete from public.live_board_items where kind = 'word' and question_id in (select id from public.live_questions where session_id = p_session_id);
  update public.live_sessions
  set status = 'draft', current_question_id = null, voting_open = false, results_visible = false,
      show_qr = false, reveal = false, voting_deadline = null, started_at = null, ended_at = null
  where id = p_session_id;
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Bilder für Quizfragen: öffentlicher Bucket (Bilder erscheinen auf dem
-- Beamer), hochladen und löschen nur für Admins.
-- ───────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('live-images', 'live-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy live_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'live-images' and public.live_is_admin());
create policy live_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'live-images' and public.live_is_admin());
create policy live_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'live-images' and public.live_is_admin());

revoke execute on function public.live_join(text, uuid) from public, anon, authenticated;
revoke execute on function public.live_submit(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.live_public_state(uuid) from public, anon, authenticated;
revoke execute on function public.live_question_results(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.live_snapshot(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.live_board_ping() from public, anon, authenticated;
revoke execute on function public.live_admin_snapshot(uuid) from public, anon;
revoke execute on function public.live_duplicate_session(uuid) from public, anon;
revoke execute on function public.live_reset_session(uuid) from public, anon;
grant execute on function public.live_join(text, uuid), public.live_submit(uuid, uuid, jsonb, text),
  public.live_public_state(uuid), public.live_question_results(uuid, boolean), public.live_snapshot(uuid, boolean) to service_role;
