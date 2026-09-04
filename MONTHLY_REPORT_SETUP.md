# Monthly Report — Final Setup

## What was added

- New **Monthly Report** dashboard module.
- Faculty/Staff name is automatically resolved from the logged-in `staff_profiles` account.
- Faculty/Staff cannot switch to another teacher from the report screen.
- Main Admin can select a teacher and department.
- Departments supported: English, Commerce, Malayalam, Arabic.
- Monthly filter.
- Add New creates a new report row in the same table.
- Subject is selected from the existing `syllabus_subjects` table.
- Total Unit is numeric and displays as `X CHAPTERS`.
- Unit Taken By This Month supports unlimited entries using `+ New`.
- Total Units Covered is numeric and displays as `X CHAPTER(S) COMPLETED`.
- Edit/Delete support.
- Print/Save as PDF support through the browser print dialog.
- RLS limits Faculty/Staff to their own rows; Main Admin can access all rows.
- Monthly Report permissions were added to the project permission system.

## Database

1. Open **Supabase → SQL Editor**.
2. Run `supabase_monthly_report.sql`.
3. The SQL creates the table, indexes, trigger, RLS policies, helper security-definer functions, and adds the two permissions to existing MAIN_ADMIN/FACULTY profiles.

The SQL expects the existing project tables:

- `public.staff_profiles`
- `public.staff_permissions`
- `public.syllabus_courses`
- `public.syllabus_subjects`

## Existing Faculty accounts

The SQL automatically grants `monthly_report.view` and `monthly_report.edit` to active `MAIN_ADMIN` and `FACULTY` profiles that do not already have those permissions.

If a particular faculty member should not use Monthly Report, remove those two permission rows for that profile in `staff_permissions`.

## Run project

```bash
npm install
npm run dev
```

For production:

```bash
npm install
npm run build
npm start
```

The ZIP intentionally excludes `node_modules`, `.next`, and `.env.local`. Keep your real Supabase environment variables private.
