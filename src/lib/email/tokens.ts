import crypto from "crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { EmailTokenType, EmailToken } from "@prisma/client";

/** TTL per token type in milliseconds. */
const TOKEN_TTL: Record<EmailTokenType, number> = {
  VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
  EMAIL_CHANGE: 24 * 60 * 60 * 1000, // 24 hours
};

/** Generate a cryptographically random token string. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Compute SHA-256 hash of a raw token. */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Create a new email token, store its hash in the DB, and return the raw token.
 *
 * Automatically cleans up previous unused tokens of the same type for this user.
 */
export async function createEmailToken(
  userId: string,
  type: EmailTokenType,
  metadata?: Prisma.InputJsonValue,
): Promise<string> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL[type]);

  // Remove old unused tokens of same type for this user
  await db.emailToken.deleteMany({
    where: { userId, type, usedAt: null },
  });

  await db.emailToken.create({
    data: {
      userId,
      tokenHash,
      type,
      expiresAt,
      metadata: metadata ?? undefined,
    },
  });

  return rawToken;
}

/**
 * Validate a raw token against the DB.
 * Returns the token record if valid, throws otherwise.
 */
export async function validateEmailToken(
  rawToken: string,
  expectedType: EmailTokenType,
): Promise<EmailToken> {
  const tokenHash = hashToken(rawToken);

  const token = await db.emailToken.findUnique({
    where: { tokenHash },
  });

  if (!token) {
    throw new Error("TOKEN_NOT_FOUND");
  }

  if (token.type !== expectedType) {
    throw new Error("TOKEN_TYPE_MISMATCH");
  }

  if (token.usedAt) {
    throw new Error("TOKEN_ALREADY_USED");
  }

  if (token.expiresAt < new Date()) {
    throw new Error("TOKEN_EXPIRED");
  }

  return token;
}

/**
 * Mark a token as consumed so it cannot be reused.
 */
export async function consumeEmailToken(tokenId: string): Promise<void> {
  await db.emailToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
