
import { Link } from "react-router-dom";

function BillingCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Payment Cancelled
        </h1>

        <p className="text-gray-600 mb-6">
          Your checkout was cancelled. No subscription upgrade was completed.
        </p>

        <Link
          to="/dashboard"
          className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default BillingCancel;
