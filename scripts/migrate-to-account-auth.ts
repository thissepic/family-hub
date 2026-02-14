/**
 * Migration script: Set up account credentials for existing Family Hub deployments.
 *
 * Run this after deploying the account-auth update if you have an existing
 * family without email/password credentials.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-account-auth.ts <email> <password>
 *
 * Example:
 *   npx tsx scripts/migrate-to-account-auth.ts admin@myfamily.com MySecurePassword123
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/migrate-to-account-auth.ts <email> <password>");
    console.error("Example: npx tsx scripts/migrate-to-account-auth.ts admin@myfamily.com MySecurePassword123");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  // Find families that need migration
  const families = await prisma.family.findMany({
    where: {
      OR: [
        { passwordHash: "MIGRATION_REQUIRED" },
        { email: { contains: "setup-required@" } },
      ],
    },
  });

  if (families.length === 0) {
    console.log("No families need migration. All accounts are already set up.");
    process.exit(0);
  }

  if (families.length > 1) {
    console.error("Multiple families found that need migration. This script handles one at a time.");
    console.error("Families:");
    for (const f of families) {
      console.error(`  - ${f.name} (${f.id})`);
    }
    process.exit(1);
  }

  const family = families[0];
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.family.update({
    where: { id: family.id },
    data: {
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: false,
    },
  });

  console.log(`Account credentials set for family "${family.name}"`);
  console.log(`  Email: ${email.toLowerCase()}`);
  console.log(`  Password: (as provided)`);
  console.log("");
  console.log("You can now log in at /login with these credentials.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
