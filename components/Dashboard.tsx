"use client";

import { useEffect, useState } from "react";

import { modules } from "@/lib/modules";

import {
  AppUser,
  canAccess,
  Permission,
} from "@/lib/permissions";

import ModuleCard from "./ModuleCard";
import Icon from "./Icon";
import { ModuleCategory } from "@/types";
import { supabase } from "@/lib/supabase";

const moduleTabs: Array<{ id: ModuleCategory; label: string; tone: string; icon: string }> = [
  { id: "admission-enrollment", label: "Application", tone: "rose", icon: "users" },
  { id: "academic-cell", label: "Academic Cell", tone: "blue", icon: "book" },
  { id: "reports", label: "Reports", tone: "violet", icon: "activity" },
  { id: "masters", label: "Masters", tone: "amber", icon: "settings" },
  { id: "library", label: "Library", tone: "green", icon: "library" },
];

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

    case "result":
      return "result.view";

    case "monthly-report":
      return "monthly_report.view";

    default:
      return null;
  }
}

export default function Dashboard({
  onModule,
  user,
}: {
  onModule: (id: string) => void;
  user: AppUser;
}) {
  const [error, setError] = useState("");
  const [totalStudents, setTotalStudents] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [activeTab, setActiveTab] = useState<ModuleCategory>(moduleTabs[0].id);
  const [moduleSearch, setModuleSearch] = useState("");

  useEffect(() => {
    async function loadTotalStudents() {
      if (!canAccess(user, "students.view")) {
        setLoadingStudents(false);
        return;
      }

      const { count, error: studentsError } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true });

      if (studentsError) {
        setError(`Students: ${studentsError.message}`);
      } else {
        setTotalStudents(count ?? 0);
      }

      setLoadingStudents(false);
    }

    loadTotalStudents();
  }, [user]);

  useEffect(() => {
    async function loadTotalBooks() {
      if (!canAccess(user, "library.view")) {
        setLoadingBooks(false);
        return;
      }

      const { count, error: booksError } = await supabase
        .from("library_books")
        .select("id", { count: "exact", head: true });

      if (booksError) {
        setError(`Library: ${booksError.message}`);
      } else {
        setTotalBooks(count ?? 0);
      }

      setLoadingBooks(false);
    }

    loadTotalBooks();
  }, [user]);

  const displayDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const visibleModules = modules.filter((module) => {
    const requiredPermission = getModulePermission(module.id);

    if (requiredPermission === null) {
      return true;
    }

    return canAccess(user, requiredPermission);
  });

  const normalizedSearch = moduleSearch.trim().toLowerCase();
  const searchMatches = normalizedSearch
    ? visibleModules.filter((module) =>
        `${module.title} ${module.description}`.toLowerCase().includes(normalizedSearch),
      )
    : [];
  const selectedModules = normalizedSearch
    ? searchMatches
    : visibleModules.filter((module) => module.category === activeTab);

  useEffect(() => {
    if (!normalizedSearch || !searchMatches.length) return;

    const matchingCategory = searchMatches[0].category;
    if (matchingCategory !== activeTab) setActiveTab(matchingCategory);
  }, [normalizedSearch, searchMatches, activeTab]);

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
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 26px;
        }

        .introBrand {
          display: flex;
          align-items: center;
          gap: 49px;
          min-width: 0;
        }

        .dashboardLogo {
          display: block;
          width: min(330px, 52vw);
          height: auto;
          object-fit: contain;
          object-position: left center;
        }

        .introBrand .statCard {
          width: 300px;
          min-width: 300px;
        }

        .summaryCards {
          display: flex;
          align-items: stretch;
          gap: 14px;
          padding: 10px;
          border: 1px solid #e2e2e2;
          border-radius: 18px;
          background: #f1f1f1;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .introBrand .statCard--books {
          background: #fff;
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
          color: #111827;
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
          grid-template-columns: 1fr;
          margin-bottom: 32px;
        }

        .moduleSearch {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          box-shadow: none;
        }

        .moduleSearchIcon {
          position: absolute;
          top: 50%;
          left: 16px;
          display: grid;
          place-items: center;
          color: #475569;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .moduleSearch input {
          width: 100%;
          height: 52px;
          padding: 0 108px 0 48px;
          border: 1px solid #111827;
          border-radius: 13px;
          outline: 0;
          background: #f1f5f9;
          color: #111827;
          font-family: "Poppins", sans-serif;
          font-size: 14px;
          font-weight: 600;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.025);
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .moduleSearch input::placeholder { color: #94a3b8; font-weight: 500; }
        .moduleSearch:focus-within { box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1); }
        .moduleSearch input:focus { border-color: #111827; box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.025); }

        .moduleSearchButton {
          position: absolute;
          top: 9px;
          right: 9px;
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          padding: 0;
          border: 0;
          border-radius: 10px;
          background: #1e293b;
          color: #fff;
          font-family: "Poppins", sans-serif;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: background 160ms ease, transform 160ms ease;
        }

        .moduleSearchButton:hover { background: #0f172a; transform: translateY(-1px); }
        .moduleSearchButton:active { transform: translateY(0); }

        .statCard {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 108px;
          padding: 16px;
          border: 1px solid #111827;
          border-radius: 16px;
          background: #fff;
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
          border-radius: 0 0 20px 20px;
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

        .moduleTabs {
          display: flex;
          align-items: stretch;
          gap: 4px;
          width: 100%;
          margin: 0 0 -1px;
          padding: 5px;
          border: 1px solid #dbe3ed;
          border-bottom: 0;
          border-radius: 20px 20px 0 0;
          background: rgba(248, 250, 252, 0.76);
          position: relative;
          z-index: 2;
        }

        .moduleTab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          flex: 1 1 0;
          min-width: 0;
          min-height: 52px;
          padding: 8px 13px;
          border: 1px solid #111827;
          border-radius: 13px;
          background: #334155;
          color: #fff;
          font-family: "Poppins", sans-serif;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.15;
          text-align: center;
          white-space: normal;
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease, color 160ms ease, transform 160ms ease;
        }

        .moduleTab:hover {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.65);
          filter: brightness(0.9);
        }

        .moduleTab:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.22);
          outline-offset: 2px;
        }

        .moduleTab--active {
          border-color: #111827;
          background: #1e293b;
          color: #fff;
          box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.36), inset 0 -1px 2px rgba(255, 255, 255, 0.08);
          transform: translateY(2px);
        }

        .moduleTabIcon {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          color: #fff;
        }

        .moduleTab > span:nth-child(2) {
          min-width: 0;
          overflow-wrap: break-word;
          word-break: normal;
          white-space: normal;
        }

        .moduleTab--rose.moduleTab--active { border-color: #111827; background: #7f1d1d; color: #fff; }
        .moduleTab--blue.moduleTab--active { border-color: #111827; background: #1e3a8a; color: #fff; }
        .moduleTab--violet.moduleTab--active { border-color: #111827; background: #4c1d95; color: #fff; }
        .moduleTab--amber.moduleTab--active { border-color: #111827; background: #92400e; color: #fff; }
        .moduleTab--rose { background: #7a1414; }
        .moduleTab--blue { background: #133285; }
        .moduleTab--violet { background: #831991; }
        .moduleTab--amber { background: #9d4a0b; }
        .moduleTab--green { background: #0d5126; }
        .moduleTab--green.moduleTab--active { border-color: #0e131e; background: #166534; color: #fff; }

        .moduleSearchResult {
          margin: -8px 0 18px;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          text-align: center;
        }

        .emptyModules {
          padding: 34px 20px;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.45);
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
        }

        .moduleGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 17px;
        }

        .moduleButtonWrap {
          min-width: 0;
        }

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

        .moduleButtonWrap :global(.moduleCard--admission) {
          --module-bg: #fff5f7;
          --module-accent: #e11d48;
          --module-icon-bg: #fff1f2;
          --module-icon-border: #fecdd3;
          --module-icon-color: #e11d48;
        }

        .moduleButtonWrap :global(.moduleCard--fee-management) {
          --module-bg: #fffaf0;
          --module-accent: #d97706;
          --module-icon-bg: #fffbeb;
          --module-icon-border: #fde68a;
          --module-icon-color: #d97706;
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

        .moduleButtonWrap :global(.moduleCard--monthly-report) {
          --module-bg: #f8f6ff;
          --module-accent: #7c3aed;
          --module-icon-bg: #f5f3ff;
          --module-icon-border: #ddd6fe;
          --module-icon-color: #7c3aed;
        }

        @media (max-width: 1050px) {
          .moduleGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .pageIntro {
            align-items: flex-start;
            flex-direction: column;
          }

          .introBrand {
            width: 100%;
            align-items: flex-start;
            flex-direction: column;
            gap: 14px;
          }

          .summaryCards {
            width: 100%;
            flex-direction: column;
          }

          .introBrand .statCard {
            width: 100%;
            min-width: 0;
          }

          .dashboardLogo {
            width: min(280px, 80vw);
          }

          .dateBox {
            white-space: normal;
          }

          .statsGrid {
            grid-template-columns: 1fr;
          }

          /*
           * Keep module cards 2 per row on mobile.
           */
          .moduleGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 17px;
          }

          .modulesPanel {
            padding: 16px;
            border-radius: 16px;
          }

          .moduleTabs {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5px;
            width: 100%;
            margin: 0 0 -1px;
            border-radius: 16px 16px 0 0;
          }

          .moduleTab {
            min-height: 47px;
            padding: 7px 8px;
            font-size: 13px;
          }

          .moduleButtonWrap :global(.moduleCard) {
            min-height: 118px;
            padding: 14px;
            gap: 11px;
          }

          .moduleButtonWrap :global(.moduleCardIcon) {
            width: 44px;
            height: 44px;
            border-radius: 10px;
          }

          .moduleButtonWrap :global(.moduleCardIcon svg) {
            width: 23px;
            height: 23px;
          }

          .moduleButtonWrap :global(.moduleCardContent h3) {
            font-size: 14px;
            line-height: 1.25;
          }

          .moduleButtonWrap :global(.moduleCardContent p) {
            margin-top: 4px;
            font-size: 11px;
            line-height: 1.4;
          }
        }

        @media (max-width: 420px) {
          .moduleTabs {
            grid-template-columns: 1fr;
          }

          .moduleTab {
            min-height: 43px;
            font-size: 12px;
          }

          .moduleGrid {
            gap: 17px;
          }

          .moduleButtonWrap :global(.moduleCard) {
            min-height: 112px;
            padding: 12px;
            gap: 9px;
          }

          .moduleButtonWrap :global(.moduleCardIcon) {
            width: 40px;
            height: 40px;
          }

          .moduleButtonWrap :global(.moduleCardIcon svg) {
            width: 21px;
            height: 21px;
          }

          .moduleButtonWrap :global(.moduleCardContent h3) {
            font-size: 13px;
          }

          .moduleButtonWrap :global(.moduleCardContent p) {
            font-size: 10px;
          }
        }
      `}</style>

      <main className="dashboardRoot">
        <section className="pageIntro">
          <div className="introBrand">
            <img
              className="dashboardLogo"
              src="/icons/college-logo.png"
              alt="Royal College of Arts and Science Thrithala"
            />
            <div className="summaryCards">
              <div className="statCard">
                <div className="statIcon">
                  <Icon name="users" size={21} />
                </div>
                <div>
                  <span>Total Students</span>
                  <strong>{loadingStudents ? "—" : totalStudents.toLocaleString()}</strong>
                  <small>Registered students</small>
                </div>
              </div>
              <div className="statCard statCard--books">
                <div className="statIcon">
                  <Icon name="library" size={21} />
                </div>
                <div>
                  <span>Total Books</span>
                  <strong>{loadingBooks ? "—" : totalBooks.toLocaleString()}</strong>
                  <small>Library books</small>
                </div>
              </div>
            </div>
          </div>

          <div className="dateBox">{displayDate}</div>
        </section>

        {error && <div className="errorBox">{error}</div>}

        <section className="statsGrid">
          <label className="moduleSearch">
            <span className="moduleSearchIcon"><Icon name="search" size={20} /></span>
            <input
              type="search"
              value={moduleSearch}
              onChange={(event) => setModuleSearch(event.target.value)}
              placeholder="Search modules..."
              aria-label="Search dashboard modules"
            />
            <button
              type="button"
              className="moduleSearchButton"
              onClick={() => setModuleSearch((value) => value.trim())}
              aria-label="Search modules"
            >
              <Icon name="search" size={16} />
            </button>
          </label>
        </section>

        <div className="moduleTabs" role="tablist" aria-label="Application module categories">
          {moduleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`moduleTab moduleTab--${tab.tone}${activeTab === tab.id ? " moduleTab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="moduleTabIcon"><Icon name={tab.icon} size={20} /></span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <section className="modulesPanel">
          <section className="sectionTitle">
            <div>
              <h2>{normalizedSearch ? "Search Results" : "Application Modules"}</h2>

              <p>
                {normalizedSearch
                  ? `${selectedModules.length} matching module${selectedModules.length === 1 ? "" : "s"}`
                  : "Open a module to manage its data and controls."}
              </p>
            </div>
          </section>

          <section className="moduleGrid">
            {selectedModules.length ? selectedModules.map((module) => (
              <div className="moduleButtonWrap" key={module.id}>
                <ModuleCard
                  module={module}
                  onClick={() => onModule(module.id)}
                />
              </div>
            )) : (
              <div className="emptyModules">No modules available in this category.</div>
            )}
          </section>
        </section>
      </main>
    </>
  );
}