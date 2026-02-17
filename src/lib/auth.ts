import { sealData, unsealData } from "iron-session";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import crypto from "crypto";

// ─── Session Types ──────────────────────────────────────────────────────────

/** User-level session (after email/password or OAuth login). */
export interface SessionData {
  userId: string;
  familyId?: string;
  memberId?: string;
  role?: "ADMIN" | "MEMBER";
  sessionToken?: string;
}

/** Family-level session (user + family selected). */
export interface FamilySessionData extends SessionData {
  familyId: string;
}

/** Full session with profile resolved (user + family + member). */
export interface FullSessionData extends FamilySessionData {
  memberId: string;
  role: "ADMIN" | "MEMBER";
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isUserSession(session: SessionData | null): session is SessionData {
  return !!session?.userId;
}

export function isFamilySession(session: SessionData | null): session is FamilySessionData {
  return !!session?.userId && !!session?.familyId;
}

export function isFullSession(session: SessionData | null): session is FullSessionData {
  return !!session?.userId && !!session?.familyId && !!session?.memberId && !!session?.role;
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

/** Get the current session (any level). */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!cookie?.value) return null;

  try {
    const session = await unsealData<SessionData>(cookie.value, SESSION_OPTIONS);
    if (!session.userId) return null;
    return session;
  } catch {
    return null;
  }
}

/** Get a full session (with familyId + memberId). Returns null if not fully resolved. */
export async function getFullSession(): Promise<FullSessionData | null> {
  const session = await getSession();
  if (!session || !isFullSession(session)) return null;
  return session;
}

// ─── Session Write ──────────────────────────────────────────────────────────

/** Create a user-level session (after email/password or OAuth login). */
export async function setUserSession(
  userId: string,
  rememberMe: boolean = false
): Promise<void> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const ttl = rememberMe ? REMEMBER_ME_TTL : DEFAULT_TTL;

  const data: SessionData = { userId, sessionToken };
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
      userId,
      sessionToken,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
  });
}

/**
 * Select a family and auto-resolve member if the user is linked.
 * Returns the resolved memberId and role, or null if not linked (needs profile selection).
 */
export async function selectFamily(
  familyId: string
): Promise<{ memberId: string; role: "ADMIN" | "MEMBER" } | null> {
  const current = await getSession();
  if (!current?.userId) throw new Error("No user session to select family");

  // Check if user has a linked member in this family
  const member = await db.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: current.userId } },
    select: { id: true, role: true },
  });

  const sessionToken = current.sessionToken || crypto.randomBytes(32).toString("hex");
  const ttl = DEFAULT_TTL;

  let data: SessionData;

  if (member) {
    // Auto-resolve: user is linked to a member in this family
    data = {
      userId: current.userId,
      familyId,
      memberId: member.id,
      role: member.role,
      sessionToken,
    };
  } else {
    // User is not linked → needs profile selection
    data = {
      userId: current.userId,
      familyId,
      sessionToken,
    };
  }

  const sealed = await sealData(data, { ...SESSION_OPTIONS, ttl });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });

  // Update active session tracking
  if (current.sessionToken) {
    await db.activeSession.updateMany({
      where: { sessionToken: current.sessionToken },
      data: { familyId, memberId: member?.id ?? null },
    });
  }

  return member ? { memberId: member.id, role: member.role } : null;
}

/** Upgrade a family session to a full session (after profile + PIN selection). */
export async function upgradeSession(
  memberId: string,
  role: "ADMIN" | "MEMBER"
): Promise<void> {
  const current = await getSession();
  if (!current?.userId || !current?.familyId) throw new Error("No family session to upgrade");

  const sessionToken = current.sessionToken || crypto.randomBytes(32).toString("hex");
  const ttl = DEFAULT_TTL;

  const data: FullSessionData = {
    userId: current.userId,
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

/** Downgrade to family-level (remove memberId + role, keep familyId). */
export async function downgradeToFamily(): Promise<void> {
  const current = await getSession();
  if (!current?.userId || !current?.familyId) throw new Error("No session to downgrade");

  const ttl = DEFAULT_TTL;
  const data: SessionData = {
    userId: current.userId,
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

/** Downgrade to user-level (remove familyId + memberId + role). */
export async function downgradeToUser(): Promise<void> {
  const current = await getSession();
  if (!current?.userId) throw new Error("No session to downgrade");

  const ttl = DEFAULT_TTL;
  const data: SessionData = {
    userId: current.userId,
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

  // Remove familyId + memberId from active session tracking
  if (current.sessionToken) {
    await db.activeSession.updateMany({
      where: { sessionToken: current.sessionToken },
      data: { familyId: null, memberId: null },
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
