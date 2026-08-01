import { auth } from "@/auth";

export type SessionUser = { id: string; name: string; role: "EMPLOYEE" | "MANAGER"; designation: string | null };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const s = await auth();
  if (!s?.user?.id) return null;
  return {
    id: s.user.id as string,
    name: s.user.name ?? "",
    role: (s.user as any).role,
    designation: (s.user as any).designation ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function requireManager(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "MANAGER") throw new Error("FORBIDDEN");
  return u;
}
