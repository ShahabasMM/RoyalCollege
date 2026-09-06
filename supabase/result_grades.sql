-- Result module storage
-- Run this in the Supabase SQL editor after syllabus_courses,
-- syllabus_subjects, and students already exist.

create table if not exists public.result_grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.syllabus_subjects(id) on delete cascade,
  course text not null,
  semester integer not null check (semester between 1 and 8),
  grade text not null check (grade in ('A+', 'A', 'B+', 'B', 'C', 'O', 'P', 'F')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, course, semester)
);

create index if not exists result_grades_student_idx
  on public.result_grades(student_id);

create index if not exists result_grades_class_idx
  on public.result_grades(course, semester);

alter table public.result_grades enable row level security;

-- The application already gates Result access through result.view/result.edit.
-- These policies allow signed-in users to use the module while preserving
-- anonymous access denial at the database boundary.
drop policy if exists "Authenticated users can view result grades" on public.result_grades;
create policy "Authenticated users can view result grades"
  on public.result_grades for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can add result grades" on public.result_grades;
create policy "Authenticated users can add result grades"
  on public.result_grades for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update result grades" on public.result_grades;
create policy "Authenticated users can update result grades"
  on public.result_grades for update
  to authenticated
  using (true)
  with check (true);
