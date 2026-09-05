"use client";

import {
  useEffect,
  useState,
} from "react";

import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import { AppUser, hasPermission } from "@/lib/permissions";
import Icon from "./Icon";
import { supabase } from "@/lib/supabase";

const COURSES = [
  "B.A English",
  "B.Com Co-op",
  "B.Com CA",
  "BBA Finance",
];

const SEMESTERS = Array.from(
  { length: 8 },
  (_, i) => i + 1
);

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const HOURS = [
  1,
  2,
  3,
  4,
  5,
];

type TimetableEntry = {
  id?: string;

  course: string;

  semester: number;

  day_of_week: string;

  hour: number;

  subject: string;

  teacher: string;
};

type TimetableProps = {
  onBack: () => void;
  user: AppUser;
};

export default function Timetable({
  onBack,
  user,
}: TimetableProps) {
  const [course, setCourse] =
    useState(COURSES[0]);

  const [semester, setSemester] =
    useState("1");

  const [entries, setEntries] =
    useState<
      Record<string, TimetableEntry>
    >({});

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [editingCell, setEditingCell] =
    useState<{
      day: string;
      hour: number;
    } | null>(null);

  const [subject, setSubject] =
    useState("");

  const [teacher, setTeacher] =
    useState("");

  /* ========================================================
     CELL KEY
  ======================================================== */

  function cellKey(
    day: string,
    hour: number
  ) {
    return `${day}-${hour}`;
  }

  /* ========================================================
     LOAD TIMETABLE
  ======================================================== */

  async function loadTimetable() {
    setLoading(true);
    setError("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("timetables")
        .select(`
          id,
          course,
          semester,
          day_of_week,
          hour,
          subject,
          teacher
        `)
        .eq(
          "course",
          course
        )
        .eq(
          "semester",
          Number(semester)
        )
        .order("hour", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const map: Record<
        string,
        TimetableEntry
      > = {};

      (data ?? []).forEach(
        (item) => {
          map[
            cellKey(
              item.day_of_week,
              Number(item.hour)
            )
          ] = {
            id: item.id,

            course:
              item.course,

            semester:
              Number(
                item.semester
              ),

            day_of_week:
              item.day_of_week,

            hour: Number(
              item.hour
            ),

            subject:
              item.subject,

            teacher:
              item.teacher ||
              "",
          };
        }
      );

      setEntries(map);
    } catch (err: any) {
      console.error(
        "TIMETABLE LOAD ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to load timetable."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTimetable();
  }, [course, semester]);

  /* ========================================================
     OPEN CELL
  ======================================================== */

  function openCell(
    day: string,
    hour: number
  ) {
    const existing = entries[cellKey(day, hour)];
    if (!existing && !hasPermission(user, "timetable.create")) return;
    if (existing && !hasPermission(user, "timetable.edit")) return;
    setEditingCell({
      day,
      hour,
    });

    setSubject(
      existing?.subject || ""
    );

    setTeacher(
      existing?.teacher || ""
    );

    setError("");
    setSuccess("");
  }

  /* ========================================================
     CLOSE MODAL
  ======================================================== */

  function closeEditor() {
    setEditingCell(null);
    setSubject("");
    setTeacher("");
  }

  /* ========================================================
     SAVE CELL
  ======================================================== */

  async function saveCell() {
    if (!editingCell) {
      return;
    }

    const existing = entries[cellKey(editingCell.day, editingCell.hour)];
    const requiredPermission = existing ? "timetable.edit" : "timetable.create";
    if (!hasPermission(user, requiredPermission)) {
      setError("You don't have permission for this action.");
      return;
    }

    if (!subject.trim()) {
      setError(
        "Please enter a subject."
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        course,

        semester:
          Number(semester),

        day_of_week:
          editingCell.day,

        hour:
          editingCell.hour,

        subject:
          subject.trim(),

        teacher:
          teacher.trim(),
      };

      const {
        data,
        error,
      } = await supabase
        .from("timetables")
        .upsert(
          payload,
          {
            onConflict:
              "course,semester,day_of_week,hour",
          }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      setEntries(
        (current) => ({
          ...current,

          [
            cellKey(
              editingCell.day,
              editingCell.hour
            )
          ]: {
            id: data.id,

            course:
              data.course,

            semester:
              Number(
                data.semester
              ),

            day_of_week:
              data.day_of_week,

            hour:
              Number(
                data.hour
              ),

            subject:
              data.subject,

            teacher:
              data.teacher ||
              "",
          },
        })
      );

      setSuccess(
        "Timetable updated successfully."
      );

      closeEditor();
    } catch (err: any) {
      console.error(
        "TIMETABLE SAVE ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to save timetable."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ========================================================
     DELETE CELL
  ======================================================== */

  async function deleteCell() {
    if (!hasPermission(user, "timetable.edit")) return;
    if (!editingCell) {
      return;
    }

    const existing =
      entries[
      cellKey(
        editingCell.day,
        editingCell.hour
      )
      ];

    if (!existing?.id) {
      closeEditor();
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        error,
      } = await supabase
        .from("timetables")
        .delete()
        .eq(
          "id",
          existing.id
        );

      if (error) {
        throw error;
      }

      setEntries(
        (current) => {
          const next = {
            ...current,
          };

          delete next[
            cellKey(
              editingCell.day,
              editingCell.hour
            )
          ];

          return next;
        }
      );

      setSuccess(
        "Timetable entry removed."
      );

      closeEditor();
    } catch (err: any) {
      console.error(
        "TIMETABLE DELETE ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to delete timetable entry."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ========================================================
     UI
  ======================================================== */

  if (!hasPermission(user, "timetable.view")) {
    return <PermissionDenied onBack={onBack} />;
  }

  return (
    <div className="timetableV1">

      <BackToDashboard
        onBack={onBack}
      />

      {/* ====================================================
          HEADER
      ==================================================== */}

      <header className="timetableV1Header">

        <div>

          <div className="timetableV1Eyebrow">

            <span />

            ACADEMIC SCHEDULE

          </div>

          <h1>
            Timetable
          </h1>

          <p>
            Manage the weekly class
            schedule for every course
            and semester.
          </p>

        </div>

      </header>

      {/* ====================================================
          ALERTS
      ==================================================== */}

      {error && (
        <div className="timetableV1Alert error">

          <Icon
            name="alert"
            size={15}
          />

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
        <div className="timetableV1Alert success">

          <Icon
            name="check"
            size={15}
          />

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

      {/* ====================================================
          FILTERS
      ==================================================== */}

      <section className="timetableV1Controls">

        <div className="timetableV1ControlTitle">

          <div className="timetableV1ControlIcon">

            <Icon
              name="calendar"
              size={18}
            />

          </div>

          <div>

            <strong>
              Class Schedule
            </strong>

            <span>
              Select course and semester
            </span>

          </div>

        </div>

        <div className="timetableV1Filters">

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
                    Semester{" "}
                    {item}
                  </option>
                )
              )}

            </select>

          </label>

        </div>

      </section>

      {/* ====================================================
          TIMETABLE
      ==================================================== */}

      <section className="timetableV1Card">

        <div className="timetableV1CardHeader">

          <div>

            <h2>
              Weekly Timetable
            </h2>

            <p>
              {course}
              {" • "}
              Semester{" "}
              {semester}
            </p>

          </div>

          <div className="timetableV1Hint">

            <span />

            Click any cell to add a class

          </div>

        </div>

        {loading ? (
          <div className="timetableV1Loading">

            <div className="timetableV1Loader" />

            <strong>
              Loading timetable...
            </strong>

          </div>
        ) : (
          <div className="timetableV1Scroll">

            <div className="timetableV1Grid">

              {/* CORNER */}

              <div className="timetableV1Corner">

                <span>
                  HOUR
                </span>

              </div>

              {/* DAYS */}

              {DAYS.map(
                (day) => (
                  <div
                    key={day}
                    className="timetableV1DayHeader"
                  >

                    <span>
                      {day.slice(
                        0,
                        3
                      ).toUpperCase()}
                    </span>

                    <strong>
                      {day}
                    </strong>

                  </div>
                )
              )}

              {/* ROWS */}

              {HOURS.map(
                (hour) => (
                  <>
                    {/* HOUR */}

                    <div
                      key={`hour-${hour}`}
                      className="timetableV1Hour"
                    >

                      <strong>
                        {hour}
                      </strong>

                      <span>
                        Hour
                      </span>

                    </div>

                    {/* DAYS */}

                    {DAYS.map(
                      (day) => {

                        const item =
                          entries[
                          cellKey(
                            day,
                            hour
                          )
                          ];

                        return (
                          <button
                            key={`${day}-${hour}`}
                            className={
                              item
                                ? "timetableV1Cell filled"
                                : "timetableV1Cell"
                            }
                            onClick={() =>
                              openCell(
                                day,
                                hour
                              )
                            }
                          >

                            {item ? (
                              <>

                                <div className="timetableV1Subject">

                                  <span className="timetableV1SubjectDot" />

                                  {
                                    item.subject
                                  }

                                </div>

                                {item.teacher && (
                                  <div className="timetableV1Teacher">

                                    <Icon
                                      name="user"
                                      size={11}
                                    />

                                    {
                                      item.teacher
                                    }

                                  </div>
                                )}

                              </>
                            ) : (
                              <div className="timetableV1EmptyCell">

                                <span>
                                  +
                                </span>

                                Add class

                              </div>
                            )}

                          </button>
                        );
                      }
                    )}

                  </>
                )
              )}

            </div>

          </div>
        )}

      </section>

      {/* ====================================================
          EDIT MODAL
      ==================================================== */}

      {editingCell && (
        <div
          className="timetableV1Overlay"
          onClick={
            closeEditor
          }
        >

          <div
            className="timetableV1Modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="timetableV1ModalHeader">

              <div>

                <div className="timetableV1ModalIcon">

                  <Icon
                    name="calendar"
                    size={18}
                  />

                </div>

                <h2>
                  Add Class
                </h2>

                <p>
                  {editingCell.day}
                  {" • "}
                  Hour{" "}
                  {editingCell.hour}
                </p>

              </div>

              <button
                className="timetableV1Close"
                onClick={
                  closeEditor
                }
              >
                ×
              </button>

            </div>

            <div className="timetableV1ModalBody">

              <div className="timetableV1Selected">

                <div>

                  <span>
                    COURSE
                  </span>

                  <strong>
                    {course}
                  </strong>

                </div>

                <div>

                  <span>
                    SEMESTER
                  </span>

                  <strong>
                    {semester}
                  </strong>

                </div>

                <div>

                  <span>
                    HOUR
                  </span>

                  <strong>
                    {editingCell.hour}
                  </strong>

                </div>

              </div>

              <label>

                <span>
                  SUBJECT
                </span>

                <input
                  value={subject}
                  onChange={(e) =>
                    setSubject(
                      e.target.value
                    )
                  }
                  placeholder="e.g. English Literature"
                  autoFocus
                />

              </label>

              <label>

                <span>
                  TEACHER
                </span>

                <input
                  value={teacher}
                  onChange={(e) =>
                    setTeacher(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Anu Teacher"
                />

              </label>

            </div>

            <div className="timetableV1ModalFooter">

              {entries[
                cellKey(
                  editingCell.day,
                  editingCell.hour
                )
              ] && (
                  <button
                    className="timetableV1Delete"
                    disabled={saving}
                    onClick={
                      deleteCell
                    }
                  >

                    <Icon
                      name="trash"
                      size={14}
                    />

                    Delete

                  </button>
                )}

              <div className="timetableV1FooterRight">

                <button
                  className="timetableV1Cancel"
                  onClick={
                    closeEditor
                  }
                >
                  Cancel
                </button>

                <button
                  className="timetableV1Save"
                  disabled={saving}
                  onClick={
                    saveCell
                  }
                >

                  <Icon
                    name="check"
                    size={14}
                  />

                  {saving
                    ? "Saving..."
                    : "Save Class"}

                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}