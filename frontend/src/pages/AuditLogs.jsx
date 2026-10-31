
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchLogs = useCallback(async (cancelledRef) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
      });

      if (action) {
        params.set("action", action);
      }

      const data = await apiRequest(`/audit/?${params.toString()}`);

      if (cancelledRef.cancelled) return;

      const records = Array.isArray(data.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];

      setLogs(records);
      setCount(data.count ?? records.length);
      setNext(data.next ?? null);
      setPrevious(data.previous ?? null);
    } catch (err) {
      if (!cancelledRef.cancelled) {
        setError(
          err.message || "Could not load audit logs. Please try again."
        );
      }
    } finally {
      if (!cancelledRef.cancelled) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, action]);

  useEffect(() => {
    const cancelledRef = { cancelled: false };

    fetchLogs(cancelledRef);

    return () => {
      cancelledRef.cancelled = true;
    };
  }, [fetchLogs, refreshKey]);

  function handleActionChange(event) {
    setAction(event.target.value);
    setPage(1);
  }

  function handleRefresh() {
    setRefreshing(true);
    setRefreshKey((current) => current + 1);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7">

      {/* Page heading */}
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">
              Workspace activity
            </p>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Audit Logs
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Monitor and review activity recorded across your workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={refreshing ? "animate-spin" : ""}>
            ↻
          </span>
          {refreshing ? "Refreshing..." : "Refresh logs"}
        </button>
      </header>

      {/* Summary and filters */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total records
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                {count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Recorded workspace activities
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-xl text-violet-600">
              ◷
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <label
            htmlFor="audit-action"
            className="mb-3 block text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Filter by action
          </label>

          <select
            id="audit-action"
            value={action}
            onChange={handleActionChange}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
          >
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="move">Move</option>
          </select>
        </div>
      </section>

      {/* Error */}
      {!loading && error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex min-h-[calc(100vh-350px)] w-full flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
          <p className="text-sm font-medium text-slate-500">
            Loading audit logs...
          </p>
        </div>
      )}

      {/* Audit table */}
      {!loading && !error && (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">

            <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Activity history
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Detailed records of workspace actions.
                </p>
              </div>

              <span className="w-fit rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                {logs.length} records on this page
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Date & Time
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Actor
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Object Type
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Object ID
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Changes
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-violet-50/30"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                            {(log.actor_email || "U").slice(0, 2).toUpperCase()}
                          </span>
                          <span className="max-w-[180px] truncate text-xs font-semibold text-slate-700">
                            {log.actor_email || "Unknown"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold capitalize ${
                            actionStyles[log.action] || actionStyles.default
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                        {log.object_type}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                          #{log.object_id}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <details className="group">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-violet-600 transition hover:bg-violet-50">
                            View changes
                            <span className="transition-transform group-open:rotate-180">
                              ▾
                            </span>
                          </summary>

                          <pre className="mt-3 max-h-64 max-w-[360px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}

                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                          ◷
                        </div>
                        <p className="mt-4 text-sm font-bold text-slate-700">
                          No audit records found
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Try changing the action filter.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <footer className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row">
              <p className="text-xs font-medium text-slate-500">
                Showing {logs.length} of {count} records · Page {page}
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!previous}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>

                <span className="rounded-lg bg-violet-100 px-3 py-2 text-xs font-bold text-violet-700">
                  {page}
                </span>

                <button
                  type="button"
                  disabled={!next}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </footer>
          </section>
        </>
      )}
    </div>
  );
}

const actionStyles = {
  create: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  update: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  delete: "bg-red-50 text-red-700 ring-1 ring-red-100",
  move: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
  default: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export default AuditLogs;
