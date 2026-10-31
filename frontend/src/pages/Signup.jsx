import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    workspace_name: "",
    username: "",
    email: "",
    password: "",
    password2: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.password !== form.password2) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await signup({
        workspace_name: form.workspace_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      navigate("/login", { replace: true });
    } catch (err) {
      const details = err.data;

      const message =
        typeof details === "object" && details !== null
          ? Object.entries(details)
              .map(
                ([field, messages]) =>
                  `${field}: ${
                    Array.isArray(messages) ? messages.join(", ") : messages
                  }`
              )
              .join(" | ")
          : err.message;

      setError(message || "Signup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

  const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 py-10 font-sans">
      <div className="w-full max-w-lg">
        {/* Brand and heading */}
        <div className="mb-8 text-center">
          <Link to="/login" className="inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-extrabold text-white shadow-lg shadow-indigo-200">
              T
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Trackline
            </span>
          </Link>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Set up your workspace and start managing projects with your team.
          </p>
        </div>

        {/* Signup Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-slate-900">
              Get started with Trackline
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Fill in your details to create your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div
                role="alert"
                className="break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
              >
                {error}
              </div>
            )}

            {/* Workspace Name */}
            <div>
              <label htmlFor="workspace_name" className={labelClass}>
                Workspace name
              </label>
              <input
                id="workspace_name"
                name="workspace_name"
                value={form.workspace_name}
                onChange={handleChange}
                placeholder="e.g. My Team"
                autoComplete="organization"
                required
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Choose a name for your team's workspace.
              </p>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className={labelClass}>
                Username
              </label>
              <input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Enter your username"
                autoComplete="username"
                required
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={labelClass}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a password"
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="password2" className={labelClass}>
                Confirm password
              </label>
              <input
                id="password2"
                name="password2"
                type="password"
                value={form.password2}
                onChange={handleChange}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-7 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-bold text-indigo-600 transition hover:text-indigo-700"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-7 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Trackline. All rights reserved.
        </p>
      </div>
    </main>
  );
}