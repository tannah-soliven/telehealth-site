const TOKEN_KEY = "telehealth_token";
const USER_KEY = "telehealth_user";

export type UserRole = "patient" | "doctor" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function dashboardPathForRole(role: UserRole): string {
  if (role === "doctor") return "/doctor/dashboard";
  return "/patient/dashboard";
}

export function profilePathForRole(role: UserRole): string {
  if (role === "doctor") return "/doctor/profile";
  return "/patient/profile";
}
