
import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <header className="app-header">
        <Link to="/dashboard" className="app-brand">
          Trackline
        </Link>

        <WorkspaceSwitcher />

        <div className="header-user">
          <span>{user?.username || user?.email || "User"}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
