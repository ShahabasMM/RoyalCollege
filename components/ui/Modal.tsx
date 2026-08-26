"use client";

import { ReactNode } from "react";
import Icon from "../Icon";

export default function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="adminModal">
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="modalClose" onClick={onClose} aria-label="Close modal"><Icon name="close" size={19} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
