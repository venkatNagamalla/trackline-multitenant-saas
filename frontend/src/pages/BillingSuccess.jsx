import { Link, useSearchParams } from "react-router-dom";

function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 py-10 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-10">
        {/* Success Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
          <svg
            className="h-10 w-10 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        {/* Heading */}
        <div className="mt-6">
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Payment confirmed
          </span>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            Payment Successful!
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your Stripe payment was completed successfully. Thank you for
            upgrading your Trackline workspace!
          </p>
        </div>

        {/* Session Details */}
        {sessionId && (
          <div className="mt-7 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Transaction session ID
            </p>
            <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-600">
              {sessionId}
            </p>
          </div>
        )}

        {/* Dashboard Link */}
        <Link
          to="/dashboard"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300"
        >
          Go to Dashboard
          <span aria-hidden="true">→</span>
        </Link>

        <p className="mt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} Trackline. All rights reserved.
        </p>
      </div>
    </main>
  );
}

export default BillingSuccess;