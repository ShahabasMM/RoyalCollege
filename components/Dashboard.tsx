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


/* =========================================================
   DASHBOARD STATS
========================================================= */

type DashboardStats = {
  totalStudents: number;
  presentToday: number;
  pendingLeaves: number;
  openDoubts: number;
};


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

    default:
      return null;
  }
}


/* =========================================================
   DASHBOARD
========================================================= */

export default function Dashboard({
  onModule,
  user,
}: {
  onModule: (id: string) => void;
  user: AppUser;
}) {

  /* =======================================================
     STATE
  ======================================================= */

  const [
    stats,
    setStats,
  ] = useState<DashboardStats>({
    totalStudents: 0,
    presentToday: 0,
    pendingLeaves: 0,
    openDoubts: 0,
  });


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


      let totalStudents = 0;
      let presentToday = 0;
      let pendingLeaves = 0;
      let openDoubts = 0;


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

      setStats({
        totalStudents,
        presentToday,
        pendingLeaves,
        openDoubts,
      });

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