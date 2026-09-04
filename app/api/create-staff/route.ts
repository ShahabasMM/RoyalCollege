import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    /* ======================================================
<<<<<<< HEAD
       CHECK CURRENT ADMIN AUTHENTICATION
=======
       CHECK AUTHORIZATION HEADER
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    ====================================================== */

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
<<<<<<< HEAD
          error:
            "Authentication required.",
=======
          error: "Authentication required.",
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
        },
        {
          status: 401,
        }
      );
    }

<<<<<<< HEAD

    const accessToken =
      authorization.slice("Bearer ".length);


=======
    const accessToken =
      authorization.slice("Bearer ".length);

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       FALLBACK FOR OLD ADMIN PROFILE
    ====================================================== */

    if (!callerProfile) {
<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

      callerProfile =
        fallback.data;


=======
      callerProfile =
        fallback.data;

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      /* ====================================================
         LINK OLD PROFILE TO AUTH USER
      ==================================================== */

      if (
        callerProfile &&
        !callerProfile.auth_user_id
      ) {
<<<<<<< HEAD

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

      }

    }


=======
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

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       CALLER PROFILE REQUIRED
    ====================================================== */

    if (!callerProfile) {
<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            "Staff profile not found.",
        },
        {
          status: 403,
        }
      );
<<<<<<< HEAD

    }


=======
    }

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       CHECK STAFF CREATE PERMISSION
    ====================================================== */

    let allowed =
      callerProfile.role ===
      "MAIN_ADMIN";

<<<<<<< HEAD

    if (!allowed) {

      const {
        data: permissionRow,
        error:
          permissionCheckError,
=======
    if (!allowed) {
      const {
        data: permissionRow,
        error:
        permissionCheckError,
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

      if (
        permissionCheckError
      ) {

=======
      if (
        permissionCheckError
      ) {
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
        return NextResponse.json(
          {
            error:
              permissionCheckError.message,
          },
          {
            status: 500,
          }
        );
<<<<<<< HEAD

      }


=======
      }

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      allowed =
        Boolean(
          permissionRow
        );
<<<<<<< HEAD

    }


    if (!allowed) {

=======
    }

    if (!allowed) {
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            "You do not have permission to create Faculty / Staff accounts.",
        },
        {
          status: 403,
        }
      );
<<<<<<< HEAD

    }


=======
    }

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       READ REQUEST BODY
    ====================================================== */

    const body =
      await request.json();

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD

    /* ======================================================
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
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    ====================================================== */

    if (
      !name?.trim() ||
      !employeeId?.trim() ||
      !email?.trim() ||
      !password
    ) {
<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            "Name, Employee ID, Email and Password are required.",
        },
        {
          status: 400,
        }
      );
<<<<<<< HEAD

    }


    if (
      password.length < 6
    ) {

=======
    }

    if (
      password.length < 6
    ) {
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            "Password must contain at least 6 characters.",
        },
        {
          status: 400,
        }
      );
<<<<<<< HEAD

    }

=======
    }

    /* ======================================================
       CLEAN VALUES
    ====================================================== */
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)

    const cleanName =
      name.trim();

<<<<<<< HEAD

    const cleanEmployeeId =
      employeeId.trim();


=======
    const cleanEmployeeId =
      employeeId.trim();

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    const cleanEmail =
      email
        .trim()
        .toLowerCase();

<<<<<<< HEAD

    const cleanPhone =
      phone?.trim() || null;


    const cleanDepartment =
      department?.trim() || null;


    const cleanRole =
      role || "FACULTY";


    const cleanStatus =
      status || "Active";


    const cleanPermissions =
      Array.isArray(permissions)
        ? permissions
        : [];

=======
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
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)

    /* ======================================================
       CHECK EXISTING STAFF PROFILE
    ====================================================== */

    const {
      data: existingProfile,
      error:
<<<<<<< HEAD
        existingProfileError,
=======
      existingProfileError,
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    } =
      await supabaseAdmin
        .from("staff_profiles")
        .select("id")
        .or(
          `email.eq.${cleanEmail},employee_id.eq.${cleanEmployeeId}`
        )
        .maybeSingle();

<<<<<<< HEAD

    if (
      existingProfileError
    ) {

=======
    if (
      existingProfileError
    ) {
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            existingProfileError.message,
        },
        {
          status: 500,
        }
      );
<<<<<<< HEAD

    }


    if (
      existingProfile
    ) {

=======
    }

    if (
      existingProfile
    ) {
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            "Email or Employee ID is already registered.",
        },
        {
          status: 409,
        }
      );
<<<<<<< HEAD

    }


    /* ======================================================
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
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    ====================================================== */

    const {
      data: createdAuthData,
      error: createAuthError,
    } =
<<<<<<< HEAD
      await supabaseAdmin.auth.admin.createUser({

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

      });


    /* ======================================================
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
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    ====================================================== */

    if (
      createAuthError
    ) {
<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            createAuthError.message,
        },
        {
          status: 400,
        }
      );
<<<<<<< HEAD

    }


    if (
      !createdAuthData.user
    ) {

=======
    }

    if (
      !createdAuthData.user
    ) {
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            "Unable to create authentication account.",
        },
        {
          status: 500,
        }
      );
<<<<<<< HEAD

    }


    const newAuthUser =
      createdAuthData.user;


=======
    }

    const newAuthUser =
      createdAuthData.user;

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       CREATE STAFF PROFILE
    ====================================================== */

    const {
      data: newStaff,
<<<<<<< HEAD
      error: staffProfileError,
=======
      error:
      staffProfileError,
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    } =
      await supabaseAdmin
        .from("staff_profiles")
        .insert({
<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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
<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
        })
        .select(
          "id, auth_user_id, name, employee_id, department, role, email, phone, status"
        )
        .single();

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       STAFF PROFILE ERROR
    ====================================================== */

    if (
      staffProfileError
    ) {
<<<<<<< HEAD

      /*
       * If profile creation fails,
       * remove the Auth user we just created.
       */

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      await supabaseAdmin.auth.admin.deleteUser(
        newAuthUser.id
      );

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      return NextResponse.json(
        {
          error:
            staffProfileError.message,
        },
        {
          status: 500,
        }
      );
<<<<<<< HEAD

    }


=======
    }

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       INSERT PERMISSIONS
    ====================================================== */

    if (
<<<<<<< HEAD
      cleanPermissions.length > 0
    ) {

      const permissionRows =
        cleanPermissions.map(
          (permission: string) => ({
=======
      requestedPermissions.length >
      0
    ) {
      const permissionRows =
        requestedPermissions.map(
          (permission) => ({
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
            staff_id:
              newStaff.id,

            permission:
              permission,
          })
        );

<<<<<<< HEAD

      const {
        error:
          permissionsError,
      } =
        await supabaseAdmin
          .from("staff_permissions")
=======
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
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
          .insert(
            permissionRows
          );

<<<<<<< HEAD

      /* ====================================================
         PERMISSION ERROR
=======
      /* ====================================================
         PERMISSION INSERT ERROR
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      ==================================================== */

      if (
        permissionsError
      ) {
<<<<<<< HEAD

        /*
         * Roll back profile and Auth account.
         */
=======
        console.error(
          "STAFF PERMISSION INSERT ERROR:",
          permissionsError
        );

        /* -----------------------------------------------
           ROLLBACK STAFF PROFILE
        ----------------------------------------------- */
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)

        await supabaseAdmin
          .from("staff_profiles")
          .delete()
          .eq(
            "id",
            newStaff.id
          );

<<<<<<< HEAD
=======
        /* -----------------------------------------------
           ROLLBACK AUTH USER
        ----------------------------------------------- */
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)

        await supabaseAdmin.auth.admin.deleteUser(
          newAuthUser.id
        );

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
        return NextResponse.json(
          {
            error:
              permissionsError.message,
<<<<<<< HEAD
=======

            code:
              permissionsError.code,

            details:
              permissionsError.details,

            hint:
              permissionsError.hint,

            insertedPermissions:
              requestedPermissions,
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
          },
          {
            status: 500,
          }
        );
<<<<<<< HEAD

      }

    }


=======
      }
    }

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    /* ======================================================
       SUCCESS
    ====================================================== */

<<<<<<< HEAD
=======
    console.log(
      "STAFF CREATED SUCCESSFULLY:",
      newStaff.id
    );

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

<<<<<<< HEAD
=======
        permissions:
          requestedPermissions,
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      },
      {
        status: 201,
      }
    );

<<<<<<< HEAD

  } catch (error: any) {

=======
  } catch (error: any) {
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    console.error(
      "CREATE STAFF API ERROR:",
      error
    );

<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while creating the staff account.",
<<<<<<< HEAD
=======

        details:
          error?.details,

        code:
          error?.code,

        hint:
          error?.hint,
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      },
      {
        status: 500,
      }
    );
<<<<<<< HEAD

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
  }
}