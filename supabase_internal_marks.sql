/* =========================================================
   ROYAL COLLEGE — INTERNAL MARKS ONLY
   CLEAN REBUILD

   IMPORTANT:
   This script DROPS and rebuilds ONLY public.internal_marks.
   It does NOT modify students or syllabus tables.

   Existing tables required:
     public.students
     public.syllabus_subjects
   ========================================================= */

create extension if not exists pgcrypto;

/* ---------------------------------------------------------
   1. Remove the old Internal Marks table
   --------------------------------------------------------- */

drop table if exists public.internal_marks cascade;

/* ---------------------------------------------------------
   2. Create the clean Internal Marks table
   --------------------------------------------------------- */

create table public.internal_marks (
  id uuid primary key default gen_random_uuid(),

  student_id uuid not null
    references public.students(id)
    on delete cascade,

  subject_id uuid not null
    references public.syllabus_subjects(id)
    on delete cascade,

  course text not null,

  semester integer not null,

  assignment_mark numeric(5,2) not null default 0,

  attendance_mark numeric(5,2) not null default 0,

  internal_exam_mark numeric(5,2) not null default 0,

  total_mark numeric(5,2) not null default 0,

  /* Compatibility with the old project schema. */
  mark numeric(5,2) not null default 0,

  entered_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint internal_marks_semester_check
    check (semester >= 1 and semester <= 8),

  constraint internal_marks_assignment_check
    check (assignment_mark >= 0 and assignment_mark <= 10),

  constraint internal_marks_attendance_check
    check (attendance_mark >= 0 and attendance_mark <= 10),

  constraint internal_marks_internal_exam_check
    check (internal_exam_mark >= 0 and internal_exam_mark <= 10),

  constraint internal_marks_total_check
    check (total_mark >= 0 and total_mark <= 30),

  constraint internal_marks_mark_check
    check (mark >= 0 and mark <= 30),

  /* One student can have only one mark record per syllabus subject. */
  constraint internal_marks_student_subject_key
    unique (student_id, subject_id)
);

/* ---------------------------------------------------------
   3. Indexes
   --------------------------------------------------------- */

create index internal_marks_student_id_idx
  on public.internal_marks(student_id);

create index internal_marks_subject_id_idx
  on public.internal_marks(subject_id);

create index internal_marks_course_semester_idx
  on public.internal_marks(course, semester);

/* ---------------------------------------------------------
   4. Automatically calculate total /30
   --------------------------------------------------------- */

create or replace function public.calculate_internal_mark_total()
returns trigger
language plpgsql
as $$
begin
  new.assignment_mark := coalesce(new.assignment_mark, 0);
  new.attendance_mark := coalesce(new.attendance_mark, 0);
  new.internal_exam_mark := coalesce(new.internal_exam_mark, 0);

  new.total_mark :=
      new.assignment_mark
    + new.attendance_mark
    + new.internal_exam_mark;

  /* Keep the legacy mark field synchronized. */
  new.mark := new.total_mark;

  new.updated_at := now();

  return new;
end;
$$;

/* ---------------------------------------------------------
   5. Trigger
   --------------------------------------------------------- */

drop trigger if exists internal_marks_calculate_total
  on public.internal_marks;

create trigger internal_marks_calculate_total
before insert or update
on public.internal_marks
for each row
execute function public.calculate_internal_mark_total();

/* ---------------------------------------------------------
   6. Row Level Security
   --------------------------------------------------------- */

alter table public.internal_marks enable row level security;

/* View */
create policy "internal_marks_authenticated_select"
on public.internal_marks
for select
to authenticated
using (true);

/* Add */
create policy "internal_marks_authenticated_insert"
on public.internal_marks
for insert
to authenticated
with check (true);

/* Edit */
create policy "internal_marks_authenticated_update"
on public.internal_marks
for update
to authenticated
using (true)
with check (true);

/* Delete */
create policy "internal_marks_authenticated_delete"
on public.internal_marks
for delete
to authenticated
using (true);

/* --------------------------------------f-------------------
   7. Verify
   --------------------------------------------------------- */

select
  im.id,
  im.student_id,
  im.subject_id,
  ss.subject_code,
  ss.subject_name,
  im.course,
  im.semester,
  im.assignment_mark,
  im.attendance_mark,
  im.internal_exam_mark,
  im.total_mark
from public.internal_marks im
left join public.syllabus_subjects ss
  on ss.id = im.subject_id
order by im.created_at desc;
