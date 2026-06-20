import { createId } from "./engine";
import type { AccountRecord, UserProfile } from "./types";

const encoder = new TextEncoder();
const avatarColors = ["#1f6f67", "#bd7b22", "#b44b3f", "#24754f", "#5f5b9c", "#7a4f2a"];

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
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
      salt,
      iterations: 150000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

export async function createAccount(
  displayName: string,
  email: string,
  password: string,
  targetScore: number,
): Promise<AccountRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const id = createId("profile");
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id,
    displayName: displayName.trim(),
    email: email.trim().toLowerCase(),
    friendCode: id.replace("profile-", "").slice(0, 8).toUpperCase(),
    avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
    targetScore,
    createdAt: now,
    lastLoginAt: now,
  };

  return {
    profile,
    passwordHash: await derivePasswordHash(password, salt),
    salt: bytesToBase64(salt),
    friends: [],
  };
}

export async function verifyPassword(account: AccountRecord, password: string) {
  const hash = await derivePasswordHash(password, base64ToBytes(account.salt));
  return hash === account.passwordHash;
}

export function sanitizeEmail(email: string) {
  return email.trim().toLowerCase();
}
