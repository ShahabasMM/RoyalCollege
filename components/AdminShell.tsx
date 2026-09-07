// Vercel deployment sync check

"use client";

import { useState } from "react";
import Dashboard from "./Dashboard";
import Attendance from "./Attendance";
import Announcements from "./Announcements";
import Doubts from "./Doubts";
import Leaves from "./Leaves";
import SimpleModule from "./SimpleModule";
import Students from "./Students";
import Timetable from "./Timetable";
import OnlineClasses from "./OnlineClasses";
import Syllabus from "./Syllabus";
import StaffManagement from "./StaffManagement";
import Reports from "./Reports";
import Library from "./Library";
import InternalMarks from "./InternalMarks";
import MonthlyReport from "./MonthlyReport";
import Result from "./Result";
import Icon from "./Icon";

import { modules } from "@/lib/modules";
import { ModuleCategory } from "@/types";
import { AppUser, hasPermission, Permission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

export default function AdminShell({ user }: { user: AppUser }) {
  const [active, setActive] = useState("dashboard");
  const [dashboardTab, setDashboardTab] = useState<ModuleCategory>("admission-enrollment");
  const [moduleSearch, setModuleSearch] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const module = modules.find((item) => item.id === active);

  const access: Record<string, Permission> = {
    attendance: "attendance.view",
    reports: "attendance.view",
    students: "students.view",
    announcements: "announcements.view",
    timetable: "timetable.view",
    syllabus: "syllabus.view",
    doubts: "doubts.view",
    "online-class": "online.view",
    leave: "leaves.view",
    staff: "staff.view",
    "internal-marks": "internal_marks.view",
    result: "result.view",
    "monthly-report": "monthly_report.view",
  };

  const goTo = (id: string) => {
    if (id === "dashboard") {
      setActive("dashboard");
      return;
    }

    const required = access[id];

    if (!required || hasPermission(user, required)) {
      setActive(id);
    }
  };

  const getUserName = () => {
    const u = user as AppUser & {
      name?: string;
      full_name?: string;
      email?: string;
    };

    return u.name || u.full_name || u.email || "Administrator";
  };

  const getUserInitial = () => {
    const name = getUserName().trim();
    return name ? name.charAt(0).toUpperCase() : "A";
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    const confirmed = window.confirm("Are you sure you want to logout?");
    if (!confirmed) return;

    try {
      setLoggingOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
      window.alert("Unable to logout. Please try again.");
    }
  };

  const renderContent = () => {
    switch (active) {
      case "dashboard":
        return (
          <Dashboard
            onModule={goTo}
            user={user}
            moduleSearch={moduleSearch}
            onModuleSearch={setModuleSearch}
            activeTab={dashboardTab}
            onActiveTabChange={setDashboardTab}
          />
        );

      case "attendance":
        return <Attendance onBack={() => setActive("dashboard")} />;

      case "reports":
        return <Reports onBack={() => setActive("dashboard")} user={user} />;

      case "students":
        return <Students onBack={() => setActive("dashboard")} user={user} />;

      case "announcements":
        return <Announcements onBack={() => setActive("dashboard")} user={user} />;

      case "library":
        return <Library onBack={() => setActive("dashboard")} user={user} />;

      case "internal-marks":
        return <InternalMarks onBack={() => setActive("dashboard")} user={user} />;

      case "monthly-report":
        return <MonthlyReport onBack={() => setActive("dashboard")} user={user} />;

      case "result":
        return <Result onBack={() => setActive("dashboard")} user={user} />;

      case "timetable":
        return <Timetable onBack={() => setActive("dashboard")} user={user} />;

      case "doubts":
        return <Doubts onBack={() => setActive("dashboard")} user={user} />;

      case "leave":
        return <Leaves onBack={() => setActive("dashboard")} user={user} />;

      case "online-class":
        return <OnlineClasses onBack={() => setActive("dashboard")} user={user} />;

      case "syllabus":
        return <Syllabus onBack={() => setActive("dashboard")} user={user} />;

      case "staff":
        return <StaffManagement onBack={() => setActive("dashboard")} user={user} />;

      case "settings":
        return (
          <SimpleModule
            title="Settings"
            icon="settings"
            onBack={() => setActive("dashboard")}
          />
        );

      default:
        return (
          <SimpleModule
            title={module?.title ?? "Module"}
            icon={module?.icon ?? "activity"}
            onBack={() => setActive("dashboard")}
          />
        );
    }
  };

  return (
    <div className="appShell">
      <style jsx>{`
        .appShell {
          min-height: 100vh;
          margin: 0;
          padding: 0;
          background: #F2ECDC;
        }

        .mainArea {
          min-height: 100vh;
          margin: 0;
          padding: 0;
        }

        .adminMasthead {
          position: relative;
          z-index: 20;
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(300px, 420px) minmax(300px, 1fr);
          align-items: center;
          gap: 28px;
          width: 100%;
          min-height: 86px;
          margin: 0;
          padding: 14px 40px;
          background: #FBF9F3;
          border-bottom: 1px solid #d9cfb8;
          box-sizing: border-box;
          font-family: Poppins, sans-serif;
        }

        .adminBrand {
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .adminBrand img {
          display: block;
          width: 174px;
          height: auto;
          max-width: 100%;
          object-fit: contain;
        }

        .adminSearch {
          position: relative;
          width: 100%;
          justify-self: center;
        }

        .adminSearchIcon {
          position: absolute;
          left: 14px;
          top: 50%;
          display: grid;
          place-items: center;
          color: #131313;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .adminSearch input {
          display: block;
          width: 100%;
          height: 44px;
          padding: 0 14px 0 40px;
          border: 1px solid #0a0a0a;
          border-radius: 8px;
          outline: none;
          background: #F2ECDC;
          color: #2A211D;
          font-family: Poppins, sans-serif;
          font-size: 14px;
          font-weight: 400;
          box-sizing: border-box;
        }

        .adminSearch input::placeholder {
          color: #3a3836;
        }

        .adminSearch input:focus {
          border-color: #7A2035;
          box-shadow: 0 0 0 3px rgba(122, 32, 53, 0.08);
        }

        .adminRight {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 16px;
          min-width: 0;
        }

        .adminBell {
          position: relative;
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          color: #6b5f57;
        }

        .adminBell::after {
          content: "";
          position: absolute;
          top: -1px;
          right: -1px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #7A2035;
          border: 1.5px solid #FBF9F3;
        }

        .adminWho {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .adminAvatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          border-radius: 50%;
          background: #efe4f0;
          color: #5A2A63;
          font-size: 14px;
          font-weight: 700;
        }

        .adminMeta {
          min-width: 0;
          line-height: 1.25;
        }

        .adminName {
          overflow: hidden;
          color: #2A211D;
          font-size: 13.5px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .adminRole {
          color: #6b5f57;
          font-size: 11.5px;
          white-space: nowrap;
        }

        .adminLogout {
          min-width: 76px;
          padding: 8px 14px;
          border: 1px solid #9c3f52;
          border-radius: 7px;
          background: transparent;
          color: #7A2035;
          font-family: Poppins, sans-serif;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: background .15s ease, color .15s ease, opacity .15s ease;
        }

        .adminLogout:hover:not(:disabled) {
          background: #7A2035;
          color: #FBF9F3;
        }

        .adminLogout:disabled {
          cursor: wait;
          opacity: .55;
        }

        .mainContent {
          width: 100%;
          margin: 0;
          padding: 30px;
          background: #F2ECDC;
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .adminMasthead {
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "brand right"
              "search search";
            gap: 12px 18px;
            padding: 14px 20px;
          }

          .adminBrand { grid-area: brand; }
          .adminSearch { grid-area: search; }
          .adminRight { grid-area: right; }
        }

        @media (max-width: 520px) {
          .adminMasthead {
            padding: 12px 14px;
          }

          .adminBrand img {
            width: 145px;
          }

          .adminWho .adminMeta {
            display: none;
          }

          .adminRight {
            gap: 9px;
          }

          .adminLogout {
            min-width: auto;
            padding: 7px 10px;
          }
        }
      `}</style>

      <div className="mainArea">
        <header className="adminMasthead">
          <div className="adminBrand">
            <img
              src="/icons/college-logo.png"
              alt="Royal College of Arts and Science Thrithala"
            />
          </div>

          <label className="adminSearch">
            <span className="adminSearchIcon">
              <Icon name="search" size={17} />
            </span>
            <input
              type="search"
              value={moduleSearch}
              onChange={(event) => setModuleSearch(event.target.value)}
              placeholder="Search modules..."
              aria-label="Search dashboard modules"
            />
          </label>

          <div className="adminRight">
            <span className="adminBell" aria-label="Notifications">
              <Icon name="bell" size={19} />
            </span>

            <div className="adminWho">
              <div className="adminAvatar">{getUserInitial()}</div>
              <div className="adminMeta">
                <div className="adminName">{getUserName()}</div>
                <div className="adminRole">Administrator</div>
              </div>
            </div>

            <button
              type="button"
              className="adminLogout"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </header>

        <main className="mainContent">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
