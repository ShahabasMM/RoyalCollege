"use client";

import { useEffect, useState } from "react";

import { modules } from "@/lib/modules";

import {
  AppUser,
  canAccess,
  hasPermission,
  Permission,
} from "@/lib/permissions";

import { supabase } from "@/lib/supabase";

import ModuleCard from "./ModuleCard";
import Icon from "./Icon";

<<<<<<< HEAD

/* =========================================================
   DASHBOARD STATS
========================================================= */

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
type DashboardStats = {
  totalStudents: number;
  presentToday: number;
  pendingLeaves: number;
  openDoubts: number;
};

<<<<<<< HEAD

/* =========================================================
   GET TODAY
========================================================= */

function getToday(): string {

  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================================================
   MODULE PERMISSION
========================================================= */

function getModulePermission(
  moduleId: string,
): Permission | null {

  switch (moduleId) {

    case "attendance":
      return "attendance.view";

    case "reports":
      return "attendance.view";

    case "students":
      return "students.view";

    case "announcements":
      return "announcements.view";

    case "timetable":
      return "timetable.view";

    case "syllabus":
      return "syllabus.view";

    case "doubts":
      return "doubts.view";

    case "online-class":
      return "online.view";

    case "leave":
      return "leaves.view";

    case "staff":
      return "staff.view";

    case "library":
      return "library.view";

=======
function getToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getModulePermission(moduleId: string): Permission | null {
  switch (moduleId) {
    case "attendance":
      return "attendance.view";
    case "reports":
      return "attendance.view";
    case "students":
      return "students.view";
    case "announcements":
      return "announcements.view";
    case "timetable":
      return "timetable.view";
    case "syllabus":
      return "syllabus.view";
    case "doubts":
      return "doubts.view";
    case "online-class":
      return "online.view";
    case "leave":
      return "leaves.view";
    case "staff":
      return "staff.view";
    case "library":
      return "library.view";
    case "internal-marks":
      return "internal_marks.view";
    case "monthly-report":
      return "monthly_report.view";
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    default:
      return null;
  }
}

<<<<<<< HEAD

/* =========================================================
   DASHBOARD
========================================================= */

=======
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
export default function Dashboard({
  onModule,
  user,
}: {
  onModule: (id: string) => void;
  user: AppUser;
}) {
<<<<<<< HEAD

  /* =======================================================
     STATE
  ======================================================= */

  const [
    stats,
    setStats,
  ] = useState<DashboardStats>({
=======
  const [stats, setStats] = useState<DashboardStats>({
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
    totalStudents: 0,
    presentToday: 0,
    pendingLeaves: 0,
    openDoubts: 0,
  });

<<<<<<< HEAD

  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  /* =======================================================
     LOAD DASHBOARD DATA
  ======================================================= */

  async function loadDashboardData() {

    setLoading(true);

    setError("");

    try {

      const today =
        getToday();

=======
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboardData() {
    setLoading(true);
    setError("");

    try {
      const today = getToday();
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)

      let totalStudents = 0;
      let presentToday = 0;
      let pendingLeaves = 0;
      let openDoubts = 0;

<<<<<<< HEAD

      /* =====================================================
         STUDENTS
      ===================================================== */

      if (
        hasPermission(
          user,
          "students.view",
        )
      ) {

        const {
          count,
          error,
        } = await supabase
          .from("students")
          .select(
            "id",
            {
              count: "exact",
              head: true,
            },
          );


        if (error) {
          throw new Error(
            `Students: ${error.message}`,
          );
        }


        totalStudents =
          count ?? 0;
      }


      /* =====================================================
         ATTENDANCE
      ===================================================== */

      if (
        hasPermission(
          user,
          "attendance.view",
        )
      ) {

        const {
          count,
          error,
        } = await supabase
          .from("attendance")
          .select(
            "id",
            {
              count: "exact",
              head: true,
            },
          )
          .eq(
            "attendance_date",
            today,
          )
          .eq(
            "status",
            "Present",
          );


        if (error) {
          throw new Error(
            `Attendance: ${error.message}`,
          );
        }


        presentToday =
          count ?? 0;
      }


      /* =====================================================
         LEAVES
      ===================================================== */

      if (
        hasPermission(
          user,
          "leaves.view",
        )
      ) {

        const {
          count,
          error,
        } = await supabase
          .from(
            "leave_requests",
          )
          .select(
            "id",
            {
              count: "exact",
              head: true,
            },
          )
          .eq(
            "status",
            "Pending",
          );


        if (error) {
          throw new Error(
            `Leave Requests: ${error.message}`,
          );
        }


        pendingLeaves =
          count ?? 0;
      }


      /* =====================================================
         DOUBTS
      ===================================================== */

      if (
        hasPermission(
          user,
          "doubts.view",
        )
      ) {

        const {
          count,
          error,
        } = await supabase
          .from("doubts")
          .select(
            "id",
            {
              count: "exact",
              head: true,
            },
          )
          .eq(
            "status",
            "Open",
          );


        if (error) {
          throw new Error(
            `Doubts: ${error.message}`,
          );
        }


        openDoubts =
          count ?? 0;
      }


      /* =====================================================
         SAVE STATS
      ===================================================== */

=======
      if (hasPermission(user, "students.view")) {
        const { count, error } = await supabase
          .from("students")
          .select("id", { count: "exact", head: true });

        if (error) {
          throw new Error(`Students: ${error.message}`);
        }

        totalStudents = count ?? 0;
      }

      if (hasPermission(user, "attendance.view")) {
        const { count, error } = await supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("attendance_date", today)
          .eq("status", "Present");

        if (error) {
          throw new Error(`Attendance: ${error.message}`);
        }

        presentToday = count ?? 0;
      }

      if (hasPermission(user, "leaves.view")) {
        const { count, error } = await supabase
          .from("leave_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "Pending");

        if (error) {
          throw new Error(`Leave Requests: ${error.message}`);
        }

        pendingLeaves = count ?? 0;
      }

      if (hasPermission(user, "doubts.view")) {
        const { count, error } = await supabase
          .from("doubts")
          .select("id", { count: "exact", head: true })
          .eq("status", "Open");

        if (error) {
          throw new Error(`Doubts: ${error.message}`);
        }

        openDoubts = count ?? 0;
      }

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      setStats({
        totalStudents,
        presentToday,
        pendingLeaves,
        openDoubts,
      });
<<<<<<< HEAD

    } catch (
      err: any
    ) {

      console.error(
        "DASHBOARD DATA ERROR:",
        err,
      );


      setError(
        err?.message ??
          "Unable to load dashboard data.",
      );

    } finally {

      setLoading(false);

    }
  }


  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {

    loadDashboardData();

  }, []);


  /* =======================================================
     DATE
  ======================================================= */

  const displayDate =
    new Intl.DateTimeFormat(
      "en-US",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(
      new Date(),
    );


  /* =======================================================
     STAT CARDS
========================================================= */

  const statCards =
    [

      hasPermission(
        user,
        "students.view",
      ) && {

        label:
          "Total Students",

        value:
          stats.totalStudents,

        note:
          "Registered students",

        icon:
          "users",
      },


      hasPermission(
        user,
        "attendance.view",
      ) && {

        label:
          "Present Today",

        value:
          stats.presentToday,

        note:
          "Students marked present",

        icon:
          "check",
      },


      hasPermission(
        user,
        "leaves.view",
      ) && {

        label:
          "Pending Leaves",

        value:
          stats.pendingLeaves,

        note:
          "Awaiting review",

        icon:
          "clock",
      },


      hasPermission(
        user,
        "doubts.view",
      ) && {

        label:
          "Open Doubts",

        value:
          stats.openDoubts,

        note:
          "Need attention",

        icon:
          "help",
      },

    ].filter(Boolean) as Array<{
      label: string;
      value: number;
      note: string;
      icon: string;
    }>;


  /* =======================================================
     VISIBLE MODULES
========================================================= */

  const visibleModules =
    modules.filter(
      (module) => {

        const requiredPermission =
          getModulePermission(
            module.id,
          );


        if (
          requiredPermission ===
          null
        ) {

          return true;

        }


        return canAccess(
          user,
          requiredPermission,
        );

      },
    );


  /* =======================================================
     UI
========================================================= */

  return (
    <>

      {/* =================================================
          PAGE INTRO
      ================================================= */}

      <section className="pageIntro">

        <div>

          <div className="eyebrow">
            ROYAL COLLEGE OF ARTS AND SCIENCE
          </div>


          <h1>
            Dashboard
          </h1>


          <p>
            Manage the student application
            from one simple administration
            workspace.
          </p>

        </div>


        <div className="dateBox">
          {displayDate}
        </div>

      </section>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (

        <div
          style={{
            marginBottom: "16px",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid #fecaca",
            background: "#fff5f5",
            color: "#b91c1c",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {error}
        </div>

      )}


      {/* =================================================
          TOP STAT CARDS
          
          ONLY:
          Students
          Attendance
          Leaves
          Doubts
      ================================================= */}

      <section className="statsGrid">

        {statCards.map(
          (card) => (

            <div
              className="statCard"
              key={card.label}
            >

              <div className="statIcon">

                <Icon
                  name={card.icon}
                  size={21}
                />

              </div>


              <div>

                <span>
                  {card.label}
                </span>


                <strong>

                  {loading
                    ? "—"
                    : card.value.toLocaleString()}

                </strong>


                <small>
                  {card.note}
                </small>

              </div>

            </div>

          ),
        )}

      </section>


      {/* =================================================
          MODULE TITLE
      ================================================= */}

      <section className="sectionTitle">

        <div>

          <h2>
            Application Modules
          </h2>


          <p>
            Open a module to manage
            its data and controls.
          </p>

        </div>

      </section>


      {/* =================================================
          MODULE CARDS
      ================================================= */}

      <section className="moduleGrid">

        {visibleModules.map(
          (module) => (

            <ModuleCard
              key={
                module.id
              }

              module={
                module
              }

              onClick={() =>
                onModule(
                  module.id,
                )
              }
            />

          ),
        )}

      </section>

    </>
  );
}
=======
    } catch (err: any) {
      console.error("DASHBOARD DATA ERROR:", err);
      setError(err?.message ?? "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const displayDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const statCards = [
    hasPermission(user, "students.view") && {
      label: "Total Students",
      value: stats.totalStudents,
      note: "Registered students",
      icon: "users",
    },
    hasPermission(user, "attendance.view") && {
      label: "Present Today",
      value: stats.presentToday,
      note: "Students marked present",
      icon: "check",
    },
    hasPermission(user, "leaves.view") && {
      label: "Pending Leaves",
      value: stats.pendingLeaves,
      note: "Awaiting review",
      icon: "clock",
    },
    hasPermission(user, "doubts.view") && {
      label: "Open Doubts",
      value: stats.openDoubts,
      note: "Need attention",
      icon: "help",
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: number;
    note: string;
    icon: string;
  }>;

  const visibleModules = modules.filter((module) => {
    const requiredPermission = getModulePermission(module.id);

    if (requiredPermission === null) {
      return true;
    }

    return canAccess(user, requiredPermission);
  });

  return (
    <>
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap");

        .dashboardRoot,
        .dashboardRoot * {
          font-family: "Poppins", sans-serif;
        }

        .dashboardRoot {
          width: 100%;
          padding-bottom: 32px;
        }

        .pageIntro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 26px;
        }

        .eyebrow {
          margin-bottom: 7px;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .pageIntro h1 {
          margin: 0;
          color: #0f172a;
          font-size: clamp(28px, 3vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.035em;
          font-weight: 800;
        }

        .pageIntro p {
          margin: 9px 0 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }

        .dateBox {
          padding: 10px 14px;
          border: 1px solid #dbe3ec;
          border-radius: 12px;
          background: #fff;
          color: #475569;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .errorBox {
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fff7f7;
          color: #b91c1c;
          font-size: 13px;
          font-weight: 600;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 32px;
        }

        .statCard {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 108px;
          padding: 16px;
          border: 1px solid #d8e1eb;
          border-radius: 16px;
          background: linear-gradient(145deg, #ffffff, #f8fafc);
          box-shadow:
            0 3px 0 rgba(15, 23, 42, 0.05),
            0 10px 22px rgba(15, 23, 42, 0.07);
          transition:
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .statCard:hover {
          transform: translateY(-2px);
          box-shadow:
            0 4px 0 rgba(15, 23, 42, 0.05),
            0 15px 28px rgba(15, 23, 42, 0.1);
        }

        .statIcon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 46px;
          height: 46px;
          border: 1px solid #d8e2ed;
          border-radius: 13px;
          background: #f8fafc;
          color: #334155;
        }

        .statCard span {
          display: block;
          margin-bottom: 3px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .statCard strong {
          display: block;
          color: #0f172a;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 800;
        }

        .statCard small {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 600;
        }

        .modulesPanel {
          padding: 22px;
          border: 1px solid #dbe4ee;
          border-radius: 20px;
          background: linear-gradient(145deg, #f8fafc, #eef2f7);
          box-shadow:
            0 3px 0 rgba(15, 23, 42, 0.03),
            0 14px 34px rgba(15, 23, 42, 0.06);
        }

        .sectionTitle {
          margin-bottom: 18px;
        }

        .sectionTitle h2 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .sectionTitle p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .moduleGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .moduleButtonWrap {
          min-width: 0;
        }

        /*
         * Clean education/admin module cards:
         * - white surface
         * - 1px black border
         * - individual colored left accent
         * - light-gray elevation
         * - icon + text in one row
         * - no arrow
         */
        .moduleButtonWrap :global(.moduleCard) {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: center;
          width: 100%;
          min-height: 132px;
          padding: 18px 18px 18px 20px;
          gap: 16px;
          overflow: hidden;
          border: 1px solid #111827;
          border-radius: 14px;
          background: var(--module-bg);
          color: #172033;
          text-align: left;
          cursor: pointer;
          box-shadow:
            0 5px 0 #64748b,
            0 12px 24px rgba(15, 23, 42, 0.08);
          transition:
            transform 150ms ease,
            box-shadow 150ms ease,
            background 150ms ease;
        }

        .moduleButtonWrap :global(.moduleCard)::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
          background: var(--module-accent);
          border-radius: 14px 0 0 14px;
        }

        .moduleButtonWrap :global(.moduleCard:hover) {
          transform: translateY(-3px);
          background: var(--module-bg);
          box-shadow:
            0 7px 0 #64748b,
            0 18px 30px rgba(15, 23, 42, 0.11);
        }

        .moduleButtonWrap :global(.moduleCard:active) {
          transform: translateY(2px);
          box-shadow:
            0 2px 0 #64748b,
            0 7px 13px rgba(15, 23, 42, 0.08);
        }

        .moduleButtonWrap :global(.moduleCard:focus-visible) {
          outline: 2px solid var(--module-accent);
          outline-offset: 3px;
        }

        .moduleButtonWrap :global(.moduleCardIcon) {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 58px;
          height: 58px;
          border: 1px solid var(--module-icon-border);
          border-radius: 12px;
          background: var(--module-icon-bg);
          color: var(--module-icon-color);
          box-shadow: none;
        }

        .moduleButtonWrap :global(.moduleCardIcon svg) {
          width: 30px;
          height: 30px;
        }

        .moduleButtonWrap :global(.moduleCardContent) {
          position: relative;
          z-index: 1;
          width: auto;
          min-width: 0;
          flex: 1;
        }

        .moduleButtonWrap :global(.moduleCardContent h3) {
          margin: 0;
          color: #111827;
          font-size: 18px;
          line-height: 1.25;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .moduleButtonWrap :global(.moduleCardContent p) {
          display: -webkit-box;
          margin: 5px 0 0;
          max-width: 100%;
          overflow: hidden;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .moduleButtonWrap :global(.moduleCardArrow) {
          display: none !important;
        }

        .moduleButtonWrap :global(.moduleCard--attendance) {
          --module-bg: #f5f9ff;
          --module-accent: #2563eb;
          --module-icon-bg: #eff6ff;
          --module-icon-border: #bfdbfe;
          --module-icon-color: #2563eb;
        }

        .moduleButtonWrap :global(.moduleCard--reports) {
          --module-bg: #faf7ff;
          --module-accent: #7c3aed;
          --module-icon-bg: #f5f3ff;
          --module-icon-border: #ddd6fe;
          --module-icon-color: #7c3aed;
        }

        .moduleButtonWrap :global(.moduleCard--students) {
          --module-bg: #f4fbf8;
          --module-accent: #059669;
          --module-icon-bg: #ecfdf5;
          --module-icon-border: #a7f3d0;
          --module-icon-color: #059669;
        }

        .moduleButtonWrap :global(.moduleCard--announcements) {
          --module-bg: #fffaf0;
          --module-accent: #d97706;
          --module-icon-bg: #fffbeb;
          --module-icon-border: #fde68a;
          --module-icon-color: #d97706;
        }

        .moduleButtonWrap :global(.moduleCard--timetable) {
          --module-bg: #f3fbfc;
          --module-accent: #0891b2;
          --module-icon-bg: #ecfeff;
          --module-icon-border: #a5f3fc;
          --module-icon-color: #0891b2;
        }

        .moduleButtonWrap :global(.moduleCard--syllabus) {
          --module-bg: #f5fbf6;
          --module-accent: #16a34a;
          --module-icon-bg: #f0fdf4;
          --module-icon-border: #bbf7d0;
          --module-icon-color: #16a34a;
        }

        .moduleButtonWrap :global(.moduleCard--doubts) {
          --module-bg: #fff6f8;
          --module-accent: #db2777;
          --module-icon-bg: #fdf2f8;
          --module-icon-border: #fbcfe8;
          --module-icon-color: #db2777;
        }

        .moduleButtonWrap :global(.moduleCard--library) {
          --module-bg: #f5f7ff;
          --module-accent: #4f46e5;
          --module-icon-bg: #eef2ff;
          --module-icon-border: #c7d2fe;
          --module-icon-color: #4f46e5;
        }

        .moduleButtonWrap :global(.moduleCard--online-class) {
          --module-bg: #f4f9ff;
          --module-accent: #2563eb;
          --module-icon-bg: #eff6ff;
          --module-icon-border: #bfdbfe;
          --module-icon-color: #2563eb;
        }

        .moduleButtonWrap :global(.moduleCard--leave) {
          --module-bg: #f8fcf7;
          --module-accent: #059669;
          --module-icon-bg: #ecfdf5;
          --module-icon-border: #a7f3d0;
          --module-icon-color: #059669;
        }

        .moduleButtonWrap :global(.moduleCard--staff) {
          --module-bg: #f8f6ff;
          --module-accent: #7c3aed;
          --module-icon-bg: #f5f3ff;
          --module-icon-border: #ddd6fe;
          --module-icon-color: #7c3aed;
        }

        .moduleButtonWrap :global(.moduleCard--internal-marks) {
          --module-bg: #f3f9ff;
          --module-accent: #0369a1;
          --module-icon-bg: #eff6ff;
          --module-icon-border: #bfdbfe;
          --module-icon-color: #0369a1;
        }

        @media (max-width: 1050px) {
          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .moduleGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .pageIntro {
            align-items: flex-start;
            flex-direction: column;
          }

          .dateBox {
            white-space: normal;
          }

          .statsGrid,
          .moduleGrid {
            grid-template-columns: 1fr;
          }

          .modulesPanel {
            padding: 16px;
            border-radius: 16px;
          }
        }
      `}</style>

      <main className="dashboardRoot">
        <section className="pageIntro">
          <div>
            <div className="eyebrow">
              Royal College of Arts and Science, Thrithala
            </div>

            <h1>Dashboard</h1>

            <p>
              Manage the student application from one simple
              administration workspace.
            </p>
          </div>

          <div className="dateBox">{displayDate}</div>
        </section>

        {error && <div className="errorBox">{error}</div>}

        <section className="statsGrid">
          {statCards.map((card) => (
            <div className="statCard" key={card.label}>
              <div className="statIcon">
                <Icon name={card.icon} size={21} />
              </div>

              <div>
                <span>{card.label}</span>

                <strong>
                  {loading ? "—" : card.value.toLocaleString()}
                </strong>

                <small>{card.note}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="modulesPanel">
          <section className="sectionTitle">
            <div>
              <h2>Application Modules</h2>
              <p>
                Open a module to manage its data and controls.
              </p>
            </div>
          </section>

          <section className="moduleGrid">
            {visibleModules.map((module) => (
              <div className="moduleButtonWrap" key={module.id}>
                <ModuleCard
                  module={module}
                  onClick={() => onModule(module.id)}
                />
              </div>
            ))}
          </section>
        </section>
      </main>
    </>
  );
}
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
