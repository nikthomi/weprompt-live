-- ═══════════════════════════════════════════════════════════════════════════
-- WePrompt Live – Quiz mit mehreren Antworten (Multiple Choice wie bei Kahoot)
--
-- Ein Quiz kann jetzt eigene Antwortmöglichkeiten haben (config.options,
-- 2 bis 6, eine davon richtig). Ohne config.options bleibt es wie bisher bei
-- zwei Antworten mit den IDs yes/no. Nur die Prüfung der Antworten ändert sich.
-- ═══════════════════════════════════════════════════════════════════════════

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
    if p_type = 'yesno' or (p_type = 'quiz' and jsonb_typeof(p_config->'options') is distinct from 'array') then
      allowed := array['yes', 'no'];
      max_n := 1;
    elsif p_type = 'quiz' then
      select coalesce(array_agg(o->>'id'), '{}') into allowed from jsonb_array_elements(p_config->'options') o;
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
