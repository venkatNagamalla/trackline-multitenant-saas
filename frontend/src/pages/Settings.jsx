import { useEffect, useState } from "react";
import { apiRequest } from "../api";

const WEBHOOK_EVENTS = ["issue.created", "issue.moved", "sprint.completed"];

const buttonPrimary =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
  "rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

function StatusBadge({ status }) {
  const styles = {
    success: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    failed: "bg-rose-500/10 text-rose-400 ring-rose-500/20",
    active: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    inactive: "bg-slate-500/10 text-slate-400 ring-slate-500/20",
  };

  const normalized = String(status || "").toLowerCase();

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
        styles[normalized] || styles.inactive
      }`}
    >
      {status || "Unknown"}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString();
}

export default function Settings() {
  // Workflow states
  const [statuses, setStatuses] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [boardId, setBoardId] = useState("");

  // General states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Workflow form states
  const [newName, setNewName] = useState("");
  const [newIsDone, setNewIsDone] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  // Webhook states
  const [webhooks, setWebhooks] = useState([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState(["issue.created"]);

  // Delivery history states
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState("all");

  // Members and invitations
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberActionId, setMemberActionId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // ---------------- WORKFLOW DATA ----------------

  async function loadData(preferredBoard = "") {
    setLoading(true);
    setError("");

    try {
      const [statusData, transitionData] = await Promise.all([
        apiRequest("/projects/statuses/"),
        apiRequest("/projects/transitions/"),
      ]);

      const statusResults = statusData?.results ?? statusData ?? [];
      const transitionResults = transitionData?.results ?? transitionData ?? [];

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

  // ---------------- MEMBERS DATA ----------------

  async function loadMembers() {
    setMembersLoading(true);

    try {
      const data = await apiRequest("/auth/workspace/members/");
      setMembers(data?.members ?? data?.results ?? []);
    } catch (err) {
      setError(err.message || "Failed to load workspace members.");
    } finally {
      setMembersLoading(false);
    }
  }

  // ---------------- WEBHOOK DATA ----------------

  async function loadWebhooks() {
    setWebhooksLoading(true);

    try {
      const data = await apiRequest("/webhooks/");
      setWebhooks(data?.results ?? data ?? []);
    } catch (err) {
      setError(err.message || "Failed to load webhooks.");
    } finally {
      setWebhooksLoading(false);
    }
  }

  async function loadDeliveries() {
    setDeliveriesLoading(true);

    try {
      const data = await apiRequest("/webhooks/deliveries/");
      setDeliveries(data?.results ?? data ?? []);
    } catch (err) {
      setError(err.message || "Failed to load webhook delivery history.");
    } finally {
      setDeliveriesLoading(false);
    }
  }

  async function refreshWebhookData() {
    setError("");

    await Promise.all([loadWebhooks(), loadDeliveries()]);
  }

  useEffect(() => {
    loadData();
    loadMembers();
    loadWebhooks();
    loadDeliveries();
  }, []);

  // ---------------- DERIVED DATA ----------------

  const boards = [...new Set(statuses.map((status) => status.board))];

  const boardStatuses = statuses
    .filter((status) => String(status.board) === boardId)
    .sort((a, b) => a.order - b.order);

  const boardTransitions = transitions.filter(
    (transition) => String(transition.board) === boardId,
  );

  const filteredDeliveries =
    selectedWebhook === "all"
      ? deliveries
      : deliveries.filter(
          (delivery) => String(delivery.endpoint_id) === selectedWebhook,
        );

  // ---------------- COMMON ACTION ----------------

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

  // ---------------- MEMBER AND INVITATION ACTIONS ----------------

  async function createInvitation(event) {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      setError("Enter an email address to invite.");
      return;
    }

    setInvitationLoading(true);
    setError("");
    setMessage("");
    setCreatedInvitation(null);

    try {
      const data = await apiRequest("/auth/invitations/", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      setCreatedInvitation(data?.invitation ?? null);
      setInviteCopied(false);
      setInviteEmail("");
      setInviteRole("member");
      setMessage(data?.message || "Invitation created successfully.");
      await loadMembers();
    } catch (err) {
      setError(err.message || "Failed to create invitation.");
    } finally {
      setInvitationLoading(false);
    }
  }

  async function updateMemberRole(member, role) {
    if (member.role === role) return;

    setMemberActionId(member.id);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/auth/workspace/members/${member.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      await loadMembers();
      setMessage(`Updated ${member.username}'s role to ${role}.`);
    } catch (err) {
      setError(err.message || "Failed to update member role.");
    } finally {
      setMemberActionId(null);
    }
  }

  async function removeMember(member) {
    if (
      !window.confirm(
        `Remove ${member.email} from this workspace? This cannot be undone.`,
      )
    ) {
      return;
    }

    setMemberActionId(member.id);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/auth/workspace/members/${member.id}/`, {
        method: "DELETE",
      });

      await loadMembers();
      setMessage(`${member.email} was removed from the workspace.`);
    } catch (err) {
      setError(err.message || "Failed to remove workspace member.");
    } finally {
      setMemberActionId(null);
    }
  }

  // ---------------- WORKFLOW FUNCTIONS ----------------

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
    const index = boardStatuses.findIndex((item) => item.id === status.id);

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
    if (!window.confirm(`Delete "${status.name}"? This cannot be undone.`)) {
      return;
    }

    await runAction(
      () =>
        apiRequest(`/projects/statuses/${status.id}/`, {
          method: "DELETE",
        }),
      "Status deleted successfully.",
    );
  }

  function hasTransition(fromStatusId, toStatusId) {
    return boardTransitions.some(
      (transition) =>
        Number(transition.from_status) === Number(fromStatusId) &&
        Number(transition.to_status) === Number(toStatusId),
    );
  }

  async function toggleTransition(fromStatusId, toStatusId, checked) {
    await runAction(
      async () => {
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
              Number(transition.to_status) === Number(toStatusId),
          );

          if (existing) {
            await apiRequest(`/projects/transitions/${existing.id}/`, {
              method: "DELETE",
            });
          }
        }
      },
      checked ? "Transition enabled." : "Transition disabled.",
    );
  }

  // ---------------- WEBHOOK FUNCTIONS ----------------

  function toggleWebhookEvent(eventName) {
    setWebhookEvents((current) =>
      current.includes(eventName)
        ? current.filter((event) => event !== eventName)
        : [...current, eventName],
    );
  }

  async function createWebhook(event) {
    event.preventDefault();

    if (!webhookUrl.trim()) {
      setError("Enter a webhook URL.");
      return;
    }

    if (webhookEvents.length === 0) {
      setError("Select at least one webhook event.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest("/webhooks/", {
        method: "POST",
        body: JSON.stringify({
          url: webhookUrl.trim(),
          events: webhookEvents,
          active: true,
        }),
      });

      setWebhookUrl("");
      setWebhookEvents(["issue.created"]);

      await refreshWebhookData();

      setMessage("Webhook registered successfully.");
    } catch (err) {
      setError(err.message || "Failed to register webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function testWebhook(webhook) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(`/webhooks/${webhook.id}/test/`, {
        method: "POST",
      });

      setMessage(result.detail || "Test webhook queued successfully.");

      await refreshWebhookData();
    } catch (err) {
      setError(err.message || "Failed to test webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleWebhookActive(webhook) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/webhooks/${webhook.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          active: !webhook.active,
        }),
      });

      await loadWebhooks();

      setMessage(
        `Webhook ${webhook.active ? "deactivated" : "activated"} successfully.`,
      );
    } catch (err) {
      setError(err.message || "Failed to update webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWebhook(webhook) {
    if (
      !window.confirm(`Delete webhook "${webhook.url}"? This cannot be undone.`)
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/webhooks/${webhook.id}/`, {
        method: "DELETE",
      });

      await refreshWebhookData();

      setMessage("Webhook deleted successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete webhook.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------- UI ----------------

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* PAGE HEADER */}

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
            Workspace Configuration
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Settings
          </h1>

          <p className="mt-2 text-slate-400">
            Manage workflows, integrations, and webhook activity.
          </p>
        </div>

        {/* FEEDBACK */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
          >
            {message}
          </div>
        )}

        {/* WORKSPACE MEMBERS */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Workspace Members</h2>
            <p className="mt-1 text-sm text-slate-400">
              View workspace members, manage their roles, and remove access when
              needed.
            </p>
          </div>

          {membersLoading ? (
            <p className="text-sm text-slate-400">
              Loading workspace members...
            </p>
          ) : members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
              No workspace members found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-400">
                      Member
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-400">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-white">
                          {member.username}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {member.email}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                          value={member.role}
                          disabled={memberActionId === member.id}
                          onChange={(event) =>
                            updateMemberRole(member, event.target.value)
                          }
                          aria-label={`Role for ${member.email}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={memberActionId === member.id}
                          onClick={() => removeMember(member)}
                        >
                          {memberActionId === member.id
                            ? "Working..."
                            : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* WORKSPACE INVITATIONS */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">
              Invite a Workspace Member
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Send an invitation by email and choose the role the new member
              will receive.
            </p>
          </div>

          <form
            onSubmit={createInvitation}
            className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
          >
            <div>
              <label
                htmlFor="invite-email"
                className="text-sm font-medium text-slate-300"
              >
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                className={inputClass}
                placeholder="teammate@example.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="invite-role"
                className="text-sm font-medium text-slate-300"
              >
                Workspace role
              </label>
              <select
                id="invite-role"
                className={inputClass}
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              className={buttonPrimary}
              disabled={invitationLoading}
            >
              {invitationLoading ? "Sending..." : "Send Invitation"}
            </button>
          </form>

          {createdInvitation && (
            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="font-semibold text-emerald-300">
                Invitation created
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {createdInvitation.email} · {createdInvitation.role}
              </p>
              {createdInvitation.invite_link && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-slate-400">Invitation link</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={
                        createdInvitation.invite_link.startsWith("http")
                          ? createdInvitation.invite_link
                          : `${window.location.origin}/${createdInvitation.invite_link.replace(/^\/+/, "")}`
                      }
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
                      aria-label="Invitation link"
                    />
                    <button
                      type="button"
                      className={buttonSecondary}
                      onClick={async () => {
                        const link = createdInvitation.invite_link.startsWith(
                          "http",
                        )
                          ? createdInvitation.invite_link
                          : `${window.location.origin}/${createdInvitation.invite_link.replace(/^\/+/, "")}`;

                        try {
                          await navigator.clipboard.writeText(link);
                          setInviteCopied(true);
                          setMessage("Invitation link copied successfully.");
                          setInviteCopied(true);
                          setMessage("Invitation link copied successfully.");

                          setTimeout(() => {
                            setInviteCopied(false);
                          }, 2000);
                        } catch {
                          setError("Failed to copy invitation link.");
                        }
                      }}
                    >
                      {inviteCopied ? "Copied ✓" : "Copy link"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Only workspace admins can manage members and create invitations.
            Pending invitation listing is not currently exposed by the backend
            API.
          </p>
        </section>

        {/* WORKFLOW SETTINGS */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Workflow Settings</h2>
            <p className="mt-1 text-sm text-slate-400">
              Configure board statuses and allowed status transitions.
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">
              Loading workflow settings...
            </p>
          ) : (
            <>
              <div className="mb-6 max-w-sm">
                <label
                  htmlFor="workflow-board"
                  className="text-sm font-medium text-slate-300"
                >
                  Select board
                </label>

                <select
                  id="workflow-board"
                  className={inputClass}
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
              </div>

              {/* STATUS LIST */}

              <div className="mb-8">
                <h3 className="mb-3 text-lg font-semibold text-white">
                  Workflow Statuses
                </h3>

                {boardStatuses.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                    No statuses found for this board.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {boardStatuses.map((status, index) => (
                      <div
                        key={status.id}
                        className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center"
                      >
                        {editingId === status.id ? (
                          <div className="flex flex-1 flex-wrap gap-2">
                            <input
                              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                              value={editName}
                              onChange={(event) =>
                                setEditName(event.target.value)
                              }
                              aria-label="New status name"
                            />

                            <button
                              className={buttonPrimary}
                              disabled={saving}
                              onClick={() => renameStatus(status)}
                            >
                              Save
                            </button>

                            <button
                              className={buttonSecondary}
                              disabled={saving}
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-white">
                                  {status.name}
                                </span>

                                {status.is_done && (
                                  <StatusBadge status="Completed" />
                                )}
                              </div>

                              <p className="mt-1 text-xs text-slate-500">
                                Order: {status.order}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                className={buttonSecondary}
                                disabled={saving}
                                onClick={() => {
                                  setEditingId(status.id);
                                  setEditName(status.name);
                                }}
                              >
                                Rename
                              </button>

                              <button
                                className={buttonSecondary}
                                disabled={saving || index === 0}
                                onClick={() => changeOrder(status, -1)}
                                aria-label={`Move ${status.name} up`}
                              >
                                ↑
                              </button>

                              <button
                                className={buttonSecondary}
                                disabled={
                                  saving || index === boardStatuses.length - 1
                                }
                                onClick={() => changeOrder(status, 1)}
                                aria-label={`Move ${status.name} down`}
                              >
                                ↓
                              </button>

                              <button
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                                disabled={saving}
                                onClick={() => deleteStatus(status)}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ADD STATUS */}

              <div className="mb-8 rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                <h3 className="text-lg font-semibold text-white">
                  Add a Status
                </h3>

                <form
                  onSubmit={addStatus}
                  className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
                >
                  <div className="flex-1">
                    <label
                      htmlFor="new-status-name"
                      className="text-sm font-medium text-slate-300"
                    >
                      Status name
                    </label>

                    <input
                      id="new-status-name"
                      className={inputClass}
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      maxLength={50}
                      placeholder="e.g. In Review"
                      required
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={newIsDone}
                      onChange={(event) => setNewIsDone(event.target.checked)}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    Completed status
                  </label>

                  <button
                    type="submit"
                    className={buttonPrimary}
                    disabled={saving || !boardId}
                  >
                    {saving ? "Saving..." : "Add Status"}
                  </button>
                </form>
              </div>

              {/* TRANSITIONS */}

              <div>
                <h3 className="text-lg font-semibold text-white">
                  Allowed Transitions
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Control which statuses users can move issues between.
                </p>

                <div className="my-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                  <strong>Important:</strong> If a status has no outgoing
                  transitions enabled, all destination statuses are allowed by
                  default. To restrict movement, enable at least one outgoing
                  transition and leave unwanted destinations unchecked.
                </div>

                {boardStatuses.length < 2 ? (
                  <p className="text-sm text-slate-400">
                    Add at least two statuses to configure transitions.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="min-w-full divide-y divide-slate-800 text-sm">
                      <thead className="bg-slate-950">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-300">
                            From / To
                          </th>

                          {boardStatuses.map((status) => (
                            <th
                              key={status.id}
                              className="px-4 py-3 text-center font-semibold text-slate-300"
                            >
                              {status.name}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-800">
                        {boardStatuses.map((fromStatus) => (
                          <tr key={fromStatus.id}>
                            <th className="bg-slate-950/50 px-4 py-3 text-left font-medium text-white">
                              {fromStatus.name}
                            </th>

                            {boardStatuses.map((toStatus) => {
                              const sameStatus = fromStatus.id === toStatus.id;

                              return (
                                <td
                                  key={toStatus.id}
                                  className="px-4 py-3 text-center"
                                >
                                  {sameStatus ? (
                                    <span className="text-slate-600">—</span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-indigo-500"
                                      aria-label={`${fromStatus.name} to ${toStatus.name}`}
                                      checked={hasTransition(
                                        fromStatus.id,
                                        toStatus.id,
                                      )}
                                      disabled={saving}
                                      onChange={(event) =>
                                        toggleTransition(
                                          fromStatus.id,
                                          toStatus.id,
                                          event.target.checked,
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
              </div>
            </>
          )}
        </section>

        {/* WEBHOOK SETTINGS */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                Webhook Integrations
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Connect external applications and receive Trackline events.
              </p>
            </div>

            <button
              className={buttonSecondary}
              onClick={refreshWebhookData}
              disabled={webhooksLoading || deliveriesLoading}
            >
              Refresh Data
            </button>
          </div>

          {/* CREATE WEBHOOK */}

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
            <h3 className="text-lg font-semibold text-white">
              Register a New Webhook
            </h3>

            <form onSubmit={createWebhook} className="mt-4 space-y-5">
              <div>
                <label
                  htmlFor="webhook-url"
                  className="text-sm font-medium text-slate-300"
                >
                  Webhook URL
                </label>

                <input
                  id="webhook-url"
                  type="url"
                  className={inputClass}
                  placeholder="https://example.com/webhooks/trackline"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  required
                />
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-slate-300">
                  Select Events
                </legend>

                <div className="mt-3 flex flex-wrap gap-3">
                  {WEBHOOK_EVENTS.map((eventName) => (
                    <label
                      key={eventName}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:border-indigo-500"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-indigo-500"
                        checked={webhookEvents.includes(eventName)}
                        onChange={() => toggleWebhookEvent(eventName)}
                      />
                      {eventName}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button type="submit" className={buttonPrimary} disabled={saving}>
                {saving ? "Registering..." : "Register Webhook"}
              </button>
            </form>
          </div>

          {/* REGISTERED WEBHOOKS */}

          <div className="mt-8">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Registered Webhooks
            </h3>

            {webhooksLoading ? (
              <p className="text-sm text-slate-400">Loading webhooks...</p>
            ) : webhooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                No webhooks registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-400">
                        Webhook URL
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400">
                        Events
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {webhooks.map((webhook) => (
                      <tr
                        key={webhook.id}
                        className="transition hover:bg-slate-800/30"
                      >
                        <td className="max-w-xs break-all px-4 py-4 text-slate-300">
                          {webhook.url}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {webhook.events?.map((eventName) => (
                              <span
                                key={eventName}
                                className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs text-indigo-300"
                              >
                                {eventName}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={webhook.active ? "Active" : "Inactive"}
                          />
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={buttonPrimary}
                              disabled={saving || !webhook.active}
                              onClick={() => testWebhook(webhook)}
                            >
                              Test
                            </button>

                            <button
                              className={buttonSecondary}
                              disabled={saving}
                              onClick={() => toggleWebhookActive(webhook)}
                            >
                              {webhook.active ? "Deactivate" : "Activate"}
                            </button>

                            <button
                              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                              disabled={saving}
                              onClick={() => deleteWebhook(webhook)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* WEBHOOK DELIVERY HISTORY */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                Webhook Delivery History
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Monitor webhook attempts, responses, and delivery status.
              </p>
            </div>

            <button
              className={buttonSecondary}
              onClick={loadDeliveries}
              disabled={deliveriesLoading}
            >
              {deliveriesLoading ? "Refreshing..." : "Refresh History"}
            </button>
          </div>

          {/* DELIVERY SUMMARY */}

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Total Deliveries</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {deliveries.length}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-300">Successful</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {deliveries.filter((item) => item.status === "success").length}
              </p>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <p className="text-sm text-rose-300">Failed</p>
              <p className="mt-2 text-2xl font-bold text-rose-400">
                {deliveries.filter((item) => item.status === "failed").length}
              </p>
            </div>
          </div>

          {/* FILTER */}

          <div className="mb-5 max-w-sm">
            <label
              htmlFor="delivery-filter"
              className="text-sm font-medium text-slate-300"
            >
              Filter by webhook
            </label>

            <select
              id="delivery-filter"
              className={inputClass}
              value={selectedWebhook}
              onChange={(event) => setSelectedWebhook(event.target.value)}
            >
              <option value="all">All webhooks</option>

              {webhooks.map((webhook) => (
                <option key={webhook.id} value={String(webhook.id)}>
                  {webhook.url}
                </option>
              ))}
            </select>
          </div>

          {/* DELIVERY TABLE */}

          {deliveriesLoading ? (
            <p className="text-sm text-slate-400">
              Loading delivery history...
            </p>
          ) : filteredDeliveries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
              <p className="font-medium text-slate-300">
                No delivery records found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Test a registered webhook to generate a delivery record.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-slate-400">
                      Event
                    </th>
                    <th className="px-4 py-3 text-left text-slate-400">
                      Webhook URL
                    </th>
                    <th className="px-4 py-3 text-left text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-slate-400">HTTP</th>
                    <th className="px-4 py-3 text-left text-slate-400">
                      Attempts
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-slate-400">
                      Created
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left text-slate-400">
                      Delivered
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {filteredDeliveries.map((delivery) => (
                    <tr
                      key={delivery.id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-white">
                        {delivery.event}
                      </td>

                      <td className="max-w-xs break-all px-4 py-4 text-slate-400">
                        {delivery.endpoint_url}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={delivery.status} />
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {delivery.response_status ?? "—"}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {delivery.attempts}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                        {formatDate(delivery.created_at)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                        {formatDate(delivery.delivered_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DELIVERY ERROR DETAILS */}

          {filteredDeliveries.some((item) => item.last_error) && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-rose-300">
                Delivery Error Details
              </h3>

              <div className="space-y-3">
                {filteredDeliveries
                  .filter((item) => item.last_error)
                  .map((delivery) => (
                    <div
                      key={delivery.id}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"
                    >
                      <p className="text-sm font-semibold text-white">
                        Delivery #{delivery.id} — {delivery.event}
                      </p>

                      <p className="mt-2 break-words text-sm text-rose-300">
                        {delivery.last_error}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
