"use client";

import { ModuleItem } from "@/types";
import Icon from "./Icon";

export default function ModuleCard({
  module,
  onClick
}: {
  module: ModuleItem;
  onClick: () => void;
}) {
  return (
    <button className="moduleCard" onClick={onClick}>
      <div className="moduleCardIcon"><Icon name={module.icon} size={24} /></div>
      <div className="moduleCardContent">
        <h3>{module.title}</h3>
        <p>{module.description}</p>
      </div>
      <div className="moduleCardArrow"><Icon name="arrow" size={19} /></div>
    </button>
  );
}
