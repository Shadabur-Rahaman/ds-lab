-- Apply in your own Supabase project. Never put a service-role key in the browser.
create table if not exists public.learning_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id text not null check (lesson_id in ('introduction','statistics','pandas')),
 quiz boolean not null default false,
 code boolean not null default false,
 primary key (user_id, lesson_id)
);
alter table public.learning_progress enable row level security;
create policy "Read own progress" on public.learning_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own progress" on public.learning_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own progress" on public.learning_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.learning_progress from anon;
grant select, insert, update on public.learning_progress to authenticated;
