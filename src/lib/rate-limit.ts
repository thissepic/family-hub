import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from "rate-limiter-flexible";
import IORedis from "ioredis";

// ─── Redis Connection ───────────────────────────────────────────────────────

let redisClient: IORedis | null = null;

function getRedis(): IORedis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Security] REDIS_URL not configured in production – rate limiting uses in-memory fallback (ineffective across multiple processes)");
    }
    return null;
  }

  try {
    redisClient = new IORedis(url, { maxRetriesPerRequest: null });
    return redisClient;
  } catch {
    if (process.env.NODE_ENV === "production") {
      console.error("[Security] Redis connection failed in production – rate limiting uses in-memory fallback");
    }
    return null;
  }
}

// ─── Rate Limiters ──────────────────────────────────────────────────────────

const LOGIN_MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_LOGIN_ATTEMPTS || "5", 10);
const LOGIN_WINDOW_SEC = parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW || "900", 10); // 15 min
const LOCKOUT_THRESHOLD = parseInt(process.env.ACCOUNT_LOCKOUT_THRESHOLD || "10", 10);
const LOCKOUT_DURATION_SEC = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION || "3600", 10); // 1 hour
const API_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_API_REQUESTS || "100", 10);
const API_WINDOW_SEC = parseInt(process.env.RATE_LIMIT_API_WINDOW || "60", 10); // 1 min
const REGISTER_MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_REGISTER_ATTEMPTS || "3", 10);
const REGISTER_WINDOW_SEC = parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || "3600", 10); // 1 hour
const PIN_MAX_ATTEMPTS = 5;
const PIN_WINDOW_SEC = 900; // 15 min lockout after 5 failed PIN attempts
const PASSWORD_RESET_MAX = 3;
const PASSWORD_RESET_WINDOW_SEC = 3600; // 1 hour
const VERIFICATION_RESEND_MAX = 3;
const VERIFICATION_RESEND_WINDOW_SEC = 3600; // 1 hour
const TOTP_MAX_ATTEMPTS = 5;
const TOTP_WINDOW_SEC = 900; // 15 min
const OAUTH_MAX_ATTEMPTS = 10;
const OAUTH_WINDOW_SEC = 900; // 15 min
const UPLOAD_MAX_ATTEMPTS = 20;
const UPLOAD_WINDOW_SEC = 3600; // 1 hour

let loginLimiter: RateLimiterAbstract | null = null;
let accountLockoutLimiter: RateLimiterAbstract | null = null;
let apiLimiter: RateLimiterAbstract | null = null;
let registrationLimiter: RateLimiterAbstract | null = null;
let pinLimiter: RateLimiterAbstract | null = null;
let passwordResetLimiter: RateLimiterAbstract | null = null;
let verificationResendLimiter: RateLimiterAbstract | null = null;
let totpLimiter: RateLimiterAbstract | null = null;
let oauthLimiter: RateLimiterAbstract | null = null;
let uploadLimiter: RateLimiterAbstract | null = null;

function getLoginLimiter(): RateLimiterAbstract {
  if (loginLimiter) return loginLimiter;
  const redis = getRedis();

  if (redis) {
    loginLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:login:ip",
      points: LOGIN_MAX_ATTEMPTS,
      duration: LOGIN_WINDOW_SEC,
    });
  } else {
    loginLimiter = new RateLimiterMemory({
      keyPrefix: "rl:login:ip",
      points: LOGIN_MAX_ATTEMPTS,
      duration: LOGIN_WINDOW_SEC,
    });
  }
  return loginLimiter;
}

function getAccountLockoutLimiter(): RateLimiterAbstract {
  if (accountLockoutLimiter) return accountLockoutLimiter;
  const redis = getRedis();

  if (redis) {
    accountLockoutLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:lockout:email",
      points: LOCKOUT_THRESHOLD,
      duration: LOCKOUT_DURATION_SEC,
    });
  } else {
    accountLockoutLimiter = new RateLimiterMemory({
      keyPrefix: "rl:lockout:email",
      points: LOCKOUT_THRESHOLD,
      duration: LOCKOUT_DURATION_SEC,
    });
  }
  return accountLockoutLimiter;
}

function getApiLimiter(): RateLimiterAbstract {
  if (apiLimiter) return apiLimiter;
  const redis = getRedis();

  if (redis) {
    apiLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:api",
      points: API_MAX_REQUESTS,
      duration: API_WINDOW_SEC,
    });
  } else {
    apiLimiter = new RateLimiterMemory({
      keyPrefix: "rl:api",
      points: API_MAX_REQUESTS,
      duration: API_WINDOW_SEC,
    });
  }
  return apiLimiter;
}

function getRegistrationLimiter(): RateLimiterAbstract {
  if (registrationLimiter) return registrationLimiter;
  const redis = getRedis();

  if (redis) {
    registrationLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:register:ip",
      points: REGISTER_MAX_ATTEMPTS,
      duration: REGISTER_WINDOW_SEC,
    });
  } else {
    registrationLimiter = new RateLimiterMemory({
      keyPrefix: "rl:register:ip",
      points: REGISTER_MAX_ATTEMPTS,
      duration: REGISTER_WINDOW_SEC,
    });
  }
  return registrationLimiter;
}

function getPinLimiter(): RateLimiterAbstract {
  if (pinLimiter) return pinLimiter;
  const redis = getRedis();

  if (redis) {
    pinLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:pin",
      points: PIN_MAX_ATTEMPTS,
      duration: PIN_WINDOW_SEC,
    });
  } else {
    pinLimiter = new RateLimiterMemory({
      keyPrefix: "rl:pin",
      points: PIN_MAX_ATTEMPTS,
      duration: PIN_WINDOW_SEC,
    });
  }
  return pinLimiter;
}

function getPasswordResetLimiter(): RateLimiterAbstract {
  if (passwordResetLimiter) return passwordResetLimiter;
  const redis = getRedis();

  if (redis) {
    passwordResetLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:pwreset:email",
      points: PASSWORD_RESET_MAX,
      duration: PASSWORD_RESET_WINDOW_SEC,
    });
  } else {
    passwordResetLimiter = new RateLimiterMemory({
      keyPrefix: "rl:pwreset:email",
      points: PASSWORD_RESET_MAX,
      duration: PASSWORD_RESET_WINDOW_SEC,
    });
  }
  return passwordResetLimiter;
}

function getVerificationResendLimiter(): RateLimiterAbstract {
  if (verificationResendLimiter) return verificationResendLimiter;
  const redis = getRedis();

  if (redis) {
    verificationResendLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:verify:resend",
      points: VERIFICATION_RESEND_MAX,
      duration: VERIFICATION_RESEND_WINDOW_SEC,
    });
  } else {
    verificationResendLimiter = new RateLimiterMemory({
      keyPrefix: "rl:verify:resend",
      points: VERIFICATION_RESEND_MAX,
      duration: VERIFICATION_RESEND_WINDOW_SEC,
    });
  }
  return verificationResendLimiter;
}

function getTotpLimiter(): RateLimiterAbstract {
  if (totpLimiter) return totpLimiter;
  const redis = getRedis();

  if (redis) {
    totpLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:totp",
      points: TOTP_MAX_ATTEMPTS,
      duration: TOTP_WINDOW_SEC,
    });
  } else {
    totpLimiter = new RateLimiterMemory({
      keyPrefix: "rl:totp",
      points: TOTP_MAX_ATTEMPTS,
      duration: TOTP_WINDOW_SEC,
    });
  }
  return totpLimiter;
}

function getOAuthLimiter(): RateLimiterAbstract {
  if (oauthLimiter) return oauthLimiter;
  const redis = getRedis();

  if (redis) {
    oauthLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:oauth:ip",
      points: OAUTH_MAX_ATTEMPTS,
      duration: OAUTH_WINDOW_SEC,
    });
  } else {
    oauthLimiter = new RateLimiterMemory({
      keyPrefix: "rl:oauth:ip",
      points: OAUTH_MAX_ATTEMPTS,
      duration: OAUTH_WINDOW_SEC,
    });
  }
  return oauthLimiter;
}

function getUploadLimiter(): RateLimiterAbstract {
  if (uploadLimiter) return uploadLimiter;
  const redis = getRedis();

  if (redis) {
    uploadLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:upload",
      points: UPLOAD_MAX_ATTEMPTS,
      duration: UPLOAD_WINDOW_SEC,
    });
  } else {
    uploadLimiter = new RateLimiterMemory({
      keyPrefix: "rl:upload",
      points: UPLOAD_MAX_ATTEMPTS,
      duration: UPLOAD_WINDOW_SEC,
    });
  }
  return uploadLimiter;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Check if IP is rate-limited for login attempts. Throws if blocked. */
export async function checkLoginRateLimit(ip: string): Promise<void> {
  try {
    await getLoginLimiter().consume(ip);
  } catch {
    throw new Error("TOO_MANY_REQUESTS");
  }
}

/** Check if an account (by email) is locked out. Throws if locked. */
export async function checkAccountLockout(email: string): Promise<void> {
  try {
    const res = await getAccountLockoutLimiter().get(email);
    if (res && res.consumedPoints >= LOCKOUT_THRESHOLD) {
      throw new Error("ACCOUNT_LOCKED");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "ACCOUNT_LOCKED") throw err;
    // If rate limiter fails, don't block the user
  }
}

/** Record a failed login attempt for account lockout tracking. */
export async function recordFailedLogin(email: string): Promise<void> {
  try {
    await getAccountLockoutLimiter().consume(email);
  } catch {
    // Account is now locked - this is fine, error is thrown on next check
  }
}

/** Reset lockout counter on successful login. */
export async function resetLoginCounters(ip: string, email: string): Promise<void> {
  try {
    await getLoginLimiter().delete(ip);
    await getAccountLockoutLimiter().delete(email);
  } catch {
    // Non-critical, ignore
  }
}

/** Check API rate limit for a session or IP. Throws if blocked. */
export async function checkApiRateLimit(key: string): Promise<void> {
  try {
    await getApiLimiter().consume(key);
  } catch {
    throw new Error("TOO_MANY_REQUESTS");
  }
}

/** Check if IP is rate-limited for registration attempts. Throws if blocked. */
export async function checkRegistrationRateLimit(ip: string): Promise<void> {
  try {
    await getRegistrationLimiter().consume(ip);
  } catch {
    throw new Error("TOO_MANY_REQUESTS");
  }
}

/** Check PIN attempt rate limit. Key should be familyId:memberId. Throws if blocked. */
export async function checkPinRateLimit(key: string): Promise<void> {
  try {
    await getPinLimiter().consume(key);
  } catch {
    throw new Error("TOO_MANY_PIN_ATTEMPTS");
  }
}

/** Reset PIN rate limit counter on successful PIN entry. */
export async function resetPinRateLimit(key: string): Promise<void> {
  try {
    await getPinLimiter().delete(key);
  } catch {
    // Non-critical, ignore
  }
}

/** Check rate limit for password reset requests. Throws if blocked. */
export async function checkPasswordResetRateLimit(email: string): Promise<void> {
  try {
    await getPasswordResetLimiter().consume(email);
  } catch {
    throw new Error("TOO_MANY_REQUESTS");
  }
}

/** Check rate limit for verification email resend. Throws if blocked. */
export async function checkVerificationResendRateLimit(familyId: string): Promise<void> {
  try {
    await getVerificationResendLimiter().consume(familyId);
  } catch {
    throw new Error("TOO_MANY_REQUESTS");
  }
}

/** Check TOTP verification rate limit. Throws if blocked. */
export async function checkTotpRateLimit(key: string): Promise<void> {
  try {
    await getTotpLimiter().consume(key);
  } catch {
    throw new Error("TOO_MANY_TOTP_ATTEMPTS");
  }
}

/** Reset TOTP rate limit counter on success. */
export async function resetTotpRateLimit(key: string): Promise<void> {
  try {
    await getTotpLimiter().delete(key);
  } catch {
    // Non-critical, ignore
  }
}

/** Check OAuth initiation rate limit by IP. Throws if blocked. */
export async function checkOAuthRateLimit(ip: string): Promise<void> {
  try {
    await getOAuthLimiter().consume(ip);
  } catch {
    throw new Error("TOO_MANY_REQUESTS");
  }
}

/** Check file upload rate limit by memberId. Throws if blocked. */
export async function checkUploadRateLimit(memberId: string): Promise<void> {
  try {
    await getUploadLimiter().consume(memberId);
  } catch {
    throw new Error("TOO_MANY_UPLOADS");
  }
}
