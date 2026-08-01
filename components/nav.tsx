import Link from "next/link";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  return (
    <nav className="flex items-center justify-between border-b px-4 py-2.5">
      <div className="flex items-center gap-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm font-medium hover:underline">
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">{u.name}</span>
        <Badge variant="secondary">{u.role}</Badge>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}
