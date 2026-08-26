"use client";

import BackToDashboard from "./BackToDashboard";

export default function PermissionDenied({
  onBack,
  title = "Access Restricted",
}: {
  onBack: () => void;
  title?: string;
}) {
  return (
    <div className="professionalModule">
      <BackToDashboard onBack={onBack} />
      <section className="professionalTableCard" style={{ padding: "48px", textAlign: "center" }}>
        <div className="moduleKicker">ACCESS CONTROL</div>
        <h1 style={{ margin: "10px 0 8px" }}>{title}</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          You have not been granted permission to view this module.
        </p>
      </section>
    </div>
  );
}
