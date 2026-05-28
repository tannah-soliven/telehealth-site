import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function logout() {
    clearAuth();
    navigate("/login");
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  const navContent = (
    <>
      <div className="border-b p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Telehealth</p>
        <h1 className="mt-1 text-lg font-semibold">{title}</h1>
        {user ? <p className="mt-2 truncate text-sm text-muted-foreground">{user.email}</p> : null}
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={closeMobileNav}
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
          onClick={closeMobileNav}
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
    </>
  );

  return (
    <div className="min-h-dvh bg-background">
      <div className="flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">{navContent}</aside>

        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
            mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={closeMobileNav}
          aria-hidden="true"
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-card transition-transform md:hidden",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-hidden={!mobileNavOpen}
        >
          <div className="flex items-center justify-end border-b px-4 py-3">
            <Button variant="ghost" size="icon" onClick={closeMobileNav} aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          </div>
          {navContent}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-8">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
              <p className="text-sm text-muted-foreground md:hidden">{title}</p>
              <h2 className="text-lg font-semibold md:hidden">Dashboard</h2>
              </div>
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
