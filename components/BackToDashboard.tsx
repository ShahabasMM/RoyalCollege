"use client";

import Icon from "./Icon";

export default function BackToDashboard({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <button className="backToDashboard" onClick={onBack}>
      <Icon name="arrowLeft" size={17} />
      Back to Dashboard
    </button>
  );
}
