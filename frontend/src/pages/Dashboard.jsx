import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../api";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const { user, currentWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      if (!currentWorkspace) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await apiRequest("/projects/");
        if (active) {
          setProjects(Array.isArray(data) ? data : data?.results ?? []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load projects.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProjects();

    return () => {
      active = false;
    };
  }, [currentWorkspace]);

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome, {user?.username || user?.email || "User"}!</p>
        </div>

        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <h2>Projects</h2>

      {loading && <p>Loading projects...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <p>No projects yet. Your projects will appear here.</p>
      )}

      {!loading && !error && projects.length > 0 && (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <strong>{project.name}</strong>
              {project.description && <p>{project.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}