import {
  DEFAULT_ABILITY,
  SECTION_BY_ID,
  type AccountRecord,
  type AbilityMap,
  type Attempt,
  type FriendSnapshot,
  type Question,
  type ResponseRecord,
  type SectionId,
  type SectionScore,
} from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function mergeQuestions(current: Question[], incoming: Question[]) {
  const byId = new Map(current.map((question) => [question.id, question]));
  for (const question of incoming) {
    byId.set(question.id, question);
  }
  return Array.from(byId.values());
}

function deterministicShuffle<T>(items: T[], seed: string) {
  const next = [...items];
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  for (let index = next.length - 1; index > 0; index -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const swapIndex = hash % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

export function selectSectionQuestions(
  allQuestions: Question[],
  section: SectionId,
  count: number,
  ability: number,
  seed: string,
) {
  const pool = allQuestions.filter((question) => question.section === section);
  const shuffled = deterministicShuffle(pool, `${seed}-${section}`);
  const sorted = shuffled.sort((a, b) => {
    const distanceA = Math.abs(a.difficulty - ability);
    const distanceB = Math.abs(b.difficulty - ability);
    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }
    return b.difficulty - a.difficulty;
  });

  if (sorted.length >= count) {
    return sorted.slice(0, count);
  }

  const filled = [...sorted];
  let cursor = 0;
  while (filled.length < count && sorted.length > 0) {
    filled.push(sorted[cursor % sorted.length]);
    cursor += 1;
  }
  return filled;
}

export function nextAbility(current: number, response: ResponseRecord) {
  const difficultyGap = response.difficulty - current;
  const correctDelta = 0.24 + Math.max(0, difficultyGap) * 0.08;
  const wrongDelta = 0.22 + Math.max(0, -difficultyGap) * 0.06;
  return clamp(current + (response.isCorrect ? correctDelta : -wrongDelta), 1, 5);
}

export function updateAbilityMap(ability: AbilityMap, responses: ResponseRecord[]) {
  const updated = { ...ability };
  for (const response of responses) {
    updated[response.section] = nextAbility(updated[response.section], response);
  }
  return updated;
}

export function scoreSection(section: SectionId, responses: ResponseRecord[]): SectionScore {
  const relevant = responses.filter((response) => response.section === section);
  const correct = relevant.filter((response) => response.isCorrect).length;
  const total = relevant.length;
  const accuracy = total ? correct / total : 0;
  const averageDifficulty =
    total ? relevant.reduce((sum, response) => sum + response.difficulty, 0) / total : 0;
  const averageSeconds =
    total ? relevant.reduce((sum, response) => sum + response.timeSpentSeconds, 0) / total : 0;
  const weighted =
    total === 0
      ? 0
      : relevant.reduce(
          (sum, response) =>
            sum + (response.isCorrect ? 1 : 0) * (0.72 + response.difficulty * 0.12),
          0,
        ) / total;

  return {
    section,
    correct,
    total,
    accuracy,
    averageDifficulty,
    averageSeconds,
    estimatedScore: Math.round(clamp(60 + weighted * 25, 60, 90)),
  };
}

export function buildAttempt(
  mode: Attempt["mode"],
  startedAt: string,
  sectionOrder: SectionId[],
  responses: ResponseRecord[],
  profileId?: string,
): Attempt {
  const completedAt = new Date().toISOString();
  const sectionScores = sectionOrder.map((section) => scoreSection(section, responses));
  const totalCorrect = responses.filter((response) => response.isCorrect).length;
  const totalQuestions = responses.length;
  const weightedAverage =
    sectionScores.reduce((sum, section) => sum + (section.estimatedScore - 60) / 30, 0) /
    Math.max(sectionScores.length, 1);
  const estimatedTotalScore = 205 + Math.round(clamp(weightedAverage, 0, 1) * 60) * 10;

  return {
    id: createId("attempt"),
    profileId,
    mode,
    startedAt,
    completedAt,
    sectionOrder,
    responses,
    sectionScores,
    totalCorrect,
    totalQuestions,
    estimatedTotalScore,
  };
}

export function questionCountForMode(mode: "practice" | "mock", section: SectionId) {
  return mode === "mock" ? SECTION_BY_ID[section].questionCount : 10;
}

export function durationForMode(mode: "practice" | "mock", section: SectionId) {
  return mode === "mock" ? SECTION_BY_ID[section].durationSeconds : 18 * 60;
}

export function initialAbility(): AbilityMap {
  return { ...DEFAULT_ABILITY };
}

export function computeStreakDays(attempts: Attempt[]) {
  const daySet = new Set(attempts.map((attempt) => attempt.completedAt.slice(0, 10)));
  if (daySet.size === 0) {
    return 0;
  }

  const cursor = new Date();
  let streak = 0;

  if (!daySet.has(todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (daySet.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function profileStats(profileId: string, attempts: Attempt[]) {
  const profileAttempts = attempts.filter((attempt) => attempt.profileId === profileId);
  const latest = profileAttempts[0];
  const bestScore = profileAttempts.length
    ? Math.max(...profileAttempts.map((attempt) => attempt.estimatedTotalScore))
    : 0;

  return {
    sessions: profileAttempts.length,
    streakDays: computeStreakDays(profileAttempts),
    bestScore,
    currentScore: latest?.estimatedTotalScore ?? 0,
    lastActiveAt: latest?.completedAt ?? "",
  };
}

export function accountToFriendSnapshot(account: AccountRecord, attempts: Attempt[]): FriendSnapshot {
  return {
    id: account.profile.id,
    displayName: account.profile.displayName,
    friendCode: account.profile.friendCode,
    avatarColor: account.profile.avatarColor,
    ...profileStats(account.profile.id, attempts),
  };
}
