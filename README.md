# Royal College Admin Portal

Professional Next.js + TypeScript administration portal for the Royal College student application.

## Included workspaces

- Dashboard with elevated module cards
- Students with Excel/CSV import, course filters, search and Excel export
- Attendance with course/date/hour controls, bulk actions and Present/Absent state
- Timetable with course/semester/year controls, Monday-Saturday tabs and class editor
- Announcements with create/edit, publish/draft and audience controls
- Student Doubts with answer workflow
- Leave Requests with view, approve and reject workflow
- Online Classes with create/edit and Live/Upcoming/Completed states
- Syllabus with subject progress, unit status and add-unit workflow
- Faculty & Staff with role presets and granular permissions
- Main Admin / Faculty / Staff role model prepared for Supabase authentication

## Project structure

```text
app/
  layout.tsx
  page.tsx
  globals.css

components/
  AdminShell.tsx
  Header.tsx
  BackToDashboard.tsx
  Dashboard.tsx
  ModuleCard.tsx
  Students.tsx
  Attendance.tsx
  Timetable.tsx
  Announcements.tsx
  Doubts.tsx
  Leaves.tsx
  OnlineClasses.tsx
  Syllabus.tsx
  StaffManagement.tsx
  SimpleModule.tsx
  Icon.tsx
  ui/
    Modal.tsx
    SummaryCard.tsx
    StatusBadge.tsx

lib/
  modules.ts
  permissions.ts
  roles.ts

types/
  index.ts
```

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Excel import

Student import accepts `.xlsx`, `.xls` and `.csv`. Recommended columns:

`Reg. No`, `Student Name`, `Course`, `Roll No`, `Admission No`, `Semester`, `Status`

## Next integration

The current UI uses local state/mock records. The types, permissions and component boundaries are intentionally separated so the next step can replace local state with Supabase queries, authentication and row-level security.
