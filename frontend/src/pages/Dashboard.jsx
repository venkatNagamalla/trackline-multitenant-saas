
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../api";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

// Different accent colours for different projects
const projectColors = [
  {
    icon: "bg-violet-100 text-violet-700",
    badge: "bg-violet-50 text-violet-700",
    hover: "group-hover:text-violet-700",
    button: "bg-violet-50 text-violet-700 hover:bg-violet-100",
    border: "hover:border-violet-200",
  },
  {
    icon: "bg-blue-100 text-blue-700",
    badge: "bg-blue-50 text-blue-700",
    hover: "group-hover:text-blue-700",
    button: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    border: "hover:border-blue-200",
  },
  {
    icon: "bg-emerald-100 text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700",
    hover: "group-hover:text-emerald-700",
    button: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    border: "hover:border-emerald-200",
  },
  {
    icon: "bg-amber-100 text-amber-700",
    badge: "bg-amber-50 text-amber-700",
    hover: "group-hover:text-amber-700",
    button: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    border: "hover:border-amber-200",
  },
  {
    icon: "bg-rose-100 text-rose-700",
    badge: "bg-rose-50 text-rose-700",
    hover: "group-hover:text-rose-700",
    button: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    border: "hover:border-rose-200",
  },
  {
    icon: "bg-cyan-100 text-cyan-700",
    badge: "bg-cyan-50 text-cyan-700",
    hover: "group-hover:text-cyan-700",
    button: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
    border: "hover:border-cyan-200",
  },
  {
    icon: "bg-pink-100 text-pink-700",
    badge: "bg-pink-50 text-pink-700",
    hover: "group-hover:text-pink-700",
    button: "bg-pink-50 text-pink-700 hover:bg-pink-100",
    border: "hover:border-pink-200",
  },
  {
    icon: "bg-orange-100 text-orange-700",
    badge: "bg-orange-50 text-orange-700",
    hover: "group-hover:text-orange-700",
    button: "bg-orange-50 text-orange-700 hover:bg-orange-100",
    border: "hover:border-orange-200",
  },
];

// Assign a repeatable colour based on the project name and key
function getProjectColor(project) {
  const value = `${project.key || ""}${project.name || ""}`;

  const hash = Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );

  return projectColors[hash % projectColors.length];
}

export default function Dashboard() {
  const { user, currentWorkspace, workspaces = [] } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
  });

  const activeWorkspace =
    currentWorkspace && typeof currentWorkspace === "object"
      ? currentWorkspace
      : workspaces.find(
          (workspace) => workspace.slug === currentWorkspace
        );

  const workspaceName =
    activeWorkspace?.name ||
    activeWorkspace?.slug ||
    (currentWorkspace && typeof currentWorkspace === "string"
      ? currentWorkspace
      : "Not selected");

  const username = user?.username || user?.email || "User";

  const loadProjects = useCallback(async () => {
    if (!currentWorkspace) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/projects/");
      setProjects(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err) {
      setError(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        name === "key" ? value.toUpperCase().slice(0, 10) : value,
    }));
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setUpgradeRequired(false);

    if (!form.name.trim() || !form.key.trim()) {
      setFormError("Project name and key are required.");
      return;
    }

    setCreating(true);

    try {
      const project = await apiRequest("/projects/", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          key: form.key.trim().toUpperCase(),
          description: form.description.trim(),
        }),
      });

      setProjects((previous) =>
        [...previous, project].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setForm({ name: "", key: "", description: "" });
      setSuccess(`Project "${project.name}" created successfully.`);
    } catch (err) {
      if (err.status === 402) {
        setUpgradeRequired(true);
        setFormError(
          err.message ||
            "Your current plan limit has been reached. Please upgrade to Pro."
        );
      } else {
        const detail = err.data;

        const fieldError =
          detail && typeof detail === "object"
            ? Object.entries(detail)
                .map(([field, messages]) => {
                  const message = Array.isArray(messages)
                    ? messages.join(" ")
                    : String(messages);

                  return `${field}: ${message}`;
                })
                .join(" ")
            : "";

        setFormError(
          fieldError || err.message || "Failed to create project."
        );
      }
    } finally {
      setCreating(false);
    }
  };

  // Centered full-page loading screen
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] w-full items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-violet-100 border-t-violet-600" />
            <span className="text-xl font-bold text-violet-700">T</span>
          </div>

          <h2 className="mt-6 text-lg font-bold text-slate-800">
            Loading your workspace
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Please wait while we fetch your projects...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 font-sans">

      {/* Page heading */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-600" />
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">
              Workspace overview
            </p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[#172033] sm:text-[36px]">
            Dashboard
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
            Welcome back,{" "}
            <span className="font-semibold text-slate-800">{username}</span>.
            Here's what's happening with your projects.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#e1e5f2] bg-white px-4 py-3 shadow-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            ▦
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Active workspace
            </p>
            <p className="max-w-[190px] truncate text-sm font-bold text-slate-800">
              {workspaceName}
            </p>
          </div>
        </div>
      </section>

      {/* Overview statistics */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="group rounded-2xl border border-[#e1e5f2] bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Total projects
            </p>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-xl text-violet-700">
              ▦
            </span>
          </div>

          <p className="mt-4 text-4xl font-bold tracking-tight text-[#172033]">
            {projects.length}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Projects in this workspace
          </p>
        </div>

        <div className="group rounded-2xl border border-[#e1e5f2] bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Current workspace
            </p>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600">
              ◈
            </span>
          </div>

          <p className="mt-4 truncate text-2xl font-bold tracking-tight text-[#172033]">
            {workspaceName}
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Active workspace
          </p>
        </div>
      </section>

      {/* Create project */}
      <section className="overflow-hidden rounded-2xl border border-[#e1e5f2] bg-white shadow-sm">
        <div className="border-b border-[#edf0f7] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-2xl font-medium text-white shadow-lg shadow-violet-200">
              +
            </span>

            <div>
              <h2 className="text-lg font-bold text-[#172033]">
                Create a new project
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Start a new project in your workspace and bring your ideas to life.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateProject} className="space-y-6 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <label htmlFor="project-name" className="mb-2.5 block text-sm font-semibold text-slate-800">
                Project name <span className="text-red-500">*</span>
              </label>
              <input
                id="project-name"
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="e.g. Website Redesign"
                maxLength={150}
                required
                className="w-full rounded-xl border border-[#dce1ee] bg-[#fafbff] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>

            <div>
              <label htmlFor="project-key" className="mb-2.5 block text-sm font-semibold text-slate-800">
                Project key <span className="text-red-500">*</span>
              </label>
              <input
                id="project-key"
                name="key"
                value={form.key}
                onChange={handleFormChange}
                placeholder="e.g. WEB"
                maxLength={10}
                required
                className="w-full rounded-xl border border-[#dce1ee] bg-[#fafbff] px-4 py-3 text-sm uppercase text-slate-900 outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
              <p className="mt-2 text-xs text-slate-500">
                Maximum 10 characters.
              </p>
            </div>

            <div>
              <label htmlFor="project-description" className="mb-2.5 block text-sm font-semibold text-slate-800">
                Description
                <span className="ml-1.5 font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                id="project-description"
                name="description"
                value={form.description}
                onChange={handleFormChange}
                placeholder="What is this project about?"
                rows={2}
                className="w-full resize-y rounded-xl border border-[#dce1ee] bg-[#fafbff] px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
              />
            </div>
          </div>

          {formError && (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm leading-6 text-red-700">{formError}</p>

              {upgradeRequired && (
                <div className="mt-3">
                  <p className="mb-3 text-sm text-slate-600">
                    Upgrade your workspace to Pro to increase your project limit.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/billing")}
                    className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    Upgrade to Pro →
                  </button>
                </div>
              )}
            </div>
          )}

          {success && (
            <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-sm font-semibold text-emerald-700">
              ✓ {success}
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-[#edf0f7] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Fields marked with * are required.
            </p>

            <button
              type="submit"
              disabled={creating || !currentWorkspace}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 hover:from-violet-700 hover:to-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </>
              ) : (
                <>
                  <span className="text-lg">+</span>
                  Create project
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Projects */}
      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#172033]">
              Your projects
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              View and manage projects in your workspace.
            </p>
          </div>

          <span className="w-fit rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700">
            {projects.length} projects
          </span>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-5">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={loadProjects}
              className="mt-4 rounded-lg border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!error && projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#d6dbea] bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-3xl text-violet-600">
              ▦
            </div>
            <h3 className="mt-5 text-lg font-bold text-[#172033]">
              No projects yet
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Your workspace is ready. Create your first project to get started.
            </p>
          </div>
        )}

        {/* Project cards */}
        {!error && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const colors = getProjectColor(project);

              return (
                <article
                  key={project.id}
                  className={`group flex min-w-0 flex-col rounded-2xl border border-[#e1e5f2] bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 ${colors.border} hover:shadow-xl`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold transition group-hover:scale-105 ${colors.icon}`}>
                      {project.name?.slice(0, 1).toUpperCase() || "P"}
                    </span>

                    {project.key && (
                      <span className={`rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wider ${colors.badge}`}>
                        {project.key}
                      </span>
                    )}
                  </div>

                  <h3 className={`mt-5 break-words text-base font-bold leading-6 text-[#172033] transition ${colors.hover}`}>
                    {project.name}
                  </h3>

                  <p className="mt-2 min-h-12 break-words text-sm leading-6 text-slate-600">
                    {project.description || "No description provided."}
                  </p>

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#edf0f7] pt-4">
                    <span className="text-xs font-medium text-slate-500">
                      Project workspace
                    </span>

                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${colors.button}`}
                    >
                      Open board
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
