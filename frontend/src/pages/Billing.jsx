import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../api";

function Billing() {
  const { currentWorkspace } = useAuth();

  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!currentWorkspace) {
      setBilling(null);
      setLoading(false);
      return;
    }

    try {
      setError("");
      const data = await apiRequest("/billing/status/");
      setBilling(data);
    } catch (err) {
      setError(err.message || "Could not load billing information.");
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    setLoading(true);
    loadBilling();
  }, [loadBilling]);

  async function handleUpgrade() {
    try {
      setError("");
      setActionLoading(true);

      const data = await apiRequest("/billing/checkout/", {
        method: "POST",
      });

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError("Checkout URL was not returned.");
      }
    } catch (err) {
      setError(err.message || "Could not start checkout.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleManageSubscription() {
    try {
      setError("");
      setActionLoading(true);

      const data = await apiRequest("/billing/portal/", {
        method: "POST",
      });

      if (data?.portal_url) {
        window.location.href = data.portal_url;
      } else {
        setError("Customer portal URL was not returned.");
      }
    } catch (err) {
      setError(err.message || "Could not open the billing portal.");
    } finally {
      setActionLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#f6f7fb] px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-500">
            Loading billing information...
          </p>
        </div>
      </div>
    );
  }

  // Workspace selection state
  if (!currentWorkspace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#f6f7fb] px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">
            ◈
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Select a workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Please select a workspace before viewing your billing information.
          </p>
        </div>
      </div>
    );
  }

  // Billing unavailable state
  if (!billing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#f6f7fb] px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-500">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Billing unavailable
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {error || "Billing information is currently unavailable."}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadBilling();
            }}
            className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isPro = billing.plan === "pro";

  const resources = [
    {
      key: "projects",
      title: "Projects",
      description: "Projects in your workspace",
      icon: "▦",
    },
    {
      key: "members",
      title: "Members",
      description: "People in your workspace",
      icon: "♙",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-8 font-sans sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            Workspace management
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Billing & Subscription
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage your subscription, monitor workspace usage, and keep track
            of your plan.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span className="font-bold">!</span>
            <p>{error}</p>
          </div>
        )}

        {/* Current Plan */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Your current plan
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Subscription details for your selected workspace.
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                  isPro
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isPro ? "bg-indigo-500" : "bg-slate-400"
                  }`}
                />
                {isPro ? "PRO PLAN" : "FREE PLAN"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-extrabold capitalize tracking-tight text-slate-900">
                  {billing.plan}
                </h3>
                {isPro && (
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600">
                    Premium
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-slate-500">
                {isPro ? (
                  <>
                    <span className="text-xl font-bold text-slate-900">
                      ₹499
                    </span>{" "}
                    / month
                  </>
                ) : (
                  "Free plan — get started at no cost."
                )}
              </p>
            </div>

            {isPro ? (
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? "Please wait..." : "Manage subscription"}
                {!actionLoading && <span aria-hidden="true">↗</span>}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? "Redirecting..." : "Upgrade to Pro"}
                {!actionLoading && <span aria-hidden="true">→</span>}
              </button>
            )}
          </div>
        </section>

        {/* Usage Overview */}
        <section className="mt-8">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">
              Workspace usage
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Monitor how much of your plan's available resources you're using.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {resources.map((resource) => {
              const usage = billing.usage[resource.key];
              const limit = billing.limits[resource.key];
              const remaining = billing.remaining[resource.key];

              const percentage =
                limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;

              const isNearLimit = percentage >= 80;

              return (
                <div
                  key={resource.key}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {resource.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {resource.description}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-xl font-bold text-indigo-600">
                      {resource.icon}
                    </div>
                  </div>

                  <div className="mt-7 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                        {usage}
                        <span className="ml-1 text-lg font-semibold text-slate-400">
                          / {limit}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {remaining} remaining
                      </p>
                    </div>

                    <span
                      className={`text-xs font-bold ${
                        isNearLimit ? "text-amber-600" : "text-indigo-600"
                      }`}
                    >
                      {Math.round(percentage)}% used
                    </span>
                  </div>

                  <div
                    className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`${resource.title} usage`}
                    aria-valuenow={Math.round(percentage)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isNearLimit ? "bg-amber-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Upgrade Information */}
        {!isPro && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                  UNLOCK MORE
                </span>

                <h2 className="mt-3 text-xl font-extrabold text-slate-900">
                  Ready to do more with Trackline?
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Upgrade to Pro to get access to the resources and workspace
                  capacity available with your subscription.
                </p>
              </div>

              <button
                type="button"
                onClick={handleUpgrade}
                disabled={actionLoading}
                className="shrink-0 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? "Redirecting..." : "Explore Pro"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default Billing;