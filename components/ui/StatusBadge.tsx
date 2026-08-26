"use client";

export default function StatusBadge({
  status,
}: {
  status: "Active" | "Inactive" | "Present" | "Absent";
}) {
  return <span className={`professionalStatus ${status.toLowerCase()}`}>{status}</span>;
}
