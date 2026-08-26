"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackToDashboard from "./BackToDashboard";
import PermissionDenied from "./PermissionDenied";
import { AppUser, hasPermission } from "@/lib/permissions";

type LeaveRequest = {
  id: string;

  student_id: string | null;

  student_name: string;

  admission_no: string | null;

  course: string | null;

  semester: number | null;

  from_date: string;

  to_date: string;

  reason: string;

  status:
    | "pending"
    | "approved"
    | "rejected";

  reviewed_by: string | null;

  reviewer_name: string | null;

  reviewer_note: string | null;

  reviewed_at: string | null;

  created_at: string;

  updated_at: string;
};

export default function LeaveRequests({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const [requests, setRequests] =
    useState<LeaveRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedRequest, setSelectedRequest] =
    useState<LeaveRequest | null>(null);

  const [reviewNote, setReviewNote] =
    useState("");

  const [processing, setProcessing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* ============================================================
     LOAD LEAVE REQUESTS
  ============================================================ */

  async function loadRequests() {
    setLoading(true);
    setError("");

    const {
      data,
      error,
    } = await supabase
      .from("leave_requests")
      .select(
        `
          id,
          student_id,
          student_name,
          admission_no,
          course,
          semester,
          from_date,
          to_date,
          reason,
          status,
          reviewed_by,
          reviewer_name,
          reviewer_note,
          reviewed_at,
          created_at,
          updated_at
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Leave request error:",
        error
      );

      setError(error.message);

      setRequests([]);
    } else {
      setRequests(
        (data || []) as LeaveRequest[]
      );
    }

    setLoading(false);
  }

  /* ============================================================
     INITIAL LOAD
  ============================================================ */

  useEffect(() => {
    loadRequests();
  }, []);

  /* ============================================================
     REALTIME
  ============================================================ */

  useEffect(() => {
    const channel = supabase
      .channel("leave-requests-website")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
        },
        () => {
          loadRequests();
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  /* ============================================================
     STATISTICS
  ============================================================ */

  const pendingCount =
    requests.filter(
      (item) =>
        item.status === "pending"
    ).length;

  const approvedCount =
    requests.filter(
      (item) =>
        item.status === "approved"
    ).length;

  const rejectedCount =
    requests.filter(
      (item) =>
        item.status === "rejected"
    ).length;

  /* ============================================================
     FILTER
  ============================================================ */

  const filteredRequests =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return requests.filter(
        (item) => {
          const matchesSearch =
            !query ||
            item.student_name
              .toLowerCase()
              .includes(query) ||

            (
              item.admission_no ||
              ""
            )
              .toLowerCase()
              .includes(query) ||

            (
              item.course ||
              ""
            )
              .toLowerCase()
              .includes(query) ||

            item.reason
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            statusFilter === "all" ||
            item.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      requests,
      search,
      statusFilter,
    ]);

  /* ============================================================
     OPEN REQUEST
  ============================================================ */

  function openRequest(
    request: LeaveRequest
  ) {
    setSelectedRequest(
      request
    );

    setReviewNote(
      request.reviewer_note ||
        ""
    );

    setError("");
    setSuccess("");
  }

  /* ============================================================
     CLOSE REQUEST
  ============================================================ */

  function closeRequest() {
    if (processing) return;

    setSelectedRequest(
      null
    );

    setReviewNote("");
  }

  /* ============================================================
     APPROVE / REJECT
  ============================================================ */

  async function reviewRequest(
    status:
      | "approved"
      | "rejected"
  ) {
    const requiredPermission = status === "approved" ? "leaves.approve" : "leaves.reject";
    if (!hasPermission(user, requiredPermission)) return;
    if (!selectedRequest) {
      return;
    }

    setProcessing(true);

    setError("");
    setSuccess("");

    try {
      const {
        data: authData,
      } =
        await supabase.auth.getUser();

      const user =
        authData?.user;

      let reviewerName =
        "Admin";

      if (user) {
        reviewerName =
          user.user_metadata
            ?.name ||
          user.user_metadata
            ?.full_name ||
          user.email ||
          "Admin";
      }

      const {
        error,
      } = await supabase
        .from(
          "leave_requests"
        )
        .update({
          status,

          reviewed_by:
            user?.id ||
            null,

          reviewer_name:
            reviewerName,

          reviewer_note:
            reviewNote.trim() ||
            null,

          reviewed_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          selectedRequest.id
        );

      if (error) {
        throw error;
      }

      setSuccess(
        status ===
          "approved"
          ? "Leave request approved successfully."
          : "Leave request rejected."
      );

      setSelectedRequest(
        null
      );

      setReviewNote("");

      await loadRequests();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to update leave request."
      );
    } finally {
      setProcessing(false);
    }
  }

  /* ============================================================
     REOPEN
  ============================================================ */

  async function reopenRequest(
    request: LeaveRequest
  ) {
    if (!hasPermission(user, "leaves.reject")) return;
    setError("");
    setSuccess("");

    const {
      error,
    } = await supabase
      .from(
        "leave_requests"
      )
      .update({
        status: "pending",

        reviewed_by: null,

        reviewer_name: null,

        reviewer_note: null,

        reviewed_at: null,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        request.id
      );

    if (error) {
      setError(
        error.message
      );

      return;
    }

    setSuccess(
      "Leave request reopened."
    );

    await loadRequests();

    setSelectedRequest(
      null
    );
  }

  /* ============================================================
     DELETE
  ============================================================ */

  async function deleteRequest(
    request: LeaveRequest
  ) {
    if (!hasPermission(user, "leaves.reject")) return;
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this leave request?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    const {
      error,
    } = await supabase
      .from(
        "leave_requests"
      )
      .delete()
      .eq(
        "id",
        request.id
      );

    if (error) {
      setError(
        error.message
      );

      return;
    }

    setRequests(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            request.id
        )
    );

    setSuccess(
      "Leave request deleted."
    );

    if (
      selectedRequest?.id ===
      request.id
    ) {
      setSelectedRequest(
        null
      );
    }
  }

  /* ============================================================
     DATE FORMAT
  ============================================================ */

  function formatDate(
    value: string
  ) {
    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  /* ============================================================
     NUMBER OF DAYS
  ============================================================ */

  function calculateDays(
    from: string,
    to: string
  ) {
    const start =
      new Date(
        `${from}T00:00:00`
      );

    const end =
      new Date(
        `${to}T00:00:00`
      );

    const difference =
      end.getTime() -
      start.getTime();

    return (
      Math.floor(
        difference /
          (1000 *
            60 *
            60 *
            24)
      ) + 1
    );
  }

  /* ============================================================
     PAGE
  ============================================================ */

  if (!hasPermission(user, "leaves.view")) {
    return <PermissionDenied onBack={onBack} />;
  }

  return (
    <div className="leave-page">

      {/* BACK */}

      <BackToDashboard
        onBack={onBack}
      />

      {/* HEADER */}

      <div className="leave-header">

        <div>

          <span className="leave-eyebrow">
            STUDENT SERVICES
          </span>

          <h1>
            Leave Requests
          </h1>

          <p>
            Review and manage student
            leave applications.
          </p>

        </div>

      </div>

      {/* ALERT */}

      {error && (
        <div className="leave-alert error">
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
        <div className="leave-alert success">
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

      {/* STATS */}

      <div className="leave-stats">

        <div className="leave-stat pending-stat">

          <span>
            PENDING
          </span>

          <strong>
            {pendingCount}
          </strong>

        </div>

        <div className="leave-stat approved-stat">

          <span>
            APPROVED
          </span>

          <strong>
            {approvedCount}
          </strong>

        </div>

        <div className="leave-stat rejected-stat">

          <span>
            REJECTED
          </span>

          <strong>
            {rejectedCount}
          </strong>

        </div>

        <div className="leave-stat">

          <span>
            TOTAL
          </span>

          <strong>
            {requests.length}
          </strong>

        </div>

      </div>

      {/* FILTER */}

      <div className="leave-toolbar">

        <div className="leave-search">

          <span>
            ⌕
          </span>

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search student, admission number, course or reason..."
          />

        </div>

        <select
          value={
            statusFilter
          }
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
        >

          <option value="all">
            All Requests
          </option>

          <option value="pending">
            Pending
          </option>

          <option value="approved">
            Approved
          </option>

          <option value="rejected">
            Rejected
          </option>

        </select>

      </div>

      {/* REQUEST LIST */}

      <div className="leave-list">

        {loading ? (

          <div className="leave-empty">

            <div className="leave-loading" />

            <strong>
              Loading leave requests...
            </strong>

          </div>

        ) : filteredRequests.length ===
          0 ? (

          <div className="leave-empty">

            <div className="leave-empty-icon">
              ✓
            </div>

            <strong>
              No leave requests
            </strong>

            <span>
              Student leave applications
              will appear here.
            </span>

          </div>

        ) : (

          filteredRequests.map(
            (request) => (

              <div
                key={request.id}
                className={`leave-card ${request.status}`}
              >

                <div className="leave-card-main">

                  <div className="leave-card-top">

                    <div className="leave-tags">

                      <span
                        className={`leave-status ${request.status}`}
                      >
                        {request.status}
                      </span>

                    </div>

                    <span className="leave-date">
                      {formatDate(
                        request.created_at
                          .split("T")[0]
                      )}
                    </span>

                  </div>

                  <h2>
                    {
                      request.student_name
                    }
                  </h2>

                  <p>
                    {
                      request.reason
                    }
                  </p>

                  <div className="leave-meta">

                    <span>
                      Admission:{" "}
                      {
                        request.admission_no ||
                        "-"
                      }
                    </span>

                    <span>
                      {
                        request.course ||
                        "-"
                      }
                    </span>

                    <span>
                      Semester{" "}
                      {
                        request.semester ??
                        "-"
                      }
                    </span>

                    <span>
                      {
                        formatDate(
                          request.from_date
                        )
                      }
                      {" → "}
                      {
                        formatDate(
                          request.to_date
                        )
                      }
                    </span>

                    <span>
                      {
                        calculateDays(
                          request.from_date,
                          request.to_date
                        )
                      }{" "}
                      day(s)
                    </span>

                  </div>

                </div>

                {/* ACTIONS */}

                <div className="leave-actions">

                  <button
                    className="leave-view-btn"
                    onClick={() =>
                      openRequest(
                        request
                      )
                    }
                  >
                    Review
                  </button>

                  <button
                    className="leave-delete-btn"
                    onClick={() =>
                      deleteRequest(
                        request
                      )
                    }
                  >
                    Delete
                  </button>

                </div>

              </div>
            )
          )
        )}

      </div>

      {/* ========================================================
          REVIEW MODAL
      ======================================================== */}

      {selectedRequest && (

        <div
          className="leave-modal-overlay"
          onMouseDown={(e) => {

            if (
              e.target ===
              e.currentTarget
            ) {
              closeRequest();
            }

          }}
        >

          <div className="leave-modal">

            {/* HEADER */}

            <div className="leave-modal-header">

              <div>

                <span>
                  LEAVE APPLICATION
                </span>

                <h2>
                  Review Request
                </h2>

              </div>

              <button
                onClick={
                  closeRequest
                }
              >
                ×
              </button>

            </div>

            {/* STUDENT */}

            <div className="leave-profile">

              <div className="leave-avatar">

                {
                  selectedRequest
                    .student_name
                    .charAt(0)
                    .toUpperCase()
                }

              </div>

              <div>

                <strong>
                  {
                    selectedRequest.student_name
                  }
                </strong>

                <span>
                  Admission No:{" "}
                  {
                    selectedRequest.admission_no ||
                    "-"
                  }
                </span>

                <span>
                  {
                    selectedRequest.course ||
                    "-"
                  }
                  {" · Semester "}
                  {
                    selectedRequest.semester ??
                    "-"
                  }
                </span>

              </div>

            </div>

            {/* DETAILS */}

            <div className="leave-details">

              <div>

                <span>
                  FROM
                </span>

                <strong>
                  {
                    formatDate(
                      selectedRequest.from_date
                    )
                  }
                </strong>

              </div>

              <div>

                <span>
                  TO
                </span>

                <strong>
                  {
                    formatDate(
                      selectedRequest.to_date
                    )
                  }
                </strong>

              </div>

              <div>

                <span>
                  DURATION
                </span>

                <strong>
                  {
                    calculateDays(
                      selectedRequest.from_date,
                      selectedRequest.to_date
                    )
                  }{" "}
                  day(s)
                </strong>

              </div>

              <div>

                <span>
                  STATUS
                </span>

                <strong>
                  {
                    selectedRequest.status
                  }
                </strong>

              </div>

            </div>

            {/* REASON */}

            <div className="leave-reason">

              <span>
                REASON
              </span>

              <p>
                {
                  selectedRequest.reason
                }
              </p>

            </div>

            {/* REVIEW NOTE */}

            {selectedRequest.status ===
              "pending" && (

              <div className="leave-note">

                <label>
                  Review Note
                </label>

                <textarea
                  value={
                    reviewNote
                  }
                  onChange={(e) =>
                    setReviewNote(
                      e.target.value
                    )
                  }
                  rows={4}
                  placeholder="Optional note for the student..."
                />

              </div>

            )}

            {/* PREVIOUS REVIEW */}

            {selectedRequest.status !==
              "pending" && (

              <div className="leave-review-box">

                <span>
                  REVIEW
                </span>

                <strong>
                  {
                    selectedRequest.status
                  }
                </strong>

                <p>
                  {
                    selectedRequest.reviewer_note ||
                    "No review note added."
                  }
                </p>

                <small>
                  {
                    selectedRequest.reviewer_name ||
                    "Admin"
                  }
                </small>

              </div>

            )}

            {/* ACTIONS */}

            <div className="leave-modal-actions">

              <button
                className="leave-cancel"
                onClick={
                  closeRequest
                }
              >
                Close
              </button>

              {selectedRequest.status ===
                "pending" ? (

                <>

                  <button
                    className="leave-reject"
                    disabled={
                      processing ||
                      !hasPermission(user, "leaves.reject")
                    }
                    onClick={() =>
                      reviewRequest(
                        "rejected"
                      )
                    }
                  >
                    {processing
                      ? "Processing..."
                      : "Reject"}
                  </button>

                  <button
                    className="leave-approve"
                    disabled={
                      processing ||
                      !hasPermission(user, "leaves.approve")
                    }
                    onClick={() =>
                      reviewRequest(
                        "approved"
                      )
                    }
                  >
                    {processing
                      ? "Processing..."
                      : "Approve"}
                  </button>

                </>

              ) : (

                <button
                  className="leave-reopen"
                  onClick={() =>
                    reopenRequest(
                      selectedRequest
                    )
                  }
                  disabled={!hasPermission(user, "leaves.reject")}
                >
                  Reopen Request
                </button>

              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}