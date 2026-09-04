"use client";

import { useEffect, useMemo, useState } from "react";
import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import Icon from "./Icon";
import { AppUser, hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

type Faculty = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  auth_user_id: string | null;
};

type SyllabusCourse = {
  id: string;
  name: string;
};

type Subject = {
  id: string;
  subject_name: string;
  subject_code: string;
  course_id: string;
  semester: number;
};

type ReportRow = {
  id: string;
  staff_id: string;
  report_month: string;
  department: string;
  class_name: string;
  subject_id: string | null;
  total_units: number;
  units_taken_this_month: string[];
  total_units_covered: number;
  subject?: Subject | null;
};

const DEPARTMENTS = ["English", "Commerce", "Malayalam", "Arabic"] as const;
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthKey = (value: string) => `${value}-01`;

const displayMonth = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

const numberValue = (value: unknown) => Number(value || 0);

export default function MonthlyReport({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const canView = hasPermission(user, "monthly_report.view" as any);
  const canEdit = hasPermission(user, "monthly_report.edit" as any);
  const isAdmin = user.role === "MAIN_ADMIN";

  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [courses, setCourses] = useState<SyllabusCourse[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);

  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<(typeof DEPARTMENTS)[number] | "">("");
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUnsavedNewRow, setIsUnsavedNewRow] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [totalUnits, setTotalUnits] = useState("");
  const [totalUnitsCovered, setTotalUnitsCovered] = useState("");
  const [monthlyUnits, setMonthlyUnits] = useState<string[]>([""]);

  const selectedFaculty = useMemo(
    () => faculty.find((item) => item.id === selectedFacultyId) ?? null,
    [faculty, selectedFacultyId]
  );

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === String(selectedCourseId)) ?? null,
    [courses, selectedCourseId]
  );

  const filteredSubjects = useMemo(() => {
    if (!selectedCourseId || !selectedSemester) return [];

    return subjects
      .filter(
        (subject) =>
          String(subject.course_id) === String(selectedCourseId) &&
          Number(subject.semester) === Number(selectedSemester)
      )
      .sort((a, b) => String(a.subject_code || "").localeCompare(String(b.subject_code || "")));
  }, [subjects, selectedCourseId, selectedSemester]);

  useEffect(() => {
    if (!canView) return;
    void loadBase();
  }, [canView]);

  useEffect(() => {
    if (isAdmin || !faculty.length || selectedFacultyId) return;

    const email = String((user as any).email || "").toLowerCase();
    const own = faculty.find(
      (item) => item.auth_user_id === user.id || item.email.toLowerCase() === email
    );

    if (own) {
      setSelectedFacultyId(own.id);
      if ((DEPARTMENTS as readonly string[]).includes(own.department)) {
        setSelectedDepartment(own.department as any);
      }
    }
  }, [faculty, isAdmin, selectedFacultyId, user]);

  useEffect(() => {
    if (selectedFacultyId) {
      void loadRows();
    } else {
      setRows([]);
    }
  }, [selectedFacultyId, reportMonth]);

  useEffect(() => {
    if (!selectedFaculty) return;
    if ((DEPARTMENTS as readonly string[]).includes(selectedFaculty.department)) {
      setSelectedDepartment(selectedFaculty.department as any);
    }
  }, [selectedFaculty]);

  async function loadBase() {
    setLoading(true);
    setError("");

    try {
      const [staffResult, courseResult, subjectResult] = await Promise.all([
        supabase
          .from("staff_profiles")
          .select("id,name,email,department,role,auth_user_id")
          .order("name"),
        supabase
          .from("syllabus_courses")
          .select("id,name")
          .order("name"),
        supabase
          .from("syllabus_subjects")
          .select("id,course_id,semester,subject_code,subject_name")
          .order("subject_code"),
      ]);

      if (staffResult.error) throw staffResult.error;
      if (courseResult.error) {
        throw new Error(`Unable to load Syllabus courses: ${courseResult.error.message}`);
      }
      if (subjectResult.error) {
        throw new Error(`Unable to load Syllabus subjects: ${subjectResult.error.message}`);
      }

      const staffRows: Faculty[] = (staffResult.data ?? [])
        .filter((item: any) => ["FACULTY", "STAFF"].includes(String(item.role).toUpperCase()))
        .map((item: any) => ({
          id: String(item.id),
          name: String(item.name ?? ""),
          email: String(item.email ?? ""),
          department: String(item.department ?? ""),
          role: String(item.role ?? ""),
          auth_user_id: item.auth_user_id ? String(item.auth_user_id) : null,
        }));

      const courseRows: SyllabusCourse[] = (courseResult.data ?? [])
        .map((item: any) => ({
          id: String(item.id),
          name: String(item.name ?? "").trim(),
        }))
        .filter((item) => item.id && item.name);

      const subjectRows: Subject[] = (subjectResult.data ?? [])
        .map((item: any) => ({
          id: String(item.id),
          subject_name: String(item.subject_name ?? "").trim(),
          subject_code: String(item.subject_code ?? "").trim(),
          course_id: String(item.course_id ?? ""),
          semester: Number(item.semester),
        }))
        .filter(
          (item) =>
            item.id &&
            item.course_id &&
            item.subject_name &&
            Number.isFinite(item.semester)
        );

      setFaculty(staffRows);
      setCourses(courseRows);
      setSubjects(subjectRows);
    } catch (err: any) {
      setError(err?.message || "Unable to load staff and syllabus.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRows() {
    if (!selectedFacultyId) return;

    setError("");
    const { data, error: queryError } = await supabase
      .from("monthly_report_rows")
      .select(
        "id,staff_id,report_month,department,class_name,subject_id,total_units,units_taken_this_month,total_units_covered"
      )
      .eq("staff_id", selectedFacultyId)
      .eq("report_month", monthKey(reportMonth))
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setRows([]);
      return;
    }

    setRows(
      (data ?? []).map((item: any) => ({
        id: String(item.id),
        staff_id: String(item.staff_id),
        report_month: String(item.report_month),
        department: String(item.department ?? ""),
        class_name: String(item.class_name ?? ""),
        subject_id: item.subject_id ? String(item.subject_id) : null,
        total_units: numberValue(item.total_units),
        units_taken_this_month: Array.isArray(item.units_taken_this_month)
          ? item.units_taken_this_month.map((value: any) => String(value))
          : [],
        total_units_covered: numberValue(item.total_units_covered),
        subject:
          subjects.find((subject) => String(subject.id) === String(item.subject_id)) ?? null,
      }))
    );
  }

  useEffect(() => {
    if (!rows.length || !subjects.length) return;
    setRows((current) =>
      current.map((row) => ({
        ...row,
        subject: subjects.find((subject) => String(subject.id) === String(row.subject_id)) ?? null,
      }))
    );
  }, [subjects]);

  function resetEditor() {
    setEditingId(null);
    setIsUnsavedNewRow(false);
    setSelectedCourseId("");
    setSelectedSemester("");
    setSelectedSubjectId("");
    setTotalUnits("");
    setTotalUnitsCovered("");
    setMonthlyUnits([""]);
  }

  function openNew() {
    if (!canEdit || !selectedFacultyId || isAdmin) return;

    resetEditor();
    const draftId = `draft-${Date.now()}`;
    const draftRow: ReportRow = {
      id: draftId,
      staff_id: selectedFacultyId,
      report_month: monthKey(reportMonth),
      department: selectedDepartment || selectedFaculty?.department || "",
      class_name: "",
      subject_id: null,
      total_units: 0,
      units_taken_this_month: [],
      total_units_covered: 0,
      subject: null,
    };

    setRows((current) => [...current, draftRow]);
    setEditingId(draftId);
    setIsUnsavedNewRow(true);
    setEditorOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(row: ReportRow) {
    if (!canEdit) return;

    const existingSubject =
      subjects.find((subject) => String(subject.id) === String(row.subject_id)) ?? null;

    setEditingId(row.id);
    setIsUnsavedNewRow(false);
    setSelectedCourseId(existingSubject ? String(existingSubject.course_id) : "");
    setSelectedSemester(existingSubject ? String(existingSubject.semester) : "");
    setSelectedSubjectId(row.subject_id ? String(row.subject_id) : "");
    setTotalUnits(String(row.total_units));
    setTotalUnitsCovered(String(row.total_units_covered));
    setMonthlyUnits(row.units_taken_this_month.length ? [...row.units_taken_this_month] : [""]);
    setEditorOpen(true);
    setError("");
    setNotice("");
  }

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedSemester("");
    setSelectedSubjectId("");
  }

  function handleSemesterChange(semester: string) {
    setSelectedSemester(semester);
    setSelectedSubjectId("");
  }

  function handleSubjectChange(subjectId: string) {
    setSelectedSubjectId(subjectId);
  }

  function closeEditor() {
    if (saving) return;

    if (isUnsavedNewRow && editingId) {
      setRows((current) => current.filter((row) => row.id !== editingId));
    }

    setEditorOpen(false);
    resetEditor();
  }

  async function saveRow() {
    if (!selectedFacultyId) {
      setError("Select a teacher first.");
      return;
    }

    if (!selectedCourseId) {
      setError("Select a Course.");
      return;
    }

    if (!selectedSemester) {
      setError("Select a Semester.");
      return;
    }

    if (!selectedSubjectId) {
      setError("Select a Subject from the selected Course and Semester.");
      return;
    }

    const total = numberValue(totalUnits);
    const covered = numberValue(totalUnitsCovered);

    if (total < 0 || covered < 0) {
      setError("Unit values cannot be negative.");
      return;
    }

    if (covered > total) {
      setError("Total Units Covered cannot be greater than Total Unit.");
      return;
    }

    const cleanUnits = monthlyUnits.map((item) => item.trim()).filter(Boolean);
    if (!cleanUnits.length) {
      setError("Add at least one chapter/unit taken this month.");
      return;
    }

    const duplicate = rows.find(
      (row) => String(row.subject_id) === String(selectedSubjectId) && row.id !== editingId
    );
    if (duplicate) {
      setError("This subject is already added for this month.");
      return;
    }

    const course = courses.find((item) => String(item.id) === String(selectedCourseId));
    if (!course) {
      setError("Selected Course could not be found.");
      return;
    }

    const generatedClassName = `${course.name} · Semester ${selectedSemester}`;

    const payload = {
      staff_id: selectedFacultyId,
      report_month: monthKey(reportMonth),
      department: selectedDepartment || selectedFaculty?.department || "",
      class_name: generatedClassName,
      subject_id: selectedSubjectId,
      total_units: total,
      units_taken_this_month: cleanUnits,
      total_units_covered: covered,
    };

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (isUnsavedNewRow) {
        const result = await supabase.from("monthly_report_rows").insert(payload);
        if (result.error) throw result.error;
      } else {
        const result = await supabase
          .from("monthly_report_rows")
          .update(payload)
          .eq("id", editingId);
        if (result.error) throw result.error;
      }

      setNotice(isUnsavedNewRow ? "Monthly report added." : "Monthly report updated.");
      setEditorOpen(false);
      resetEditor();
      await loadRows();
    } catch (err: any) {
      setError(err?.message || "Unable to save monthly report.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: string) {
    const confirmed = window.confirm("Delete this monthly report row?");
    if (!confirmed) return;

    setError("");
    setNotice("");

    if (id.startsWith("draft-")) {
      setRows((current) => current.filter((row) => row.id !== id));
      return;
    }

    const { error: deleteError } = await supabase
      .from("monthly_report_rows")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("Monthly report row deleted.");
    await loadRows();
  }

  function addMonthlyUnit() {
    setMonthlyUnits((current) => [...current, ""]);
  }

  function updateMonthlyUnit(index: number, value: string) {
    setMonthlyUnits((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item))
    );
  }

  function removeMonthlyUnit(index: number) {
    setMonthlyUnits((current) =>
      current.length === 1 ? [""] : current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function escapeHtml(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function classDisplay(row: ReportRow) {
    const subject = subjects.find((item) => String(item.id) === String(row.subject_id));
    const course = subject
      ? courses.find((item) => String(item.id) === String(subject.course_id))
      : null;

    if (course && subject) {
      return {
        course: course.name,
        semester: `SEMESTER ${subject.semester}`,
      };
    }

    const legacy = row.class_name || "Not selected";
    return { course: legacy, semester: "" };
  }

  function generateReport() {
    if (!selectedFaculty) {
      setError("Select a teacher first.");
      return;
    }

    const popup = window.open("", "_blank", "width=1400,height=950");
    if (!popup) {
      setError("Please allow pop-ups to generate the report.");
      return;
    }

    const bodyRows = rows
      .filter((row) => !row.id.startsWith("draft-"))
      .map((row, index) => {
        const display = classDisplay(row);
        const subject =
          subjects.find((item) => String(item.id) === String(row.subject_id)) ?? row.subject;

        return `
          <tr>
            <td class="sl">${index + 1}.</td>
            <td class="classCell">
              <strong>${escapeHtml(display.semester || display.course)}</strong>
              ${display.semester ? `<strong>${escapeHtml(display.course)}</strong>` : ""}
            </td>
            <td class="subjectCell">
              <strong>${escapeHtml(subject?.subject_name || "Not selected")}</strong>
            </td>
            <td class="totalCell">${row.total_units} CHAPTERS</td>
            <td class="chapterCell">
              ${row.units_taken_this_month.length
            ? row.units_taken_this_month
              .map(
                (unit, unitIndex) =>
                  `<div class="chapterLine"><b>${unitIndex + 1}.</b> ${escapeHtml(unit)}</div>`
              )
              .join("")
            : ""}
            </td>
            <td class="coveredCell">${row.total_units_covered}<br/><span>CHAPTER${row.total_units_covered === 1 ? "" : "S"} COMPLETED</span></td>
          </tr>
        `;
      })
      .join("");

    const monthLabel = displayMonth(monthKey(reportMonth)).toUpperCase();
    const department = selectedDepartment || selectedFaculty.department;
    const dateLabel = new Date().toLocaleDateString("en-GB");

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Monthly Report - ${escapeHtml(selectedFaculty.name)}</title>
          <style>
            @page { size: A4 landscape; margin: 7mm; }
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #fff;
              color: #121212;
              font-family: "Poppins", Arial, sans-serif;
              font-size: 10px;
            }
            .page {
              width: 100%;
              border: 1px solid #121212;
              padding: 10px;
            }
            .header { text-align: center; margin-bottom: 8px; }
            .header h1 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: .15px; }
            .header h2 { margin: 2px 0 0; font-size: 15px; font-weight: 800; }
            .meta {
              display: grid;
              grid-template-columns: 1fr 1fr;
              margin: 16px 5px 8px;
              font-size: 11px;
              line-height: 1.55;
              font-weight: 700;
            }
            .meta .right { text-align: right; padding-right: 28px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #222; vertical-align: top; }
            th {
              height: 49px;
              padding: 6px 5px;
              text-align: center;
              vertical-align: middle;
              font-size: 10px;
              line-height: 1.15;
              font-weight: 800;
              background: #121212;
              color: #fff;
            }
            td { padding: 7px 6px; font-size: 10px; line-height: 1.35; }
            th:nth-child(1) { width: 5%; }
            th:nth-child(2) { width: 11%; }
            th:nth-child(3) { width: 18%; }
            th:nth-child(4) { width: 12%; }
            th:nth-child(5) { width: 38%; }
            th:nth-child(6) { width: 16%; }
            .sl { text-align: center; }
            .classCell { text-align: center; font-size: 10px; line-height: 1.45; }
            .classCell strong { display: block; }
            .subjectCell { text-align: center; font-size: 10px; line-height: 1.45; }
            .subjectCell strong { display: block; }
            .totalCell { text-align: center; font-weight: 700; }
            .chapterCell { font-size: 10px; }
            .chapterLine { margin: 0 0 5px; }
            .chapterLine:last-child { margin-bottom: 0; }
            .coveredCell { text-align: center; font-weight: 700; line-height: 1.4; }
            .coveredCell span { font-size: 8px; }
            .signatures {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 40px;
              margin: 43px 20px 0;
            }
            .signature { text-align: center; min-height: 70px; }
            .signatureSpace { height: 43px; border-bottom: 0; }
            .signatureLabel {
              display: inline-block;
              min-width: 145px;
              padding-top: 5px;
              border-top: 1px solid transparent;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .empty { text-align: center; padding: 25px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <h1>ROYAL COLLEGE OF ARTS AND SCIENCE, THIRTHALA</h1>
              <h2>MONTHLY REPORT – ${escapeHtml(monthLabel)}.</h2>
            </div>

            <div class="meta">
              <div>
                NAME: ${escapeHtml(selectedFaculty.name)}<br/>
                DEPARTMENT: ${escapeHtml(department)}
              </div>
              <div class="right">Date: ${escapeHtml(dateLabel)}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>SL<br/>NO</th>
                  <th>CLASS</th>
                  <th>SUBJECTS</th>
                  <th>TOTAL<br/>UNITS</th>
                  <th>UNIT TAKEN BY THIS MONTH</th>
                  <th>TOTAL<br/>UNITS<br/>COVERED</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows || `<tr><td colspan="6" class="empty">No monthly entries yet.</td></tr>`}
              </tbody>
            </table>

            <div class="signatures">
              <div class="signature"><div class="signatureSpace"></div><div class="signatureLabel">SUBJECT FACULTY</div></div>
              <div class="signature"><div class="signatureSpace"></div><div class="signatureLabel">HOD</div></div>
              <div class="signature"><div class="signatureSpace"></div><div class="signatureLabel">PRINCIPAL</div></div>
            </div>
          </div>
          <script>window.onload = function () { window.print(); };</script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  if (!canView) {
    return <PermissionDenied onBack={onBack} title="Monthly Report Access Restricted" />;
  }

  const currentYear = new Date().getFullYear();
  const monthOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).flatMap(
    (year) => MONTHS.map((_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
  );

  return (
    <div className="monthlyReportRoot">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .monthlyReportRoot { min-height: 100vh; padding: 24px; background: #f4f7fb; color: #172033; font-family: "Poppins", sans-serif; }
        .mrShell { width: 100%; max-width: 1380px; margin: 0 auto; }
        .mrBackTop { margin-bottom: 18px; }
        .mrTop { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
        .mrEyebrow { margin-bottom: 7px; color: #728096; font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
        .mrTitle { margin: 0; color: #162033; font-size: 32px; line-height: 1.15; font-weight: 700; letter-spacing: -.04em; }
        .mrSubtitle { margin: 7px 0 0; color: #6d788a; font-size: 13px; line-height: 1.6; }
        .mrToolbar { display: flex; align-items: center; gap: 9px; }
        .mrBtn { min-height: 42px; border: 0; border-radius: 9px; padding: 10px 15px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
        .mrBtn:disabled { opacity: .55; cursor: not-allowed; }
        .mrBtnGreen { background: #2d7a58; color: #fff; }
        .mrBtnDark { background: #162033; color: #fff; }
        .mrBtnLight { border: 1px solid #dce3eb; background: #fff; color: #344054; }
        .mrPanel { border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; box-shadow: 0 8px 30px rgba(28,42,61,.055); }
        .mrFilters { display: grid; grid-template-columns: 1.4fr 1fr 1fr auto; gap: 14px; align-items: end; padding: 18px; margin-bottom: 18px; }
        .mrField label { display: block; margin-bottom: 7px; color: #687487; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .mrInput, .mrSelect { width: 100%; height: 44px; border: 1px solid #d8e0e9; border-radius: 9px; outline: none; padding: 0 12px; background: #fbfcfe; color: #172033; font-family: inherit; font-size: 12px; }
        .mrSelect option { background: #ffffff; color: #172033; }
        .mrSelect:disabled { opacity: 1; color: #172033; -webkit-text-fill-color: #172033; }
        .mrInput:focus, .mrSelect:focus { border-color: #7b91ab; box-shadow: 0 0 0 3px rgba(73,98,125,.09); }
        .mrNotice { margin-bottom: 14px; border: 1px solid #ccebd7; border-radius: 9px; padding: 11px 13px; background: #f0fbf4; color: #23613f; font-size: 12px; }
        .mrError { margin-bottom: 14px; border: 1px solid #f2cfcb; border-radius: 9px; padding: 11px 13px; background: #fff4f3; color: #a12a21; font-size: 12px; }
        .mrTableHead { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 20px 15px; }
        .mrSectionTitle { margin: 0; color: #172033; font-size: 19px; font-weight: 600; }
        .mrCount { color: #778397; font-size: 11px; }
        .mrTableWrap { width: 100%; overflow-x: auto; }
        .mrTable { width: 100%; min-width: 850px; border-collapse: collapse; }
        .mrTable th { border-top: 1px solid #edf1f5; border-bottom: 1px solid #e4e9ef; padding: 12px 15px; background: #f7f9fb; color: #687487; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; white-space: nowrap; }
        .mrTable td { border-bottom: 1px solid #edf1f5; padding: 15px; color: #344054; font-size: 12px; vertical-align: top; }
        .mrTable tbody tr:hover { background: #fbfcfe; }
        .mrNo { width: 52px; color: #8b96a8 !important; font-weight: 700; }
        .mrClass { min-width: 180px; color: #172033 !important; font-weight: 700; }
        .mrClassName { display: block; color: #172033; }
        .mrClassMeta { display: block; margin-top: 4px; color: #7a8798; font-size: 9px; font-weight: 500; line-height: 1.5; }
        .mrSubjectName { color: #172033; font-weight: 600; }
        .mrSubjectCode { margin-top: 3px; color: #7a8798; font-size: 9px; }
        .mrChapterList { min-width: 170px; }
        .mrChapterItem { display: block; margin-bottom: 4px; color: #3f4b5d; font-size: 11px; line-height: 1.5; }
        .mrChapterItem:last-child { margin-bottom: 0; }
        .mrTotal, .mrCovered { color: #172033; font-weight: 600; }
        .mrActions { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
        .mrIconBtn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid #dfe5ec; border-radius: 8px; background: #fff; color: #465366; cursor: pointer; }
        .mrIconBtn:hover { background: #f5f7fa; }
        .mrIconBtn.delete { color: #b42318; }
        .mrEmpty { padding: 55px 20px !important; color: #7a8698 !important; text-align: center !important; }
        .mrEmpty strong { display: block; margin-bottom: 5px; color: #344054; font-size: 14px; }
        .mrModalBackdrop { position: fixed; z-index: 1000; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(13,23,38,.55); }
        .mrModal { width: min(720px, 100%); max-height: 92vh; overflow: auto; border-radius: 18px; background: #fff; box-shadow: 0 24px 80px rgba(0,0,0,.24); }
        .mrModalHead { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 21px 24px; border-bottom: 1px solid #e8edf2; }
        .mrModalHead h2 { margin: 0; color: #172033; font-size: 20px; font-weight: 600; }
        .mrModalHead p { margin: 5px 0 0; color: #778397; font-size: 11px; }
        .mrClose { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 0; border-radius: 8px; background: #f3f5f7; color: #526074; font-family: inherit; font-size: 18px; cursor: pointer; }
        .mrModalBody { padding: 22px 24px; }
        .mrGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .mrFull { grid-column: 1 / -1; }
        .mrSectionBox { grid-column: 1 / -1; border: 1px solid #dce3ea; border-radius: 12px; padding: 15px; background: #fafbfd; }
        .mrSectionBoxTitle { margin-bottom: 13px; color: #172033; font-size: 12px; font-weight: 700; }
        .mrTwoCol { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .mrSubjectBox { margin-top: 12px; }
        .mrSubjectList { max-height: 210px; overflow: auto; border: 1px solid #dce3ea; border-radius: 9px; background: #fff; }
        .mrSubjectOption { width: 100%; border: 0; border-bottom: 1px solid #edf1f5; padding: 10px 12px; background: #fff; color: #172033; text-align: left; font-family: inherit; cursor: pointer; }
        .mrSubjectOption:last-child { border-bottom: 0; }
        .mrSubjectOption:hover, .mrSubjectOption.selected { background: #f0f5f8; }
        .mrSubjectCodeModal { display: block; margin-bottom: 2px; color: #748196; font-size: 9px; font-weight: 700; }
        .mrSubjectNameModal { display: block; color: #172033; font-size: 11px; font-weight: 600; }
        .mrSelectedSubject { margin-top: 9px; border-radius: 8px; padding: 9px 11px; background: #f0f5f8; color: #365064; font-size: 11px; font-weight: 600; }
        .mrNoSubjects { padding: 14px; color: #8994a5; font-size: 11px; text-align: center; }
        .mrUnitBox { border: 1px solid #dce3ea; border-radius: 10px; padding: 13px; background: #fafbfd; }
        .mrUnitRow { display: flex; gap: 8px; margin-bottom: 8px; }
        .mrMini { flex: 0 0 40px; width: 40px; height: 40px; border: 1px solid #d8e0e9; border-radius: 8px; background: #fff; color: #7b8798; font-family: inherit; font-size: 17px; cursor: pointer; }
        .mrHint { margin-top: 6px; color: #8994a5; font-size: 10px; line-height: 1.5; }
        .mrModalFoot { display: flex; align-items: center; justify-content: flex-end; gap: 9px; padding: 16px 24px; border-top: 1px solid #e8edf2; }
        @media (max-width: 850px) {
          .monthlyReportRoot { padding: 16px; }
          .mrTop { align-items: flex-start; }
          .mrFilters { grid-template-columns: 1fr 1fr; }
          .mrFilters .mrApply { grid-column: 1 / -1; }
          .mrGrid, .mrTwoCol { grid-template-columns: 1fr; }
          .mrFull, .mrSectionBox { grid-column: auto; }
        }
        @media (max-width: 600px) {
          .monthlyReportRoot { padding: 12px; }
          .mrTop { display: block; }
          .mrToolbar { margin-top: 15px; }
          .mrTitle { font-size: 27px; }
          .mrToolbar .mrBtn { flex: 1; }
          .mrFilters { grid-template-columns: 1fr; }
          .mrFilters .mrApply { grid-column: auto; }
          .mrTableWrap { overflow: visible; }
          .mrTable { min-width: 0; }
          .mrTable thead { display: none; }
          .mrTable, .mrTable tbody, .mrTable tr, .mrTable td { display: block; width: 100%; }
          .mrTable tbody tr { margin: 12px; border: 1px solid #e4e9ef; border-radius: 12px; overflow: hidden; background: #fff; }
          .mrTable td { display: grid; grid-template-columns: 135px 1fr; gap: 10px; border-bottom: 1px solid #edf1f5; padding: 11px 13px; }
          .mrTable td:last-child { border-bottom: 0; }
          .mrTable td::before { color: #788497; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
          .mrTable td:nth-child(1) { display: none; }
          .mrTable td:nth-child(2)::before { content: "Class"; }
          .mrTable td:nth-child(3)::before { content: "Subject"; }
          .mrTable td:nth-child(4)::before { content: "Total Unit"; }
          .mrTable td:nth-child(5)::before { content: "Units This Month"; }
          .mrTable td:nth-child(6)::before { content: "Covered"; }
          .mrTable td:nth-child(7)::before { content: "Action"; }
          .mrChapterList { min-width: 0; }
          .mrModalBackdrop { align-items: flex-start; padding: 10px; }
          .mrModal { max-height: calc(100vh - 20px); }
          .mrModalHead, .mrModalBody, .mrModalFoot { padding-left: 16px; padding-right: 16px; }
        }
      `}</style>

      <div className="mrShell">
        <div className="mrBackTop"><BackToDashboard onBack={onBack} /></div>

        <div className="mrTop">
          <div>
            <div className="mrEyebrow">Academic Administration</div>
            <h1 className="mrTitle">Monthly Report</h1>
            <p className="mrSubtitle">Track monthly teaching progress, units completed and syllabus coverage.</p>
          </div>

          <div className="mrToolbar">
            {canEdit && !isAdmin && (
              <button
                type="button"
                className="mrBtn mrBtnGreen"
                onClick={openNew}
                disabled={!selectedFacultyId}
              >
                + Add New
              </button>
            )}
            <button
              type="button"
              className="mrBtn mrBtnDark"
              onClick={generateReport}
              disabled={!selectedFaculty}
            >
              Generate Report
            </button>
          </div>
        </div>

        <div className="mrPanel mrFilters">
          <div className="mrField">
            <label>Teacher</label>
            <select
              className="mrSelect"
              value={selectedFacultyId}
              onChange={(event) => setSelectedFacultyId(event.target.value)}
              disabled={!isAdmin}
            >
              {isAdmin ? (
                <>
                  <option value="">Select teacher</option>
                  {faculty.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </>
              ) : (
                <option value={selectedFacultyId}>{selectedFaculty?.name || "Loading..."}</option>
              )}
            </select>
          </div>

          <div className="mrField">
            <label>Department</label>
            <select
              className="mrSelect"
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value as any)}
              disabled={!isAdmin}
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div className="mrField">
            <label>Report Month</label>
            <select
              className="mrSelect"
              value={reportMonth}
              onChange={(event) => setReportMonth(event.target.value)}
            >
              {monthOptions.map((value) => (
                <option key={value} value={value}>{displayMonth(monthKey(value))}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              className="mrBtn mrBtnLight"
              onClick={() => void loadRows()}
              disabled={!selectedFacultyId}
            >
              Refresh
            </button>
          </div>
        </div>

        {notice && <div className="mrNotice">{notice}</div>}
        {error && <div className="mrError">{error}</div>}

        <section className="mrPanel">
          <div className="mrTableHead">
            <div>
              <h2 className="mrSectionTitle">Teaching Progress</h2>
              <div className="mrCount">
                {selectedFaculty
                  ? `${selectedFaculty.name} · ${selectedDepartment || selectedFaculty.department} · ${displayMonth(monthKey(reportMonth))}`
                  : "Select a teacher"}
              </div>
            </div>
            <span className="mrCount">{rows.length} {rows.length === 1 ? "row" : "rows"}</span>
          </div>

          <div className="mrTableWrap">
            <table className="mrTable">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Total Unit</th>
                  <th>Unit Taken By This Month</th>
                  <th>Total Units Covered</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="mrEmpty">Loading report...</td></tr>
                ) : !selectedFacultyId ? (
                  <tr><td colSpan={7} className="mrEmpty"><strong>Select a teacher</strong>Choose a teacher to view monthly progress.</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="mrEmpty"><strong>No monthly entries yet</strong>{canEdit && !isAdmin ? " Click Add New to create the first entry." : " No report has been added for this month."}</td></tr>
                ) : (
                  rows.map((row, index) => {
                    const rowSubject = subjects.find((subject) => String(subject.id) === String(row.subject_id));
                    const rowCourse = rowSubject
                      ? courses.find((course) => String(course.id) === String(rowSubject.course_id))
                      : null;

                    return (
                      <tr key={row.id}>
                        <td className="mrNo">{index + 1}</td>
                        <td className="mrClass">
                          {rowCourse && rowSubject ? (
                            <>
                              <span className="mrClassName">{rowCourse.name}</span>
                              <span className="mrClassMeta">Semester {rowSubject.semester}</span>
                            </>
                          ) : (
                            <span className="mrClassName">{row.class_name || "Not selected"}</span>
                          )}
                        </td>
                        <td>
                          <div className="mrSubjectName">{rowSubject?.subject_name || row.subject?.subject_name || "Not selected"}</div>
                          {(rowSubject?.subject_code || row.subject?.subject_code) && (
                            <div className="mrSubjectCode">{rowSubject?.subject_code || row.subject?.subject_code}</div>
                          )}
                        </td>
                        <td><span className="mrTotal">{row.total_units} CHAPTERS</span></td>
                        <td>
                          <div className="mrChapterList">
                            {row.units_taken_this_month.length
                              ? row.units_taken_this_month.map((unit, unitIndex) => (
                                <div className="mrChapterItem" key={`${row.id}-${unitIndex}`}>
                                  {unitIndex + 1}. {unit}
                                </div>
                              ))
                              : "—"}
                          </div>
                        </td>
                        <td><span className="mrCovered">{row.total_units_covered} CHAPTER{row.total_units_covered === 1 ? "" : "S"} COMPLETED</span></td>
                        <td>
                          <div className="mrActions">
                            {canEdit && (
                              <>
                                <button type="button" className="mrIconBtn" title="Edit" onClick={() => openEdit(row)}>
                                  <Icon name="edit" size={16} />
                                </button>
                                <button type="button" className="mrIconBtn delete" title="Delete" onClick={() => void deleteRow(row.id)}>
                                  <Icon name="X" size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editorOpen && (
        <div
          className="mrModalBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <div className="mrModal">
            <div className="mrModalHead">
              <div>
                <h2>{isUnsavedNewRow ? "New Monthly Entry" : "Edit Monthly Entry"}</h2>
                <p>{selectedFaculty?.name || "Teacher"} · {displayMonth(monthKey(reportMonth))}</p>
              </div>
              <button type="button" className="mrClose" onClick={closeEditor}>×</button>
            </div>

            <div className="mrModalBody">
              <div className="mrGrid">
                <div className="mrSectionBox">
                  <div className="mrSectionBoxTitle">CLASS — SELECT COURSE AND SEMESTER</div>
                  <div className="mrTwoCol">
                    <div className="mrField">
                      <label>Course</label>
                      <select
                        className="mrSelect"
                        value={selectedCourseId}
                        onChange={(event) => handleCourseChange(event.target.value)}
                      >
                        <option value="">Select Course</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mrField">
                      <label>Semester</label>
                      <select
                        className="mrSelect"
                        value={selectedSemester}
                        disabled={!selectedCourseId}
                        onChange={(event) => handleSemesterChange(event.target.value)}
                      >
                        <option value="">{selectedCourseId ? "Select Semester" : "Select Course First"}</option>
                        {SEMESTERS.map((semester) => (
                          <option key={semester} value={semester}>Semester {semester}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mrSubjectBox mrField">
                    <label>Subject</label>
                    <select
                      className="mrSelect"
                      value={selectedSubjectId}
                      disabled={!selectedCourseId || !selectedSemester}
                      onChange={(event) => handleSubjectChange(event.target.value)}
                    >
                      <option value="">
                        {!selectedCourseId
                          ? "Select Course First"
                          : !selectedSemester
                            ? "Select Semester First"
                            : filteredSubjects.length
                              ? "Select Subject"
                              : "No Subjects Found"}
                      </option>
                      {filteredSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.subject_code ? `${subject.subject_code} — ` : ""}{subject.subject_name}
                        </option>
                      ))}
                    </select>
                    <div className="mrHint">
                      Subject list is filtered only from the selected Course + Semester in Syllabus.
                    </div>
                  </div>
                </div>

                <div className="mrField">
                  <label>Total Unit / Chapters</label>
                  <input
                    className="mrInput"
                    type="number"
                    min="0"
                    step="1"
                    value={totalUnits}
                    onChange={(event) => setTotalUnits(event.target.value)}
                    placeholder="e.g. 19"
                  />
                </div>

                <div className="mrField">
                  <label>Total Units Covered</label>
                  <input
                    className="mrInput"
                    type="number"
                    min="0"
                    step="1"
                    value={totalUnitsCovered}
                    onChange={(event) => setTotalUnitsCovered(event.target.value)}
                    placeholder="e.g. 10"
                  />
                </div>

                <div className="mrField mrFull">
                  <label>Unit Taken By This Month</label>
                  <div className="mrUnitBox">
                    {monthlyUnits.map((unit, index) => (
                      <div className="mrUnitRow" key={index}>
                        <input
                          className="mrInput"
                          value={unit}
                          onChange={(event) => updateMonthlyUnit(index, event.target.value)}
                          placeholder={`Chapter / Unit ${index + 1}`}
                        />
                        <button type="button" className="mrMini" onClick={() => removeMonthlyUnit(index)}>×</button>
                      </div>
                    ))}
                    <button type="button" className="mrBtn mrBtnLight" onClick={addMonthlyUnit}>+ New Chapter</button>
                    <div className="mrHint">Chapters are shown in the table as normal numbered text: 1., 2., 3. ...</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mrModalFoot">
              <button type="button" className="mrBtn mrBtnLight" onClick={closeEditor} disabled={saving}>Cancel</button>
              <button type="button" className="mrBtn mrBtnGreen" onClick={() => void saveRow()} disabled={saving}>
                {saving ? "Saving..." : isUnsavedNewRow ? "Save Entry" : "Update Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
