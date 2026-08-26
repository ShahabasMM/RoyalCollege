"use client";

import Icon from "../Icon";

export default function SummaryCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: "neutral" | "success" | "danger" | "primary";
}) {
  return (
    <div className={`summaryCard summaryCard-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="summaryIcon"><Icon name={icon} size={19} /></div>
    </div>
  );
}
