
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

const priorityStyles = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

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
    opacity: isDragging ? 0.45 : 1,
    touchAction: "none",
  };

  const priority = (issue.priority || "medium").toLowerCase();

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`mb-3 cursor-grab rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md active:cursor-grabbing ${
        isDragging ? "shadow-lg ring-2 ring-violet-300" : ""
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          ISSUE-{issue.id}
        </span>

        <span
          className={`rounded-md border px-2 py-1 text-[10px] font-bold capitalize ${
            priorityStyles[priority] || priorityStyles.medium
          }`}
        >
          {priority}
        </span>
      </div>

      <h4 className="text-sm font-bold leading-5 text-slate-800">
        {issue.title}
      </h4>

      {issue.description && (
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
          {issue.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[10px] font-medium text-slate-400">
          Rank: {issue.rank}
        </span>

        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-[10px] font-bold text-violet-700">
          {String(issue.title || "I").charAt(0).toUpperCase()}
        </span>
      </div>
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
      className={`flex min-h-[250px] w-[290px] shrink-0 flex-col rounded-2xl border p-3 transition-colors ${
        isOver
          ? "border-violet-400 bg-violet-50"
          : "border-slate-200 bg-[#eef0f8]"
      }`}
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              isOver ? "bg-violet-500" : "bg-slate-400"
            }`}
          />

          <h3 className="truncate text-sm font-bold text-slate-800">
            {status.name}
          </h3>
        </div>

        <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-white px-2 text-[10px] font-bold text-slate-500 shadow-sm">
          {issues.length}
        </span>
      </div>

      <div className="flex-1">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}

        {issues.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-8 text-center">
            <p className="text-xs font-medium text-slate-400">
              No issues here yet
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Drag an issue here
            </p>
          </div>
        )}

        {children}
      </div>

      <button
        type="button"
        onClick={onAddIssue}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-violet-300 hover:bg-white hover:text-violet-700"
      >
        <span className="text-base">+</span>
        Add issue
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
    return (
      <div className="flex min-h-[calc(100vh-72px)] w-full items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-violet-100 border-t-violet-700" />
            <span className="text-lg font-bold text-violet-700">T</span>
          </div>
          <h2 className="mt-5 text-base font-bold text-slate-800">
            Loading project board
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Fetching your issues and statuses...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl text-red-600">
            !
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">
            Unable to load board
          </h2>
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={loadBoard}
              className="rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-800"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Back to projects
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6">
       <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-violet-700"
        >
          <span>←</span>
          Back to projects
        </button>
      {/* Project header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                Project board
              </span>
              <span className="text-xs text-slate-400">
                {issues.length} issues
              </span>
            </div>

            <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {project?.name || "Project board"}
            </h1>

            {project?.description && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-600">
              Board active
            </span>
          </div>
        </div>
      </header>

      {/* Search and filters */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            ⌕
          </span>
          <input
            type="search"
            placeholder="Search issues by title or description..."
            aria-label="Search issues"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex">
          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="all">All priorities</option>
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
            <option value="urgent">Urgent</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearchTerm("");
            setPriorityFilter("all");
            setStatusFilter("all");
          }}
          className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
        >
          Clear filters
        </button>
      </section>

      {/* Move error */}
      {moveError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {moveError}
        </div>
      )}

      {/* Board */}
      {boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-2xl text-violet-600">
            ▦
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-800">
            No boards found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            There are no boards available for this project.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <section className="space-y-8">
            {boards.map((board) => {
              const boardStatuses = statuses.filter(
                (status) =>
                  Number(status.board) === Number(board.id)
              );

              return (
                <div key={board.id}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                        Board
                      </p>
                      <h2 className="mt-1 text-lg font-extrabold text-slate-800">
                        {board.name}
                      </h2>
                    </div>

                    <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-500">
                      {boardStatuses.length} columns
                    </span>
                  </div>

                  <div className="flex items-start gap-4 overflow-x-auto pb-5">
                    {boardStatuses.map((status) => {
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
                              className="mb-3 rounded-xl border border-violet-200 bg-white p-4 shadow-sm"
                            >
                              <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-800">
                                  New issue
                                </h4>
                                <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
                                  {status.name}
                                </span>
                              </div>

                              <label className="mb-3 block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Issue title
                                </span>
                                <input
                                  value={title}
                                  onChange={(event) =>
                                    setTitle(event.target.value)
                                  }
                                  placeholder="e.g. Fix login bug"
                                  required
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                />
                              </label>

                              <label className="mb-3 block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Description
                                </span>
                                <textarea
                                  value={description}
                                  onChange={(event) =>
                                    setDescription(event.target.value)
                                  }
                                  placeholder="Optional details"
                                  rows={3}
                                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                                />
                              </label>

                              <label className="mb-4 block">
                                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Priority
                                </span>
                                <select
                                  value={priority}
                                  onChange={(event) =>
                                    setPriority(event.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-violet-400"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </label>

                              {formError && (
                                <p
                                  role="alert"
                                  className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-600"
                                >
                                  {formError}
                                </p>
                              )}

                              <div className="flex flex-col gap-2">
                                <button
                                  type="submit"
                                  disabled={saving}
                                  className="rounded-lg bg-[#34205f] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#261749] disabled:cursor-not-allowed disabled:opacity-60"
                                >
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
                                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          )}
                        </IssueColumn>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </DndContext>
      )}
    </main>
  );
}
