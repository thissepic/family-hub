import crypto from "crypto";
import IORedis from "ioredis";

const PENDING_TTL = 300; // 5 minutes
const KEY_PREFIX = "2fa-pending:";

let redis: IORedis | null = null;

function getRedis(): IORedis {
  if (redis) return redis;
  redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  return redis;
}

interface PendingData {
  userId: string;
  rememberMe: boolean;
}

/** Create a pending 2FA token (after password verified, before TOTP). */
export async function createPendingToken(data: PendingData): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await getRedis().set(
    `${KEY_PREFIX}${token}`,
    JSON.stringify(data),
    "EX",
    PENDING_TTL
  );
  return token;
}

/** Validate and consume a pending 2FA token. Returns data or null. */
export async function consumePendingToken(token: string): Promise<PendingData | null> {
  const key = `${KEY_PREFIX}${token}`;
  const raw = await getRedis().get(key);
  if (!raw) return null;
  await getRedis().del(key);
  return JSON.parse(raw) as PendingData;
}
