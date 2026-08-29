// ============================================================
// FACULTY MODULE — ACCOUNT CREATION / PERMISSIONS INTEGRATION
// ============================================================
//
// Use this inside your existing Faculty & Staff component.
//
// The Faculty module remains the ONLY place where teachers are added.
// It creates the Supabase Auth account through the Edge Function and
// stores the linked faculty profile. Password is never stored in DB.
//
// IMPORTANT:
//   npm/app code must NOT contain SUPABASE_SERVICE_ROLE_KEY.
// ============================================================

import { supabase } from "@/lib/supabase";

export type CreateFacultyAccountInput = {
  name: string;
  email: string;
  password: string;
  employeeId?: string;
  department?: string;
  permissions: string[];
};

export async function createFacultyAccount(
  input: CreateFacultyAccountInput,
) {
  const { data, error } = await supabase.functions.invoke(
    "create-faculty-user",
    {
      body: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        employeeId: input.employeeId?.trim() ?? "",
        department: input.department?.trim() ?? "",
        permissions: input.permissions,
      },
    },
  );

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(
      data?.message ?? "Unable to create faculty account.",
    );
  }

  return data.user;
}

// ------------------------------------------------------------
// Example: when saving Faculty permissions
// ------------------------------------------------------------
//
// const nextPermissions = selected.permissions;
//
// if (selected.id /* your faculty profile id */) {
//   const { error } = await supabase
//     .from("faculty_profiles")
//     .update({
//       permissions: nextPermissions,
//       updated_at: new Date().toISOString(),
//     })
//     .eq("id", selected.id);
//
//   if (error) throw error;
// }
//
// For Library access, the permission to add is:
//   "library.view"
//
// Faculty should NOT receive:
//   "library.issue"
//   "library.manage"
//   "library.return"
//
// Example:
// const permissions = [
//   "attendance.view",
//   "students.view",
//   "library.view",
// ];
//
// ------------------------------------------------------------
// Faculty form:
// ------------------------------------------------------------
//
// <input name="name" />
// <input name="email" type="email" />
// <input name="password" type="password" />
//
// On submit:
// await createFacultyAccount({
//   name,
//   email,
//   password,
//   employeeId,
//   department,
//   permissions,
// });
//
// After the account is created, the teacher can log in with the
// email/password. The Library module checks library.view.
// ============================================================
