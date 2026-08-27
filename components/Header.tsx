"use client";

import { useState } from "react";

import Icon from "./Icon";

import { AppUser } from "@/lib/permissions";

import { supabase } from "@/lib/supabase";

export default function Header({ user }: { user: AppUser }) {
  const [loggingOut, setLoggingOut] = useState(false);

  const roleLabel =
    user.role === "MAIN_ADMIN"
      ? "Super Admin"
      : user.role === "FACULTY"
        ? "Faculty"
        : "Staff";

  /* ============================================================
     LOGOUT
  ============================================================ */

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("LOGOUT ERROR:", error);

        alert("Unable to logout. Please try again.");

        setLoggingOut(false);

        return;
      }

      /*
       * Reload the application so the
       * auth state is completely cleared
       * and the login screen can appear.
       */

      window.location.reload();
    } catch (error) {
      console.error("LOGOUT ERROR:", error);

      alert("Unable to logout. Please try again.");

      setLoggingOut(false);
    }
  }

  return (
    <header className="topbar">
      {/* ======================================================
          BRAND
      ====================================================== */}

      <div className="headerBrand">
        Royal College <span>Admin</span>
      </div>

      {/* ======================================================
          SEARCH
      ====================================================== */}

      <div className="searchBox">
        <Icon name="search" size={19} />

        <input placeholder="Search students, records or modules..." />
      </div>

      {/* ======================================================
          ACTIONS
      ====================================================== */}

      <div className="topActions">
        {/* ====================================================
            NOTIFICATION
        ==================================================== */}

        <button className="notification" title="Notifications" type="button">
          <Icon name="bell" size={20} />

          <i />
        </button>

        {/* ====================================================
            PROFILE
        ==================================================== */}

        <div className="topProfile">
          <div className="adminAvatar">{user.name.charAt(0).toUpperCase()}</div>

          <div>
            <b>{user.name}</b>

            <span>{roleLabel}</span>
          </div>
        </div>

        {/* ====================================================
            LOGOUT BUTTON
        ==================================================== */}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Logout"
          style={{
            marginLeft: "10px",
            height: "40px",
            padding: "0 15px",
            borderRadius: "10px",

            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#dc2626",

            fontSize: "13px",
            fontWeight: 700,

            cursor: loggingOut ? "not-allowed" : "pointer",

            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",

            transition: "all 0.2s ease",

            opacity: loggingOut ? 0.6 : 1,

            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (!loggingOut) {
              e.currentTarget.style.background = "#fee2e2";

              e.currentTarget.style.borderColor = "#fca5a5";

              e.currentTarget.style.color = "#b91c1c";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff1f2";

            e.currentTarget.style.borderColor = "#fecaca";

            e.currentTarget.style.color = "#dc2626";
          }}
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
