# Employee Activity Reporting System — Design

**Version:** 1.0 · **Date:** 2026-08-01 · **Status:** For implementation

Internal CRM for daily work reporting with one-click Excel export. Replaces
manual Excel/chat/email reporting. Source of truth: `Employee_Activity_Reporting_System_PRD`.

## 1. Architecture

**Single Next.js application.** No separate backend.

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Data access | Prisma ORM |
| Database | PostgreSQL (from first commit) |
| Auth | Auth.js (NextAuth v5) |
| Server logic | Server Actions + Route Handlers |
| Excel export | `exceljs` (streamed download) |
| Timezone | `Asia/Kolkata` (business tz for all date rules) |

Rationale: auth is the riskiest part. Auth.js reduces "Google-only + domain
lock + temp login" to one config file; a separate FastAPI backend would mean
hand-rolling OAuth code exchange and ID-token verification. exceljs ≈ openpyxl,
so nothing is lost on export.

Deviation from PRD: PRD suggested FastAPI + JWT. Auth changed to Google OAuth
per the product owner; backend folded into Next.js per the same owner's approval.

## 2. Roles & Authentication

Two roles: **Employee** (default) and **Manager**.

### Sign-in
- **Google only.** Auth.js Google provider. `authorization.params.hd = "gteceducation.com"` is a *UI hint only*.
- **Server-side enforcement** in the `signIn` callback — this is the real gate:
  - reject unless `profile.email_verified === true`
  - reject unless the email domain is `gteceducation.com` (prefer the ID token's `hd` claim when present)
- **Temp login** (testing phase): Auth.js Credentials provider, active **only** when
  `ALLOW_TEMP_LOGIN === "true"` **and** `NODE_ENV !== "production"`. No credential is
  committed; the temp username/password come from env (`TEMP_LOGIN_USER`,
  `TEMP_LOGIN_PASSWORD`). Defaults to off. This exists so the app can be built and
  verified end-to-end before Google OAuth credentials are provisioned.

### Role assignment
- No admin UI in v1. `MANAGER_EMAILS` env var (comma-separated) is checked at sign-in;
  matching users get `role = MANAGER`, everyone else `EMPLOYEE`. Written to the user row.
- The temp-login user's role is controlled by env (`TEMP_LOGIN_ROLE`, default `MANAGER`
  so the whole app is exercisable in testing).

### Session
- JWT session strategy. `role`, `userId`, `name`, `designation` carried in the token.
- All server actions and route handlers re-check role server-side. Never trust the client.

## 3. Data Model (Prisma)

```
User
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  designation String?          // auto-filled onto activities; editable in profile
  role        Role     @default(EMPLOYEE)
  createdAt   DateTime @default(now())
  activities  Activity[]

Activity
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(...)
  employeeName String            // snapshot of user.name at create time
  designation  String            // snapshot of user.designation at create time
  date         DateTime          // activity date (date-only semantics, stored as tz-aware)
  activity     String            // required
  description  String?           // optional
  assignedBy   String            // required
  status       Status            // enum
  deadline     DateTime?         // optional; if set, >= date
  timeTaken    Decimal           // hours; CHECK (timeTaken > 0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

Role   = EMPLOYEE | MANAGER
Status = PENDING | IN_PROGRESS | COMPLETED | ON_HOLD

PeriodLock
  id         String   @id @default(cuid())
  startDate  DateTime          // inclusive, date-only semantics
  endDate    DateTime          // inclusive
  label      String?           // e.g. "October 2026" — display only
  reason     String?           // optional note on why it was locked (traceability)
  lockedById String
  lockedBy   User     @relation(...)
  lockedAt   DateTime @default(now())
```

**Reporting period lock.** A manager locks a date range (a whole month, or an
arbitrary selected period) after reviewing/exporting it. An activity is "in a locked
period" if its `date` falls within any PeriodLock range. Employees cannot **create,
edit, or delete** activities whose `date` is in a locked period; managers bypass the
lock entirely. This preserves report integrity after finalization while letting
employees who submit weekly or end-of-month backfill any *unlocked* past date. A
manager can remove a lock (delete the PeriodLock row) if it was applied in error.

**Snapshotting** `employeeName` and `designation` onto each Activity keeps historical
filters/exports accurate even if a user later changes their name or designation.

DB-level guard: `CHECK (timeTaken > 0)` (cheapest place to enforce rule; app validates too).

## 4. Validation (all enforced server-side)

| Rule | Where |
|---|---|
| Activity required | zod + form |
| Date required | zod + form |
| Assigned By required | zod + form |
| Time Taken > 0 | zod + DB CHECK |
| Employee Name auto-filled | from session, not user input |
| Description optional | — |
| Activity date not in the future | zod, compared in `Asia/Kolkata` |
| Deadline ≥ activity date (when deadline set) | zod cross-field |

## 5. Date/time rules

### Timezone helper — one shared source
`lib/dates.ts` owns **all** "today" logic in `Asia/Kolkata`. Three call sites:
1. **No future dates** — `localDate(input) <= today()` (validation, §4).
2. **"Employees Submitted Today"** dashboard stat — count of distinct users with an
   activity whose `date` is `today()`.
3. **Export filename** — `Daily_Report_YYYY-MM-DD.xlsx` uses `today()`.

Comparing in UTC would misjudge the day boundary for morning-IST use, so all three
route through this helper.

### Edit/write rule (no time window)
Employees may create and edit their **own** activities for **any past date**; future
dates are rejected (§4). There is **no** same-day or 24-hour restriction. The only
write restriction is the **reporting period lock** (§3): if the activity's `date` is in
a locked period, employees cannot create, edit, or delete it. Managers are never
restricted. Lock membership is a pure date-range containment check, also via `lib/dates.ts`.

## 6. Features

### Employee
- **Dashboard:** Add Activity (button/form), Today's Entries (list), Recent Activities (list).
- **Add/Create activity:** form with fields from §3; name+designation auto-filled from profile.
  Any past date allowed; blocked if the chosen date is in a locked period (§3).
- **Activity History:** all own activities; each row shows Date, Activity, Status, Time Taken, Deadline.
  Rows in a locked period are read-only (edit/delete disabled) with a "locked" indicator.
- **Edit/delete own activity:** allowed for any past date **unless** its period is locked (§5).

### Manager
- **Dashboard stats:** Total Activities, Completed Activities, Pending Activities,
  Employees Submitted Today, Export button.
- **View all activities:** table across all employees.
- **Search:** by Employee Name, Activity, Assigned By (case-insensitive).
- **Filters (combinable):** Date, Date Range, Employee, Designation, Status, Assigned By.
- **Delete:** permanent delete of any record (Manager only).
- **Excel export:** exports the **currently filtered** result set.
- **Lock/unlock reporting period:** lock a month or an arbitrary date range after
  reviewing/exporting it (§3); view existing locks; remove a lock applied in error.

### Access control
- Employees: create/view/edit/delete **own** only, subject to the period lock (§5).
  Cannot view others, export, or manage locks.
- Managers: full read across all data, delete, export. (PRD: no visibility restrictions.)

## 7. Query & Export share one path

Manager list view and export use **one** query builder taking the same filter/search
params. Export = "run the list query with current params, stream to xlsx." No separate
"export everything" code path, so the two can never drift (PRD §6.7 + worked example
both specify *currently filtered* data).

Export columns: Date, Employee Name, Designation, Activity, Description, Assigned By,
Status, Deadline, Time Taken.

## 8. Out of scope (v1)

Project management, task-assignment workflow, email notifications, mobile app,
approval process, chat, PDF export, calendar view, file attachments, activity
templates, team-wise dashboards, charts/analytics. (PRD §4 + §13.)

## 9. Non-functional

- Responsive UI; page loads < 2s under normal use.
- Secure login (§2).
- Excel export < 5s for normal report sizes.
- Daily automatic DB backup — **ops concern**, documented for deployment (e.g. managed
  Postgres automated backups or a cron `pg_dump`); not application code in v1.

## 10. Build/verify ordering (why the temp login exists)

Google OAuth needs a Client ID/Secret created by the product owner in Google Cloud
Console, with the redirect URI registered — Claude cannot create these. Therefore:
1. Build and verify the **entire app** end-to-end on the temp login.
2. Wire the Google provider once credentials exist; flip temp login off for production.

## 11. Testing

- Unit: `lib/dates.ts` (future-date check, today boundary across IST midnight,
  period-lock range containment), validation schema (cross-field deadline/date, time>0),
  filter/query builder.
- Period lock: employee create/edit/delete rejected when `date` in a locked range,
  allowed just outside it; manager bypasses the lock.
- The domain-enforcement `signIn` callback: allow verified `@gteceducation.com`,
  reject other domains, reject unverified.
