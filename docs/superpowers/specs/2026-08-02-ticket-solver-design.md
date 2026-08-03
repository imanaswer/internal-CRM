# Ticket Solver — Design

**Date:** 2026-08-02 · **Status:** Approved by product owner
**Parent app:** Employee Activity Reporting System (same Next.js app, same auth)

## 1. Purpose

The tech team receives complaints through many channels (phone, WhatsApp, email,
walk-in). They log each one as a ticket in a single shared list so the whole team
sees what exists and who is handling it — preventing duplicate work. When a ticket
is solved, the solver sends the raiser a WhatsApp message (manually, via a
pre-filled link) containing the resolution, time, and description.

## 2. Access — tech team only

- `TECH_EMAILS` env var: comma-separated emails (same pattern as `MANAGER_EMAILS`).
- Resolution happens at sign-in (JWT carries `tech: boolean`); membership changes
  by editing the env var. No new DB role — a user can be both MANAGER and tech.
- Tech members see a **Tickets** nav link and can use `/tickets`. Everyone else is
  redirected to their home page; all ticket server actions re-check tech
  membership server-side (`requireTech()`).
- The temp logins are included via env in development for testing.

## 3. Data model

```prisma
enum TicketSource   { PHONE WHATSAPP EMAIL WALK_IN OTHER }
enum TicketPriority { LOW MEDIUM HIGH URGENT }
enum TicketStatus   { OPEN TAKEN_UP SOLVED DUPLICATE }

model Ticket {
  id             String         @id @default(cuid())
  num            Int            @unique @default(autoincrement()) // shown as T-001
  title          String
  description    String?
  contactName    String
  contactPhone   String         // number that raised it; WhatsApp target
  branch         String?
  source         TicketSource
  ipAddress      String?        // most issues are server issues
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
  resolutionNote String?        // required at solve time; goes into the WhatsApp text
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([status, priority])
  @@index([contactPhone])
}
```

## 4. Workflow

- **Create** (any tech member): title, contact name + phone, source required;
  description, branch, IP, asset ID optional; priority defaults Medium.
- **Take Up**: sets `TAKEN_UP`, stamps `takenBy` + `takenAt`. The taker's name on
  the list is the "someone's already on it" signal.
- **Mark Solved**: dialog requiring a resolution note → sets `SOLVED`, stamps
  `solvedBy` + `solvedAt`.
- **Mark Duplicate**: closes repeats (status `DUPLICATE`).
- **Reopen**: a SOLVED or DUPLICATE ticket can be reopened to OPEN (mistakes happen).
- **Delete**: MANAGER role only (tickets are a record; tech members close, not delete).

## 5. No-duplicates mechanism

One shared list at `/tickets`: open tickets first, sorted Urgent→Low, then
Taken Up, then Solved/Duplicate (recent first). Each row: T-number, title,
contact, source badge, priority badge, status badge, taker name. Search box
matches title, contact name, contact phone, asset ID, IP. Filters: status,
priority. Before logging, a tech member sees/searches what already exists.

## 6. WhatsApp notification (manual for now)

- Solved tickets show **Send WhatsApp** — an anchor to
  `https://wa.me/<normalized>?text=<encoded>`; the solver reviews and hits send
  in WhatsApp. No provider, no API, works from any device.
- `lib/whatsapp.ts` (pure, unit-tested):
  - `normalizePhone(raw)`: strip non-digits; 10-digit → prefix `91`; keep 11–15
    digit international numbers as-is; return null if unusable.
  - `buildWaLink(phone, message)`: returns the wa.me URL or null.
  - `solvedMessage(t)`: `Hi <contactName>, your complaint T-<num> — <title> has
    been resolved on <d MMM yyyy, h:mm a IST>. Resolution: <resolutionNote>.
    — G-TEC Tech Team`
- Future automation (Meta Cloud API / SMS-DLT) replaces the button's click with an
  API call; message builder and data model already fit.

## 7. UI

- `/tickets` (tech-gated server page): stat chips (Open, Taken Up, Solved today),
  filter bar, ticket table, New Ticket dialog. Same shadcn patterns/components as
  the activity module (StatusBadge-style badges for status/priority/source).
- Row actions by state: OPEN → Take Up / Duplicate; TAKEN_UP → Mark Solved /
  Duplicate; SOLVED → Send WhatsApp / Reopen; DUPLICATE → Reopen.
  Delete visible to managers only.

## 8. Server actions (`app/tickets/actions.ts`)

`createTicket`, `takeUpTicket`, `solveTicket(id, note)`, `markDuplicate`,
`reopenTicket`, `deleteTicket` — all `requireTech()` first (delete additionally
requires MANAGER); all return `{ok:true} | {ok:false,error}` with the existing
try/catch + `safeErrorMessage` pattern; `revalidatePath("/tickets")`.

## 9. Validation (zod, `lib/validation.ts`)

`ticketSchema`: title ≥ 3 chars; contactName required; contactPhone must
normalize successfully (via `normalizePhone`); source/priority enum-checked;
others optional trimmed strings. `solveSchema`: note ≥ 3 chars.

## 10. Testing

- Unit: `normalizePhone` (10-digit, +91-prefixed, spaces/dashes, garbage),
  `buildWaLink` encoding, `solvedMessage` formatting (IST), tech-membership
  resolution, `ticketSchema` edge cases.
- Existing per-task review + live browser verification for the flows (create →
  take up → solve → WhatsApp link correctness → duplicate → reopen; non-tech
  redirect; manager-only delete).

## 11. Out of scope (explicitly)

Automated sending (provider API), attachments, comments/threads, SLA timers,
email ingestion, per-branch dashboards.
