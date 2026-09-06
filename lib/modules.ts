import { ModuleItem } from "@/types";

export const modules: ModuleItem[] = [
  { id: "admission", title: "Admission", description: "Manage admission records and enrollment workflows.", icon: "users", category: "admission-enrollment" },
  { id: "students", title: "Students", description: "Import, export, search and manage student records.", icon: "users", category: "admission-enrollment" },
  { id: "fee-management", title: "Fee Management", description: "Manage student fees and payment records.", icon: "activity", category: "admission-enrollment" },
  { id: "attendance", title: "Attendance", description: "Manage daily attendance and class hours.", icon: "clipboard", category: "academic-cell" },
  { id: "timetable", title: "Timetable", description: "Manage course schedules from Monday to Saturday.", icon: "calendar", category: "academic-cell" },
  { id: "syllabus", title: "Syllabus", description: "Manage curriculum and course progress.", icon: "book", category: "academic-cell" },
  { id: "announcements", title: "Announcement", description: "Publish notices to the student app.", icon: "megaphone", category: "academic-cell" },
  { id: "doubts", title: "Doubt", description: "Review and answer student questions.", icon: "help", category: "academic-cell" },
  { id: "online-class", title: "Online Classes", description: "Create and manage online sessions.", icon: "video", category: "academic-cell" },
  { id: "leave", title: "Leave Request", description: "Review and approve student leave.", icon: "file", category: "academic-cell" },
  { id: "internal-marks", title: "Internal Mark", description: "Enter and manage student internal marks.", icon: "clipboard", category: "academic-cell" },
  { id: "result", title: "Result", description: "Enter grades and generate course result reports.", icon: "activity", category: "academic-cell" },
  { id: "reports", title: "Attendance Report", description: "Generate attendance summaries and PDF reports.", icon: "activity", category: "reports" },
  { id: "monthly-report", title: "Monthly Report", description: "Track faculty units and chapters completed each month.", icon: "file", category: "reports" },
  { id: "staff", title: "Faculty & Staff", description: "Manage faculty, staff accounts and module permissions.", icon: "users", category: "masters" },
  { id: "library", title: "Library", description: "Manage books and digital resources.", icon: "library", category: "library" },
];

