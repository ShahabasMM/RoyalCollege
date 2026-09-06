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
  registerNo: string;
  course: string;
  semester: number;
};

type Course = { id: string; name: string };
type Subject = { id: string; subject_name: string; subject_code: string };
type Grade = "A+" | "A" | "B+" | "B" | "C" | "O" | "P" | "F";
type ResultGrade = {
  id: string;
  student_id: string;
  subject_id: string;
  course: string;
  semester: number;
  grade: Grade;
  syllabus_subjects?: Subject | Subject[] | null;
};

const GRADES: Grade[] = ["A+", "A", "B+", "B", "C", "O", "P", "F"];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function subjectOf(item: ResultGrade): Subject | null {
  if (!item.syllabus_subjects) return null;
  return Array.isArray(item.syllabus_subjects) ? item.syllabus_subjects[0] ?? null : item.syllabus_subjects;
}

export default function Result({ onBack, user }: { onBack: () => void; user: AppUser }) {
  const canView = hasPermission(user, "result.view");
  const canEdit = hasPermission(user, "result.edit");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, ResultGrade[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingClass, setLoadingClass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [draft, setDraft] = useState<Record<string, Grade | "">>({});
  const [saving, setSaving] = useState(false);

  const semesters = useMemo(() => Array.from({ length: 8 }, (_, index) => index + 1), []);
  const selectedCourse = courses.find((item) => item.name === course) ?? courses.find((item) => normalize(item.name) === normalize(course));

  useEffect(() => {
    if (!canView) return;
    async function loadOptions() {
      setLoading(true);
      const courseResultPromise = supabase
        .from("syllabus_courses")
        .select("id, name")
        .order("name");
      const primaryStudentResult = await supabase
        .from("students")
        .select("id, name, reg_no, admission_no, course, semester")
        .order("name");

      // The Students module stores the register number as reg_no. Keep
      // legacy register_no support for older installations.
      let studentResult: any = primaryStudentResult;
      if (primaryStudentResult.error) {
        const legacyStudentResult = await supabase
          .from("students")
          .select("id, name, register_no, admission_no, course, semester")
          .order("name");

        if (!legacyStudentResult.error) {
          studentResult = legacyStudentResult;
        } else {
          const fallbackStudentResult = await supabase
            .from("students")
            .select("id, name, admission_no, course, semester")
            .order("name");

          if (!fallbackStudentResult.error) studentResult = fallbackStudentResult;
        }
      }

      const courseResult = await courseResultPromise;

      if (courseResult.error && studentResult.error) {
        setError("Unable to load courses and students.");
      }
      setCourses((courseResult.data ?? []).map((row: any) => ({ id: String(row.id), name: String(row.name ?? "") })).filter((item) => item.name));
      setStudents((studentResult.data ?? []).map((row: any) => ({
        id: String(row.id), name: String(row.name ?? "Unnamed student"),
        admissionNo: String(row.admission_no ?? "-"), registerNo: String(row.reg_no ?? row.register_no ?? "-"),
        course: String(row.course ?? ""), semester: Number(row.semester),
      })).filter((item: Student) => item.course && Number.isFinite(item.semester)));
      setLoading(false);
    }
    loadOptions();
  }, [canView]);

  useEffect(() => { setSemester(""); }, [course]);

  useEffect(() => {
    if (!course || !semester || !selectedCourse) {
      setSubjects([]); setGrades({}); return;
    }
    async function loadClass() {
      setLoadingClass(true); setError(""); setSuccess("");
      const filtered = students.filter((item) => normalize(item.course) === normalize(course) && item.semester === Number(semester));
      const subjectResult = await supabase.from("syllabus_subjects").select("id, subject_name, subject_code").eq("course_id", selectedCourse!.id).eq("semester", Number(semester)).order("subject_code");
      if (subjectResult.error) setError(subjectResult.error.message);
      setSubjects((subjectResult.data ?? []) as Subject[]);
      if (!filtered.length) { setGrades({}); setLoadingClass(false); return; }
      const gradeResult = await supabase.from("result_grades").select("id, student_id, subject_id, course, semester, grade, syllabus_subjects(id, subject_name, subject_code)").in("student_id", filtered.map((item) => item.id)).eq("semester", Number(semester));
      if (gradeResult.error) setError(gradeResult.error.message);
      const next: Record<string, ResultGrade[]> = {};
      ((gradeResult.data ?? []) as ResultGrade[]).forEach((item) => { (next[item.student_id] ??= []).push(item); });
      setGrades(next); setLoadingClass(false);
    }
    loadClass();
  }, [course, semester, selectedCourse, students]);

  const classStudents = useMemo(() => students.filter((item) => normalize(item.course) === normalize(course) && item.semester === Number(semester)), [students, course, semester]);
  const hasFailed = (studentId: string) => (grades[studentId] ?? []).some((item) => item.grade === "F");
  const statusOf = (studentId: string) => hasFailed(studentId) ? "Failed" : "Passed";

  function openEditor(student: Student) {
    const next: Record<string, Grade | ""> = {};
    subjects.forEach((subject) => {
      next[subject.id] = (grades[student.id] ?? []).find((item) => item.subject_id === subject.id)?.grade ?? "";
    });
    setDraft(next); setEditingStudent(student); setViewingStudent(null); setError("");
  }

  async function saveGrades() {
    if (!editingStudent || !course || !semester || !subjects.length) return;
    const rows = subjects.filter((subject) => draft[subject.id]).map((subject) => ({
      student_id: editingStudent.id, subject_id: subject.id, course, semester: Number(semester), grade: draft[subject.id], updated_at: new Date().toISOString(),
    }));
    if (!rows.length) { setError("Select at least one subject grade."); return; }
    setSaving(true); setError("");
    const result = await supabase.from("result_grades").upsert(rows, { onConflict: "student_id,subject_id,course,semester" }).select("id, student_id, subject_id, course, semester, grade, syllabus_subjects(id, subject_name, subject_code)");
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    setGrades((current) => ({ ...current, [editingStudent.id]: result.data as ResultGrade[] }));
    setSuccess(`Grades saved for ${editingStudent.name}.`); setEditingStudent(null); setSaving(false);
  }

  function generateReport() {
    if (!course || !semester || !classStudents.length) { setError("Select a course and semester with students first."); return; }
    const rows = classStudents.map((student, index) => {
      const studentGrades = subjects.map((subject) => (grades[student.id] ?? []).find((item) => item.subject_id === subject.id)?.grade ?? "-");
      const failed = studentGrades.includes("F");
      return `<tr class="${failed ? "failed" : ""}"><td>${index + 1}</td><td>${escapeHtml(student.registerNo)}</td><td class="name">${escapeHtml(student.name)}</td>${studentGrades.map((grade) => `<td>${grade}</td>`).join("")}<td>${failed ? "FAILED" : "PASSED"}</td></tr>`;
    }).join("");
    const subjectHead = subjects.map((subject) => `<th>${escapeHtml(subject.subject_name)}<br><span>(${escapeHtml(subject.subject_code)})</span></th>`).join("");
    const passed = classStudents.filter((student) => !hasFailed(student.id)).length;
    const failed = classStudents.length - passed;
    const reportWindow = window.open("", "_blank", "width=1500,height=950");
    if (!reportWindow) { setError("Please allow pop-ups to generate the report."); return; }
    reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Result Analysis - ${escapeHtml(course)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;900&display=swap" rel="stylesheet"><style>
      *{box-sizing:border-box} @page{size:A4 landscape;margin:8mm} body{margin:0;color:#172033;font-family:"Poppins",Arial,sans-serif;font-size:10px;font-weight:500} .frame{border:2px solid #202020;padding:5px;min-height:190mm}.title{text-align:center;font-size:20px;font-weight:900;border:1px solid #222;padding:10px;text-transform:uppercase}.meta{text-align:center;font-size:11px;font-weight:500;padding:6px;border:1px solid #222;border-top:0}.report{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:10px} th,td{border:1px solid #222;text-align:center;padding:6px 3px;font-weight:500;word-break:break-word} th{color:#071bb1;font-size:9px;line-height:1.1;height:62px} th:nth-child(2){width:9%} th:nth-child(3){width:18%;text-align:left} td.name{text-align:left;color:#071bb1} tbody tr.failed{background:#f7caca;color:#8f1717} tbody tr.failed td{border-color:#9f4a4a} tbody tr.failed td:last-child{color:#8f1717;font-weight:900} .summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px}.summary div{border:1px solid #222;padding:9px;text-align:center;font-weight:500}.summary strong{display:block;font-size:18px;margin-top:3px;font-weight:900}.signatures{display:flex;justify-content:space-between;margin-top:38px;font-weight:500}.subhead{margin-top:16px;text-align:center;color:#071bb1;font-size:13px;font-weight:500;text-transform:uppercase}@media print{.frame{min-height:auto}}
    </style></head><body><div class="frame"><div class="title">${escapeHtml(course)} ${semester === "1" ? "1st" : semester === "2" ? "2nd" : semester === "3" ? "3rd" : `${escapeHtml(semester)}th`} Semester Result Analysis</div><div class="meta">ROYAL COLLEGE OF ARTS AND SCIENCE THRITHALA &nbsp; | &nbsp; ${classStudents.length} STUDENTS</div><table class="report"><thead><tr><th>SL. NO.</th><th>REG NO.</th><th>NAME</th>${subjectHead}<th>PASSED / FAILED</th></tr></thead><tbody>${rows}</tbody></table><div class="subhead">Result Summary</div><div class="summary"><div>Total Students<strong>${classStudents.length}</strong></div><div>Passed Students<strong>${passed}</strong></div><div>Failed Students<strong>${failed}</strong></div></div><div class="signatures"><span>CLASS IN CHARGE</span><span>HOD</span><span>PRINCIPAL</span></div></div></body></html>`);
    reportWindow.document.close(); reportWindow.onload = () => { reportWindow.focus(); reportWindow.print(); };
  }

  if (!canView) return <PermissionDenied onBack={onBack} title="Result Access Restricted" />;

  return <div className="resultPage"><style jsx>{`
    .resultPage{min-height:100%;padding-bottom:40px;color:#2a2020;font-family:Poppins,Arial,sans-serif}.top{display:flex;justify-content:space-between;margin-bottom:22px}.eyebrow{color:#8d3333;font-size:10px;font-weight:800;letter-spacing:.14em}.hero{display:flex;justify-content:space-between;align-items:end;margin-bottom:22px}.hero h1{margin:8px 0 5px;color:#321b1b;font-size:34px;font-weight:800;letter-spacing:-.04em}.hero p{margin:0;color:#816f6f;font-size:13px}.heroBadge{display:flex;gap:12px;align-items:center;padding:12px 14px;border:1px solid #ead6d2;border-radius:15px;background:#fff7f5}.heroBadgeIcon{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:#8d3333;color:#fff}.heroBadge strong,.heroBadge span{display:block}.heroBadge strong{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#432424;font-size:12px}.heroBadge span{margin-top:3px;color:#967c79;font-size:10px}.alert{display:flex;gap:10px;align-items:center;margin-bottom:14px;padding:11px 13px;border-radius:12px;font-size:11px;font-weight:700}.alert.error{border:1px solid #efcaca;background:#fff5f5;color:#a12f2f}.alert.success{border:1px solid #d6e5cf;background:#f5faf2;color:#4d753e}.alert button{margin-left:auto;border:0;background:transparent;color:inherit;font-size:18px;cursor:pointer}.selector,.students{border:1px solid #eadbd7;border-radius:18px;background:#fff;box-shadow:0 8px 28px rgba(70,24,20,.055)}.selector{display:grid;grid-template-columns:270px 1fr;gap:24px;align-items:center;margin-bottom:18px;padding:18px}.selectorHead{display:flex;gap:12px;align-items:center}.selectorIcon{width:46px;height:46px;display:grid;place-items:center;border-radius:13px;background:#f8e9e5;color:#8d3333}.selector h2{margin:0;color:#3d2727;font-size:14px}.selector p{margin:4px 0 0;color:#927f7c;font-size:10px}.grid{display:grid;grid-template-columns:1fr .8fr 168px;gap:10px;align-items:end}.field{display:flex;flex-direction:column;gap:7px}.field>span{color:#806c69;font-size:9px;font-weight:800;letter-spacing:.09em}.select{position:relative}.select select{width:100%;height:43px;appearance:none;padding:0 34px 0 12px;border:1px solid #e2d7d3;border-radius:11px;background:#fffafa;color:#402b2b;font-size:11px;font-weight:700}.select b{position:absolute;right:12px;top:11px;color:#9b7975}.button{height:43px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #752525;border-radius:11px;background:#8d3333;color:#fff;font-size:10px;font-weight:800;cursor:pointer}.button:hover{background:#702525}.students{overflow:hidden}.studentsHead{display:flex;justify-content:space-between;align-items:center;padding:19px 20px;border-bottom:1px solid #eee1de;background:linear-gradient(135deg,#fff8f5,#f8eeec)}.label{margin-bottom:5px;color:#9a4b45;font-size:8px;font-weight:800;letter-spacing:.13em}.students h2{margin:0;color:#3d2525;font-size:18px}.studentsHead p{margin:4px 0 0;color:#927e7b;font-size:10px}.count{min-width:76px;padding:8px 12px;border:1px solid #ead1cc;border-radius:12px;background:#fff;text-align:center}.count strong{display:block;color:#8d3333;font-size:18px}.count span{font-size:7px;font-weight:800;color:#a18682}.scroll{overflow-x:auto}.table{width:100%;min-width:820px;border-collapse:collapse}.table th{padding:11px 14px;background:#422121;color:#fff;text-align:left;font-size:8px;letter-spacing:.1em}.table td{padding:12px 14px;border-bottom:1px solid #f0e8e6;color:#665653;font-size:11px}.table tr:nth-child(even){background:#fffafa}.no{text-align:center;width:54px}.student{display:flex;align-items:center;gap:10px;min-width:220px}.avatar{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#f7e7e3;color:#8d3333;font-weight:800}.student strong,.student span{display:block}.student strong{color:#422c2b;font-size:11px}.student span{margin-top:3px;color:#a38e8a;font-size:8px}.status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:800}.passed{background:#edf5e9;color:#4e783f}.failed{background:#ffe0e0;color:#ae2929}.actions{display:flex;gap:7px;justify-content:flex-end}.smallButton{min-height:33px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border-radius:9px;font-size:9px;font-weight:800;cursor:pointer}.view{border:1px solid #e2d8d5;background:#fff;color:#674f4c}.add{border:1px solid #752525;background:#8d3333;color:#fff}.empty{min-height:250px;display:grid;place-items:center;padding:36px;text-align:center;color:#967f7b;font-size:10px}.overlay{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;background:rgba(42,19,19,.48);backdrop-filter:blur(6px)}.modal{width:min(780px,100%);max-height:92vh;overflow:auto;border:1px solid #ead7d2;border-radius:20px;background:#fff;box-shadow:0 25px 70px rgba(50,15,15,.25)}.modalHead{display:flex;justify-content:space-between;gap:18px;padding:20px 22px;border-bottom:1px solid #eee0dd;background:#fff8f5}.modalHead h2{margin:0;color:#402525;font-size:19px}.modalHead p{margin:4px 0 0;color:#947e79;font-size:9px}.modalIcon{width:40px;height:40px;display:grid;place-items:center;float:left;margin-right:12px;border-radius:12px;background:#8d3333;color:#fff}.close{border:0;background:transparent;color:#806967;font-size:24px;cursor:pointer}.modalBody{padding:20px 22px}.gradeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.gradeField{display:flex;flex-direction:column;gap:6px;padding:11px;border:1px solid #eadbd7;border-radius:11px;background:#fffafa}.gradeField span{color:#725c59;font-size:9px;font-weight:800}.gradeField select{height:36px;border:1px solid #dfd0cc;border-radius:8px;background:#fff;color:#422c2c;font-weight:800}.foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px 18px;border-top:1px solid #eee0dd;background:#fffafa}.cancel{min-height:39px;padding:0 15px;border:1px solid #dfd3d0;border-radius:10px;background:#fff;color:#6f5e5a;font-weight:800}.marks{padding:15px 20px}.markRow{display:flex;justify-content:space-between;align-items:center;padding:11px 12px;border:1px solid #ebdfdc;border-radius:10px;margin-bottom:8px}.markRow span{display:block;color:#9a8581;font-size:9px}.markRow strong{display:block;color:#432929;font-size:12px}.viewMeta{padding:13px 20px;border-bottom:1px solid #eee1de;color:#896f6b;font-size:10px}
    @media(max-width:1050px){.selector{grid-template-columns:1fr}.grid{grid-template-columns:1fr 1fr 168px}}@media(max-width:700px){.hero{align-items:flex-start;flex-direction:column;gap:16px}.heroBadge{width:100%}.grid{grid-template-columns:1fr 1fr}.grid .button{grid-column:1/-1}.gradeGrid{grid-template-columns:1fr 1fr}}@media(max-width:520px){.selector{padding:14px}.grid{grid-template-columns:1fr}.grid .button{grid-column:auto}.studentsHead{align-items:flex-start;flex-direction:column;gap:12px}.count{width:100%}.actions{justify-content:flex-start}.overlay{padding:9px}.modalHead,.modalBody,.foot{padding-left:15px;padding-right:15px}.gradeGrid{grid-template-columns:1fr}}
  `}</style>
    <style jsx>{` .modal{border-radius:16px}.modalHead{padding:18px 20px;background:#fff9f7}.modalHead>div:first-child{display:grid;grid-template-columns:40px 1fr;column-gap:12px;align-items:center}.modalIcon{float:none;margin:0;grid-row:span 2}.modalHead h2{font-size:18px;line-height:1.2}.modalHead p{margin-top:3px}.modalBody{padding:20px}.gradeGrid{gap:12px}.gradeField{padding:12px;border-radius:12px;background:#fff;border-color:#ead8d4;box-shadow:0 3px 10px rgba(80,30,25,.04)}.gradeField span{min-height:28px;line-height:1.35}.gradeField select{height:40px;padding:0 10px;outline:0}.gradeField select:focus{border-color:#8d3333;box-shadow:0 0 0 3px rgba(141,51,51,.12)}.foot{padding:14px 20px 17px}.close{width:32px;height:32px;border-radius:9px;background:#fff1ed;font-size:20px}.close:hover{background:#f6ddd7}.button:disabled{opacity:.55;cursor:not-allowed}.cancel{cursor:pointer}.cancel:hover{background:#fff1ed}.table{min-width:0}.table th:nth-child(1),.table td:nth-child(1),.table th:nth-child(3),.table td:nth-child(3),.table th:nth-child(4),.table td:nth-child(4),.table th:nth-child(5),.table td:nth-child(5),.table th:nth-child(6),.table td:nth-child(6){display:none}.table th:nth-child(2),.table td:nth-child(2){width:auto}.table th:nth-child(7),.table td:nth-child(7){width:145px}.table td{padding:11px 10px}.student{min-width:0}@media(min-width:521px){.table{min-width:820px}.table th,.table td{display:table-cell}}`}</style>
    <div className="top"><BackToDashboard onBack={onBack} /><span className="eyebrow">ACADEMIC RESULTS</span></div>
    <header className="hero"><div><div className="eyebrow">RESULT ANALYSIS</div><h1>Result</h1><p>Enter subject grades and prepare the course result analysis.</p></div><div className="heroBadge"><div className="heroBadgeIcon"><Icon name="activity" size={23} /></div><div><strong>{course || "Class Selection"}</strong><span>{course && semester ? `Semester ${semester}` : "Select course & semester"}</span></div></div></header>
    {error && <div className="alert error"><Icon name="alert" size={16} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss">x</button></div>}
    {success && <div className="alert success"><Icon name="check" size={16} /><span>{success}</span><button onClick={() => setSuccess("")} aria-label="Dismiss">x</button></div>}
    <section className="selector"><div className="selectorHead"><div className="selectorIcon"><Icon name="clipboard" size={21} /></div><div><h2>Choose Student Group</h2><p>Select the course and semester to manage.</p></div></div><div className="grid"><label className="field"><span>COURSE</span><div className="select"><select value={course} onChange={(event) => setCourse(event.target.value)} disabled={loading}><option value="">Select course</option>{courses.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><b>v</b></div></label><label className="field"><span>SEMESTER</span><div className="select"><select value={semester} onChange={(event) => setSemester(event.target.value)} disabled={!course}><option value="">Select semester</option>{semesters.map((item) => <option key={item} value={item}>Semester {item}</option>)}</select><b>v</b></div></label><button className="button" onClick={generateReport} disabled={!course || !semester || loadingClass}><Icon name="file" size={16} /> Generate Report</button></div></section>
    <section className="students"><div className="studentsHead"><div><div className="label">STUDENT REGISTER</div><h2>{course && semester ? "Student Results" : "Students"}</h2><p>{course && semester ? `${course}  |  Semester ${semester}` : "Select a course and semester to load the register."}</p></div><div className="count"><strong>{classStudents.length}</strong><span>STUDENTS</span></div></div>{!course || !semester || loadingClass ? <div className="empty">{loadingClass ? "Loading students and grades..." : "Choose both course and semester to begin."}</div> : !classStudents.length ? <div className="empty">No students found for this course and semester.</div> : <div className="scroll"><table className="table"><thead><tr><th className="no">#</th><th>STUDENT</th><th>ADMISSION NO.</th><th>COURSE</th><th>SEMESTER</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{classStudents.map((student, index) => <tr key={student.id}><td className="no">{String(index + 1).padStart(2, "0")}</td><td><div className="student"><div className="avatar">{student.name.trim().charAt(0).toUpperCase() || "S"}</div><div><strong>{student.name}</strong><span>{(grades[student.id] ?? []).length} subject grades recorded</span></div></div></td><td>{student.admissionNo}</td><td>{student.course}</td><td>Sem {student.semester}</td><td><span className={`status ${hasFailed(student.id) ? "failed" : "passed"}`}>{statusOf(student.id)}</span></td><td><div className="actions"><button className="smallButton view" onClick={() => setViewingStudent(student)}><Icon name="eye" size={14} /> View</button>{canEdit && <button className="smallButton add" onClick={() => openEditor(student)}><Icon name="plus" size={14} /> Add</button>}</div></td></tr>)}</tbody></table></div>}</section>
    {editingStudent && <div className="overlay"><div className="modal"><div className="modalHead"><div><div className="modalIcon"><Icon name="plus" size={18} /></div><h2>Add Result Grades</h2><p>{editingStudent.name} | {editingStudent.admissionNo}</p></div><button className="close" onClick={() => setEditingStudent(null)} aria-label="Close">x</button></div><div className="modalBody"><div className="gradeGrid">{subjects.map((subject) => <label className="gradeField" key={subject.id}><span>{subject.subject_code} - {subject.subject_name}</span><select value={draft[subject.id] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [subject.id]: event.target.value as Grade | "" }))}><option value="">Select grade</option>{GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>)}</div>{!subjects.length && <div className="empty">No syllabus subjects found for this course and semester.</div>}</div><div className="foot"><button className="cancel" onClick={() => setEditingStudent(null)}>Cancel</button><button className="button" onClick={saveGrades} disabled={saving || !subjects.length}>{saving ? "Saving..." : "Save Grades"}</button></div></div></div>}
    {viewingStudent && <div className="overlay"><div className="modal"><div className="modalHead"><div><div className="modalIcon"><Icon name="eye" size={18} /></div><h2>Result Grades</h2><p>{viewingStudent.name} | {viewingStudent.admissionNo}</p></div><button className="close" onClick={() => setViewingStudent(null)} aria-label="Close">x</button></div><div className="viewMeta">{course} | Semester {semester} | <strong className={hasFailed(viewingStudent.id) ? "failed" : "passed"}>{statusOf(viewingStudent.id)}</strong></div><div className="marks">{subjects.map((subject) => { const item = (grades[viewingStudent.id] ?? []).find((grade) => grade.subject_id === subject.id); return <div className="markRow" key={subject.id}><div><strong>{subject.subject_name}</strong><span>{subject.subject_code}</span></div><strong>{item?.grade ?? "Not added"}</strong></div>; })}</div><div className="foot"><button className="cancel" onClick={() => setViewingStudent(null)}>Close</button>{canEdit && <button className="button" onClick={() => openEditor(viewingStudent)}><Icon name="plus" size={14} /> Edit Grades</button>}</div></div></div>}
  </div>;
}
