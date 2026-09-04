/* =========================================================
   ROYAL COLLEGE — MONTHLY REPORT
   Complete Supabase migration for the Monthly Report module.

   Required existing tables:
     public.staff_profiles
     public.staff_permissions
     public.syllabus_courses
     public.syllabus_subjects

   Expected staff_profiles columns used by this project:
     id, name, email, department, role, status, auth_user_id
   ========================================================= */

create extension if not exists pgcrypto;

/* ---------------------------------------------------------
   1. Permissions
   --------------------------------------------------------- */

insert into public.staff_permissions (staff_id, permission)
select sp.id, 'monthly_report.view'
from public.staff_profiles sp
where sp.role in ('MAIN_ADMIN', 'FACULTY')
  and not exists (
    select 1 from public.staff_permissions p
    where p.staff_id = sp.id
      and p.permission = 'monthly_report.view'
  );

insert into public.staff_permissions (staff_id, permission)
select sp.id, 'monthly_report.edit'
from public.staff_profiles sp
where sp.role in ('MAIN_ADMIN', 'FACULTY')
  and not exists (
    select 1 from public.staff_permissions p
    where p.staff_id = sp.id
      and p.permission = 'monthly_report.edit'
  );

/* ---------------------------------------------------------
   2. Helper functions for secure RLS
   --------------------------------------------------------- */

create or replace function public.current_staff_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sp.id
  from public.staff_profiles sp
  where sp.auth_user_id = auth.uid()
     or lower(sp.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by case when sp.auth_user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

grant execute on function public.current_staff_profile_id() to authenticated;

create or replace function public.current_staff_has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.id = public.current_staff_profile_id()
      and (
        sp.role = 'MAIN_ADMIN'
        or exists (
          select 1
          from public.staff_permissions p
          where p.staff_id = sp.id
            and p.permission = required_permission
        )
      )
  );
$$;

grant execute on function public.current_staff_has_permission(text) to authenticated;

/* ---------------------------------------------------------
   3. Table
   --------------------------------------------------------- */

create table if not exists public.monthly_report_rows (
  id uuid primary key default gen_random_uuid(),

  staff_id uuid not null
    references public.staff_profiles(id)
    on delete cascade,

  report_month date not null,

  department text not null,

  class_name text not null,

  subject_id uuid not null
    references public.syllabus_subjects(id)
    on delete restrict,

  total_units numeric(10,2) not null default 0,

  units_taken_this_month jsonb not null default '[]'::jsonb,

  total_units_covered numeric(10,2) not null default 0,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint monthly_report_total_units_nonnegative
    check (total_units >= 0),

  constraint monthly_report_covered_nonnegative
    check (total_units_covered >= 0),

  constraint monthly_report_covered_not_over_total
    check (total_units_covered <= total_units),

  constraint monthly_report_month_first_day
    check (report_month = date_trunc('month', report_month)::date),

  constraint monthly_report_units_json_array
    check (jsonb_typeof(units_taken_this_month) = 'array')
);

/* ---------------------------------------------------------
   4. Indexes
   --------------------------------------------------------- */

create index monthly_report_staff_month_idx
  on public.monthly_report_rows(staff_id, report_month);

create index monthly_report_subject_idx
  on public.monthly_report_rows(subject_id);

create index monthly_report_department_idx
  on public.monthly_report_rows(department);

/* ---------------------------------------------------------
   5. Updated-at trigger
   --------------------------------------------------------- */

create or replace function public.set_monthly_report_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_report_set_updated_at
  on public.monthly_report_rows;

create trigger monthly_report_set_updated_at
before update on public.monthly_report_rows
for each row
execute function public.set_monthly_report_updated_at();

/* ---------------------------------------------------------
   6. Row Level Security
   --------------------------------------------------------- */

alter table public.monthly_report_rows enable row level security;

drop policy if exists monthly_report_select
  on public.monthly_report_rows;

drop policy if exists monthly_report_insert
  on public.monthly_report_rows;

drop policy if exists monthly_report_update
  on public.monthly_report_rows;

drop policy if exists monthly_report_delete
  on public.monthly_report_rows;

/*
   MAIN_ADMIN can see everything.
   Faculty/staff can only see their own rows when they have
   monthly_report.view.
*/
create policy monthly_report_select
on public.monthly_report_rows
for select
to authenticated
using (
  public.current_staff_has_permission('monthly_report.view')
  and (
    (select role from public.staff_profiles where id = public.current_staff_profile_id()) = 'MAIN_ADMIN'
    or staff_id = public.current_staff_profile_id()
  )
);

create policy monthly_report_insert
on public.monthly_report_rows
for insert
to authenticated
with check (
  public.current_staff_has_permission('monthly_report.edit')
  and (
    (select role from public.staff_profiles where id = public.current_staff_profile_id()) = 'MAIN_ADMIN'
    or staff_id = public.current_staff_profile_id()
  )
);

create policy monthly_report_update
on public.monthly_report_rows
for update
to authenticated
using (
  public.current_staff_has_permission('monthly_report.edit')
  and (
    (select role from public.staff_profiles where id = public.current_staff_profile_id()) = 'MAIN_ADMIN'
    or staff_id = public.current_staff_profile_id()
  )
)
with check (
  public.current_staff_has_permission('monthly_report.edit')
  and (
    (select role from public.staff_profiles where id = public.current_staff_profile_id()) = 'MAIN_ADMIN'
    or staff_id = public.current_staff_profile_id()
  )
);

create policy monthly_report_delete
on public.monthly_report_rows
for delete
to authenticated
using (
  public.current_staff_has_permission('monthly_report.edit')
  and (
    (select role from public.staff_profiles where id = public.current_staff_profile_id()) = 'MAIN_ADMIN'
    or staff_id = public.current_staff_profile_id()
  )
);

/* ---------------------------------------------------------
   7. Verification
   --------------------------------------------------------- */

select
  mr.id,
  mr.report_month,
  sp.name as teacher_name,
  sp.department,
  mr.class_name,
  ss.subject_code,
  ss.subject_name,
  mr.total_units,
  mr.units_taken_this_month,
  mr.total_units_covered,
  mr.created_at,
  mr.updated_at
from public.monthly_report_rows mr
join public.staff_profiles sp
  on sp.id = mr.staff_id
left join public.syllabus_subjects ss
  on ss.id = mr.subject_id
order by mr.report_month desc, sp.name, mr.created_at;
