import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { accountToFriendSnapshot, createId } from "./engine";
import { DEFAULT_ABILITY, type AbilityMap, type Attempt, type FriendSnapshot, type UserProfile } from "./types";
import { kvCommand, kvGetJson, kvSetJson, kvSetJsonEx } from "./server-kv";

type CloudAccount = {
  profile: UserProfile;
  passwordHash: string;
  salt: string;
};

type CloudSession = {
  profileId: string;
  createdAt: string;
};

const sessionTtlSeconds = 60 * 60 * 24 * 30;

function hashPassword(password: string, salt = randomBytes(16).toString("base64")) {
  const hash = pbkdf2Sync(password, salt, 150000, 32, "sha256").toString("base64");
  return { salt, hash };
}

function verifyPassword(account: CloudAccount, password: string) {
  const candidate = hashPassword(password, account.salt).hash;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(account.passwordHash));
}

function emailKey(email: string) {
  return `email:${email.trim().toLowerCase()}`;
}

function profileKey(profileId: string) {
  return `profile:${profileId}`;
}

function sessionKey(token: string) {
  return `session:${token}`;
}

function friendCodeKey(code: string) {
  return `friend-code:${code.toUpperCase()}`;
}

function friendsKey(profileId: string) {
  return `friends:${profileId}`;
}

function attemptsKey(profileId: string) {
  return `attempts:${profileId}`;
}

function abilityKey(profileId: string) {
  return `ability:${profileId}`;
}

export async function createCloudAccount({
  displayName,
  email,
  password,
  targetScore,
}: {
  displayName: string;
  email: string;
  password: string;
  targetScore: number;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await kvCommand<string | null>("GET", emailKey(normalizedEmail));
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const id = createId("profile");
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id,
    displayName: displayName.trim(),
    email: normalizedEmail,
    friendCode: id.replace("profile-", "").slice(0, 8).toUpperCase(),
    avatarColor: ["#1f6f67", "#bd7b22", "#b44b3f", "#24754f", "#5f5b9c"][Math.floor(Math.random() * 5)],
    targetScore,
    createdAt: now,
    lastLoginAt: now,
  };
  const { salt, hash } = hashPassword(password);
  const account: CloudAccount = { profile, passwordHash: hash, salt };

  await kvSetJson(profileKey(id), account);
  await kvCommand<"OK">("SET", emailKey(normalizedEmail), id);
  await kvCommand<"OK">("SET", friendCodeKey(profile.friendCode), id);
  await kvSetJson(abilityKey(id), DEFAULT_ABILITY);

  return startCloudSession(account);
}

export async function loginCloudAccount(email: string, password: string) {
  const profileId = await kvCommand<string | null>("GET", emailKey(email.trim().toLowerCase()));
  if (!profileId) {
    throw new Error("Email or password is incorrect.");
  }

  const account = await kvGetJson<CloudAccount>(profileKey(profileId));
  if (!account || !verifyPassword(account, password)) {
    throw new Error("Email or password is incorrect.");
  }

  account.profile.lastLoginAt = new Date().toISOString();
  await kvSetJson(profileKey(profileId), account);
  return startCloudSession(account);
}

export async function getAccountForToken(token: string) {
  const session = await kvGetJson<CloudSession>(sessionKey(token));
  if (!session) {
    throw new Error("Session expired. Please log in again.");
  }

  const account = await kvGetJson<CloudAccount>(profileKey(session.profileId));
  if (!account) {
    throw new Error("Account not found.");
  }

  return account;
}

export async function startCloudSession(account: CloudAccount) {
  const token = randomBytes(32).toString("base64url");
  await kvSetJsonEx(sessionKey(token), sessionTtlSeconds, {
    profileId: account.profile.id,
    createdAt: new Date().toISOString(),
  });

  return {
    token,
    profile: account.profile,
    friends: await getFriendLeaderboard(account.profile.id),
    ability: (await kvGetJson<AbilityMap>(abilityKey(account.profile.id))) ?? DEFAULT_ABILITY,
  };
}

export async function addFriendByCode(profileId: string, friendCode: string) {
  const friendId = await kvCommand<string | null>("GET", friendCodeKey(friendCode.trim().toUpperCase()));
  if (!friendId) {
    throw new Error("No account found for that friend code.");
  }
  if (friendId === profileId) {
    throw new Error("That is your own friend code.");
  }

  await kvCommand<number>("SADD", friendsKey(profileId), friendId);
  await kvCommand<number>("SADD", friendsKey(friendId), profileId);
  return getFriendLeaderboard(profileId);
}

export async function saveCloudProgress(profileId: string, attempt: Attempt, ability: AbilityMap) {
  await kvCommand<number>("LPUSH", attemptsKey(profileId), JSON.stringify({ ...attempt, profileId }));
  await kvCommand<"OK">("LTRIM", attemptsKey(profileId), 0, 199);
  await kvSetJson(abilityKey(profileId), ability);
}

export async function getFriendLeaderboard(profileId: string): Promise<FriendSnapshot[]> {
  const friendIds = await kvCommand<string[]>("SMEMBERS", friendsKey(profileId));
  const ids = [profileId, ...(friendIds ?? [])];
  const rows = await Promise.all(ids.map((id) => getFriendSnapshot(id)));
  return rows
    .filter((row): row is FriendSnapshot => Boolean(row))
    .sort((a, b) => {
      if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays;
      if (b.sessions !== a.sessions) return b.sessions - a.sessions;
      return b.currentScore - a.currentScore;
    });
}

async function getFriendSnapshot(profileId: string): Promise<FriendSnapshot | null> {
  const account = await kvGetJson<CloudAccount>(profileKey(profileId));
  if (!account) {
    return null;
  }

  const attemptStrings = await kvCommand<string[]>("LRANGE", attemptsKey(profileId), 0, 199);
  const attempts = (attemptStrings ?? []).map((value) => JSON.parse(value) as Attempt);
  return accountToFriendSnapshot(
    {
      profile: account.profile,
      passwordHash: account.passwordHash,
      salt: account.salt,
      friends: [],
    },
    attempts,
  );
}
