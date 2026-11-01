
import { useState } from "react";
import {
  Outlet,
  Link,
  NavLink,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../context/useAuth";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

export default function AppLayout() {
  const { user, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const location = useLocation();

  // Detect the currently opened project
  const projectMatch = location.pathname.match(
    /^\/projects\/(\d+)(?:\/|$)/
  );

  const projectId = projectMatch?.[1];

  // Dynamic sidebar navigation
  const navigation = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "▦",
      end: true,
    },

    ...(projectId
      ? [
          {
            name: "Board",
            path: `/projects/${projectId}`,
            icon: "▤",
            end: true,
          },
          {
            name: "Sprints",
            path: `/projects/${projectId}/sprints`,
            icon: "◷",
            end: true,
          },
        ]
      : []),

    {
      name: "Audit Logs",
      path: "/audit-logs",
      icon: "◷",
    },
    {
      name: "Settings",
      path: "/settings",
      icon: "⚙",
    },
    {
      name: "Billing",
      path: "/billing",
      icon: "◇",
    },
  ];

  const username = user?.username || user?.email || "User";
  const initials = username.slice(0, 2).toUpperCase();

  const closeSidebar = () => setSidebarOpen(false);

  // Logout confirmation
  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await logout();
      setShowLogoutModal(false);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6ff] text-slate-900">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="main-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col
          border-r border-[#202943]
          bg-[#0c1224] text-white
          shadow-xl shadow-slate-950/20
          transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >

        {/* Brand */}
        <header className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5">

          <Link
            to="/dashboard"
            onClick={closeSidebar}
            className="flex items-center gap-3"
          >
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
  <img
    src="/trackline-logo.svg"
    alt="Trackline Logo"
    className="h-full w-full object-contain"
  />
</span>

            <span>
              <span className="block text-lg font-bold tracking-tight text-white">
                Trackline
              </span>

              <span className="block text-[10px] font-medium tracking-[0.14em] text-slate-500">
                PROJECT WORKSPACE
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            ✕
          </button>
        </header>

        {/* Workspace */}
        <section className="border-b border-white/[0.07] px-4 py-5">

          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Current workspace
          </p>

          <WorkspaceSwitcher />
        </section>

        {/* Navigation */}
        <nav
          aria-label="Main navigation"
          className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-6"
        >

          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Workspace
          </p>

          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end ?? false}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg border px-3 py-3 text-[13px] font-semibold transition-all duration-200 ${
                  isActive
                    ? "border-violet-500/20 bg-[#251b46] text-violet-100"
                    : "border-transparent text-slate-400 hover:bg-[#171f34] hover:text-slate-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-violet-500" />
                  )}

                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-base ${
                      isActive
                        ? "bg-violet-500/15 text-violet-300"
                        : "text-slate-500 group-hover:bg-white/[0.05] group-hover:text-slate-300"
                    }`}
                  >
                    {item.icon}
                  </span>

                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User profile */}
        <footer className="border-t border-white/[0.07] p-4">

          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#141c30] p-3 transition-colors hover:bg-[#1a243b]">

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {initials}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-100">
                {username}
              </p>

              <p className="text-[10px] text-slate-500">
                Trackline member
              </p>
            </div>

            <span className="text-slate-500" aria-hidden="true">
              ›
            </span>
          </div>
        </footer>
      </aside>

      {/* Main application */}
      <div className="min-h-screen lg:pl-64">

        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e5e7f0] bg-white/95 px-4 shadow-sm sm:px-6 lg:px-8">

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
              aria-controls="main-sidebar"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 lg:hidden"
            >
              ☰
            </button>

            <div>
              <p className="text-sm font-bold text-slate-800">
                Welcome back
              </p>

              <p className="hidden text-xs text-slate-500 sm:block">
                Manage your projects and workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">

            <span className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              System operational
            </span>

            <div className="hidden h-8 w-px bg-slate-200 sm:block" />

            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-xs font-bold text-violet-700">
              {initials}
            </span>

            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              title="Logout"
              aria-label="Logout"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <span aria-hidden="true">⇥</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-72px)] bg-[#f5f6ff] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
          onClick={() => {
            if (!loggingOut) setShowLogoutModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            onClick={(event) => event.stopPropagation()}
          >

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600">
              ⇥
            </div>

            <h2
              id="logout-title"
              className="text-center text-xl font-bold text-slate-900"
            >
              Are you sure you want to logout?
            </h2>

            <p
              id="logout-description"
              className="mt-2 text-center text-sm leading-6 text-slate-500"
            >
              You will need to sign in again to access your workspace.
            </p>

            <div className="mt-7 flex gap-3">

              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                No, Stay
              </button>

              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogout}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : "Yes, Logout"}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
