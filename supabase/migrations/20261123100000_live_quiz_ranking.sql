-- ═══════════════════════════════════════════════════════════════════════════
-- WePrompt Live – Quiz mit Namen, Avatar, Punkten und Siegerpodest
--
-- Wer bei einer Session mit Quizfragen mitmacht, wählt einen Avatar und gibt
-- einen Namen ein. Richtige Antworten geben Punkte: 500 fürs Richtige plus
-- bis zu 500 fürs Tempo (Anteil der Restzeit beim Antworten). Nach der letzten
-- Frage schaltet die Kursleitung die Auswertung ein: Der Beamer zeigt das
-- Podest, jedes Handy den eigenen Platz.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.live_participants add column name text
  check (name is null or char_length(btrim(name)) between 1 and 20);
alter table public.live_participants add column avatar text
  check (avatar is null or avatar in ('kuh', 'fuchs', 'katze', 'eule', 'baer', 'panda', 'frosch', 'hase', 'pinguin', 'roboter', 'koala', 'loewe'));

-- Anteil der Restzeit beim Antworten (0–1); ohne Timer leer, zählt dann als 1.
alter table public.live_responses add column speed real check (speed is null or speed between 0 and 1);

-- Auswertung (Podest) auf dem Beamer.
alter table public.live_sessions add column leaderboard boolean not null default false;

-- ───────────────────────────────────────────────────────────────────────────
-- Zustand
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_sessions_before_update() returns trigger
language plpgsql as $$
declare
  q_type text;
  q_seconds integer;
begin
  new.updated_at := now();

  -- Neue Frage oder Abstimmung wieder geöffnet: Lösung verbergen, Timer neu starten, Podest weg.
  if new.current_question_id is distinct from old.current_question_id
     or (new.voting_open and not old.voting_open) then
    new.reveal := false;
    new.voting_deadline := null;
    new.leaderboard := false;
    if new.current_question_id is not null and new.voting_open then
      select type, coalesce((config->>'seconds')::integer, 0) into q_type, q_seconds
      from public.live_questions where id = new.current_question_id;
      if q_type = 'quiz' and q_seconds > 0 then
        new.voting_deadline := now() + make_interval(secs => q_seconds);
      end if;
    end if;
  end if;

  -- Auflösen und Auswertung schliessen die Abstimmung.
  if (new.reveal and not old.reveal) or (new.leaderboard and not old.leaderboard) then
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
    new.leaderboard := false;
  end if;

  if (new.status, new.current_question_id, new.voting_open, new.results_visible, new.show_qr, new.title, new.reveal, new.voting_deadline, new.leaderboard)
     is distinct from
     (old.status, old.current_question_id, old.voting_open, old.results_visible, old.show_qr, old.title, old.reveal, old.voting_deadline, old.leaderboard)
     or new.state_version <> old.state_version then
    new.state_version := old.state_version + 1;
  end if;
  return new;
end $$;

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
    'leaderboard', s.leaderboard and s.status = 'live',
    'hasQuiz', exists (select 1 from public.live_questions x where x.session_id = s.id and x.enabled and x.type = 'quiz'),
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

-- ───────────────────────────────────────────────────────────────────────────
-- Punkte und Rangliste
-- ───────────────────────────────────────────────────────────────────────────

-- Punkte pro Person über alle aktiven Quizfragen; gleiche Punktzahl = gleicher Platz.
create or replace function public.live_quiz_scores(p_session_id uuid)
returns table (participant_id uuid, name text, avatar text, points integer, correct integer, rank integer)
language sql stable security definer set search_path = public as $$
  with scored as (
    select r.participant_id,
           sum(case when r.value->'options'->>0 = q.config->>'correct'
                    then 500 + round(500 * coalesce(r.speed, 1)) else 0 end)::integer as points,
           count(*) filter (where r.value->'options'->>0 = q.config->>'correct')::integer as correct
    from public.live_responses r
    join public.live_questions q on q.id = r.question_id
    where r.session_id = p_session_id and q.type = 'quiz' and q.enabled
    group by r.participant_id
  )
  select sc.participant_id, coalesce(p.name, 'Anonym'), coalesce(p.avatar, 'kuh'), sc.points, sc.correct,
         (rank() over (order by sc.points desc))::integer
  from scored sc
  left join public.live_participants p on p.session_id = p_session_id and p.participant_id = sc.participant_id
$$;

create or replace function public.live_leaderboard(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from public.live_questions x where x.session_id = p_session_id and x.enabled and x.type = 'quiz'),
    'players', (select count(*) from public.live_quiz_scores(p_session_id)),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('rank', t.rank, 'name', t.name, 'avatar', t.avatar, 'points', t.points, 'correct', t.correct)
                       order by t.rank, t.correct desc, t.name)
      from (select * from public.live_quiz_scores(p_session_id) order by rank, correct desc, name limit 10) t
    ), '[]'::jsonb)
  )
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Name und Avatar
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_set_profile(p_code text, p_participant_id uuid, p_name text, p_avatar text, p_client_key text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.live_sessions;
  n text;
begin
  if p_participant_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if not public.live_rate_hit('p:' || p_participant_id::text, 30, 60) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if p_client_key is not null and not public.live_rate_hit('n:' || p_client_key, 1500, 60) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into s from public.live_sessions where code = upper(btrim(p_code));
  if not found or s.status in ('archived', 'ended') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  n := public.live_clean_text(p_name);
  if n = '' or char_length(n) > 20
     or p_avatar is null or p_avatar not in ('kuh', 'fuchs', 'katze', 'eule', 'baer', 'panda', 'frosch', 'hase', 'pinguin', 'roboter', 'koala', 'loewe') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  insert into public.live_participants (session_id, participant_id, name, avatar) values (s.id, p_participant_id, n, p_avatar)
  on conflict (session_id, participant_id) do update set name = excluded.name, avatar = excluded.avatar, last_seen_at = now();

  -- Beamer (Warteraum) und Steuerung laden nach.
  perform public.live_send('live-results:' || s.id::text, 'response', jsonb_build_object('questionId', null));
  return jsonb_build_object('ok', true, 'name', n, 'avatar', p_avatar);
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Beitritt: eigenes Profil und, während der Auswertung, der eigene Platz
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_join(p_code text, p_participant_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.live_sessions;
  mine jsonb;
  prof jsonb;
  me jsonb;
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
    select case when p.name is not null then jsonb_build_object('name', p.name, 'avatar', p.avatar) end into prof
    from public.live_participants p where p.session_id = s.id and p.participant_id = p_participant_id;
    if s.leaderboard or s.status = 'ended' then
      select jsonb_build_object('rank', x.rank, 'points', x.points, 'correct', x.correct,
                                'players', (select count(*) from public.live_quiz_scores(s.id)))
      into me from public.live_quiz_scores(s.id) x where x.participant_id = p_participant_id;
    end if;
  end if;
  return public.live_public_state(s.id) || jsonb_build_object('answered', mine is not null, 'myAnswer', mine, 'profile', prof, 'me', me);
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Antworten: Tempo für die Quizpunkte festhalten
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_submit(p_question_id uuid, p_participant_id uuid, p_value jsonb, p_client_key text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q public.live_questions;
  s public.live_sessions;
  v jsonb;
  inserted integer;
  sp real;
  secs integer;
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
     or s.reveal or s.leaderboard or (s.voting_deadline is not null and s.voting_deadline <= now()) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  begin
    v := public.live_normalize_answer(q.type, q.config, p_value);
  exception when sqlstate '22023' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end;

  if q.type = 'quiz' and s.voting_deadline is not null then
    secs := coalesce((q.config->>'seconds')::integer, 0);
    if secs > 0 then
      sp := greatest(0, least(1, extract(epoch from (s.voting_deadline - now())) / secs));
    end if;
  end if;

  insert into public.live_participants (session_id, participant_id) values (s.id, p_participant_id)
  on conflict (session_id, participant_id) do update set last_seen_at = now();

  insert into public.live_responses (session_id, question_id, participant_id, value, status, speed)
  values (s.id, q.id, p_participant_id, v,
          case when q.type = 'open' and coalesce((q.config->>'moderation')::boolean, false) then 'pending' else 'visible' end,
          sp)
  on conflict (question_id, participant_id) do nothing;
  get diagnostics inserted = row_count;

  return jsonb_build_object('ok', true, 'duplicate', inserted = 0);
end $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Beamer: Warteraum mit Avataren, Podest während der Auswertung
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.live_snapshot(p_session_id uuid, p_admin boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.live_sessions;
  q_type text;
  show_results boolean;
  has_quiz boolean;
begin
  select * into s from public.live_sessions where id = p_session_id;
  if not found then return null; end if;
  select type into q_type from public.live_questions where id = s.current_question_id;
  has_quiz := exists (select 1 from public.live_questions x where x.session_id = s.id and x.enabled and x.type = 'quiz');
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
    'results', case when show_results then public.live_question_results(s.current_question_id, p_admin) end,
    'lobby', case when has_quiz and (s.current_question_id is null or s.show_qr) then coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'avatar', p.avatar) order by p.joined_at)
      from (select * from public.live_participants where session_id = s.id and name is not null order by joined_at limit 60) p
    ), '[]'::jsonb) end,
    'ranking', case when s.leaderboard and s.status = 'live' then public.live_leaderboard(s.id) end
  );
end $$;

-- Zurücksetzen: auch die Auswertung aus.
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
      show_qr = false, reveal = false, leaderboard = false, voting_deadline = null, started_at = null, ended_at = null
  where id = p_session_id;
end $$;

revoke execute on function public.live_quiz_scores(uuid) from public, anon, authenticated;
revoke execute on function public.live_leaderboard(uuid) from public, anon, authenticated;
revoke execute on function public.live_set_profile(text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.live_join(text, uuid) from public, anon, authenticated;
revoke execute on function public.live_submit(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.live_public_state(uuid) from public, anon, authenticated;
revoke execute on function public.live_snapshot(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.live_reset_session(uuid) from public, anon;
grant execute on function public.live_quiz_scores(uuid), public.live_leaderboard(uuid),
  public.live_set_profile(text, uuid, text, text, text), public.live_join(text, uuid),
  public.live_submit(uuid, uuid, jsonb, text), public.live_public_state(uuid), public.live_snapshot(uuid, boolean) to service_role;
