"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import Icon from "./Icon";

import { supabase } from "@/lib/supabase";
import { AppUser, hasPermission } from "@/lib/permissions";


/* =========================================================
   TYPES
========================================================= */

type Course = {
  id: string;
  name: string;
  code: string | null;
};

type Subject = {
  id: string;
  course_id: string;
  semester: number;
  subject_code: string;
  subject_name: string;
  description: string | null;
};

type SubjectForm = {
  subjectCode: string;
  subjectName: string;
  description: string;
};


/* =========================================================
   EXACT COURSES
========================================================= */

const COURSE_ORDER = [
  "B.A English",
  "B.Com Co-op",
  "B.Com CA",
  "BBA Finance",
];


/* =========================================================
   EXACT 8 SEMESTERS
========================================================= */

const SEMESTERS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
];


/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM: SubjectForm = {
  subjectCode: "",
  subjectName: "",
  description: "",
};


/* =========================================================
   SYLLABUS
========================================================= */

export default function Syllabus({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {

  /* =======================================================
     STATE
  ======================================================= */

  const [courses, setCourses] =
    useState<Course[]>([]);

  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  const [selectedCourse, setSelectedCourse] =
    useState("");

  const [selectedSemester, setSelectedSemester] =
    useState(1);

  const [loadingCourses, setLoadingCourses] =
    useState(true);

  const [loadingSubjects, setLoadingSubjects] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [editingSubject, setEditingSubject] =
    useState<Subject | null>(null);

  const [form, setForm] =
    useState<SubjectForm>(
      EMPTY_FORM
    );


  /* =======================================================
     LOAD COURSES
  ======================================================= */

  async function loadCourses() {

    setLoadingCourses(true);
    setError("");

    try {

      const {
        data,
        error: courseError,
      } = await supabase
        .from("syllabus_courses")
        .select(
          "id, name, code"
        )
        .in(
          "name",
          COURSE_ORDER
        );

      if (courseError) {
        throw courseError;
      }

      const ordered =
        [...(data || [])].sort(
          (a, b) =>
            COURSE_ORDER.indexOf(
              a.name
            ) -
            COURSE_ORDER.indexOf(
              b.name
            )
        );

      setCourses(
        ordered
      );

      if (
        ordered.length > 0 &&
        !selectedCourse
      ) {
        setSelectedCourse(
          ordered[0].id
        );
      }

    } catch (err: any) {

      console.error(
        "COURSE LOAD ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to load courses."
      );

    } finally {

      setLoadingCourses(
        false
      );

    }

  }


  /* =======================================================
     LOAD SUBJECTS
  ======================================================= */

  async function loadSubjects() {

    if (!selectedCourse) {

      setSubjects([]);

      return;

    }

    setLoadingSubjects(
      true
    );

    setError("");

    try {

      const {
        data,
        error: subjectError,
      } = await supabase
        .from(
          "syllabus_subjects"
        )
        .select(
          "id, course_id, semester, subject_code, subject_name, description"
        )
        .eq(
          "course_id",
          selectedCourse
        )
        .eq(
          "semester",
          selectedSemester
        )
        .order(
          "subject_code",
          {
            ascending: true,
          }
        );

      if (subjectError) {
        throw subjectError;
      }

      setSubjects(
        data || []
      );

    } catch (err: any) {

      console.error(
        "SUBJECT LOAD ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to load subjects."
      );

    } finally {

      setLoadingSubjects(
        false
      );

    }

  }


  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {

    loadCourses();

  }, []);


  /* =======================================================
     RELOAD SUBJECTS
  ======================================================= */

  useEffect(() => {

    loadSubjects();

  }, [
    selectedCourse,
    selectedSemester,
  ]);


  /* =======================================================
     CURRENT COURSE
  ======================================================= */

  const currentCourse =
    useMemo(
      () =>
        courses.find(
          course =>
            course.id ===
            selectedCourse
        ),
      [
        courses,
        selectedCourse,
      ]
    );


  /* =======================================================
     CLEAR MESSAGES
  ======================================================= */

  function clearMessages() {

    setError("");
    setSuccess("");

  }


  /* =======================================================
     ADD
  ======================================================= */

  function openAddModal() {
    if (!hasPermission(user, "syllabus.manage")) return;

    clearMessages();

    setEditingSubject(
      null
    );

    setForm(
      EMPTY_FORM
    );

    setShowModal(
      true
    );

  }


  /* =======================================================
     EDIT
  ======================================================= */

  function openEditModal(
    subject: Subject
  ) {
    if (!hasPermission(user, "syllabus.manage")) return;

    clearMessages();

    setEditingSubject(
      subject
    );

    setForm({

      subjectCode:
        subject.subject_code,

      subjectName:
        subject.subject_name,

      description:
        subject.description ||
        "",

    });

    setShowModal(
      true
    );

  }


  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {

    if (saving) {
      return;
    }

    setShowModal(
      false
    );

    setEditingSubject(
      null
    );

    setForm(
      EMPTY_FORM
    );

  }


  /* =======================================================
     SAVE SUBJECT
  ======================================================= */

  async function saveSubject(
    event: FormEvent
  ) {

    event.preventDefault();

    if (!hasPermission(user, "syllabus.manage")) {
      setError("You don't have permission to manage syllabus.");
      return;
    }

    clearMessages();

    if (!selectedCourse) {

      setError(
        "Please select a course."
      );

      return;

    }

    const subjectCode =
      form.subjectCode
        .trim()
        .toUpperCase();

    const subjectName =
      form.subjectName
        .trim();

    const description =
      form.description
        .trim();

    if (!subjectCode) {

      setError(
        "Subject code is required."
      );

      return;

    }

    if (!subjectName) {

      setError(
        "Subject name is required."
      );

      return;

    }

    setSaving(true);

    try {

      /* ===================================================
         UPDATE
      =================================================== */

      if (editingSubject) {

        const {
          error: updateError,
        } = await supabase
          .from(
            "syllabus_subjects"
          )
          .update({

            subject_code:
              subjectCode,

            subject_name:
              subjectName,

            description:
              description ||
              null,

            updated_at:
              new Date()
                .toISOString(),

          })
          .eq(
            "id",
            editingSubject.id
          );

        if (updateError) {
          throw updateError;
        }

        setSuccess(
          "Subject updated successfully."
        );

      }

      /* ===================================================
         INSERT
      =================================================== */

      else {

        const {
          error: insertError,
        } = await supabase
          .from(
            "syllabus_subjects"
          )
          .insert({

            course_id:
              selectedCourse,

            semester:
              selectedSemester,

            subject_code:
              subjectCode,

            subject_name:
              subjectName,

            description:
              description ||
              null,

          });

        if (insertError) {

          if (
            insertError.code ===
            "23505"
          ) {

            throw new Error(
              "This subject code already exists for this course and semester."
            );

          }

          throw insertError;

        }

        setSuccess(
          "Subject added successfully."
        );

      }

      closeModal();

      await loadSubjects();

    } catch (err: any) {

      console.error(
        "SAVE SUBJECT ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to save subject."
      );

    } finally {

      setSaving(false);

    }

  }


  /* =======================================================
     DELETE
  ======================================================= */

  async function deleteSubject(
    subject: Subject
  ) {
    if (!hasPermission(user, "syllabus.manage")) return;

    const confirmed =
      window.confirm(
        `Delete "${subject.subject_name}"?`
      );

    if (!confirmed) {
      return;
    }

    clearMessages();

    try {

      const {
        error: deleteError,
      } = await supabase
        .from(
          "syllabus_subjects"
        )
        .delete()
        .eq(
          "id",
          subject.id
        );

      if (deleteError) {
        throw deleteError;
      }

      setSuccess(
        "Subject deleted successfully."
      );

      await loadSubjects();

    } catch (err: any) {

      console.error(
        "DELETE SUBJECT ERROR:",
        err
      );

      setError(
        err?.message ||
        "Unable to delete subject."
      );

    }

  }


  /* =======================================================
     UI
  ======================================================= */

  if (!hasPermission(user, "syllabus.view")) {
    return <PermissionDenied onBack={onBack} />;
  }

  return (

    <div className="syllabusPage">

      {/* BACK */}

      <BackToDashboard
        onBack={onBack}
      />


      {/* HEADER */}

      <div className="syllabusHeader">

        <div>

          <div className="syllabusKicker">

            <Icon
              name="book"
              size={16}
            />

            Academic

          </div>

          <h1>
            Syllabus
          </h1>

          <p>
            Manage subjects by course
            and semester.
          </p>

        </div>


        <button
          className="syllabusPrimaryButton"
          onClick={
            openAddModal
          }
          disabled={
            !selectedCourse ||
            !hasPermission(user, "syllabus.manage")
          }
        >

          <Icon
            name="plus"
            size={16}
          />

          Add New Subject

        </button>

      </div>


      {/* ALERT */}

      {error && (

        <div className="syllabusAlert syllabusError">

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

        <div className="syllabusAlert syllabusSuccess">

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


      {/* FILTERS */}

      <section className="syllabusFilters">

        <label>

          <span>
            Course
          </span>

          <select
            value={
              selectedCourse
            }
            onChange={(e) =>
              setSelectedCourse(
                e.target.value
              )
            }
            disabled={
              loadingCourses
            }
          >

            {courses.map(
              course => (

                <option
                  key={
                    course.id
                  }
                  value={
                    course.id
                  }
                >
                  {course.name}
                </option>

              )
            )}

          </select>

        </label>


        <label>

          <span>
            Semester
          </span>

          <select
            value={
              selectedSemester
            }
            onChange={(e) =>
              setSelectedSemester(
                Number(
                  e.target.value
                )
              )
            }
          >

            {SEMESTERS.map(
              semester => (

                <option
                  key={
                    semester
                  }
                  value={
                    semester
                  }
                >
                  Semester{" "}
                  {semester}
                </option>

              )
            )}

          </select>

        </label>

      </section>


      {/* SUBJECT CARD */}

      <section className="syllabusCard">

        <div className="syllabusCardHeader">

          <div>

            <div className="syllabusEyebrow">

              {currentCourse?.code ||
                "COURSE"}

              {" · "}

              SEMESTER{" "}
              {selectedSemester}

            </div>

            <h2>

              {currentCourse?.name ||
                "Select Course"}

            </h2>

            <p>
              Subjects registered
              for this semester.
            </p>

          </div>


          <div className="syllabusCardTools">

            <div className="syllabusCount">

              {subjects.length}

            </div>


            <button
              className="syllabusSmallButton"
              onClick={
                openAddModal
              }
            >

              <Icon
                name="plus"
                size={14}
              />

              Add Subject

            </button>

          </div>

        </div>


        {/* TABLE */}

        <div className="syllabusTableWrap">

          <table className="syllabusTable">

            <thead>

              <tr>

                <th>
                  NO
                </th>

                <th>
                  CODE
                </th>

                <th>
                  SUBJECT
                </th>

                <th>
                  DESCRIPTION
                </th>

                <th>
                  ACTION
                </th>

              </tr>

            </thead>


            <tbody>

              {loadingSubjects ? (

                <tr>

                  <td
                    colSpan={5}
                    className="syllabusLoading"
                  >
                    Loading subjects...
                  </td>

                </tr>

              ) : subjects.length ===
                0 ? (

                <tr>

                  <td
                    colSpan={5}
                  >

                    <div className="syllabusEmpty">

                      <div className="syllabusEmptyIcon">

                        <Icon
                          name="book"
                          size={22}
                        />

                      </div>

                      <strong>
                        No subjects yet
                      </strong>

                      <span>
                        Add a subject for
                        this course and
                        semester.
                      </span>

                      <button
                        className="syllabusEmptyButton"
                        onClick={
                          openAddModal
                        }
                      >
                        + Add Subject
                      </button>

                    </div>

                  </td>

                </tr>

              ) : (

                subjects.map(
                  (
                    subject,
                    index
                  ) => (

                    <tr
                      key={
                        subject.id
                      }
                    >

                      <td>

                        <span className="syllabusNumber">

                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}

                        </span>

                      </td>


                      <td>

                        <span className="syllabusCode">

                          {
                            subject.subject_code
                          }

                        </span>

                      </td>


                      <td>

                        <strong className="syllabusSubjectName">

                          {
                            subject.subject_name
                          }

                        </strong>

                      </td>


                      <td>

                        <span className="syllabusDescription">

                          {
                            subject.description ||
                            "No description"
                          }

                        </span>

                      </td>


                      <td>

                        <div className="syllabusActions">

                          <button
                            className="syllabusEditButton"
                            onClick={() =>
                              openEditModal(
                                subject
                              )
                            }
                          >
                            Edit
                          </button>


                          <button
                            className="syllabusDeleteButton"
                            onClick={() =>
                              deleteSubject(
                                subject
                              )
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* ===================================================
          MODAL
      =================================================== */}

      {showModal && (

        <div
          className="syllabusModalOverlay"
          onMouseDown={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              closeModal();
            }

          }}
        >

          <div className="syllabusModal">

            {/* HEADER */}

            <div className="syllabusModalHeader">

              <div>

                <div className="syllabusModalBadge">

                  <Icon
                    name="book"
                    size={13}
                  />

                  Syllabus

                </div>


                <h2>

                  {editingSubject
                    ? "Edit Subject"
                    : "Add New Subject"}

                </h2>


                <p>

                  {currentCourse?.name}
                  {" · "}
                  Semester{" "}
                  {selectedSemester}

                </p>

              </div>


              <button
                className="syllabusModalClose"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
              >
                ×
              </button>

            </div>


            {/* FORM */}

            <form
              className="syllabusForm"
              onSubmit={
                saveSubject
              }
            >

              <label>

                <span>
                  Course
                </span>

                <div className="syllabusReadonly">

                  {currentCourse?.name ||
                    "—"}

                </div>

              </label>


              <label>

                <span>
                  Semester
                </span>

                <div className="syllabusReadonly">

                  Semester{" "}
                  {selectedSemester}

                </div>

              </label>


              <label>

                <span>
                  Subject Code
                </span>

                <input
                  autoFocus
                  required
                  value={
                    form.subjectCode
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subjectCode:
                        e.target
                          .value,
                    })
                  }
                  placeholder="e.g. ENG101"
                />

              </label>


              <label>

                <span>
                  Subject Name
                </span>

                <input
                  required
                  value={
                    form.subjectName
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subjectName:
                        e.target
                          .value,
                    })
                  }
                  placeholder="e.g. British Poetry"
                />

              </label>


              <label className="syllabusDescriptionField">

                <span>
                  Description
                </span>

                <textarea
                  rows={4}
                  value={
                    form.description
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description:
                        e.target
                          .value,
                    })
                  }
                  placeholder="Optional description"
                />

              </label>


              {/* FOOTER */}

              <div className="syllabusModalFooter">

                <button
                  type="button"
                  className="syllabusCancelButton"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="syllabusSaveButton"
                  disabled={
                    saving
                  }
                >

                  <Icon
                    name="check"
                    size={14}
                  />

                  {saving
                    ? "Saving..."
                    : editingSubject
                    ? "Update Subject"
                    : "Add Subject"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}