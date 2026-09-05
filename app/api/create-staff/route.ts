import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    /* ======================================================
       CHECK AUTHORIZATION HEADER
    ====================================================== */

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken =
      authorization.slice("Bearer ".length);

    /* ======================================================
       VERIFY CURRENT USER
    ====================================================== */

    const {
      data: currentAuthData,
      error: currentAuthError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );

    if (
      currentAuthError ||
      !currentAuthData.user?.email
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid authentication session.",
        },
        {
          status: 401,
        }
      );
    }

    /* ======================================================
       FIND CALLER STAFF PROFILE
    ====================================================== */

    let {
      data: callerProfile,
      error: callerError,
    } =
      await supabaseAdmin
        .from("staff_profiles")
        .select(
          "id, role, auth_user_id"
        )
        .eq(
          "auth_user_id",
          currentAuthData.user.id
        )
        .maybeSingle();

    if (callerError) {
      return NextResponse.json(
        {
          error:
            callerError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* ======================================================
       FALLBACK FOR OLD ADMIN PROFILE
    ====================================================== */

    if (!callerProfile) {
      const fallback =
        await supabaseAdmin
          .from("staff_profiles")
          .select(
            "id, role, auth_user_id"
          )
          .eq(
            "email",
            currentAuthData.user.email
          )
          .maybeSingle();

      if (fallback.error) {
        return NextResponse.json(
          {
            error:
              fallback.error.message,
          },
          {
            status: 500,
          }
        );
      }

      callerProfile =
        fallback.data;

      /* ====================================================
         LINK OLD PROFILE TO AUTH USER
      ==================================================== */

      if (
        callerProfile &&
        !callerProfile.auth_user_id
      ) {
        const {
          error: linkError,
        } =
          await supabaseAdmin
            .from("staff_profiles")
            .update({
              auth_user_id:
                currentAuthData.user.id,
            })
            .eq(
              "id",
              callerProfile.id
            );

        if (linkError) {
          return NextResponse.json(
            {
              error:
                linkError.message,
            },
            {
              status: 500,
            }
          );
        }
      }
    }

    /* ======================================================
       CALLER PROFILE REQUIRED
    ====================================================== */

    if (!callerProfile) {
      return NextResponse.json(
        {
          error:
            "Staff profile not found.",
        },
        {
          status: 403,
        }
      );
    }

    /* ======================================================
       CHECK STAFF CREATE PERMISSION
    ====================================================== */

    let allowed =
      callerProfile.role ===
      "MAIN_ADMIN";

    if (!allowed) {
      const {
        data: permissionRow,
        error:
        permissionCheckError,
      } =
        await supabaseAdmin
          .from("staff_permissions")
          .select("id")
          .eq(
            "staff_id",
            callerProfile.id
          )
          .eq(
            "permission",
            "staff.create"
          )
          .maybeSingle();

      if (
        permissionCheckError
      ) {
        return NextResponse.json(
          {
            error:
              permissionCheckError.message,
          },
          {
            status: 500,
          }
        );
      }

      allowed =
        Boolean(
          permissionRow
        );
    }

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to create Faculty / Staff accounts.",
        },
        {
          status: 403,
        }
      );
    }

    /* ======================================================
       READ REQUEST BODY
    ====================================================== */

    const body =
      await request.json();

    const {
      name,
      employeeId,
      email,
      password,
      phone,
      department,
      role,
      status,
      permissions,
    } = body;

       VALIDATION
=======
    /* ======================================================
       DEBUG - SHOW EXACT PERMISSIONS FROM FRONTEND
    ====================================================== */

    console.log(
      "========================================"
    );

    console.log(
      "CREATE STAFF REQUEST"
    );

    console.log(
      "Requested permissions:",
      permissions
    );

    console.log(
      "========================================"
    );

    /* ======================================================
       BASIC VALIDATION
    ====================================================== */

    if (
      !name?.trim() ||
      !employeeId?.trim() ||
      !email?.trim() ||
      !password
    ) {
      return NextResponse.json(
        {
          error:
            "Name, Employee ID, Email and Password are required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      password.length < 6
    ) {
      return NextResponse.json(
        {
          error:
            "Password must contain at least 6 characters.",
        },
        {
          status: 400,
        }
      );
    }

    /* ======================================================
       CLEAN VALUES
    ====================================================== */

    const cleanName =
      name.trim();

    const cleanEmployeeId =
      employeeId.trim();

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    const cleanPhone =
      typeof phone === "string"
        ? phone.trim() || null
        : null;

    const cleanDepartment =
      typeof department === "string"
        ? department.trim() || null
        : null;

    const cleanRole =
      role === "MAIN_ADMIN" ||
        role === "FACULTY" ||
        role === "STAFF"
        ? role
        : "FACULTY";

    const cleanStatus =
      status === "Inactive"
        ? "Inactive"
        : "Active";

    /* ======================================================
       NORMALIZE PERMISSIONS
    ====================================================== */

    const requestedPermissions =
      Array.isArray(permissions)
        ? Array.from(
          new Set(
            permissions
              .filter(
                (
                  permission: unknown
                ): permission is string =>
                  typeof permission ===
                  "string" &&
                  permission.trim()
                    .length > 0
              )
              .map(
                (permission) =>
                  permission.trim()
              )
          )
        )
        : [];

    console.log(
      "Normalized permissions:",
      requestedPermissions
    );

    /* ======================================================
       LOAD PERMISSION CATALOG
    ====================================================== */

    const {
      data: catalogRows,
      error: catalogError,
    } =
      await supabaseAdmin
        .from("permissions_catalog")
        .select(
          "permission, module, action"
        );

    if (catalogError) {
      return NextResponse.json(
        {
          error:
            "Unable to load permissions catalog.",
          details:
            catalogError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* ======================================================
       CREATE VALID PERMISSION SET
    ====================================================== */

    const validPermissionSet =
      new Set(
        (catalogRows ?? [])
          .map(
            (row) =>
              row.permission
          )
          .filter(
            (
              permission
            ): permission is string =>
              typeof permission ===
              "string"
          )
      );

    const validPermissions =
      Array.from(
        validPermissionSet
      );

    console.log(
      "Permissions available in catalog:",
      validPermissions
    );

    /* ======================================================
       FIND INVALID PERMISSIONS
    ====================================================== */

    const invalidPermissions =
      requestedPermissions.filter(
        (permission) =>
          !validPermissionSet.has(
            permission
          )
      );

    console.log(
      "Invalid permissions:",
      invalidPermissions
    );

    /* ======================================================
       RETURN DETAILED DEBUG RESPONSE
    ====================================================== */

    if (
      invalidPermissions.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid permission(s) selected.",

          invalidPermissions,

          requestedPermissions,

          validPermissions,

          message:
            "The frontend is sending permission values that do not exist in permissions_catalog.",
        },
        {
          status: 400,
        }
      );
    }

    /* ======================================================
       REQUIRED STAFF.CREATE PERMISSION
    ====================================================== */

    if (
      !validPermissionSet.has(
        "staff.create"
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Required permission "staff.create" is missing from permissions_catalog.',

          availablePermissions:
            validPermissions,
        },
        {
          status: 500,
        }
      );
    }

    /* ======================================================
       CHECK EXISTING STAFF PROFILE
    ====================================================== */

    const {
      data: existingProfile,
      error:
      existingProfileError,
    } =
      await supabaseAdmin
        .from("staff_profiles")
        .select("id")
        .or(
          `email.eq.${cleanEmail},employee_id.eq.${cleanEmployeeId}`
        )
        .maybeSingle();

    if (
      existingProfileError
    ) {
      return NextResponse.json(
        {
          error:
            existingProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      existingProfile
    ) {
      return NextResponse.json(
        {
          error:
            "Email or Employee ID is already registered.",
        },
        {
          status: 409,
        }
      );
       CREATE SUPABASE AUTH USER

       IMPORTANT:
       These names are different from the current
       authentication variables above.

       currentAuthData
       currentAuthError

       createdAuthData
       createAuthError
=======
    }

    /* ======================================================
       CREATE SUPABASE AUTH USER
    ====================================================== */

    const {
      data: createdAuthData,
      error: createAuthError,
    } =
       AUTH USER CREATION ERROR
=======
      await supabaseAdmin.auth.admin.createUser(
        {
          email:
            cleanEmail,

          password:
            password,

          email_confirm:
            true,

          user_metadata: {
            name:
              cleanName,

            role:
              cleanRole,

            employee_id:
              cleanEmployeeId,
          },
        }
      );

    /* ======================================================
       AUTH USER ERROR
    ====================================================== */

    if (
      createAuthError
    ) {
      return NextResponse.json(
        {
          error:
            createAuthError.message,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !createdAuthData.user
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to create authentication account.",
        },
        {
          status: 500,
        }
      );
    }

    const newAuthUser =
      createdAuthData.user;

    /* ======================================================
       CREATE STAFF PROFILE
    ====================================================== */

    const {
      data: newStaff,
      error:
      staffProfileError,
    } =
      await supabaseAdmin
        .from("staff_profiles")
        .insert({
          auth_user_id:
            newAuthUser.id,

          name:
            cleanName,

          employee_id:
            cleanEmployeeId,

          department:
            cleanDepartment,

          role:
            cleanRole,

          email:
            cleanEmail,

          phone:
            cleanPhone,

          status:
            cleanStatus,
        })
        .select(
          "id, auth_user_id, name, employee_id, department, role, email, phone, status"
        )
        .single();

    /* ======================================================
       STAFF PROFILE ERROR
    ====================================================== */

    if (
      staffProfileError
    ) {
      await supabaseAdmin.auth.admin.deleteUser(
        newAuthUser.id
      );

      return NextResponse.json(
        {
          error:
            staffProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* ======================================================
       INSERT PERMISSIONS
    ====================================================== */

    if (
      requestedPermissions.length >
      0
    ) {
      const permissionRows =
        requestedPermissions.map(
          (permission) => ({
            staff_id:
              newStaff.id,

            permission:
              permission,
          })
        );

      console.log(
        "Permission rows to insert:",
        permissionRows
      );

      const {
        error:
        permissionsError,
      } =
        await supabaseAdmin
          .from(
            "staff_permissions"
          )
          .insert(
            permissionRows
          );

         PERMISSION ERROR
=======
      /* ====================================================
         PERMISSION INSERT ERROR
      ==================================================== */

      if (
        permissionsError
      ) {
        console.error(
          "STAFF PERMISSION INSERT ERROR:",
          permissionsError
        );

        /* -----------------------------------------------
           ROLLBACK STAFF PROFILE
        ----------------------------------------------- */

        await supabaseAdmin
          .from("staff_profiles")
          .delete()
          .eq(
            "id",
            newStaff.id
          );

        /* -----------------------------------------------
           ROLLBACK AUTH USER
        ----------------------------------------------- */

        await supabaseAdmin.auth.admin.deleteUser(
          newAuthUser.id
        );

        return NextResponse.json(
          {
            error:
              permissionsError.message,

            code:
              permissionsError.code,

            details:
              permissionsError.details,

            hint:
              permissionsError.hint,

            insertedPermissions:
              requestedPermissions,
          },
          {
            status: 500,
          }
        );
      }
    }

    /* ======================================================
       SUCCESS
    ====================================================== */

    console.log(
      "STAFF CREATED SUCCESSFULLY:",
      newStaff.id
    );

    return NextResponse.json(
      {
        success:
          true,

        message:
          "Faculty / Staff account created successfully.",

        staff:
          newStaff,

        authUserId:
          newAuthUser.id,

        permissions:
          requestedPermissions,
      },
      {
        status: 201,
      }
    );

  } catch (error: any) {
    console.error(
      "CREATE STAFF API ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while creating the staff account.",

        details:
          error?.details,

        code:
          error?.code,

        hint:
          error?.hint,
      },
      {
        status: 500,
      }
    );
  }
}