"use client";

import Icon from "./Icon";
import { AppUser } from "@/lib/permissions";

export default function Header({ user }: { user: AppUser }) {
  const roleLabel =
    user.role === "MAIN_ADMIN"
      ? "Super Admin"
      : user.role === "FACULTY"
        ? "Faculty"
        : "Staff";

  return (
    <header className="topbar">
      <div className="headerBrand">Royal College <span>Admin</span></div>

      <div className="searchBox">
        <Icon name="search" size={19} />
        <input placeholder="Search students, records or modules..." />
      </div>

      <div className="topActions">
        <button className="notification" title="Notifications">
          <Icon name="bell" size={20} />
          <i />
        </button>
        <div className="topProfile">
          <div className="adminAvatar">{user.name.charAt(0).toUpperCase()}</div>
          <div>
            <b>{user.name}</b>
            <span>{roleLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
