"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import { AppUser, hasPermission } from "@/lib/permissions";

type OnlineClass = {
  id: string;
  title: string;
  subject: string | null;
  course: string | null;
  semester: number | null;
  teacher_id: string | null;
  teacher_name: string | null;
  meeting_url: string;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  description: string | null;
  created_at: string;
  updated_at: string;
};

export default function OnlineClasses({ onBack, user }: { onBack: () => void; user: AppUser }) {
  const [classes, setClasses] = useState<OnlineClass[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");

  const [subject, setSubject] = useState("");

  const [course, setCourse] = useState("");

  const [semester, setSemester] = useState("");

  const [teacherName, setTeacherName] = useState("");

  const [meetingUrl, setMeetingUrl] = useState("");

  const [scheduledDate, setScheduledDate] = useState("");

  const [startTime, setStartTime] = useState("");

  const [endTime, setEndTime] = useState("");

  const [description, setDescription] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  /* ============================================================
     LOAD
  ============================================================ */

  async function loadClasses() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("online_classes")
      .select("*")
      .order("scheduled_date", {
        ascending: true,
      })
      .order("start_time", {
        ascending: true,
      });

    if (error) {
      setError(error.message);
      setClasses([]);
    } else {
      setClasses((data || []) as OnlineClass[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadClasses();
  }, []);

  /* ============================================================
     REALTIME
  ============================================================ */

  useEffect(() => {
    const channel = supabase
      .channel("online-classes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "online_classes",
        },
        () => {
          loadClasses();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ============================================================
     RESET
  ============================================================ */

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setSubject("");
    setCourse("");
    setSemester("");
    setTeacherName("");
    setMeetingUrl("");
    setScheduledDate("");
    setStartTime("");
    setEndTime("");
    setDescription("");
  }

  function openCreate() {
    if (!hasPermission(user, "online.create")) return;
    resetForm();
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  /* ============================================================
     EDIT
  ============================================================ */

  function openEdit(item: OnlineClass) {
    if (!hasPermission(user, "online.edit")) return;
    setEditingId(item.id);

    setTitle(item.title);
    setSubject(item.subject || "");
    setCourse(item.course || "");
    setSemester(item.semester?.toString() || "");
    setTeacherName(item.teacher_name || "");
    setMeetingUrl(item.meeting_url);
    setScheduledDate(item.scheduled_date);
    setStartTime(item.start_time.slice(0, 5));
    setEndTime(item.end_time ? item.end_time.slice(0, 5) : "");
    setDescription(item.description || "");

    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    resetForm();
  }

  /* ============================================================
     SAVE
  ============================================================ */

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();

    const requiredPermission = editingId ? "online.edit" : "online.create";
    if (!hasPermission(user, requiredPermission)) {
      setError("You don't have permission for this action.");
      return;
    }

    setError("");
    setSuccess("");

    if (!title.trim() || !meetingUrl.trim() || !scheduledDate || !startTime) {
      setError("Please fill all required fields.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: title.trim(),

        subject: subject.trim() || null,

        course: course.trim() || null,

        semester: semester ? Number(semester) : null,

        teacher_name: teacherName.trim() || null,

        meeting_url: meetingUrl.trim(),

        scheduled_date: scheduledDate,

        start_time: startTime,

        end_time: endTime || null,

        description: description.trim() || null,

        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("online_classes")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;

        setSuccess("Online class updated successfully.");
      } else {
        const { error } = await supabase.from("online_classes").insert({
          ...payload,
          status: "scheduled",
        });

        if (error) throw error;

        setSuccess("Online class created successfully.");
      }

      setShowModal(false);
      resetForm();

      await loadClasses();
    } catch (err: any) {
      setError(err?.message || "Unable to save online class.");
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     STATUS
  ============================================================ */

  async function updateStatus(
    item: OnlineClass,
    status: OnlineClass["status"],
  ) {
    if (!hasPermission(user, "online.edit")) return;
    const { error } = await supabase
      .from("online_classes")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadClasses();
  }

  /* ============================================================
     DELETE
  ============================================================ */

  async function deleteClass(item: OnlineClass) {
    if (!hasPermission(user, "online.delete")) return;
    if (!window.confirm("Are you sure you want to delete this online class?")) {
      return;
    }

    const { error } = await supabase
      .from("online_classes")
      .delete()
      .eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Online class deleted successfully.");

    await loadClasses();
  }

  /* ============================================================
     FILTER
  ============================================================ */

  const filteredClasses = classes.filter((item) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      (item.subject || "").toLowerCase().includes(query) ||
      (item.course || "").toLowerCase().includes(query) ||
      (item.teacher_name || "").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  /* ============================================================
     FORMAT
  ============================================================ */

  function formatDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(value: string) {
    const [hour, minute] = value.split(":");

    const date = new Date();

    date.setHours(Number(hour), Number(minute));

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* ============================================================
     PAGE
  ============================================================ */

  if (!hasPermission(user, "online.view")) {
    return <PermissionDenied onBack={onBack} />;
  }

  return (
    <div className="online-classes-page">
      <BackToDashboard onBack={onBack} />

      {/* HEADER */}

      <div className="online-header">
        <div>
          <span className="online-eyebrow">ACADEMIC</span>

          <h1>Online Classes</h1>

          <p>Schedule and manage online classes for students.</p>
        </div>

        <button className="online-create-btn" onClick={openCreate} disabled={!hasPermission(user, "online.create")}>
          <span>+</span>
          New Online Class
        </button>
      </div>

      {/* ALERT */}

      {error && <div className="online-alert error">{error}</div>}

      {success && <div className="online-alert success">{success}</div>}

      {/* STATS */}

      <div className="online-stats">
        <div className="online-stat">
          <span>TOTAL</span>
          <strong>{classes.length}</strong>
        </div>

        <div className="online-stat">
          <span>SCHEDULED</span>
          <strong>
            {classes.filter((x) => x.status === "scheduled").length}
          </strong>
        </div>

        <div className="online-stat">
          <span>LIVE NOW</span>
          <strong>{classes.filter((x) => x.status === "live").length}</strong>
        </div>

        <div className="online-stat">
          <span>COMPLETED</span>
          <strong>
            {classes.filter((x) => x.status === "completed").length}
          </strong>
        </div>
      </div>

      {/* TOOLBAR */}

      <div className="online-toolbar">
        <div className="online-search">
          <span>⌕</span>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes, subjects, courses or teachers..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>

          <option value="scheduled">Scheduled</option>

          <option value="live">Live</option>

          <option value="completed">Completed</option>

          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* LIST */}

      <div className="online-class-list">
        {loading ? (
          <div className="online-empty">Loading online classes...</div>
        ) : filteredClasses.length === 0 ? (
          <div className="online-empty">
            <div className="online-empty-icon">▶</div>

            <strong>No online classes found</strong>

            <span>Create your first online class to get started.</span>
          </div>
        ) : (
          filteredClasses.map((item) => (
            <div className={`online-class-card ${item.status}`} key={item.id}>
              <div className="online-class-main">
                <div className="online-class-top">
                  <div className="online-class-tags">
                    <span className="online-subject">
                      {item.subject || "General"}
                    </span>

                    <span className={`online-status ${item.status}`}>
                      {item.status}
                    </span>
                  </div>

                  <span className="online-date">
                    {formatDate(item.scheduled_date)}
                  </span>
                </div>

                <h2>{item.title}</h2>

                <p>{item.description || "Online class session"}</p>

                <div className="online-meta">
                  <span>{item.course || "All Courses"}</span>

                  <span>Semester {item.semester ?? "-"}</span>

                  <span>{item.teacher_name || "Teacher"}</span>

                  <span>
                    {formatTime(item.start_time)}
                    {item.end_time && ` - ${formatTime(item.end_time)}`}
                  </span>
                </div>
              </div>

              <div className="online-actions">
                {item.status === "scheduled" && (
                  <button
                    className="online-action live"
                    onClick={() => updateStatus(item, "live")}
                        disabled={!hasPermission(user, "online.edit")}
                  >
                    Start Class
                  </button>
                )}

                {item.status === "live" && (
                  <>
                    <a
                      href={item.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="online-action join"
                    >
                      Join Class
                    </a>

                    <button
                      className="online-action complete"
                      onClick={() => updateStatus(item, "completed")}
                        disabled={!hasPermission(user, "online.edit")}
                    >
                      End Class
                    </button>
                  </>
                )}

                {item.status === "completed" && (
                  <span className="completed-label">Completed</span>
                )}

                <button
                  className="online-action edit"
                  onClick={() => openEdit(item)}
                        disabled={!hasPermission(user, "online.edit")}
                >
                  Edit
                </button>

                <button
                  className="online-action delete"
                  onClick={() => deleteClass(item)}
                        disabled={!hasPermission(user, "online.delete")}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL */}

      {showModal && (
        <div
          className="online-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="online-modal">
            <div className="online-modal-header">
              <div>
                <span>
                  {editingId ? "EDIT ONLINE CLASS" : "NEW ONLINE CLASS"}
                </span>

                <h2>{editingId ? "Update class" : "Create online class"}</h2>
              </div>

              <button onClick={closeModal}>×</button>
            </div>

            <form onSubmit={saveClass} className="online-form">
              <div className="online-form-group">
                <label>Class Title *</label>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Example: English Grammar"
                  required
                />
              </div>

              <div className="online-form-row">
                <div className="online-form-group">
                  <label>Subject</label>

                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="English"
                  />
                </div>

                <div className="online-form-group">
                  <label>Teacher</label>

                  <input
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="Teacher name"
                  />
                </div>
              </div>

              <div className="online-form-row">
                <div className="online-form-group">
                  <label>Course</label>

                  <input
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="B.A English"
                  />
                </div>

                <div className="online-form-group">
                  <label>Semester</label>

                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
                    <option value="">Select Semester</option>

                    {[1, 2, 3, 4, 5, 6].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="online-form-group">
                <label>Meeting Link *</label>

                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  required
                />
              </div>

              <div className="online-form-row">
                <div className="online-form-group">
                  <label>Date *</label>

                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                  />
                </div>

                <div className="online-form-group">
                  <label>Start Time *</label>

                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="online-form-row">
                <div className="online-form-group">
                  <label>End Time</label>

                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                <div />
              </div>

              <div className="online-form-group">
                <label>Description</label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Add class instructions..."
                />
              </div>

              <div className="online-modal-actions">
                <button
                  type="button"
                  className="online-cancel"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button type="submit" className="online-save" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Class"
                      : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
