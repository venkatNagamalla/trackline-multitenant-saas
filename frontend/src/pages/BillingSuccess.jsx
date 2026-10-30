
import { Link, useSearchParams } from "react-router-dom";

function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          Payment Successful!
        </h1>

        <p className="text-gray-600 mb-4">
          Your Stripe payment was completed successfully.
        </p>

        {sessionId && (
          <p className="text-xs text-gray-500 mb-6 break-all">
            Session ID: {sessionId}
          </p>
        )}

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

export default BillingSuccess;
