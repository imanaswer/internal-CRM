# Ticket Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tech-team-only ticket tracker (log complaints from any channel, take up, solve, mark duplicates) with a manual "Send WhatsApp" resolution message.

**Architecture:** New `/tickets` module inside the existing Next.js app, mirroring the activity module's proven patterns: Prisma model + migration, zod validation, `"use server"` actions gated by a new `requireTech()`, one server page + client dialog/table components, pure unit-tested libs for phone/WhatsApp-link building and tech-membership resolution.

**Tech Stack:** Existing stack only — Next 16, Prisma 6, Auth.js v5, zod 4, shadcn/ui, vitest. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-ticket-solver-design.md`. Parent app conventions from `docs/superpowers/specs/2026-08-01-employee-activity-reporting-design.md` still bind.
- **Tech gate:** membership = email listed in `TECH_EMAILS` (comma-separated, case-insensitive, same pattern as `MANAGER_EMAILS`). JWT carries `tech: boolean`. Every ticket server action calls `requireTech()` FIRST. `deleteTicket` additionally requires `role === "MANAGER"`.
- **Enums (exact):** `TicketSource { PHONE WHATSAPP EMAIL WALK_IN OTHER }`; `TicketPriority { LOW MEDIUM HIGH URGENT }`; `TicketStatus { OPEN TAKEN_UP SOLVED DUPLICATE }`.
- **Status transitions:** Take Up: OPEN→TAKEN_UP. Solve: OPEN or TAKEN_UP→SOLVED (requires note ≥3 chars). Duplicate: OPEN or TAKEN_UP→DUPLICATE. Reopen: SOLVED or DUPLICATE→OPEN (clears takenBy/solvedBy stamps).
- **Ticket number:** `num Int @unique @default(autoincrement())`, displayed `T-${String(num).padStart(3, "0")}`.
- **Phone normalization:** strip non-digits; 10 digits → prefix `91`; 11 digits starting `0` → drop the 0, prefix `91`; 11–15 digits → keep as-is; anything else → null (invalid).
- **WhatsApp message (exact template):** `Hi <contactName>, your complaint T-<num> — <title> has been resolved on <d MMM yyyy, h:mm am/pm> IST. Resolution: <note>. — G-TEC Tech Team`
- Client/server boundary: serialize Dates to ISO strings and Decimals to numbers before passing to client components. Actions return `{ok:true} | {ok:false,error}` using `safeErrorMessage` (`lib/errors.ts`); client handlers wrap calls in try/catch (session-expiry toast) exactly like `components/activity-history.tsx`.
- All timestamps display in Asia/Kolkata.
- Commit author: `git -c user.name='Anaswer Ajay' -c user.email='anaswer.impluse@gmail.com'`; body ends `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- `lib/whatsapp.ts` + `lib/whatsapp.test.ts` — normalizePhone, buildWaLink, solvedMessage (pure).
- `lib/auth-domain.ts` (+test) — add `resolveTech(email, techEmails): boolean`.
- `lib/validation.ts` (+test) — add `ticketSchema`, `solveSchema`.
- `prisma/schema.prisma` — Ticket model + 3 enums + User relations. Migration `add_tickets`.
- `auth.ts` — jwt/session carry `tech`. `lib/session.ts` — SessionUser.tech + `requireTech()`.
- `app/tickets/actions.ts` — 6 actions.
- `app/tickets/page.tsx` — tech-gated server page (stats, filters, table, new-ticket dialog).
- `components/ticket-badges.tsx` — status/priority/source badge maps (server-safe).
- `components/ticket-form.tsx`, `components/new-ticket-dialog.tsx`, `components/tickets-table.tsx` — client.
- `components/nav.tsx` — add Tickets link for tech users.
- `.env` / `.env.example` — `TECH_EMAILS`.

---

## Task 1: WhatsApp lib (`lib/whatsapp.ts`)

**Files:**
- Create: `lib/whatsapp.ts`
- Test: `lib/whatsapp.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(raw: string): string | null`
  - `buildWaLink(phone: string, message: string): string | null`
  - `solvedMessage(t: { contactName: string; num: number; title: string; resolutionNote: string; solvedAt: Date }): string`
  - `ticketNo(num: number): string` → `"T-007"`

- [ ] **Step 1: Write the failing tests**

`lib/whatsapp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, buildWaLink, solvedMessage, ticketNo } from "./whatsapp";

describe("normalizePhone", () => {
  it("prefixes 91 to 10-digit numbers", () => expect(normalizePhone("9876543210")).toBe("919876543210"));
  it("strips spaces/dashes/parens", () => expect(normalizePhone("98765 432-10")).toBe("919876543210"));
  it("drops leading 0 then prefixes 91", () => expect(normalizePhone("09876543210")).toBe("919876543210"));
  it("keeps 12-digit country-coded numbers", () => expect(normalizePhone("+91 98765 43210")).toBe("919876543210"));
  it("keeps other international numbers", () => expect(normalizePhone("+1 415 555 2671")).toBe("14155552671"));
  it("rejects too-short numbers", () => expect(normalizePhone("12345")).toBeNull());
  it("rejects empty/garbage", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("buildWaLink", () => {
  it("builds an encoded wa.me link", () => {
    expect(buildWaLink("9876543210", "Hi there & welcome")).toBe(
      "https://wa.me/919876543210?text=Hi%20there%20%26%20welcome"
    );
  });
  it("returns null for bad phone", () => expect(buildWaLink("123", "x")).toBeNull());
});

describe("ticketNo", () => {
  it("pads to 3 digits", () => expect(ticketNo(7)).toBe("T-007"));
  it("does not truncate 4-digit numbers", () => expect(ticketNo(1234)).toBe("T-1234"));
});

describe("solvedMessage", () => {
  it("formats the exact template in IST", () => {
    const msg = solvedMessage({
      contactName: "Ravi",
      num: 14,
      title: "WiFi down in Lab 2",
      resolutionNote: "Router restarted and firmware updated",
      solvedAt: new Date("2026-08-02T12:10:00.000Z"), // 17:40 IST
    });
    expect(msg).toBe(
      "Hi Ravi, your complaint T-014 — WiFi down in Lab 2 has been resolved on 2 Aug 2026, 5:40 pm IST. Resolution: Router restarted and firmware updated. — G-TEC Tech Team"
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test lib/whatsapp.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/whatsapp.ts`:

```ts
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function buildWaLink(phone: string, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function ticketNo(num: number): string {
  return `T-${String(num).padStart(3, "0")}`;
}

const IST_STAMP = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function solvedMessage(t: {
  contactName: string;
  num: number;
  title: string;
  resolutionNote: string;
  solvedAt: Date;
}): string {
  const stamp = IST_STAMP.format(t.solvedAt).replace(" at ", ", ");
  return `Hi ${t.contactName}, your complaint ${ticketNo(t.num)} — ${t.title} has been resolved on ${stamp} IST. Resolution: ${t.resolutionNote}. — G-TEC Tech Team`;
}
```

Note: `en-IN` formats as `2 Aug 2026 at 5:40 pm` in current ICU; the `.replace(" at ", ", ")` yields `2 Aug 2026, 5:40 pm`. If the local ICU emits `2 Aug 2026, 5:40 pm` directly, the replace is a no-op — either way the test asserts the final string; adjust the replace only if the test shows a different separator.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test lib/whatsapp.test.ts` → PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp.ts lib/whatsapp.test.ts
git commit -m "feat: WhatsApp link + solved-message builders with phone normalization"
```

---

## Task 2: Tech membership + ticket validation schemas

**Files:**
- Modify: `lib/auth-domain.ts` (append), `lib/auth-domain.test.ts` (append)
- Modify: `lib/validation.ts` (append), `lib/validation.test.ts` (append)

**Interfaces:**
- Consumes: `normalizePhone` from `lib/whatsapp` (Task 1).
- Produces:
  - `resolveTech(email: string, techEmails: string): boolean`
  - `ticketSchema` → `type TicketInput = z.infer<typeof ticketSchema>` = `{ title; contactName; contactPhone; source; priority; description?; branch?; ipAddress?; assetId? }`
  - `solveSchema` → `{ note: string }`

- [ ] **Step 1: Write the failing tests**

Append to `lib/auth-domain.test.ts`:

```ts
describe("resolveTech", () => {
  it("true when listed (case-insensitive, trimmed)", () =>
    expect(resolveTech("Tech@gteceducation.com", " tech@gteceducation.com , x@y.com")).toBe(true));
  it("false otherwise", () => expect(resolveTech("a@gteceducation.com", "tech@x.com")).toBe(false));
  it("false for empty list", () => expect(resolveTech("a@x.com", "")).toBe(false));
});
```

(also add `resolveTech` to the import at the top of the file)

Append to `lib/validation.test.ts`:

```ts
const ticketBase = {
  title: "WiFi down in Lab 2",
  contactName: "Ravi",
  contactPhone: "9876543210",
  source: "PHONE",
  priority: "HIGH",
};

describe("ticketSchema", () => {
  it("accepts a valid ticket", () => {
    expect(ticketSchema.safeParse(ticketBase).success).toBe(true);
  });
  it("rejects short title", () =>
    expect(ticketSchema.safeParse({ ...ticketBase, title: "ab" }).success).toBe(false));
  it("rejects un-normalizable phone", () =>
    expect(ticketSchema.safeParse({ ...ticketBase, contactPhone: "123" }).success).toBe(false));
  it("rejects bad source", () =>
    expect(ticketSchema.safeParse({ ...ticketBase, source: "FAX" }).success).toBe(false));
  it("accepts optional tech fields", () => {
    expect(
      ticketSchema.safeParse({ ...ticketBase, ipAddress: "10.0.0.4", assetId: "SRV-02", branch: "Kochi" }).success
    ).toBe(true);
  });
});

describe("solveSchema", () => {
  it("requires a note of 3+ chars", () => {
    expect(solveSchema.safeParse({ note: "ok" }).success).toBe(false);
    expect(solveSchema.safeParse({ note: "Restarted router" }).success).toBe(true);
  });
});
```

(add `ticketSchema, solveSchema` to the import at the top)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test lib/auth-domain.test.ts lib/validation.test.ts` → FAIL (missing exports).

- [ ] **Step 3: Implement**

Append to `lib/auth-domain.ts`:

```ts
export function resolveTech(email: string, techEmails: string): boolean {
  const set = new Set(
    techEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  return set.has(email.trim().toLowerCase());
}
```

Append to `lib/validation.ts` (add `import { normalizePhone } from "./whatsapp";` at the top):

```ts
export const ticketSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  description: z.string().trim().optional(),
  contactName: z.string().trim().min(1, "Contact name is required"),
  contactPhone: z
    .string()
    .trim()
    .refine((p) => normalizePhone(p) !== null, "Enter a valid phone number"),
  branch: z.string().trim().optional(),
  source: z.enum(["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  ipAddress: z.string().trim().optional(),
  assetId: z.string().trim().optional(),
});

export type TicketInput = z.infer<typeof ticketSchema>;

export const solveSchema = z.object({
  note: z.string().trim().min(3, "Describe the resolution (3+ characters)"),
});
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test` → all suites PASS (existing 42 + new 9).

- [ ] **Step 5: Commit**

```bash
git add lib/auth-domain.ts lib/auth-domain.test.ts lib/validation.ts lib/validation.test.ts
git commit -m "feat: tech-membership resolution + ticket/solve zod schemas"
```

---

## Task 3: Ticket model, migration, tech flag in auth/session

**Files:**
- Modify: `prisma/schema.prisma`, `auth.ts`, `lib/session.ts`, `.env`, `.env.example`

**Interfaces:**
- Consumes: `resolveTech` (Task 2).
- Produces: Prisma `Ticket` model + enums `TicketSource/TicketPriority/TicketStatus`; session user carries `tech: boolean`; `requireTech(): Promise<SessionUser>` from `lib/session.ts`.

- [ ] **Step 1: Add enums + model to `prisma/schema.prisma`**

Append:

```prisma
enum TicketSource {
  PHONE
  WHATSAPP
  EMAIL
  WALK_IN
  OTHER
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  OPEN
  TAKEN_UP
  SOLVED
  DUPLICATE
}

model Ticket {
  id             String         @id @default(cuid())
  num            Int            @unique @default(autoincrement())
  title          String
  description    String?
  contactName    String
  contactPhone   String
  branch         String?
  source         TicketSource
  ipAddress      String?
  assetId        String?
  priority       TicketPriority @default(MEDIUM)
  status         TicketStatus   @default(OPEN)
  createdById    String
  createdBy      User           @relation("TicketCreator", fields: [createdById], references: [id])
  takenById      String?
  takenBy        User?          @relation("TicketTaker", fields: [takenById], references: [id])
  takenAt        DateTime?
  solvedById     String?
  solvedBy       User?          @relation("TicketSolver", fields: [solvedById], references: [id])
  solvedAt       DateTime?
  resolutionNote String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([status, priority])
  @@index([contactPhone])
}
```

And add to the `User` model body:

```prisma
  ticketsCreated Ticket[] @relation("TicketCreator")
  ticketsTaken   Ticket[] @relation("TicketTaker")
  ticketsSolved  Ticket[] @relation("TicketSolver")
```

- [ ] **Step 2: Migrate**

Run: `npx prisma migrate dev --name add_tickets`
Expected: migration applies to Supabase; client regenerates. Then `npx prisma migrate status` → "Database schema is up to date!".

- [ ] **Step 3: Carry `tech` through auth**

In `auth.ts`: import `resolveTech` from `@/lib/auth-domain`. In the `jwt` callback, inside the existing `if (user) { if (token.email) { ... } }` block where `db` is loaded, add after `token.designation = db.designation;`:

```ts
token.tech = resolveTech(db.email, process.env.TECH_EMAILS ?? "");
```

(the `db` row has `email`; if the existing code destructures differently, use `token.email as string`). In the `session` callback add:

```ts
(session.user as any).tech = token.tech ?? false;
```

- [ ] **Step 4: Session helpers**

In `lib/session.ts`: extend `SessionUser` with `tech: boolean`; in `getCurrentUser()` map `tech: (s.user as any).tech ?? false`; append:

```ts
export async function requireTech(): Promise<SessionUser> {
  const u = await requireUser();
  if (!u.tech) throw new Error("FORBIDDEN");
  return u;
}
```

- [ ] **Step 5: Env plumbing**

`.env`: add `TECH_EMAILS="temp@local.dev,staff@local.dev,pc.futurex@gteceducation.com"` (temp logins included for dev testing).
`.env.example`: add under the Auth section:

```
# Comma-separated emails allowed into the tech Ticket module.
TECH_EMAILS=""
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → clean. Run: `pnpm test` → all pass.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations .env.example auth.ts lib/session.ts
git commit -m "feat: Ticket model + migration; tech flag in session; requireTech"
```

---

## Task 4: Ticket server actions (`app/tickets/actions.ts`)

**Files:**
- Create: `app/tickets/actions.ts`

**Interfaces:**
- Consumes: `requireTech` (Task 3), `ticketSchema`/`solveSchema`/`TicketInput` (Task 2), `prisma`, `safeErrorMessage` (`lib/errors.ts`), `revalidatePath`.
- Produces: `createTicket(input: TicketInput)`, `takeUpTicket(id: string)`, `solveTicket(id: string, note: string)`, `markDuplicate(id: string)`, `reopenTicket(id: string)`, `deleteTicket(id: string)` — each returns `{ok:true} | {ok:false,error:string}`.

- [ ] **Step 1: Implement**

`app/tickets/actions.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTech } from "@/lib/session";
import { ticketSchema, solveSchema, type TicketInput } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/errors";

type Result = { ok: true } | { ok: false; error: string };

export async function createTicket(input: TicketInput): Promise<Result> {
  const user = await requireTech();
  const parsed = ticketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    await prisma.ticket.create({
      data: {
        title: v.title,
        description: v.description || null,
        contactName: v.contactName,
        contactPhone: v.contactPhone,
        branch: v.branch || null,
        source: v.source,
        ipAddress: v.ipAddress || null,
        assetId: v.assetId || null,
        priority: v.priority,
        createdById: user.id,
      },
    });
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

async function transition(
  id: string,
  allowedFrom: ("OPEN" | "TAKEN_UP" | "SOLVED" | "DUPLICATE")[],
  data: Record<string, unknown>
): Promise<Result> {
  try {
    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Ticket not found" };
    if (!allowedFrom.includes(existing.status))
      return { ok: false, error: `Not allowed from status ${existing.status}` };
    await prisma.ticket.update({ where: { id }, data });
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function takeUpTicket(id: string): Promise<Result> {
  const user = await requireTech();
  return transition(id, ["OPEN"], {
    status: "TAKEN_UP",
    takenById: user.id,
    takenAt: new Date(),
  });
}

export async function solveTicket(id: string, note: string): Promise<Result> {
  const user = await requireTech();
  const parsed = solveSchema.safeParse({ note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return transition(id, ["OPEN", "TAKEN_UP"], {
    status: "SOLVED",
    solvedById: user.id,
    solvedAt: new Date(),
    resolutionNote: parsed.data.note,
  });
}

export async function markDuplicate(id: string): Promise<Result> {
  await requireTech();
  return transition(id, ["OPEN", "TAKEN_UP"], { status: "DUPLICATE" });
}

export async function reopenTicket(id: string): Promise<Result> {
  await requireTech();
  return transition(id, ["SOLVED", "DUPLICATE"], {
    status: "OPEN",
    takenById: null,
    takenAt: null,
    solvedById: null,
    solvedAt: null,
    resolutionNote: null,
  });
}

export async function deleteTicket(id: string): Promise<Result> {
  const user = await requireTech();
  if (user.role !== "MANAGER") return { ok: false, error: "Only managers can delete tickets" };
  try {
    await prisma.ticket.delete({ where: { id } });
    revalidatePath("/tickets");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit**

```bash
git add app/tickets/actions.ts
git commit -m "feat: ticket actions (create/take-up/solve/duplicate/reopen/delete) tech-gated"
```

---

## Task 5: Tickets UI (page, badges, form, table, nav link)

**Files:**
- Create: `app/tickets/page.tsx`, `components/ticket-badges.tsx`, `components/ticket-form.tsx`, `components/new-ticket-dialog.tsx`, `components/tickets-table.tsx`
- Modify: `components/nav.tsx`

**Interfaces:**
- Consumes: all Task 4 actions; `buildWaLink`, `solvedMessage`, `ticketNo` (Task 1); `getCurrentUser` (tech flag, Task 3); shadcn components; `toast` from sonner. Patterns: copy client-error handling from `components/activity-history.tsx` (try/catch + "Request failed — your session may have expired." toast).
- Produces: serialized `TicketRow` passed to the table:
  `{ id, num, title, description, contactName, contactPhone, branch, source, ipAddress, assetId, priority, status, takenByName, solvedByName, solvedAt (ISO|null), resolutionNote, createdAt (ISO), createdByName }` — all strings/numbers/null.

- [ ] **Step 1: Badges (`components/ticket-badges.tsx`)** — server-safe, no "use client":

```tsx
import { cn } from "@/lib/utils";

export const TICKET_SOURCES = ["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "OTHER"] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["OPEN", "TAKEN_UP", "SOLVED", "DUPLICATE"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const label = (s: string) => s.replace("_", " ");

const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

const STATUS: Record<TicketStatus, string> = {
  OPEN: "bg-rose-50 text-rose-800 ring-rose-600/20",
  TAKEN_UP: "bg-sky-50 text-sky-800 ring-sky-600/20",
  SOLVED: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  DUPLICATE: "bg-slate-100 text-slate-600 ring-slate-500/20",
};
const PRIORITY: Record<TicketPriority, string> = {
  LOW: "bg-slate-100 text-slate-600 ring-slate-500/20",
  MEDIUM: "bg-sky-50 text-sky-800 ring-sky-600/20",
  HIGH: "bg-amber-50 text-amber-800 ring-amber-600/25",
  URGENT: "bg-rose-50 text-rose-800 ring-rose-600/20",
};

export const TicketStatusBadge = ({ status }: { status: TicketStatus }) => (
  <span className={cn(base, STATUS[status])}>{label(status)}</span>
);
export const TicketPriorityBadge = ({ priority }: { priority: TicketPriority }) => (
  <span className={cn(base, PRIORITY[priority])}>{label(priority)}</span>
);
export const TicketSourceBadge = ({ source }: { source: TicketSource }) => (
  <span className={cn(base, "bg-secondary text-secondary-foreground ring-border")}>{label(source)}</span>
);
```

- [ ] **Step 2: Form (`components/ticket-form.tsx`)** — `"use client"`. Mirrors `activity-form.tsx` structure exactly (FormData → typed input, pending state, `formEl` captured before await, try/catch with session-expiry toast, toast on `{ok:false}`, success → toast + reset + `router.refresh()` + `onSuccess?.()`). Fields:
  - Title (Input, required), Description (Textarea)
  - Contact Name (Input, required), Contact Phone (Input, required, `inputMode="tel"`)
  - Branch (Input), Source (Select of TICKET_SOURCES, default PHONE), Priority (Select of TICKET_PRIORITIES, default MEDIUM)
  - IP Address (Input), Asset/Device ID (Input)
  - Props: `{ action: (input: TicketInput) => Promise<{ok:true}|{ok:false;error:string}>; onSuccess?: () => void }`.
- [ ] **Step 3: Dialog (`components/new-ticket-dialog.tsx`)** — `"use client"`, mirrors `add-activity-dialog.tsx`: Button "New Ticket" triggers a Dialog hosting `<TicketForm action={createTicket} onSuccess={close} />`.
- [ ] **Step 4: Table (`components/tickets-table.tsx`)** — `"use client"`. Props `{ rows: TicketRow[]; isManager: boolean }`. shadcn Table in the `overflow-x-auto rounded-xl border bg-card` wrapper. Columns: `T-no` (via `ticketNo(num)`), Title (truncate, title attr shows description), Contact (name + phone stacked), Source badge, Priority badge, Status badge, Taken by (`takenByName ?? "—"`), Actions.
  Actions per state (ghost buttons, same error-handling pattern as `manager-activity-table.tsx`):
  - OPEN: "Take Up" (`takeUpTicket`), "Duplicate" (`markDuplicate`)
  - TAKEN_UP: "Solve" (opens a small Dialog with a required Textarea note → `solveTicket(id, note)`), "Duplicate"
  - SOLVED: "Send WhatsApp" — an `<a target="_blank" href={buildWaLink(row.contactPhone, solvedMessage({contactName: row.contactName, num: row.num, title: row.title, resolutionNote: row.resolutionNote ?? "", solvedAt: new Date(row.solvedAt!)}))}>` rendered only when the link builder returns non-null; plus "Reopen" (`reopenTicket`)
  - DUPLICATE: "Reopen"
  - All states: Delete (trash icon, `deleteTicket`) rendered only when `isManager`.
  - OPEN rows also get "Solve" directly (spec allows OPEN→SOLVED).
  Empty state: "No tickets match." card like the manager table.
- [ ] **Step 5: Page (`app/tickets/page.tsx`)** — server component:
  - `const user = await getCurrentUser(); if (!user) redirect("/signin"); if (!user.tech) redirect("/");`
  - `searchParams` (await it): `status` (validated against TICKET_STATUSES), `priority` (validated), `q` (search).
  - Where clause: build `Prisma.TicketWhereInput` inline: status/priority if set; `q` → `OR: [{title contains insensitive}, {contactName ...}, {contactPhone ...}, {assetId ...}, {ipAddress ...}]`.
  - Fetch: `prisma.ticket.findMany({ where, include: { takenBy: {select:{name:true}}, solvedBy: {select:{name:true}}, createdBy: {select:{name:true}} } })`, then sort in JS: status order OPEN(0) TAKEN_UP(1) SOLVED(2) DUPLICATE(3), then priority URGENT→LOW, then createdAt desc. (20–200 tickets — in-memory sort is fine; note ceiling: move to SQL ordering if volume grows.)
  - Stat chips (Cards like manager page): Open count, Taken Up count, Solved Today (solvedAt >= start of IST today — compute via `parseISODate(todayISO())`), Total.
  - Filter bar: small client component inline is overkill — reuse pattern: a plain GET `<form>` with two `<select name>` (status/priority, "ALL" option omitted from qs) + `<input name="q">` + Apply/Clear links. A GET form needs no client JS: `<form method="GET">` with shadcn-styled native selects.
  - Serialize rows (ISO strings for dates) → `<TicketsTable rows={rows} isManager={user.role === "MANAGER"} />`, `<NewTicketDialog />` in the header.
- [ ] **Step 6: Nav (`components/nav.tsx`)** — in the links array construction, append `{ href: "/tickets", label: "Tickets" }` when `u.tech` is true (works for both roles).
- [ ] **Step 7: Verify**

`npx tsc --noEmit` clean; `pnpm dev` + temp login (both temp users are in TECH_EMAILS): `/tickets` renders; non-tech user (remove from TECH_EMAILS temporarily or check redirect logic by unsetting) → redirected. Create a ticket via dialog; confirm it appears with OPEN badge.

- [ ] **Step 8: Commit**

```bash
git add app/tickets components/ticket-badges.tsx components/ticket-form.tsx components/new-ticket-dialog.tsx components/tickets-table.tsx components/nav.tsx
git commit -m "feat: tickets page with stats, filters, actions, WhatsApp send, nav link"
```

---

## Task 6: End-to-end verification + ship

- [ ] **Step 1:** Full suite: `pnpm test` (all green), `npx tsc --noEmit`, `pnpm build` (clean).
- [ ] **Step 2:** Live flow (dev server + temp tech login): create ticket (phone `98765 43210`) → Take Up (name appears) → Solve with note → row shows SOLVED; "Send WhatsApp" href contains `wa.me/919876543210` and the encoded message with T-number, IST time, note. Duplicate + Reopen round-trip. Non-tech redirect verified. Manager sees Delete; staff (non-manager tech) does not.
- [ ] **Step 3:** Hostile params: `/tickets?status=BOGUS&priority=NOPE&q=x` → 200.
- [ ] **Step 4:** Update `.superpowers/sdd/progress.md`; commit any fixes; push `main`.

---

## Self-Review notes

- Spec coverage: access gate §2→T3; model §3→T3; workflow §4→T4/T5; no-duplicates list+search §5→T5; WhatsApp §6→T1/T5; UI §7→T5; actions §8→T4; validation §9→T2; testing §10→T1/T2/T6. Out-of-scope items absent. ✔
- Type consistency: `TicketInput` (T2) consumed in T4/T5; `Result` shape matches existing actions; badge types exported from one file and reused; `ticketNo`/`solvedMessage`/`buildWaLink` signatures match between T1 and T5. ✔
- The GET-form filter (T5) deliberately avoids a client component; Clear = plain link to `/tickets`. Server re-validates enums, so hostile params are safe (T6 §3). ✔
