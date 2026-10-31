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
              .map(([field, messages]) =>
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

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create your Trackline account</h1>
        <p>Get started with your workspace.</p>

        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}

        <label htmlFor="workspace_name">Workspace Name</label>
        <input
          id="workspace_name"
          name="workspace_name"
          value={form.workspace_name}
          onChange={handleChange}
          placeholder="e.g. My Team"
          autoComplete="organization"
          required
        />

        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          value={form.username}
          onChange={handleChange}
          autoComplete="username"
          required
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          autoComplete="new-password"
          required
        />

        <label htmlFor="password2">Confirm password</label>
        <input
          id="password2"
          name="password2"
          type="password"
          value={form.password2}
          onChange={handleChange}
          autoComplete="new-password"
          required
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Sign Up"}
        </button>

        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}