const ALLOWED = (process.env.ALLOWED_DOMAIN ?? "gteceducation.com").toLowerCase();

export function isAllowedGoogleProfile(p: {
  email?: string | null;
  email_verified?: boolean;
  hd?: string;
}): boolean {
  if (!p.email || p.email_verified !== true) return false;
  const domain = p.email.split("@")[1]?.toLowerCase();
  if (domain !== ALLOWED) return false;
  // If Google supplies hd (Workspace), it must match too.
  if (p.hd && p.hd.toLowerCase() !== ALLOWED) return false;
  return true;
}

export function resolveRole(email: string, managerEmails: string): "MANAGER" | "EMPLOYEE" {
  const set = new Set(
    managerEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  return set.has(email.trim().toLowerCase()) ? "MANAGER" : "EMPLOYEE";
}

export function resolveTech(email: string, techEmails: string): boolean {
  const set = new Set(
    techEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
