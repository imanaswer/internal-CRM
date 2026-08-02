// Remove everything created by seed-test-data.mjs (seed.* users cascade
// their activities). Leaves the temp/staff login users in place.
import { PrismaClient } from "@prisma/client";

process.loadEnvFile(".env");
const prisma = new PrismaClient();

const users = await prisma.user.deleteMany({
  where: { email: { startsWith: "seed.", endsWith: "@local.dev" } },
});
// Any [SEED]-tagged rows created under other users (e.g. staff@local.dev).
const strays = await prisma.activity.deleteMany({
  where: { description: { startsWith: "[SEED]" } },
});
console.log(`Removed ${users.count} seed users (activities cascaded) and ${strays.count} stray [SEED] activities.`);
await prisma.$disconnect();
