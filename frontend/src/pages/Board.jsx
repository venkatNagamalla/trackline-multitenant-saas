
import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../api";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

function IssueCard({ issue }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `issue-${issue.id}`,
    data: { issueId: issue.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    padding: "10px",
    marginBottom: "8px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "white",
    cursor: "grab",
    touchAction: "none",
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <strong>{issue.title}</strong>
      <p>Priority: {issue.priority}</p>

      {issue.description && <p>{issue.description}</p>}

      <small>Rank: {issue.rank}</small>
    </article>
  );
}

function IssueColumn({
  board,
  status,
  issues,
  onAddIssue,
  children,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `status-${status.id}`,
    data: {
      statusId: status.id,
      boardId: board.id,
    },
  });

  return (
    <section
      ref={setNodeRef}
      style={{
        minWidth: "260px",
        padding: "12px",
        marginBottom: "12px",
        border: isOver ? "2px solid #2563eb" : "1px solid #ccc",
        borderRadius: "8px",
        background: isOver ? "#eff6ff" : "#f9fafb",
      }}
    >
      <h3>
        {status.name} ({issues.length})
      </h3>

      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}

      {issues.length === 0 && <p>No issues in this status.</p>}

      {children}

      <button type="button" onClick={onAddIssue}>
        + Add issue
      </button>
    </section>
  );
}

export default function Board() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [boards, setBoards] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newIssueStatus, setNewIssueStatus] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [moveError, setMoveError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        projectData,
        boardData,
        statusData,
        issueData,
      ] = await Promise.all([
        apiRequest(`/projects/${projectId}/`),
        apiRequest("/projects/boards/"),
        apiRequest("/projects/statuses/"),
        apiRequest("/projects/issues/"),
      ]);

      const allBoards = Array.isArray(boardData)
        ? boardData
        : boardData?.results ?? [];

      const allStatuses = Array.isArray(statusData)
        ? statusData
        : statusData?.results ?? [];

      const allIssues = Array.isArray(issueData)
        ? issueData
        : issueData?.results ?? [];

      const projectBoards = allBoards.filter(
        (board) => String(board.project) === String(projectId)
      );

      const boardIds = new Set(
        projectBoards.map((board) => Number(board.id))
      );

      const projectStatuses = allStatuses.filter(
        (status) => boardIds.has(Number(status.board))
      );

      const projectIssues = allIssues.filter(
        (issue) => String(issue.project) === String(projectId)
      );

      setProject(projectData);
      setBoards(projectBoards);
      setStatuses(projectStatuses);
      setIssues(projectIssues);
    } catch (err) {
      setError(err.message || "Failed to load the board.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  async function handleCreateIssue(event, board, status) {
    event.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Please enter an issue title.");
      return;
    }

    const statusIssues = issues.filter(
      (issue) => Number(issue.status) === Number(status.id)
    );

    const highestRank = statusIssues.reduce(
      (highest, issue) =>
        Math.max(highest, Number(issue.rank) || 0),
      0
    );

    setSaving(true);

    try {
      const createdIssue = await apiRequest("/projects/issues/", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          project: Number(projectId),
          board: board.id,
          status: status.id,
          rank: highestRank + 100,
        }),
      });

      setIssues((previous) => [...previous, createdIssue]);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setNewIssueStatus(null);
      setFormError("");
    } catch (err) {
      setFormError(err.message || "Could not create the issue.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;

    if (!over) return;

    const issueId = Number(
      String(active.id).replace("issue-", "")
    );

    const targetStatusId = Number(
      String(over.id).replace("status-", "")
    );

    const issue = issues.find(
      (item) => Number(item.id) === issueId
    );

    const targetStatus = statuses.find(
      (item) => Number(item.id) === targetStatusId
    );

    if (!issue || !targetStatus) return;

    // Only allow movement between statuses on the same board.
    if (Number(targetStatus.board) !== Number(issue.board)) return;

    if (Number(issue.status) === targetStatusId) return;

    setMoveError("");

    const previousIssues = issues;

    const targetIssues = issues.filter(
      (item) => Number(item.status) === targetStatusId
    );

    const nextRank =
      targetIssues.reduce(
        (highest, item) =>
          Math.max(highest, Number(item.rank) || 0),
        0
      ) + 100;

    // Update the UI immediately.
    setIssues((current) =>
      current.map((item) =>
        Number(item.id) === issueId
          ? {
              ...item,
              status: targetStatusId,
              rank: nextRank,
            }
          : item
      )
    );

    try {
      await apiRequest(`/projects/issues/${issueId}/move/`, {
        method: "POST",
        body: JSON.stringify({
          status: targetStatusId,
          rank: nextRank,
        }),
      });
    } catch (err) {
      setIssues(previousIssues);
      setMoveError(
        `${err.message || "Could not move issue."} The board was restored.`
      );
    }
  }

  const filteredIssues = issues.filter((issue) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      (issue.title || "").toLowerCase().includes(search) ||
      (issue.description || "").toLowerCase().includes(search);

    const matchesPriority =
      priorityFilter === "all" ||
      issue.priority === priorityFilter;

    const matchesStatus =
      statusFilter === "all" ||
      Number(issue.status) === Number(statusFilter);

    return matchesSearch && matchesPriority && matchesStatus;
  });

  if (loading) {
    return <p>Loading board...</p>;
  }

  if (error) {
    return (
      <main>
        <p role="alert">{error}</p>

        <button onClick={loadBoard}>Retry</button>

        <button onClick={() => navigate("/dashboard")}>
          Back to projects
        </button>
      </main>
    );
  }

  return (
    <main className="board-page">
      <header>
        <button onClick={() => navigate("/dashboard")}>
          ← Projects
        </button>

        <h1>{project?.name || "Project board"}</h1>
        <p>{project?.description}</p>
      </header>

      <div
        className="issue-filters"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          margin: "16px 0",
          alignItems: "center",
        }}
      >
        <input
          type="search"
          placeholder="Search issues..."
          aria-label="Search issues"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={{ padding: "8px" }}
        />

        <select
          aria-label="Filter by priority"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          style={{ padding: "8px" }}
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{ padding: "8px" }}
        >
          <option value="all">All statuses</option>

          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setSearchTerm("");
            setPriorityFilter("all");
            setStatusFilter("all");
          }}
        >
          Clear filters
        </button>
      </div>

      {moveError && (
        <p role="alert" style={{ color: "red" }}>
          {moveError}
        </p>
      )}

      {boards.length === 0 ? (
        <p>No boards found for this project.</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <section
            className="board-columns"
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
              overflowX: "auto",
            }}
          >
            {boards.map((board) => (
              <div key={board.id}>
                <h2>{board.name}</h2>

                {statuses
                  .filter(
                    (status) =>
                      Number(status.board) === Number(board.id)
                  )
                  .map((status) => {
                    const columnIssues = filteredIssues
                      .filter(
                        (issue) =>
                          Number(issue.status) === Number(status.id)
                      )
                      .sort(
                        (a, b) =>
                          Number(a.rank) - Number(b.rank)
                      );

                    return (
                      <IssueColumn
                        key={status.id}
                        board={board}
                        status={status}
                        issues={columnIssues}
                        onAddIssue={() => {
                          setNewIssueStatus(status.id);
                          setFormError("");
                          setTitle("");
                          setDescription("");
                          setPriority("medium");
                        }}
                      >
                        {newIssueStatus === status.id && (
                          <form
                            onSubmit={(event) =>
                              handleCreateIssue(event, board, status)
                            }
                          >
                            <label>
                              Issue title
                              <input
                                value={title}
                                onChange={(event) =>
                                  setTitle(event.target.value)
                                }
                                placeholder="e.g. Fix login bug"
                                required
                                style={{
                                  display: "block",
                                  width: "100%",
                                  boxSizing: "border-box",
                                  padding: "8px",
                                  marginBottom: "8px",
                                }}
                              />
                            </label>

                            <label>
                              Description
                              <textarea
                                value={description}
                                onChange={(event) =>
                                  setDescription(event.target.value)
                                }
                                placeholder="Optional details"
                                rows={3}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  boxSizing: "border-box",
                                  padding: "8px",
                                  marginBottom: "8px",
                                }}
                              />
                            </label>

                            <label>
                              Priority
                              <select
                                value={priority}
                                onChange={(event) =>
                                  setPriority(event.target.value)
                                }
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "8px",
                                  marginBottom: "8px",
                                }}
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                              </select>
                            </label>

                            {formError && (
                              <p role="alert" style={{ color: "red" }}>
                                {formError}
                              </p>
                            )}

                            <button type="submit" disabled={saving}>
                              {saving ? "Creating..." : "Create issue"}
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setNewIssueStatus(null);
                                setFormError("");
                                setTitle("");
                                setDescription("");
                                setPriority("medium");
                              }}
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </IssueColumn>
                    );
                  })}
              </div>
            ))}
          </section>
        </DndContext>
      )}
    </main>
  );
}
