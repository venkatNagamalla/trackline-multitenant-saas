
import { Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <header className="app-header">
        <Link to="/dashboard" className="app-brand">
          Trackline
        </Link>

        <nav className="flex items-center gap-4">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? "font-bold text-blue-600" : "text-gray-700"
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/billing"
            className={({ isActive }) =>
              isActive ? "font-bold text-blue-600" : "text-gray-700"
            }
          >
            Billing
          </NavLink>
        </nav>

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
