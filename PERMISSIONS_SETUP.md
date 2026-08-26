# Royal College Admin — Permission-Safe Build

This version keeps the existing UI/design and adds strict module/action permission checks.

## What changed

- `view` only allows reading/opening a module.
- `create` only allows creation.
- `edit` only allows updates.
- `delete` only allows deletion where that permission exists.
- Attendance marking is protected by `attendance.mark`; attendance editing also accepts `attendance.edit`.
- Syllabus mutations require `syllabus.manage`.
- Leave approval/rejection are checked separately.
- Doubt answering/resolution/reopen actions require `doubts.answer`.
- Faculty/Staff screens now receive the authenticated `AppUser`.
- Dashboard stat cards are filtered by their corresponding `*.view` permission.
- Unauthorized module access shows an access-restricted screen.
- Supabase RLS policies are included so frontend checks cannot be bypassed by direct database calls.

## Supabase setup

1. Open Supabase → SQL Editor.
2. Run `supabase_staff_permissions.sql` once.
3. This file also contains the complete module RLS replacement.
4. It does NOT disable RLS.
5. It keeps `MAIN_ADMIN` as the full-access role.
6. Staff permissions continue to be stored in `staff_permissions`.
7. `staff_profiles.auth_user_id` is matched against `auth.uid()`.

Do not change `MAIN_ADMIN` to `admin`; the project schema intentionally uses `MAIN_ADMIN`.

## Permission test

Create a Faculty account and give it ONLY:

`announcements.view`

Login as that Faculty user.

Expected:

- Announcements module opens.
- Announcement list can be read.
- New Announcement cannot be created.
- Edit cannot be performed.
- Publish/Unpublish cannot be performed.
- Delete cannot be performed.
- Direct Supabase INSERT/UPDATE/DELETE is rejected by RLS.

Then grant:

`announcements.create`

Only creation should become available.

Then grant:

`announcements.edit`

Only edit/publish operations should additionally become available.

Then grant:

`announcements.delete`

Delete becomes available.

Repeat the same pattern for the other modules.

## Environment variables

`.env.local` is intentionally NOT included in the cleaned zip.

Create `.env.local` locally using `.env.example` and keep the real values private.

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-side only; never expose it with `NEXT_PUBLIC_`)

## Build

```bash
npm install
npm run build
npm start
```

For development:

```bash
npm run dev
```

## Vercel

Add the same environment variable names in Vercel Project → Settings → Environment Variables.

Do not commit `.env.local`.
