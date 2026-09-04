"use client";

import { useEffect, useMemo, useState } from "react";
import BackToDashboard from "./BackToDashboard";
import Icon from "./Icon";
import PermissionDenied from "./PermissionDenied";
import { AppUser, hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  name: string;
  admissionNo: string;
  course: string;
  semester: number;
};

type SyllabusCourse = {
  id: string;
  name: string;
};

type Subject = {
  id: string;
  subject_name: string;
  subject_code: string;
};

type InternalMark = {
  id: string;
  student_id: string;
  subject_id: string;
  course: string;
  semester: number;
  assignment_mark: number;
  seminar_mark: number;
  test_paper_mark: number;
  attendance_mark: number;
  total_mark: number;
  mark: number;
  created_at?: string;
  updated_at?: string;
  syllabus_subjects?: Subject | Subject[] | null;
};

const normalizeCourse = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const numberText = (value: number | null | undefined) =>
  Number(value ?? 0).toString();

function getRelatedSubject(mark: InternalMark): Subject | null {
  if (!mark.syllabus_subjects) return null;

  return Array.isArray(mark.syllabus_subjects)
    ? mark.syllabus_subjects[0] ?? null
    : mark.syllabus_subjects;
}

export default function InternalMarks({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const canView = hasPermission(user, "internal_marks.view");
  const canEdit = hasPermission(user, "internal_marks.edit");

  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [syllabusCourses, setSyllabusCourses] = useState<SyllabusCourse[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, InternalMark[]>>({});

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [assignment, setAssignment] = useState("");
  const [seminar, setSeminar] = useState("");
  const [testPaper, setTestPaper] = useState("");
  const [attendance, setAttendance] = useState("");

  // IMPORTANT: Course options must come from the Syllabus table, not from
  // the students table. A teacher may have a restricted/empty students
  // result, but should still be able to select the syllabus course first.
  const courses = useMemo(
    () => {
      const syllabusNames = syllabusCourses
        .map((item) => item.name.trim())
        .filter(Boolean);

      if (syllabusNames.length) {
        return Array.from(new Set(syllabusNames)).sort((a, b) =>
          a.localeCompare(b)
        );
      }

      // Safe fallback if syllabus course rows are temporarily unavailable.
      return Array.from(
        new Set(allStudents.map((student) => student.course.trim()))
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    },
    [syllabusCourses, allStudents]
  );

  // Semester is a syllabus-level filter, so do not depend on the student's
  // rows to populate this dropdown. This also fixes the teacher view when
  // their student list is restricted by RLS.
  const semesters = useMemo(
    () => Array.from({ length: 8 }, (_, index) => index + 1),
    []
  );

  const liveTotal = [
    assignment,
    seminar,
    testPaper,
    attendance,
  ].reduce((sum, value) => sum + (Number(value) || 0), 0);

  function normalizeMark(value: string) {
    if (value === "") return "";
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return "";
    return value;
  }

  useEffect(() => {
    async function loadOptions() {
      setLoadingOptions(true);
      setError("");

      try {
        // Load these independently. Promise.all() previously meant that a
        // restricted students query could prevent syllabus courses from
        // being placed into the dropdown at all.
        const [studentResult, courseResult] = await Promise.all([
          supabase
            .from("students")
            .select("id, name, admission_no, course, semester")
            .order("name"),
          supabase
            .from("syllabus_courses")
            .select("id, name")
            .order("name"),
        ]);

        let optionError = "";

        if (studentResult.error) {
          // Keep the course selector usable even if a teacher cannot read
          // every student row. Student loading will simply return no rows.
          setAllStudents([]);
          optionError = studentResult.error.message;
        } else {
          setAllStudents(
            (studentResult.data ?? [])
              .map((row: any) => ({
                id: String(row.id),
                name: String(row.name ?? "Unnamed student"),
                admissionNo: String(row.admission_no ?? "—"),
                course: String(row.course ?? ""),
                semester: Number(row.semester),
              }))
              .filter(
                (student) =>
                  student.course && Number.isFinite(student.semester)
              )
          );
        }

        if (courseResult.error) {
          setSyllabusCourses([]);
          // Do not throw here: the fallback course list can still come from
          // students when that table is readable.
          optionError = optionError || courseResult.error.message;
        } else {
          setSyllabusCourses(
            (courseResult.data ?? [])
              .map((row: any) => ({
                id: String(row.id),
                name: String(row.name ?? ""),
              }))
              .filter((item) => item.name)
          );
        }

        if (optionError && !courseResult.data?.length && !studentResult.data?.length) {
          setError(
            "Unable to load course options. Please check the teacher's Syllabus/Students read access."
          );
        }
      } catch (err: any) {
        setError(err?.message || "Unable to load course and semester options.");
      } finally {
        setLoadingOptions(false);
      }
    }

    if (canView) loadOptions();
  }, [canView]);

  useEffect(() => {
    setSemester("");
  }, [course]);

  useEffect(() => {
    async function loadSubjects() {
      if (!course || !semester) {
        setSubjects([]);
        return;
      }

      const syllabusCourse = syllabusCourses.find(
        (item) => item.name === course
      ) ?? syllabusCourses.find(
        (item) => normalizeCourse(item.name) === normalizeCourse(course)
      );

      if (!syllabusCourse) {
        setSubjects([]);
        setError(
          "This course is not available in Syllabus yet. Add its subjects there first."
        );
        return;
      }

      setLoadingSubjects(true);
      setError("");

      try {
        const { data, error: subjectError } = await supabase
          .from("syllabus_subjects")
          .select("id, subject_name, subject_code")
          .eq("course_id", syllabusCourse.id)
          .eq("semester", Number(semester))
          .order("subject_code");

        if (subjectError) throw subjectError;
        setSubjects((data ?? []) as Subject[]);
      } catch (err: any) {
        setError(err?.message || "Unable to load syllabus subjects.");
      } finally {
        setLoadingSubjects(false);
      }
    }

    loadSubjects();
  }, [course, semester, syllabusCourses]);

  useEffect(() => {
    async function loadStudentsAndMarks() {
      if (!course || !semester) {
        setStudents([]);
        setMarks({});
        return;
      }

      setLoadingStudents(true);
      setError("");
      setSuccess("");

      try {
        const selectedCourseKey = normalizeCourse(course);
        const filteredStudents = allStudents.filter(
          (student) =>
            normalizeCourse(student.course) === selectedCourseKey &&
            Number(student.semester) === Number(semester)
        );

        setStudents(filteredStudents);

        if (!filteredStudents.length) {
          setMarks({});
          return;
        }

        const { data, error: marksError } = await supabase
          .from("internal_marks")
          .select(
            `
              id,
              student_id,
              subject_id,
              course,
              semester,
              assignment_mark,
              seminar_mark,
              test_paper_mark,
              attendance_mark,
              total_mark,
              mark,
              created_at,
              updated_at,
              syllabus_subjects (
                id,
                subject_name,
                subject_code
              )
            `
          )
          .in(
            "student_id",
            filteredStudents.map((student) => student.id)
          )
          .eq("semester", Number(semester));

        if (marksError) throw marksError;

        const next: Record<string, InternalMark[]> = {};

        ((data ?? []) as InternalMark[]).forEach((mark) => {
          (next[mark.student_id] ??= []).push(mark);
        });

        Object.values(next).forEach((studentMarks) => {
        studentMarks.sort((a, b) =>
          (getRelatedSubject(a)?.subject_code ?? "").localeCompare(
            getRelatedSubject(b)?.subject_code ?? ""
          )
        );
      });

        setMarks(next);
      } catch (err: any) {
        setError(err?.message || "Unable to load internal marks.");
      } finally {
        setLoadingStudents(false);
      }
    }

    loadStudentsAndMarks();
  }, [allStudents, course, semester]);

  function resetEditor() {
    setSubjectId("");
    setAssignment("");
    setSeminar("");
    setTestPaper("");
    setAttendance("");
  }

  function openEditor(student: Student) {
    setViewingStudent(null);
    setEditingStudent(student);
    resetEditor();
    setError("");
    setSuccess("");
  }

  function closeEditor() {
    if (saving) return;
    setEditingStudent(null);
    resetEditor();
  }

  function handleSubjectChange(nextSubjectId: string) {
    setSubjectId(nextSubjectId);

    if (!editingStudent || !nextSubjectId) {
      setAssignment("");
      setSeminar("");
      setTestPaper("");
      setAttendance("");
      return;
    }

    const existing = (marks[editingStudent.id] ?? []).find(
      (item) => item.subject_id === nextSubjectId
    );

    if (existing) {
      setAssignment(numberText(existing.assignment_mark));
      setSeminar(numberText(existing.seminar_mark));
      setTestPaper(numberText(existing.test_paper_mark));
      setAttendance(numberText(existing.attendance_mark));
    } else {
      setAssignment("");
      setSeminar("");
      setTestPaper("");
      setAttendance("");
    }
  }

  async function saveMark() {
    if (!editingStudent || !course || !semester || !subjectId) {
      setError("Please select a subject.");
      return;
    }

    const existingMark = (marks[editingStudent.id] ?? []).find(
      (item) => item.subject_id === subjectId
    );

    if (existingMark) {
      setError(
        "This subject has already been added for this student. Select another subject."
      );
      return;
    }

    const rawValues = [
      assignment,
      seminar,
      testPaper,
      attendance,
    ];

    const values = rawValues.map(Number);

    if (
      rawValues.some((value) => !value.trim()) ||
      values.some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      setError(
        "All four marks are required and must be non-negative numbers."
      );
      return;
    }

    const subject = subjects.find((item) => item.id === subjectId);

    if (!subject) {
      setError("Selected subject could not be found.");
      return;
    }

    const total = values.reduce((sum, value) => sum + value, 0);

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        student_id: editingStudent.id,
        subject_id: subject.id,
        course,
        semester: Number(semester),
        assignment_mark: values[0],
        seminar_mark: values[1],
        test_paper_mark: values[2],
        attendance_mark: values[3],
        total_mark: total,
        mark: total,
        updated_at: new Date().toISOString(),
      };

      let savedRow: any = null;
      let saveError: any = null;

      const existingResult = await supabase
        .from("internal_marks")
        .select("id")
        .eq("student_id", editingStudent.id)
        .eq("subject_id", subject.id)
        .maybeSingle();

      if (existingResult.error) {
        throw existingResult.error;
      }

      if (existingResult.data?.id) {
        setError(
          "This subject has already been added for this student. Select another subject."
        );
        return;
      }

      const result = await supabase
        .from("internal_marks")
        .insert(payload)
        .select(
          `
            id,
            student_id,
            subject_id,
            course,
            semester,
            assignment_mark,
            seminar_mark,
            test_paper_mark,
            attendance_mark,
            total_mark,
            mark,
            created_at,
            updated_at,
            syllabus_subjects (
              id,
              subject_name,
              subject_code
            )
          `
        )
        .single();

      savedRow = result.data;
      saveError = result.error;

      if (saveError) throw saveError;

      const saved: InternalMark = {
        id: String(savedRow?.id),
        student_id: String(savedRow?.student_id ?? editingStudent.id),
        subject_id: String(savedRow?.subject_id ?? subject.id),
        course: String(savedRow?.course ?? course),
        semester: Number(savedRow?.semester ?? semester),
        assignment_mark: Number(savedRow?.assignment_mark ?? values[0]),
        seminar_mark: Number(savedRow?.seminar_mark ?? values[1]),
        test_paper_mark: Number(savedRow?.test_paper_mark ?? values[2]),
        attendance_mark: Number(savedRow?.attendance_mark ?? values[3]),
        total_mark: Number(savedRow?.total_mark ?? total),
        mark: Number(savedRow?.mark ?? total),
        created_at: savedRow?.created_at,
        updated_at: savedRow?.updated_at,
        syllabus_subjects: savedRow?.syllabus_subjects ?? subject,
      };

      setMarks((current) => ({
        ...current,
        [editingStudent.id]: [
          ...(current[editingStudent.id] ?? []),
          saved,
        ].sort((a, b) =>
          (getRelatedSubject(a)?.subject_code ?? "").localeCompare(
            getRelatedSubject(b)?.subject_code ?? ""
          )
        ),
      }));

      setSuccess(
        `${subject.subject_name} mark saved for ${editingStudent.name}.`
      );

      setEditingStudent(null);
      resetEditor();
    } catch (err: any) {
      setError(err?.message || "Unable to save internal mark.");
    } finally {
      setSaving(false);
    }
  }

  function escapeHtml(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function generateReport() {
    if (!course || !semester) {
      setError("Please select a course and semester before generating the report.");
      return;
    }

    if (!students.length) {
      setError("No students found for the selected course and semester.");
      return;
    }

    const rows = students
      .map((student, studentIndex) => {
        const studentMarks = marks[student.id] ?? [];

        const identityCells = `
          <td class="admissionCell">${escapeHtml(student.admissionNo)}</td>
          <td class="studentNameCell">
            <strong>${escapeHtml(student.name)}</strong>
          </td>
        `;

        const blankIdentityCells = `
          <td class="admissionCell blankIdentity" aria-hidden="true"></td>
          <td class="studentNameCell blankIdentity" aria-hidden="true"></td>
        `;

        if (!studentMarks.length) {
          return `
            <tr class="studentStart">
              ${identityCells}
              <td colspan="6" class="no-mark">No marks added</td>
            </tr>
          `;
        }

        return studentMarks
          .map((mark, markIndex) => {
            const subject = getRelatedSubject(mark);

            return `
              <tr class="${markIndex === 0 ? "studentStart" : ""}">
                ${markIndex === 0 ? identityCells : blankIdentityCells}
                <td class="subjectCell">
                  <strong>${escapeHtml(subject?.subject_code ?? "—")}</strong>
                  ${
                    subject?.subject_name
                      ? `<span>${escapeHtml(subject.subject_name)}</span>`
                      : ""
                  }
                </td>
                <td>${Number(mark.assignment_mark).toLocaleString()}</td>
                <td>${Number(mark.seminar_mark).toLocaleString()}</td>
                <td>${Number(mark.test_paper_mark).toLocaleString()}</td>
                <td>${Number(mark.attendance_mark).toLocaleString()}</td>
                <td class="totalCell"><strong>${Number(mark.total_mark).toLocaleString()}</strong></td>
              </tr>
            `;
          })
          .join("");
      })
      .join("");

    const reportWindow = window.open("", "_blank", "width=1200,height=850");

    if (!reportWindow) {
      setError("Please allow pop-ups in the browser to generate the report.");
      return;
    }

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Internal Marks Report - ${escapeHtml(course)} - Semester ${escapeHtml(semester)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              color: #172033;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              align-items: flex-start;
              padding-bottom: 18px;
              border-bottom: 2px solid #172033;
            }
            .college {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #64748b;
            }
            h1 {
              margin: 6px 0 5px;
              font-size: 24px;
              line-height: 1.2;
            }
            .meta {
              color: #475569;
              font-size: 13px;
              font-weight: 700;
            }
            .date {
              color: #64748b;
              font-size: 12px;
              white-space: nowrap;
            }
            .summary {
              display: flex;
              gap: 10px;
              margin: 18px 0;
            }
            .pill {
              padding: 8px 11px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              background: #f8fafc;
              font-size: 11px;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10.5px;
            }
            th {
              padding: 9px 7px;
              border: 1px solid #334155;
              background: #e2e8f0;
              color: #172033;
              text-align: left;
              font-size: 9px;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }
            td {
              padding: 8px 7px;
              border: 1px solid #cbd5e1;
              vertical-align: top;
            }
            td span {
              color: #64748b;
              font-size: 9px;
            }
            .no-mark {
              color: #94a3b8;
              text-align: center;
              font-style: italic;
            }
            .footer {
              margin-top: 22px;
              color: #64748b;
              font-size: 9px;
              text-align: right;
            }
            @media print {
              body { padding: 16px; }
              .no-print { display: none; }
              @page {
                size: A4 landscape;
                margin: 10mm;
              }
            }
    
        /* Navy action theme for Internal Marks Add buttons */
        .internalMarksPage button.internalMarksAddButton,
        .internalMarksPage .internalMarksAddButton,
        .internalMarksPage button[data-action="add-mark"] {
          background: #0f2747;
          border: 1px solid #0b1d34;
          color: #ffffff;
          box-shadow:
            0 3px 0 #071525,
            0 7px 14px rgba(15, 39, 71, 0.16);
          transition:
            transform 140ms ease,
            box-shadow 140ms ease,
            background 140ms ease;
        }

        .internalMarksPage button.internalMarksAddButton:hover:not(:disabled),
        .internalMarksPage .internalMarksAddButton:hover:not(:disabled),
        .internalMarksPage button[data-action="add-mark"]:hover:not(:disabled) {
          background: #17365f;
          transform: translateY(-2px);
          box-shadow:
            0 5px 0 #071525,
            0 10px 18px rgba(15, 39, 71, 0.19);
        }

        .internalMarksPage button.internalMarksAddButton:active:not(:disabled),
        .internalMarksPage .internalMarksAddButton:active:not(:disabled),
        .internalMarksPage button[data-action="add-mark"]:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow:
            0 2px 0 #071525,
            0 4px 8px rgba(15, 39, 71, 0.12);
        }

        /* View modal: alternating light-gray / gray subject rows/cards */
        .internalMarksModal .internalMarksViewList {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .internalMarksModal .internalMarksViewCard {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #f1f5f9;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.045);
          overflow: hidden;
        }

        .internalMarksModal .internalMarksViewCard:nth-child(even) {
          background: #e5e7eb;
        }

        .internalMarksModal .internalMarksViewCard:nth-child(odd) {
          background: #f8fafc;
        }

        .internalMarksModal .internalMarksViewSubject {
          border-bottom: 1px solid #cbd5e1;
        }

        .internalMarksModal .internalMarksViewScores > div {
          border-right: 1px solid #d1d5db;
        }

        .internalMarksModal .internalMarksViewScores > div:last-child {
          border-right: 0;
        }

      </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="college">Royal College of Arts and Science, Thrithala</div>
              <h1>Internal Marks Report</h1>
              <div class="meta">${escapeHtml(course)} &nbsp; • &nbsp; Semester ${escapeHtml(semester)}</div>
            </div>
            <div class="date">${escapeHtml(new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }))}</div>
          </div>

          <div class="summary">
            <div class="pill">Students: ${students.length}</div>
            <div class="pill">Subjects Recorded: ${students.reduce(
              (sum, student) => sum + (marks[student.id]?.length ?? 0),
              0
            )}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Admission No.</th>
                <th>Student Name</th>
                <th>Subject</th>
                <th>Assignment</th>
                <th>Seminar</th>
                <th>Test Paper</th>
                <th>Attendance</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="footer">
            Generated from the Royal College Administration System
          </div>
        </body>
      </html>
    `);

    reportWindow.document.close();

    reportWindow.onload = () => {
      reportWindow.focus();
      reportWindow.print();
    };
  }

  if (!canView) {
    return (
      <PermissionDenied
        onBack={onBack}
        title="Internal Marks Access Restricted"
      />
    );
  }

  const viewingMarks = viewingStudent
    ? marks[viewingStudent.id] ?? []
    : [];

  return (
    <div className="imPage">
      <div className="imTopBar">
        <BackToDashboard onBack={onBack} />
        <div className="imTopBarRight">
          <span className="imStatusDot" />
          <span>Academic Assessment</span>
        </div>
      </div>

      <header className="imHero">
        <div className="imHeroCopy">
          <div className="imEyebrow"><span /> INTERNAL ASSESSMENT</div>
          <h1>Internal Marks</h1>
          <p>Manage subject-wise internal assessment marks for every student.</p>
        </div>
        <div className="imHeroBadge">
          <div className="imHeroBadgeIcon"><Icon name="clipboard" size={24} /></div>
          <div>
            <strong>{course && semester ? `${course}` : "Class Selection"}</strong>
            <span>{course && semester ? `Semester ${semester}` : "Select course & semester"}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="imAlert imAlertError">
          <span className="imAlertIcon"><Icon name="alert" size={16} /></span>
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button>
        </div>
      )}

      {success && (
        <div className="imAlert imAlertSuccess">
          <span className="imAlertIcon"><Icon name="check" size={16} /></span>
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} aria-label="Dismiss success">×</button>
        </div>
      )}

      <section className="imSelectorCard">
        <div className="imSelectorHead">
          <div className="imSelectorIcon"><Icon name="clipboard" size={21} /></div>
          <div>
            <h2>Choose Student Group</h2>
            <p>Select the course and semester you want to manage.</p>
          </div>
        </div>

        <div className="imSelectorGrid">
          <label className="imField">
            <span>COURSE</span>
            <div className="imSelectWrap">
              <select
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                disabled={loadingOptions}
              >
                <option value="">Select course</option>
                {courses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <span>⌄</span>
            </div>
          </label>

          <label className="imField">
            <span>SEMESTER</span>
            <div className="imSelectWrap">
              <select
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                disabled={!course || loadingOptions}
              >
                <option value="">Select semester</option>
                {semesters.map((item) => (
                  <option key={item} value={item}>Semester {item}</option>
                ))}
              </select>
              <span>⌄</span>
            </div>
          </label>

          <button
            type="button"
            className="imReportButton"
            onClick={generateReport}
            disabled={!course || !semester || loadingStudents}
          >
            <Icon name="file" size={17} />
            <span>Generate Report</span>
          </button>
        </div>
      </section>

      <section className="imStudentsCard">
        <div className="imStudentsHead">
          <div>
            <div className="imSectionLabel">STUDENT REGISTER</div>
            <h2>{course && semester ? "Student Internal Marks" : "Students"}</h2>
            <p>
              {course && semester
                ? `${course}  •  Semester ${semester}`
                : "Select a course and semester to load the student register."}
            </p>
          </div>
          <div className="imCountBadge">
            <strong>{students.length}</strong>
            <span>STUDENTS</span>
          </div>
        </div>

        {!course || !semester ? (
          <div className="imEmptyState">
            <div className="imEmptyIcon"><Icon name="clipboard" size={27} /></div>
            <strong>Select a class to begin</strong>
            <span>Choose both course and semester above.</span>
          </div>
        ) : loadingStudents ? (
          <div className="imEmptyState">
            <div className="imLoader" />
            <strong>Loading students</strong>
            <span>Please wait while the student register is loaded.</span>
          </div>
        ) : !students.length ? (
          <div className="imEmptyState">
            <div className="imEmptyIcon imEmptyWarning"><Icon name="alert" size={27} /></div>
            <strong>No students found</strong>
            <span>No students are available for this course and semester.</span>
          </div>
        ) : (
          <div className="imTableScroll">
            <table className="imTable">
              <thead>
                <tr>
                  <th className="imNoCol">#</th>
                  <th>STUDENT</th>
                  <th>ADMISSION NO.</th>
                  <th>COURSE</th>
                  <th>SEMESTER</th>
                  <th className="imActionCol">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const studentMarks = marks[student.id] ?? [];
                  const subjectCount = studentMarks.length;
                  return (
                    <tr key={student.id}>
                      <td className="imNoCol"><span className="imRowNo">{String(index + 1).padStart(2, "0")}</span></td>
                      <td>
                        <div className="imStudentCell">
                          <div className="imAvatar">{student.name.trim().charAt(0).toUpperCase() || "S"}</div>
                          <div>
                            <strong>{student.name}</strong>
                            <span>{subjectCount} subject{subjectCount === 1 ? "" : "s"} recorded</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="imAdmission">{student.admissionNo}</span></td>
                      <td>{student.course}</td>
                      <td><span className="imSemesterPill">Sem {student.semester}</span></td>
                      <td>
                        <div className="imActions">
                          <button
                            type="button"
                            className="imViewButton"
                            onClick={() => setViewingStudent(student)}
                            title={`View ${student.name}'s marks`}
                          >
                            <Icon name="eye" size={15} />
                            View
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              className="imAddButton"
                              onClick={() => openEditor(student)}
                            >
                              <Icon name="plus" size={15} />
                              Add Mark
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingStudent && (
        <div className="imOverlay" role="dialog" aria-modal="true">
          <div className="imModal imAddModal">
            <div className="imModalHead">
              <div className="imModalTitleWrap">
                <div className="imModalIcon"><Icon name="plus" size={19} /></div>
                <div>
                  <div className="imModalEyebrow">NEW ASSESSMENT</div>
                  <h2>Add Internal Mark</h2>
                  <p>{editingStudent.name} <span>•</span> {editingStudent.admissionNo}</p>
                </div>
              </div>
              <button type="button" className="imCloseButton" onClick={closeEditor} disabled={saving} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="imModalBody">
              <div className="imStudentMini">
                <div className="imAvatar imAvatarLarge">{editingStudent.name.trim().charAt(0).toUpperCase() || "S"}</div>
                <div>
                  <strong>{editingStudent.name}</strong>
                  <span>{editingStudent.course}  •  Semester {editingStudent.semester}</span>
                </div>
              </div>

              <label className="imField imSubjectField">
                <span>SUBJECT</span>
                <div className="imSelectWrap">
                  <select
                    value={subjectId}
                    onChange={(event) => handleSubjectChange(event.target.value)}
                    disabled={loadingSubjects || saving}
                  >
                    <option value="">
                      {loadingSubjects ? "Loading subjects…" : "Select syllabus subject"}
                    </option>
                    {subjects.map((subject) => {
                      const alreadyAdded = (marks[editingStudent.id] ?? []).some(
                        (item) => item.subject_id === subject.id
                      );
                      return (
                        <option key={subject.id} value={subject.id} disabled={alreadyAdded}>
                          {alreadyAdded ? "✓ " : ""}{subject.subject_code} — {subject.subject_name}{alreadyAdded ? " — Already Added" : ""}
                        </option>
                      );
                    })}
                  </select>
                  <span>⌄</span>
                </div>
              </label>

              {!loadingSubjects && !subjects.length && (
                <div className="imNoSubject"><Icon name="alert" size={15} /> No subjects found for this course and semester.</div>
              )}

              <div className="imAssessmentBlock">
                <div className="imAssessmentHead">
                  <div>
                    <h3>Assessment Breakdown</h3>
                    <p>Enter the four internal assessment components.</p>
                  </div>
                  <div className="imLiveTotal"><span>TOTAL</span><strong>{liveTotal}</strong></div>
                </div>

                <div className="imScoreGrid">
                  <label className="imScoreField">
                    <span>ASSIGNMENT</span>
                    <div><input type="number" min="0" step="0.01" value={assignment} onChange={(event) => setAssignment(normalizeMark(event.target.value))} placeholder="0" autoFocus disabled={saving} /><small>MARKS</small></div>
                  </label>
                  <label className="imScoreField">
                    <span>SEMINAR</span>
                    <div><input type="number" min="0" step="0.01" value={seminar} onChange={(event) => setSeminar(normalizeMark(event.target.value))} placeholder="0" disabled={saving} /><small>MARKS</small></div>
                  </label>
                  <label className="imScoreField">
                    <span>TEST PAPER</span>
                    <div><input type="number" min="0" step="0.01" value={testPaper} onChange={(event) => setTestPaper(normalizeMark(event.target.value))} placeholder="0" disabled={saving} /><small>MARKS</small></div>
                  </label>
                  <label className="imScoreField">
                    <span>ATTENDANCE</span>
                    <div><input type="number" min="0" step="0.01" value={attendance} onChange={(event) => setAttendance(normalizeMark(event.target.value))} placeholder="0" disabled={saving} /><small>MARKS</small></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="imModalFoot">
              <button type="button" className="imCancelButton" onClick={closeEditor} disabled={saving}>Cancel</button>
              <button type="button" className="imSaveButton" onClick={saveMark} disabled={saving || !subjects.length}>
                {saving ? "Saving…" : "Save Internal Mark"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingStudent && (
        <div className="imOverlay" role="dialog" aria-modal="true">
          <div className="imModal imViewModal">
            <div className="imModalHead">
              <div className="imModalTitleWrap">
                <div className="imModalIcon"><Icon name="eye" size={19} /></div>
                <div>
                  <div className="imModalEyebrow">MARKS SUMMARY</div>
                  <h2>Internal Marks</h2>
                  <p>{viewingStudent.name} <span>•</span> {viewingStudent.admissionNo}</p>
                </div>
              </div>
              <button type="button" className="imCloseButton" onClick={() => setViewingStudent(null)} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="imViewMeta">
              <span>{viewingStudent.course}</span>
              <span>Semester {viewingStudent.semester}</span>
              <span>{viewingMarks.length} subject{viewingMarks.length === 1 ? "" : "s"}</span>
            </div>

            {viewingMarks.length ? (
              <div className="imMarksList">
                {viewingMarks.map((mark, index) => {
                  const subject = getRelatedSubject(mark);
                  return (
                    <article className="imMarkCard" key={mark.subject_id}>
                      <div className="imMarkCardTop">
                        <div className="imMarkIndex">{String(index + 1).padStart(2, "0")}</div>
                        <div className="imMarkSubject">
                          <strong>{subject?.subject_name ?? "Subject"}</strong>
                          <span>{subject?.subject_code ?? "—"}</span>
                        </div>
                        <div className="imMarkTotal"><span>TOTAL</span><strong>{mark.total_mark}</strong></div>
                      </div>
                      <div className="imMarkScores">
                        <div><span>Assignment</span><strong>{mark.assignment_mark}</strong></div>
                        <div><span>Seminar</span><strong>{mark.seminar_mark}</strong></div>
                        <div><span>Test Paper</span><strong>{mark.test_paper_mark}</strong></div>
                        <div><span>Attendance</span><strong>{mark.attendance_mark}</strong></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="imViewEmpty">
                <div className="imEmptyIcon"><Icon name="file" size={27} /></div>
                <strong>No internal marks added</strong>
                <span>Use “Add Mark” to enter the first subject-wise assessment.</span>
              </div>
            )}

            <div className="imModalFoot">
              <button type="button" className="imCancelButton imNeutralButton" onClick={() => setViewingStudent(null)}>Close</button>
              {canEdit && (
                <button type="button" className="imSaveButton" onClick={() => openEditor(viewingStudent)}>
                  <Icon name="plus" size={15} /> Add Mark
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap");

        .imPage, .imPage * { box-sizing: border-box; font-family: "Poppins", sans-serif; }
        .imPage { min-height: 100%; color: #172033; padding-bottom: 40px; }

        .imTopBar { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:22px; }
        .imTopBarRight { display:flex; align-items:center; gap:8px; color:#718096; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
        .imStatusDot { width:7px; height:7px; border-radius:50%; background:#84b067; box-shadow:0 0 0 4px rgba(132,176,103,.13); }

        .imHero { display:flex; align-items:flex-end; justify-content:space-between; gap:28px; margin-bottom:22px; padding:4px 2px 0; }
        .imEyebrow { display:flex; align-items:center; gap:8px; color:#63834f; font-size:10px; font-weight:800; letter-spacing:.14em; }
        .imEyebrow span { width:24px; height:2px; border-radius:2px; background:#84b067; }
        .imHero h1 { margin:8px 0 6px; color:#162033; font-size:34px; line-height:1.08; font-weight:800; letter-spacing:-.045em; }
        .imHero p { margin:0; color:#718096; font-size:13px; line-height:1.55; }
        .imHeroBadge { min-width:260px; display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid #dce6d5; border-radius:15px; background:#f7faf5; }
        .imHeroBadgeIcon { width:42px; height:42px; display:grid; place-items:center; border-radius:11px; background:#84b067; color:#fff; }
        .imHeroBadge strong { display:block; max-width:190px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#253126; font-size:12px; font-weight:800; }
        .imHeroBadge span { display:block; margin-top:3px; color:#73806f; font-size:10px; font-weight:600; }

        .imAlert { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:11px 13px; border-radius:12px; font-size:11px; font-weight:700; }
        .imAlert button { margin-left:auto; border:0; background:transparent; color:inherit; font-size:18px; line-height:1; cursor:pointer; }
        .imAlertIcon { width:27px; height:27px; display:grid; place-items:center; flex:0 0 27px; border-radius:8px; }
        .imAlertError { border:1px solid #f0cccc; background:#fff6f6; color:#9f3333; }
        .imAlertError .imAlertIcon { background:#ffe3e3; }
        .imAlertSuccess { border:1px solid #cfe3c5; background:#f5faf2; color:#477239; }
        .imAlertSuccess .imAlertIcon { background:#e2f0dc; }

        .imSelectorCard { display:grid; grid-template-columns:270px 1fr; gap:24px; align-items:center; margin-bottom:18px; padding:18px; border:1px solid #dfe6dd; border-radius:18px; background:#ffffff; box-shadow:0 8px 28px rgba(30,50,30,.055); }
        .imSelectorHead { display:flex; align-items:center; gap:12px; }
        .imSelectorIcon { width:46px; height:46px; display:grid; place-items:center; flex:0 0 46px; border-radius:13px; background:#edf5e9; color:#64874f; }
        .imSelectorHead h2 { margin:0; color:#202a24; font-size:14px; font-weight:800; }
        .imSelectorHead p { margin:4px 0 0; color:#7b877c; font-size:10px; line-height:1.45; }
        .imSelectorGrid { display:grid; grid-template-columns:minmax(180px,1fr) minmax(160px,.8fr) 168px; gap:10px; align-items:end; }
        .imField { display:flex; flex-direction:column; gap:7px; min-width:0; }
        .imField > span { color:#69756c; font-size:9px; font-weight:800; letter-spacing:.09em; }
        .imSelectWrap { position:relative; }
        .imSelectWrap select { width:100%; height:43px; appearance:none; padding:0 36px 0 12px; border:1px solid #d8e0d6; border-radius:11px; outline:0; background:#fbfcfb; color:#253029; font-size:11px; font-weight:700; cursor:pointer; }
        .imSelectWrap select:focus { border-color:#84b067; box-shadow:0 0 0 3px rgba(132,176,103,.13); }
        .imSelectWrap > span { position:absolute; top:50%; right:12px; transform:translateY(-53%); color:#758274; font-size:16px; pointer-events:none; }
        .imReportButton { height:43px; display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid #6e934f; border-radius:11px; background:#84b067; color:#fff; font-size:10px; font-weight:800; cursor:pointer; box-shadow:0 4px 10px rgba(100,135,79,.18); transition:.15s ease; }
        .imReportButton:hover:not(:disabled) { background:#739c5b; transform:translateY(-1px); }
        .imReportButton:disabled { opacity:.45; cursor:not-allowed; box-shadow:none; }

        .imStudentsCard { overflow:hidden; border:1px solid #dfe6dd; border-radius:18px; background:#fff; box-shadow:0 8px 30px rgba(30,50,30,.055); }
        .imStudentsHead { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:19px 20px; border-bottom:1px solid #e5eae3; background:linear-gradient(135deg,#f7faf5 0%,#f0f6ec 100%); }
        .imSectionLabel { margin-bottom:5px; color:#73955f; font-size:8px; font-weight:800; letter-spacing:.13em; }
        .imStudentsHead h2 { margin:0; color:#1c2720; font-size:18px; font-weight:800; letter-spacing:-.025em; }
        .imStudentsHead p { margin:4px 0 0; color:#718073; font-size:10px; }
        .imCountBadge { min-width:76px; padding:8px 12px; border:1px solid #d3e0cd; border-radius:12px; background:#fff; text-align:center; }
        .imCountBadge strong { display:block; color:#436332; font-size:18px; line-height:1; font-weight:800; }
        .imCountBadge span { display:block; margin-top:4px; color:#82907e; font-size:7px; font-weight:800; letter-spacing:.08em; }

        .imTableScroll { overflow-x:auto; }
        .imTable { width:100%; min-width:820px; border-collapse:collapse; }
        .imTable th { padding:11px 14px; border-bottom:1px solid #d8e0d6; background:#263126; color:#fff; text-align:left; font-size:8px; font-weight:800; letter-spacing:.1em; white-space:nowrap; }
        .imTable th:first-child { border-top-left-radius:0; }
        .imTable th:last-child { text-align:right; }
        .imTable td { padding:12px 14px; border-bottom:1px solid #edf0ec; color:#59655b; font-size:11px; vertical-align:middle; }
        .imTable tbody tr:nth-child(even) { background:#fbfcfb; }
        .imTable tbody tr:hover { background:#f3f8f0; }
        .imTable tbody tr:last-child td { border-bottom:0; }
        .imNoCol { width:54px; text-align:center !important; }
        .imActionCol { width:210px; }
        .imRowNo { color:#9aa59b; font-size:9px; font-weight:800; }
        .imStudentCell { display:flex; align-items:center; gap:10px; min-width:220px; }
        .imAvatar { width:34px; height:34px; display:grid; place-items:center; flex:0 0 34px; border-radius:10px; background:#e8f1e4; color:#5d7f4c; font-size:12px; font-weight:800; }
        .imAvatarLarge { width:42px; height:42px; flex-basis:42px; border-radius:12px; font-size:14px; }
        .imStudentCell strong { display:block; color:#283329; font-size:11px; font-weight:800; }
        .imStudentCell span { display:block; margin-top:3px; color:#99a29b; font-size:8px; font-weight:600; }
        .imAdmission { color:#5e6b61; font-size:10px; font-weight:700; }
        .imSemesterPill { display:inline-flex; padding:5px 8px; border:1px solid #dce6d7; border-radius:999px; background:#f4f8f1; color:#5f7b51; font-size:8px; font-weight:800; }
        .imActions { display:flex; align-items:center; justify-content:flex-end; gap:7px; }
        .imViewButton, .imAddButton { min-height:33px; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:0 10px; border-radius:9px; font-size:9px; font-weight:800; cursor:pointer; transition:.15s ease; }
        .imViewButton { border:1px solid #d9e1d7; background:#fff; color:#536158; }
        .imViewButton:hover { background:#f4f7f3; border-color:#bfcbbb; }
        .imAddButton { border:1px solid #709651; background:#84b067; color:#fff; box-shadow:0 3px 8px rgba(100,135,79,.15); }
        .imAddButton:hover { background:#739c5b; transform:translateY(-1px); }

        .imEmptyState, .imViewEmpty { min-height:250px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; padding:36px 20px; background:#fcfdfc; text-align:center; }
        .imEmptyIcon { width:56px; height:56px; display:grid; place-items:center; margin-bottom:3px; border:1px solid #dce7d8; border-radius:16px; background:#f0f6ed; color:#769b5d; }
        .imEmptyWarning { background:#fff8eb; border-color:#f1dfb9; color:#b1833e; }
        .imEmptyState strong, .imViewEmpty strong { color:#455148; font-size:12px; font-weight:800; }
        .imEmptyState span, .imViewEmpty span { max-width:340px; color:#98a199; font-size:9px; line-height:1.55; }
        .imLoader { width:27px; height:27px; margin-bottom:7px; border:3px solid #e2eadf; border-top-color:#84b067; border-radius:50%; animation:imSpin .8s linear infinite; }
        @keyframes imSpin { to { transform:rotate(360deg); } }

        .imOverlay { position:fixed; inset:0; z-index:200; display:grid; place-items:center; padding:20px; background:rgba(22,32,25,.46); backdrop-filter:blur(6px); }
        .imModal { width:min(760px,100%); max-height:92vh; overflow:auto; border:1px solid #d7e0d4; border-radius:20px; background:#fff; box-shadow:0 25px 70px rgba(22,35,25,.24); }
        .imViewModal { width:min(900px,100%); }
        .imModalHead { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:20px 22px; border-bottom:1px solid #e6ebe4; background:#f7faf5; }
        .imModalTitleWrap { display:flex; align-items:center; gap:12px; min-width:0; }
        .imModalIcon { width:40px; height:40px; display:grid; place-items:center; flex:0 0 40px; border-radius:12px; background:#84b067; color:#fff; }
        .imModalEyebrow { margin-bottom:3px; color:#769461; font-size:7px; font-weight:800; letter-spacing:.13em; }
        .imModalHead h2 { margin:0; color:#202b23; font-size:19px; font-weight:800; letter-spacing:-.02em; }
        .imModalHead p { margin:4px 0 0; color:#7a867d; font-size:9px; font-weight:600; }
        .imModalHead p span { margin:0 4px; color:#b4bcb5; }
        .imCloseButton { width:34px; height:34px; display:grid; place-items:center; flex:0 0 34px; border:1px solid #dbe3d8; border-radius:10px; background:#fff; color:#69756c; cursor:pointer; }
        .imCloseButton:hover { background:#f0f4ee; }
        .imModalBody { padding:20px 22px; }
        .imStudentMini { display:flex; align-items:center; gap:10px; margin-bottom:18px; padding:11px 12px; border:1px solid #e0e8dd; border-radius:13px; background:#fbfdf9; }
        .imStudentMini strong { display:block; color:#344037; font-size:11px; font-weight:800; }
        .imStudentMini span { display:block; margin-top:3px; color:#879289; font-size:8px; }
        .imSubjectField { margin-bottom:17px; }
        .imNoSubject { display:flex; align-items:center; gap:7px; margin:-5px 0 16px; padding:9px 10px; border:1px solid #f0dfb8; border-radius:10px; background:#fff9ed; color:#9a7134; font-size:9px; font-weight:700; }
        .imAssessmentBlock { padding:16px; border:1px solid #e0e8dd; border-radius:15px; background:#f8fbf7; }
        .imAssessmentHead { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:14px; }
        .imAssessmentHead h3 { margin:0; color:#2e3a31; font-size:12px; font-weight:800; }
        .imAssessmentHead p { margin:3px 0 0; color:#89958c; font-size:8px; }
        .imLiveTotal { min-width:78px; padding:7px 10px; border:1px solid #cfe0c8; border-radius:11px; background:#edf5e9; text-align:right; }
        .imLiveTotal span { display:block; color:#779068; font-size:6px; font-weight:800; letter-spacing:.1em; }
        .imLiveTotal strong { display:block; margin-top:2px; color:#48673a; font-size:17px; line-height:1; font-weight:800; }
        .imScoreGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
        .imScoreField { display:flex; flex-direction:column; gap:6px; }
        .imScoreField > span { color:#667268; font-size:8px; font-weight:800; letter-spacing:.07em; }
        .imScoreField > div { position:relative; }
        .imScoreField input { width:100%; height:46px; padding:0 42px 0 12px; border:1px solid #d8e1d5; border-radius:10px; outline:0; background:#fff; color:#263229; font-size:14px; font-weight:800; }
        .imScoreField input:focus { border-color:#84b067; box-shadow:0 0 0 3px rgba(132,176,103,.12); }
        .imScoreField small { position:absolute; right:10px; top:50%; transform:translateY(-50%); color:#a0aaa2; font-size:6px; font-weight:800; letter-spacing:.06em; pointer-events:none; }
        .imModalFoot { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:14px 22px 18px; border-top:1px solid #e6ebe4; background:#fafcf9; }
        .imCancelButton, .imSaveButton { min-height:39px; padding:0 15px; border-radius:10px; font-size:9px; font-weight:800; cursor:pointer; }
        .imCancelButton { border:1px solid #dce3da; background:#fff; color:#69756c; }
        .imCancelButton:hover { background:#f3f6f2; }
        .imSaveButton { display:inline-flex; align-items:center; justify-content:center; gap:7px; border:1px solid #6f954f; background:#84b067; color:#fff; box-shadow:0 4px 10px rgba(100,135,79,.16); }
        .imSaveButton:hover:not(:disabled) { background:#739c5b; transform:translateY(-1px); }
        .imSaveButton:disabled, .imCancelButton:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; }

        .imViewMeta { display:flex; flex-wrap:wrap; gap:7px; padding:13px 20px; border-bottom:1px solid #e7ece5; background:#fbfdfb; }
        .imViewMeta span { padding:6px 9px; border:1px solid #dce5d9; border-radius:999px; background:#fff; color:#66736a; font-size:8px; font-weight:800; }
        .imMarksList { padding:14px 20px 4px; }
        .imMarkCard { margin-bottom:10px; padding:14px; border:1px solid #dfe7dc; border-radius:14px; background:#fff; }
        .imMarkCard:nth-child(even) { background:#f8faf7; }
        .imMarkCardTop { display:flex; align-items:center; gap:10px; }
        .imMarkIndex { width:30px; height:30px; display:grid; place-items:center; flex:0 0 30px; border-radius:9px; background:#edf5e9; color:#6e8d5e; font-size:8px; font-weight:800; }
        .imMarkSubject { flex:1; min-width:0; }
        .imMarkSubject strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#303b33; font-size:11px; font-weight:800; }
        .imMarkSubject span { display:block; margin-top:3px; color:#8b968d; font-size:8px; font-weight:700; }
        .imMarkTotal { min-width:65px; padding-left:10px; border-left:1px solid #e2e8df; text-align:right; }
        .imMarkTotal span { display:block; color:#91a08e; font-size:6px; font-weight:800; letter-spacing:.1em; }
        .imMarkTotal strong { display:block; margin-top:2px; color:#48673a; font-size:17px; font-weight:800; }
        .imMarkScores { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-top:11px; padding-top:10px; border-top:1px solid #edf1eb; }
        .imMarkScores > div { padding:8px 9px; border-radius:9px; background:#f5f8f4; }
        .imMarkScores span { display:block; color:#8a958c; font-size:7px; font-weight:700; }
        .imMarkScores strong { display:block; margin-top:3px; color:#445048; font-size:12px; font-weight:800; }
        .imNeutralButton { min-width:80px; }

        @media (max-width:1050px) {
          .imSelectorCard { grid-template-columns:1fr; gap:15px; }
          .imSelectorGrid { grid-template-columns:1fr 1fr 168px; }
        }
        @media (max-width:760px) {
          .imPage { padding-bottom:25px; }
          .imTopBarRight { display:none; }
          .imHero { align-items:flex-start; flex-direction:column; }
          .imHeroBadge { width:100%; min-width:0; }
          .imSelectorGrid { grid-template-columns:1fr 1fr; }
          .imReportButton { grid-column:1 / -1; width:100%; }
          .imStudentsHead { align-items:flex-start; }
          .imScoreGrid, .imMarkScores { grid-template-columns:1fr 1fr; }
        }
        @media (max-width:520px) {
          .imHero h1 { font-size:28px; }
          .imSelectorCard, .imStudentsHead { padding:14px; }
          .imSelectorGrid { grid-template-columns:1fr; }
          .imReportButton { grid-column:auto; }
          .imStudentsHead { flex-direction:column; }
          .imCountBadge { width:100%; }
          .imActions { justify-content:flex-start; }
          .imOverlay { padding:9px; }
          .imModal { max-height:95vh; border-radius:16px; }
          .imModalHead, .imModalBody { padding-left:15px; padding-right:15px; }
          .imModalFoot { padding-left:15px; padding-right:15px; }
          .imScoreGrid, .imMarkScores { grid-template-columns:1fr 1fr; }
          .imMarkScores > div { padding:7px; }
          .imMarkScores strong { font-size:11px; }
        }
      `}</style>
    </div>
  );
}
