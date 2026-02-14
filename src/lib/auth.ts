import { sealData, unsealData } from "iron-session";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import crypto from "crypto";

// ─── Session Types ──────────────────────────────────────────────────────────

/** Account-level session (after email/password login) */
export interface SessionData {
  familyId: string;
  memberId?: string;
  role?: "ADMIN" | "MEMBER";
  sessionToken?: string;
}

/** Full session with profile selected (after PIN entry) */
export interface FullSessionData extends SessionData {
  memberId: string;
  role: "ADMIN" | "MEMBER";
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isFullSession(session: SessionData | null): session is FullSessionData {
  return !!session?.memberId && !!session?.role;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const SESSION_COOKIE_NAME = "family-hub-session";
const DEFAULT_TTL = parseInt(process.env.SESSION_TTL || "86400", 10); // 24h
const REMEMBER_ME_TTL = parseInt(process.env.REMEMBER_ME_TTL || "2592000", 10); // 30 days

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET!,
  ttl: DEFAULT_TTL,
};

// ─── Session Read ───────────────────────────────────────────────────────────

/** Get the current session (either account-only or full). */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!cookie?.value) return null;

  try {
    const session = await unsealData<SessionData>(cookie.value, SESSION_OPTIONS);
    if (!session.familyId) return null;
    return session;
  } catch {
    return null;
  }
}

/** Get a full session (with memberId). Returns null if only account-level. */
export async function getFullSession(): Promise<FullSessionData | null> {
  const session = await getSession();
  if (!session || !isFullSession(session)) return null;
  return session;
}

// ─── Session Write ──────────────────────────────────────────────────────────

/** Create an account-level session (after email/password login). */
export async function setAccountSession(
  familyId: string,
  rememberMe: boolean = false
): Promise<void> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const ttl = rememberMe ? REMEMBER_ME_TTL : DEFAULT_TTL;

  const data: SessionData = { familyId, sessionToken };
  const sealed = await sealData(data, { ...SESSION_OPTIONS, ttl });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });

  // Track active session in DB
  const { ipAddress, userAgent } = await getRequestMeta();
  await db.activeSession.create({
    data: {
      familyId,
      sessionToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
  });
}

/** Upgrade an account session to a full session (after profile + PIN selection). */
export async function upgradeSession(
  memberId: string,
  role: "ADMIN" | "MEMBER"
): Promise<void> {
  const current = await getSession();
  if (!current?.familyId) throw new Error("No account session to upgrade");

  const sessionToken = current.sessionToken || crypto.randomBytes(32).toString("hex");
  const ttl = DEFAULT_TTL;

  const data: FullSessionData = {
    familyId: current.familyId,
    memberId,
    role,
    sessionToken,
  };
  const sealed = await sealData(data, { ...SESSION_OPTIONS, ttl });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });

  // Update active session with memberId
  if (current.sessionToken) {
    await db.activeSession.updateMany({
      where: { sessionToken: current.sessionToken },
      data: { memberId },
    });
  }
}

/** Downgrade a full session back to account-level (remove memberId + role). */
export async function downgradeSession(): Promise<void> {
  const current = await getSession();
  if (!current?.familyId) throw new Error("No session to downgrade");

  const ttl = DEFAULT_TTL;
  const data: SessionData = {
    familyId: current.familyId,
    sessionToken: current.sessionToken,
  };
  const sealed = await sealData(data, { ...SESSION_OPTIONS, ttl });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });

  // Remove memberId from active session tracking
  if (current.sessionToken) {
    await db.activeSession.updateMany({
      where: { sessionToken: current.sessionToken },
      data: { memberId: null },
    });
  }
}

/** Clear the session completely. */
export async function clearSession(): Promise<void> {
  const session = await getSession();

  // Remove from active sessions DB
  if (session?.sessionToken) {
    await db.activeSession.deleteMany({
      where: { sessionToken: session.sessionToken },
    });
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract IP address and user agent from the current request. */
export async function getRequestMeta(): Promise<{ ipAddress: string; userAgent: string | null }> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";
  const userAgent = headerStore.get("user-agent") || null;
  return { ipAddress, userAgent };
}
