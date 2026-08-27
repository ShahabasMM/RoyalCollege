"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import Icon from "./Icon";
import { AppUser, hasPermission } from "@/lib/permissions";

type Announcement = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  published: boolean;
  audience_type: "all" | "course_semester";
  target_course: string | null;
  target_semester: number | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = [
  "General",
  "Academic",
  "Exam",
  "Event",
  "Holiday",
  "Fee",
  "Important",
];

const PRIORITIES = ["Normal", "Important", "Urgent"];

export default function Announcements({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");

  const [category, setCategory] = useState("General");

  const [priority, setPriority] = useState("Normal");

  const [published, setPublished] = useState(true);

  const [audienceType, setAudienceType] = useState<"all" | "course_semester">(
    "all",
  );

  const [targetCourse, setTargetCourse] = useState("");

  const [targetSemester, setTargetSemester] = useState<number | "">("");

  const [courses, setCourses] = useState<string[]>([]);

  const [semesters, setSemesters] = useState<number[]>([]);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  /* ============================================================
     LOAD ANNOUNCEMENTS
  ============================================================ */

  async function loadAnnouncements() {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("announcements")
        .select(
          `
            id,
            title,
            description,
            category,
            priority,
            published,
            audience_type,
            target_course,
            target_semester,
            created_at,
            updated_at
          `,
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setAnnouncements((data || []) as Announcement[]);
    } catch (err: any) {
      console.error("ANNOUNCEMENTS LOAD ERROR:", err);

      setError(err?.message || "Unable to load announcements.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAudienceOptions() {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("course, semester");

      if (error) throw error;

      const uniqueCourses = Array.from(
        new Set(
          (data || [])
            .map((row: any) => String(row.course ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));

      const uniqueSemesters = Array.from(
        new Set(
          (data || [])
            .map((row: any) => Number(row.semester))
            .filter((value) => Number.isFinite(value) && value > 0),
        ),
      ).sort((a, b) => a - b);

      setCourses(uniqueCourses);
      setSemesters(uniqueSemesters);
    } catch (err: any) {
      console.error("AUDIENCE OPTIONS LOAD ERROR:", err);
      setError(err?.message || "Unable to load course and semester options.");
    }
  }

  useEffect(() => {
    loadAnnouncements();
    loadAudienceOptions();
  }, []);

  /* ============================================================
     RESET FORM
  ============================================================ */

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategory("General");
    setPriority("Normal");
    setPublished(true);
    setAudienceType("all");
    setTargetCourse("");
    setTargetSemester("");
  }

  /* ============================================================
     CREATE
  ============================================================ */

  function openCreate() {
    if (!hasPermission(user, "announcements.create")) return;
    resetForm();

    setError("");
    setSuccess("");

    setShowModal(true);
  }

  /* ============================================================
     EDIT
  ============================================================ */

  function openEdit(announcement: Announcement) {
    if (!hasPermission(user, "announcements.edit")) return;
    setEditingId(announcement.id);

    setTitle(announcement.title);

    setDescription(announcement.description);

    setCategory(announcement.category);

    setPriority(announcement.priority);

    setPublished(announcement.published);

    setAudienceType(announcement.audience_type || "all");

    setTargetCourse(announcement.target_course || "");

    setTargetSemester(announcement.target_semester ?? "");

    setError("");
    setSuccess("");

    setShowModal(true);
  }

  /* ============================================================
     CLOSE MODAL
  ============================================================ */

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    resetForm();
  }

  /* ============================================================
     SAVE
  ============================================================ */

  async function saveAnnouncement(event: React.FormEvent) {
    event.preventDefault();

    const requiredPermission = editingId
      ? "announcements.edit"
      : "announcements.create";
    if (!hasPermission(user, requiredPermission)) {
      setError("You don't have permission for this action.");
      return;
    }

    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Please enter announcement title.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter announcement description.");
      return;
    }

    if (audienceType === "course_semester") {
      if (!targetCourse) {
        setError("Please select a course.");
        return;
      }

      if (targetSemester === "") {
        setError("Please select a semester.");
        return;
      }
    }

    setSaving(true);

    try {
      /* ========================================================
         UPDATE
      ======================================================== */

      if (editingId) {
        const { error } = await supabase
          .from("announcements")
          .update({
            title: title.trim(),

            description: description.trim(),

            category,

            priority,

            published,

            audience_type: audienceType,

            target_course:
              audienceType === "course_semester" ? targetCourse : null,

            target_semester:
              audienceType === "course_semester"
                ? Number(targetSemester)
                : null,

            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        setSuccess("Announcement updated successfully.");
      } else {

      /* ========================================================
         INSERT
      ======================================================== */
        const { error } = await supabase.from("announcements").insert({
          title: title.trim(),

          description: description.trim(),

          category,

          priority,

          published,

          audience_type: audienceType,

          target_course:
            audienceType === "course_semester" ? targetCourse : null,

          target_semester:
            audienceType === "course_semester" ? Number(targetSemester) : null,
        });

        if (error) {
          throw error;
        }

        setSuccess("Announcement created successfully.");
      }

      setShowModal(false);

      resetForm();

      await loadAnnouncements();
    } catch (err: any) {
      console.error("ANNOUNCEMENT SAVE ERROR:", err);

      setError(err?.message || "Unable to save announcement.");
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     DELETE
  ============================================================ */

  async function deleteAnnouncement(id: string) {
    if (!hasPermission(user, "announcements.delete")) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this announcement?",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      setAnnouncements((current) => current.filter((item) => item.id !== id));

      setSuccess("Announcement deleted successfully.");
    } catch (err: any) {
      console.error("ANNOUNCEMENT DELETE ERROR:", err);

      setError(err?.message || "Unable to delete announcement.");
    }
  }

  /* ============================================================
     PUBLISH / UNPUBLISH
  ============================================================ */

  async function togglePublished(announcement: Announcement) {
    if (!hasPermission(user, "announcements.edit")) return;
    const newStatus = !announcement.published;

    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("announcements")
        .update({
          published: newStatus,

          updated_at: new Date().toISOString(),
        })
        .eq("id", announcement.id);

      if (error) {
        throw error;
      }

      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id
            ? {
                ...item,
                published: newStatus,
              }
            : item,
        ),
      );

      setSuccess(
        newStatus ? "Announcement published." : "Announcement unpublished.",
      );
    } catch (err: any) {
      console.error("ANNOUNCEMENT STATUS ERROR:", err);

      setError(err?.message || "Unable to update announcement.");
    }
  }

  /* ============================================================
     FILTER
  ============================================================ */

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return announcements.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query);

      const matchesCategory = filter === "All" || item.category === filter;

      return matchesSearch && matchesCategory;
    });
  }, [announcements, search, filter]);

  /* ============================================================
     STATS
  ============================================================ */

  const total = announcements.length;

  const publishedCount = announcements.filter((item) => item.published).length;

  const importantCount = announcements.filter(
    (item) => item.priority === "Important" || item.priority === "Urgent",
  ).length;

  /* ============================================================
     DATE
  ============================================================ */

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /* ============================================================
     PAGE
  ============================================================ */

  if (!hasPermission(user, "announcements.view")) {
    return <PermissionDenied onBack={onBack} />;
  }

  return (
    <div className="announcements-page">
      {/* ======================================================
          BACK TO DASHBOARD
      ====================================================== */}

      <BackToDashboard onBack={onBack} />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="announcement-header">
        <div className="announcement-title-block">
          <div className="announcement-eyebrow">COMMUNICATION</div>

          <h1>Announcements</h1>

          <p>Create and manage college announcements for students.</p>
        </div>

        <button
          type="button"
          className="announcement-create-btn"
          onClick={openCreate}
          disabled={!hasPermission(user, "announcements.create")}
        >
          <span>+</span>
          New Announcement
        </button>
      </div>

      {/* ======================================================
          ALERTS
      ====================================================== */}

      {error && (
        <div className="announcement-alert error">
          <span>{error}</span>

          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="announcement-alert success">
          <span>{success}</span>

          <button type="button" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      {/* ======================================================
          STATS
      ====================================================== */}

      <div className="announcement-stats">
        <div className="announcement-stat-card">
          <div className="stat-icon blue">
            <span>▣</span>
          </div>

          <div>
            <span>Total</span>

            <strong>{total}</strong>
          </div>
        </div>

        <div className="announcement-stat-card">
          <div className="stat-icon green">
            <span>✓</span>
          </div>

          <div>
            <span>Published</span>

            <strong>{publishedCount}</strong>
          </div>
        </div>

        <div className="announcement-stat-card">
          <div className="stat-icon orange">
            <span>!</span>
          </div>

          <div>
            <span>Important</span>

            <strong>{importantCount}</strong>
          </div>
        </div>

        <div className="announcement-stat-card">
          <div className="stat-icon purple">
            <span>↗</span>
          </div>

          <div>
            <span>Visible to Students</span>

            <strong>{publishedCount}</strong>
          </div>
        </div>
      </div>

      {/* ======================================================
          SEARCH
      ====================================================== */}

      <div className="announcement-toolbar">
        <div className="announcement-search">
          <span>⌕</span>

          <input
            type="text"
            value={search}
            placeholder="Search announcements..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="announcement-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="All">All Categories</option>

          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {/* ======================================================
          ANNOUNCEMENT LIST
      ====================================================== */}

      <div className="announcement-list">
        {loading ? (
          <div className="announcement-empty">
            <div className="loading-circle" />

            <p>Loading announcements...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="announcement-empty">
            <div className="empty-icon">!</div>

            <h3>No announcements found</h3>

            <p>Create your first announcement to get started.</p>

            <button
              type="button"
              className="empty-create-btn"
              onClick={openCreate}
            >
              Create Announcement
            </button>
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`announcement-card priority-${announcement.priority.toLowerCase()}`}
            >
              {/* LEFT PRIORITY */}

              <div className="announcement-priority" />

              {/* CONTENT */}

              <div className="announcement-card-content">
                <div className="announcement-card-top">
                  <div className="announcement-tags">
                    <span className="category-tag">
                      {announcement.category}
                    </span>

                    <span
                      className={`priority-tag ${announcement.priority.toLowerCase()}`}
                    >
                      {announcement.priority}
                    </span>

                    <span
                      className={
                        announcement.published
                          ? "status-tag published"
                          : "status-tag draft"
                      }
                    >
                      {announcement.published ? "Published" : "Draft"}
                    </span>
                  </div>

                  <span
                    className="announcement-audience-tag"
                    title={
                      announcement.audience_type === "all"
                        ? "Visible to all students"
                        : `${announcement.target_course || ""} • Semester ${announcement.target_semester ?? ""}`
                    }
                  >
                    {announcement.audience_type === "all"
                      ? "All Students"
                      : `${announcement.target_course || "Course"} • Sem ${announcement.target_semester ?? "-"}`}
                  </span>

                  <span className="announcement-date">
                    {formatDate(announcement.created_at)}
                  </span>
                </div>

                <h2>{announcement.title}</h2>

                <p>{announcement.description}</p>
              </div>

              {/* ==================================================
                    RIGHT ACTIONS
                ================================================== */}

              <div className="announcement-actions">
                <button
                  type="button"
                  className="announcement-action-btn edit"
                  disabled={!hasPermission(user, "announcements.edit")}
                  onClick={() => openEdit(announcement)}
                >
                  <span className="action-icon">✎</span>
                  Edit
                </button>

                <button
                  type="button"
                  className={`announcement-action-btn ${
                    announcement.published ? "unpublish" : "publish"
                  }`}
                  disabled={!hasPermission(user, "announcements.edit")}
                  onClick={() => togglePublished(announcement)}
                >
                  <span className="action-icon">
                    {announcement.published ? "○" : "✓"}
                  </span>

                  {announcement.published ? "Unpublish" : "Publish"}
                </button>

                <button
                  type="button"
                  className="announcement-action-btn delete"
                  disabled={!hasPermission(user, "announcements.delete")}
                  onClick={() => deleteAnnouncement(announcement.id)}
                >
                  <span className="action-icon">×</span>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ======================================================
          CREATE / EDIT MODAL
      ====================================================== */}

      {showModal && (
        <div
          className="announcement-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="announcement-modal">
            {/* MODAL HEADER */}

            <div className="modal-header">
              <div>
                <span>
                  {editingId ? "EDIT ANNOUNCEMENT" : "NEW ANNOUNCEMENT"}
                </span>

                <h2>
                  {editingId ? "Update announcement" : "Create announcement"}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            {/* FORM */}

            <form onSubmit={saveAnnouncement}>
              {/* TITLE */}

              <div className="form-group">
                <label>Announcement Title</label>

                <input
                  type="text"
                  value={title}
                  placeholder="Enter announcement title"
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>

              {/* DESCRIPTION */}

              <div className="form-group">
                <label>Description</label>

                <textarea
                  value={description}
                  placeholder="Write announcement details..."
                  rows={6}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                />
              </div>

              {/* CATEGORY / PRIORITY */}

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>

                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>

                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    {PRIORITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AUDIENCE */}

              <div className="form-group audience-group">
                <label>Send Announcement To</label>

                <div className="audience-options">
                  <button
                    type="button"
                    className={`audience-option ${
                      audienceType === "all" ? "active" : ""
                    }`}
                    onClick={() => {
                      setAudienceType("all");
                      setTargetCourse("");
                      setTargetSemester("");
                    }}
                  >
                    <strong>All Students</strong>

                    <span>Send to every student</span>
                  </button>

                  <button
                    type="button"
                    className={`audience-option ${
                      audienceType === "course_semester" ? "active" : ""
                    }`}
                    onClick={() => setAudienceType("course_semester")}
                  >
                    <strong>Specific Course & Semester</strong>

                    <span>Only matching students receive it</span>
                  </button>
                </div>
              </div>

              {audienceType === "course_semester" && (
                <div className="form-row audience-target-row">
                  <div className="form-group">
                    <label>Course</label>

                    <select
                      value={targetCourse}
                      onChange={(event) => setTargetCourse(event.target.value)}
                    >
                      <option value="">Select course</option>

                      {courses.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Semester</label>

                    <select
                      value={targetSemester}
                      onChange={(event) =>
                        setTargetSemester(
                          event.target.value ? Number(event.target.value) : "",
                        )
                      }
                    >
                      <option value="">Select semester</option>

                      {semesters.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* PUBLISH */}

              <div className="publish-control">
                <div>
                  <strong>Publish to Students</strong>

                  <span>
                    Published announcements will appear in the student app.
                  </span>
                </div>

                <button
                  type="button"
                  className={`toggle ${published ? "active" : ""}`}
                  onClick={() => setPublished(!published)}
                >
                  <span />
                </button>
              </div>

              {/* BUTTONS */}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-btn"
                  disabled={
                    saving ||
                    !hasPermission(
                      user,
                      editingId ? "announcements.edit" : "announcements.create",
                    )
                  }
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Announcement"
                      : "Publish Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .announcement-audience-tag {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          background: #eef4ff;
          border: 1px solid #d7e5ff;
          color: #1d4ed8;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .audience-group {
          margin-top: 16px;
        }

        .audience-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 8px;
        }

        .audience-option {
          min-height: 72px;
          padding: 12px 13px;
          border: 1px solid #dbe3ee;
          border-radius: 12px;
          background: #ffffff;
          color: #102a56;
          text-align: left;
          cursor: pointer;
          transition: 0.16s ease;
        }

        .audience-option:hover {
          border-color: #9db8df;
          background: #f8fbff;
        }

        .audience-option.active {
          border-color: #123b78;
          background: #f1f6ff;
          box-shadow: 0 0 0 2px rgba(18, 59, 120, 0.08);
        }

        .audience-option strong,
        .audience-option span {
          display: block;
        }

        .audience-option strong {
          font-size: 11px;
          font-weight: 900;
        }

        .audience-option span {
          margin-top: 4px;
          color: #64748b;
          font-size: 9px;
          font-weight: 600;
          line-height: 1.35;
        }

        .audience-target-row {
          margin-top: 10px;
        }

        @media (max-width: 600px) {
          .audience-options {
            grid-template-columns: 1fr;
          }

          .announcement-audience-tag {
            order: 3;
          }
        }
      `}</style>
    </div>
  );
}
