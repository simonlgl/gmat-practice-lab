import { createId } from "./engine";
import type { AccountRecord, UserProfile } from "./types";

const encoder = new TextEncoder();
const avatarColors = ["#1f6f67", "#bd7b22", "#b44b3f", "#24754f", "#5f5b9c", "#7a4f2a"];
const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const saltBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 150000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function randomSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function generateRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = Array.from(bytes, (byte) => recoveryAlphabet[byte % recoveryAlphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function hashSecret(secret: string, salt = randomSalt()) {
  return {
    salt: bytesToBase64(salt),
    hash: await derivePasswordHash(secret.trim().toUpperCase(), salt),
  };
}

export async function createAccount(
  displayName: string,
  email: string,
  password: string,
  targetScore: number,
): Promise<AccountRecord & { recoveryCode: string }> {
  const salt = randomSalt();
  const recoveryCode = generateRecoveryCode();
  const recovery = await hashSecret(recoveryCode);
  const id = createId("profile");
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id,
    displayName: displayName.trim(),
    email: email.trim().toLowerCase(),
    friendCode: id.replace("profile-", "").slice(0, 8).toUpperCase(),
    avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
    targetScore,
    dailyQuestionGoal: 20,
    weeklySessionGoal: 5,
    showScoreToFriends: true,
    remindersEnabled: false,
    reminderHour: 18,
    createdAt: now,
    lastLoginAt: now,
  };

  return {
    profile,
    passwordHash: await derivePasswordHash(password, salt),
    salt: bytesToBase64(salt),
    recoveryHash: recovery.hash,
    recoverySalt: recovery.salt,
    recoveryCode,
    friends: [],
  };
}

export async function verifyPassword(account: AccountRecord, password: string) {
  const hash = await derivePasswordHash(password, base64ToBytes(account.salt));
  return hash === account.passwordHash;
}

export async function verifyRecoveryCode(account: AccountRecord, recoveryCode: string) {
  if (!account.recoveryHash || !account.recoverySalt) {
    return false;
  }

  const hash = await derivePasswordHash(
    recoveryCode.trim().toUpperCase(),
    base64ToBytes(account.recoverySalt),
  );
  return hash === account.recoveryHash;
}

export async function updateLocalPassword(
  account: AccountRecord,
  password: string,
): Promise<AccountRecord & { recoveryCode: string }> {
  const passwordSalt = randomSalt();
  const recoveryCode = generateRecoveryCode();
  const recovery = await hashSecret(recoveryCode);

  return {
    ...account,
    passwordHash: await derivePasswordHash(password, passwordSalt),
    salt: bytesToBase64(passwordSalt),
    recoveryHash: recovery.hash,
    recoverySalt: recovery.salt,
    recoveryCode,
  };
}

export function sanitizeEmail(email: string) {
  return email.trim().toLowerCase();
}
