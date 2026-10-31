
import { useEffect, useState } from "react";
import { apiRequest } from "../api";

const WEBHOOK_EVENTS = [
  "issue.created",
  "issue.moved",
  "sprint.completed",
];

const buttonPrimary =
  "rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

function StatusBadge({ status }) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    pending: "bg-amber-50 text-amber-700 ring-amber-100",
    failed: "bg-rose-50 text-rose-700 ring-rose-100",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    inactive: "bg-slate-100 text-slate-500 ring-slate-200",
    completed: "bg-violet-50 text-violet-700 ring-violet-100",
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

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function LoadingMessage({ text }) {
  return (
    <div className="flex min-h-32 w-full flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
      <p className="text-sm font-medium text-slate-500">{text}</p>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-xl text-violet-500">
        ◇
      </div>
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
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

  async function copyInvitationLink() {
    if (!createdInvitation?.invite_link) return;

    const link = createdInvitation.invite_link.startsWith("http")
      ? createdInvitation.invite_link
      : `${window.location.origin}/${createdInvitation.invite_link.replace(/^\/+/, "")}`;

    try {
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      setMessage("Invitation link copied successfully.");
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setError("Failed to copy invitation link.");
    }
  }

  // ---------------- UI ----------------

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8">

      {/* PAGE HEADER */}
      <header>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">
            Workspace configuration
          </p>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Settings
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Manage your team, workflows, integrations, and workspace activity.
        </p>
      </header>

      {/* FEEDBACK */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
        >
          {message}
        </div>
      )}

      {/* WORKSPACE MEMBERS */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeader
          eyebrow="Team management"
          title="Workspace Members"
          description="View workspace members, manage their roles, and control access."
        />

        {membersLoading ? (
          <LoadingMessage text="Loading workspace members..." />
        ) : members.length === 0 ? (
          <EmptyState
            title="No workspace members found"
            description="Workspace members will appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Member
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="transition hover:bg-violet-50/30"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                          {(member.username || member.email || "U")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>

                        <div>
                          <p className="font-semibold text-slate-800">
                            {member.username}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-50"
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
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                        disabled={memberActionId === member.id}
                        onClick={() => removeMember(member)}
                      >
                        {memberActionId === member.id ? "Working..." : "Remove"}
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
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeader
          eyebrow="Grow your team"
          title="Invite a Workspace Member"
          description="Invite teammates and choose the access role they will receive."
        />

        <form
          onSubmit={createInvitation}
          className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
        >
          <div>
            <label
              htmlFor="invite-email"
              className="text-sm font-semibold text-slate-700"
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
              className="text-sm font-semibold text-slate-700"
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
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="font-semibold text-emerald-800">
              Invitation created successfully
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              {createdInvitation.email} · {createdInvitation.role}
            </p>

            {createdInvitation.invite_link && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold text-slate-600">
                  Invitation link
                </label>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={
                      createdInvitation.invite_link.startsWith("http")
                        ? createdInvitation.invite_link
                        : `${window.location.origin}/${createdInvitation.invite_link.replace(/^\/+/, "")}`
                    }
                    className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm text-slate-600"
                    aria-label="Invitation link"
                  />

                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={copyInvitationLink}
                  >
                    {inviteCopied ? "Copied ✓" : "Copy link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          Only workspace admins can manage members and create invitations.
          Pending invitation listing is not currently exposed by the backend API.
        </p>
      </section>

      {/* WORKFLOW SETTINGS */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeader
          eyebrow="Project configuration"
          title="Workflow Settings"
          description="Configure board statuses and allowed issue transitions."
        />

        {loading ? (
          <LoadingMessage text="Loading workflow settings..." />
        ) : (
          <>
            <div className="mb-7 max-w-sm">
              <label
                htmlFor="workflow-board"
                className="text-sm font-semibold text-slate-700"
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
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  Workflow Statuses
                </h3>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {boardStatuses.length} statuses
                </span>
              </div>

              {boardStatuses.length === 0 ? (
                <EmptyState
                  title="No statuses found"
                  description="Add a status to configure this board."
                />
              ) : (
                <div className="space-y-3">
                  {boardStatuses.map((status, index) => (
                    <div
                      key={status.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center"
                    >
                      {editingId === status.id ? (
                        <div className="flex flex-1 flex-wrap gap-2">
                          <input
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400"
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
                              <span className="font-semibold text-slate-800">
                                {status.name}
                              </span>
                              {status.is_done && (
                                <StatusBadge status="Completed" />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              Position {status.order}
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
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
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
            <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/70 p-5">
              <h3 className="text-base font-bold text-slate-800">
                Add a Status
              </h3>

              <form
                onSubmit={addStatus}
                className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <label
                    htmlFor="new-status-name"
                    className="text-sm font-semibold text-slate-700"
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

                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={newIsDone}
                    onChange={(event) => setNewIsDone(event.target.checked)}
                    className="h-4 w-4 accent-violet-600"
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
              <h3 className="text-base font-bold text-slate-800">
                Allowed Transitions
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Control which statuses users can move issues between.
              </p>

              <div className="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                <strong>Important:</strong> If a status has no outgoing
                transitions enabled, all destination statuses are allowed by
                default. To restrict movement, enable at least one outgoing
                transition and leave unwanted destinations unchecked.
              </div>

              {boardStatuses.length < 2 ? (
                <EmptyState
                  title="Not enough statuses"
                  description="Add at least two statuses to configure transitions."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">
                          From / To
                        </th>
                        {boardStatuses.map((status) => (
                          <th
                            key={status.id}
                            className="px-4 py-3 text-center font-semibold text-slate-600"
                          >
                            {status.name}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {boardStatuses.map((fromStatus) => (
                        <tr key={fromStatus.id} className="hover:bg-slate-50">
                          <th className="bg-slate-50/70 px-4 py-3 text-left font-semibold text-slate-700">
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
                                  <span className="text-slate-300">—</span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-violet-600"
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
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeader
          eyebrow="External integrations"
          title="Webhook Integrations"
          description="Connect external applications and receive Trackline events."
          action={
            <button
              className={buttonSecondary}
              onClick={refreshWebhookData}
              disabled={webhooksLoading || deliveriesLoading}
            >
              ↻ Refresh Data
            </button>
          }
        />

        {/* CREATE WEBHOOK */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
          <h3 className="text-base font-bold text-slate-800">
            Register a New Webhook
          </h3>

          <form onSubmit={createWebhook} className="mt-4 space-y-5">
            <div>
              <label
                htmlFor="webhook-url"
                className="text-sm font-semibold text-slate-700"
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
              <legend className="text-sm font-semibold text-slate-700">
                Select Events
              </legend>

              <div className="mt-3 flex flex-wrap gap-3">
                {WEBHOOK_EVENTS.map((eventName) => (
                  <label
                    key={eventName}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-violet-600"
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
          <h3 className="mb-4 text-base font-bold text-slate-800">
            Registered Webhooks
          </h3>

          {webhooksLoading ? (
            <LoadingMessage text="Loading webhooks..." />
          ) : webhooks.length === 0 ? (
            <EmptyState
              title="No webhooks registered"
              description="Your registered integrations will appear here."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Webhook URL
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Events
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {webhooks.map((webhook) => (
                    <tr
                      key={webhook.id}
                      className="transition hover:bg-violet-50/30"
                    >
                      <td className="max-w-xs break-all px-4 py-4 font-medium text-slate-700">
                        {webhook.url}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {webhook.events?.map((eventName) => (
                            <span
                              key={eventName}
                              className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700"
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
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
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
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <SectionHeader
          eyebrow="Integration monitoring"
          title="Webhook Delivery History"
          description="Monitor webhook attempts, responses, and delivery status."
          action={
            <button
              className={buttonSecondary}
              onClick={loadDeliveries}
              disabled={deliveriesLoading}
            >
              {deliveriesLoading ? "Refreshing..." : "↻ Refresh History"}
            </button>
          }
        />

        {/* DELIVERY SUMMARY */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Deliveries
            </p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">
              {deliveries.length}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Successful
            </p>
            <p className="mt-2 text-2xl font-extrabold text-emerald-700">
              {deliveries.filter((item) => item.status === "success").length}
            </p>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Failed
            </p>
            <p className="mt-2 text-2xl font-extrabold text-rose-700">
              {deliveries.filter((item) => item.status === "failed").length}
            </p>
          </div>
        </div>

        {/* FILTER */}
        <div className="mb-5 max-w-sm">
          <label
            htmlFor="delivery-filter"
            className="text-sm font-semibold text-slate-700"
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
          <LoadingMessage text="Loading delivery history..." />
        ) : filteredDeliveries.length === 0 ? (
          <EmptyState
            title="No delivery records found"
            description="Test a registered webhook to generate a delivery record."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Event",
                    "Webhook URL",
                    "Status",
                    "HTTP",
                    "Attempts",
                    "Created",
                    "Delivered",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredDeliveries.map((delivery) => (
                  <tr
                    key={delivery.id}
                    className="transition hover:bg-violet-50/30"
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">
                      {delivery.event}
                    </td>

                    <td className="max-w-xs break-all px-4 py-4 text-slate-500">
                      {delivery.endpoint_url}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={delivery.status} />
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {delivery.response_status ?? "—"}
                    </td>

                    <td className="px-4 py-4 text-slate-600">
                      {delivery.attempts}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
                      {formatDate(delivery.created_at)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
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
            <h3 className="mb-3 text-sm font-bold text-rose-700">
              Delivery Error Details
            </h3>

            <div className="space-y-3">
              {filteredDeliveries
                .filter((item) => item.last_error)
                .map((delivery) => (
                  <div
                    key={delivery.id}
                    className="rounded-xl border border-rose-200 bg-rose-50/70 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      Delivery #{delivery.id} — {delivery.event}
                    </p>

                    <p className="mt-2 break-words text-sm text-rose-700">
                      {delivery.last_error}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
