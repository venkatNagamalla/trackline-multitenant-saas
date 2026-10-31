import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";

const ProtectedRoute = () => {
  const { accessToken, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <LoadingSpinner
        message="Restoring your session..."
        fullScreen
      />
    );
  }

  if (!accessToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;