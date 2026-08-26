export type ModuleId =
  | "attendance"
  | "reports"
  | "students"
  | "announcements"
  | "timetable"
  | "syllabus"
  | "doubts"
  | "library"
  | "online-class"
  | "leave"
  | "staff";

export type ModuleItem = {
  id: ModuleId;
  title: string;
  description: string;
  icon: string;
};

export type Student = {
  regNo: string;
  name: string;
  course: string;
  rollNo: string;
  admissionNo: string;
  semester: string;
  status: "Active" | "Inactive";
};

export type Role = "MAIN_ADMIN" | "FACULTY" | "STAFF";
export type Permission = string;
export type User = { id: string; name: string; role: Role; permissions: Permission[] };
export type Staff = { id: string; name: string; employeeId: string; department: string; role: Role; email: string; phone: string; status: "Active" | "Inactive"; permissions: Permission[] };
export type Attendance = { studentId: string; date: string; status: "Present" | "Absent" };
export type Announcement = { id: string; title: string; message: string; audience: string; publishedBy: string; date: string; status: "Published" | "Draft" };
export type OnlineClass = { id: string; subject: string; faculty: string; course: string; semester: string; date: string; startTime: string; endTime: string; meetingLink: string; description: string; status: "Upcoming" | "Live" | "Completed" };
export type Syllabus = { id: string; subject: string; faculty: string; units: { title: string; status: "Completed" | "In Progress" | "Pending" }[] };
export type LeaveRequest = { id: string; student: string; regNo: string; course: string; from: string; to: string; reason: string; submitted: string; status: "Pending" | "Approved" | "Rejected" };
export type Doubt = { id: string; student: string; course: string; subject: string; question: string; faculty: string; date: string; status: "Pending" | "Answered" };
