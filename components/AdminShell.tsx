"use client";

import { useState } from "react";
import Header from "./Header";
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
<<<<<<< HEAD
=======
import InternalMarks from "./InternalMarks";
import MonthlyReport from "./MonthlyReport";
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)

import { modules } from "@/lib/modules";
import { AppUser, hasPermission, Permission } from "@/lib/permissions";

export default function AdminShell({ user }: { user: AppUser }) {
  const [active, setActive] = useState("dashboard");

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
<<<<<<< HEAD
=======
    "internal-marks": "internal_marks.view",
    "monthly-report": "monthly_report.view",
>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
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

  const renderContent = () => {
    switch (active) {
      case "dashboard":
        return <Dashboard onModule={goTo} user={user} />;

      case "attendance":
        return <Attendance onBack={() => setActive("dashboard")} />;

      case "reports":
        return <Reports onBack={() => setActive("dashboard")} user={user} />;

      case "students":
        return <Students onBack={() => setActive("dashboard")} user={user} />;

      case "announcements":
        return (
          <Announcements onBack={() => setActive("dashboard")} user={user} />
        );

      case "library":
        return <Library onBack={() => setActive("dashboard")} user={user}/>;

<<<<<<< HEAD
=======
      case "internal-marks":
        return <InternalMarks onBack={() => setActive("dashboard")} user={user} />;

      case "monthly-report":
        return <MonthlyReport onBack={() => setActive("dashboard")} user={user} />;

>>>>>>> 1b61672 (Internal Mark & Monthly Report Added)
      case "timetable":
        return <Timetable onBack={() => setActive("dashboard")} user={user} />;

      case "doubts":
        return <Doubts onBack={() => setActive("dashboard")} user={user} />;

      case "leave":
        return <Leaves onBack={() => setActive("dashboard")} user={user} />;

      case "online-class":
        return (
          <OnlineClasses onBack={() => setActive("dashboard")} user={user} />
        );

      case "syllabus":
        return <Syllabus onBack={() => setActive("dashboard")} user={user} />;

      case "staff":
        return (
          <StaffManagement onBack={() => setActive("dashboard")} user={user} />
        );

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
      <div className="mainArea">
        <Header user={user} />

        <main className="mainContent">{renderContent()}</main>
      </div>
    </div>
  );
}
