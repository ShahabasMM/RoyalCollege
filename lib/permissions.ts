/* ============================================================
   PERMISSION TYPES
============================================================ */

export type Permission =
  | "attendance.view"
  | "attendance.mark"
  | "attendance.edit"
  | "students.view"
  | "students.create"
  | "students.edit"
  | "students.delete"
  | "announcements.view"
  | "announcements.create"
  | "announcements.edit"
  | "announcements.delete"
  | "timetable.view"
  | "timetable.create"
  | "timetable.edit"
  | "library.view"
  | "library.reserve"
  | "library.issue"
  | "library.return"
  | "library.manage"
  | "syllabus.view"
  | "syllabus.manage"
  | "doubts.view"
  | "doubts.answer"
  | "online.view"
  | "online.create"
  | "online.edit"
  | "online.delete"
  | "leaves.view"
  | "leaves.approve"
  | "leaves.reject"
  | "staff.view"
  | "staff.create"
  | "staff.edit"
  | "staff.delete"
  | "staff.permissions";

/* ============================================================
   ROLE TYPES
============================================================ */

export type Role = "MAIN_ADMIN" | "FACULTY" | "STAFF";

/* ============================================================
   USER TYPE
============================================================ */

export type AppUser = {
  id: string;

  name: string;

  email: string;

  role: Role;

  permissions: Permission[];
};

/* ============================================================
   STAFF TYPE
============================================================ */

export type Staff = {
  id: string;

  name: string;

  employeeId: string;

  department: string;

  role: Role;

  email: string;

  phone: string;

  status: "Active" | "Inactive";

  permissions: Permission[];
};

/* ============================================================
   PERMISSION GROUPS
============================================================ */

export const permissions = {
  attendance: ["attendance.view", "attendance.mark", "attendance.edit"],

  students: [
    "students.view",
    "students.create",
    "students.edit",
    "students.delete",
  ],

  announcements: [
    "announcements.view",
    "announcements.create",
    "announcements.edit",
    "announcements.delete",
  ],

  timetable: ["timetable.view", "timetable.create", "timetable.edit"],

  syllabus: ["syllabus.view", "syllabus.manage"],

  library: [
    "library.view",
    "library.reserve",
    "library.issue",
    "library.return",
    "library.manage",
  ],

  doubts: ["doubts.view", "doubts.answer"],

  onlineClasses: [
    "online.view",
    "online.create",
    "online.edit",
    "online.delete",
  ],

  leaves: ["leaves.view", "leaves.approve", "leaves.reject"],

  staff: [
    "staff.view",
    "staff.create",
    "staff.edit",
    "staff.delete",
    "staff.permissions",
  ],
} as const;

/* ============================================================
   CHECK ONE PERMISSION
============================================================ */

export const hasPermission = (
  user: AppUser,
  permission: Permission,
): boolean => {
  if (user.role === "MAIN_ADMIN") {
    return true;
  }

  return user.permissions.includes(permission);
};

/* ============================================================
   CAN ACCESS
============================================================ */

export const canAccess = (user: AppUser, permission: Permission): boolean => {
  return hasPermission(user, permission);
};

/* ============================================================
   ALL PERMISSIONS
============================================================ */

export const getAllPermissions = (): Permission[] => {
  return Object.values(permissions).flat() as Permission[];
};

/* ============================================================
   MODULE PERMISSIONS
============================================================ */

export const getModulePermissions = (
  module: keyof typeof permissions,
): Permission[] => {
  return [...permissions[module]] as Permission[];
};

/* ============================================================
   ALL REQUIRED
============================================================ */

export const hasAllPermissions = (
  user: AppUser,
  required: Permission[],
): boolean => {
  if (user.role === "MAIN_ADMIN") {
    return true;
  }

  return required.every((permission) => user.permissions.includes(permission));
};

/* ============================================================
   ANY REQUIRED
============================================================ */

export const hasAnyPermission = (
  user: AppUser,
  required: Permission[],
): boolean => {
  if (user.role === "MAIN_ADMIN") {
    return true;
  }

  return required.some((permission) => user.permissions.includes(permission));
};
