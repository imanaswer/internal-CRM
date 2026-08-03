import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/nav-links";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/signin" });
}

export async function Nav() {
  const u = await getCurrentUser();
  if (!u) return null;

  const links =
    u.role === "MANAGER"
      ? [{ href: "/manager", label: "Manager" }]
      : [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/activities", label: "My Activities" },
        ];
  if (u.tech) links.push({ href: "/tickets", label: "Tickets" });

  const initials = u.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              G
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              Activity Reporting
            </span>
          </Link>
          <NavLinks links={links} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground"
              aria-hidden
            >
              {initials || "?"}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{u.role.toLowerCase()}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </nav>
    </header>
  );
}
