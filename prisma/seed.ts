import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  DEFAULT_STAFF_PASSWORD,
  runShiftImport,
  runStaffImport,
} from "../src/lib/import/run";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MANAGER_EMAIL = "manager@clinicmail.test";
const MANAGER_PASSWORD = "password123";

const SEED_DATA = join(import.meta.dirname, "..", "seed-data");

async function main() {
  // staff.csv has no manager in it, so the one manager login is explicit.
  const passwordHash = await bcrypt.hash(MANAGER_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: {},
    create: {
      email: MANAGER_EMAIL,
      fullName: "Dana Okonkwo",
      role: "manager",
      passwordHash,
    },
  });

  const staff = await runStaffImport(
    prisma,
    readFileSync(join(SEED_DATA, "staff.csv"), "utf-8"),
    "staff.csv",
    "seed",
  );
  if (!staff.ok) throw new Error(`staff import failed: ${staff.error}`);

  const shifts = await runShiftImport(
    prisma,
    readFileSync(join(SEED_DATA, "shifts.csv"), "utf-8"),
    "shifts.csv",
    "seed",
  );
  if (!shifts.ok) throw new Error(`shift import failed: ${shifts.error}`);

  console.log(
    `staff.csv   accepted=${staff.accepted} merged=${staff.merged} rejected=${staff.rejected}`,
  );
  console.log(
    `shifts.csv  accepted=${shifts.accepted} merged=${shifts.merged} rejected=${shifts.rejected}`,
  );
  console.log(`\nmanager  ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
  console.log(`staff    any imported email / ${DEFAULT_STAFF_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
