"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import BackToDashboard from "./BackToDashboard";
import Icon from "./Icon";
import { supabase } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type AttendanceStatus = "Present" | "Absent" | null;

type Student = {
  id: string;
  name: string;
  admission_no: string;
  course: string;
  semester: number;
};

type AttendanceMatrix = Record<string, Record<number, AttendanceStatus>>;

/* =========================================================
   CONSTANTS
========================================================= */

const COURSES = [
  "B.A English",
  "B.Com CA",
  "B.Com Co-op",
  "BBA Finance",
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const HOURS = [1, 2, 3, 4, 5];

/* =========================================================
   NORMALIZE COURSE

   Handles:
   B.Com Co-operation
   b.com co-operation
   B.Com  Co-operation
   B.Com Co-Operation

   as the same course.
========================================================= */

function normalizeCourse(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-");
}

/* =========================================================
   SEMESTER
========================================================= */

function toSemesterNumber(value: unknown): number {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  const match = raw.match(/(?:semester|sem)?\s*([1-8])\b/);

  if (!match) {
    throw new Error(`Invalid semester value: ${value}`);
  }

  const semester = Number(match[1]);

  if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
    throw new Error(`Invalid semester value: ${value}`);
  }

  return semester;
}

/* =========================================================
   TODAY
========================================================= */

function getToday(): string {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/* =========================================================
   EMPTY MATRIX
========================================================= */

function createEmptyMatrix(students: Student[]): AttendanceMatrix {
  const result: AttendanceMatrix = {};

  students.forEach((student) => {
    result[student.id] = {};

    HOURS.forEach((hour) => {
      result[student.id][hour] = null;
    });
  });

  return result;
}

/* =========================================================
   DATE
========================================================= */

function formatDate(date: string): string {
  if (!date) return "";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Attendance({ onBack }: { onBack: () => void }) {
  const [semester, setSemester] = useState<number>(1);

  const [course, setCourse] = useState(COURSES[0]);

  const [date, setDate] = useState(getToday());

  const [students, setStudents] = useState<Student[]>([]);

  const [matrix, setMatrix] = useState<AttendanceMatrix>({});

  const [mobileHour, setMobileHour] = useState(1);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  /* =========================================================
     LOAD
  ========================================================= */

  async function loadAttendance() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const selectedSemester = toSemesterNumber(semester);

      const selectedCourse = normalizeCourse(course);

      /* =====================================================
         STUDENTS

         IMPORTANT FIX:
         DO NOT use .eq("course", course)

         We fetch students and normalize the course
         in JavaScript.
      ===================================================== */

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(
          `
            id,
            name,
            admission_no,
            course,
            semester
          `,
        )
        .order("name", {
          ascending: true,
        });

      if (studentError) {
        throw studentError;
      }

      const filtered: Student[] = (studentData ?? [])
        .filter((student) => {
          try {
            const studentSemester = toSemesterNumber(student.semester);

            const studentCourse = normalizeCourse(student.course);

            return (
              studentSemester === selectedSemester &&
              studentCourse === selectedCourse
            );
          } catch {
            return false;
          }
        })
        .map((student) => ({
          id: student.id,

          name: student.name ?? "Unknown Student",

          admission_no: student.admission_no ?? "",

          course: student.course ?? course,

          semester: toSemesterNumber(student.semester),
        }));

      setStudents(filtered);

      setMobileHour(1);

      const empty = createEmptyMatrix(filtered);

      if (filtered.length === 0) {
        setMatrix(empty);
        return;
      }

      /* =====================================================
         SESSIONS

         IMPORTANT:
         Keep the SAME normalized course value used when
         creating sessions.
      ===================================================== */

      const { data: sessions, error: sessionError } = await supabase
        .from("attendance_sessions")
        .select(
          `
            id,
            attendance_date,
            course,
            semester,
            hour
          `,
        )
        .eq("attendance_date", date)
        .eq("course", course)
        .eq("semester", selectedSemester)
        .in("hour", HOURS);

      if (sessionError) {
        throw sessionError;
      }

      if (!sessions || sessions.length === 0) {
        setMatrix(empty);
        return;
      }

      /* =====================================================
         RECORDS
      ===================================================== */

      const sessionIds = sessions.map((session) => session.id);

      const { data: records, error: recordsError } = await supabase
        .from("attendance_records")
        .select(
          `
            session_id,
            student_id,
            status
          `,
        )
        .in("session_id", sessionIds);

      if (recordsError) {
        throw recordsError;
      }

      const hourMap = new Map<string, number>();

      sessions.forEach((session) => {
        hourMap.set(session.id, Number(session.hour));
      });

      (records ?? []).forEach((record) => {
        const hour = hourMap.get(record.session_id);

        if (!hour || !empty[record.student_id]) {
          return;
        }

        if (record.status === "Present" || record.status === "Absent") {
          empty[record.student_id][hour] = record.status;
        }
      });

      setMatrix(empty);
    } catch (err: any) {
      console.error("ATTENDANCE LOAD ERROR:", err);

      setError(err?.message ?? "Unable to load attendance.");

      setStudents([]);
      setMatrix({});
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOAD FILTER CHANGE
  ========================================================= */

  useEffect(() => {
    loadAttendance();
  }, [semester, course, date]);

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.admission_no.toLowerCase().includes(query),
    );
  }, [students, search]);

  /* =========================================================
     MARK
  ========================================================= */

  function markStatus(
    studentId: string,
    hour: number,
    status: AttendanceStatus,
  ) {
    setMatrix((current) => ({
      ...current,

      [studentId]: {
        ...(current[studentId] || {}),

        [hour]: current[studentId]?.[hour] === status ? null : status,
      },
    }));

    setError("");
    setSuccess("");
  }

  /* =========================================================
     MARK ALL
  ========================================================= */

  function markAllForHour(hour: number, status: "Present" | "Absent") {
    setMatrix((current) => {
      const next = {
        ...current,
      };

      students.forEach((student) => {
        next[student.id] = {
          ...(next[student.id] || {}),

          [hour]: status,
        };
      });

      return next;
    });

    setError("");
    setSuccess("");
  }

  /* =========================================================
     STATS
  ========================================================= */

  function getHourStats(hour: number) {
    let present = 0;
    let absent = 0;

    students.forEach((student) => {
      const status = matrix[student.id]?.[hour];

      if (status === "Present") {
        present++;
      }

      if (status === "Absent") {
        absent++;
      }
    });

    return {
      present,
      absent,
      marked: present + absent,

      complete: students.length > 0 && present + absent === students.length,
    };
  }

  function isHourComplete(hour: number) {
    if (!students.length) {
      return false;
    }

    return students.every((student) => {
      const status = matrix[student.id]?.[hour];

      return status === "Present" || status === "Absent";
    });
  }

  function canOpenMobileHour(hour: number) {
    if (hour === 1) {
      return true;
    }

    for (let i = 1; i < hour; i++) {
      if (!isHourComplete(i)) {
        return false;
      }
    }

    return true;
  }

  /* =========================================================
     SUMMARY
  ========================================================= */

  const totalPossible = students.length * HOURS.length;

  const totalMarked = HOURS.reduce(
    (total, hour) => total + getHourStats(hour).marked,
    0,
  );

  const totalPresent = HOURS.reduce(
    (total, hour) => total + getHourStats(hour).present,
    0,
  );

  const totalAbsent = HOURS.reduce(
    (total, hour) => total + getHourStats(hour).absent,
    0,
  );

  const attendancePercentage =
    totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

  /* =========================================================
     SAVE HOUR
  ========================================================= */

  async function saveHour(hour: number, userId: string) {
    const semesterNumber = toSemesterNumber(semester);

    const stats = getHourStats(hour);

    if (stats.marked === 0) {
      throw new Error(`No attendance marked for Hour ${hour}.`);
    }

    if (stats.marked !== students.length) {
      throw new Error(
        `Hour ${hour}: ${
          students.length - stats.marked
        } student(s) are not marked.`,
      );
    }

    /* =====================================================
       SESSION
    ===================================================== */

    const { data: existingSession, error: sessionFindError } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("attendance_date", date)
      .eq("course", course)
      .eq("semester", semesterNumber)
      .eq("hour", hour)
      .maybeSingle();

    if (sessionFindError) {
      throw sessionFindError;
    }

    let sessionId = existingSession?.id;

    /* =====================================================
       CREATE SESSION
    ===================================================== */

    if (!sessionId) {
      const { data: newSession, error: createError } = await supabase
        .from("attendance_sessions")
        .insert({
          attendance_date: date,

          course,

          semester: semesterNumber,

          hour,

          created_by: userId,
        })
        .select("id")
        .single();

      if (createError) {
        throw createError;
      }

      sessionId = newSession.id;
    }

    /* =====================================================
       PREPARE RECORDS
    ===================================================== */

    const records = students.map((student) => {
      const status = matrix[student.id]?.[hour];

      if (status !== "Present" && status !== "Absent") {
        throw new Error(`${student.name} has no valid attendance status.`);
      }

      return {
        session_id: sessionId,

        student_id: student.id,

        status,
      };
    });

    /* =====================================================
       EXISTING RECORDS
    ===================================================== */

    const { data: existingRecords, error: existingRecordsError } =
      await supabase
        .from("attendance_records")
        .select("id, student_id, status")
        .eq("session_id", sessionId);

    if (existingRecordsError) {
      throw existingRecordsError;
    }

    const existingMap = new Map<
      string,
      {
        id: string;
        status: string;
      }
    >();

    (existingRecords ?? []).forEach((record) => {
      existingMap.set(record.student_id, {
        id: record.id,
        status: record.status,
      });
    });

    /* =====================================================
       INSERT NEW RECORDS
    ===================================================== */

    const recordsToInsert = records.filter(
      (record) => !existingMap.has(record.student_id),
    );

    const recordsToUpdate = records.filter((record) =>
      existingMap.has(record.student_id),
    );

    if (recordsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("attendance_records")
        .insert(recordsToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    /* =====================================================
       UPDATE EXISTING RECORDS
    ===================================================== */

    if (recordsToUpdate.length > 0) {
      const { data: editPermission, error: permissionCheckError } =
        await supabase.rpc("has_staff_permission", {
          required_permission: "attendance.edit",
        });

      if (permissionCheckError) {
        throw permissionCheckError;
      }

      if (editPermission !== true) {
        throw new Error(
          "Some attendance records already exist for this hour. You need the attendance.edit permission to modify them.",
        );
      }

      for (const record of recordsToUpdate) {
        const existing = existingMap.get(record.student_id);

        if (!existing) {
          continue;
        }

        const { error: updateError } = await supabase
          .from("attendance_records")
          .update({
            status: record.status,
          })
          .eq("id", existing.id);

        if (updateError) {
          throw updateError;
        }
      }
    }
  }

  /* =========================================================
     SAVE MOBILE
  ========================================================= */

  async function saveMobileHour() {
    if (!isHourComplete(mobileHour)) {
      setError(
        `Please mark every student for Hour ${mobileHour} before saving.`,
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!data.user) {
        throw new Error("Your login session has expired.");
      }

      await saveHour(mobileHour, data.user.id);

      if (mobileHour < 5) {
        const next = mobileHour + 1;

        setMobileHour(next);

        setSuccess(`Hour ${mobileHour} saved. Hour ${next} is ready.`);
      } else {
        setSuccess("All 5 hours saved successfully.");
      }

      await loadAttendance();
    } catch (err: any) {
      console.error("MOBILE SAVE ERROR:", err);

      setError(err?.message ?? "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     SAVE DESKTOP
  ========================================================= */

  async function saveAttendance() {
    if (!students.length) {
      setError("No students found.");

      return;
    }

    if (!totalMarked) {
      setError("Please mark attendance before saving.");

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!data.user) {
        throw new Error("Please login again.");
      }

      toSemesterNumber(semester);

      for (const hour of HOURS) {
        const stats = getHourStats(hour);

        if (stats.marked > 0 && stats.marked !== students.length) {
          throw new Error(`Hour ${hour} is incomplete.`);
        }

        if (stats.marked === students.length) {
          await saveHour(hour, data.user.id);
        }
      }

      setSuccess("Attendance saved successfully.");

      await loadAttendance();
    } catch (err: any) {
      console.error("SAVE ERROR:", err);

      setError(err?.message ?? "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="attendanceMatrix">
      <BackToDashboard onBack={onBack} />

      <header className="attendanceMatrixHeader">
        <div>
          <div className="attendanceMatrixEyebrow">
            <span />
            DAILY ATTENDANCE
          </div>

          <h1>Attendance Management</h1>

          <p>Mark student attendance hour by hour.</p>
        </div>

        <div className="attendanceMatrixDateBadge">
          <Icon name="calendar" size={17} />

          <div>
            <span>ATTENDANCE DATE</span>

            <strong>{formatDate(date)}</strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="attendanceMatrixAlert error">
          <Icon name="alert" size={16} />

          <span>{error}</span>

          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="attendanceMatrixAlert success">
          <Icon name="check" size={16} />

          <span>{success}</span>

          <button type="button" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      <section className="attendanceMatrixFilters">
        <label>
          <span>SEMESTER</span>

          <select
            value={semester}
            onChange={(e) => setSemester(toSemesterNumber(e.target.value))}
          >
            {SEMESTERS.map((item) => (
              <option key={item} value={item}>
                Semester {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>COURSE</span>

          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            {COURSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>DATE</span>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div className="attendanceMatrixFilterInfo">
          <Icon name="users" size={16} />

          <div>
            <span>STUDENTS</span>

            <strong>{students.length}</strong>
          </div>
        </div>
      </section>

      <section className="attendanceMatrixSummary">
        <div>
          <span>TOTAL STUDENTS</span>

          <strong>{students.length}</strong>
        </div>

        <div>
          <span>MARKED</span>

          <strong>
            {totalMarked}

            <small>
              {" / "}
              {totalPossible}
            </small>
          </strong>
        </div>

        <div className="green">
          <span>PRESENT</span>

          <strong>{totalPresent}</strong>
        </div>

        <div className="red">
          <span>ABSENT</span>

          <strong>{totalAbsent}</strong>
        </div>

        <div className="purple">
          <span>ATTENDANCE</span>

          <strong>{attendancePercentage}%</strong>
        </div>
      </section>

      <section className="attendanceMatrixCard">
        <div className="attendanceMatrixCardHeader">
          <div>
            <h2>Student Attendance</h2>

            <p>Select Present or Absent for each student and hour.</p>
          </div>

          <div className="attendanceMatrixSearch">
            <Icon name="search" size={15} />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or admission number..."
            />

            {search && (
              <button type="button" onClick={() => setSearch("")}>
                ×
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="attendanceMatrixLoading">
            <div />

            <strong>Loading attendance...</strong>
          </div>
        ) : students.length === 0 ? (
          <div className="attendanceMatrixEmpty">
            <Icon name="users" size={28} />

            <strong>No students found</strong>

            <span>
              No students found for {course}, Semester {semester}.
            </span>
          </div>
        ) : (
          <>
            <div className="attendanceMobileOnly">
              <div className="attendanceMobileHourTabs">
                {HOURS.map((hour) => {
                  const stats = getHourStats(hour);

                  const active = mobileHour === hour;

                  const canOpen = canOpenMobileHour(hour);

                  return (
                    <button
                      key={hour}
                      type="button"
                      className={
                        active ? "mobileHourTab active" : "mobileHourTab"
                      }
                      disabled={!canOpen}
                      onClick={() => setMobileHour(hour)}
                    >
                      <span>HOUR</span>

                      <strong>{hour}</strong>

                      {stats.complete && <i>✓</i>}
                    </button>
                  );
                })}
              </div>

              <div className="mobileCurrentHourHeader">
                <div>
                  <span>CURRENT CLASS</span>

                  <h3>Hour {mobileHour}</h3>

                  <p>
                    {course}
                    {" · "}
                    Semester {semester}
                  </p>
                </div>

                <div className="mobileHourProgress">
                  <strong>{getHourStats(mobileHour).marked}</strong>

                  <span>/{students.length}</span>

                  <small>marked</small>
                </div>
              </div>

              <div className="mobileQuickActions">
                <button
                  type="button"
                  className="mobileAllPresent"
                  onClick={() => markAllForHour(mobileHour, "Present")}
                >
                  ✓ Mark All Present
                </button>

                <button
                  type="button"
                  className="mobileAllAbsent"
                  onClick={() => markAllForHour(mobileHour, "Absent")}
                >
                  × Mark All Absent
                </button>
              </div>

              <div className="mobileStudentList rcAttendanceStudentList">
                {filteredStudents.map((student, index) => {
                  const status = matrix[student.id]?.[mobileHour];

                  return (
                    <div
                      key={student.id}
                      className="mobileStudentCard rcAttendanceStudentCard"
                    >
                      <div className="mobileStudentInfo rcAttendanceStudentInfo">
                        <span className="mobileStudentNumber">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div>
                          <strong>{student.name}</strong>

                          <span>{student.admission_no}</span>
                        </div>
                      </div>

                      <div className="rcAttendanceButtonRow">
                        <button
                          type="button"
                          className={
                            status === "Present"
                              ? "rcAttendanceButton rcAttendancePresent selected"
                              : "rcAttendanceButton rcAttendancePresent"
                          }
                          onClick={() =>
                            markStatus(student.id, mobileHour, "Present")
                          }
                        >
                          Present
                        </button>

                        <button
                          type="button"
                          className={
                            status === "Absent"
                              ? "rcAttendanceButton rcAttendanceAbsent selected"
                              : "rcAttendanceButton rcAttendanceAbsent"
                          }
                          onClick={() =>
                            markStatus(student.id, mobileHour, "Absent")
                          }
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mobileAttendanceSave">
                <button
                  type="button"
                  className="attendanceMatrixSave"
                  disabled={saving || loading || !isHourComplete(mobileHour)}
                  onClick={saveMobileHour}
                >
                  <Icon name="check" size={16} />

                  {saving ? "Saving..." : `Save Hour ${mobileHour}`}
                </button>
              </div>
            </div>

            <div className="attendanceMatrixScroll">
              <table className="attendanceMatrixTable">
                <thead>
                  <tr>
                    <th rowSpan={2} className="studentHeader">
                      <span>STUDENT</span>

                      <strong>Admission No & Name</strong>
                    </th>

                    {HOURS.map((hour) => (
                      <th key={hour} colSpan={2} className="hourHeader">
                        <div className="hourTitle">
                          <span>HOUR</span>

                          <strong>{hour}</strong>
                        </div>

                        <div className="hourQuickActions">
                          <button
                            type="button"
                            onClick={() => markAllForHour(hour, "Present")}
                          >
                            All Present
                          </button>

                          <button
                            type="button"
                            onClick={() => markAllForHour(hour, "Absent")}
                          >
                            All Absent
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>

                  <tr>
                    {HOURS.map((hour) => (
                      <Fragment key={`head-${hour}`}>
                        <th className="statusHeader presentHeader">P</th>

                        <th className="statusHeader absentHeader">A</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr key={student.id}>
                      <td className="studentCell">
                        <div className="studentIdentity">
                          <span className="studentNumber">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <div>
                            <strong>{student.name}</strong>

                            <span>{student.admission_no}</span>
                          </div>
                        </div>
                      </td>

                      {HOURS.map((hour) => {
                        const status = matrix[student.id]?.[hour];

                        return (
                          <Fragment key={`${student.id}-${hour}`}>
                            <td className="checkCell presentCell">
                              <button
                                type="button"
                                className={
                                  status === "Present"
                                    ? "attendanceCheck present active"
                                    : "attendanceCheck present"
                                }
                                onClick={() =>
                                  markStatus(student.id, hour, "Present")
                                }
                              >
                                <span />
                              </button>
                            </td>

                            <td className="checkCell absentCell">
                              <button
                                type="button"
                                className={
                                  status === "Absent"
                                    ? "attendanceCheck absent active"
                                    : "attendanceCheck absent"
                                }
                                onClick={() =>
                                  markStatus(student.id, hour, "Absent")
                                }
                              >
                                <span />
                              </button>
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="attendanceDesktopFooter">
          <div className="attendanceMatrixLegend">
            <div>
              <span className="legendBox present" />
              Present
            </div>

            <div>
              <span className="legendBox absent" />
              Absent
            </div>

            <span className="legendText">
              Click selected status again to clear it.
            </span>
          </div>

          <button
            type="button"
            className="attendanceMatrixSave"
            disabled={saving || loading || students.length === 0}
            onClick={saveAttendance}
          >
            <Icon name="check" size={16} />

            {saving ? "Saving Attendance..." : "Save Attendance"}
          </button>
        </div>
      </section>

      <style jsx global>{`
        .rcAttendanceStudentList {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .rcAttendanceStudentCard {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;

          display: block !important;

          box-sizing: border-box !important;

          overflow: hidden !important;
        }

        .rcAttendanceStudentInfo {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;

          display: flex !important;

          box-sizing: border-box !important;
        }

        .rcAttendanceButtonRow {
          display: grid !important;

          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;

          grid-template-rows: 48px !important;

          column-gap: 8px !important;

          row-gap: 0 !important;

          width: 100% !important;

          max-width: 100% !important;

          min-width: 0 !important;

          margin-top: 12px !important;

          box-sizing: border-box !important;

          align-items: stretch !important;

          justify-items: stretch !important;
        }

        .rcAttendanceButtonRow .rcAttendanceButton {
          display: flex !important;

          align-items: center !important;

          justify-content: center !important;

          width: 100% !important;

          max-width: 100% !important;

          min-width: 0 !important;

          height: 48px !important;

          min-height: 48px !important;

          max-height: 48px !important;

          margin: 0 !important;

          padding: 0 8px !important;

          box-sizing: border-box !important;

          border-radius: 10px !important;

          font-family: inherit !important;

          font-size: 14px !important;

          font-weight: 600 !important;

          line-height: 1 !important;

          white-space: nowrap !important;

          text-align: center !important;

          overflow: hidden !important;

          cursor: pointer !important;

          flex: none !important;

          float: none !important;

          position: static !important;
        }

        .rcAttendanceButtonRow .rcAttendancePresent {
          color: #059669 !important;

          background: #f0fdf4 !important;

          border: 1px solid #86efac !important;
        }

        .rcAttendanceButtonRow .rcAttendancePresent.selected {
          color: #ffffff !important;

          background: #16a34a !important;

          border-color: #16a34a !important;
        }

        .rcAttendanceButtonRow .rcAttendanceAbsent {
          color: #dc2626 !important;

          background: #fff7f7 !important;

          border: 1px solid #fca5a5 !important;
        }

        .rcAttendanceButtonRow .rcAttendanceAbsent.selected {
          color: #ffffff !important;

          background: #dc2626 !important;

          border-color: #dc2626 !important;
        }

        @media (max-width: 768px) {
          .rcAttendanceStudentCard {
            display: block !important;

            width: 100% !important;

            max-width: 100% !important;

            min-width: 0 !important;
          }

          .rcAttendanceButtonRow {
            display: grid !important;

            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr) !important;

            width: 100% !important;

            max-width: 100% !important;

            min-width: 0 !important;

            height: 46px !important;

            grid-template-rows: 46px !important;

            gap: 8px !important;
          }

          .rcAttendanceButtonRow .rcAttendanceButton {
            width: 100% !important;

            max-width: 100% !important;

            min-width: 0 !important;

            height: 46px !important;

            min-height: 46px !important;

            max-height: 46px !important;

            font-size: 13px !important;
          }
        }

        @media (max-width: 420px) {
          .rcAttendanceButtonRow {
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr) !important;

            grid-template-rows: 44px !important;

            height: 44px !important;

            gap: 7px !important;
          }

          .rcAttendanceButtonRow .rcAttendanceButton {
            height: 44px !important;

            min-height: 44px !important;

            max-height: 44px !important;

            padding: 0 5px !important;

            font-size: 13px !important;

            border-radius: 9px !important;
          }
        }

        @media (max-width: 340px) {
          .rcAttendanceButtonRow {
            gap: 5px !important;
          }

          .rcAttendanceButtonRow .rcAttendanceButton {
            font-size: 12px !important;

            padding: 0 3px !important;
          }
        }
      `}</style>
    </div>
  );
}
