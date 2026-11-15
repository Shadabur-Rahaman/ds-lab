create table public.learner_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null check (revision >= 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and (payload->>'format') is not distinct from 'ds-lab-learner-v1'
    and octet_length(payload::text) <= 4000000)
);
alter table public.learner_snapshots enable row level security;
revoke all on public.learner_snapshots from public, anon, authenticated;
grant select, insert, update on public.learner_snapshots to authenticated;
create policy learner_read on public.learner_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy learner_insert on public.learner_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy learner_update on public.learner_snapshots for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
