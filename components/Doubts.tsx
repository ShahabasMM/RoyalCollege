"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import { AppUser, hasPermission } from "@/lib/permissions";

type DoubtStatus = "pending" | "answered" | "resolved";

type Doubt = {
  id: string;
  student_id: string;
  student_name: string;
  admission_no: string | null;
  course: string | null;
  semester: number | null;
  subject: string | null;
  title: string;
  question: string;
  status: DoubtStatus;
  teacher_id: string | null;
  teacher_name: string | null;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  updated_at: string;
};

const SUBJECTS = [
  "All Subjects",
  "English",
  "History",
  "Computer",
  "Malayalam",
  "Economics",
  "Commerce",
  "Mathematics",
];

export default function Doubts({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] =
    useState("All Subjects");

  const [selectedDoubt, setSelectedDoubt] =
    useState<Doubt | null>(null);

  const [answer, setAnswer] = useState("");

  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ==========================================================
     LOAD DOUBTS
  ========================================================== */

  async function loadDoubts() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("doubts")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      setError(error.message);
      setDoubts([]);
    } else {
      setDoubts((data || []) as Doubt[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDoubts();
  }, []);

  /* ==========================================================
     REALTIME
     ========================================================== */

  useEffect(() => {
    const channel = supabase
      .channel("website-doubts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doubts",
        },
        () => {
          loadDoubts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ==========================================================
     STATS
  ========================================================== */

  const pendingCount = doubts.filter(
    (item) => item.status === "pending"
  ).length;

  const answeredCount = doubts.filter(
    (item) => item.status === "answered"
  ).length;

  const resolvedCount = doubts.filter(
    (item) => item.status === "resolved"
  ).length;

  /* ==========================================================
     FILTERED DOUBTS
  ========================================================== */

  const filteredDoubts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return doubts.filter((doubt) => {
      const matchesSearch =
        !query ||
        doubt.student_name
          .toLowerCase()
          .includes(query) ||
        doubt.title
          .toLowerCase()
          .includes(query) ||
        doubt.question
          .toLowerCase()
          .includes(query) ||
        (doubt.subject || "")
          .toLowerCase()
          .includes(query) ||
        (doubt.admission_no || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        doubt.status === statusFilter;

      const matchesSubject =
        subjectFilter === "All Subjects" ||
        doubt.subject === subjectFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSubject
      );
    });
  }, [
    doubts,
    search,
    statusFilter,
    subjectFilter,
  ]);

  /* ==========================================================
     OPEN DOUBT
  ========================================================== */

  function openDoubt(doubt: Doubt) {
    setSelectedDoubt(doubt);
    setAnswer(doubt.answer || "");
    setError("");
    setSuccess("");
  }

  /* ==========================================================
     CLOSE DOUBT
  ========================================================== */

  function closeDoubt() {
    if (sending || resolving) return;

    setSelectedDoubt(null);
    setAnswer("");
  }

  /* ==========================================================
     SEND REPLY
  ========================================================== */

  async function sendReply() {
    if (!hasPermission(user, "doubts.answer")) return;
    if (!selectedDoubt) return;

    if (!answer.trim()) {
      setError("Please enter a reply.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");

    try {
      /*
       * Website-only setup:
       *
       * For now we don't depend on the student app.
       * The currently authenticated website user is
       * used as the teacher when available.
       */

      const {
        data: authData,
      } = await supabase.auth.getUser();

      const user = authData?.user;

      let teacherName = "Teacher";

      if (user) {
        teacherName =
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email ||
          "Teacher";
      }

      const { error } = await supabase
        .from("doubts")
        .update({
          answer: answer.trim(),
          status: "answered",
          teacher_id: user?.id || null,
          teacher_name: teacherName,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDoubt.id);

      if (error) {
        throw error;
      }

      setSuccess("Reply sent successfully.");

      setSelectedDoubt(null);
      setAnswer("");

      await loadDoubts();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to send reply."
      );
    } finally {
      setSending(false);
    }
  }

  /* ==========================================================
     MARK RESOLVED
  ========================================================== */

  async function markResolved() {
    if (!hasPermission(user, "doubts.answer")) return;
    if (!selectedDoubt) return;

    setResolving(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("doubts")
        .update({
          status: "resolved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedDoubt.id);

      if (error) {
        throw error;
      }

      setSuccess("Doubt marked as resolved.");

      setSelectedDoubt(null);

      await loadDoubts();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to resolve doubt."
      );
    } finally {
      setResolving(false);
    }
  }

  /* ==========================================================
     REOPEN DOUBT
  ========================================================== */

  async function reopenDoubt(doubt: Doubt) {
    if (!hasPermission(user, "doubts.answer")) return;
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("doubts")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", doubt.id);

      if (error) {
        throw error;
      }

      setSuccess("Doubt reopened.");

      await loadDoubts();

      if (selectedDoubt?.id === doubt.id) {
        setSelectedDoubt({
          ...doubt,
          status: "pending",
        });
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to reopen doubt."
      );
    }
  }

  /* ==========================================================
     DELETE
  ========================================================== */

  async function deleteDoubt(doubt: Doubt) {
    if (!hasPermission(user, "doubts.answer")) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this doubt?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("doubts")
        .delete()
        .eq("id", doubt.id);

      if (error) {
        throw error;
      }

      setSuccess("Doubt deleted.");

      setDoubts((current) =>
        current.filter(
          (item) => item.id !== doubt.id
        )
      );

      if (selectedDoubt?.id === doubt.id) {
        setSelectedDoubt(null);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to delete doubt."
      );
    }
  }

  /* ==========================================================
     DATE
  ========================================================== */

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  /* ==========================================================
     PAGE
  ========================================================== */

  if (!hasPermission(user, "doubts.view")) {
    return <PermissionDenied onBack={onBack} />;
  }

  return (
    <div className="doubts-page">

      {/* ======================================================
          BACK
      ====================================================== */}

      <BackToDashboard
        onBack={onBack}
      />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="doubts-header">

        <div>
          <div className="doubts-eyebrow">
            ACADEMIC SUPPORT
          </div>

          <h1>
            Student Doubts
          </h1>

          <p>
            View, answer and manage
            questions submitted by students.
          </p>
        </div>

      </div>

      {/* ======================================================
          ALERTS
      ====================================================== */}

      {error && (
        <div className="doubt-alert error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="doubt-alert success">
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            ×
          </button>
        </div>
      )}

      {/* ======================================================
          STATS
      ====================================================== */}

      <div className="doubt-stats">

        <div className="doubt-stat-card blue">
          <div className="doubt-stat-icon">
            ?
          </div>

          <div>
            <span>
              New Doubts
            </span>

            <strong>
              {pendingCount}
            </strong>
          </div>
        </div>

        <div className="doubt-stat-card green">
          <div className="doubt-stat-icon">
            ✓
          </div>

          <div>
            <span>
              Answered
            </span>

            <strong>
              {answeredCount}
            </strong>
          </div>
        </div>

        <div className="doubt-stat-card purple">
          <div className="doubt-stat-icon">
            ✓
          </div>

          <div>
            <span>
              Resolved
            </span>

            <strong>
              {resolvedCount}
            </strong>
          </div>
        </div>

        <div className="doubt-stat-card orange">
          <div className="doubt-stat-icon">
            #
          </div>

          <div>
            <span>
              Total Doubts
            </span>

            <strong>
              {doubts.length}
            </strong>
          </div>
        </div>

      </div>

      {/* ======================================================
          FILTER TOOLBAR
      ====================================================== */}

      <div className="doubt-toolbar">

        <div className="doubt-search">
          <span>
            ⌕
          </span>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search student, admission no, subject or doubt..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
        >
          <option value="all">
            All Status
          </option>

          <option value="pending">
            New
          </option>

          <option value="answered">
            Answered
          </option>

          <option value="resolved">
            Resolved
          </option>
        </select>

        <select
          value={subjectFilter}
          onChange={(e) =>
            setSubjectFilter(e.target.value)
          }
        >
          {SUBJECTS.map((subject) => (
            <option
              key={subject}
              value={subject}
            >
              {subject}
            </option>
          ))}
        </select>

      </div>

      {/* ======================================================
          LIST
      ====================================================== */}

      <div className="doubt-list">

        {loading ? (
          <div className="doubt-empty">
            <div className="doubt-loading" />

            <strong>
              Loading doubts...
            </strong>
          </div>
        ) : filteredDoubts.length === 0 ? (
          <div className="doubt-empty">

            <div className="doubt-empty-icon">
              ?
            </div>

            <strong>
              No doubts found
            </strong>

            <span>
              Student questions will appear
              here when they are submitted.
            </span>

          </div>
        ) : (
          filteredDoubts.map((doubt) => (
            <div
              className={`doubt-card ${doubt.status}`}
              key={doubt.id}
            >

              {/* LEFT */}

              <div className="doubt-card-content">

                <div className="doubt-card-top">

                  <div className="doubt-tags">

                    <span className="doubt-subject">
                      {doubt.subject ||
                        "General"}
                    </span>

                    <span
                      className={`doubt-status ${doubt.status}`}
                    >
                      {doubt.status ===
                      "pending"
                        ? "New"
                        : doubt.status ===
                          "answered"
                        ? "Answered"
                        : "Resolved"}
                    </span>

                  </div>

                  <span className="doubt-date">
                    {formatDate(
                      doubt.created_at
                    )}
                    {" · "}
                    {formatTime(
                      doubt.created_at
                    )}
                  </span>

                </div>

                <h2>
                  {doubt.title}
                </h2>

                <p className="doubt-question-preview">
                  {doubt.question}
                </p>

                <div className="doubt-student-info-row">

                  <div className="student-avatar">
                    {doubt.student_name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>
                      {doubt.student_name}
                    </strong>

                    <span>
                      {doubt.admission_no ||
                        "No admission number"}
                      {" · "}
                      {doubt.course ||
                        "Course not set"}
                      {" · "}
                      Semester{" "}
                      {doubt.semester ??
                        "-"}
                    </span>
                  </div>

                </div>

              </div>

              {/* RIGHT ACTION */}

              <div className="doubt-card-actions">

                <button
                  type="button"
                  className="open-doubt-btn"
                  onClick={() =>
                    openDoubt(doubt)
                  }
                >
                  Open Doubt
                </button>

                <button
                  type="button"
                  className="delete-doubt-btn"
                  onClick={() =>
                    deleteDoubt(doubt)
                  }
                >
                  Delete
                </button>

              </div>

            </div>
          ))
        )}

      </div>

      {/* ======================================================
          DOUBT DETAIL MODAL
      ====================================================== */}

      {selectedDoubt && (
        <div
          className="doubt-modal-overlay"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              closeDoubt();
            }
          }}
        >

          <div className="doubt-modal">

            {/* HEADER */}

            <div className="doubt-modal-header">

              <div>

                <div className="doubt-modal-label">
                  STUDENT DOUBT
                </div>

                <h2>
                  Doubt Details
                </h2>

              </div>

              <button
                type="button"
                className="doubt-close-btn"
                onClick={
                  closeDoubt
                }
              >
                ×
              </button>

            </div>

            {/* STUDENT DETAILS */}

            <div className="doubt-profile">

              <div className="large-student-avatar">
                {selectedDoubt.student_name
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <strong>
                  {
                    selectedDoubt.student_name
                  }
                </strong>

                <span>
                  Admission No:{" "}
                  {
                    selectedDoubt.admission_no ||
                    "-"
                  }
                </span>

                <span>
                  {
                    selectedDoubt.course ||
                    "Course not set"
                  }
                  {" · Semester "}
                  {
                    selectedDoubt.semester ??
                    "-"
                  }
                </span>

              </div>

            </div>

            {/* QUESTION */}

            <div className="question-box">

              <div className="question-meta">

                <span>
                  {selectedDoubt.subject ||
                    "General"}
                </span>

                <span>
                  {formatDate(
                    selectedDoubt.created_at
                  )}
                </span>

              </div>

              <h3>
                {
                  selectedDoubt.title
                }
              </h3>

              <p>
                {
                  selectedDoubt.question
                }
              </p>

            </div>

            {/* EXISTING ANSWER */}

            {selectedDoubt.answer && (
              <div className="existing-answer">

                <div className="answer-heading">
                  <span>
                    TEACHER REPLY
                  </span>

                  <small>
                    {
                      selectedDoubt.teacher_name ||
                      "Teacher"
                    }
                  </small>
                </div>

                <p>
                  {
                    selectedDoubt.answer
                  }
                </p>

              </div>
            )}

            {/* REPLY */}

            {selectedDoubt.status !==
              "resolved" && (
              <div className="reply-section">

                <label>
                  {selectedDoubt.answer
                    ? "Update Reply"
                    : "Teacher Reply"}
                </label>

                <textarea
                  value={answer}
                  onChange={(e) =>
                    setAnswer(
                      e.target.value
                    )
                  }
                  placeholder="Write your answer to the student..."
                  rows={6}
                />

              </div>
            )}

            {/* RESOLVED INFO */}

            {selectedDoubt.status ===
              "resolved" && (
              <div className="resolved-box">

                <span>
                  ✓
                </span>

                <div>
                  <strong>
                    Doubt Resolved
                  </strong>

                  <p>
                    This doubt has been
                    marked as resolved.
                  </p>
                </div>

              </div>
            )}

            {/* MODAL ACTIONS */}

            <div className="doubt-modal-actions">

              <button
                type="button"
                className="secondary-doubt-btn"
                onClick={
                  closeDoubt
                }
              >
                Close
              </button>

              {selectedDoubt.status ===
                "resolved" ? (
                <button
                  type="button"
                  className="reopen-doubt-btn"
                  onClick={() =>
                    reopenDoubt(
                      selectedDoubt
                    )
                  }
                  disabled={!hasPermission(user, "doubts.answer")}
                >
                  Reopen Doubt
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="reply-doubt-btn"
                    disabled={
                      sending ||
                      !answer.trim() ||
                      !hasPermission(user, "doubts.answer")
                    }
                    onClick={
                      sendReply
                    }
                  >
                    {sending
                      ? "Sending..."
                      : selectedDoubt.answer
                      ? "Update Reply"
                      : "Send Reply"}
                  </button>

                  {selectedDoubt.status ===
                    "answered" && (
                    <button
                      type="button"
                      className="resolve-doubt-btn"
                      disabled={
                        resolving ||
                        !hasPermission(user, "doubts.answer")
                      }
                      onClick={
                        markResolved
                      }
                    >
                      {resolving
                        ? "Resolving..."
                        : "Mark Resolved"}
                    </button>
                  )}
                </>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}