create extension if not exists "pgcrypto";

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "Users can view their own todos"
on public.todos for select
using (auth.uid() = user_id);

create policy "Users can insert their own todos"
on public.todos for insert
with check (auth.uid() = user_id);

create policy "Users can update their own todos"
on public.todos for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own todos"
on public.todos for delete
using (auth.uid() = user_id);
