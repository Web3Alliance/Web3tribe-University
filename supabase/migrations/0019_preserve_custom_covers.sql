-- =====================================================================================
-- 0019: PRESERVE INSTRUCTOR-UPLOADED COURSE COVERS ON APPROVAL
-- =====================================================================================
-- Course approval previously ALWAYS overwrote thumbnail_url with an official
-- auto-generated SVG cover, even when the instructor had deliberately
-- uploaded their own custom cover image through the course details form.
-- Since a cover image was also required before a course could even be
-- submitted for review, this meant every instructor-uploaded cover was
-- silently destroyed the moment their course was approved.
--
-- This flag lets the approval action (lib/actions/admin.ts) tell the two
-- cases apart: only auto-generate a cover when the instructor never set
-- their own (cover_is_custom = false); leave it alone otherwise. The cover
-- is also no longer required to submit for review — instructors can rely
-- entirely on auto-generation if they prefer.
-- =====================================================================================

alter table public.courses add column if not exists cover_is_custom boolean not null default false;

comment on column public.courses.cover_is_custom is
  'True once an instructor has saved a cover image through the course details form. When true, course approval must NOT overwrite thumbnail_url with an auto-generated cover.';
