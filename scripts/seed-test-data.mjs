// Seed 20 test activities under disposable @local.dev users.
// Run:    node scripts/seed-test-data.mjs
// Remove: node scripts/remove-test-data.mjs
import { PrismaClient } from "@prisma/client";

process.loadEnvFile(".env");
const prisma = new PrismaClient();

const IST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const todayISO = IST.format(new Date());
const day = (offset) => {
  const [y, m, d] = todayISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - offset));
};

const SEED_USERS = [
  { email: "seed.anita@local.dev", name: "Anita Sharma", designation: "Developer" },
  { email: "seed.rahul@local.dev", name: "Rahul Nair", designation: "Designer" },
  { email: "seed.priya@local.dev", name: "Priya Menon", designation: "Accountant" },
];

// [userIdx, daysAgo, activity, status, timeTaken, deadlineDaysAgo|null, assignedBy]
const ROWS = [
  [0, 0, "Fixed login redirect bug on reporting portal", "COMPLETED", 2.5, null, "Team Lead"],
  [0, 1, "Code review for export module", "COMPLETED", 1.5, 0, "Team Lead"],
  [0, 2, "Implement student fee summary API", "IN_PROGRESS", 4, -3, "Project Manager"],
  [0, 5, "Database index tuning on activity table", "COMPLETED", 3, null, "CTO"],
  [0, 8, "Prototype notification service", "ON_HOLD", 2, -10, "Project Manager"],
  [0, 12, "Sprint planning and estimation", "COMPLETED", 1, null, "Team Lead"],
  [0, 15, "Refactor auth middleware", "COMPLETED", 5.5, 14, "CTO"],
  [1, 0, "Design admission brochure v2", "IN_PROGRESS", 3.5, -5, "Marketing Head"],
  [1, 1, "Social media creatives for August intake", "COMPLETED", 2, 1, "Marketing Head"],
  [1, 3, "Website banner refresh", "COMPLETED", 1.5, null, "Marketing Head"],
  [1, 6, "Logo variants for FutureX event", "PENDING", 2, -2, "Event Coordinator"],
  [1, 9, "Course catalogue layout", "COMPLETED", 6, 7, "Academic Head"],
  [1, 14, "Icon set for student app", "ON_HOLD", 1.25, null, "Product Owner"],
  [2, 0, "July fee reconciliation", "IN_PROGRESS", 4.5, -1, "Finance Head"],
  [2, 1, "Vendor invoice processing", "COMPLETED", 2.25, 1, "Finance Head"],
  [2, 4, "GST filing preparation", "COMPLETED", 5, 2, "Finance Head"],
  [2, 7, "Payroll data verification", "COMPLETED", 3, 6, "HR Manager"],
  [2, 11, "Budget draft for Q3 marketing", "PENDING", 2.5, -14, "Finance Head"],
  [2, 16, "Audit document collection", "COMPLETED", 3.75, 15, "Auditor"],
  [2, 18, "Petty cash ledger update", "COMPLETED", 0.75, null, "Finance Head"],
];

const users = [];
for (const u of SEED_USERS) {
  users.push(
    await prisma.user.upsert({
      where: { email: u.email },
      update: { designation: u.designation },
      create: { ...u, role: "EMPLOYEE" },
    })
  );
}

let created = 0;
for (const [ui, ago, activity, status, timeTaken, deadlineAgo, assignedBy] of ROWS) {
  const u = users[ui];
  await prisma.activity.create({
    data: {
      userId: u.id,
      employeeName: u.name,
      designation: u.designation ?? "",
      date: day(ago),
      activity,
      description: `[SEED] Test data — safe to remove.`,
      assignedBy,
      status,
      deadline: deadlineAgo === null ? null : day(deadlineAgo),
      timeTaken,
    },
  });
  created++;
}

console.log(`Seeded ${users.length} test users and ${created} activities (all @local.dev).`);
await prisma.$disconnect();
