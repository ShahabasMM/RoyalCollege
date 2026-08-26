"use client";

import Icon from "./Icon";
import BackToDashboard from "./BackToDashboard";

export default function SimpleModule({ title, icon, onBack }: { title: string; icon: string; onBack: () => void }) {
  return (
    <div>
      <BackToDashboard onBack={onBack} />
      <div className="moduleHeader">
        <div>
          <div className="moduleKicker"><Icon name={icon} size={17} /> {title}</div>
          <h1>{title} Management</h1>
          <p>Manage the information displayed in the Royal College student application.</p>
        </div>
        <button className="primaryButton"><Icon name="plus" size={17} /> Add New</button>
      </div>

      <div className="workspaceGrid">
        <div className="workspaceCard">
          <div className="workspaceIcon"><Icon name={icon} size={26} /></div>
          <h2>Manage {title}</h2>
          <p>This workspace is structured for the complete {title.toLowerCase()} workflow. Connect it to Supabase/API data and the controls can be used directly by administrators.</p>
          <div className="actionRows">
            <button><span><Icon name="file" size={19} /></span><div><b>Add New Record</b><small>Create a new {title.toLowerCase()} record.</small></div><Icon name="arrow" size={18} /></button>
            <button><span><Icon name="users" size={19} /></span><div><b>View Records</b><small>Browse and update existing records.</small></div><Icon name="arrow" size={18} /></button>
            <button><span><Icon name="settings" size={19} /></span><div><b>Module Settings</b><small>Configure this module.</small></div><Icon name="arrow" size={18} /></button>
          </div>
        </div>
        <div className="sideInfo">
          <h3>Module status</h3>
          <div><Icon name="check" size={18} /><b>Ready</b><span>UI controls available</span></div>
          <div><Icon name="clock" size={18} /><b>Live data</b><span>Connect your database</span></div>
          <div><Icon name="alert" size={18} /><b>0 issues</b><span>No UI errors</span></div>
        </div>
      </div>
    </div>
  );
}
