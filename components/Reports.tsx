"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/lib/supabase";
import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import { AppUser, hasPermission } from "@/lib/permissions";
import Icon from "./Icon";

const COURSES = [
  "B.A English",
  "B.Com Co-operation",
  "B.Com Computer Application",
  "BBA Finance",
];

const SEMESTERS = Array.from(
  { length: 8 },
  (_, index) => index + 1
);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ReportStudent = {
  id: string;
  name: string;
  admission_no: string;
  working: number;
  present: number;
  absent: number;
  percentage: number;
};

function getMonthNumber(month: string) {
  return MONTHS.indexOf(month) + 1;
}

function getMonthRange(
  month: string
) {
  const monthNumber =
    getMonthNumber(month);

  const year =
    new Date().getFullYear();

  const start = new Date(
    year,
    monthNumber - 1,
    1
  );

  const end = new Date(
    year,
    monthNumber,
    0
  );

  const format = (date: Date) =>
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;

  return {
    start: format(start),
    end: format(end),
    year,
  };
}

export default function Reports({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const [course, setCourse] =
    useState(COURSES[0]);

  const [semester, setSemester] =
    useState("1");

  const [month, setMonth] =
    useState(
      MONTHS[new Date().getMonth()]
    );

  const [students, setStudents] =
    useState<ReportStudent[]>([]);

  const [studentCount, setStudentCount] =
    useState(0);

  const [workingDays, setWorkingDays] =
    useState(0);

  const [totalPresent, setTotalPresent] =
    useState(0);

  const [totalAbsent, setTotalAbsent] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [generated, setGenerated] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* ============================================================
     GENERATE REPORT
  ============================================================ */

  async function generateReport() {
    setLoading(true);
    setError("");
    setSuccess("");
    setGenerated(false);

    try {
      const {
        start,
        end,
      } = getMonthRange(month);

      /* ========================================================
         STUDENTS
      ======================================================== */

      const {
        data: studentData,
        error: studentError,
      } = await supabase
        .from("students")
        .select(
          `
            id,
            name,
            admission_no,
            course,
            semester
          `
        )
        .eq("course", course);

      if (studentError) {
        throw studentError;
      }

      const selectedSemester =
        Number(semester);

      const filteredStudents =
        (studentData || []).filter(
          (student) => {
            const studentSemester =
              Number(
                String(
                  student.semester ?? ""
                ).replace(
                  /semester/gi,
                  ""
                ).trim()
              );

            return (
              studentSemester ===
              selectedSemester
            );
          }
        );

      if (
        filteredStudents.length ===
        0
      ) {
        setStudents([]);
        setStudentCount(0);
        setWorkingDays(0);
        setTotalPresent(0);
        setTotalAbsent(0);
        setGenerated(true);

        return;
      }

      /* ========================================================
         ATTENDANCE SESSIONS
      ======================================================== */

      const {
        data: sessions,
        error: sessionError,
      } = await supabase
        .from(
          "attendance_sessions"
        )
        .select(
          `
            id,
            attendance_date,
            course,
            semester,
            hour
          `
        )
        .eq(
          "course",
          course
        )
        .eq(
          "semester",
          selectedSemester
        )
        .gte(
          "attendance_date",
          start
        )
        .lte(
          "attendance_date",
          end
        );

      if (sessionError) {
        throw sessionError;
      }

      const sessionList =
        sessions || [];

      /* ========================================================
         WORKING DAYS
         
         A day counts once even if there
         are multiple hours.
      ======================================================== */

      const uniqueDates =
        new Set(
          sessionList.map(
            (session) =>
              session.attendance_date
          )
        );

      const days =
        uniqueDates.size;

      /* ========================================================
         RECORDS
      ======================================================== */

      let records: any[] = [];

      if (
        sessionList.length > 0
      ) {
        const sessionIds =
          sessionList.map(
            (session) =>
              session.id
          );

        const {
          data: recordData,
          error: recordError,
        } = await supabase
          .from(
            "attendance_records"
          )
          .select(
            `
              session_id,
              student_id,
              status
            `
          )
          .in(
            "session_id",
            sessionIds
          );

        if (recordError) {
          throw recordError;
        }

        records =
          recordData || [];
      }

      /* ========================================================
         STUDENT SUMMARY
      ======================================================== */

      const reportRows: ReportStudent[] =
        filteredStudents.map(
          (student) => {
            const studentRecords =
              records.filter(
                (record) =>
                  record.student_id ===
                  student.id
              );

            const present =
              studentRecords.filter(
                (record) =>
                  record.status ===
                  "present"
              ).length;

            const absent =
              studentRecords.filter(
                (record) =>
                  record.status ===
                  "absent"
              ).length;

            const working =
              present + absent;

            const percentage =
              working > 0
                ? Number(
                    (
                      (present /
                        working) *
                      100
                    ).toFixed(1)
                  )
                : 0;

            return {
              id: student.id,

              name:
                student.name ||
                "Unknown Student",

              admission_no:
                student.admission_no ||
                "",

              working,

              present,

              absent,

              percentage,
            };
          }
        );

      /* ========================================================
         TOTALS
      ======================================================== */

      const presentTotal =
        reportRows.reduce(
          (total, student) =>
            total +
            student.present,
          0
        );

      const absentTotal =
        reportRows.reduce(
          (total, student) =>
            total +
            student.absent,
          0
        );

      setStudents(
        reportRows
      );

      setStudentCount(
        reportRows.length
      );

      setWorkingDays(
        days
      );

      setTotalPresent(
        presentTotal
      );

      setTotalAbsent(
        absentTotal
      );

      setGenerated(true);

      setSuccess(
        "Attendance report generated successfully."
      );
    } catch (err: any) {
      console.error(
        "REPORT ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to generate attendance report."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     DOWNLOAD PDF
  ============================================================ */

  function downloadPDF() {
    if (
      !generated ||
      students.length === 0
    ) {
      return;
    }

    const {
      year,
    } = getMonthRange(month);

    const pdf =
      new jsPDF({
        orientation:
          "landscape",
        unit: "mm",
        format: "a4",
      });

    const pageWidth =
      pdf.internal.pageSize
        .getWidth();

    /* ========================================================
       HEADER
    ======================================================== */

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(20);

    pdf.text(
      "ROYAL COLLEGE",
      14,
      17
    );

    pdf.setFontSize(13);

    pdf.text(
      "Monthly Attendance Report",
      14,
      25
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(9);

    pdf.text(
      `Course: ${course}`,
      14,
      33
    );

    pdf.text(
      `Semester: Semester ${semester}`,
      14,
      39
    );

    pdf.text(
      `Month: ${month} ${year}`,
      14,
      45
    );

    /* ========================================================
       SUMMARY
    ======================================================== */

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(9);

    pdf.text(
      `Students: ${studentCount}`,
      pageWidth - 80,
      33
    );

    pdf.text(
      `Working Days: ${workingDays}`,
      pageWidth - 80,
      39
    );

    pdf.text(
      `Present: ${totalPresent}`,
      pageWidth - 80,
      45
    );

    pdf.text(
      `Absent: ${totalAbsent}`,
      pageWidth - 80,
      51
    );

    /* ========================================================
       TABLE
    ======================================================== */

    const tableRows =
      students.map(
        (student, index) => [
          String(
            index + 1
          ).padStart(2, "0"),

          student.name,

          student.admission_no,

          student.working,

          student.present,

          student.absent,

          `${student.percentage}%`,
        ]
      );

    autoTable(
      pdf,
      {
        startY: 59,

        head: [
          [
            "No",
            "Student",
            "Admission No",
            "Working",
            "Present",
            "Absent",
            "%",
          ],
        ],

        body: tableRows,

        theme:
          "grid",

        styles: {
          font:
            "helvetica",

          fontSize: 8,

          cellPadding: 4,

          textColor:
            45,

          lineColor:
            220,

          lineWidth:
            0.2,

          valign:
            "middle",
        },

        headStyles: {
          fillColor:
            [
              100,
              37,
              217,
            ],

          textColor:
            255,

          fontStyle:
            "bold",

          halign:
            "center",
        },

        columnStyles: {
          0: {
            halign:
              "center",
            cellWidth:
              12,
          },

          1: {
            cellWidth:
              65,
          },

          2: {
            cellWidth:
              40,
          },

          3: {
            halign:
              "center",
            cellWidth:
              25,
          },

          4: {
            halign:
              "center",
            cellWidth:
              25,
          },

          5: {
            halign:
              "center",
            cellWidth:
              25,
          },

          6: {
            halign:
              "center",
            cellWidth:
              22,
          },
        },

        alternateRowStyles: {
          fillColor:
            [
              249,
              247,
              252,
            ],
        },

        didParseCell:
          (data) => {
            if (
              data.section ===
              "body"
            ) {
              if (
                data.column.index ===
                6
              ) {
                const value =
                  String(
                    data.cell.text[0]
                  );

                const number =
                  Number(
                    value.replace(
                      "%",
                      ""
                    )
                  );

                if (
                  number >= 75
                ) {
                  data.cell.styles.textColor =
                    [
                      21,
                      128,
                      61,
                    ];
                } else {
                  data.cell.styles.textColor =
                    [
                      220,
                      38,
                      38,
                    ];
                }
              }
            }
          },
      }
    );

    /* ========================================================
       FOOTER
    ======================================================== */

    const pageCount =
      pdf.getNumberOfPages();

    for (
      let page = 1;
      page <= pageCount;
      page++
    ) {
      pdf.setPage(
        page
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(7);

      pdf.setTextColor(
        130
      );

      pdf.text(
        `Generated on ${new Date().toLocaleDateString(
          "en-IN"
        )}`,
        14,
        202
      );

      pdf.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - 40,
        202
      );
    }

    const safeCourse =
      course
        .replace(
          /[^a-zA-Z0-9]+/g,
          "-"
        )
        .toLowerCase();

    const safeMonth =
      month.toLowerCase();

    pdf.save(
      `attendance-${safeCourse}-semester-${semester}-${safeMonth}-${year}.pdf`
    );
  }

  /* ============================================================
     OVERALL PERCENTAGE
  ============================================================ */

  const overallPercentage =
    totalPresent +
      totalAbsent >
    0
      ? (
          (totalPresent /
            (totalPresent +
              totalAbsent)) *
          100
        ).toFixed(1)
      : "0.0";

  /* ============================================================
     JSX
  ============================================================ */

  if (!hasPermission(user, "attendance.view")) {
    return <PermissionDenied onBack={onBack} />;
  }

  return (
    <div className="reportsPage">

      {/* ======================================================
          BACK
      ====================================================== */}

      <BackToDashboard
        onBack={onBack}
      />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="reportsHeader">

        <div>

          <div className="reportsEyebrow">
            <span />
            REPORTS
          </div>

          <h1>
            Reports
          </h1>

          <p>
            Generate monthly attendance
            reports for students.
          </p>

        </div>

      </div>

      {/* ======================================================
          REPORT FILTER CARD
      ====================================================== */}

      <section className="reportFilterCard">

        <div className="reportSectionTitle">

          <div>

            <h2>
              Attendance Report
            </h2>

            <p>
              Select course, semester
              and month.
            </p>

          </div>

        </div>

        <div className="reportFilters">

          {/* COURSE */}

          <label>

            <span>
              COURSE
            </span>

            <select
              value={course}
              onChange={(e) =>
                setCourse(
                  e.target.value
                )
              }
            >

              {COURSES.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}

            </select>

          </label>

          {/* SEMESTER */}

          <label>

            <span>
              SEMESTER
            </span>

            <select
              value={semester}
              onChange={(e) =>
                setSemester(
                  e.target.value
                )
              }
            >

              {SEMESTERS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    Semester {item}
                  </option>
                )
              )}

            </select>

          </label>

          {/* MONTH */}

          <label>

            <span>
              MONTH
            </span>

            <select
              value={month}
              onChange={(e) =>
                setMonth(
                  e.target.value
                )
              }
            >

              {MONTHS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}

            </select>

          </label>

          {/* GENERATE */}

          <button
            type="button"
            className="generateReportButton"
            disabled={loading}
            onClick={
              generateReport
            }
          >

            <Icon
              name="bar-chart"
              size={16}
            />

            {loading
              ? "Generating..."
              : "Generate Report"}

          </button>

        </div>

      </section>

      {/* ======================================================
          ALERTS
      ====================================================== */}

      {error && (
        <div className="reportAlert error">

          <span>
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>

        </div>
      )}

      {success && (
        <div className="reportAlert success">

          <span>
            {success}
          </span>

          <button
            onClick={() =>
              setSuccess("")
            }
          >
            ×
          </button>

        </div>
      )}

      {/* ======================================================
          RESULTS
      ====================================================== */}

      {generated && (
        <>

          {/* ==================================================
              SUMMARY
          ================================================== */}

          <section className="monthlySummary">

            <div className="summaryTitle">

              <div>

                <h2>
                  Monthly Summary
                </h2>

                <p>
                  {course}
                  {" · "}
                  Semester {semester}
                  {" · "}
                  {month}
                </p>

              </div>

            </div>

            <div className="summaryGrid">

              <div className="summaryCard">

                <span>
                  STUDENTS
                </span>

                <strong>
                  {studentCount}
                </strong>

              </div>

              <div className="summaryCard">

                <span>
                  WORKING DAYS
                </span>

                <strong>
                  {workingDays}
                </strong>

              </div>

              <div className="summaryCard green">

                <span>
                  PRESENT
                </span>

                <strong>
                  {totalPresent}
                </strong>

              </div>

              <div className="summaryCard purple">

                <span>
                  ATTENDANCE
                </span>

                <strong>
                  {overallPercentage}%
                </strong>

              </div>

            </div>

          </section>

          {/* ==================================================
              TABLE
          ================================================== */}

          <section className="studentReportCard">

            <div className="studentReportHeader">

              <div>

                <h2>
                  Student Attendance
                </h2>

                <p>
                  Monthly attendance
                  summary for every student.
                </p>

              </div>

              <button
                type="button"
                className="downloadPdfButton"
                disabled={
                  students.length ===
                  0
                }
                onClick={
                  downloadPDF
                }
              >

                <Icon
                  name="download"
                  size={15}
                />

                Download PDF

              </button>

            </div>

            {students.length ===
            0 ? (
              <div className="reportEmpty">

                <strong>
                  No attendance data found
                </strong>

                <span>
                  There are no attendance
                  records for the selected
                  course, semester and month.
                </span>

              </div>
            ) : (
              <div className="reportTableWrapper">

                <table className="studentReportTable">

                  <thead>

                    <tr>

                      <th>
                        No
                      </th>

                      <th>
                        Student
                      </th>

                      <th>
                        Working
                      </th>

                      <th>
                        Present
                      </th>

                      <th>
                        Absent
                      </th>

                      <th>
                        %
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {students.map(
                      (
                        student,
                        index
                      ) => (
                        <tr
                          key={
                            student.id
                          }
                        >

                          <td>
                            <span className="reportStudentNumber">
                              {String(
                                index +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>
                          </td>

                          <td>

                            <div className="reportStudent">

                              <strong>
                                {
                                  student.name
                                }
                              </strong>

                              <span>
                                {
                                  student.admission_no
                                }
                              </span>

                            </div>

                          </td>

                          <td>
                            {
                              student.working
                            }
                          </td>

                          <td className="presentValue">
                            {
                              student.present
                            }
                          </td>

                          <td className="absentValue">
                            {
                              student.absent
                            }
                          </td>

                          <td>

                            <span
                              className={
                                student.percentage >=
                                75
                                  ? "percentage good"
                                  : "percentage low"
                              }
                            >
                              {
                                student.percentage
                              }%
                            </span>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </section>

        </>

      )}

    </div>
  );
}