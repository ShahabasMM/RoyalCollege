import { ModuleItem } from "@/types";

export const modules: ModuleItem[] = [
  
  { id: "attendance", title: "Attendance", description: "Manage daily attendance and class hours.", icon: "clipboard" },
  { id: "reports", title: "Reports", description: "Generate monthly attendance summaries and PDF reports.", icon: "activity" },
  { id: "students", title: "Students", description: "Import, export, search and manage student records.", icon: "users" },
  { id: "announcements", title: "Announcements", description: "Publish notices to the student app.", icon: "megaphone" },
  { id: "timetable", title: "Timetable", description: "Manage course schedules from Monday to Saturday.", icon: "calendar" },
  { id: "syllabus", title: "Syllabus", description: "Manage curriculum and course progress.", icon: "book" },
  { id: "doubts", title: "Doubts", description: "Review and answer student questions.", icon: "help" },
  { id: "library", title: "Library", description: "Manage books and digital resources.", icon: "library" },
  { id: "online-class", title: "Online Classes", description: "Create and manage online sessions.", icon: "video" },
  { id: "leave", title: "Leave Requests", description: "Review and approve student leave.", icon: "file" }
  ,{ id: "staff", title: "Faculty & Staff", description: "Manage faculty, staff accounts and module permissions.", icon: "users" }
<<<<<<< HEAD
=======
  ,{ id: "internal-marks", title: "Internal Marks", description: "Enter and manage student internal marks.", icon: "clipboard" },
  { id: "monthly-report", title: "Monthly Report", description: "Track faculty units and chapters completed each month.", icon: "file" }
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
];
