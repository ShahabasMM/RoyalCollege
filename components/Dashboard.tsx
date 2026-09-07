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
  moduleSearch = "",
  onModuleSearch,
}: {
  onModule: (id: string) => void;
  user: AppUser;
  moduleSearch?: string;
  onModuleSearch?: (value: string) => void;
}) {
  const [error, setError] = useState("");
  const [totalStudents, setTotalStudents] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [activeTab, setActiveTab] = useState<ModuleCategory>(moduleTabs[0].id);

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
        :global(*) { box-sizing: border-box; }
        :global(html), :global(body) {
          margin: 0;
          padding: 0;
          width: 100%;
          min-width: 100%;
        }
        :global(body) {
          background: #F2ECDC !important;
          overflow-x: hidden;
        }

        .dashboardRoot,
        .dashboardRoot * {
          font-family: "Poppins", sans-serif;
        }

        .dashboardRoot {
          --maroon: #7A2035;
          --maroon-deep: #4A1420;
          --maroon-line: #9c3f52;
          --parchment: #F2ECDC;
          --parchment-dim: #E9E1CC;
          --paper: #FBF9F3;
          --ink: #2A211D;
          --ink-soft: #6b5f57;
          --brass: #B08A3E;
          --brass-light: #d9c48d;
          --rule: #d9cfb8;
          --c-application: #8C2A3A;
          --c-application-soft: #f7e6e6;
          --c-academic: #23395F;
          --c-academic-soft: #e5eaf2;
          --c-reports: #5A2A63;
          --c-reports-soft: #efe4f0;
          --c-masters: #5A3A21;
          --c-masters-soft: #f0e6d9;
          --c-library: #205C3F;
          --c-library-soft: #e2ede6;
          width: 100%;
          min-width: 0;
          min-height: 100vh;
          margin: 0;
          padding: 0 0 60px;
          background: var(--parchment);
          background-image: radial-gradient(circle at 1px 1px, rgba(122,32,53,0.05) 1px, transparent 0);
          background-size: 22px 22px;
          color: var(--ink);
        }

        .heroWrap { padding: 34px 40px 0; }

        .hero {
          position: relative;
          overflow: hidden;
          padding: 34px 38px 42px;
          border-radius: 14px;
          background: linear-gradient(155deg, var(--maroon) 0%, var(--maroon-deep) 100%);
          color: var(--parchment);
        }

        .hero::before {
          content: "";
          position: absolute;
          right: -60px;
          top: -60px;
          width: 280px;
          height: 280px;
          border: 1px solid rgba(242,236,220,0.14);
          border-radius: 50%;
        }

        .hero::after {
          content: "";
          position: absolute;
          right: 10px;
          top: 30px;
          width: 190px;
          height: 190px;
          border: 1px solid rgba(242,236,220,0.1);
          border-radius: 50%;
        }

        .heroTop {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .heroKicker {
          margin: 0;
          color: rgba(242,236,220,0.75);
          font-size: 13px;
          letter-spacing: 0.3px;
        }

        .dateTag {
          padding: 9px 16px;
          border: 1px solid rgba(242,236,220,0.3);
          border-radius: 7px;
          background: rgba(242,236,220,0.1);
          color: var(--parchment);
          font-size: 12.5px;
          white-space: nowrap;
        }

        .heroStats {
          position: relative;
          z-index: 1;
          display: flex;
          margin-top: 30px;
          padding: 20px 30px;
          border: 1px solid rgba(242,236,220,0.16);
          border-radius: 10px;
          background: rgba(251,249,243,0.06);
        }

        .heroStat { flex: 1; padding: 0 26px; }
        .heroStat + .heroStat { border-left: 1px solid rgba(242,236,220,0.22); }
        .heroStatLabel { margin-bottom: 6px; font-size: 12.5px; color: rgba(242,236,220,0.72); }
        .heroStatValue { display: flex; align-items: baseline; gap: 8px; color: var(--parchment); font-size: 32px; line-height: 1; font-weight: 600; }
        .heroStatValue span { color: var(--brass-light); font-size: 13px; font-weight: 500; }

        .moduleSearchWrap {
          position: relative;
          z-index: 2;
          margin-top: -22px;
          padding: 0 40px;
        }

        .moduleSearch {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px 20px;
          border: 1px solid var(--rule);
          border-radius: 11px;
          background: var(--paper);
          box-shadow: 0 10px 24px -14px rgba(74,20,32,0.35);
        }

        .moduleSearchIcon {
          display: grid;
          place-items: center;
          flex: none;
          color: var(--ink-soft);
        }

        .moduleSearch input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          color: var(--ink);
          font-size: 14px;
        }

        .moduleSearch input::placeholder { color: #9a8f83; }

        .moduleSearchButton {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          padding: 0;
          border: none;
          border-radius: 7px;
          background: var(--ink);
          color: var(--paper);
          cursor: pointer;
        }

        .moduleSearchButton:hover { background: #1c1714; }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 28px 40px 16px;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 18px;
          border: none;
          border-radius: 9px;
          color: var(--paper);
          box-shadow: 0 3px 0 rgba(0,0,0,0.22);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: box-shadow .12s ease, transform .12s ease, filter .12s ease;
        }

        .tabIcon { display: grid; place-items: center; }
        .tab:hover { filter: brightness(1.08); }
        .tabActive { box-shadow: inset 0 2px 5px rgba(0,0,0,0.4); transform: translateY(2px); filter: brightness(0.86); }
        .tabActive:hover { filter: brightness(0.86); }
        .tabApplication { background: var(--c-application); }
        .tabAcademic { background: var(--c-academic); }
        .tabReports { background: var(--c-reports); }
        .tabMasters { background: var(--c-masters); }
        .tabLibrary { background: var(--c-library); }

        .directory {
          margin: 0 40px 60px;
          padding: 30px 38px 40px;
          border: 1px solid var(--rule);
          border-radius: 0 0 14px 14px;
          background: var(--paper);
        }

        .directoryHead h2 {
          margin: 0 0 6px;
          color: var(--ink);
          font-size: 22px;
          font-weight: 600;
        }

        .directoryHead p {
          margin: 0 0 26px;
          color: var(--ink-soft);
          font-size: 13.5px;
        }

        .moduleGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .moduleButtonWrap { min-width: 0; }

        .moduleButtonWrap :global(.moduleCard) {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          width: 100%;
          min-height: 180px;
          padding: 22px 22px 24px;
          border: 1px solid var(--rule);
          border-left-width: 4px;
          border-left-color: var(--module-accent, var(--c-application));
          border-radius: 8px;
          background: var(--module-soft, var(--paper));
          color: var(--ink);
          text-align: left;
          cursor: pointer;
          box-shadow: none;
          transition: transform .15s ease, box-shadow .15s ease;
        }

        .moduleButtonWrap :global(.moduleCard:hover) {
          transform: translateY(-3px);
          background: var(--module-soft, var(--paper));
          box-shadow: 0 14px 26px -18px rgba(42,33,29,0.35);
        }

        .moduleButtonWrap :global(.moduleCard:active) { transform: translateY(0); }
        .moduleButtonWrap :global(.moduleCard:focus-visible) { outline: 2px solid var(--module-accent); outline-offset: 3px; }

        .moduleButtonWrap :global(.moduleCard::before) { display: none; }

        .moduleButtonWrap :global(.moduleCardIcon) {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          margin-bottom: 14px;
          border: none;
          border-radius: 8px;
          background: var(--paper);
          color: var(--module-accent);
          box-shadow: none;
          flex: 0 0 auto;
        }

        .moduleButtonWrap :global(.moduleCardIcon svg) { width: 18px; height: 18px; }

        .moduleButtonWrap :global(.moduleCardContent) {
          position: relative;
          width: 100%;
          min-width: 0;
          flex: none;
        }

        .moduleButtonWrap :global(.moduleCardContent h3) {
          margin: 0 0 6px;
          color: var(--ink);
          font-size: 16.5px;
          line-height: 1.3;
          font-weight: 600;
          letter-spacing: 0;
        }

        .moduleButtonWrap :global(.moduleCardContent p) {
          display: block;
          margin: 0;
          max-width: 100%;
          overflow: visible;
          color: var(--ink-soft);
          font-size: 13px;
          line-height: 1.5;
          -webkit-line-clamp: unset;
        }

        .moduleButtonWrap :global(.moduleCardArrow) { display: none !important; }

        .moduleButtonWrap :global(.moduleCard--attendance) { --module-accent: #2563eb; --module-soft: #e5eaf2; }
        .moduleButtonWrap :global(.moduleCard--reports) { --module-accent: #5A2A63; --module-soft: #efe4f0; }
        .moduleButtonWrap :global(.moduleCard--students) { --module-accent: #205C3F; --module-soft: #e2ede6; }
        .moduleButtonWrap :global(.moduleCard--admission) { --module-accent: #8C2A3A; --module-soft: #f7e6e6; }
        .moduleButtonWrap :global(.moduleCard--fee-management) { --module-accent: #5A3A21; --module-soft: #f0e6d9; }
        .moduleButtonWrap :global(.moduleCard--announcements) { --module-accent: #B08A3E; --module-soft: #f0e6d9; }
        .moduleButtonWrap :global(.moduleCard--timetable) { --module-accent: #23395F; --module-soft: #e5eaf2; }
        .moduleButtonWrap :global(.moduleCard--syllabus) { --module-accent: #205C3F; --module-soft: #e2ede6; }
        .moduleButtonWrap :global(.moduleCard--doubts) { --module-accent: #8C2A3A; --module-soft: #f7e6e6; }
        .moduleButtonWrap :global(.moduleCard--library) { --module-accent: #205C3F; --module-soft: #e2ede6; }
        .moduleButtonWrap :global(.moduleCard--online-class) { --module-accent: #23395F; --module-soft: #e5eaf2; }
        .moduleButtonWrap :global(.moduleCard--leave) { --module-accent: #205C3F; --module-soft: #e2ede6; }
        .moduleButtonWrap :global(.moduleCard--staff) { --module-accent: #5A2A63; --module-soft: #efe4f0; }
        .moduleButtonWrap :global(.moduleCard--internal-marks) { --module-accent: #23395F; --module-soft: #e5eaf2; }
        .moduleButtonWrap :global(.moduleCard--monthly-report) { --module-accent: #5A2A63; --module-soft: #efe4f0; }

        .errorBox {
          margin: 18px 40px 0;
          padding: 12px 14px;
          border: 1px solid #d8a4aa;
          border-radius: 8px;
          background: #fff6f6;
          color: var(--maroon);
          font-size: 13px;
          font-weight: 600;
        }

        .emptyModules {
          grid-column: 1 / -1;
          padding: 34px 20px;
          border: 1px dashed var(--rule);
          border-radius: 8px;
          background: var(--paper);
          color: var(--ink-soft);
          font-size: 13px;
          font-weight: 600;
          text-align: center;
        }

        @media (max-width: 1050px) {
          .moduleGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 880px) {
          .heroWrap, .moduleSearchWrap, .tabs { padding-left: 20px; padding-right: 20px; }
          .directory { margin-left: 20px; margin-right: 20px; }
          .heroStats { flex-direction: column; gap: 14px; }
          .heroStat + .heroStat { border-left: none; border-top: 1px solid rgba(242,236,220,0.22); padding-top: 14px; }
          .heroTop { flex-wrap: wrap; }
        }

        @media (max-width: 640px) {
          .moduleGrid { grid-template-columns: 1fr; }
          .hero { padding: 28px 22px 30px; }
          .directory { padding: 24px 20px 30px; }
          .tabs { gap: 6px; }
          .tab { flex: 1 1 calc(50% - 6px); justify-content: center; padding: 10px 12px; }
        }

        @media (max-width: 420px) {
          .heroWrap { padding-top: 20px; }
          .moduleSearchWrap { margin-top: -14px; }
          .tab { flex-basis: 100%; }
          .moduleButtonWrap :global(.moduleCard) { min-height: 160px; }
        }
      `}</style>

      <main className="dashboardRoot">
        <div className="heroWrap">
          <section className="hero">
            <div className="heroTop">
              <p className="heroKicker">Registrar's overview</p>
              <div className="dateTag">{displayDate}</div>
            </div>

            <div className="heroStats">
              <div className="heroStat">
                <div className="heroStatLabel">Registered students</div>
                <div className="heroStatValue">
                  {loadingStudents ? "—" : totalStudents.toLocaleString()}
                  <span>on roll this term</span>
                </div>
              </div>

              <div className="heroStat">
                <div className="heroStatLabel">Library holdings</div>
                <div className="heroStatValue">
                  {loadingBooks ? "—" : totalBooks.toLocaleString()}
                  <span>catalogued title{totalBooks === 1 ? "" : "s"}</span>
                </div>
              </div>

              <div className="heroStat">
                <div className="heroStatLabel">Available modules</div>
                <div className="heroStatValue">
                  {visibleModules.length}
                  <span>accessible to you</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {error && <div className="errorBox">{error}</div>}

        <nav className="tabs" role="tablist" aria-label="Application module categories">
          {moduleTabs.map((tab) => {
            const toneClass =
              tab.tone === "rose" ? "tabApplication" :
              tab.tone === "blue" ? "tabAcademic" :
              tab.tone === "violet" ? "tabReports" :
              tab.tone === "amber" ? "tabMasters" :
              "tabLibrary";

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`tab ${toneClass}${activeTab === tab.id ? " tabActive" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tabIcon"><Icon name={tab.icon} size={15} /></span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="directory">
          <div className="directoryHead">
            <h2>{normalizedSearch ? "Search Results" : "Application Modules"}</h2>
            <p>
              {normalizedSearch
                ? `${selectedModules.length} matching module${selectedModules.length === 1 ? "" : "s"}`
                : "Open a module to manage its records and workflow."}
            </p>
          </div>

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