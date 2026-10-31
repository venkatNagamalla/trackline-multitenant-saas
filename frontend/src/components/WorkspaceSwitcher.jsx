
import { useAuth } from "../context/useAuth";

export default function WorkspaceSwitcher() {
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
  } = useAuth();

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.07] bg-[#141c30] px-3 py-3">
        <p className="text-xs text-slate-500">
          No workspaces available
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <label htmlFor="workspace-select" className="sr-only">
        Select workspace
      </label>

      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#28334b] bg-[#141c30] px-3 py-3 transition-colors hover:border-violet-500/40">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-lg text-violet-300"
        >
          ▦
        </span>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workspace
          </p>

          <select
            id="workspace-select"
            value={currentWorkspace || ""}
            onChange={(event) =>
              setCurrentWorkspace(event.target.value)
            }
            className="w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-2 text-xs font-semibold text-slate-200 outline-none focus-visible:text-violet-300"
          >
            {workspaces.map((workspace) => (
              <option
                key={workspace.id}
                value={workspace.slug}
                className="bg-[#141c30] text-slate-200"
              >
                {workspace.name}
              </option>
            ))}
          </select>
        </div>

        <span
          aria-hidden="true"
          className="shrink-0 text-xs text-slate-500"
        >
          ▼
        </span>
      </div>
    </div>
  );
}
