import { Link } from "react-router-dom";

function BillingCancel() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 py-10 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60 sm:p-10">
        {/* Cancel Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
          <svg
            className="h-10 w-10 text-amber-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </div>

        {/* Heading */}
        <div className="mt-6">
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
            Checkout cancelled
          </span>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            Payment Cancelled
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your checkout was cancelled. No subscription upgrade was
            completed. Your current plan remains unchanged.
          </p>
        </div>

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

export default BillingCancel;