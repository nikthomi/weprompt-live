-- Minimaler Nachbau der Supabase-Umgebung für Tests in PGlite:
-- Rollen, auth.uid() und realtime (Nachrichten landen in realtime.messages).

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema realtime;
grant usage on schema realtime to anon, authenticated, service_role;
create table realtime.messages (id bigserial primary key, topic text, event text, payload jsonb, private boolean);
alter table realtime.messages enable row level security;
grant select on realtime.messages to authenticated;
create function realtime.topic() returns text language sql stable as $$
  select current_setting('realtime.topic', true)
$$;
grant execute on function realtime.topic() to anon, authenticated;
create function realtime.send(payload jsonb, event text, topic text, private boolean) returns void
language sql security definer as $$
  insert into realtime.messages (topic, event, payload, private) values (topic, event, payload, private)
$$;
