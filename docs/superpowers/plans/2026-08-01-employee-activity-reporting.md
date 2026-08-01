# Employee Activity Reporting System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lightweight internal Next.js app where employees log daily activities and managers filter, export to Excel, and lock reporting periods.

**Architecture:** Single Next.js (App Router) application. Server Actions for writes, a Route Handler for Excel streaming, Prisma over PostgreSQL, Auth.js (NextAuth v5) for Google-only sign-in with server-side domain enforcement plus a dev-only temp login. All date logic and the manager list/export query are centralized in `lib/` so they can be unit-tested and can never drift.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, Auth.js v5, exceljs, zod, vitest.

## Global Constraints

- **Business timezone:** `Asia/Kolkata`. All "today" logic derives from it.
- **Date fields are date-only:** `Activity.date`, `Activity.deadline`, `PeriodLock.startDate/endDate` use Prisma `@db.Date` (stored UTC-midnight). Compare as `YYYY-MM-DD` strings, never as instants.
- **Domain lock:** only `email_verified === true` Google accounts on `gteceducation.com` may sign in. The `hd` param is a UI hint; enforcement is server-side.
- **Temp login:** enabled only when `ALLOW_TEMP_LOGIN === "true"` AND `NODE_ENV !== "production"`. Defaults off. No credentials committed. Temp user role from `TEMP_LOGIN_ROLE` (default `MANAGER`).
- **Manager role:** emails in `MANAGER_EMAILS` (comma-separated env) → `MANAGER`; else `EMPLOYEE`. Set at sign-in.
- **Employee writes** (create/edit/delete) allowed for own records on any past date; future dates rejected; blocked if the date is in a locked period. Managers bypass the lock.
- **Excel export always reflects the currently applied filters/search** — same query builder as the list view.
- **Every server action re-checks auth + role server-side.** Never trust the client.
- Keep it lightweight — no project-management features beyond this plan.

**Status enum values:** `PENDING`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`.

---

## File Structure

**Core logic (unit-tested, pure where possible):**
- `lib/dates.ts` — Asia/Kolkata "today", date-only conversions, future check.
- `lib/validation.ts` — zod `activitySchema`, `lockSchema`, inferred types.
- `lib/period-lock.ts` — `isLocked(dateISO, locks)` range containment.
- `lib/auth-domain.ts` — `isAllowedGoogleProfile`, `resolveRole`.
- `lib/activity-query.ts` — `buildActivityWhere(filters)` shared by list + export.

**Infrastructure:**
- `prisma/schema.prisma` — models + enums.
- `lib/db.ts` — Prisma client singleton.
- `auth.ts` — Auth.js config (providers, callbacks).
- `lib/session.ts` — `getCurrentUser()`, `requireUser()`, `requireManager()`.
- `middleware.ts` — route protection.

**Server actions & routes:**
- `app/activities/actions.ts` — `createActivity`, `updateActivity`, `deleteActivity`.
- `app/manager/locks/actions.ts` — `lockPeriod`, `lockMonth`, `removeLock`.
- `app/api/export/route.ts` — Excel stream (manager only).

**UI:**
- `app/(auth)/signin/page.tsx` — Google button + temp-login form (when enabled).
- `app/layout.tsx`, `components/nav.tsx` — role-based shell.
- `app/dashboard/page.tsx` — employee dashboard.
- `app/activities/page.tsx` + `components/activity-form.tsx` + `components/activity-history.tsx`.
- `app/manager/page.tsx` — stats + table + filters + delete + export + lock panel.
- `components/activity-filters.tsx`, `components/lock-panel.tsx`.

---

## Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `.env.example`, `.env`
- Create: `components.json` (shadcn)

**Interfaces:**
- Produces: a booting Next.js dev server; `pnpm test` runs vitest; shadcn CLI usable.

- [ ] **Step 1: Scaffold Next.js**

```bash
cd "/Users/anaswerajay/G-TEC X/Internal CRM"
npx create-next-app@latest . --ts --tailwind --app --src-dir=false --import-alias "@/*" --no-eslint --use-pnpm --yes
```

- [ ] **Step 2: Add deps**

```bash
pnpm add @prisma/client next-auth@beta exceljs zod
pnpm add -D prisma vitest @vitejs/plugin-react
```

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input select table card dialog calendar popover badge label textarea sonner
```

- [ ] **Step 4: Configure vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["lib/**/*.test.ts"] } });
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 5: Create `.env.example`**

# Supabase → Project Settings → Database → Connection string.
# DATABASE_URL = "Transaction" pooler (port 6543) for the app; DIRECT_URL = "Direct" (port 5432) for migrations.
```
DATABASE_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
AUTH_SECRET="generate-with-npx-auth-secret"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
ALLOWED_DOMAIN="gteceducation.com"
MANAGER_EMAILS=""
ALLOW_TEMP_LOGIN="true"
TEMP_LOGIN_USER="tester"
TEMP_LOGIN_PASSWORD="changeme"
TEMP_LOGIN_ROLE="MANAGER"
```

Copy to `.env`, fill `DATABASE_URL`/`DIRECT_URL` from Supabase, and run `npx auth secret` to populate `AUTH_SECRET`. (Supabase's own automatic daily backups also satisfy the backup NFR — no extra ops work.)

- [ ] **Step 6: Verify dev server boots**

Run: `pnpm dev` → open `http://localhost:3000`. Expected: default page renders. Stop server.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with Tailwind, shadcn, Prisma, vitest"
```

---

## Task 2: Prisma schema, client, migration

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`

**Interfaces:**
- Produces: `prisma` client with `User`, `Activity`, `PeriodLock`; enums `Role`, `Status`. `import { prisma } from "@/lib/db"`.

- [ ] **Step 1: Write schema**

`prisma/schema.prisma`:

```prisma
generator client { provider = "prisma-client-js" }
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (pgBouncer) — app runtime
  directUrl = env("DIRECT_URL")     // direct — migrations
}

enum Role   { EMPLOYEE MANAGER }
enum Status { PENDING IN_PROGRESS COMPLETED ON_HOLD }

model User {
  id          String     @id @default(cuid())
  email       String     @unique
  name        String
  designation String?
  role        Role       @default(EMPLOYEE)
  createdAt   DateTime   @default(now())
  activities  Activity[]
  locks       PeriodLock[]
}

model Activity {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  employeeName String
  designation  String
  date         DateTime @db.Date
  activity     String
  description  String?
  assignedBy   String
  status       Status
  deadline     DateTime? @db.Date
  timeTaken    Decimal  @db.Decimal(5, 2)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId])
  @@index([date])
}

model PeriodLock {
  id         String   @id @default(cuid())
  startDate  DateTime @db.Date
  endDate    DateTime @db.Date
  label      String?
  reason     String?
  lockedById String
  lockedBy   User     @relation(fields: [lockedById], references: [id])
  lockedAt   DateTime @default(now())

  @@index([startDate, endDate])
}
```

- [ ] **Step 2: Prisma client singleton**

`lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

- [ ] **Step 3: Add timeTaken CHECK constraint via migration**

Create migration, then edit its SQL to add the constraint:

```bash
npx prisma migrate dev --name init --create-only
```

Append to the generated migration `.sql`:

```sql
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_timeTaken_positive" CHECK ("timeTaken" > 0);
```

- [ ] **Step 4: Apply migration**

Run: `npx prisma migrate dev`
Expected: migration applies; `Activity`, `User`, `PeriodLock` tables created.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Prisma schema for User, Activity, PeriodLock + timeTaken check"
```

---

## Task 3: Date helper (`lib/dates.ts`)

**Files:**
- Create: `lib/dates.ts`, `lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `todayISO(): string` — current date in `Asia/Kolkata` as `"YYYY-MM-DD"`.
  - `dateToISO(d: Date): string` — the `YYYY-MM-DD` of a `@db.Date` value (UTC parts).
  - `isFutureISO(iso: string): boolean` — `iso > todayISO()`.
  - `parseISODate(iso: string): Date` — `new Date(iso + "T00:00:00.000Z")` for `@db.Date` writes.

- [ ] **Step 1: Write failing tests**

`lib/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dateToISO, isFutureISO, parseISODate, todayISO } from "./dates";

describe("dates", () => {
  it("todayISO returns YYYY-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("dateToISO reads UTC date parts of a db.Date", () => {
    expect(dateToISO(new Date("2026-08-01T00:00:00.000Z"))).toBe("2026-08-01");
  });
  it("parseISODate round-trips with dateToISO", () => {
    expect(dateToISO(parseISODate("2026-10-15"))).toBe("2026-10-15");
  });
  it("isFutureISO is true for tomorrow, false for today", () => {
    const [y, m, d] = todayISO().split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    expect(isFutureISO(tomorrow)).toBe(true);
    expect(isFutureISO(todayISO())).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test lib/dates.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/dates.ts`:

```ts
// en-CA formats as YYYY-MM-DD; timeZone gives the Asia/Kolkata calendar date.
const IST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

export function todayISO(): string {
  return IST.format(new Date());
}

// @db.Date values arrive as UTC-midnight Dates; take the UTC date portion.
export function dateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isFutureISO(iso: string): boolean {
  return iso > todayISO();
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm test lib/dates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/dates.test.ts && git commit -m "feat: Asia/Kolkata date helpers with tests"
```

---

## Task 4: Period-lock containment (`lib/period-lock.ts`)

**Files:**
- Create: `lib/period-lock.ts`, `lib/period-lock.test.ts`

**Interfaces:**
- Consumes: `dateToISO` from `lib/dates`.
- Produces: `isLocked(dateISO: string, locks: LockRange[]): boolean` where `type LockRange = { startDate: Date; endDate: Date }`.

- [ ] **Step 1: Write failing tests**

`lib/period-lock.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isLocked } from "./period-lock";

const lock = (s: string, e: string) => ({
  startDate: new Date(`${s}T00:00:00.000Z`),
  endDate: new Date(`${e}T00:00:00.000Z`),
});

describe("isLocked", () => {
  const locks = [lock("2026-10-01", "2026-10-31")];
  it("date inside range is locked", () => expect(isLocked("2026-10-15", locks)).toBe(true));
  it("boundaries inclusive", () => {
    expect(isLocked("2026-10-01", locks)).toBe(true);
    expect(isLocked("2026-10-31", locks)).toBe(true);
  });
  it("date outside range not locked", () => expect(isLocked("2026-09-30", locks)).toBe(false));
  it("no locks means not locked", () => expect(isLocked("2026-10-15", [])).toBe(false));
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test lib/period-lock.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`lib/period-lock.ts`:

```ts
import { dateToISO } from "./dates";

export type LockRange = { startDate: Date; endDate: Date };

export function isLocked(dateISO: string, locks: LockRange[]): boolean {
  return locks.some(
    (l) => dateToISO(l.startDate) <= dateISO && dateISO <= dateToISO(l.endDate)
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm test lib/period-lock.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/period-lock.* && git commit -m "feat: period-lock date containment with tests"
```

---

## Task 5: Validation schemas (`lib/validation.ts`)

**Files:**
- Create: `lib/validation.ts`, `lib/validation.test.ts`

**Interfaces:**
- Consumes: `isFutureISO` from `lib/dates`.
- Produces:
  - `activitySchema` (zod) → `type ActivityInput = z.infer<typeof activitySchema>` with fields `{ date: string; activity: string; description?: string; assignedBy: string; status: Status; deadline?: string; timeTaken: number }`.
  - `lockSchema` → `{ startDate: string; endDate: string; label?: string; reason?: string }` with `endDate >= startDate`.

- [ ] **Step 1: Write failing tests**

`lib/validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activitySchema, lockSchema } from "./validation";

const base = {
  date: "2026-07-01", activity: "Fixed bug", assignedBy: "Lead",
  status: "COMPLETED", timeTaken: 2,
};

describe("activitySchema", () => {
  it("accepts a valid past-dated activity", () => {
    expect(activitySchema.safeParse(base).success).toBe(true);
  });
  it("rejects empty activity", () => {
    expect(activitySchema.safeParse({ ...base, activity: "" }).success).toBe(false);
  });
  it("rejects timeTaken <= 0", () => {
    expect(activitySchema.safeParse({ ...base, timeTaken: 0 }).success).toBe(false);
  });
  it("rejects future date", () => {
    expect(activitySchema.safeParse({ ...base, date: "2999-01-01" }).success).toBe(false);
  });
  it("rejects deadline earlier than date", () => {
    expect(activitySchema.safeParse({ ...base, deadline: "2026-06-01" }).success).toBe(false);
  });
  it("accepts deadline equal to date", () => {
    expect(activitySchema.safeParse({ ...base, deadline: "2026-07-01" }).success).toBe(true);
  });
});

describe("lockSchema", () => {
  it("rejects endDate before startDate", () => {
    expect(lockSchema.safeParse({ startDate: "2026-10-31", endDate: "2026-10-01" }).success).toBe(false);
  });
  it("accepts a valid range", () => {
    expect(lockSchema.safeParse({ startDate: "2026-10-01", endDate: "2026-10-31" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test lib/validation.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`lib/validation.ts`:

```ts
import { z } from "zod";
import { isFutureISO } from "./dates";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const activitySchema = z
  .object({
    date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
    activity: z.string().trim().min(1, "Activity is required"),
    description: z.string().trim().optional(),
    assignedBy: z.string().trim().min(1, "Assigned By is required"),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]),
    deadline: iso.optional(),
    timeTaken: z.coerce.number().positive("Time Taken must be greater than zero"),
  })
  .refine((v) => !v.deadline || v.deadline >= v.date, {
    message: "Deadline cannot be earlier than the activity date",
    path: ["deadline"],
  });

export type ActivityInput = z.infer<typeof activitySchema>;

export const lockSchema = z
  .object({
    startDate: iso,
    endDate: iso,
    label: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before start date",
    path: ["endDate"],
  });

export type LockInput = z.infer<typeof lockSchema>;
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm test lib/validation.test.ts` → PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/validation.* && git commit -m "feat: activity + lock zod schemas with cross-field rules"
```

---

## Task 6: Auth domain/role logic (`lib/auth-domain.ts`)

**Files:**
- Create: `lib/auth-domain.ts`, `lib/auth-domain.test.ts`

**Interfaces:**
- Produces:
  - `isAllowedGoogleProfile(p: { email?: string | null; email_verified?: boolean; hd?: string }): boolean`
  - `resolveRole(email: string, managerEmails: string): "MANAGER" | "EMPLOYEE"`

- [ ] **Step 1: Write failing tests**

`lib/auth-domain.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAllowedGoogleProfile, resolveRole } from "./auth-domain";

describe("isAllowedGoogleProfile", () => {
  const ok = { email: "a@gteceducation.com", email_verified: true, hd: "gteceducation.com" };
  it("accepts verified in-domain", () => expect(isAllowedGoogleProfile(ok)).toBe(true));
  it("rejects other domain", () =>
    expect(isAllowedGoogleProfile({ ...ok, email: "a@gmail.com", hd: undefined })).toBe(false));
  it("rejects unverified", () =>
    expect(isAllowedGoogleProfile({ ...ok, email_verified: false })).toBe(false));
  it("rejects missing email", () =>
    expect(isAllowedGoogleProfile({ email: null, email_verified: true })).toBe(false));
});

describe("resolveRole", () => {
  it("manager when listed (case-insensitive, trimmed)", () =>
    expect(resolveRole("Boss@gteceducation.com", " boss@gteceducation.com ,x@y.com")).toBe("MANAGER"));
  it("employee otherwise", () =>
    expect(resolveRole("a@gteceducation.com", "boss@gteceducation.com")).toBe("EMPLOYEE"));
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test lib/auth-domain.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`lib/auth-domain.ts`:

```ts
const ALLOWED = process.env.ALLOWED_DOMAIN ?? "gteceducation.com";

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
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm test lib/auth-domain.test.ts` → PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth-domain.* && git commit -m "feat: Google domain enforcement + manager role resolution"
```

---

## Task 7: Auth.js config + session helpers

**Files:**
- Create: `auth.ts`, `lib/session.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts`
- Modify: `.env` (already has vars)

**Interfaces:**
- Consumes: `isAllowedGoogleProfile`, `resolveRole`, `prisma`.
- Produces: `auth()`, `signIn`, `signOut` from `auth.ts`; `getCurrentUser()`, `requireUser()`, `requireManager()` from `lib/session.ts`. Session `user` carries `{ id, role, name, designation }`.

- [ ] **Step 1: Write `auth.ts`**

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { isAllowedGoogleProfile, resolveRole } from "@/lib/auth-domain";

const tempEnabled =
  process.env.ALLOW_TEMP_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Google({
      authorization: { params: { hd: process.env.ALLOWED_DOMAIN, prompt: "select_account" } },
    }),
    ...(tempEnabled
      ? [
          Credentials({
            name: "Temp Login",
            credentials: { username: {}, password: {} },
            authorize: (c) => {
              if (
                c?.username === process.env.TEMP_LOGIN_USER &&
                c?.password === process.env.TEMP_LOGIN_PASSWORD
              ) {
                return {
                  id: "temp",
                  email: "temp@local.dev",
                  name: "Temp User",
                  role: process.env.TEMP_LOGIN_ROLE ?? "MANAGER",
                };
              }
              return null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "credentials") return tempEnabled;
      if (account?.provider === "google") {
        if (!isAllowedGoogleProfile(profile as any)) return false;
        const email = profile!.email!;
        const role = resolveRole(email, process.env.MANAGER_EMAILS ?? "");
        await prisma.user.upsert({
          where: { email },
          update: { name: profile!.name ?? email, role },
          create: { email, name: profile!.name ?? email, role },
        });
        (user as any).roleResolved = role;
        return true;
      }
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        if ((user as any).id === "temp") {
          token.uid = "temp";
          token.role = (user as any).role;
          token.designation = null;
        } else if (token.email) {
          const db = await prisma.user.findUnique({ where: { email: token.email } });
          if (db) {
            token.uid = db.id;
            token.role = db.role;
            token.designation = db.designation;
            token.name = db.name;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      (session.user as any).role = token.role;
      (session.user as any).designation = token.designation ?? null;
      return session;
    },
  },
});
```

- [ ] **Step 2: Route handler + middleware**

`app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

`middleware.ts`:

```ts
export { auth as middleware } from "@/auth";
export const config = { matcher: ["/dashboard/:path*", "/activities/:path*", "/manager/:path*", "/api/export"] };
```

- [ ] **Step 3: Session helpers**

`lib/session.ts`:

```ts
import { auth } from "@/auth";

export type SessionUser = { id: string; name: string; role: "EMPLOYEE" | "MANAGER"; designation: string | null };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const s = await auth();
  if (!s?.user?.id) return null;
  return {
    id: s.user.id,
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
```

- [ ] **Step 4: Verify build compiles**

Run: `pnpm build` (or `pnpm dev` and load `/api/auth/providers`).
Expected: with `ALLOW_TEMP_LOGIN=true`, provider list includes `credentials` and `google`. No type errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Auth.js Google + dev temp login, session role helpers, route protection"
```

---

## Task 8: Manager query builder (`lib/activity-query.ts`)

**Files:**
- Create: `lib/activity-query.ts`, `lib/activity-query.test.ts`

**Interfaces:**
- Produces:
  - `type ActivityFilters = { employeeName?: string; designation?: string; status?: Status; assignedBy?: string; dateFrom?: string; dateTo?: string; search?: string }`
  - `buildActivityWhere(f: ActivityFilters): Prisma.ActivityWhereInput`
- Consumed by: Task 9 (export) and Task 12 (list) — one shared function.

- [ ] **Step 1: Write failing tests**

`lib/activity-query.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildActivityWhere } from "./activity-query";

describe("buildActivityWhere", () => {
  it("empty filters produce empty where", () => {
    expect(buildActivityWhere({})).toEqual({});
  });
  it("status maps directly", () => {
    expect(buildActivityWhere({ status: "COMPLETED" as any })).toEqual({ status: "COMPLETED" });
  });
  it("date range builds gte/lte on date", () => {
    const w = buildActivityWhere({ dateFrom: "2026-10-01", dateTo: "2026-10-31" });
    expect(w.date).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lte: new Date("2026-10-31T00:00:00.000Z"),
    });
  });
  it("search ORs across employeeName, activity, assignedBy (insensitive)", () => {
    const w = buildActivityWhere({ search: "bug" });
    expect(w.OR).toEqual([
      { employeeName: { contains: "bug", mode: "insensitive" } },
      { activity: { contains: "bug", mode: "insensitive" } },
      { assignedBy: { contains: "bug", mode: "insensitive" } },
    ]);
  });
  it("combines filters", () => {
    const w = buildActivityWhere({ designation: "Developer", status: "PENDING" as any });
    expect(w).toEqual({ designation: "Developer", status: "PENDING" });
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm test lib/activity-query.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`lib/activity-query.ts`:

```ts
import type { Prisma, Status } from "@prisma/client";
import { parseISODate } from "./dates";

export type ActivityFilters = {
  employeeName?: string;
  designation?: string;
  status?: Status;
  assignedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

export function buildActivityWhere(f: ActivityFilters): Prisma.ActivityWhereInput {
  const where: Prisma.ActivityWhereInput = {};
  if (f.employeeName) where.employeeName = { contains: f.employeeName, mode: "insensitive" };
  if (f.designation) where.designation = f.designation;
  if (f.status) where.status = f.status;
  if (f.assignedBy) where.assignedBy = { contains: f.assignedBy, mode: "insensitive" };
  if (f.dateFrom || f.dateTo) {
    where.date = {};
    if (f.dateFrom) where.date.gte = parseISODate(f.dateFrom);
    if (f.dateTo) where.date.lte = parseISODate(f.dateTo);
  }
  if (f.search) {
    where.OR = [
      { employeeName: { contains: f.search, mode: "insensitive" } },
      { activity: { contains: f.search, mode: "insensitive" } },
      { assignedBy: { contains: f.search, mode: "insensitive" } },
    ];
  }
  return where;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm test lib/activity-query.test.ts` → PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/activity-query.* && git commit -m "feat: shared activity filter/search query builder"
```

---

## Task 9: Activity server actions (create/edit/delete)

**Files:**
- Create: `app/activities/actions.ts`

**Interfaces:**
- Consumes: `requireUser`, `activitySchema`, `isLocked`, `parseISODate`, `prisma`.
- Produces: `createActivity(input)`, `updateActivity(id, input)`, `deleteActivity(id)` — each returns `{ ok: true }` or `{ ok: false, error: string }`. All enforce ownership + lock + validation server-side.

- [ ] **Step 1: Implement actions**

`app/activities/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { activitySchema, type ActivityInput } from "@/lib/validation";
import { isLocked } from "@/lib/period-lock";
import { parseISODate } from "@/lib/dates";

async function assertWritable(user: { id: string; role: string }, dateISO: string) {
  if (user.role === "MANAGER") return; // managers bypass locks
  const locks = await prisma.periodLock.findMany({ select: { startDate: true, endDate: true } });
  if (isLocked(dateISO, locks)) throw new Error("This reporting period is locked.");
}

export async function createActivity(input: ActivityInput) {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    await assertWritable(user, v.date);
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    await prisma.activity.create({
      data: {
        userId: user.id,
        employeeName: user.name,
        designation: dbUser?.designation ?? "",
        date: parseISODate(v.date),
        activity: v.activity,
        description: v.description || null,
        assignedBy: v.assignedBy,
        status: v.status,
        deadline: v.deadline ? parseISODate(v.deadline) : null,
        timeTaken: v.timeTaken,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/activities");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function updateActivity(id: string, input: ActivityInput) {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "Not found" };
  if (user.role !== "MANAGER" && existing.userId !== user.id)
    return { ok: false as const, error: "Forbidden" };
  try {
    await assertWritable(user, existing.date.toISOString().slice(0, 10)); // current period
    await assertWritable(user, v.date); // target period
    await prisma.activity.update({
      where: { id },
      data: {
        date: parseISODate(v.date),
        activity: v.activity,
        description: v.description || null,
        assignedBy: v.assignedBy,
        status: v.status,
        deadline: v.deadline ? parseISODate(v.deadline) : null,
        timeTaken: v.timeTaken,
      },
    });
    revalidatePath("/activities");
    revalidatePath("/manager");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function deleteActivity(id: string) {
  const user = await requireUser();
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "Not found" };
  if (user.role !== "MANAGER" && existing.userId !== user.id)
    return { ok: false as const, error: "Forbidden" };
  try {
    await assertWritable(user, existing.date.toISOString().slice(0, 10));
    await prisma.activity.delete({ where: { id } });
    revalidatePath("/activities");
    revalidatePath("/manager");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build` (or `npx tsc --noEmit`). Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/activities/actions.ts && git commit -m "feat: activity create/update/delete actions with ownership + lock checks"
```

---

## Task 10: Period-lock actions

**Files:**
- Create: `app/manager/locks/actions.ts`

**Interfaces:**
- Consumes: `requireManager`, `lockSchema`, `parseISODate`, `prisma`.
- Produces: `lockPeriod(input: LockInput)`, `lockMonth(yyyyMm: string)`, `removeLock(id: string)`. Manager-only.

- [ ] **Step 1: Implement**

`app/manager/locks/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { lockSchema, type LockInput } from "@/lib/validation";
import { parseISODate } from "@/lib/dates";

export async function lockPeriod(input: LockInput) {
  const mgr = await requireManager();
  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const v = parsed.data;
  await prisma.periodLock.create({
    data: {
      startDate: parseISODate(v.startDate),
      endDate: parseISODate(v.endDate),
      label: v.label || null,
      reason: v.reason || null,
      lockedById: mgr.id,
    },
  });
  revalidatePath("/manager");
  return { ok: true as const };
}

// yyyyMm like "2026-10"
export async function lockMonth(yyyyMm: string, reason?: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const start = `${yyyyMm}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day of month
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
  return lockPeriod({ startDate: start, endDate: end, label, reason });
}

export async function removeLock(id: string) {
  await requireManager();
  await prisma.periodLock.delete({ where: { id } });
  revalidatePath("/manager");
  return { ok: true as const };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/manager/locks/actions.ts && git commit -m "feat: manager lock/unlock period + lock-month helper"
```

---

## Task 11: Excel export route

**Files:**
- Create: `app/api/export/route.ts`

**Interfaces:**
- Consumes: `requireManager`, `buildActivityWhere`, `prisma`, `todayISO`, `dateToISO`, exceljs.
- Produces: `GET /api/export?<filters>` → streams `Daily_Report_YYYY-MM-DD.xlsx` of the currently filtered rows.

- [ ] **Step 1: Implement**

`app/api/export/route.ts`:

```ts
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { buildActivityWhere, type ActivityFilters } from "@/lib/activity-query";
import { dateToISO, todayISO } from "@/lib/dates";

export async function GET(req: Request) {
  await requireManager();
  const p = new URL(req.url).searchParams;
  const filters: ActivityFilters = {
    employeeName: p.get("employeeName") ?? undefined,
    designation: p.get("designation") ?? undefined,
    status: (p.get("status") as any) ?? undefined,
    assignedBy: p.get("assignedBy") ?? undefined,
    dateFrom: p.get("dateFrom") ?? undefined,
    dateTo: p.get("dateTo") ?? undefined,
    search: p.get("search") ?? undefined,
  };
  const rows = await prisma.activity.findMany({
    where: buildActivityWhere(filters),
    orderBy: { date: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Activities");
  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Employee Name", key: "employeeName", width: 20 },
    { header: "Designation", key: "designation", width: 16 },
    { header: "Activity", key: "activity", width: 30 },
    { header: "Description", key: "description", width: 30 },
    { header: "Assigned By", key: "assignedBy", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Deadline", key: "deadline", width: 12 },
    { header: "Time Taken", key: "timeTaken", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      date: dateToISO(r.date),
      employeeName: r.employeeName,
      designation: r.designation,
      activity: r.activity,
      description: r.description ?? "",
      assignedBy: r.assignedBy,
      status: r.status,
      deadline: r.deadline ? dateToISO(r.deadline) : "",
      timeTaken: Number(r.timeTaken),
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Daily_Report_${todayISO()}.xlsx"`,
    },
  });
}
```

- [ ] **Step 2: Verify**

Run: `pnpm dev`, sign in via temp login (Manager), open `http://localhost:3000/api/export`.
Expected: an `.xlsx` downloads with the header row. (Empty data is fine at this stage.)

- [ ] **Step 3: Commit**

```bash
git add app/api/export/route.ts && git commit -m "feat: Excel export streaming filtered rows via shared query"
```

---

## Task 12: Auth UI + app shell

**Files:**
- Create: `app/(auth)/signin/page.tsx`, `components/nav.tsx`
- Modify: `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: `signIn`/`signOut` from `auth.ts`, `getCurrentUser`. Uses shadcn `button`, `input`, `sonner`.
- Produces: sign-in page with a Google button and (when `ALLOW_TEMP_LOGIN=true`) a temp-login form; a top nav showing the user + role-appropriate links; `app/page.tsx` redirects by role.

- [ ] **Step 1: Sign-in page**

`app/(auth)/signin/page.tsx` — server component. Renders a "Sign in with Google" button that posts to a server action calling `signIn("google", { redirectTo: "/" })`. When `process.env.ALLOW_TEMP_LOGIN === "true" && process.env.NODE_ENV !== "production"`, also render a small form (username/password) posting to a server action calling `signIn("credentials", { username, password, redirectTo: "/" })`. Show a note: "Temp login — testing only."

- [ ] **Step 2: Root redirect**

`app/page.tsx` — server component: `const u = await getCurrentUser();` → if none redirect `/signin`; if `MANAGER` redirect `/manager`; else redirect `/dashboard`.

- [ ] **Step 3: Nav shell**

`components/nav.tsx` — shows name + role badge, a sign-out button (server action → `signOut`), and links: Employees see Dashboard / My Activities; Managers see Manager. Add `<Toaster />` (sonner) in `app/layout.tsx`.

- [ ] **Step 4: Verify**

Run: `pnpm dev`. `/` redirects to `/signin`; temp-login form visible; logging in as Manager lands on `/manager` (404 body is fine until Task 14). Sign out returns to `/signin`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: sign-in page (Google + temp), role-based redirect and nav"
```

---

## Task 13: Employee dashboard, activity form + history

**Files:**
- Create: `app/dashboard/page.tsx`, `app/activities/page.tsx`, `components/activity-form.tsx`, `components/activity-history.tsx`
- Consumes: actions from Task 9, `isLocked`, `dateToISO`, `todayISO`, `prisma`, shadcn form components.

**Interfaces:**
- Produces: employee-facing pages. `activity-form.tsx` is a client component calling `createActivity`/`updateActivity` and toasting the returned error. `activity-history.tsx` lists own rows and disables edit/delete on locked rows.

- [ ] **Step 1: Activity form (client)**

`components/activity-form.tsx` — fields: Date (`<input type="date" max={todayISO()}>`), Activity, Description (textarea), Assigned By, Status (select of the 4 values), Deadline (date, optional), Time Taken (number, step 0.25, min 0.25). On submit calls the passed action; on `{ ok:false }` shows `toast.error(error)`; on success resets/closes and `router.refresh()`.

- [ ] **Step 2: Dashboard**

`app/dashboard/page.tsx` — server component. `requireUser()`. Fetch own activities where `date === todayISO()` (Today's Entries) and latest 10 (Recent Activities). Render an "Add Activity" dialog hosting `activity-form`, plus the two lists.

- [ ] **Step 3: History with lock indicators**

`app/activities/page.tsx` — server component. `requireUser()`. Fetch all own activities `orderBy date desc`. Fetch all locks once; compute `locked = isLocked(dateToISO(row.date), locks)` per row. Pass rows (+`locked`) to `activity-history.tsx`, which renders a table; locked rows show a "Locked" badge and no edit/delete controls; unlocked rows have Edit (opens form) and Delete (calls `deleteActivity`).

- [ ] **Step 4: Verify**

Run: `pnpm dev`, temp-login. (Temporarily set `TEMP_LOGIN_ROLE=EMPLOYEE` to test employee flow, or add an employee via Google later.) Create an activity dated today and a past date; both succeed. Try a future date — blocked by the `max` attr and, if forced, by the action. Edit + delete work. Confirm no crash when locks table is empty.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: employee dashboard, activity form, history with lock indicators"
```

---

## Task 14: Manager dashboard — stats, table, filters, delete, export, locks

**Files:**
- Create: `app/manager/page.tsx`, `components/activity-filters.tsx`, `components/lock-panel.tsx`
- Consumes: `requireManager`, `buildActivityWhere`, actions from Task 10, `deleteActivity` (Task 9), `todayISO`, `dateToISO`, `prisma`.

**Interfaces:**
- Produces: manager page reading filters from `searchParams`, rendering stats + filtered table + export link + lock management.

- [ ] **Step 1: Filters bar (client)**

`components/activity-filters.tsx` — inputs for Employee, Designation, Status, Assigned By, Date From, Date To, and a Search box. On change, push to the URL query string (`router.push('/manager?' + params)`). This makes filters shareable and lets the export link read the same params.

- [ ] **Step 2: Manager page**

`app/manager/page.tsx` — server component. `requireManager()`. Read `searchParams` into `ActivityFilters`. Compute stats: Total (count of `buildActivityWhere(filters)`), Completed (+`status: COMPLETED`), Pending (+`status: PENDING`), Employees Submitted Today (distinct `userId` where `date === todayISO()`). Render stat cards. Fetch filtered rows `orderBy date desc`; render table with a Delete button per row (calls `deleteActivity`). Render an **Export** button linking to `/api/export?<same params>`.

- [ ] **Step 3: Lock panel (client)**

`components/lock-panel.tsx` — "Lock This Month" (month `<input type="month">` → `lockMonth(value, reason?)`) and a custom range form (start/end date + optional label + reason → `lockPeriod`). Below, list existing locks (label/range, lockedBy, lockedAt, reason) each with a Remove button (`removeLock`). Fetch locks in the server page and pass down.

- [ ] **Step 4: Verify end-to-end**

Run: `pnpm dev`, temp-login as Manager.
- Seed a few activities (via employee flow / temp role toggle).
- Filter by Status/Designation/date range — table + stats update; Export downloads exactly the filtered set.
- Lock the current month → as an employee (toggle temp role), creating/editing an activity dated in that month is rejected with "This reporting period is locked."; a date outside the lock still works; as Manager, editing inside the lock still works.
- Remove the lock → employee writes in that month succeed again.

- [ ] **Step 5: Full test run + commit**

Run: `pnpm test` (all lib tests green) and `npx tsc --noEmit` (clean).

```bash
git add -A && git commit -m "feat: manager dashboard with stats, filters, delete, export, period locks"
```

---

## Task 15: Google wiring + production hardening (when credentials exist)

**Files:**
- Modify: `.env` (real `AUTH_GOOGLE_ID`/`SECRET`), deployment docs.

- [ ] **Step 1:** In Google Cloud Console (done by product owner): create OAuth 2.0 Client (Web), add redirect `https://<domain>/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`. Put ID/secret in `.env`.
- [ ] **Step 2:** Sign in with a real `@gteceducation.com` Google account → lands by role. Sign in with a non-domain account → rejected.
- [ ] **Step 3:** For production: set `ALLOW_TEMP_LOGIN=false` (temp provider disappears), set `MANAGER_EMAILS`. Supabase provides automatic daily backups out of the box — the "daily automatic database backup" NFR is satisfied by the platform, no app code.
- [ ] **Step 4: Commit** any doc/env.example changes.

```bash
git add -A && git commit -m "docs: Google OAuth wiring + production hardening checklist"
```

---

## Self-Review notes

- **Spec coverage:** login/domain (T6–7,12), temp login (T7,12), activity entry + validation (T5,9,13), status values (T5), history (T13), search (T8,14), filters (T8,14), Excel export of filtered set (T8,11,14), employee dashboard (T13), manager dashboard stats (T14), period lock month+range+reason+traceability (T2,10,14), locked read-only for employees / managers bypass (T9,13,14), future-date rule (T3,5,13), NFR backup (T15). All covered.
- **Type consistency:** `ActivityFilters`/`buildActivityWhere` defined in T8 and reused verbatim in T11/T14; `ActivityInput`/`LockInput` from T5 used in T9/T10; session shape from T7 used everywhere.
- **Timezone:** every "today"/date-only comparison routes through `lib/dates.ts`.
