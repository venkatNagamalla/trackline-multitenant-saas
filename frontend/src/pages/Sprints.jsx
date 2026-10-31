
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api";

const priorityStyles = {
  low: "border-slate-200 bg-slate-100 text-slate-600",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

const stateStyles = {
  planned: "bg-slate-100 text-slate-600",
  active: "bg-violet-100 text-violet-700",
  completed: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
};

function LoadingIndicator({ message }) {
  return (
    <div className="flex min-h-[220px] w-full flex-col items-center justify-center text-center">
      <div className="relative flex h-11 w-11 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-violet-100 border-t-violet-700" />
        <span className="text-sm font-bold text-violet-700">T</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-700">
        {message}
      </p>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const value = (priority || "medium").toLowerCase();

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold capitalize ${
        priorityStyles[value] || priorityStyles.medium
      }`}
    >
      {value}
    </span>
  );
}

function SprintIssue({ issue }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">
          {issue.title}
        </p>
        <p className="mt-1 text-[10px] text-slate-400">
          Issue #{issue.id}
        </p>
      </div>
      <PriorityBadge priority={issue.priority} />
    </div>
  );
}

export default function Sprints() {
  const { projectId } = useParams();

  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [actingSprintId, setActingSprintId] = useState(null);

  const [sprintIssues, setSprintIssues] = useState([]);
  const [backlogIssues, setBacklogIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [addingIssueId, setAddingIssueId] = useState(null);
  const [selectedSprintByIssue, setSelectedSprintByIssue] = useState({});

  const [reports, setReports] = useState({});
  const [reportLoadingId, setReportLoadingId] = useState(null);

  useEffect(() => {
    async function loadSprints() {
      setLoading(true);
      setError("");

      try {
        const data = await apiRequest("/projects/sprints/");
        const sprintList = Array.isArray(data)
          ? data
          : data.results ?? [];

        setSprints(
          sprintList.filter(
            (sprint) => Number(sprint.project) === Number(projectId)
          )
        );
      } catch (err) {
        setError(err.message || "Failed to load sprints.");
      } finally {
        setLoading(false);
      }
    }

    loadSprints();
  }, [projectId]);

  async function loadIssues() {
    setIssuesLoading(true);

    try {
      const [allIssuesData, backlogData] = await Promise.all([
        apiRequest(`/projects/issues/?project=${projectId}`),
        apiRequest(
          `/projects/issues/?project=${projectId}&sprint__isnull=true`
        ),
      ]);

      const allIssues = Array.isArray(allIssuesData)
        ? allIssuesData
        : allIssuesData.results ?? [];

      const backlog = Array.isArray(backlogData)
        ? backlogData
        : backlogData.results ?? [];

      setSprintIssues(
        allIssues.filter((issue) => issue.sprint != null)
      );
      setBacklogIssues(backlog);
    } catch (err) {
      setError(err.message || "Failed to load issues.");
    } finally {
      setIssuesLoading(false);
    }
  }

  useEffect(() => {
    loadIssues();
  }, [projectId]);

  async function handleCreateSprint(event) {
    event.preventDefault();
    setError("");

    if (end < start) {
      setError("End date must be on or after the start date.");
      return;
    }

    setCreating(true);

    try {
      const sprint = await apiRequest("/projects/sprints/", {
        method: "POST",
        body: JSON.stringify({
          project: Number(projectId),
          name: name.trim(),
          start,
          end,
        }),
      });

      setSprints((previous) => [...previous, sprint]);
      setName("");
      setStart("");
      setEnd("");
    } catch (err) {
      setError(err.message || "Failed to create sprint.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSprintAction(sprintId, action) {
    setError("");
    setActingSprintId(sprintId);

    try {
      await apiRequest(
        `/projects/sprints/${sprintId}/${action}/`,
        { method: "POST" }
      );

      const data = await apiRequest("/projects/sprints/");
      const sprintList = Array.isArray(data)
        ? data
        : data.results ?? [];

      setSprints(
        sprintList.filter(
          (sprint) => Number(sprint.project) === Number(projectId)
        )
      );

      await loadSprintReport(sprintId);
      await loadIssues();
    } catch (err) {
      setError(err.message || `Failed to ${action} sprint.`);
    } finally {
      setActingSprintId(null);
    }
  }

  async function loadSprintReport(sprintId) {
    setReportLoadingId(sprintId);

    try {
      const report = await apiRequest(
        `/projects/sprints/${sprintId}/report/`
      );

      setReports((previous) => ({
        ...previous,
        [sprintId]: report,
      }));

      return report;
    } catch (err) {
      setError(err.message || "Failed to load sprint report.");
      return null;
    } finally {
      setReportLoadingId(null);
    }
  }

  function getProgress(report) {
    if (!report) return null;

    const total = Number(report.total_issues ?? 0);
    const completed = Number(report.done_issues ?? 0);

    const percentage =
      report.completion_percentage != null
        ? Number(report.completion_percentage)
        : total > 0
          ? Math.round((completed / total) * 100)
          : 0;

    return {
      total,
      completed,
      percentage: Math.max(0, Math.min(100, percentage)),
    };
  }

  async function handleAddToSprint(issueId) {
    const sprintId = selectedSprintByIssue[issueId];

    if (!sprintId) {
      setError("Please select a sprint first.");
      return;
    }

    setError("");
    setAddingIssueId(issueId);

    try {
      await apiRequest(`/projects/issues/${issueId}/`, {
        method: "PATCH",
        body: JSON.stringify({
          sprint: Number(sprintId),
        }),
      });

      await loadIssues();
      await loadSprintReport(Number(sprintId));
    } catch (err) {
      setError(
        err.message ||
          "Failed to add issue to sprint. Check your issue API endpoint."
      );
    } finally {
      setAddingIssueId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6">

      {/* Page header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="rounded-md bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700">
              Project management
            </span>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Sprints
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Plan work, organize issues, and track sprint progress.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            <span className="text-xs font-semibold text-slate-600">
              Project #{projectId}
            </span>
          </div>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="font-bold text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Create sprint */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            Create a sprint
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Define a sprint and set its schedule.
          </p>
        </div>

        <form onSubmit={handleCreateSprint}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-600">
                Sprint name
              </span>
              <input
                type="text"
                placeholder="e.g. Sprint 01"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-600">
                Start date
              </span>
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-600">
                End date
              </span>
              <input
                type="date"
                value={end}
                min={start || undefined}
                onChange={(event) => setEnd(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-[#34205f] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#261749] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creating..." : "+ Create sprint"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Sprint list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Your sprints
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              View sprint details and monitor progress.
            </p>
          </div>

          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
            {sprints.length} total
          </span>
        </div>

        {loading ? (
          <LoadingIndicator message="Loading sprints..." />
        ) : sprints.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-xl text-violet-600">
              ◷
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-800">
              No sprints yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Create your first sprint using the form above.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {sprints.map((sprint) => {
              const progress = getProgress(reports[sprint.id]);

              const issuesForSprint = sprintIssues.filter(
                (issue) => Number(issue.sprint) === Number(sprint.id)
              );

              const state = (sprint.state || "planned").toLowerCase();

              return (
                <article
                  key={sprint.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Sprint #{sprint.id}
                        </p>
                        <h3 className="mt-1 truncate text-lg font-extrabold text-slate-900">
                          {sprint.name}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-bold capitalize ${
                          stateStyles[state] || stateStyles.planned
                        }`}
                      >
                        {sprint.state}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Start date
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-700">
                          {sprint.start}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          End date
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-700">
                          {sprint.end}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {state === "planned" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSprintAction(sprint.id, "start")
                          }
                          disabled={actingSprintId !== null}
                          className="rounded-lg bg-[#34205f] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#261749] disabled:opacity-60"
                        >
                          {actingSprintId === sprint.id
                            ? "Starting..."
                            : "Start sprint"}
                        </button>
                      )}

                      {state === "active" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSprintAction(sprint.id, "complete")
                          }
                          disabled={actingSprintId !== null}
                          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {actingSprintId === sprint.id
                            ? "Completing..."
                            : "Complete sprint"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => loadSprintReport(sprint.id)}
                        disabled={reportLoadingId === sprint.id}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-60"
                      >
                        {reportLoadingId === sprint.id
                          ? "Loading report..."
                          : "View report"}
                      </button>
                    </div>

                    {/* Progress */}
                    {progress && (
                      <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700">
                            Sprint progress
                          </span>
                          <span className="text-sm font-extrabold text-violet-700">
                            {progress.percentage}%
                          </span>
                        </div>

                        <div
                          className="h-2.5 overflow-hidden rounded-full bg-slate-200"
                          role="progressbar"
                          aria-valuenow={progress.percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-violet-700 transition-all duration-500"
                            style={{
                              width: `${progress.percentage}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-[11px] text-slate-500">
                          {progress.completed} of {progress.total} issues completed
                        </p>
                      </div>
                    )}

                    {/* Sprint issues */}
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-800">
                          Sprint issues
                        </h4>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                          {issuesForSprint.length}
                        </span>
                      </div>

                      {issuesLoading ? (
                        <p className="py-4 text-center text-xs text-slate-400">
                          Loading issues...
                        </p>
                      ) : issuesForSprint.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 px-3 py-5 text-center text-xs text-slate-400">
                          No issues assigned to this sprint.
                        </p>
                      ) : (
                        <div>
                          {issuesForSprint.map((issue) => (
                            <SprintIssue key={issue.id} issue={issue} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Backlog */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Backlog
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Assign unplanned issues to an available sprint.
            </p>
          </div>

          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
            {backlogIssues.length} issues
          </span>
        </div>

        {issuesLoading ? (
          <LoadingIndicator message="Loading backlog..." />
        ) : backlogIssues.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-600">
              Your backlog is empty
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Unassigned issues will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backlogIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">
                      {issue.title}
                    </h3>
                    <PriorityBadge priority={issue.priority} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Issue #{issue.id}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:w-[320px] sm:flex-row">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">
                      Select sprint for issue {issue.id}
                    </span>
                    <select
                      value={selectedSprintByIssue[issue.id] ?? ""}
                      onChange={(event) =>
                        setSelectedSprintByIssue((previous) => ({
                          ...previous,
                          [issue.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    >
                      <option value="">Choose a sprint</option>
                      {sprints
                        .filter(
                          (sprint) =>
                            sprint.state !== "closed" &&
                            Number(sprint.project) === Number(projectId)
                        )
                        .map((sprint) => (
                          <option key={sprint.id} value={sprint.id}>
                            {sprint.name} ({sprint.state})
                          </option>
                        ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleAddToSprint(issue.id)}
                    disabled={addingIssueId === issue.id}
                    className="shrink-0 rounded-lg bg-[#34205f] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#261749] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addingIssueId === issue.id
                      ? "Adding..."
                      : "Add to sprint"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
