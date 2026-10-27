import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api";

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

  async function handleCreateSprint(e) {
    e.preventDefault();
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

      console.log("Sprint Report:", report);
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
      // Assumes the Issue API accepts PATCH with a sprint ID.
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
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
      <h1>Sprints</h1>
      <p>Project ID: {projectId}</p>

      <form
        onSubmit={handleCreateSprint}
        style={{
          display: "grid",
          gap: "12px",
          maxWidth: "400px",
          marginBottom: "28px",
        }}
      >
        <h2>Create Sprint</h2>

        <input
          type="text"
          placeholder="Sprint name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <label>
          Start date
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </label>

        <label>
          End date
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create Sprint"}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      <h2>Sprint List</h2>

      {loading ? (
        <p>Loading sprints...</p>
      ) : sprints.length === 0 ? (
        <p>No sprints found for this project.</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {sprints.map((sprint) => {
            const progress = getProgress(reports[sprint.id]);

            const issuesForSprint = sprintIssues.filter(
              (issue) => Number(issue.sprint) === Number(sprint.id)
            );

            return (
              <div
                key={sprint.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <h3>{sprint.name}</h3>

                <p>
                  Status: <strong>{sprint.state}</strong>
                </p>
                <p>Start: {sprint.start}</p>
                <p>End: {sprint.end}</p>

                {sprint.state === "planned" && (
                  <button
                    onClick={() => handleSprintAction(sprint.id, "start")}
                    disabled={actingSprintId !== null}
                  >
                    {actingSprintId === sprint.id
                      ? "Starting..."
                      : "Start Sprint"}
                  </button>
                )}

                {sprint.state === "active" && (
                  <button
                    onClick={() => handleSprintAction(sprint.id, "complete")}
                    disabled={actingSprintId !== null}
                  >
                    {actingSprintId === sprint.id
                      ? "Completing..."
                      : "Complete Sprint"}
                  </button>
                )}

                <div style={{ marginTop: "16px" }}>
                  <button
                    onClick={() => loadSprintReport(sprint.id)}
                    disabled={reportLoadingId === sprint.id}
                  >
                    {reportLoadingId === sprint.id
                      ? "Loading report..."
                      : "Load Sprint Report"}
                  </button>

                  {progress && (
                    <div style={{ marginTop: "12px" }}>
                      <p>
                        Progress: {progress.completed} / {progress.total}{" "}
                        issues completed ({progress.percentage}%)
                      </p>

                      <div
                        style={{
                          height: "10px",
                          background: "#e5e7eb",
                          borderRadius: "999px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${progress.percentage}%`,
                            height: "100%",
                            background: "#16a34a",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <hr style={{ margin: "20px 0" }} />

                <h4>Sprint Issues</h4>

                {issuesLoading ? (
                  <p>Loading issues...</p>
                ) : issuesForSprint.length === 0 ? (
                  <p>No issues assigned to this sprint.</p>
                ) : (
                  issuesForSprint.map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        padding: "10px 0",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <strong>{issue.title}</strong>
                      <p>
                        Priority: {issue.priority}
                      </p>
                      <p>Issue ID: {issue.id}</p>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      <section style={{ marginTop: "32px" }}>
        <h2>Backlog</h2>

        {issuesLoading ? (
          <p>Loading backlog...</p>
        ) : backlogIssues.length === 0 ? (
          <p>No backlog issues found for this project.</p>
        ) : (
          backlogIssues.map((issue) => (
            <div
              key={issue.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "10px",
              }}
            >
              <strong>{issue.title}</strong>
              <p>Priority: {issue.priority}</p>
              <p>Issue ID: {issue.id}</p>

              <label>
                Select sprint
                <select
                  value={selectedSprintByIssue[issue.id] ?? ""}
                  onChange={(e) =>
                    setSelectedSprintByIssue((previous) => ({
                      ...previous,
                      [issue.id]: e.target.value,
                    }))
                  }
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
                onClick={() => handleAddToSprint(issue.id)}
                disabled={addingIssueId === issue.id}
                style={{ marginLeft: "8px" }}
              >
                {addingIssueId === issue.id
                  ? "Adding..."
                  : "Add to Sprint"}
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}