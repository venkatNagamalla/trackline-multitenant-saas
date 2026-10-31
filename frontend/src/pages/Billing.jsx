
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { apiRequest } from "../api";

function Billing() {
  const { currentWorkspace } = useAuth();

  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    }
  }

  async function handleManageSubscription() {
    try {
      setError("");
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
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading billing information...</div>;
  }

  if (!currentWorkspace) {
    return <div className="p-8 text-center">Please select a workspace first.</div>;
  }

  if (!billing) {
    return <div className="p-8 text-center text-red-600">{error || "Billing information unavailable."}</div>;
  }

  const isPro = billing.plan === "pro";

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Billing</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Plan</p>
              <h2 className="text-2xl font-bold capitalize text-gray-800">
                {billing.plan}
              </h2>
              <p className="mt-1 text-gray-600">
                {isPro ? "₹499 per month" : "Free plan"}
              </p>
            </div>

            {isPro ? (
              <button
                onClick={handleManageSubscription}
                className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
              >
                Manage Subscription
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                className="rounded-lg bg-green-600 px-5 py-2 text-white hover:bg-green-700"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {["projects", "members"].map((resource) => (
            <div key={resource} className="rounded-xl bg-white p-6 shadow-md">
              <h3 className="text-lg font-semibold capitalize text-gray-800">
                {resource}
              </h3>

              <p className="mt-3 text-3xl font-bold text-blue-600">
                {billing.usage[resource]} / {billing.limits[resource]}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {billing.remaining[resource]} remaining
              </p>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${Math.min(
                      100,
                      (billing.usage[resource] /
                        billing.limits[resource]) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Billing;
