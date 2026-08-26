import { supabase } from "./supabase";

import { AppUser, Permission, Role } from "./permissions";

export async function loadCurrentUser(): Promise<AppUser | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  if (!authUser.email) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("staff_profiles")
    .select("*")
    .eq("email", authUser.email)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new Error("Faculty / Staff profile not found for this login.");
  }

  if (profile.status !== "Active") {
    throw new Error("Your Faculty / Staff account is inactive.");
  }

  /* Save Auth UUID */

  if (profile.auth_user_id !== authUser.id) {
    await supabase
      .from("staff_profiles")
      .update({
        auth_user_id: authUser.id,

        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }

  /* Load permissions */

  const { data: permissionRows, error: permissionError } = await supabase
    .from("staff_permissions")
    .select("permission")
    .eq("staff_id", profile.id);

  if (permissionError) {
    throw permissionError;
  }

  const userPermissions: Permission[] = (permissionRows || []).map(
    (row) => row.permission as Permission,
  );

  return {
    id: profile.id,

    name: profile.name,

    email: profile.email,

    role: profile.role as Role,

    permissions: userPermissions,
  };
}
