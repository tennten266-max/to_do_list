create table if not exists public.ai_rate_limits (
  bucket_key text primary key,
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null
);

create index if not exists ai_rate_limits_window_started_at_idx
on public.ai_rate_limits (window_started_at);

alter table public.ai_rate_limits enable row level security;
revoke all on table public.ai_rate_limits from public, anon, authenticated;
grant all on table public.ai_rate_limits to service_role;

create or replace function public.consume_ai_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_request_count integer;
begin
  if p_max_requests < 1 or p_window_seconds < 1 then
    raise exception 'Rate limit parameters must be positive';
  end if;

  delete from public.ai_rate_limits
  where window_started_at < pg_catalog.now() - '1 day'::pg_catalog.interval;

  insert into public.ai_rate_limits as rate_limit (
    bucket_key,
    request_count,
    window_started_at
  )
  values (p_bucket_key, 1, pg_catalog.now())
  on conflict (bucket_key) do update
  set request_count = case
        when rate_limit.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds) then 1
        else rate_limit.request_count + 1
      end,
      window_started_at = case
        when rate_limit.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds) then pg_catalog.now()
        else rate_limit.window_started_at
      end
  returning request_count into current_request_count;

  return current_request_count <= p_max_requests;
end;
$$;

revoke execute on function public.consume_ai_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(text, integer, integer) to service_role;