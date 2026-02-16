import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { encryptToken, decryptToken } from "@/lib/calendar-sync/encryption";

const APP_NAME = "Family Hub";
const RECOVERY_CODE_COUNT = 10;

// ─── TOTP Secret ────────────────────────────────────────────────────────────

/** Generate a new TOTP secret. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** Encrypt a TOTP secret for database storage using AES-256-GCM. */
export function encryptTotpSecret(secret: string): string {
  return encryptToken(secret);
}

/** Decrypt a TOTP secret from database storage. */
export function decryptTotpSecret(encrypted: string): string {
  return decryptToken(encrypted);
}

// ─── QR Code & URI ──────────────────────────────────────────────────────────

/** Generate an otpauth:// URI for authenticator apps. */
export function generateTotpUri(secret: string, email: string): string {
  return generateURI({ issuer: APP_NAME, label: email, secret });
}

/** Generate a QR code data URL for the otpauth URI. */
export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

// ─── TOTP Verification ──────────────────────────────────────────────────────

/** Verify a TOTP code against a secret. Allows ±1 time step window. */
export function verifyTotpCode(code: string, secret: string): boolean {
  const result = verifySync({ secret, token: code });
  return result.valid;
}

// ─── Recovery Codes ─────────────────────────────────────────────────────────

/** Generate recovery codes. Returns plain-text and bcrypt-hashed versions. */
export async function generateRecoveryCodes(): Promise<{
  plain: string[];
  hashed: string[];
}> {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const bytes = crypto.randomBytes(4);
    const code = bytes.toString("hex").toUpperCase();
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    plain.push(formatted);
    hashed.push(await bcrypt.hash(formatted, 10));
  }

  return { plain, hashed };
}

/** Check a submitted code against hashed recovery codes.
 *  Returns the ID of the matching code, or null if no match. */
export async function matchRecoveryCode(
  submitted: string,
  hashedCodes: { id: string; codeHash: string; usedAt: Date | null }[]
): Promise<string | null> {
  const normalized = submitted.toUpperCase().replace(/[\s-]/g, "");
  const formatted = normalized.length === 8
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;

  for (const entry of hashedCodes) {
    if (entry.usedAt) continue;
    if (await bcrypt.compare(formatted, entry.codeHash)) {
      return entry.id;
    }
  }
  return null;
}
