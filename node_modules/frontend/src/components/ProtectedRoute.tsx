import { Navigate, Outlet } from "react-router-dom";

import { getToken, getUser, type UserRole } from "@/lib/auth";

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
};

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard"} replace />;
  }

  return <Outlet />;
}
