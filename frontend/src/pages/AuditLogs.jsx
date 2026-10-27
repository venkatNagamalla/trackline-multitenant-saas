
import { useEffect, useState } from "react";
import { apiRequest } from "../api";

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState(null);
  const [previous, setPrevious] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
        });

        if (action) {
          params.set("action", action);
        }

        const data = await apiRequest(
          `/audit/?${params.toString()}`
        );

        if (cancelled) return;

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
        if (!cancelled) {
          setError(
            err.message ||
              "Could not load audit logs. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLogs();

    return () => {
      cancelled = true;
    };
  }, [page, action]);

  function handleActionChange(event) {
    setAction(event.target.value);
    setPage(1);
  }

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.heading}>Audit Logs</h1>
          <p style={styles.subtitle}>
            Review activity recorded in your workspace.
          </p>
        </div>

        <button
          type="button"
          style={styles.refreshButton}
          onClick={() => {
            setPage((current) => current);
            // Trigger a refresh by changing the page state
            // is not reliable when the page is already unchanged.
            window.location.reload();
          }}
        >
          Refresh
        </button>
      </header>

      <section style={styles.filterSection}>
        <label htmlFor="audit-action" style={styles.label}>
          Filter by action
        </label>

        <select
          id="audit-action"
          value={action}
          onChange={handleActionChange}
          style={styles.select}
        >
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="move">Move</option>
        </select>

        <span style={styles.total}>
          Total records: {count}
        </span>
      </section>

      {loading && (
        <p style={styles.message}>Loading audit logs...</p>
      )}

      {!loading && error && (
        <div role="alert" style={styles.error}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Actor</th>
                  <th style={styles.th}>Action</th>
                  <th style={styles.th}>Object Type</th>
                  <th style={styles.th}>Object ID</th>
                  <th style={styles.th}>Changes</th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={styles.td}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td style={styles.td}>
                      {log.actor_email || "Unknown"}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.actionBadge,
                          ...(actionStyles[log.action] ||
                            actionStyles.default),
                        }}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {log.object_type}
                    </td>

                    <td style={styles.td}>
                      {log.object_id}
                    </td>

                    <td style={styles.td}>
                      <details>
                        <summary style={styles.summary}>
                          View changes
                        </summary>

                        <pre style={styles.changes}>
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}

                {logs.length === 0 && (
                  <tr>
                    <td
                      style={styles.empty}
                      colSpan={6}
                    >
                      No audit records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer style={styles.pagination}>
            <button
              type="button"
              disabled={!previous}
              onClick={() => setPage((current) => current - 1)}
              style={{
                ...styles.pageButton,
                ...(!previous ? styles.disabledButton : {}),
              }}
            >
              Previous
            </button>

            <span style={styles.pageLabel}>
              Page {page}
            </span>

            <button
              type="button"
              disabled={!next}
              onClick={() => setPage((current) => current + 1)}
              style={{
                ...styles.pageButton,
                ...(!next ? styles.disabledButton : {}),
              }}
            >
              Next
            </button>
          </footer>
        </>
      )}
    </main>
  );
}

const actionStyles = {
  create: {
    background: "#dcfce7",
    color: "#166534",
  },
  update: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  delete: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  move: {
    background: "#f3e8ff",
    color: "#6b21a8",
  },
  default: {
    background: "#f3f4f6",
    color: "#374151",
  },
};

const styles = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "28px 24px",
    color: "#111827",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },
  heading: {
    margin: "0 0 8px",
    fontSize: "28px",
  },
  subtitle: {
    margin: 0,
    color: "#6b7280",
  },
  refreshButton: {
    padding: "10px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    background: "#ffffff",
    cursor: "pointer",
  },
  filterSection: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
  },
  label: {
    fontWeight: 600,
  },
  select: {
    padding: "9px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    background: "#ffffff",
  },
  total: {
    marginLeft: "auto",
    color: "#4b5563",
  },
  message: {
    padding: "20px 0",
    color: "#6b7280",
  },
  error: {
    padding: "14px",
    borderRadius: "6px",
    background: "#fee2e2",
    color: "#991b1b",
  },
  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "14px",
  },
  th: {
    padding: "14px 12px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
  },
  actionBadge: {
    display: "inline-block",
    padding: "4px 9px",
    borderRadius: "999px",
    fontWeight: 600,
    textTransform: "capitalize",
  },
  summary: {
    cursor: "pointer",
    color: "#2563eb",
  },
  changes: {
    maxWidth: "360px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSize: "12px",
    padding: "10px",
    background: "#f9fafb",
    borderRadius: "6px",
  },
  empty: {
    padding: "28px",
    textAlign: "center",
    color: "#6b7280",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "18px",
    marginTop: "24px",
  },
  pageButton: {
    padding: "9px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    background: "#ffffff",
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  pageLabel: {
    fontWeight: 600,
  },
};

export default AuditLogs;
