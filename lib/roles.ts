import {
  Permission,
  Role,
} from "./permissions";


export const rolePermissions:
  Record<Role, Permission[]> = {

  MAIN_ADMIN: [
    "attendance.view",
    "attendance.mark",
    "attendance.edit",

    "students.view",
    "students.create",
    "students.edit",
    "students.delete",

    "announcements.view",
    "announcements.create",
    "announcements.edit",
    "announcements.delete",

    "timetable.view",
    "timetable.create",
    "timetable.edit",

    "syllabus.view",
    "syllabus.manage",

    "doubts.view",
    "doubts.answer",

    "online.view",
    "online.create",
    "online.edit",
    "online.delete",

    "leaves.view",
    "leaves.approve",
    "leaves.reject",

    "staff.view",
    "staff.create",
    "staff.edit",
    "staff.delete",
    "staff.permissions",
<<<<<<< HEAD
=======

    "internal_marks.view",
    "internal_marks.edit",
    "monthly_report.view",
    "monthly_report.edit",
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
  ],


  FACULTY: [
    "attendance.view",
    "attendance.mark",

    "timetable.view",

    "syllabus.view",

    "doubts.view",
    "doubts.answer",

    "online.view",

    "leaves.view",
<<<<<<< HEAD
=======

    "internal_marks.view",
    "internal_marks.edit",
    "monthly_report.view",
    "monthly_report.edit",
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
  ],


  STAFF: [
    "students.view",

    "announcements.view",

    "timetable.view",

    "leaves.view",
  ],
<<<<<<< HEAD
};
=======
};
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
