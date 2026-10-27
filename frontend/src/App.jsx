
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";
import Sprints from "./pages/Sprints";
import AuditLogs from "./pages/AuditLogs";
import ProtectedRoute from "./auth/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/projects/:projectId"
          element={<Board />}
        />
        <Route
          path="/projects/:projectId/sprints"
          element={<Sprints />}
        />
        <Route path="/audit-logs" element={<AuditLogs />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;
