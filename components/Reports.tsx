"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { AppUser, hasPermission } from "@/lib/permissions";
import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import Icon from "./Icon";

const COURSES = [
  "All Courses",
  "B.A English",
  "B.Com CA",
  "B.Com Co-op",
  "BBA Finance",
];
const SEMESTERS = ["All Semesters", "1", "2", "3", "4", "5", "6", "7", "8"];
const HOURS = [1, 2, 3, 4, 5];
type ReportType = "day" | "month" | "range" | "semester" | "student";
type Status = "Present" | "Absent" | "";
type Student = {
  id: string;
  name: string;
  admission_no: string;
  course: string;
  semester: number;
};
type Session = {
  id: string;
  attendance_date: string;
  course: string;
  semester: number | string;
  hour: number | string;
};
type Row = Student & {
  working: number;
  present: number;
  absent: number;
  percentage: number;
  hours: Record<number, Status>;
};

function today() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function normalize(value: unknown) {
  const result = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
  if (result.includes("english")) return "b.a english";
  if (
    result.includes("b.com") &&
    (result.includes("co-op") ||
      result.includes("co op") ||
      result.includes("co-operation") ||
      result.includes("cooperation"))
  )
    return "b.com co-op";
  if (
    result.includes("b.com") &&
    (result.includes("ca") || result.includes("computer application"))
  )
    return "b.com ca";
  return result;
}
function semesterNumber(value: unknown) {
  const match = String(value ?? "").match(/[1-8]/);
  return match ? Number(match[0]) : 0;
}
function statusValue(value: unknown): Status {
  const valueText = String(value ?? "")
    .trim()
    .toLowerCase();
  return valueText === "present"
    ? "Present"
    : valueText === "absent"
      ? "Absent"
      : "";
}
function monthRange(value: string) {
  const parts = value.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const last = new Date(year, month, 0).getDate();
  return {
    start: year + "-" + String(month).padStart(2, "0") + "-01",
    end:
      year +
      "-" +
      String(month).padStart(2, "0") +
      "-" +
      String(last).padStart(2, "0"),
  };
}
function dateText(value: string) {
  return value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
}
function percentage(present: number, absent: number) {
  const total = present + absent;
  return total ? Number(((present / total) * 100).toFixed(1)) : 0;
}

function calendarDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1).getDay();
  const totalDays = new Date(year, monthNumber, 0).getDate();
  return [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
}

function calendarDate(month: string, day: number) {
  return month + "-" + String(day).padStart(2, "0");
}

function changeCalendarMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(year, monthNumber - 1 + amount, 1);
  return (
    next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0")
  );
}

const CSS =
  ".reportsPage{max-width:1400px;margin:0 auto;padding-bottom:40px}.reportsHeader{margin:24px 0}.reportsEyebrow{font-size:11px;letter-spacing:.16em;font-weight:800;color:#7a1f2b}.reportsEyebrow span{display:inline-block;width:7px;height:7px;border-radius:50%;background:#7a1f2b;margin-right:8px}.reportsHeader h1{margin:10px 0 4px;font-size:32px}.reportsHeader p{margin:0;color:#64748b}.reportFilterCard,.monthlySummary,.studentReportCard{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;margin-top:18px;box-shadow:0 8px 25px rgba(15,23,42,.04)}.reportSectionTitle h2,.summaryTitle h2,.studentReportHeader h2{margin:0 0 5px}.reportSectionTitle p,.summaryTitle p,.studentReportHeader p{margin:0;color:#64748b;font-size:13px}.reportFilters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:20px;align-items:end}.reportFilters label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:800;color:#64748b;letter-spacing:.08em}.reportFilters select,.reportFilters input{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 11px;background:#fff;color:#172033;font:inherit;font-size:13px;letter-spacing:0}.generateReportButton,.downloadPdfButton{height:42px;border:0;border-radius:10px;background:#7a1f2b;color:#fff;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:0 15px}.generateReportButton:disabled,.downloadPdfButton:disabled{opacity:.5;cursor:not-allowed}.reportAlert{margin-top:16px;padding:12px 14px;border-radius:10px;display:flex;justify-content:space-between;font-size:13px;font-weight:600}.reportAlert.error{background:#fff1f2;color:#be123c}.reportAlert.success{background:#f0fdf4;color:#166534}.reportAlert button{border:0;background:transparent;font-size:20px;cursor:pointer;color:inherit}.summaryTitle,.studentReportHeader{display:flex;justify-content:space-between;align-items:center}.summaryGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.summaryCard{padding:16px;border-radius:12px;background:#f8fafc}.summaryCard span{display:block;font-size:10px;color:#64748b;font-weight:800;letter-spacing:.08em}.summaryCard strong{display:block;font-size:25px;margin-top:7px}.summaryCard.green{color:#15803d;background:#f0fdf4}.summaryCard.purple{color:#7e22ce;background:#faf5ff}.reportTableWrapper{overflow:auto;margin-top:20px}.studentReportTable{width:100%;border-collapse:collapse;min-width:760px}.studentReportTable th,.studentReportTable td{padding:12px 10px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px;white-space:nowrap}.studentReportTable th{color:#64748b;font-size:10px;letter-spacing:.08em}.reportStudent{display:flex;flex-direction:column;gap:3px}.reportStudent span{font-size:11px;color:#64748b}.presentValue{color:#15803d;font-weight:800}.absentValue{color:#dc2626;font-weight:800}.percentage{font-weight:800}.percentage.good{color:#15803d}.percentage.low{color:#dc2626}.reportEmpty{padding:45px 15px;text-align:center;display:flex;flex-direction:column;gap:8px;color:#64748b}.reportEmpty strong{color:#172033}@media(max-width:768px){.reportsHeader h1{font-size:25px}.reportFilters{grid-template-columns:1fr}.summaryGrid{grid-template-columns:repeat(2,1fr)}.studentReportHeader{align-items:flex-start;gap:12px;flex-direction:column}.downloadPdfButton{width:100%}}";

export default function ReportsEnhanced({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const [type, setType] = useState<ReportType>("month");
  const [course, setCourse] = useState("All Courses");
  const [semester, setSemester] = useState("All Semesters");
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [fromDate, setFromDate] = useState(today().slice(0, 8) + "01");
  const [toDate, setToDate] = useState(today());
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7));
  const [calendarStart, setCalendarStart] = useState(today());
  const [calendarEnd, setCalendarEnd] = useState(today());
  const [confirmedRange, setConfirmedRange] = useState("");
  const calendarDraggingRef = useRef(false);
  const calendarAnchorRef = useRef<string | null>(null);
  const [studentId, setStudentId] = useState("all");
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selectedStudent = useMemo(
    () => allStudents.find((item) => item.id === studentId),
    [allStudents, studentId],
  );

  async function generateReport(range?: { start: string; end: string }) {
    setLoading(true);
    setGenerated(false);
    setError("");
    setSuccess("");
    try {
      const studentResult = await supabase
        .from("students")
        .select("id, name, admission_no, course, semester")
        .order("name", { ascending: true });
      if (studentResult.error) throw studentResult.error;
      const students: Student[] = (studentResult.data ?? []).map(
        (item: any) => ({
          id: item.id,
          name: item.name || "Unknown Student",
          admission_no: item.admission_no || "",
          course: item.course || "",
          semester: semesterNumber(item.semester),
        }),
      );
      setAllStudents(students);

      let start = "0001-01-01";
      let end = "9999-12-31";
      if (type === "day") {
        start = date;
        end = date;
      }
      if (type === "month") ({ start, end } = monthRange(month));
      if (type === "range" || range) {
        const selectedFrom = range?.start ?? fromDate;
        const selectedTo = range?.end ?? toDate;
        if (!selectedFrom || !selectedTo)
          throw new Error("Please select both From Date and To Date.");
        if (selectedFrom > selectedTo)
          throw new Error("From Date cannot be after To Date.");
        start = selectedFrom;
        end = selectedTo;
      }
      let sessionQuery = supabase
        .from("attendance_sessions")
        .select("id, attendance_date, course, semester, hour")
        .gte("attendance_date", start)
        .lte("attendance_date", end)
        .order("attendance_date", { ascending: true });
      if (semester !== "All Semesters") {
        const selectedSemester = semesterNumber(semester);
        if (!selectedSemester)
          throw new Error("Please select a valid semester.");
        sessionQuery = sessionQuery.eq("semester", selectedSemester);
      }
      const sessionResult = await sessionQuery;
      if (sessionResult.error) throw sessionResult.error;
      const sessions: Session[] = (sessionResult.data ?? []).filter(
        (item: any) =>
          course === "All Courses" ||
          normalize(item.course) === normalize(course),
      );
      const sessionIds = sessions.map((item) => item.id);
      let records: any[] = [];
      if (sessionIds.length) {
        const recordResult = await supabase
          .from("attendance_records")
          .select("session_id, student_id, status")
          .in("session_id", sessionIds);
        if (recordResult.error) throw recordResult.error;
        records = recordResult.data ?? [];
      }
      const sessionMap = new Map(sessions.map((item) => [item.id, item]));
      const studentMap = new Map(students.map((item) => [item.id, item]));
      const grouped = new Map<string, Row>();
      records.forEach((record) => {
        const session = sessionMap.get(record.session_id);
        const student = studentMap.get(record.student_id);
        const savedStatus = statusValue(record.status);
        if (
          !session ||
          !student ||
          !savedStatus ||
          (studentId !== "all" && student.id !== studentId)
        )
          return;
        const row = grouped.get(student.id) ?? {
          ...student,
          working: 0,
          present: 0,
          absent: 0,
          percentage: 0,
          hours: {},
        };
        row.working += 1;
        if (savedStatus === "Present") row.present += 1;
        else row.absent += 1;
        row.percentage = percentage(row.present, row.absent);
        if (type === "day") row.hours[Number(session.hour)] = savedStatus;
        grouped.set(student.id, row);
      });
      setRows(
        Array.from(grouped.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setWorkingDays(
        new Set(sessions.map((item) => item.attendance_date)).size,
      );
      setGenerated(true);
      setSuccess(
        grouped.size
          ? "Attendance report generated successfully."
          : "No attendance data found for the selected filters.",
      );
    } catch (err: any) {
      console.error("REPORT ERROR:", err);
      setRows([]);
      setError(err?.message || "Unable to generate attendance report.");
    } finally {
      setLoading(false);
    }
  }

  function downloadPDF() {
    if (!rows.length) return;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const width = pdf.internal.pageSize.getWidth();
    const title =
      type === "day"
        ? "Daily Attendance Report"
        : type === "month"
          ? "Monthly Attendance Report"
          : type === "range"
            ? "Date Range Attendance Report"
            : type === "semester"
              ? "Semester Attendance Report"
              : "Student Attendance Report";
    const scope =
      type === "day"
        ? dateText(date)
        : type === "month"
          ? month
          : type === "range"
            ? dateText(fromDate) + " to " + dateText(toDate)
            : semester;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("ROYAL COLLEGE", 14, 16);
    pdf.setFontSize(12);
    pdf.text(title, 14, 23);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Course: " + course, 14, 31);
    pdf.text("Scope: " + scope, 14, 37);
    if (selectedStudent)
      pdf.text(
        "Student: " +
          selectedStudent.name +
          " (" +
          selectedStudent.admission_no +
          ")",
        14,
        43,
      );
    const head =
      type === "day"
        ? [
            [
              "No",
              "Student",
              "Admission No",
              "H1",
              "H2",
              "H3",
              "H4",
              "H5",
              "Present",
              "Absent",
              "%",
            ],
          ]
        : [
            [
              "No",
              "Student",
              "Admission No",
              "Working",
              "Present",
              "Absent",
              "%",
            ],
          ];
    const body = rows.map((row, index) =>
      type === "day"
        ? [
            String(index + 1).padStart(2, "0"),
            row.name,
            row.admission_no,
            ...HOURS.map((hour) => row.hours[hour] || "-"),
            row.present,
            row.absent,
            row.percentage + "%",
          ]
        : [
            String(index + 1).padStart(2, "0"),
            row.name,
            row.admission_no,
            row.working,
            row.present,
            row.absent,
            row.percentage + "%",
          ],
    );
    autoTable(pdf, {
      startY: selectedStudent ? 49 : 43,
      head,
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [100, 37, 217], textColor: 255 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === head[0].length - 1)
          data.cell.styles.textColor =
            Number(String(data.cell.text[0]).replace("%", "")) >= 75
              ? [21, 128, 61]
              : [220, 38, 38];
      },
    });
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(7);
      pdf.setTextColor(130);
      pdf.text(
        "Generated on " + new Date().toLocaleDateString("en-IN"),
        14,
        202,
      );
      pdf.text("Page " + page + " of " + pages, width - 40, 202);
    }
    pdf.save(
      "attendance-" +
        type +
        "-" +
        (type === "range"
          ? fromDate + "-to-" + toDate
          : date || month || semester) +
        ".pdf",
    );
  }

  function updateCalendarRange(anchor: string, value: string) {
    if (value < anchor) {
      setCalendarStart(value);
      setCalendarEnd(anchor);
    } else {
      setCalendarStart(anchor);
      setCalendarEnd(value);
    }
  }

  function beginCalendarDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    value: string,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    calendarDraggingRef.current = true;
    calendarAnchorRef.current = value;
    setCalendarStart(value);
    setCalendarEnd(value);
  }

  function moveCalendarDrag(value: string) {
    const anchor = calendarAnchorRef.current;
    if (!calendarDraggingRef.current || !anchor) return;
    updateCalendarRange(anchor, value);
  }

  function endCalendarDrag() {
    calendarDraggingRef.current = false;
    calendarAnchorRef.current = null;
  }

  function confirmCalendarRange() {
    if (!calendarStart || !calendarEnd) {
      setError("Please select a date or date range first.");
      return;
    }
    const start = calendarStart <= calendarEnd ? calendarStart : calendarEnd;
    const end = calendarStart <= calendarEnd ? calendarEnd : calendarStart;
    setFromDate(start);
    setToDate(end);
    setType("range");
    setConfirmedRange(start + "|" + end);
    setError("");
    setSuccess(
      "Dates selected. Click Generate Report to view the report below.",
    );
  }

  useEffect(() => {
    if (type !== "student") setStudentId("all");
  }, [type]);

  useEffect(() => {
    if (!confirmedRange) return;
    const [start, end] = confirmedRange.split("|");
    generateReport({ start, end });
  }, [confirmedRange]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("students")
      .select("id, name, admission_no, course, semester")
      .order("name", { ascending: true })
      .then((result) => {
        if (cancelled || result.error) return;
        setAllStudents(
          (result.data ?? []).map((item: any) => ({
            id: item.id,
            name: item.name || "Unknown Student",
            admission_no: item.admission_no || "",
            course: item.course || "",
            semester: semesterNumber(item.semester),
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!hasPermission(user, "attendance.view"))
    return <PermissionDenied onBack={onBack} />;
  const present = rows.reduce((sum, row) => sum + row.present, 0);
  const absent = rows.reduce((sum, row) => sum + row.absent, 0);
  return (
    <div className="reportsPage">
      <BackToDashboard onBack={onBack} />
      <div className="reportsHeader">
        <div>
          <div className="reportsEyebrow">
            <span /> REPORTS
          </div>
          <h1>Attendance Reports</h1>
          <p>
            Generate day-wise, month-wise, semester-wise and student-wise
            reports.
          </p>
        </div>
      </div>
      <section className="reportFilterCard">
        <div className="reportFilterLayout">
          <div className="reportFilterControls">
            <div className="reportSectionTitle">
              <div>
                <h2>Report Filters</h2>
                <p>Select the report type and attendance scope.</p>
              </div>
            </div>
            <div className="reportFilters">
              <label>
                <span>REPORT TYPE</span>
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as ReportType)
                  }
                >
                  <option value="day">Day-wise</option>
                  <option value="month">Month-wise</option>
                  <option value="range">From Date - To Date</option>
                  <option value="semester">Semester-wise</option>
                  <option value="student">Student-wise</option>
                </select>
              </label>
              <label>
                <span>COURSE</span>
                <select
                  value={course}
                  onChange={(event) => setCourse(event.target.value)}
                >
                  {COURSES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>SEMESTER</span>
                <select
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                >
                  {SEMESTERS.map((item) => (
                    <option key={item} value={item}>
                      {item === "All Semesters" ? item : "Semester " + item}
                    </option>
                  ))}
                </select>
              </label>
              {type === "day" && (
                <label>
                  <span>DATE</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
              )}
              {type === "month" && (
                <label>
                  <span>MONTH</span>
                  <input
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                  />
                </label>
              )}
              {type === "student" && (
                <label>
                  <span>STUDENT</span>
                  <select
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                  >
                    <option value="all">All Students</option>
                    {allStudents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {item.admission_no}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="generateReportButton"
                disabled={loading}
                onClick={() => generateReport()}
              >
                <Icon name="bar-chart" size={16} />
                {loading ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </div>
          <div className="reportCalendar">
            <div className="calendarHeader">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(changeCalendarMonth(calendarMonth, -1))
                }
              >
                ‹
              </button>
              <strong>
                {new Date(calendarMonth + "-01T00:00:00").toLocaleDateString(
                  "en-IN",
                  { month: "long", year: "numeric" },
                )}
              </strong>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(changeCalendarMonth(calendarMonth, 1))
                }
              >
                ›
              </button>
            </div>
            <div className="calendarWeekdays">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendarGrid">
              {calendarDays(calendarMonth).map((day, index) => {
                if (!day)
                  return (
                    <span key={"empty-" + index} className="calendarEmpty" />
                  );
                const value = calendarDate(calendarMonth, day);
                const selected = value >= calendarStart && value <= calendarEnd;
                const edge = value === calendarStart || value === calendarEnd;
                return (
                  <button
                    key={value}
                    type="button"
                    className={
                      selected
                        ? edge
                          ? "calendarDay selected edge"
                          : "calendarDay selected"
                        : "calendarDay"
                    }
                    onPointerDown={(event) => beginCalendarDrag(event, value)}
                    onPointerMove={() => moveCalendarDrag(value)}
                    onPointerUp={endCalendarDrag}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="calendarSelection">
              <span>
                {calendarStart === calendarEnd
                  ? dateText(calendarStart)
                  : dateText(calendarStart) + " - " + dateText(calendarEnd)}
              </span>
              <button type="button" onClick={confirmCalendarRange}>
                Confirm Dates
              </button>
            </div>
          </div>
        </div>
      </section>
      {error && (
        <div className="reportAlert error">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="reportAlert success">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}
      {generated && (
        <>
          <section className="monthlySummary">
            <div className="summaryTitle">
              <div>
                <h2>
                  {type === "day"
                    ? "Daily"
                    : type === "month"
                      ? "Monthly"
                      : type === "range"
                        ? "Date Range"
                        : type === "semester"
                          ? "Semester"
                          : "Student"}{" "}
                  Summary
                </h2>
                <p>
                  {course} · {semester}
                </p>
              </div>
            </div>
            <div className="summaryGrid">
              <div className="summaryCard">
                <span>STUDENTS</span>
                <strong>{rows.length}</strong>
              </div>
              <div className="summaryCard">
                <span>WORKING DAYS</span>
                <strong>{workingDays}</strong>
              </div>
              <div className="summaryCard green">
                <span>PRESENT</span>
                <strong>{present}</strong>
              </div>
              <div className="summaryCard purple">
                <span>ATTENDANCE</span>
                <strong>{percentage(present, absent)}%</strong>
              </div>
            </div>
          </section>
          <section className="studentReportCard">
            <div className="studentReportHeader">
              <div>
                <h2>Attendance Details</h2>
                <p>Only saved Present and Absent records are included.</p>
              </div>
              <button
                type="button"
                className="downloadPdfButton"
                disabled={!rows.length}
                onClick={downloadPDF}
              >
                <Icon name="download" size={15} /> Download PDF
              </button>
            </div>
            {!rows.length ? (
              <div className="reportEmpty">
                <strong>No attendance data found</strong>
                <span>Try another date, month, semester or course.</span>
              </div>
            ) : (
              <div className="reportTableWrapper">
                <table className="studentReportTable">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Student</th>
                      <th>Admission No</th>
                      {type === "day" &&
                        HOURS.map((hour) => <th key={hour}>H{hour}</th>)}
                      <th>Working</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{String(index + 1).padStart(2, "0")}</td>
                        <td>
                          <div className="reportStudent">
                            <strong>{row.name}</strong>
                            <span>{row.course}</span>
                          </div>
                        </td>
                        <td>{row.admission_no}</td>
                        {type === "day" &&
                          HOURS.map((hour) => (
                            <td key={hour}>{row.hours[hour] || "—"}</td>
                          ))}
                        <td>{row.working}</td>
                        <td className="presentValue">{row.present}</td>
                        <td className="absentValue">{row.absent}</td>
                        <td>
                          <span
                            className={
                              row.percentage >= 75
                                ? "percentage good"
                                : "percentage low"
                            }
                          >
                            {row.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <style jsx global>
        {CSS}
      </style>
      <style jsx global>{`
        .reportFilterLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 24px;
          align-items: start;
        }
        .reportCalendar {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 15px;
          background: #fcfcff;
        }
        .calendarHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 14px;
        }
        .calendarHeader strong {
          font-size: 14px;
        }
        .calendarHeader button {
          width: 30px;
          height: 30px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }
        .calendarWeekdays,
        .calendarGrid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          text-align: center;
        }
        .calendarWeekdays span {
          font-size: 10px;
          color: #64748b;
          font-weight: 800;
          padding-bottom: 5px;
        }
        .calendarDay,
        .calendarEmpty {
          min-height: 34px;
        }
        .calendarDay {
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #172033;
          cursor: pointer;
          font-size: 12px;
          touch-action: none;
        }
        .calendarDay:hover {
          background: #ede9fe;
        }
        .calendarDay.selected {
          background: #ddd6fe;
          color: #4c1d95;
          border-radius: 0;
        }
        .calendarDay.selected.edge {
          background: #7a1f2b;
          color: #fff;
          border-radius: 8px;
          font-weight: 800;
        }
        .calendarSelection {
          border-top: 1px solid #e2e8f0;
          margin-top: 14px;
          padding-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .calendarSelection span {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
        }
        .calendarSelection button {
          border: 0;
          border-radius: 8px;
          background: #7a1f2b;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 9px 10px;
          cursor: pointer;
        }
        @media (max-width: 900px) {
          .reportFilterLayout {
            grid-template-columns: 1fr;
          }
          .reportCalendar {
            max-width: 420px;
            width: 100%;
            justify-self: center;
          }
        }
      `}</style>
      <style jsx global>{`
        .reportFilterControls {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
        }
        .reportFilterControls .reportSectionTitle {
          padding: 2px 2px 4px;
        }
        .reportFilters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .reportFilters .generateReportButton {
          width: 100%;
          margin-top: 4px;
        }
        @media (max-width: 600px) {
          .reportFilters {
            grid-template-columns: 1fr;
          }
          .reportFilterControls {
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
}
