
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../api";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

export default function Dashboard() {
  const { user, currentWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    key: "",
    description: "",
  });

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

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

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
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Trackline</h1>
          <p>Welcome, {user?.username || user?.email || "User"}!</p>
          <p>
            Workspace:{" "}
            {currentWorkspace?.name ||
              currentWorkspace?.slug ||
              "Not selected"}
          </p>
        </div>

        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section aria-labelledby="create-project-heading">
        <h2 id="create-project-heading">Create a project</h2>

        <form onSubmit={handleCreateProject}>
          <div>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="e.g. Website Redesign"
              maxLength={150}
              required
            />
          </div>

          <div>
            <label htmlFor="project-key">Project key</label>
            <input
              id="project-key"
              name="key"
              value={form.key}
              onChange={handleFormChange}
              placeholder="e.g. WEB"
              maxLength={10}
              required
            />
          </div>

          <div>
            <label htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>

          {formError && <p role="alert">{formError}</p>}
          {success && <p role="status">{success}</p>}

          <button type="submit" disabled={creating || !currentWorkspace}>
            {creating ? "Creating..." : "Create project"}
          </button>
        </form>
      </section>

      <section aria-labelledby="projects-heading">
        <h2 id="projects-heading">Projects</h2>

        {loading && <p>Loading projects...</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={loadProjects}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <p>No projects yet. Create your first project above.</p>
        )}

        {!loading && !error && projects.length > 0 && (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <h3>{project.name}</h3>
                {project.key && <p>Key: {project.key}</p>}
                {project.description && <p>{project.description}</p>}

                <button
                  type="button"
                  onClick={() =>
                    navigate(`/projects/${project.id}`)
                  }
                >
                  Open board
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
