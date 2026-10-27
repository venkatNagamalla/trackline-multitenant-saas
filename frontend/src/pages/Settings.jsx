
import { useEffect, useState } from "react";
import { apiRequest } from "../api";

export default function Settings() {
  const [statuses, setStatuses] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [boardId, setBoardId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [newIsDone, setNewIsDone] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  async function loadData(preferredBoard = "") {
    setLoading(true);
    setError("");

    try {
      const [statusData, transitionData] = await Promise.all([
        apiRequest("/projects/statuses/"),
        apiRequest("/projects/transitions/"),
      ]);

      const statusResults = statusData?.results ?? statusData ?? [];
      const transitionResults =
        transitionData?.results ?? transitionData ?? [];

      setStatuses(statusResults);
      setTransitions(transitionResults);

      const availableBoards = [
        ...new Set(statusResults.map((status) => String(status.board))),
      ];

      setBoardId((current) => {
        const preferred = String(preferredBoard || current || "");
        return availableBoards.includes(preferred)
          ? preferred
          : availableBoards[0] || "";
      });
    } catch (err) {
      setError(err.message || "Failed to load workflow settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const boards = [
    ...new Set(statuses.map((status) => status.board)),
  ];

  const boardStatuses = statuses
    .filter((status) => String(status.board) === boardId)
    .sort((a, b) => a.order - b.order);

  const boardTransitions = transitions.filter(
    (transition) => String(transition.board) === boardId
  );

  async function runAction(action, successMessage) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await action();
      await loadData(boardId);
      setMessage(successMessage);
    } catch (err) {
      setError(err.message || "The operation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addStatus(event) {
    event.preventDefault();

    if (!boardId || !newName.trim()) {
      setError("Select a board and enter a status name.");
      return;
    }

    await runAction(async () => {
      await apiRequest("/projects/statuses/", {
        method: "POST",
        body: JSON.stringify({
          board: Number(boardId),
          name: newName.trim(),
          order: boardStatuses.length
            ? Math.max(...boardStatuses.map((status) => status.order)) + 1
            : 1,
          is_done: newIsDone,
        }),
      });

      setNewName("");
      setNewIsDone(false);
    }, "Status added successfully.");
  }

  async function renameStatus(status) {
    if (!editName.trim()) {
      setError("Status name cannot be empty.");
      return;
    }

    await runAction(async () => {
      await apiRequest(`/projects/statuses/${status.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });

      setEditingId(null);
      setEditName("");
    }, "Status renamed successfully.");
  }

  async function changeOrder(status, direction) {
    const index = boardStatuses.findIndex(
      (item) => item.id === status.id
    );
    const other = boardStatuses[index + direction];

    if (!other) return;

    await runAction(async () => {
      const temporaryOrder =
        Math.max(...boardStatuses.map((item) => item.order)) + 1000;

      await apiRequest(`/projects/statuses/${status.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ order: temporaryOrder }),
      });

      await apiRequest(`/projects/statuses/${other.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ order: status.order }),
      });

      await apiRequest(`/projects/statuses/${status.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ order: other.order }),
      });
    }, "Status order updated.");
  }

  async function deleteStatus(status) {
    if (
      !window.confirm(
        `Delete "${status.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    await runAction(
      () =>
        apiRequest(`/projects/statuses/${status.id}/`, {
          method: "DELETE",
        }),
      "Status deleted successfully."
    );
  }

  function hasTransition(fromStatusId, toStatusId) {
    return boardTransitions.some(
      (transition) =>
        Number(transition.from_status) === Number(fromStatusId) &&
        Number(transition.to_status) === Number(toStatusId)
    );
  }

  async function toggleTransition(fromStatusId, toStatusId, checked) {
    await runAction(async () => {
      if (checked) {
        await apiRequest("/projects/transitions/", {
          method: "POST",
          body: JSON.stringify({
            board: Number(boardId),
            from_status: Number(fromStatusId),
            to_status: Number(toStatusId),
          }),
        });
      } else {
        const existing = boardTransitions.find(
          (transition) =>
            Number(transition.from_status) === Number(fromStatusId) &&
            Number(transition.to_status) === Number(toStatusId)
        );

        if (existing) {
          await apiRequest(`/projects/transitions/${existing.id}/`, {
            method: "DELETE",
          });
        }
      }
    }, checked ? "Transition enabled." : "Transition disabled.");
  }

  return (
    <section className="settings-page">
      <h1>Settings</h1>
      <p>Manage workflow statuses and allowed transitions.</p>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {loading ? (
        <p>Loading workflow settings...</p>
      ) : (
        <>
          <label htmlFor="workflow-board">Select board</label>{" "}
          <select
            id="workflow-board"
            value={boardId}
            onChange={(event) => {
              setBoardId(event.target.value);
              setError("");
              setMessage("");
            }}
          >
            {boards.map((id) => (
              <option key={id} value={String(id)}>
                Board {id}
              </option>
            ))}
          </select>

          <section>
            <h2>Workflow Statuses</h2>

            {boardStatuses.length === 0 ? (
              <p>No statuses found for this board.</p>
            ) : (
              <ul>
                {boardStatuses.map((status, index) => (
                  <li key={status.id} style={{ margin: "16px 0" }}>
                    {editingId === status.id ? (
                      <>
                        <input
                          value={editName}
                          onChange={(event) =>
                            setEditName(event.target.value)
                          }
                          aria-label="New status name"
                        />
                        <button
                          disabled={saving}
                          onClick={() => renameStatus(status)}
                        >
                          Save
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <strong>{status.name}</strong>
                        {" — Order: "}
                        {status.order}
                        {status.is_done ? " (Done status)" : ""}
                        <button
                          disabled={saving}
                          onClick={() => {
                            setEditingId(status.id);
                            setEditName(status.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          disabled={saving || index === 0}
                          onClick={() => changeOrder(status, -1)}
                          aria-label={`Move ${status.name} up`}
                        >
                          ↑
                        </button>
                        <button
                          disabled={
                            saving || index === boardStatuses.length - 1
                          }
                          onClick={() => changeOrder(status, 1)}
                          aria-label={`Move ${status.name} down`}
                        >
                          ↓
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => deleteStatus(status)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h3>Add a status</h3>
            <form onSubmit={addStatus}>
              <label htmlFor="new-status-name">Status name</label>
              <input
                id="new-status-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={50}
                required
              />

              <label>
                <input
                  type="checkbox"
                  checked={newIsDone}
                  onChange={(event) => setNewIsDone(event.target.checked)}
                />
                Mark as a completed status
              </label>

              <button type="submit" disabled={saving || !boardId}>
                {saving ? "Saving..." : "Add Status"}
              </button>
            </form>
          </section>

          <section>
            <h2>Allowed Transitions</h2>

            <p>
              Check a box to allow moving from a row's status to a column's
              status. Uncheck it to remove that transition.
            </p>

            <aside
              role="note"
              style={{
                padding: "12px 16px",
                margin: "12px 0 16px",
                border: "1px solid #f59e0b",
                borderRadius: "6px",
                background: "#fffbeb",
                color: "#78350f",
              }}
            >
              <strong>Important — How transition rules work</strong>
              <p style={{ marginBottom: 0 }}>
                If a status has no outgoing transitions enabled, all
                destination statuses are allowed by default. To restrict
                movement from a status, enable at least one outgoing
                transition and leave unwanted destinations unchecked.
              </p>
            </aside>

            {boardStatuses.length < 2 ? (
              <p>Add at least two statuses to configure transitions.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">From / To</th>
                      {boardStatuses.map((status) => (
                        <th scope="col" key={status.id}>
                          {status.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boardStatuses.map((fromStatus) => (
                      <tr key={fromStatus.id}>
                        <th scope="row">{fromStatus.name}</th>
                        {boardStatuses.map((toStatus) => {
                          const sameStatus =
                            fromStatus.id === toStatus.id;

                          return (
                            <td
                              key={toStatus.id}
                              style={{ textAlign: "center" }}
                            >
                              {sameStatus ? (
                                "—"
                              ) : (
                                <input
                                  type="checkbox"
                                  aria-label={`${fromStatus.name} to ${toStatus.name}`}
                                  checked={hasTransition(
                                    fromStatus.id,
                                    toStatus.id
                                  )}
                                  disabled={saving}
                                  onChange={(event) =>
                                    toggleTransition(
                                      fromStatus.id,
                                      toStatus.id,
                                      event.target.checked
                                    )
                                  }
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
