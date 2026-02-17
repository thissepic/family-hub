/**
 * Migration script: Create a User account for existing Family Hub deployments.
 *
 * After the user-account migration, each person needs their own User account.
 * This script creates a User and links it to the first ADMIN member of a family.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-account-auth.ts <email> <password> [familyId]
 *
 * Example:
 *   npx tsx scripts/migrate-to-account-auth.ts admin@myfamily.com MySecurePassword123
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password, familyId] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/migrate-to-account-auth.ts <email> <password> [familyId]");
    console.error("Example: npx tsx scripts/migrate-to-account-auth.ts admin@myfamily.com MySecurePassword123");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    console.error(`Error: A user with email "${email.toLowerCase()}" already exists.`);
    process.exit(1);
  }

  // Find the target family
  let family;
  if (familyId) {
    family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) {
      console.error(`Error: Family with ID "${familyId}" not found.`);
      process.exit(1);
    }
  } else {
    const families = await prisma.family.findMany();
    if (families.length === 0) {
      console.error("No families found. Create a family first.");
      process.exit(1);
    }
    if (families.length > 1) {
      console.error("Multiple families found. Specify a familyId:");
      for (const f of families) {
        console.error(`  - ${f.name} (${f.id})`);
      }
      process.exit(1);
    }
    family = families[0];
  }

  // Find first ADMIN member without a linked user
  const adminMember = await prisma.familyMember.findFirst({
    where: {
      familyId: family.id,
      role: "ADMIN",
      userId: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!adminMember) {
    console.error(`No unlinked ADMIN member found in family "${family.name}".`);
    console.error("All admin members may already be linked to user accounts.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Create user and link to admin member
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        emailVerified: false,
      },
    });

    await tx.familyMember.update({
      where: { id: adminMember.id },
      data: { userId: newUser.id },
    });

    return newUser;
  });

  console.log(`User account created and linked to family "${family.name}"`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Member: ${adminMember.name} (ADMIN)`);
  console.log("");
  console.log("You can now log in at /login with these credentials.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
