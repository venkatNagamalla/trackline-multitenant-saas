
import { useAuth } from "../auth/AuthContext";

export default function WorkspaceSwitcher() {
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
  } = useAuth();

  if (!workspaces || workspaces.length === 0) {
    return (
      <span className="workspace-label">
        No workspaces available
      </span>
    );
  }

  return (
    <div className="workspace-switcher">
      <label htmlFor="workspace-select">Workspace:</label>

      <select
        id="workspace-select"
        value={currentWorkspace || ""}
        onChange={(event) => setCurrentWorkspace(event.target.value)}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.slug}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  );
}
