"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import BackToDashboard from "./BackToDashboard";
import Icon from "./Icon";
import Modal from "./ui/Modal";

import {
  Permission,
  Role,
  Staff,
  AppUser,
  permissions,
  hasPermission,
} from "@/lib/permissions";

import { rolePermissions } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

/* ============================================================
   LABELS
============================================================ */

const labels: Record<string, string> = {
  attendance: "Attendance",
  students: "Students",
  announcements: "Announcements",
  timetable: "Timetable",
  syllabus: "Syllabus",
  doubts: "Doubts",
  onlineClasses: "Online Classes",
  leaves: "Leave Requests",
  staff: "Faculty & Staff",
};

const permissionLabels: Record<string, string> = {
  view: "View",
  mark: "Mark",
  edit: "Edit",
  create: "Create",
  delete: "Delete",
  manage: "Manage",
  answer: "Answer",
  approve: "Approve",
  reject: "Reject",
  permissions: "Manage Permissions",
};

/* ============================================================
   EMPTY FORM
============================================================ */

const blank = {
  name: "",
  employeeId: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  department: "English",
  role: "FACULTY" as Role,
  status: "Active" as "Active" | "Inactive",
};

/* ============================================================
   COMPONENT
============================================================ */

export default function StaffManagement({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  /* ==========================================================
     STATE
  ========================================================== */

  const [staff, setStaff] = useState<Staff[]>([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [add, setAdd] = useState(false);

  const [selected, setSelected] = useState<Staff | null>(null);

  const [query, setQuery] = useState("");

  const [roleFilter, setRoleFilter] = useState("All");

  const [form, setForm] = useState(blank);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  /* ==========================================================
     LOAD STAFF FROM SUPABASE
  ========================================================== */

  const loadStaff = async () => {
    setLoading(true);
    setError("");

    try {
      const { data: staffRows, error: staffError } = await supabase
        .from("staff_profiles")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (staffError) {
        throw staffError;
      }

      const rows = staffRows || [];

      const staffIds = rows.map((row: any) => row.id);

      let permissionRows: {
        staff_id: string;
        permission: Permission;
      }[] = [];

      if (staffIds.length > 0) {
        const { data, error: permissionError } = await supabase
          .from("staff_permissions")
          .select("staff_id, permission")
          .in("staff_id", staffIds);

        if (permissionError) {
          throw permissionError;
        }

        permissionRows = (data || []) as {
          staff_id: string;
          permission: Permission;
        }[];
      }

      const mappedStaff: Staff[] = rows.map((row: any) => {
        const userPermissions = permissionRows
          .filter((permission) => permission.staff_id === row.id)
          .map((permission) => permission.permission);

        return {
          id: row.id,

          name: row.name,

          employeeId: row.employee_id,

          department: row.department || "",

          role: row.role as Role,

          email: row.email,

          phone: row.phone || "",

          status: row.status,

          permissions: userPermissions,
        };
      });

      setStaff(mappedStaff);
    } catch (err: any) {
      console.error("LOAD STAFF ERROR:", err);

      setError(err?.message || "Unable to load Faculty & Staff.");
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    loadStaff();
  }, []);

  /* ==========================================================
     FILTER
  ========================================================== */

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const roleMatch = roleFilter === "All" || s.role === roleFilter;

      const searchText = `
              ${s.name}
              ${s.employeeId}
              ${s.department}
              ${s.email}
            `.toLowerCase();

      const searchMatch = searchText.includes(query.toLowerCase());

      return roleMatch && searchMatch;
    });
  }, [staff, query, roleFilter]);

  /* ==========================================================
     ADD STAFF
  ========================================================== */

  const addStaff = async (e: FormEvent) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!form.name.trim() || !form.employeeId.trim() || !form.email.trim()) {
      setError("Name, Employee ID and Email are required.");

      return;
    }

    if (!form.password) {
      setError("Please set a password for this user.");

      return;
    }

    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");

      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");

      return;
    }

    setSaving(true);

    try {
      /* ======================================================
       ROLE DEFAULT PERMISSIONS
    ====================================================== */

      let defaultPermissions: Permission[] = [
        ...(rolePermissions[form.role as Role] || []),
      ];

      /*
       * MAIN_ADMIN gets every permission.
       */

      if (form.role === "MAIN_ADMIN") {
        defaultPermissions = Object.values(permissions).flat() as Permission[];
      }

      /* ======================================================
       CREATE STAFF THROUGH SERVER
    ====================================================== */

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your login session has expired. Please sign in again.");
      }

      const response = await fetch("/api/create-staff", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          name: form.name.trim(),

          employeeId: form.employeeId.trim(),

          email: form.email.trim().toLowerCase(),

          password: form.password,

          phone: form.phone.trim(),

          department: form.department,

          role: form.role,

          status: form.status,

          permissions: defaultPermissions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to create staff.");
      }

      /* ======================================================
       RESET FORM
    ====================================================== */

      setForm(blank);

      setAdd(false);

      setSuccess(
        "Faculty / Staff account created successfully. They can now login using the email and password you set.",
      );

      await loadStaff();
    } catch (err: any) {
      console.error("ADD STAFF ERROR:", err);

      setError(err?.message || "Unable to create Faculty / Staff.");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     ROLE CHANGE
  ========================================================== */

  const setRole = (role: Role) => {
    if (!hasPermission(user, "staff.permissions")) return;
    if (!selected) {
      return;
    }

    setSelected({
      ...selected,

      role,

      permissions: [...(rolePermissions[role] || [])],
    });
  };

  /* ==========================================================
     PERMISSION CHECKBOX
  ========================================================== */

  const togglePermission = (permission: Permission) => {
    if (!hasPermission(user, "staff.permissions")) return;
    if (!selected) {
      return;
    }

    if (selected.role === "MAIN_ADMIN") {
      return;
    }

    const exists = selected.permissions.includes(permission);

    setSelected({
      ...selected,

      permissions: exists
        ? selected.permissions.filter((item) => item !== permission)
        : [...selected.permissions, permission],
    });
  };

  /* ==========================================================
     SAVE PERMISSIONS
  ========================================================== */

  const savePermissions = async () => {
    if (!selected) {
      return;
    }

    if (!hasPermission(user, "staff.permissions")) {
      setError("You don't have permission to manage staff permissions.");

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      /* ----------------------------------------------------
           UPDATE STAFF ROLE
        ---------------------------------------------------- */

      const { error: roleError } = await supabase
        .from("staff_profiles")
        .update({
          role: selected.role,

          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);

      if (roleError) {
        throw roleError;
      }

      /* ----------------------------------------------------
           DELETE OLD PERMISSIONS
        ---------------------------------------------------- */

      const { error: deleteError } = await supabase
        .from("staff_permissions")
        .delete()
        .eq("staff_id", selected.id);

      if (deleteError) {
        throw deleteError;
      }

      /* ----------------------------------------------------
           MAIN ADMIN = EVERYTHING
        ---------------------------------------------------- */

      let finalPermissions: Permission[] = selected.permissions;

      if (selected.role === "MAIN_ADMIN") {
        finalPermissions = Object.values(permissions).flat() as Permission[];
      }

      /* ----------------------------------------------------
           INSERT PERMISSIONS
        ---------------------------------------------------- */

      if (finalPermissions.length > 0) {
        const rows = finalPermissions.map((permission) => ({
          staff_id: selected.id,

          permission,
        }));

        const { error: insertError } = await supabase
          .from("staff_permissions")
          .insert(rows);

        if (insertError) {
          throw insertError;
        }
      }

      setSelected(null);

      setSuccess(`Permissions updated for ${selected.name}.`);

      await loadStaff();
    } catch (err: any) {
      console.error("SAVE PERMISSION ERROR:", err);

      setError(err?.message || "Unable to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     TOGGLE ACTIVE / INACTIVE
  ========================================================== */

  const toggleStatus = async (member: Staff) => {
    if (
      !hasPermission(user, "staff.edit") &&
      !hasPermission(user, "staff.permissions")
    ) {
      setError("You don't have permission to change staff status.");

      return;
    }

    setError("");
    setSuccess("");

    const nextStatus = member.status === "Active" ? "Inactive" : "Active";

    const { error } = await supabase
      .from("staff_profiles")
      .update({
        status: nextStatus,

        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (error) {
      setError(error.message);

      return;
    }

    setSuccess(`${member.name} is now ${nextStatus}.`);

    await loadStaff();
  };

  /* ==========================================================
     DELETE STAFF
  ========================================================== */

  const deleteStaff = async (member: Staff) => {
    if (!hasPermission(user, "staff.delete")) {
      setError("You don't have permission to delete staff.");

      return;
    }

    const confirmed = window.confirm(
      `Delete ${member.name}? This will also remove their permissions.`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("staff_profiles")
        .delete()
        .eq("id", member.id);

      if (error) {
        throw error;
      }

      setSuccess(`${member.name} deleted successfully.`);

      await loadStaff();
    } catch (err: any) {
      setError(err?.message || "Unable to delete staff.");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     PAGE
  ========================================================== */

  return (
    <div className="professionalModule">
      {/* ======================================================
          BACK
      ====================================================== */}

      <BackToDashboard onBack={onBack} />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="moduleHeader professionalHeader">
        <div>
          <div className="moduleKicker">
            <Icon name="users" size={17} />
            Faculty & Staff
          </div>

          <h1>Faculty & Staff</h1>

          <p>Manage staff accounts, roles and module-level permissions.</p>
        </div>

        {hasPermission(user, "staff.create") && (
          <button
            className="primaryButton"
            onClick={() => {
              setForm(blank);

              setError("");

              setAdd(true);
            }}
          >
            <Icon name="plus" size={17} />
            Add Faculty / Staff
          </button>
        )}
      </div>

      {/* ======================================================
          ALERTS
      ====================================================== */}

      {error && (
        <div className="staffAlert staffAlertError">
          <span>{error}</span>

          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="staffAlert staffAlertSuccess">
          <span>{success}</span>

          <button type="button" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <section className="summaryGrid compactSummary">
        <div className="summaryCard">
          <div>
            <span>Total Staff</span>

            <strong>{staff.length}</strong>
          </div>

          <div className="summaryIcon">
            <Icon name="users" size={19} />
          </div>
        </div>

        <div className="summaryCard">
          <div>
            <span>Faculty</span>

            <strong>{staff.filter((s) => s.role === "FACULTY").length}</strong>
          </div>

          <div className="summaryIcon">
            <Icon name="graduation" size={19} />
          </div>
        </div>

        <div className="summaryCard">
          <div>
            <span>Administrative Staff</span>

            <strong>{staff.filter((s) => s.role === "STAFF").length}</strong>
          </div>

          <div className="summaryIcon">
            <Icon name="activity" size={19} />
          </div>
        </div>

        <div className="summaryCard summaryCard-success">
          <div>
            <span>Active Accounts</span>

            <strong>{staff.filter((s) => s.status === "Active").length}</strong>
          </div>

          <div className="summaryIcon">
            <Icon name="check" size={19} />
          </div>
        </div>
      </section>

      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <div className="professionalToolbar">
        <div className="professionalSearch">
          <Icon name="search" size={18} />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, employee ID or department..."
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="All">All</option>

          <option value="FACULTY">Faculty</option>

          <option value="STAFF">Staff</option>

          <option value="MAIN_ADMIN">Main Admin</option>
        </select>

        <span className="resultCount">{filtered.length} staff</span>
      </div>

      {/* ======================================================
          STAFF TABLE
      ====================================================== */}

      <section className="professionalTableCard">
        <div className="tableHeader professionalTableHeader">
          <div>
            <h2>Staff Directory</h2>

            <p>Every account and its current access level.</p>
          </div>
        </div>

        <div className="tableScroll">
          <table className="professionalTable staffTable">
            <thead>
              <tr>
                <th>NAME</th>

                <th>EMPLOYEE ID</th>

                <th>DEPARTMENT</th>

                <th>ROLE</th>

                <th>EMAIL</th>

                <th>STATUS</th>

                <th>ACCESS</th>

                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
                    Loading staff...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
                    No staff found.
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="studentName">
                        {member.name}

                        <small>{member.phone}</small>
                      </div>
                    </td>

                    <td className="mono">{member.employeeId}</td>

                    <td>{member.department}</td>

                    <td>
                      <span className="roleBadge">
                        {member.role === "MAIN_ADMIN"
                          ? "Main Admin"
                          : member.role === "FACULTY"
                            ? "Faculty"
                            : "Staff"}
                      </span>
                    </td>

                    <td>{member.email}</td>

                    <td>
                      <button
                        type="button"
                        className={`professionalStatus ${
                          member.status === "Active" ? "active" : "inactive"
                        } statusButton`}
                        disabled={
                          !hasPermission(user, "staff.edit") &&
                          !hasPermission(user, "staff.permissions")
                        }
                        onClick={() => toggleStatus(member)}
                      >
                        {member.status}
                      </button>
                    </td>

                    <td>
                      {member.role === "MAIN_ADMIN"
                        ? "Full Access"
                        : `${member.permissions.length} permissions`}
                    </td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                        }}
                      >
                        {hasPermission(user, "staff.permissions") && (
                          <button
                            type="button"
                            className="tableAction"
                            onClick={() => setSelected(member)}
                          >
                            <Icon name="settings" size={14} />
                            Permissions
                          </button>
                        )}

                        {hasPermission(user, "staff.delete") && (
                          <button
                            type="button"
                            className="tableAction"
                            onClick={() => deleteStaff(member)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================
          ADD MODAL
      ====================================================== */}

      {add && (
        <Modal title="Add Faculty / Staff" onClose={() => setAdd(false)}>
          <form className="classForm" onSubmit={addStaff}>
            <label>
              Full Name
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                placeholder="e.g. Dr. Nithin"
              />
            </label>

            <label>
              Employee ID
              <input
                required
                value={form.employeeId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employeeId: e.target.value,
                  })
                }
                placeholder="FAC/003"
              />
            </label>

            <label>
              Login Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                placeholder="teacher@example.com"
              />
            </label>

            <label>
              Login Password
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                placeholder="Set login password"
                autoComplete="new-password"
              />
            </label>

            <label>
              Confirm Password
              <input
                type="password"
                required
                minLength={6}
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({
                    ...form,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm login password"
                autoComplete="new-password"
              />
            </label>

            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Department
              <select
                value={form.department}
                onChange={(e) =>
                  setForm({
                    ...form,
                    department: e.target.value,
                  })
                }
              >
                <option>English</option>

                <option>Commerce</option>

                <option>Arabic</option>

                <option>Malayalam</option>
              </select>
            </label>

            <label>
              Role
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as Role,
                  })
                }
              >
                <option value="FACULTY">Faculty</option>

                <option value="STAFF">Staff</option>

                <option value="MAIN_ADMIN">Main Administrator</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as "Active" | "Inactive",
                  })
                }
              >
                <option value="Active">Active</option>

                <option value="Inactive">Inactive</option>
              </select>
            </label>

            <div className="modalActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setAdd(false)}
              >
                Cancel
              </button>

              <button type="submit" className="primaryButton" disabled={saving}>
                <Icon name="check" size={15} />

                {saving ? "Creating..." : "Create & Configure Access"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================
          PERMISSION MODAL
      ====================================================== */}

      {selected && (
        <Modal
          title={`Configure Access · ${selected.name}`}
          onClose={() => setSelected(null)}
        >
          <div className="permissionEditor">
            {/* USER INFO */}

            <div className="permissionIntro">
              <div className="roleAvatar">
                {selected.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <b>{selected.name}</b>

                <span>
                  {selected.employeeId}
                  {" · "}
                  {selected.department}
                </span>

                <span>{selected.email}</span>
              </div>
            </div>

            {/* ROLE */}

            <label className="permissionRole">
              Role Preset
              <select
                value={selected.role}
                onChange={(e) => setRole(e.target.value as Role)}
                disabled={!hasPermission(user, "staff.permissions")}
              >
                <option value="MAIN_ADMIN">Main Administrator</option>

                <option value="FACULTY">Faculty</option>

                <option value="STAFF">Staff</option>
              </select>
            </label>

            <div className="permissionHint">
              Select exactly what this user can access. Changing the role preset
              resets the permissions to that role's defaults.
            </div>

            {/* PERMISSION GROUPS */}

            <div className="permissionGroups">
              {Object.entries(permissions).map(
                ([moduleKey, permissionList]) => (
                  <section className="permissionGroup" key={moduleKey}>
                    <div className="permissionGroupTitle">
                      <h3>{labels[moduleKey] || moduleKey}</h3>

                      <span>{permissionList.length} controls</span>
                    </div>

                    {permissionList.map((permission) => {
                      const action = permission.split(".")[1];

                      const checked =
                        selected.role === "MAIN_ADMIN" ||
                        selected.permissions.includes(permission as Permission);

                      return (
                        <label className="permissionItem" key={permission}>
                          <span>
                            <b>{permissionLabels[action] || action}</b>

                            <small>
                              {labels[moduleKey] || moduleKey} module
                            </small>
                          </span>

                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              selected.role === "MAIN_ADMIN" ||
                              !hasPermission(user, "staff.permissions")
                            }
                            onChange={() =>
                              togglePermission(permission as Permission)
                            }
                          />
                        </label>
                      );
                    })}
                  </section>
                ),
              )}
            </div>

            {/* ACTIONS */}

            <div className="modalActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>

              {hasPermission(user, "staff.permissions") && (
                <button
                  type="button"
                  className="primaryButton"
                  onClick={savePermissions}
                  disabled={saving}
                >
                  <Icon name="check" size={15} />

                  {saving ? "Saving..." : "Save Permissions"}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
