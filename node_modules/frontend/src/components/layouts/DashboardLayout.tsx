import { LogOut } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { clearAuth, getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  to: string;
};

type DashboardLayoutProps = {
  title: string;
  navItems: NavItem[];
  profilePath: string;
};

export function DashboardLayout({ title, navItems, profilePath }: DashboardLayoutProps) {
  const user = getUser();
  const navigate = useNavigate();

  function logout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
          <div className="border-b p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Telehealth</p>
            <h1 className="mt-1 text-lg font-semibold">{title}</h1>
            {user ? (
              <p className="mt-2 truncate text-sm text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                    isActive && "bg-accent text-accent-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to={profilePath}
              className={({ isActive }) =>
                cn(
                  "mt-auto rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                  isActive && "bg-accent text-accent-foreground"
                )
              }
            >
              Edit Profile
            </NavLink>
          </nav>
          <div className="border-t p-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-8">
            <div>
              <p className="text-sm text-muted-foreground md:hidden">{title}</p>
              <h2 className="text-lg font-semibold md:hidden">Dashboard</h2>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Link to={profilePath} className="text-sm text-primary hover:underline md:hidden">
                Profile
              </Link>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
