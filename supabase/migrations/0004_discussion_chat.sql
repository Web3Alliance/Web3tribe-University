-- =====================================================================================
-- WEB3TRIBE UNIVERSITY — MIGRATION 0004
-- Course discussion/chat: likes, dislikes, auto-moderation, and realtime
-- =====================================================================================
-- Run this AFTER 0001_schema.sql, 0002_storage.sql, and 0003_tokenomics_and_resources.sql.
-- Safe to re-run.
--
-- WHAT THIS ADDS:
--   1. A discussion_reactions table so students/instructors can like or dislike a
--      thread (question) or a reply (answer).
--   2. Denormalized like_count/dislike_count columns on discussion_threads and
--      discussion_replies, kept in sync by a trigger.
--   3. Auto-moderation: a thread or reply is automatically DELETED the moment its
--      dislike_count reaches 5. This is a hard delete (no recovery) — every
--      auto-deletion is recorded in audit_logs so admins retain a record of what
--      was removed and why.
--   4. Fixes a pre-existing gap: replies could previously be posted by ANY
--      authenticated user, not just enrolled students / the course instructor /
--      moderators, unlike threads which already had this check. Reactions get the
--      same "must be a course participant" restriction.
--   5. Enables Supabase Realtime on discussion_threads and discussion_replies so
--      new questions, answers, and like/dislike count changes appear live without
--      a page refresh (wrapped in exception handling so this migration still runs
--      cleanly on database engines/tools that don't support logical replication —
--      it is a no-op there, and applies correctly on a real Supabase project).
--
-- NOTE ON REWARDS: participating in the discussion (posting, replying, liking)
-- intentionally earns NO W3TR. Rewards remain earned exclusively by passing a
-- lesson's quiz (see migration 0003 and lib/tokenomics.ts) — this is a deliberate
-- design choice to prevent the discussion feature from being gamed for W3TR.
-- =====================================================================================

-- ---- 1. Reaction type enum -----------------------------------------------------------
do $$ begin
  create type reaction_type as enum ('like', 'dislike');
exception when duplicate_object then null; end $$;

-- ---- 2. discussion_reactions table ---------------------------------------------------
create table if not exists public.discussion_reactions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.discussion_threads(id) on delete cascade,
  reply_id uuid references public.discussion_replies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction reaction_type not null,
  created_at timestamptz not null default now(),
  constraint discussion_reactions_target_check check (
    (thread_id is not null and reply_id is null) or (thread_id is null and reply_id is not null)
  )
);

-- A user may only have one reaction on a given thread/reply at a time (they can
-- switch between like/dislike, or remove it, but not stack multiple reactions).
-- Postgres unique constraints treat NULLs as distinct, so this correctly scopes
-- uniqueness to "reactions that target a thread" and "reactions that target a
-- reply" independently, without the two constraints interfering with each other.
create unique index if not exists idx_discussion_reactions_unique_thread
  on public.discussion_reactions(thread_id, profile_id) where thread_id is not null;
create unique index if not exists idx_discussion_reactions_unique_reply
  on public.discussion_reactions(reply_id, profile_id) where reply_id is not null;

create index if not exists idx_discussion_reactions_thread on public.discussion_reactions(thread_id);
create index if not exists idx_discussion_reactions_reply on public.discussion_reactions(reply_id);

-- ---- 3. Denormalized count columns ----------------------------------------------------
alter table public.discussion_threads add column if not exists like_count int not null default 0;
alter table public.discussion_threads add column if not exists dislike_count int not null default 0;
alter table public.discussion_replies add column if not exists like_count int not null default 0;
alter table public.discussion_replies add column if not exists dislike_count int not null default 0;

-- ---- 4. Trigger: maintain counts + auto-delete at 5 dislikes --------------------------
create or replace function public.handle_discussion_reaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid := coalesce(new.thread_id, old.thread_id);
  v_reply_id uuid := coalesce(new.reply_id, old.reply_id);
  v_dislikes int;
  v_course_id uuid;
  v_body_snippet text;
begin
  if v_thread_id is not null then
    update public.discussion_threads t
      set like_count = (select count(*) from public.discussion_reactions where thread_id = v_thread_id and reaction = 'like'),
          dislike_count = (select count(*) from public.discussion_reactions where thread_id = v_thread_id and reaction = 'dislike')
      where t.id = v_thread_id
      returning t.dislike_count, t.course_id, left(t.body, 120) into v_dislikes, v_course_id, v_body_snippet;

    if v_dislikes is not null and v_dislikes >= 5 then
      insert into public.audit_logs (actor_profile_id, action, target_table, target_id, metadata)
      values (null, 'discussion.auto_delete_thread', 'discussion_threads', v_thread_id,
        jsonb_build_object('reason', 'reached 5 dislikes', 'course_id', v_course_id, 'body_snippet', v_body_snippet));

      delete from public.discussion_threads where id = v_thread_id;
    end if;
  end if;

  if v_reply_id is not null then
    update public.discussion_replies r
      set like_count = (select count(*) from public.discussion_reactions where reply_id = v_reply_id and reaction = 'like'),
          dislike_count = (select count(*) from public.discussion_reactions where reply_id = v_reply_id and reaction = 'dislike')
      where r.id = v_reply_id
      returning r.dislike_count, left(r.body, 120) into v_dislikes, v_body_snippet;

    if v_dislikes is not null and v_dislikes >= 5 then
      insert into public.audit_logs (actor_profile_id, action, target_table, target_id, metadata)
      values (null, 'discussion.auto_delete_reply', 'discussion_replies', v_reply_id,
        jsonb_build_object('reason', 'reached 5 dislikes', 'body_snippet', v_body_snippet));

      delete from public.discussion_replies where id = v_reply_id;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_discussion_reaction_change on public.discussion_reactions;
create trigger trg_discussion_reaction_change
  after insert or update or delete on public.discussion_reactions
  for each row execute function public.handle_discussion_reaction_change();

-- ---- 5. RLS for discussion_reactions ---------------------------------------------------
alter table public.discussion_reactions enable row level security;

drop policy if exists "discussion_reactions_select" on public.discussion_reactions;
create policy "discussion_reactions_select" on public.discussion_reactions for select
  using (profile_id = auth.uid() or public.is_moderator_or_above());

drop policy if exists "discussion_reactions_insert" on public.discussion_reactions;
create policy "discussion_reactions_insert" on public.discussion_reactions for insert
  with check (
    profile_id = auth.uid()
    and (
      -- reacting to a thread: must be enrolled in, or the instructor of, that thread's course
      exists (
        select 1 from public.discussion_threads t
        join public.courses c on c.id = t.course_id
        where t.id = thread_id
        and (
          c.instructor_id = auth.uid()
          or exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = auth.uid())
        )
      )
      or
      -- reacting to a reply: must be enrolled in, or the instructor of, the parent course
      exists (
        select 1 from public.discussion_replies rep
        join public.discussion_threads t on t.id = rep.thread_id
        join public.courses c on c.id = t.course_id
        where rep.id = reply_id
        and (
          c.instructor_id = auth.uid()
          or exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = auth.uid())
        )
      )
    )
  );

drop policy if exists "discussion_reactions_update" on public.discussion_reactions;
create policy "discussion_reactions_update" on public.discussion_reactions for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "discussion_reactions_delete" on public.discussion_reactions;
create policy "discussion_reactions_delete" on public.discussion_reactions for delete
  using (profile_id = auth.uid() or public.is_moderator_or_above());

-- ---- 6. Fix pre-existing gap: replies must come from a course participant -------------
drop policy if exists "replies_insert" on public.discussion_replies;
create policy "replies_insert" on public.discussion_replies for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.discussion_threads t
      join public.courses c on c.id = t.course_id
      where t.id = thread_id
      and (
        c.instructor_id = auth.uid()
        or public.is_moderator_or_above()
        or exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = auth.uid())
      )
    )
  );

-- ---- 7. Enable Realtime on discussion tables (no-op if unsupported / already added) --
do $$ begin
  alter publication supabase_realtime add table public.discussion_threads;
exception when duplicate_object then null; when undefined_object then null; when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.discussion_replies;
exception when duplicate_object then null; when undefined_object then null; when others then null; end $$;
