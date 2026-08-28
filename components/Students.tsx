"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import { AppUser, hasPermission } from "@/lib/permissions";
import Icon from "./Icon";
import StatusBadge from "./ui/StatusBadge";
import SummaryCard from "./ui/SummaryCard";

import { supabase } from "@/lib/supabase";

type StudentStatus = "Active" | "Inactive";

type Student = {
  id?: string;
  regNo: string;
  name: string;
  course: string;
  capId: string;
  admissionNo: string;
  semester: number;
  status: StudentStatus;
};

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const VALID_COURSES = [
  "B.A English",
  "B.Com Co-op",
  "B.Com CA",
  "BBA Finance",
];

const COURSE_LABELS: Record<string, string> = {
  "B.A English": "B.A English",
  "B.Com Co-op": "B.Com Co-operation",
  "B.Com CA": "B.Com Computer Application",
  "BBA Finance": "BBA Finance",
};

const COURSES = ["All Courses", ...VALID_COURSES];

/* ============================================================
   HELPERS
============================================================ */

function clean(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCourse(value: unknown): string {
  const raw = clean(value)
    .toUpperCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "";

  if (
    raw.includes("ENGLISH") &&
    (raw.includes("BA") || raw.includes("B A"))
  ) {
    return "B.A English";
  }

  if (
    (raw.includes("BCOM") || raw.includes("B COM")) &&
    (
      raw.includes("CO OPERATION") ||
      raw.includes("COOPERATIVE") ||
      raw.includes("CO OPERATIVE") ||
      raw.includes("COOPERATION") ||
      raw.includes("CO OP")
    )
  ) {
    return "B.Com Co-op";
  }

  if (
    (raw.includes("BCOM") || raw.includes("B COM")) &&
    (
      raw.includes("COMPUTER APPLICATION") ||
      raw.includes("COMPUTER APPL") ||
      raw.includes("COMPUTER APP")
    )
  ) {
    return "B.Com CA";
  }

  if (
    raw.includes("BBA") &&
    raw.includes("FINANCE")
  ) {
    return "BBA Finance";
  }

  return clean(value);
}

function normalizeSemester(value: unknown): number {
  const numeric = Number(value);

  if (
    Number.isInteger(numeric) &&
    numeric >= 1 &&
    numeric <= 8
  ) {
    return numeric;
  }

  return 1;
}

function normalizeStatus(value: unknown): StudentStatus {
  return clean(value).toLowerCase() === "inactive"
    ? "Inactive"
    : "Active";
}

function getNextSemester(semester: number): number | null {
  return semester >= 8 ? null : semester + 1;
}

function semesterLabel(semester: number): string {
  return `Semester ${semester}`;
}

function findHeaderIndex(
  headers: string[],
  patterns: string[],
): number {
  return headers.findIndex((header) => {
    const normalized = header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    return patterns.some((pattern) =>
      normalized.includes(pattern),
    );
  });
}

/* ============================================================
   COMPONENT
============================================================ */

export default function Students({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const [students, setStudents] = useState<Student[]>([]);

  const [
    selectedSemester,
    setSelectedSemester,
  ] = useState(1);

  const [course, setCourse] = useState("All Courses");

  const [status, setStatus] = useState("All Statuses");

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);

  const [importing, setImporting] = useState(false);

  const [promoting, setPromoting] = useState(false);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  /* ==========================================================
     VIEW / EDIT / DELETE STATE
  ========================================================== */

  const [
    selectedStudent,
    setSelectedStudent,
  ] = useState<Student | null>(null);

  const [
    editingStudent,
    setEditingStudent,
  ] = useState<Student | null>(null);

  const [
    savingStudent,
    setSavingStudent,
  ] = useState(false);

  const [
    deletingStudentId,
    setDeletingStudentId,
  ] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  /* ==========================================================
     MESSAGES
  ========================================================== */

  function showSuccess(text: string) {
    setMessage(text);
    setMessageType("success");
  }

  function showError(text: string) {
    setMessage(text);
    setMessageType("error");
  }

  function clearMessage() {
    setMessage("");
    setMessageType("");
  }

  /* ==========================================================
     LOAD STUDENTS
  ========================================================== */

  async function loadStudents() {
    try {
      setLoading(true);
      clearMessage();

      const { data, error } = await supabase
        .from("students")
        .select(
          `
            id,
            reg_no,
            name,
            course,
            cap_id,
            admission_no,
            semester,
            status
          `,
        )
        .order("name", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const mapped: Student[] = (data ?? []).map(
        (row: any) => ({
          id: row.id,

          regNo: clean(row.reg_no),

          name: clean(row.name),

          course: normalizeCourse(row.course),

          capId: clean(row.cap_id),

          admissionNo: clean(
            row.admission_no,
          ).toUpperCase(),

          semester: normalizeSemester(
            row.semester,
          ),

          status: normalizeStatus(
            row.status,
          ),
        }),
      );

      setStudents(mapped);
    } catch (error) {
      console.error(
        "Students load error:",
        error,
      );

      showError(
        "Unable to load students from Supabase.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  /* ==========================================================
     FILTERED STUDENTS
  ========================================================== */

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return students.filter((student) => {
      const semesterMatch =
        student.semester === selectedSemester;

      const courseMatch =
        course === "All Courses" ||
        student.course === course;

      const statusMatch =
        status === "All Statuses" ||
        student.status === status;

      const searchable = [
        student.name,
        student.regNo,
        student.course,
        student.capId,
        student.admissionNo,
        semesterLabel(student.semester),
      ]
        .join(" ")
        .toLowerCase();

      const searchMatch =
        !search ||
        searchable.includes(search);

      return (
        semesterMatch &&
        courseMatch &&
        statusMatch &&
        searchMatch
      );
    });
  }, [
    students,
    selectedSemester,
    course,
    status,
    query,
  ]);

  /* ==========================================================
     COURSE COUNT
  ========================================================== */

  function studentCount(courseName: string) {
    return students.filter(
      (student) =>
        student.semester === selectedSemester &&
        student.course === courseName,
    ).length;
  }

  /* ==========================================================
     PROMOTION
  ========================================================== */

  async function promoteSelectedSemester() {
    if (
      !hasPermission(
        user,
        "students.edit",
      )
    ) {
      return;
    }

    clearMessage();

    const nextSemester =
      getNextSemester(
        selectedSemester,
      );

    if (!nextSemester) {
      showError(
        "Semester 8 is the final semester. Students cannot be promoted further.",
      );

      return;
    }

    const studentsToPromote =
      students.filter(
        (student) => {
          const semesterMatch =
            student.semester ===
            selectedSemester;

          const courseMatch =
            course === "All Courses" ||
            student.course ===
              course;

          const statusMatch =
            student.status ===
            "Active";

          return (
            semesterMatch &&
            courseMatch &&
            statusMatch
          );
        },
      );

    if (
      !studentsToPromote.length
    ) {
      showError(
        `No active students found in ${semesterLabel(
          selectedSemester,
        )}.`,
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Promote ${studentsToPromote.length} active students from ${semesterLabel(
          selectedSemester,
        )} to ${semesterLabel(
          nextSemester,
        )}?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setPromoting(true);

      let queryBuilder =
        supabase
          .from("students")
          .update({
            semester:
              nextSemester,
          })
          .eq(
            "semester",
            selectedSemester,
          )
          .eq(
            "status",
            "Active",
          );

      if (
        course !== "All Courses"
      ) {
        queryBuilder =
          queryBuilder.eq(
            "course",
            course,
          );
      }

      const { error } =
        await queryBuilder;

      if (error) {
        throw error;
      }

      await loadStudents();

      showSuccess(
        `${studentsToPromote.length} students promoted to ${semesterLabel(
          nextSemester,
        )}.`,
      );
    } catch (error: any) {
      console.error(
        "Promotion error:",
        error,
      );

      showError(
        error?.message ??
          "Unable to promote students.",
      );
    } finally {
      setPromoting(false);
    }
  }

  /* ==========================================================
     OPEN STUDENT VIEW
  ========================================================== */

  function openStudentView(
    student: Student,
  ) {
    setEditingStudent(null);

    setSelectedStudent({
      ...student,
    });
  }

  /* ==========================================================
     UPDATE STUDENT
  ========================================================== */

  async function updateStudent() {
    if (!editingStudent?.id) {
      showError(
        "Student ID is missing.",
      );

      return;
    }

    if (
      !hasPermission(
        user,
        "students.edit",
      )
    ) {
      showError(
        "You do not have permission to edit students.",
      );

      return;
    }

    const name =
      editingStudent.name.trim();

    const admissionNo =
      editingStudent.admissionNo
        .trim()
        .toUpperCase();

    if (!name) {
      showError(
        "Student name is required.",
      );

      return;
    }

    if (!admissionNo) {
      showError(
        "Admission number is required.",
      );

      return;
    }

    const semester =
      normalizeSemester(
        editingStudent.semester,
      );

    try {
      setSavingStudent(true);
      clearMessage();

      const { error } =
        await supabase
          .from("students")
          .update({
            reg_no:
              editingStudent.regNo.trim() ||
              null,

            name,

            course:
              editingStudent.course,

            cap_id:
              editingStudent.capId.trim() ||
              null,

            admission_no:
              admissionNo,

            semester,

            status:
              editingStudent.status,
          })
          .eq(
            "id",
            editingStudent.id,
          );

      if (error) {
        throw error;
      }

      await loadStudents();

      setSelectedStudent(null);

      setEditingStudent(null);

      showSuccess(
        `${name} was updated successfully.`,
      );
    } catch (error: any) {
      console.error(
        "Student update error:",
        error,
      );

      showError(
        error?.message ??
          "Unable to update student.",
      );
    } finally {
      setSavingStudent(false);
    }
  }

  /* ==========================================================
     DELETE STUDENT
  ========================================================== */

  async function deleteStudent(
    student: Student,
  ) {
    if (!student.id) {
      showError(
        "Student ID is missing.",
      );

      return;
    }

    if (
      !hasPermission(
        user,
        "students.delete",
      )
    ) {
      showError(
        "You do not have permission to delete students.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${student.name}" permanently?\n\nThis action cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingStudentId(
        student.id,
      );

      clearMessage();

      const { error } =
        await supabase
          .from("students")
          .delete()
          .eq(
            "id",
            student.id,
          );

      if (error) {
        throw error;
      }

      setSelectedStudent(null);

      setEditingStudent(null);

      await loadStudents();

      showSuccess(
        `${student.name} was deleted successfully.`,
      );
    } catch (error: any) {
      console.error(
        "Student delete error:",
        error,
      );

      showError(
        error?.message ??
          "Unable to delete student.",
      );
    } finally {
      setDeletingStudentId(null);
    }
  }

  /* ==========================================================
     EXPORT EXCEL
  ========================================================== */

  function exportExcel() {
    if (!filtered.length) {
      showError(
        "No students available to export.",
      );

      return;
    }

    const rows =
      filtered.map(
        (student) => ({
          "Reg No":
            student.regNo,

          "Student Name":
            student.name,

          Course:
            COURSE_LABELS[
              student.course
            ] ??
            student.course,

          "CAP ID":
            student.capId,

          "Admission No":
            student.admissionNo,

          Semester:
            semesterLabel(
              student.semester,
            ),

          Status:
            student.status,
        }),
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows,
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Students",
    );

    XLSX.writeFile(
      workbook,
      `royal-college-semester-${selectedSemester}.xlsx`,
    );
  }

  /* ==========================================================
     IMPORT EXCEL
  ========================================================== */

  function importExcel(file: File) {
    if (
      !hasPermission(
        user,
        "students.create",
      )
    ) {
      showError(
        "You do not have permission to import students.",
      );

      return;
    }

    const reader =
      new FileReader();

    reader.onload = async (
      event,
    ) => {
      try {
        setImporting(true);
        clearMessage();

        const result =
          event.target?.result;

        if (!result) {
          throw new Error(
            "Unable to read Excel file.",
          );
        }

        const workbook =
          XLSX.read(
            new Uint8Array(
              result as ArrayBuffer,
            ),
            {
              type: "array",
              cellDates: false,
              raw: false,
            },
          );

        if (
          !workbook.SheetNames.length
        ) {
          throw new Error(
            "No worksheet found.",
          );
        }

        const worksheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        const matrix =
          XLSX.utils.sheet_to_json<
            unknown[]
          >(worksheet, {
            header: 1,
            defval: "",
            raw: false,
          });

        if (!matrix.length) {
          throw new Error(
            "Excel file is empty.",
          );
        }

        /* ------------------------------------------------------
           FIND HEADER ROW
        ------------------------------------------------------ */

        let headerRowIndex = -1;

        for (
          let i = 0;
          i < Math.min(
            matrix.length,
            40,
          );
          i++
        ) {
          const row =
            matrix[i] ?? [];

          const text =
            row
              .map((cell) =>
                clean(cell),
              )
              .join(" ")
              .toLowerCase();

          if (
            (
              text.includes(
                "admission",
              ) ||
              text.includes(
                "admno",
              )
            ) &&
            (
              text.includes(
                "student",
              ) ||
              text.includes(
                "name",
              )
            )
          ) {
            headerRowIndex = i;
            break;
          }
        }

        if (
          headerRowIndex === -1
        ) {
          headerRowIndex = 0;
        }

        const headerRow =
          (
            matrix[
              headerRowIndex
            ] ?? []
          ).map((cell) =>
            clean(cell),
          );

        const normalizedHeaders =
          headerRow.map(
            (header) =>
              header
                .toLowerCase()
                .replace(
                  /[^a-z0-9]+/g,
                  " ",
                )
                .trim(),
          );

        /* ------------------------------------------------------
           FIND COLUMNS
        ------------------------------------------------------ */

        const admissionHeaderIndex =
          findHeaderIndex(
            normalizedHeaders,
            [
              "admission no",
              "admission number",
              "adm no",
              "admno",
            ],
          );

        const capHeaderIndex =
          findHeaderIndex(
            normalizedHeaders,
            [
              "cap id",
              "capid",
              "enroll no",
              "enroll number",
              "enrollment no",
              "enrollment number",
            ],
          );

        const regHeaderIndex =
          findHeaderIndex(
            normalizedHeaders,
            [
              "reg no",
              "regno",
              "register no",
              "register number",
              "registration no",
              "registration number",
            ],
          );

        const nameHeaderIndex =
          findHeaderIndex(
            normalizedHeaders,
            [
              "student name",
              "student",
              "name",
            ],
          );

        const courseHeaderIndex =
          findHeaderIndex(
            normalizedHeaders,
            [
              "course",
              "programme",
              "program",
            ],
          );

        const statusHeaderIndex =
          findHeaderIndex(
            normalizedHeaders,
            ["status"],
          );

        /*
         * Semester is intentionally NOT read from Excel.
         * Selected UI semester is used.
         */

        const admissionIndex =
          admissionHeaderIndex >= 0
            ? admissionHeaderIndex
            : 3;

        const capIndex =
          capHeaderIndex >= 0
            ? capHeaderIndex
            : 9;

        const regIndex =
          regHeaderIndex >= 0
            ? regHeaderIndex
            : -1;

        const nameIndex =
          nameHeaderIndex >= 0
            ? nameHeaderIndex
            : 17;

        const courseIndex =
          courseHeaderIndex >= 0
            ? courseHeaderIndex
            : 24;

        const statusIndex =
          statusHeaderIndex >= 0
            ? statusHeaderIndex
            : -1;

        /* ------------------------------------------------------
           PARSE STUDENTS
        ------------------------------------------------------ */

        const imported: Student[] =
          [];

        for (
          let i =
            headerRowIndex + 1;
          i < matrix.length;
          i++
        ) {
          const row =
            matrix[i] ?? [];

          const admissionNo =
            clean(
              row[
                admissionIndex
              ],
            ).toUpperCase();

          const capId =
            clean(
              row[capIndex],
            );

          const regNo =
            regIndex >= 0
              ? clean(
                  row[regIndex],
                )
              : "";

          const name =
            clean(
              row[nameIndex],
            );

          const rawCourse =
            clean(
              row[courseIndex],
            );

          const rawStatus =
            statusIndex >= 0
              ? row[statusIndex]
              : "Active";

          if (
            !admissionNo &&
            !name
          ) {
            continue;
          }

          if (
            !admissionNo ||
            !name
          ) {
            continue;
          }

          const normalizedCourse =
            normalizeCourse(
              rawCourse,
            );

          if (
            !VALID_COURSES.includes(
              normalizedCourse,
            )
          ) {
            continue;
          }

          imported.push({
            regNo,

            name,

            course:
              normalizedCourse,

            capId,

            admissionNo,

            semester:
              selectedSemester,

            status:
              normalizeStatus(
                rawStatus,
              ),
          });
        }

        if (!imported.length) {
          throw new Error(
            "No valid students found in this Excel file.",
          );
        }

        /* ------------------------------------------------------
           COURSE FILTER
        ------------------------------------------------------ */

        let studentsToImport =
          imported;

        let skippedCount = 0;

        if (
          course !==
          "All Courses"
        ) {
          studentsToImport =
            imported.filter(
              (student) =>
                student.course ===
                course,
            );

          skippedCount =
            imported.length -
            studentsToImport.length;

          if (
            !studentsToImport.length
          ) {
            throw new Error(
              `No "${
                COURSE_LABELS[
                  course
                ] ?? course
              }" students found in this Excel file.`,
            );
          }
        }

        /* ------------------------------------------------------
           DATABASE ROWS
        ------------------------------------------------------ */

        const rows =
          studentsToImport.map(
            (student) => ({
              reg_no:
                student.regNo ||
                null,

              name:
                student.name,

              course:
                student.course,

              cap_id:
                student.capId ||
                null,

              admission_no:
                student.admissionNo,

              semester:
                Number(
                  selectedSemester,
                ),

              status:
                student.status,
            }),
          );

        /* ------------------------------------------------------
           INSERT
        ------------------------------------------------------ */

        const { error } =
          await supabase
            .from("students")
            .insert(rows);

        if (error) {
          if (
            error.code ===
              "23505" ||
            error.message
              ?.toLowerCase()
              .includes(
                "duplicate",
              )
          ) {
            throw new Error(
              "One or more Admission No values already exist. Remove duplicate rows from Excel.",
            );
          }

          throw error;
        }

        await loadStudents();

        showSuccess(
          `${studentsToImport.length} students added to ${semesterLabel(
            selectedSemester,
          )}${
            skippedCount
              ? ` • ${skippedCount} rows skipped`
              : ""
          }. Excel semester values were ignored.`,
        );

        if (
          fileRef.current
        ) {
          fileRef.current.value =
            "";
        }
      } catch (error: any) {
        console.error(
          "Excel import error:",
          error,
        );

        showError(
          error?.message ??
            "Excel import failed.",
        );
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      setImporting(false);

      showError(
        "Unable to read Excel file.",
      );
    };

    reader.readAsArrayBuffer(
      file,
    );
  }

  /* ==========================================================
     FILE CHANGE
  ========================================================== */

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    importExcel(file);
  }

  /* ==========================================================
     PERMISSION CHECK
  ========================================================== */

  if (
    !hasPermission(
      user,
      "students.view",
    )
  ) {
    return (
      <PermissionDenied
        onBack={onBack}
      />
    );
  }

  /* ==========================================================
     DERIVED VALUES
  ========================================================== */

  const currentSemesterStudentCount =
    students.filter(
      (student) =>
        student.semester ===
        selectedSemester,
    ).length;

  const nextSemester =
    getNextSemester(
      selectedSemester,
    );

  const selectedCourseText =
    course === "All Courses"
      ? "All Courses"
      : COURSE_LABELS[
          course
        ] ?? course;

  /* ==========================================================
     RETURN
  ========================================================== */

  return (
    <div className="professionalModule studentsModule">

      <BackToDashboard
        onBack={onBack}
      />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="moduleHeader professionalHeader">

        <div>

          <div className="moduleKicker">

            <Icon
              name="users"
              size={17}
            />

            Students

          </div>

          <h1>
            Student Management
          </h1>

          <p>
            Manage students by semester and course.
          </p>

        </div>

        <div className="headerButtons">

          <button
            type="button"
            className="secondaryButton"
            onClick={() =>
              fileRef.current?.click()
            }
            disabled={
              importing ||
              promoting ||
              !hasPermission(
                user,
                "students.create",
              )
            }
          >

            <Icon
              name="file"
              size={17}
            />

            {importing
              ? "Importing..."
              : `Import ${semesterLabel(
                  selectedSemester,
                )}`}

          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={
              handleFileChange
            }
          />

          <button
            type="button"
            className="secondaryButton"
            onClick={
              promoteSelectedSemester
            }
            disabled={
              importing ||
              promoting ||
              !hasPermission(
                user,
                "students.edit",
              ) ||
              !nextSemester ||
              currentSemesterStudentCount ===
                0
            }
          >

            <Icon
              name="arrow"
              size={17}
            />

            {promoting
              ? "Promoting..."
              : !nextSemester
                ? "Final Semester"
                : `Promote ${
                    selectedCourseText
                  } → ${semesterLabel(
                    nextSemester,
                  )}`}

          </button>

          <button
            type="button"
            className="primaryButton"
            onClick={
              exportExcel
            }
            disabled={
              loading ||
              !filtered.length
            }
          >

            <Icon
              name="download"
              size={17}
            />

            Export Excel

          </button>

        </div>

      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div
          className={
            messageType ===
            "success"
              ? "importMessage success"
              : "importMessage error"
          }
        >

          <span>
            {message}
          </span>

          <button
            type="button"
            onClick={
              clearMessage
            }
          >
            ×
          </button>

        </div>
      )}

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <section
        className="summaryGrid studentSummaryGrid"
        style={{
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
        }}
      >

        <SummaryCard
          label={`${semesterLabel(
            selectedSemester,
          )} Students`}
          value={
            currentSemesterStudentCount
          }
          icon="users"
        />

        <SummaryCard
          label="B.A English"
          value={studentCount(
            "B.A English",
          )}
          icon="graduation"
          tone="primary"
        />

        <SummaryCard
          label="B.Com Co-operation"
          value={studentCount(
            "B.Com Co-op",
          )}
          icon="book"
        />

        <SummaryCard
          label="B.Com Computer Application"
          value={studentCount(
            "B.Com CA",
          )}
          icon="activity"
        />

        <SummaryCard
          label="BBA Finance"
          value={studentCount(
            "BBA Finance",
          )}
          icon="graduation"
        />

      </section>

      {/* ======================================================
          COURSE FILTER
      ====================================================== */}

      <div className="segmentedFilters">

        {[
          [
            "All Courses",
            "All Courses",
          ],
          [
            "B.A English",
            "B.A English",
          ],
          [
            "B.Com Co-op",
            "B.Com Co-op",
          ],
          [
            "B.Com CA",
            "B.Com CA",
          ],
          [
            "BBA Finance",
            "BBA Finance",
          ],
        ].map(
          ([value, label]) => (
            <button
              type="button"
              key={value}
              className={
                course === value
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCourse(
                  value,
                )
              }
            >
              {label}
            </button>
          ),
        )}

      </div>

      {/* ======================================================
          FILTER BAR
      ====================================================== */}

      <section className="professionalToolbar">

        <div
          className="studentSearch professionalSearch"
          style={{
            flex: 1,
          }}
        >

          <Icon
            name="search"
            size={18}
          />

          <input
            value={query}
            onChange={(
              event,
            ) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Search name, admission no, CAP ID..."
          />

        </div>

        <select
          value={String(
            selectedSemester,
          )}
          onChange={(
            event,
          ) => {
            const value =
              Number(
                event.target
                  .value,
              );

            if (
              value >= 1 &&
              value <= 8
            ) {
              setSelectedSemester(
                value,
              );
            }
          }}
        >

          {SEMESTERS.map(
            (semester) => (
              <option
                key={semester}
                value={semester}
              >
                {semesterLabel(
                  semester,
                )}
              </option>
            ),
          )}

        </select>

        <select
          value={course}
          onChange={(
            event,
          ) =>
            setCourse(
              event.target
                .value,
            )
          }
        >

          {COURSES.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item ===
                "All Courses"
                  ? item
                  : COURSE_LABELS[
                      item
                    ] ?? item}
              </option>
            ),
          )}

        </select>

        <select
          value={status}
          onChange={(
            event,
          ) =>
            setStatus(
              event.target
                .value,
            )
          }
        >

          <option value="All Statuses">
            All Statuses
          </option>

          <option value="Active">
            Active
          </option>

          <option value="Inactive">
            Inactive
          </option>

        </select>

        <span className="resultCount">
          {loading
            ? "Loading..."
            : `${filtered.length} students`}
        </span>

      </section>

      {/* ======================================================
          STUDENT TABLE
      ====================================================== */}

      <section className="professionalTableCard">

        <div className="tableHeader professionalTableHeader">

          <div>

            <h2>
              {semesterLabel(
                selectedSemester,
              )}{" "}
              Student Directory
            </h2>

            <p>
              Live student data from Supabase.
            </p>

          </div>

          <span className="resultCount">
            {filtered.length} students
          </span>

        </div>

        {loading ? (

          <div className="emptyState">

            <Icon
              name="users"
              size={28}
            />

            <h3>
              Loading students...
            </h3>

            <p>
              Fetching live records.
            </p>

          </div>

        ) : filtered.length ? (

          <>

            {/* ==================================================
                DESKTOP TABLE
            ================================================== */}

            <div className="tableScroll studentTableScroll">

              <table className="professionalTable studentTable">

                <thead>

                  <tr>

                    <th>
                      REG. NO
                    </th>

                    <th>
                      STUDENT
                    </th>

                    <th>
                      COURSE
                    </th>

                    <th>
                      CAP ID
                    </th>

                    <th>
                      ADMISSION NO
                    </th>

                    <th>
                      SEMESTER
                    </th>

                    <th>
                      STATUS
                    </th>

                    <th>
                      ACTION
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filtered.map(
                    (student) => (

                      <tr
                        key={
                          student.id ??
                          student.admissionNo
                        }
                      >

                        <td className="mono">
                          {
                            student.regNo ||
                            "—"
                          }
                        </td>

                        <td className="studentName">
                          {
                            student.name
                          }
                        </td>

                        <td>
                          {
                            COURSE_LABELS[
                              student.course
                            ] ??
                            student.course
                          }
                        </td>

                        <td className="mono">
                          {
                            student.capId ||
                            "—"
                          }
                        </td>

                        <td className="mono">
                          {
                            student.admissionNo
                          }
                        </td>

                        <td>
                          {semesterLabel(
                            student.semester,
                          )}
                        </td>

                        <td>

                          <StatusBadge
                            status={
                              student.status
                            }
                          />

                        </td>

                        <td>

                          <button
                            type="button"
                            className="tableAction"
                            onClick={(
                              event,
                            ) => {

                              event.preventDefault();
                              event.stopPropagation();

                              openStudentView(
                                student,
                              );

                            }}
                          >

                            <Icon
                              name="eye"
                              size={15}
                            />

                            View

                          </button>

                        </td>

                      </tr>

                    ),
                  )}

                </tbody>

              </table>

            </div>

            {/* ==================================================
                MOBILE STUDENT CARDS
            ================================================== */}

            <div className="studentMobileList">

              {filtered.map(
                (student) => (

                  <article
                    key={
                      student.id ??
                      student.admissionNo
                    }
                    className="studentMobileCard"
                  >

                    <div>

                      <strong>
                        {
                          student.name
                        }
                      </strong>

                      <span className="mono">
                        {
                          student.admissionNo
                        }
                      </span>

                    </div>

                    <StatusBadge
                      status={
                        student.status
                      }
                    />

                    <dl>

                      <div>

                        <dt>
                          Course
                        </dt>

                        <dd>
                          {
                            COURSE_LABELS[
                              student.course
                            ] ??
                            student.course
                          }
                        </dd>

                      </div>

                      <div>

                        <dt>
                          CAP ID
                        </dt>

                        <dd>
                          {
                            student.capId ||
                            "—"
                          }
                        </dd>

                      </div>

                      <div>

                        <dt>
                          Semester
                        </dt>

                        <dd>
                          {semesterLabel(
                            student.semester,
                          )}
                        </dd>

                      </div>

                    </dl>

                    <button
                      type="button"
                      className="tableAction"
                      onClick={(
                        event,
                      ) => {

                        event.preventDefault();
                        event.stopPropagation();

                        openStudentView(
                          student,
                        );

                      }}
                    >

                      <Icon
                        name="eye"
                        size={15}
                      />

                      View

                    </button>

                  </article>

                ),
              )}

            </div>

          </>

        ) : (

          <div className="emptyState">

            <Icon
              name="users"
              size={28}
            />

            <h3>
              No students found
            </h3>

            <p>
              No students match the selected semester and course.
            </p>

            <button
              type="button"
              className="primaryButton"
              onClick={() =>
                fileRef.current?.click()
              }
              disabled={
                !hasPermission(
                  user,
                  "students.create",
                )
              }
            >
              Import Excel
            </button>

          </div>

        )}

      </section>

      {/* ======================================================
          STUDENT VIEW MODAL
      ====================================================== */}

      {selectedStudent && (

        <div
          className="studentModalOverlay"
          onMouseDown={(
            event,
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedStudent(
                null,
              );
            }

          }}
        >

          <div
            className="studentModal"
            onMouseDown={(
              event,
            ) => {
              event.stopPropagation();
            }}
          >

            <div className="studentModalHeader">

              <div>

                <span className="studentModalEyebrow">
                  STUDENT PROFILE
                </span>

                <h2>
                  {
                    selectedStudent.name
                  }
                </h2>

                <p>
                  Admission No:{" "}
                  {
                    selectedStudent.admissionNo
                  }
                </p>

              </div>

              <button
                type="button"
                className="studentModalClose"
                onClick={() =>
                  setSelectedStudent(
                    null,
                  )
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>

            <div className="studentDetailsGrid">

              <div className="studentDetailItem">

                <span>
                  REGISTRATION NO
                </span>

                <strong>
                  {
                    selectedStudent.regNo ||
                    "—"
                  }
                </strong>

              </div>

              <div className="studentDetailItem">

                <span>
                  ADMISSION NO
                </span>

                <strong>
                  {
                    selectedStudent.admissionNo
                  }
                </strong>

              </div>

              <div className="studentDetailItem">

                <span>
                  STUDENT NAME
                </span>

                <strong>
                  {
                    selectedStudent.name
                  }
                </strong>

              </div>

              <div className="studentDetailItem">

                <span>
                  CAP ID
                </span>

                <strong>
                  {
                    selectedStudent.capId ||
                    "—"
                  }
                </strong>

              </div>

              <div className="studentDetailItem">

                <span>
                  COURSE
                </span>

                <strong>
                  {
                    COURSE_LABELS[
                      selectedStudent.course
                    ] ??
                    selectedStudent.course
                  }
                </strong>

              </div>

              <div className="studentDetailItem">

                <span>
                  SEMESTER
                </span>

                <strong>
                  {semesterLabel(
                    selectedStudent.semester,
                  )}
                </strong>

              </div>

              <div className="studentDetailItem">

                <span>
                  STATUS
                </span>

                <StatusBadge
                  status={
                    selectedStudent.status
                  }
                />

              </div>

            </div>

            <div className="studentModalActions">

              <button
                type="button"
                className="secondaryButton"
                onClick={() => {

                  if (
                    !hasPermission(
                      user,
                      "students.edit",
                    )
                  ) {

                    showError(
                      "You do not have permission to edit students.",
                    );

                    return;

                  }

                  setEditingStudent({
                    ...selectedStudent,
                  });

                  setSelectedStudent(
                    null,
                  );

                }}
                disabled={
                  !hasPermission(
                    user,
                    "students.edit",
                  )
                }
              >

                <Icon
                  name="edit"
                  size={16}
                />

                Edit Student

              </button>

              <button
                type="button"
                className="dangerButton"
                onClick={() =>
                  deleteStudent(
                    selectedStudent,
                  )
                }
                disabled={
                  deletingStudentId ===
                    selectedStudent.id ||
                  !hasPermission(
                    user,
                    "students.delete",
                  )
                }
              >

                <Icon
                  name="trash"
                  size={16}
                />

                {deletingStudentId ===
                selectedStudent.id
                  ? "Deleting..."
                  : "Delete Student"}

              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          EDIT STUDENT MODAL
      ====================================================== */}

      {editingStudent && (

        <div
          className="studentModalOverlay"
          onMouseDown={(
            event,
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {

              setEditingStudent(
                null,
              );

            }

          }}
        >

          <div
            className="studentModal editStudentModal"
            onMouseDown={(
              event,
            ) => {
              event.stopPropagation();
            }}
          >

            <div className="studentModalHeader">

              <div>

                <span className="studentModalEyebrow">
                  EDIT STUDENT
                </span>

                <h2>
                  Student Details
                </h2>

                <p>
                  Update student information.
                </p>

              </div>

              <button
                type="button"
                className="studentModalClose"
                onClick={() =>
                  setEditingStudent(
                    null,
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="studentEditGrid">

              <label>

                <span>
                  Registration No
                </span>

                <input
                  type="text"
                  value={
                    editingStudent.regNo
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditingStudent({
                      ...editingStudent,
                      regNo:
                        event.target
                          .value,
                    })
                  }
                />

              </label>

              <label>

                <span>
                  Student Name
                </span>

                <input
                  type="text"
                  value={
                    editingStudent.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditingStudent({
                      ...editingStudent,
                      name:
                        event.target
                          .value,
                    })
                  }
                />

              </label>

              <label>

                <span>
                  Admission No
                </span>

                <input
                  type="text"
                  value={
                    editingStudent.admissionNo
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditingStudent({
                      ...editingStudent,
                      admissionNo:
                        event.target.value.toUpperCase(),
                    })
                  }
                />

              </label>

              <label>

                <span>
                  CAP ID
                </span>

                <input
                  type="text"
                  value={
                    editingStudent.capId
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditingStudent({
                      ...editingStudent,
                      capId:
                        event.target
                          .value,
                    })
                  }
                />

              </label>

              <label>

                <span>
                  Course
                </span>

                <select
                  value={
                    editingStudent.course
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditingStudent({
                      ...editingStudent,
                      course:
                        event.target
                          .value,
                    })
                  }
                >

                  {VALID_COURSES.map(
                    (item) => (

                      <option
                        key={item}
                        value={item}
                      >
                        {
                          COURSE_LABELS[
                            item
                          ] ??
                          item
                        }
                      </option>

                    ),
                  )}

                </select>

              </label>

              <label>

                <span>
                  Semester
                </span>

                <select
                  value={
                    editingStudent.semester
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditingStudent({
                      ...editingStudent,
                      semester:
                        Number(
                          event.target
                            .value,
                        ),
                    })
                  }
                >

                  {SEMESTERS.map(
                    (item) => (

                      <option
                        key={item}
                        value={item}
                      >
                        {semesterLabel(
                          item,
                        )}
                      </option>

                    ),
                  )}

                </select>

              </label>

              <label>

                <span>
                  Status
                </span>

                <select
                  value={
                    editingStudent.status
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditingStudent({
                      ...editingStudent,
                      status:
                        event.target
                          .value as StudentStatus,
                    })
                  }
                >

                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>

                </select>

              </label>

            </div>

            <div className="studentModalActions">

              <button
                type="button"
                className="secondaryButton"
                disabled={
                  savingStudent
                }
                onClick={() =>
                  setEditingStudent(
                    null,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primaryButton"
                disabled={
                  savingStudent ||
                  !editingStudent.name.trim() ||
                  !editingStudent.admissionNo.trim()
                }
                onClick={
                  updateStudent
                }
              >

                <Icon
                  name="check"
                  size={16}
                />

                {savingStudent
                  ? "Saving..."
                  : "Save Changes"}

              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          RESPONSIVE FIX
          
          Desktop:
          - Table visible
          - Mobile cards hidden

          Mobile:
          - Table hidden
          - Mobile cards visible
      ====================================================== */}

      <style jsx>{`
        .studentMobileList {
          display: none;
          flex-direction: column;
          gap: 12px;
        }

        .studentTableScroll {
          display: block;
        }

        .studentMobileCard {
          border: 1px solid #111111;
          border-radius: 14px;
          background: #ffffff;
          padding: 16px;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.05);
          overflow: hidden;
        }

        .studentMobileCard > div:first-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .studentMobileCard strong {
          font-size: 17px;
          font-weight: 800;
        }

        .studentMobileCard dl {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin: 14px 0;
        }

        .studentMobileCard dl > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .studentMobileCard dt {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .studentMobileCard dd {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #172033;
        }

        .studentMobileCard > .tableAction {
          width: 100%;
          justify-content: center;
          background: #7a1f2b;
          color: #ffffff;
          border: 1px solid #7a1f2b;
          border-radius: 10px;
          font-weight: 800;
        }

        @media (max-width: 768px) {
          .studentTableScroll {
            display: none;
          }

          .studentMobileList {
            display: flex;
          }
        }

        @media (min-width: 769px) {
          .studentTableScroll {
            display: block;
          }

          .studentMobileList {
            display: none;
          }
        }
      `}</style>

    </div>
  );
}