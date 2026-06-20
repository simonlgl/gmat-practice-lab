"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  accountToFriendSnapshot,
  buildAttempt,
  computeStreakDays,
  createId,
  durationForMode,
  formatClock,
  initialAbility,
  isAttemptThisWeek,
  mergeQuestions,
  questionCountForMode,
  selectSectionQuestions,
  updateAbilityMap,
} from "@/lib/engine";
import { createAccount, sanitizeEmail, updateLocalPassword, verifyPassword, verifyRecoveryCode } from "@/lib/auth";
import type {
  CloudAuthResponse,
  CloudFriendsResponse,
  CloudProfileResponse,
  CloudProgressPayload,
  CloudSnapshotResponse,
} from "@/lib/cloud-types";
import { createStarterQuestions, DIFFICULTIES, QUESTION_TYPES_BY_SECTION } from "@/lib/question-bank";
import { loadPersistedState, savePersistedState } from "@/lib/storage";
import {
  DEFAULT_ABILITY,
  SECTION_BY_ID,
  SECTIONS,
  type AbilityMap,
  type AccountRecord,
  type AppPersistedState,
  type Attempt,
  type Difficulty,
  type FriendSnapshot,
  type Question,
  type QuestionType,
  type ResponseRecord,
  type SectionId,
} from "@/lib/types";

type View =
  | "dashboard"
  | "friends"
  | "practice"
  | "mock"
  | "analytics"
  | "studio"
  | "library"
  | "results";
type AuthMode = "login" | "signup" | "reset";
type SessionStatus = "question" | "feedback" | "review" | "break";

type ActiveSession = {
  id: string;
  mode: "practice" | "mock";
  aiInfinite: boolean;
  startedAt: string;
  sectionOrder: SectionId[];
  currentSectionIndex: number;
  questionIndex: number;
  status: SessionStatus;
  questionsBySection: Record<SectionId, Question[]>;
  responsesByQuestionId: Record<string, ResponseRecord>;
  bookmarkedIds: Record<string, boolean>;
  remainingBySection: Record<SectionId, number>;
  editsUsed: Record<SectionId, number>;
  reviewing: boolean;
  breakRemainingSeconds: number | null;
  breakTaken: boolean;
};

type StudioDraft = {
  section: SectionId;
  type: QuestionType;
  topic: string;
  difficulty: Difficulty;
};

const starterQuestions = createStarterQuestions();

const tabItems: Array<{ view: View; label: string; symbol: string }> = [
  { view: "dashboard", label: "Dashboard", symbol: "⌂" },
  { view: "friends", label: "Friends", symbol: "♕" },
  { view: "practice", label: "Practice", symbol: "▶" },
  { view: "mock", label: "Mock Exam", symbol: "◷" },
  { view: "analytics", label: "Analytics", symbol: "▦" },
  { view: "studio", label: "Question Studio", symbol: "+" },
  { view: "library", label: "Library", symbol: "≡" },
];

const emptyAuthForm = {
  displayName: "",
  email: "",
  password: "",
  recoveryCode: "",
  targetScore: 655,
};

function blankQuestionMap(): Record<SectionId, Question[]> {
  return { quant: [], verbal: [], data: [] };
}

function blankSeconds(mode: "practice" | "mock", sections: SectionId[]) {
  return SECTIONS.reduce(
    (acc, section) => {
      acc[section.id] = sections.includes(section.id) ? durationForMode(mode, section.id) : 0;
      return acc;
    },
    { quant: 0, verbal: 0, data: 0 } as Record<SectionId, number>,
  );
}

function sectionName(section: SectionId) {
  return SECTION_BY_ID[section].label;
}

function normalizeImportedQuestion(question: Question): Question | null {
  if (
    !question ||
    !question.id ||
    !["quant", "verbal", "data"].includes(question.section) ||
    !Array.isArray(question.choices) ||
    question.choices.length < 2 ||
    typeof question.correctChoice !== "number"
  ) {
    return null;
  }

  return {
    ...question,
    difficulty: Math.min(Math.max(Number(question.difficulty) || 3, 1), 5) as Difficulty,
    source: question.source === "ai" ? "ai" : "imported",
    tags: Array.isArray(question.tags) ? question.tags : [],
    estimatedTimeSeconds: Number(question.estimatedTimeSeconds) || 120,
  };
}

function createEmptyResponsesForSection(session: ActiveSession, section: SectionId) {
  const nextResponses = { ...session.responsesByQuestionId };
  const questions = session.questionsBySection[section];

  for (const question of questions) {
    if (!nextResponses[question.id]) {
      nextResponses[question.id] = {
        questionId: question.id,
        section,
        selectedChoice: null,
        correctChoice: question.correctChoice,
        isCorrect: false,
        timeSpentSeconds: 0,
        difficulty: question.difficulty,
        topic: question.topic,
        type: question.type,
        bookmarked: Boolean(session.bookmarkedIds[question.id]),
        edited: false,
        position: questions.findIndex((candidate) => candidate.id === question.id) + 1,
        answeredAt: new Date().toISOString(),
      };
    }
  }

  return nextResponses;
}

function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

function currentMillis() {
  return new Date().getTime();
}

function profileWithDefaults(profile: AccountRecord["profile"]) {
  return {
    ...profile,
    dailyQuestionGoal: profile.dailyQuestionGoal ?? 20,
    weeklySessionGoal: profile.weeklySessionGoal ?? 5,
    showScoreToFriends: profile.showScoreToFriends ?? true,
    remindersEnabled: profile.remindersEnabled ?? false,
    reminderHour: profile.reminderHour ?? 18,
  };
}

function normalizeFriendSnapshot(friend: FriendSnapshot): FriendSnapshot {
  return {
    ...friend,
    sessionsThisWeek: friend.sessionsThisWeek ?? 0,
    questionsThisWeek: friend.questionsThisWeek ?? 0,
    scoreVisible: friend.scoreVisible ?? true,
  };
}

function normalizeAccount(account: AccountRecord): AccountRecord {
  return {
    ...account,
    profile: profileWithDefaults(account.profile),
    friends: (account.friends ?? []).map(normalizeFriendSnapshot),
  };
}

function clampGoal(value: number, fallback: number) {
  return Math.max(1, Math.round(Number(value) || fallback));
}

function buildReminderDelay(hour: number) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export default function GmatPracticeApp() {
  const [view, setView] = useState<View>("dashboard");
  const [questions, setQuestions] = useState<Question[]>(starterQuestions);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [ability, setAbility] = useState<AbilityMap>(initialAbility());
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [cloudToken, setCloudToken] = useState<string | null>(null);
  const [cloudFriends, setCloudFriends] = useState<FriendSnapshot[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [authMessage, setAuthMessage] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [friendForm, setFriendForm] = useState({
    friendCode: "",
    displayName: "",
    currentScore: "625",
    bestScore: "645",
    sessions: "12",
    streakDays: "5",
  });
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("Loading private workspace...");
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [selectedDrafts, setSelectedDrafts] = useState<Record<string, number | null>>({});
  const questionStartedAtRef = useRef(0);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [practiceSection, setPracticeSection] = useState<SectionId>("quant");
  const [mockOrder, setMockOrder] = useState<SectionId[]>(["quant", "verbal", "data"]);
  const [importMessage, setImportMessage] = useState("");
  const [studioDraft, setStudioDraft] = useState<StudioDraft>({
    section: "quant",
    type: "Problem Solving",
    topic: "Rates and algebra",
    difficulty: 3,
  });
  const [generatedQuestion, setGeneratedQuestion] = useState<Question | null>(null);
  const [studioBusy, setStudioBusy] = useState(false);
  const [sessionAiBusy, setSessionAiBusy] = useState(false);
  const [studioMessage, setStudioMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const saved = await loadPersistedState();
        if (!alive) {
          return;
        }

        if (saved) {
          setQuestions(mergeQuestions(starterQuestions, saved.questions ?? []));
          setAttempts(saved.attempts ?? []);
          setAbility({ ...DEFAULT_ABILITY, ...(saved.ability ?? {}) });
          setAccounts((saved.accounts ?? []).map(normalizeAccount));
          setCloudToken(saved.cloudToken ?? null);
          setActiveProfileId(saved.currentProfileId ?? null);
          setAuthMode((saved.accounts ?? []).length > 0 ? "login" : "signup");
          setToast("Private progress restored from this browser.");
        } else {
          setToast("Starter question bank ready.");
        }
      } catch {
        setToast("Browser storage is unavailable, but this session still works.");
      } finally {
        if (alive) {
          setLoaded(true);
        }
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const state: AppPersistedState = {
      version: 3,
      questions,
      attempts,
      ability,
      accounts,
      currentProfileId: activeProfileId,
      cloudToken,
    };

    void savePersistedState(state);
  }, [ability, attempts, accounts, activeProfileId, cloudToken, loaded, questions]);

  const activeSection = session?.sectionOrder[session.currentSectionIndex] ?? "quant";
  const activeQuestions = session?.questionsBySection[activeSection] ?? [];
  const activeQuestion = activeQuestions[session?.questionIndex ?? 0] ?? null;
  const existingResponse = activeQuestion ? session?.responsesByQuestionId[activeQuestion.id] : null;
  const selectedChoice = activeQuestion
    ? (selectedDrafts[activeQuestion.id] ?? existingResponse?.selectedChoice ?? null)
    : null;
  const timerActive = session?.status === "question" || session?.status === "review";
  const timerKey = `${session?.id ?? "none"}-${session?.currentSectionIndex ?? 0}`;
  const breakActive = session?.status === "break" && session.breakRemainingSeconds !== null;
  const breakKey = session?.id ?? "none";

  useEffect(() => {
    if (!timerActive) {
      return;
    }

    const interval = window.setInterval(() => {
      setSession((current) => {
        if (!current || !["question", "review"].includes(current.status)) {
          return current;
        }

        const section = current.sectionOrder[current.currentSectionIndex];
        const nextRemaining = Math.max(0, current.remainingBySection[section] - 1);
        const next = {
          ...current,
          remainingBySection: {
            ...current.remainingBySection,
            [section]: nextRemaining,
          },
        };

        if (nextRemaining === 0 && current.status !== "review") {
          return {
            ...next,
            status: "review",
            reviewing: false,
            responsesByQuestionId: createEmptyResponsesForSection(next, section),
          };
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerActive, timerKey]);

  useEffect(() => {
    if (!breakActive) {
      return;
    }

    const interval = window.setInterval(() => {
      setSession((current) => {
        if (!current || current.status !== "break" || current.breakRemainingSeconds === null) {
          return current;
        }

        const nextBreak = Math.max(0, current.breakRemainingSeconds - 1);
        return { ...current, breakRemainingSeconds: nextBreak };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [breakActive, breakKey]);

  const activeAccount = accounts.find((account) => account.profile.id === activeProfileId) ?? null;
  const profileAttempts = useMemo(
    () =>
      activeProfileId
        ? attempts.filter(
            (attempt) =>
              attempt.profileId === activeProfileId ||
              (!attempt.profileId && accounts.length === 1 && accounts[0].profile.id === activeProfileId),
          )
        : [],
    [accounts, activeProfileId, attempts],
  );
  const analytics = useMemo(() => buildAnalytics(profileAttempts), [profileAttempts]);
  const leaderboard = useMemo(
    () => (cloudToken ? cloudFriends : buildLeaderboard(accounts, attempts, activeProfileId)),
    [accounts, activeProfileId, attempts, cloudFriends, cloudToken],
  );
  const reminderEnabled = Boolean(activeAccount?.profile.remindersEnabled);
  const reminderHour = activeAccount?.profile.reminderHour ?? 18;

  const refreshCloudSnapshot = useCallback(
    async (token = cloudToken) => {
      if (!token) {
        return;
      }

      try {
        const response = await fetch("/api/cloud/snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json()) as CloudSnapshotResponse;
        if (!payload.ok) {
          throw new Error(payload.error);
        }
        setCloudFriends(payload.friends.map(normalizeFriendSnapshot));
        setAccounts((current) =>
          current.map((account) =>
            account.profile.id === payload.profile.id
              ? normalizeAccount({ ...account, profile: payload.profile })
              : account,
          ),
        );
        if (payload.ability) {
          setAbility({ ...DEFAULT_ABILITY, ...payload.ability });
        }
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Cloud snapshot failed.");
      }
    },
    [cloudToken],
  );

  useEffect(() => {
    if (!cloudToken || !loaded) {
      return;
    }

    const handle = window.setTimeout(() => {
      void refreshCloudSnapshot(cloudToken);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [cloudToken, loaded, refreshCloudSnapshot]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (
      !reminderEnabled ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId = 0;
    const schedule = () => {
      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          new Notification("GMAT Practice Lab", {
            body: "Your daily practice goal is waiting.",
            icon: "/favicon.svg",
          });
          schedule();
        }
      }, buildReminderDelay(reminderHour));
    };

    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [reminderEnabled, reminderHour]);

  async function handleSignup() {
    setAuthMessage("");
    const email = sanitizeEmail(authForm.email);
    if (!authForm.displayName.trim() || !email || authForm.password.length < 6) {
      setAuthMessage("Use a name, email, and a password with at least 6 characters.");
      return;
    }

    const cloud = await requestCloudAuth("signup");
    if (cloud.ok) {
      activateCloudAccount(cloud);
      setAuthForm(emptyAuthForm);
      if (cloud.recoveryCode) {
        setAccountNotice(`Recovery code: ${cloud.recoveryCode}. Save it somewhere private.`);
      }
      setToast(`Cloud profile created for ${cloud.profile.displayName}.`);
      return;
    }
    if (!cloud.localFallback) {
      setAuthMessage(cloud.error);
      return;
    }

    if (accounts.some((account) => account.profile.email === email)) {
      setAuthMessage("An account with this email already exists in this browser.");
      return;
    }

    const created = await createAccount(
      authForm.displayName,
      email,
      authForm.password,
      Number(authForm.targetScore) || 655,
    );
    const { recoveryCode, ...account } = created;

    setAccounts((current) => [...current, normalizeAccount(account)]);
    setAttempts((current) =>
      current.map((attempt) => (attempt.profileId ? attempt : { ...attempt, profileId: account.profile.id })),
    );
    setActiveProfileId(account.profile.id);
    setAuthForm(emptyAuthForm);
    setAccountNotice(`Recovery code: ${recoveryCode}. Save it somewhere private.`);
    setToast(`Welcome, ${account.profile.displayName}.`);
  }

  async function handleLogin() {
    setAuthMessage("");
    const cloud = await requestCloudAuth("login");
    if (cloud.ok) {
      activateCloudAccount(cloud);
      setAuthForm(emptyAuthForm);
      setToast(`Cloud sync active for ${cloud.profile.displayName}.`);
      return;
    }
    if (!cloud.localFallback) {
      setAuthMessage(cloud.error);
      return;
    }

    const account = accounts.find((candidate) => candidate.profile.email === sanitizeEmail(authForm.email));
    if (!account || !(await verifyPassword(account, authForm.password))) {
      setAuthMessage("Email or password is incorrect.");
      return;
    }

    const updatedAccount = {
      ...account,
      profile: { ...account.profile, lastLoginAt: new Date().toISOString() },
    };
    setAccounts((current) =>
      current.map((candidate) =>
        candidate.profile.id === account.profile.id ? normalizeAccount(updatedAccount) : candidate,
      ),
    );
    setActiveProfileId(account.profile.id);
    setAuthForm(emptyAuthForm);
    setToast(`Logged in as ${account.profile.displayName}.`);
  }

  async function handleResetPassword() {
    setAuthMessage("");
    const email = sanitizeEmail(authForm.email);
    if (!email || !authForm.recoveryCode.trim() || authForm.password.length < 6) {
      setAuthMessage("Use your email, recovery code, and a new password with at least 6 characters.");
      return;
    }

    const cloud = await requestCloudAuth("reset");
    if (cloud.ok) {
      activateCloudAccount(cloud);
      setAuthForm(emptyAuthForm);
      if (cloud.recoveryCode) {
        setAccountNotice(`New recovery code: ${cloud.recoveryCode}. Save it somewhere private.`);
      }
      setToast("Password reset. Cloud sync is active.");
      return;
    }
    if (!cloud.localFallback) {
      setAuthMessage(cloud.error);
      return;
    }

    const account = accounts.find((candidate) => candidate.profile.email === email);
    if (!account || !(await verifyRecoveryCode(account, authForm.recoveryCode))) {
      setAuthMessage("Email or recovery code is incorrect.");
      return;
    }

    const updated = await updateLocalPassword(account, authForm.password);
    const { recoveryCode, ...nextAccount } = updated;
    setAccounts((current) =>
      current.map((candidate) =>
        candidate.profile.id === account.profile.id ? normalizeAccount(nextAccount) : candidate,
      ),
    );
    setActiveProfileId(account.profile.id);
    setAuthForm(emptyAuthForm);
    setAccountNotice(`New recovery code: ${recoveryCode}. Save it somewhere private.`);
    setToast("Password reset.");
  }

  function handleLogout() {
    setActiveProfileId(null);
    setCloudToken(null);
    setCloudFriends([]);
    setSession(null);
    setView("dashboard");
    setAuthMode("login");
    setAccountNotice("");
    setSettingsMessage("");
    setToast("Logged out.");
  }

  async function updateProfileSettings(updates: Partial<AccountRecord["profile"]>) {
    if (!activeAccount) {
      return;
    }

    const nextProfile = profileWithDefaults({
      ...activeAccount.profile,
      ...updates,
      dailyQuestionGoal: clampGoal(
        Number(updates.dailyQuestionGoal ?? activeAccount.profile.dailyQuestionGoal),
        20,
      ),
      weeklySessionGoal: clampGoal(
        Number(updates.weeklySessionGoal ?? activeAccount.profile.weeklySessionGoal),
        5,
      ),
      targetScore: Math.max(
        205,
        Math.min(805, Math.round(Number(updates.targetScore ?? activeAccount.profile.targetScore) || 655)),
      ),
      reminderHour: Math.min(
        23,
        Math.max(0, Math.round(Number(updates.reminderHour ?? activeAccount.profile.reminderHour) || 18)),
      ),
    });

    setAccounts((current) =>
      current.map((account) =>
        account.profile.id === activeAccount.profile.id
          ? normalizeAccount({ ...account, profile: nextProfile })
          : account,
      ),
    );
    setSettingsMessage("Profile settings saved.");

    if (!cloudToken) {
      return;
    }

    try {
      const response = await fetch("/api/cloud/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cloudToken, ...nextProfile }),
      });
      const payload = (await response.json()) as CloudProfileResponse;
      if (!payload.ok) {
        throw new Error(payload.error);
      }
      setAccounts((current) =>
        current.map((account) =>
          account.profile.id === payload.profile.id
            ? normalizeAccount({ ...account, profile: payload.profile })
            : account,
        ),
      );
      setCloudFriends(payload.friends.map(normalizeFriendSnapshot));
      setSettingsMessage("Profile settings synced.");
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "Saved locally; cloud sync failed.");
    }
  }

  async function toggleReminders(enabled: boolean) {
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSettingsMessage("Browser notifications were not enabled.");
        return;
      }
    }

    await updateProfileSettings({ remindersEnabled: enabled });
  }

  async function requestCloudAuth(mode: AuthMode): Promise<CloudAuthResponse> {
    try {
      const response = await fetch("/api/cloud/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...authForm }),
      });
      return (await response.json()) as CloudAuthResponse;
    } catch {
      return {
        ok: false,
        error: "Cloud sync is unavailable right now.",
        localFallback: true,
      };
    }
  }

  function activateCloudAccount(cloud: Extract<CloudAuthResponse, { ok: true }>) {
    const account: AccountRecord = {
      profile: profileWithDefaults(cloud.profile),
      passwordHash: "cloud",
      salt: "cloud",
      friends: [],
    };
    setAccounts((current) => {
      const byId = new Map(current.map((candidate) => [candidate.profile.id, candidate]));
      byId.set(account.profile.id, normalizeAccount(account));
      return Array.from(byId.values());
    });
    setActiveProfileId(cloud.profile.id);
    setCloudToken(cloud.token);
    setCloudFriends(cloud.friends.map(normalizeFriendSnapshot));
    if (cloud.ability) {
      setAbility({ ...DEFAULT_ABILITY, ...cloud.ability });
    }
  }

  function startSession(mode: "practice" | "mock", order: SectionId[], aiInfinite = false) {
    if (!activeAccount) {
      setToast("Create or log in to a profile first.");
      return;
    }

    const id = createId(mode);
    const questionsBySection = blankQuestionMap();

    for (const section of order) {
      questionsBySection[section] = selectSectionQuestions(
        questions,
        section,
        questionCountForMode(mode, section),
        ability[section],
        id,
      );
    }

    setSession({
      id,
      mode,
      aiInfinite,
      startedAt: new Date().toISOString(),
      sectionOrder: order,
      currentSectionIndex: 0,
      questionIndex: 0,
      status: "question",
      questionsBySection,
      responsesByQuestionId: {},
      bookmarkedIds: {},
      remainingBySection: blankSeconds(mode, order),
      editsUsed: { quant: 0, verbal: 0, data: 0 },
      reviewing: false,
      breakRemainingSeconds: null,
      breakTaken: false,
    });
    setSelectedDrafts({});
    questionStartedAtRef.current = currentMillis();
    setView(mode === "practice" ? "practice" : "mock");
  }

  function currentResponse(question: Question, selected: number | null, edited: boolean): ResponseRecord {
    const spent = Math.max(
      1,
      Math.round((currentMillis() - questionStartedAtRef.current) / 1000) +
        (session?.responsesByQuestionId[question.id]?.timeSpentSeconds ?? 0),
    );

    return {
      questionId: question.id,
      section: question.section,
      selectedChoice: selected,
      correctChoice: question.correctChoice,
      isCorrect: selected === question.correctChoice,
      timeSpentSeconds: spent,
      difficulty: question.difficulty,
      topic: question.topic,
      type: question.type,
      bookmarked: Boolean(session?.bookmarkedIds[question.id]),
      edited,
      position: activeQuestions.findIndex((candidate) => candidate.id === question.id) + 1,
      answeredAt: new Date().toISOString(),
    };
  }

  function recordAnswer(nextStatus?: SessionStatus) {
    if (!session || !activeQuestion || selectedChoice === null) {
      return null;
    }

    const existing = session.responsesByQuestionId[activeQuestion.id];
    const changed = Boolean(existing && existing.selectedChoice !== selectedChoice);
    if (session.reviewing && changed && session.editsUsed[activeSection] >= 3) {
      setToast("Edit limit reached for this section.");
      return session;
    }

    const response = currentResponse(activeQuestion, selectedChoice, session.reviewing || Boolean(existing?.edited));
    const updated: ActiveSession = {
      ...session,
      status: nextStatus ?? session.status,
      responsesByQuestionId: {
        ...session.responsesByQuestionId,
        [activeQuestion.id]: response,
      },
      editsUsed:
        session.reviewing && changed
          ? {
              ...session.editsUsed,
              [activeSection]: session.editsUsed[activeSection] + 1,
            }
          : session.editsUsed,
      reviewing: nextStatus === "review" ? false : session.reviewing,
    };

    setSession(updated);
    return updated;
  }

  async function moveToNextQuestion(sourceSession: ActiveSession) {
    const section = sourceSession.sectionOrder[sourceSession.currentSectionIndex];
    const sectionQuestions = sourceSession.questionsBySection[section];

    if (sourceSession.questionIndex < sectionQuestions.length - 1) {
      setSession({
        ...sourceSession,
        status: "question",
        reviewing: false,
        questionIndex: sourceSession.questionIndex + 1,
      });
      questionStartedAtRef.current = currentMillis();
      return;
    }

    if (sourceSession.aiInfinite) {
      const lastQuestion = sectionQuestions[sourceSession.questionIndex];
      const lastResponse = sourceSession.responsesByQuestionId[lastQuestion.id];
      const nextDifficulty = Math.min(
        Math.max(lastQuestion.difficulty + (lastResponse?.isCorrect ? 1 : -1), 1),
        5,
      ) as Difficulty;

      setSessionAiBusy(true);
      setToast("Generating next AI question...");
      try {
        const question = await requestAiQuestion({
          section,
          type: QUESTION_TYPES_BY_SECTION[section][0],
          topic: `${SECTION_BY_ID[section].shortLabel} adaptive mixed practice`,
          difficulty: nextDifficulty,
        });
        setQuestions((current) => mergeQuestions(current, [question]));
        setSession({
          ...sourceSession,
          status: "question",
          reviewing: false,
          questionIndex: sectionQuestions.length,
          questionsBySection: {
            ...sourceSession.questionsBySection,
            [section]: [...sectionQuestions, question],
          },
        });
        questionStartedAtRef.current = currentMillis();
        setToast("Next AI question ready.");
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Could not generate the next AI question.");
      } finally {
        setSessionAiBusy(false);
      }
      return;
    }

    if (sourceSession.mode === "mock") {
      setSession({
        ...sourceSession,
        status: "review",
        reviewing: false,
        responsesByQuestionId: createEmptyResponsesForSection(sourceSession, section),
      });
      return;
    }

    completeSession({
      ...sourceSession,
      responsesByQuestionId: createEmptyResponsesForSection(sourceSession, section),
    });
  }

  function handlePrimaryAction() {
    if (!session || !activeQuestion) {
      return;
    }

    if (session.status === "feedback") {
      void moveToNextQuestion(session);
      return;
    }

    if (session.status === "question") {
      if (selectedChoice === null) {
        setToast("Choose an answer before continuing.");
        return;
      }

      if (session.reviewing) {
        const updated = recordAnswer("review");
        if (updated) {
          setToast("Answer saved.");
        }
        return;
      }

      if (session.mode === "practice") {
        recordAnswer("feedback");
        return;
      }

      const updated = recordAnswer("question");
      if (updated) {
        void moveToNextQuestion(updated);
      }
    }
  }

  function toggleBookmark(question: Question) {
    if (!session) {
      return;
    }

    const next = !session.bookmarkedIds[question.id];
    setSession({
      ...session,
      bookmarkedIds: {
        ...session.bookmarkedIds,
        [question.id]: next,
      },
    });
  }

  function openReviewQuestion(index: number) {
    if (!session) {
      return;
    }

    setSession({
      ...session,
      questionIndex: index,
      status: "question",
      reviewing: true,
    });
    questionStartedAtRef.current = currentMillis();
  }

  function finishSection() {
    if (!session) {
      return;
    }

    const section = session.sectionOrder[session.currentSectionIndex];
    const withMissing: ActiveSession = {
      ...session,
      responsesByQuestionId: createEmptyResponsesForSection(session, section),
    };

    if (withMissing.currentSectionIndex < withMissing.sectionOrder.length - 1) {
      if (withMissing.mode === "mock" && !withMissing.breakTaken) {
        setSession({
          ...withMissing,
          status: "break",
          reviewing: false,
          breakRemainingSeconds: null,
        });
      } else {
        continueToNextSection(withMissing, withMissing.breakTaken);
      }
      return;
    }

    completeSession(withMissing);
  }

  function continueToNextSection(sourceSession = session, breakTaken = session?.breakTaken ?? false) {
    if (!sourceSession) {
      return;
    }

    setSession({
      ...sourceSession,
      currentSectionIndex: sourceSession.currentSectionIndex + 1,
      questionIndex: 0,
      status: "question",
      reviewing: false,
      breakRemainingSeconds: null,
      breakTaken,
    });
    questionStartedAtRef.current = currentMillis();
  }

  function completeSession(sourceSession: ActiveSession) {
    const allResponsesById = { ...sourceSession.responsesByQuestionId };
    for (const section of sourceSession.sectionOrder) {
      Object.assign(
        allResponsesById,
        createEmptyResponsesForSection(
          { ...sourceSession, responsesByQuestionId: allResponsesById },
          section,
        ),
      );
    }

    const responses = sourceSession.sectionOrder.flatMap((section) =>
      sourceSession.questionsBySection[section].map((question) => allResponsesById[question.id]),
    );
    const attempt = buildAttempt(
      sourceSession.mode,
      sourceSession.startedAt,
      sourceSession.sectionOrder,
      responses,
      activeAccount?.profile.id,
    );

    const nextAbility = updateAbilityMap(ability, responses);
    setAttempts((current) => [attempt, ...current]);
    setAbility(nextAbility);
    if (cloudToken) {
      void syncCloudProgress(attempt, nextAbility);
    }
    setLastAttempt(attempt);
    setSession(null);
    setView("results");
    setToast("Attempt saved locally.");
  }

  async function syncCloudProgress(attempt: Attempt, nextAbility: AbilityMap) {
    if (!cloudToken) {
      return;
    }

    try {
      const payload: CloudProgressPayload = {
        token: cloudToken,
        attempt,
        ability: nextAbility,
      };
      const response = await fetch("/api/cloud/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CloudFriendsResponse;
      if (!result.ok) {
        throw new Error(result.error);
      }
      setCloudFriends(result.friends.map(normalizeFriendSnapshot));
      setToast("Attempt saved and synced.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Attempt saved locally; cloud sync failed.");
    }
  }

  function reorderSection(section: SectionId, direction: -1 | 1) {
    const index = mockOrder.indexOf(section);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= mockOrder.length) {
      return;
    }
    const next = [...mockOrder];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setMockOrder(next);
  }

  function exportData() {
    const payload: AppPersistedState = {
      version: 3,
      questions,
      attempts,
      ability,
      accounts,
      currentProfileId: null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gmat-practice-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<AppPersistedState>;
      const incomingQuestions = Array.isArray(parsed.questions)
        ? parsed.questions.map((question) => normalizeImportedQuestion(question)).filter(Boolean)
        : [];
      const incomingAttempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];

      setQuestions((current) => mergeQuestions(current, incomingQuestions as Question[]));
      setAttempts((current) => {
        const byId = new Map(current.map((attempt) => [attempt.id, attempt]));
        for (const attempt of incomingAttempts) {
          byId.set(attempt.id, attempt);
        }
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
        );
      });
      if (parsed.ability) {
        setAbility({ ...DEFAULT_ABILITY, ...parsed.ability });
      }
      if (Array.isArray(parsed.accounts)) {
        setAccounts((current) => {
          const byEmail = new Map(current.map((account) => [account.profile.email, account]));
          for (const account of parsed.accounts ?? []) {
            byEmail.set(account.profile.email, normalizeAccount(account));
          }
          return Array.from(byEmail.values());
        });
        setAuthMode("login");
      }
      setImportMessage(
        `Imported ${incomingQuestions.length} questions, ${incomingAttempts.length} attempts, and ${
          parsed.accounts?.length ?? 0
        } accounts.`,
      );
    } catch {
      setImportMessage("Import failed. Use the exported JSON format or the documented Question shape.");
    }
  }

  async function generateQuestion() {
    setStudioBusy(true);
    setStudioMessage("");
    setGeneratedQuestion(null);

    try {
      setGeneratedQuestion(await requestAiQuestion(studioDraft));
      setStudioMessage("Draft generated. Review it before adding it to your library.");
    } catch (error) {
      setStudioMessage(error instanceof Error ? error.message : "Question generation failed.");
    } finally {
      setStudioBusy(false);
    }
  }

  function addGeneratedQuestion() {
    if (!generatedQuestion) {
      return;
    }

    setQuestions((current) => mergeQuestions(current, [generatedQuestion]));
    setStudioMessage("Question added to your private library.");
    setGeneratedQuestion(null);
  }

  async function requestAiQuestion(draft: StudioDraft) {
    const response = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json()) as { question?: Question; error?: string };

    if (!response.ok || !payload.question) {
      throw new Error(payload.error ?? "Question generation failed.");
    }

    return payload.question;
  }

  async function addFriendSnapshot() {
    if (!activeAccount || !friendForm.displayName.trim()) {
      if (!cloudToken || !friendForm.friendCode.trim()) {
        return;
      }
    }

    if (cloudToken && friendForm.friendCode.trim()) {
      try {
        const response = await fetch("/api/cloud/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: cloudToken, friendCode: friendForm.friendCode }),
        });
        const payload = (await response.json()) as CloudFriendsResponse;
        if (!payload.ok) {
          throw new Error(payload.error);
        }
        setCloudFriends(payload.friends.map(normalizeFriendSnapshot));
        setFriendForm((current) => ({ ...current, friendCode: "" }));
        setToast("Friend added by code.");
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Could not add friend.");
      }
      return;
    }

    if (!activeAccount || !friendForm.displayName.trim()) {
      return;
    }

    const now = new Date().toISOString();
    const snapshot: FriendSnapshot = {
      id: createId("friend"),
      displayName: friendForm.displayName.trim(),
      friendCode: createId("code").slice(-8).toUpperCase(),
      avatarColor: "#bd7b22",
      sessions: Math.max(0, Number(friendForm.sessions) || 0),
      sessionsThisWeek: Math.max(0, Number(friendForm.sessions) || 0),
      questionsThisWeek: 0,
      streakDays: Math.max(0, Number(friendForm.streakDays) || 0),
      currentScore: Math.max(0, Number(friendForm.currentScore) || 0),
      bestScore: Math.max(0, Number(friendForm.bestScore) || 0),
      scoreVisible: true,
      lastActiveAt: now,
    };

    setAccounts((current) =>
      current.map((account) =>
        account.profile.id === activeAccount.profile.id
          ? { ...account, friends: [snapshot, ...account.friends] }
          : account,
      ),
    );
    setFriendForm({
      friendCode: "",
      displayName: "",
      currentScore: "625",
      bestScore: "645",
      sessions: "12",
      streakDays: "5",
    });
    setToast("Friend added to your leaderboard.");
  }

  async function startAiInfinitePractice() {
    if (!activeAccount) {
      setToast("Create or log in to a profile first.");
      return;
    }

    setSessionAiBusy(true);
    setToast("Generating your first AI question...");
    try {
      const question = await requestAiQuestion({
        section: practiceSection,
        type: QUESTION_TYPES_BY_SECTION[practiceSection][0],
        topic: `${SECTION_BY_ID[practiceSection].shortLabel} adaptive mixed practice`,
        difficulty: Math.round(ability[practiceSection]) as Difficulty,
      });
      setQuestions((current) => mergeQuestions(current, [question]));
      const id = createId("ai-practice");
      setSession({
        id,
        mode: "practice",
        aiInfinite: true,
        startedAt: new Date().toISOString(),
        sectionOrder: [practiceSection],
        currentSectionIndex: 0,
        questionIndex: 0,
        status: "question",
        questionsBySection: { ...blankQuestionMap(), [practiceSection]: [question] },
        responsesByQuestionId: {},
        bookmarkedIds: {},
        remainingBySection: {
          ...blankSeconds("practice", [practiceSection]),
          [practiceSection]: 12 * 60 * 60,
        },
        editsUsed: { quant: 0, verbal: 0, data: 0 },
        reviewing: false,
        breakRemainingSeconds: null,
        breakTaken: false,
      });
      setSelectedDrafts({});
      questionStartedAtRef.current = currentMillis();
      setView("practice");
      setToast("AI infinite practice started.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not generate an AI question.");
    } finally {
      setSessionAiBusy(false);
    }
  }

  if (!loaded) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Private GMAT practice lab</p>
          <h1>Loading your workspace</h1>
          <p className="muted">Preparing profiles, questions, and local analytics.</p>
        </section>
      </main>
    );
  }

  if (!activeAccount) {
    return (
      <AuthGate
        accounts={accounts}
        mode={authMode}
        setMode={setAuthMode}
        form={authForm}
        setForm={setAuthForm}
        message={authMessage}
        onLogin={() => void handleLogin()}
        onSignup={() => void handleSignup()}
        onReset={() => void handleResetPassword()}
      />
    );
  }

  if (session) {
    return (
      <ExamSurface
        session={session}
        activeSection={activeSection}
        activeQuestions={activeQuestions}
        activeQuestion={activeQuestion}
        selectedChoice={selectedChoice}
        existingResponse={existingResponse ?? null}
        setSelectedChoice={(choice) => {
          if (!activeQuestion) {
            return;
          }
          setSelectedDrafts((current) => ({ ...current, [activeQuestion.id]: choice }));
        }}
        onPrimary={handlePrimaryAction}
        onBookmark={toggleBookmark}
        onOpenReviewQuestion={openReviewQuestion}
        onFinishSection={finishSection}
        onExit={() => {
          setSession(null);
          setView("dashboard");
        }}
        onStartBreak={() => {
          setSession({ ...session, breakRemainingSeconds: 10 * 60, breakTaken: true });
        }}
        onSkipBreak={() => continueToNextSection(session, session.breakTaken)}
        onContinueAfterBreak={() => continueToNextSection(session, true)}
        toast={toast}
        aiBusy={sessionAiBusy}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Private GMAT practice lab</p>
          <h1>Exam-style adaptive trainer</h1>
        </div>
        <div className="profile-strip">
          <span className="avatar" style={{ background: activeAccount.profile.avatarColor }}>
            {activeAccount.profile.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{activeAccount.profile.displayName}</strong>
            <small>{toast}</small>
          </div>
          <button className="secondary-action small" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Application views">
        {tabItems.map((item) => (
          <button
            key={item.view}
            className={view === item.view ? "tab active" : "tab"}
            onClick={() => setView(item.view)}
            type="button"
            title={item.label}
          >
            <span aria-hidden="true">{item.symbol}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {view === "dashboard" && (
          <Dashboard
          activeAccount={activeAccount}
          attempts={profileAttempts}
          questions={questions}
          ability={ability}
          analytics={analytics}
          accountNotice={accountNotice}
          settingsMessage={settingsMessage}
          onStartPractice={() => startSession("practice", [practiceSection])}
          onStartMock={() => startSession("mock", mockOrder)}
          onUpdateProfile={(updates) => void updateProfileSettings(updates)}
          onToggleReminders={(enabled) => void toggleReminders(enabled)}
          practiceSection={practiceSection}
          setPracticeSection={setPracticeSection}
          mockOrder={mockOrder}
          reorderSection={reorderSection}
        />
      )}

      {view === "friends" && (
        <FriendsView
          activeAccount={activeAccount}
          leaderboard={leaderboard}
          cloudActive={Boolean(cloudToken)}
          form={friendForm}
          setForm={setFriendForm}
          onAddFriend={() => void addFriendSnapshot()}
        />
      )}

      {view === "practice" && (
        <section className="workspace two-column">
          <div className="panel">
            <p className="eyebrow">Practice mode</p>
            <h2>Adaptive section drill</h2>
            <p className="muted">
              Ten questions, immediate explanations, and difficulty selected near your current
              section estimate.
            </p>
            <div className="section-grid">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  className={practiceSection === section.id ? "choice-card selected" : "choice-card"}
                  onClick={() => setPracticeSection(section.id)}
                  type="button"
                >
                  <strong>{section.shortLabel}</strong>
                  <span>{Math.round(ability[section.id] * 20)} readiness</span>
                </button>
              ))}
            </div>
            <button className="primary-action" onClick={() => startSession("practice", [practiceSection])} type="button">
              <span aria-hidden="true">▶</span>
              Start practice
            </button>
            <button
              className="secondary-action"
              onClick={() => void startAiInfinitePractice()}
              type="button"
              disabled={sessionAiBusy}
            >
              <span aria-hidden="true">∞</span>
              {sessionAiBusy ? "Generating..." : "AI infinite drill"}
            </button>
          </div>
          <ResourcesPanel />
        </section>
      )}

      {view === "mock" && (
        <section className="workspace two-column">
          <div className="panel">
            <p className="eyebrow">Mock exam</p>
            <h2>Full section structure</h2>
            <p className="muted">
              21 Quant, 23 Verbal, and 20 Data Insights questions. Each section has 45 minutes and
              up to three answer edits on the review screen.
            </p>
            <div className="order-list">
              {mockOrder.map((section, index) => (
                <div className="order-row" key={section}>
                  <span>{index + 1}</span>
                  <strong>{sectionName(section)}</strong>
                  <div>
                    <button type="button" title="Move up" onClick={() => reorderSection(section, -1)}>
                      ↑
                    </button>
                    <button type="button" title="Move down" onClick={() => reorderSection(section, 1)}>
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="primary-action" onClick={() => startSession("mock", mockOrder)} type="button">
              <span aria-hidden="true">◷</span>
              Start mock exam
            </button>
          </div>
          <div className="panel compact">
            <h2>Exam safeguards</h2>
            <ul className="clean-list">
              <li>Timer is section-based.</li>
              <li>Calculator appears only in Data Insights.</li>
              <li>Review edits are capped at three per section.</li>
              <li>Imported and AI questions join the adaptive pool.</li>
            </ul>
          </div>
        </section>
      )}

      {view === "analytics" && (
        <AnalyticsView attempts={profileAttempts} analytics={analytics} ability={ability} />
      )}

      {view === "studio" && (
        <StudioView
          draft={studioDraft}
          setDraft={setStudioDraft}
          generatedQuestion={generatedQuestion}
          busy={studioBusy}
          message={studioMessage}
          onGenerate={generateQuestion}
          onAdd={addGeneratedQuestion}
        />
      )}

      {view === "library" && (
        <LibraryView
          questions={questions}
          importMessage={importMessage}
          fileInputRef={fileInputRef}
          onExport={exportData}
          onImport={importData}
          onCopySchema={() => copyToClipboard(JSON.stringify(sampleImportQuestion(), null, 2))}
        />
      )}

      {view === "results" && lastAttempt && (
        <ResultsView attempt={lastAttempt} questions={questions} onAnalytics={() => setView("analytics")} />
      )}
    </main>
  );
}

function AuthGate({
  accounts,
  mode,
  setMode,
  form,
  setForm,
  message,
  onLogin,
  onSignup,
  onReset,
}: {
  accounts: AccountRecord[];
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  form: typeof emptyAuthForm;
  setForm: (form: typeof emptyAuthForm) => void;
  message: string;
  onLogin: () => void;
  onSignup: () => void;
  onReset: () => void;
}) {
  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  return (
    <main className="app-shell auth-shell">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Private GMAT practice lab</p>
          <h1>{isSignup ? "Create your GMAT profile" : isReset ? "Reset password" : "Welcome back"}</h1>
          <p className="muted">
            Cloud sync keeps profiles, streaks, scores, and friends available across browsers.
            Your recovery code can reset your password without another paid service.
          </p>
        </div>

        <div className="auth-switch triple">
          <button
            type="button"
            className={isSignup ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={isReset ? "active" : ""}
            onClick={() => setMode("reset")}
          >
            Reset
          </button>
        </div>

        {isSignup && (
          <label className="field">
            Display name
            <input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Simon"
            />
          </label>
        )}

        <label className="field">
          Email
          <input
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@example.com"
            type="email"
          />
        </label>

        <label className="field">
          {isReset ? "New password" : "Password"}
          <input
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="At least 6 characters"
            type="password"
          />
        </label>

        {isReset && (
          <label className="field">
            Recovery code
            <input
              value={form.recoveryCode}
              onChange={(event) => setForm({ ...form, recoveryCode: event.target.value })}
              placeholder="ABCD-EFGH-2345"
            />
          </label>
        )}

        {isSignup && (
          <label className="field">
            Target score
            <input
              value={form.targetScore}
              onChange={(event) => setForm({ ...form, targetScore: Number(event.target.value) })}
              type="number"
              min="205"
              max="805"
              step="10"
            />
          </label>
        )}

        {message && <p className="notice">{message}</p>}

        <button className="primary-action" type="button" onClick={isSignup ? onSignup : isReset ? onReset : onLogin}>
          {isSignup ? "Create profile" : isReset ? "Reset password" : "Login"}
        </button>

        {accounts.length > 0 && (
          <div className="known-accounts">
            <p className="eyebrow">Profiles on this browser</p>
            {accounts.map((account) => (
              <button
                key={account.profile.id}
                type="button"
                onClick={() => {
                  setMode("login");
                  setForm({ ...form, email: account.profile.email, password: "" });
                }}
              >
                <span className="avatar" style={{ background: account.profile.avatarColor }}>
                  {account.profile.displayName.slice(0, 1).toUpperCase()}
                </span>
                <strong>{account.profile.displayName}</strong>
                <small>{account.profile.email}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ExamSurface({
  session,
  activeSection,
  activeQuestions,
  activeQuestion,
  selectedChoice,
  existingResponse,
  setSelectedChoice,
  onPrimary,
  onBookmark,
  onOpenReviewQuestion,
  onFinishSection,
  onExit,
  onStartBreak,
  onSkipBreak,
  onContinueAfterBreak,
  toast,
  aiBusy,
}: {
  session: ActiveSession;
  activeSection: SectionId;
  activeQuestions: Question[];
  activeQuestion: Question | null;
  selectedChoice: number | null;
  existingResponse: ResponseRecord | null;
  setSelectedChoice: (choice: number) => void;
  onPrimary: () => void;
  onBookmark: (question: Question) => void;
  onOpenReviewQuestion: (index: number) => void;
  onFinishSection: () => void;
  onExit: () => void;
  onStartBreak: () => void;
  onSkipBreak: () => void;
  onContinueAfterBreak: () => void;
  toast: string;
  aiBusy: boolean;
}) {
  const examShellClass =
    session.mode === "mock" ? "exam-shell mock-exam-shell" : "exam-shell practice-exam-shell";

  if (session.status === "break") {
    const nextSection = session.sectionOrder[session.currentSectionIndex + 1];
    return (
      <main className={examShellClass}>
        <div className="exam-window break-window">
          <p className="eyebrow">Optional break</p>
          <h1>{session.breakRemainingSeconds === null ? "Section complete" : "Break in progress"}</h1>
          <p className="muted">
            Next section: <strong>{sectionName(nextSection)}</strong>
          </p>
          {session.breakRemainingSeconds === null ? (
            <div className="action-row">
              <button className="primary-action" type="button" onClick={onStartBreak}>
                Take 10-minute break
              </button>
              <button className="secondary-action" type="button" onClick={onSkipBreak}>
                Continue now
              </button>
            </div>
          ) : (
            <>
              <div className="break-timer">{formatClock(session.breakRemainingSeconds)}</div>
              <button className="primary-action" type="button" onClick={onContinueAfterBreak}>
                Start next section
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  if (session.status === "review") {
    return (
      <main className={examShellClass}>
        <ExamHeader
          section={activeSection}
          session={session}
          questionPosition={activeQuestions.length}
          totalQuestions={activeQuestions.length}
          onExit={onExit}
        />
        <section className="review-board">
          <div>
            <p className="eyebrow">Review screen</p>
            <h1>{sectionName(activeSection)}</h1>
            <p className="muted">
              Edits used: {session.editsUsed[activeSection]} of 3. Unanswered questions are saved
              as incorrect when the section is submitted.
            </p>
          </div>
          <div className="question-grid">
            {activeQuestions.map((question, index) => {
              const response = session.responsesByQuestionId[question.id];
              const flagged = session.bookmarkedIds[question.id];
              return (
                <button
                  key={`${question.id}-${index}`}
                  type="button"
                  className={flagged ? "question-chip flagged" : response ? "question-chip answered" : "question-chip"}
                  onClick={() => onOpenReviewQuestion(index)}
                >
                  <span>{index + 1}</span>
                  <small>{flagged ? "Marked" : response?.selectedChoice === null ? "Blank" : "Answered"}</small>
                </button>
              );
            })}
          </div>
          <div className="action-row">
            <button className="primary-action" type="button" onClick={onFinishSection}>
              Submit section
            </button>
            <button className="secondary-action" type="button" onClick={onExit}>
              Save and exit session
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!activeQuestion) {
    return null;
  }

  const response = existingResponse;
  const isFeedback = session.status === "feedback";
  const progress = ((session.questionIndex + 1) / activeQuestions.length) * 100;
  const isBookmarked = Boolean(session.bookmarkedIds[activeQuestion.id]);

  return (
    <main className={examShellClass}>
      <ExamHeader
        section={activeSection}
        session={session}
        questionPosition={session.questionIndex + 1}
        totalQuestions={activeQuestions.length}
        onExit={onExit}
      />
      <div className="progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <section className="exam-window">
        <aside className="exam-side">
          <div className="metric">
            <span>Question</span>
            <strong>
              {session.questionIndex + 1}/{activeQuestions.length}
            </strong>
          </div>
          <div className="metric">
            <span>Difficulty</span>
            <strong>{activeQuestion.difficulty}/5</strong>
          </div>
          <div className="metric">
            <span>Topic</span>
            <strong>{activeQuestion.topic}</strong>
          </div>
          {activeSection === "data" && <Calculator />}
        </aside>

        <article className="question-panel">
          <div className="question-tools">
            <span>{activeQuestion.type}</span>
            <button type="button" className={isBookmarked ? "icon-button active" : "icon-button"} onClick={() => onBookmark(activeQuestion)} title="Bookmark question">
              ⚑
            </button>
          </div>
          {activeQuestion.stimulus && <p className="stimulus">{activeQuestion.stimulus}</p>}
          {activeQuestion.table && <QuestionTable table={activeQuestion.table} />}
          {activeQuestion.chart && <QuestionChart chart={activeQuestion.chart} />}
          <h2>{activeQuestion.prompt}</h2>
          <div className="answer-list">
            {activeQuestion.choices.map((choice, index) => {
              const isCorrect = isFeedback && index === activeQuestion.correctChoice;
              const isWrong =
                isFeedback && selectedChoice === index && index !== activeQuestion.correctChoice;
              return (
                <button
                  key={choice}
                  type="button"
                  className={[
                    "answer-choice",
                    selectedChoice === index ? "selected" : "",
                    isCorrect ? "correct" : "",
                    isWrong ? "wrong" : "",
                  ].join(" ")}
                  onClick={() => setSelectedChoice(index)}
                  disabled={isFeedback}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {choice}
                </button>
              );
            })}
          </div>

          {isFeedback && response && (
            <div className={response.isCorrect ? "feedback correct" : "feedback wrong"}>
              <strong>{response.isCorrect ? "Correct" : "Review this one"}</strong>
              <p>{activeQuestion.explanation}</p>
            </div>
          )}

          {session.reviewing && (
            <p className="notice">
              Review edit mode. Saving a changed answer uses one of three edits for this section.
            </p>
          )}

          <div className="action-row">
            <button className="primary-action" type="button" onClick={onPrimary}>
              {aiBusy
                ? "Generating..."
                : session.reviewing
                ? "Save edit"
                : isFeedback
                  ? session.questionIndex === activeQuestions.length - 1
                    ? "Finish practice"
                    : "Next question"
                  : session.mode === "practice"
                    ? "Check answer"
                    : session.questionIndex === activeQuestions.length - 1
                      ? "Review section"
                      : "Next question"}
            </button>
            {session.aiInfinite && (
              <button className="secondary-action" type="button" onClick={onFinishSection}>
                End drill and save
              </button>
            )}
            <span className="microcopy">{toast}</span>
          </div>
        </article>
      </section>
    </main>
  );
}

function ExamHeader({
  section,
  session,
  questionPosition,
  totalQuestions,
  onExit,
}: {
  section: SectionId;
  session: ActiveSession;
  questionPosition: number;
  totalQuestions: number;
  onExit: () => void;
}) {
  return (
    <header className="exam-header">
      <div>
        <p>{session.mode === "mock" ? "Mock Exam" : "Practice"}</p>
        <strong>{sectionName(section)}</strong>
      </div>
      <div className="exam-header-center">
        <span>
          {questionPosition} of {totalQuestions}
        </span>
        <strong>{formatClock(session.remainingBySection[section])}</strong>
      </div>
      <button type="button" className="secondary-action small" onClick={onExit}>
        Exit
      </button>
    </header>
  );
}

function Dashboard({
  activeAccount,
  attempts,
  questions,
  ability,
  analytics,
  accountNotice,
  settingsMessage,
  onStartPractice,
  onStartMock,
  onUpdateProfile,
  onToggleReminders,
  practiceSection,
  setPracticeSection,
  mockOrder,
  reorderSection,
}: {
  activeAccount: AccountRecord;
  attempts: Attempt[];
  questions: Question[];
  ability: AbilityMap;
  analytics: ReturnType<typeof buildAnalytics>;
  accountNotice: string;
  settingsMessage: string;
  onStartPractice: () => void;
  onStartMock: () => void;
  onUpdateProfile: (updates: Partial<AccountRecord["profile"]>) => void;
  onToggleReminders: (enabled: boolean) => void;
  practiceSection: SectionId;
  setPracticeSection: (section: SectionId) => void;
  mockOrder: SectionId[];
  reorderSection: (section: SectionId, direction: -1 | 1) => void;
}) {
  const latest = attempts[0];
  const profile = profileWithDefaults(activeAccount.profile);
  const dailyGoal = profile.dailyQuestionGoal ?? 20;
  const weeklyGoal = profile.weeklySessionGoal ?? 5;
  const dailyProgress = Math.min((analytics.todayQuestions / dailyGoal) * 100, 100);
  const weeklyProgress = Math.min((analytics.weeklySessions / weeklyGoal) * 100, 100);
  const lowestSection = SECTIONS.reduce((lowest, section) =>
    ability[section.id] < ability[lowest.id] ? section : lowest,
  );
  const recommendedTopic = analytics.weakestTopic || `${lowestSection.shortLabel} mixed practice`;

  return (
    <section className="workspace">
      <div className="dashboard-grid">
        <div className="panel exam-console">
          <p className="eyebrow">Next session</p>
          <h2>{latest ? `Last score estimate ${latest.estimatedTotalScore}` : "Ready for your first run"}</h2>
          <p className="muted">
            Adaptive selection, cloud sync, review limits, and streak tracking are active.
          </p>
          <div className="quick-actions">
            <button className="primary-action" type="button" onClick={onStartPractice}>
              <span aria-hidden="true">▶</span>
              Start practice
            </button>
            <button className="secondary-action" type="button" onClick={onStartMock}>
              <span aria-hidden="true">◷</span>
              Start mock
            </button>
          </div>
        </div>

        <div className="panel compact">
          <p className="eyebrow">Readiness</p>
          <div className="readiness-list">
            {SECTIONS.map((section) => (
              <div key={section.id} className="readiness-row">
                <span>{section.shortLabel}</span>
                <div className="mini-track">
                  <i style={{ width: `${ability[section.id] * 20}%` }} />
                </div>
                <strong>{ability[section.id].toFixed(1)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel compact">
          <p className="eyebrow">Library</p>
          <div className="big-number">{questions.length}</div>
          <p className="muted">private questions available</p>
          <div className="source-counts">
            {["starter", "imported", "ai"].map((source) => (
              <span key={source}>
                {source}: {questions.filter((question) => question.source === source).length}
              </span>
            ))}
          </div>
        </div>
      </div>

      {accountNotice && <p className="notice strong-notice">{accountNotice}</p>}

      <div className="goal-grid">
        <div className="panel compact">
          <p className="eyebrow">Today</p>
          <h2>{analytics.todayQuestions}/{dailyGoal} questions</h2>
          <div className="mini-track goal-track">
            <i style={{ width: `${dailyProgress}%` }} />
          </div>
          <p className="muted">{analytics.todayMinutes} minutes trained today</p>
        </div>

        <div className="panel compact">
          <p className="eyebrow">This week</p>
          <h2>{analytics.weeklySessions}/{weeklyGoal} sessions</h2>
          <div className="mini-track goal-track">
            <i style={{ width: `${weeklyProgress}%` }} />
          </div>
          <p className="muted">{analytics.weeklyQuestions} questions this week</p>
        </div>

        <div className="panel compact">
          <p className="eyebrow">Recommended next</p>
          <h2>{recommendedTopic}</h2>
          <p className="muted">
            Focus section: {lowestSection.shortLabel}. Current streak: {analytics.streakDays} days.
          </p>
          <button className="secondary-action small" type="button" onClick={() => setPracticeSection(lowestSection.id)}>
            Select section
          </button>
        </div>
      </div>

      <div className="workspace two-column">
        <div className="panel">
          <p className="eyebrow">Practice setup</p>
          <div className="section-grid">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={practiceSection === section.id ? "choice-card selected" : "choice-card"}
                onClick={() => setPracticeSection(section.id)}
              >
                <strong>{section.shortLabel}</strong>
                <span>{questions.filter((question) => question.section === section.id).length} questions</span>
              </button>
            ))}
          </div>
        </div>

        <ProfileSettingsPanel
          profile={profile}
          message={settingsMessage}
          onUpdate={onUpdateProfile}
          onToggleReminders={onToggleReminders}
        />
      </div>

      <div className="panel">
        <p className="eyebrow">Mock order</p>
        <div className="order-list">
          {mockOrder.map((section, index) => (
            <div className="order-row" key={section}>
              <span>{index + 1}</span>
              <strong>{sectionName(section)}</strong>
              <div>
                <button type="button" title="Move up" onClick={() => reorderSection(section, -1)}>
                  ↑
                </button>
                <button type="button" title="Move down" onClick={() => reorderSection(section, 1)}>
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnalyticsSnapshot analytics={analytics} />
    </section>
  );
}

function ProfileSettingsPanel({
  profile,
  message,
  onUpdate,
  onToggleReminders,
}: {
  profile: AccountRecord["profile"];
  message: string;
  onUpdate: (updates: Partial<AccountRecord["profile"]>) => void;
  onToggleReminders: (enabled: boolean) => void;
}) {
  const [draft, setDraft] = useState(profileWithDefaults(profile));

  return (
    <div className="panel">
      <p className="eyebrow">Profile settings</p>
      <div className="mini-form-grid">
        <label className="field">
          Display name
          <input
            value={draft.displayName}
            onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
          />
        </label>
        <label className="field">
          Target score
          <input
            value={draft.targetScore}
            type="number"
            min="205"
            max="805"
            step="10"
            onChange={(event) => setDraft({ ...draft, targetScore: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          Daily questions
          <input
            value={draft.dailyQuestionGoal ?? 20}
            type="number"
            min="1"
            onChange={(event) => setDraft({ ...draft, dailyQuestionGoal: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          Weekly sessions
          <input
            value={draft.weeklySessionGoal ?? 5}
            type="number"
            min="1"
            onChange={(event) => setDraft({ ...draft, weeklySessionGoal: Number(event.target.value) })}
          />
        </label>
      </div>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={draft.showScoreToFriends !== false}
          onChange={(event) => setDraft({ ...draft, showScoreToFriends: event.target.checked })}
        />
        <span>Show my score to friends</span>
      </label>
      <div className="mini-form-grid">
        <label className="toggle-row fieldless">
          <input
            type="checkbox"
            checked={Boolean(draft.remindersEnabled)}
            onChange={(event) => {
              setDraft({ ...draft, remindersEnabled: event.target.checked });
              onToggleReminders(event.target.checked);
            }}
          />
          <span>Daily browser reminder</span>
        </label>
        <label className="field compact-field">
          Reminder hour
          <input
            value={draft.reminderHour ?? 18}
            type="number"
            min="0"
            max="23"
            onChange={(event) => setDraft({ ...draft, reminderHour: Number(event.target.value) })}
          />
        </label>
      </div>
      <button className="primary-action" type="button" onClick={() => onUpdate(draft)}>
        Save settings
      </button>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}

function FriendsView({
  activeAccount,
  leaderboard,
  cloudActive,
  form,
  setForm,
  onAddFriend,
}: {
  activeAccount: AccountRecord;
  leaderboard: FriendSnapshot[];
  cloudActive: boolean;
  form: {
    friendCode: string;
    displayName: string;
    currentScore: string;
    bestScore: string;
    sessions: string;
    streakDays: string;
  };
  setForm: (form: {
    friendCode: string;
    displayName: string;
    currentScore: string;
    bestScore: string;
    sessions: string;
    streakDays: string;
  }) => void;
  onAddFriend: () => void;
}) {
  const sessionsLeader = [...leaderboard].sort((a, b) => b.sessions - a.sessions)[0];
  const weeklyLeader = [...leaderboard].sort((a, b) => b.sessionsThisWeek - a.sessionsThisWeek)[0];
  const scoreLeader = [...leaderboard].sort((a, b) => b.currentScore - a.currentScore)[0];

  return (
    <section className="workspace">
      <div className="dashboard-grid">
        <div className="panel exam-console">
          <p className="eyebrow">Friend dashboard</p>
          <h2>Train streaks, score races, and friendly pressure.</h2>
          <p className="muted">
            Your friend code is <strong>{activeAccount.profile.friendCode}</strong>. Cloud friends
            update automatically after saved sessions.
          </p>
          <button
            className="secondary-action small"
            type="button"
            onClick={() => copyToClipboard(activeAccount.profile.friendCode)}
          >
            Copy code
          </button>
        </div>
        <div className="panel compact">
          <p className="eyebrow">Weekly challenge</p>
          <div className="big-number">{weeklyLeader?.sessionsThisWeek ?? 0}</div>
          <p className="muted">{weeklyLeader?.displayName ?? "No sessions this week"}</p>
        </div>
        <div className="panel compact">
          <p className="eyebrow">Most sessions</p>
          <div className="big-number">{sessionsLeader?.sessions ?? 0}</div>
          <p className="muted">{sessionsLeader?.displayName ?? "No sessions yet"}</p>
        </div>
        <div className="panel compact">
          <p className="eyebrow">Current score lead</p>
          <div className="big-number">{scoreLeader?.scoreVisible === false ? "-" : scoreLeader?.currentScore || "-"}</div>
          <p className="muted">{scoreLeader?.displayName ?? "No score yet"}</p>
        </div>
      </div>

      <div className="workspace two-column">
        <div className="panel">
          <p className="eyebrow">Leaderboard</p>
          <div className="friend-board">
            {leaderboard.map((friend, index) => (
              <div className="friend-row" key={friend.id}>
                <span className="rank">{index + 1}</span>
                <span className="avatar" style={{ background: friend.avatarColor }}>
                  {friend.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{friend.displayName}</strong>
                  <small>{friend.friendCode}</small>
                </div>
                <div className="flame-stack">
                  <strong>{friend.streakDays} 🔥</strong>
                  <small>streak</small>
                </div>
                <div>
                  <strong>{friend.sessionsThisWeek}</strong>
                  <small>week</small>
                </div>
                <div>
                  <strong>{friend.sessions}</strong>
                  <small>sessions</small>
                </div>
                <div>
                  <strong>{friend.scoreVisible === false ? "Private" : friend.currentScore || "-"}</strong>
                  <small>current</small>
                </div>
                <div>
                  <strong>{friend.scoreVisible === false ? "Private" : friend.bestScore || "-"}</strong>
                  <small>best</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">Add friend snapshot</p>
          <h2>{cloudActive ? "Add live friend" : "Track friends before cloud sync"}</h2>
          <p className="muted">
            {cloudActive
              ? "Add a friend's code to create a live two-way leaderboard relationship."
              : "Cloud sync is not configured yet, so this adds a local snapshot only."}
          </p>
          {cloudActive && (
            <label className="field">
              Friend code
              <input
                value={form.friendCode}
                onChange={(event) => setForm({ ...form, friendCode: event.target.value })}
                placeholder="AB12CD34"
              />
            </label>
          )}
          {!cloudActive && (
            <>
              <label className="field">
                Name
                <input
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  placeholder="Friend name"
                />
              </label>
              <div className="mini-form-grid">
                <label className="field">
                  Current
                  <input
                    value={form.currentScore}
                    onChange={(event) => setForm({ ...form, currentScore: event.target.value })}
                    type="number"
                  />
                </label>
                <label className="field">
                  Best
                  <input
                    value={form.bestScore}
                    onChange={(event) => setForm({ ...form, bestScore: event.target.value })}
                    type="number"
                  />
                </label>
                <label className="field">
                  Sessions
                  <input
                    value={form.sessions}
                    onChange={(event) => setForm({ ...form, sessions: event.target.value })}
                    type="number"
                  />
                </label>
                <label className="field">
                  Streak
                  <input
                    value={form.streakDays}
                    onChange={(event) => setForm({ ...form, streakDays: event.target.value })}
                    type="number"
                  />
                </label>
              </div>
            </>
          )}
          <button className="primary-action" type="button" onClick={onAddFriend}>
            {cloudActive ? "Add by friend code" : "Add friend snapshot"}
          </button>
        </div>
      </div>
    </section>
  );
}

function AnalyticsSnapshot({ analytics }: { analytics: ReturnType<typeof buildAnalytics> }) {
  return (
    <div className="panel">
      <p className="eyebrow">Analytics snapshot</p>
      <div className="score-strip">
        <div>
          <span>Attempts</span>
          <strong>{analytics.attemptCount}</strong>
        </div>
        <div>
          <span>Average score</span>
          <strong>{analytics.averageScore || "-"}</strong>
        </div>
        <div>
          <span>Best score</span>
          <strong>{analytics.bestScore || "-"}</strong>
        </div>
        <div>
          <span>Weakest topic</span>
          <strong>{analytics.weakestTopic || "-"}</strong>
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({
  attempts,
  analytics,
  ability,
}: {
  attempts: Attempt[];
  analytics: ReturnType<typeof buildAnalytics>;
  ability: AbilityMap;
}) {
  return (
    <section className="workspace">
      <AnalyticsSnapshot analytics={analytics} />
      <div className="workspace two-column">
        <div className="panel">
          <p className="eyebrow">Score trend</p>
          <div className="trend-chart">
            {attempts.slice(0, 10).reverse().map((attempt) => (
              <div key={attempt.id} className="trend-bar">
                <i style={{ height: `${Math.max(8, ((attempt.estimatedTotalScore - 205) / 600) * 100)}%` }} />
                <span>{attempt.estimatedTotalScore}</span>
              </div>
            ))}
            {attempts.length === 0 && <p className="muted">Complete a session to see your score trend.</p>}
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">Current adaptive estimates</p>
          <div className="readiness-list large">
            {SECTIONS.map((section) => (
              <div key={section.id} className="readiness-row">
                <span>{section.label}</span>
                <div className="mini-track">
                  <i style={{ width: `${ability[section.id] * 20}%` }} />
                </div>
                <strong>{ability[section.id].toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="workspace two-column">
        <div className="panel">
          <p className="eyebrow">Weak topics</p>
          <div className="topic-table">
            {analytics.topicStats.slice(0, 8).map((topic) => (
              <div className="topic-row" key={topic.topic}>
                <strong>{topic.topic}</strong>
                <span>{Math.round(topic.accuracy * 100)}%</span>
                <div className="mini-track">
                  <i style={{ width: `${Math.round(topic.accuracy * 100)}%` }} />
                </div>
                <small>{topic.correct}/{topic.total} correct · {topic.averageSeconds}s avg</small>
              </div>
            ))}
            {analytics.topicStats.length === 0 && <p className="muted">Topic breakdown appears after practice.</p>}
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">Timing profile</p>
          <div className="score-strip two">
            <div>
              <span>Slow but correct</span>
              <strong>{analytics.slowCorrect}</strong>
            </div>
            <div>
              <span>Fast but wrong</span>
              <strong>{analytics.quickWrong}</strong>
            </div>
          </div>
          <p className="muted">
            Slow correct answers need efficiency work. Fast wrong answers usually need a slower first pass.
          </p>
          <div className="section-breakdown">
            {analytics.sectionStats.map((section) => (
              <div key={section.section} className="readiness-row">
                <span>{SECTION_BY_ID[section.section].shortLabel}</span>
                <div className="mini-track">
                  <i style={{ width: `${Math.round(section.accuracy * 100)}%` }} />
                </div>
                <strong>{Math.round(section.accuracy * 100)}%</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Mock exam reports</p>
        <div className="mock-report-grid">
          {analytics.mockReports.map((attempt) => (
            <div className="mock-report" key={attempt.id}>
              <strong>{attempt.estimatedTotalScore}</strong>
              <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
              <small>
                {attempt.sectionScores
                  .map((score) => `${SECTION_BY_ID[score.section].shortLabel} ${score.estimatedScore}`)
                  .join(" · ")}
              </small>
            </div>
          ))}
          {analytics.mockReports.length === 0 && <p className="muted">Complete a mock exam to see a section report.</p>}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Recent attempts</p>
        <div className="attempt-table">
          {attempts.map((attempt) => (
            <div className="attempt-row" key={attempt.id}>
              <span>{new Date(attempt.completedAt).toLocaleString()}</span>
              <strong>{attempt.mode === "mock" ? "Mock" : "Practice"}</strong>
              <span>{attempt.totalCorrect}/{attempt.totalQuestions}</span>
              <span>{attempt.estimatedTotalScore}</span>
            </div>
          ))}
          {attempts.length === 0 && <p className="muted">No saved attempts yet.</p>}
        </div>
      </div>
    </section>
  );
}

function StudioView({
  draft,
  setDraft,
  generatedQuestion,
  busy,
  message,
  onGenerate,
  onAdd,
}: {
  draft: StudioDraft;
  setDraft: (draft: StudioDraft) => void;
  generatedQuestion: Question | null;
  busy: boolean;
  message: string;
  onGenerate: () => void;
  onAdd: () => void;
}) {
  const availableTypes = QUESTION_TYPES_BY_SECTION[draft.section];

  return (
    <section className="workspace two-column">
      <div className="panel">
        <p className="eyebrow">Question Studio</p>
        <h2>Generate original practice drafts</h2>
        <p className="muted">
          This uses your server-side OpenAI API key when configured. Drafts are not saved until you
          review and accept them.
        </p>

        <label className="field">
          Section
          <select
            value={draft.section}
            onChange={(event) =>
              setDraft({
                ...draft,
                section: event.target.value as SectionId,
                type: QUESTION_TYPES_BY_SECTION[event.target.value as SectionId][0],
              })
            }
          >
            {SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Type
          <select
            value={draft.type}
            onChange={(event) => setDraft({ ...draft, type: event.target.value as QuestionType })}
          >
            {availableTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>

        <label className="field">
          Topic
          <input
            value={draft.topic}
            onChange={(event) => setDraft({ ...draft, topic: event.target.value })}
            placeholder="e.g. weighted averages"
          />
        </label>

        <label className="field">
          Difficulty
          <select
            value={draft.difficulty}
            onChange={(event) => setDraft({ ...draft, difficulty: Number(event.target.value) as Difficulty })}
          >
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </label>

        <button className="primary-action" type="button" onClick={onGenerate} disabled={busy}>
          {busy ? "Generating..." : "Generate draft"}
        </button>
        {message && <p className="notice">{message}</p>}
      </div>

      <div className="panel">
        <p className="eyebrow">Draft review</p>
        {generatedQuestion ? (
          <div className="draft-preview">
            <strong>{generatedQuestion.type}</strong>
            <h2>{generatedQuestion.prompt}</h2>
            <ol>
              {generatedQuestion.choices.map((choice, index) => (
                <li key={choice} className={index === generatedQuestion.correctChoice ? "correct-text" : ""}>
                  {choice}
                </li>
              ))}
            </ol>
            <p>{generatedQuestion.explanation}</p>
            <button className="primary-action" type="button" onClick={onAdd}>
              Add to library
            </button>
          </div>
        ) : (
          <p className="muted">Generated questions appear here before they enter your library.</p>
        )}
      </div>
    </section>
  );
}

function LibraryView({
  questions,
  importMessage,
  fileInputRef,
  onExport,
  onImport,
  onCopySchema,
}: {
  questions: Question[];
  importMessage: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (file: File) => void;
  onCopySchema: () => void;
}) {
  return (
    <section className="workspace">
      <div className="panel">
        <p className="eyebrow">Library management</p>
        <h2>Import, export, and inspect your private bank</h2>
        <div className="action-row">
          <button className="primary-action" type="button" onClick={onExport}>
            Export JSON
          </button>
          <button className="secondary-action" type="button" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <button className="secondary-action" type="button" onClick={onCopySchema}>
            Copy sample shape
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onImport(file);
              }
              event.currentTarget.value = "";
            }}
          />
        </div>
        {importMessage && <p className="notice">{importMessage}</p>}
      </div>

      <div className="library-grid">
        {SECTIONS.map((section) => (
          <div className="panel compact" key={section.id}>
            <p className="eyebrow">{section.shortLabel}</p>
            <div className="big-number">
              {questions.filter((question) => question.section === section.id).length}
            </div>
            <p className="muted">questions</p>
          </div>
        ))}
      </div>

      <div className="panel">
        <p className="eyebrow">Official resources</p>
        <div className="resource-links">
          <a href="https://www.mba.com/exams/gmat-exam/about/exam-structure" target="_blank" rel="noreferrer">
            Exam structure
          </a>
          <a href="https://www.mba.com/exams/gmat-exam/about/exam-content" target="_blank" rel="noreferrer">
            Exam content
          </a>
          <a href="https://www.mba.com/exams/gmat-exam/about/sample-questions" target="_blank" rel="noreferrer">
            Official sample questions
          </a>
        </div>
      </div>
    </section>
  );
}

function ResultsView({
  attempt,
  questions,
  onAnalytics,
}: {
  attempt: Attempt;
  questions: Question[];
  onAnalytics: () => void;
}) {
  const byId = new Map(questions.map((question) => [question.id, question]));

  return (
    <section className="workspace">
      <div className="panel results-hero">
        <p className="eyebrow">Attempt saved</p>
        <h2>{attempt.estimatedTotalScore}</h2>
        <p className="muted">
          {attempt.totalCorrect} correct out of {attempt.totalQuestions}. Score is an internal
          estimate for practice analytics, not an official GMAT score.
        </p>
        <button className="primary-action" type="button" onClick={onAnalytics}>
          Open analytics
        </button>
      </div>
      <div className="section-score-grid">
        {attempt.sectionScores.map((score) => (
          <div className="panel compact" key={score.section}>
            <p className="eyebrow">{SECTION_BY_ID[score.section].shortLabel}</p>
            <div className="big-number">{score.estimatedScore}</div>
            <p className="muted">
              {score.correct}/{score.total} correct · {Math.round(score.accuracy * 100)}%
            </p>
          </div>
        ))}
      </div>
      <div className="panel">
        <p className="eyebrow">Review log</p>
        <div className="review-log">
          {attempt.responses.slice(0, 12).map((response, index) => {
            const question = byId.get(response.questionId);
            return (
              <div className="review-log-row" key={`${response.questionId}-${index}`}>
                <span className={response.isCorrect ? "result-dot ok" : "result-dot"} />
                <strong>{question?.topic ?? response.topic}</strong>
                <span>{response.isCorrect ? "Correct" : "Missed"}</span>
                <small>{question?.explanation}</small>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResourcesPanel() {
  return (
    <div className="panel compact">
      <h2>Reference links</h2>
      <p className="muted">
        The app ships original practice material. Use official resources separately when you want
        GMAC-owned examples.
      </p>
      <div className="resource-links vertical">
        <a href="https://www.mba.com/exams/gmat-exam/about/exam-structure" target="_blank" rel="noreferrer">
          GMAT structure
        </a>
        <a href="https://www.mba.com/exams/gmat-exam/about/exam-content" target="_blank" rel="noreferrer">
          GMAT content
        </a>
        <a href="https://www.mba.com/exams/gmat-exam/about/sample-questions" target="_blank" rel="noreferrer">
          Official samples
        </a>
      </div>
    </div>
  );
}

function QuestionTable({ table }: { table: Question["table"] }) {
  if (!table) {
    return null;
  }

  return (
    <div className="table-wrap">
      {table.caption && <strong>{table.caption}</strong>}
      <table>
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={row.join("-") || rowIndex}>
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionChart({ chart }: { chart: Question["chart"] }) {
  if (!chart) {
    return null;
  }

  const max = Math.max(...chart.bars.map((bar) => bar.value), 1);

  return (
    <div className="chart-wrap">
      {chart.caption && <strong>{chart.caption}</strong>}
      <div className="bar-chart">
        {chart.bars.map((bar) => (
          <div className="chart-column" key={bar.label}>
            <i style={{ height: `${(bar.value / max) * 100}%` }} />
            <span>{bar.label}</span>
            <small>
              {bar.value}
              {chart.unit ? ` ${chart.unit}` : ""}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Calculator() {
  const [display, setDisplay] = useState("0");
  const [pending, setPending] = useState<number | null>(null);
  const [operation, setOperation] = useState<"+" | "-" | "×" | "÷" | null>(null);
  const [resetNext, setResetNext] = useState(false);

  function input(value: string) {
    setDisplay((current) => {
      if (resetNext || current === "0") {
        setResetNext(false);
        return value;
      }
      return `${current}${value}`;
    });
  }

  function apply(nextOperation: "+" | "-" | "×" | "÷" | "=") {
    const current = Number(display);
    const first = pending ?? current;
    let result = current;

    if (pending !== null && operation) {
      if (operation === "+") result = first + current;
      if (operation === "-") result = first - current;
      if (operation === "×") result = first * current;
      if (operation === "÷") result = current === 0 ? 0 : first / current;
    }

    setDisplay(String(Number(result.toFixed(8))));
    setPending(nextOperation === "=" ? null : result);
    setOperation(nextOperation === "=" ? null : nextOperation);
    setResetNext(true);
  }

  return (
    <div className="calculator">
      <span>DI Calculator</span>
      <output>{display}</output>
      <div>
        {["7", "8", "9"].map((key) => (
          <button key={key} type="button" onClick={() => input(key)}>
            {key}
          </button>
        ))}
        <button type="button" onClick={() => apply("÷")}>
          ÷
        </button>
        {["4", "5", "6"].map((key) => (
          <button key={key} type="button" onClick={() => input(key)}>
            {key}
          </button>
        ))}
        <button type="button" onClick={() => apply("×")}>
          ×
        </button>
        {["1", "2", "3"].map((key) => (
          <button key={key} type="button" onClick={() => input(key)}>
            {key}
          </button>
        ))}
        <button type="button" onClick={() => apply("-")}>
          -
        </button>
        <button type="button" onClick={() => setDisplay("0")}>
          C
        </button>
        <button type="button" onClick={() => input("0")}>
          0
        </button>
        <button type="button" onClick={() => apply("=")}>
          =
        </button>
        <button type="button" onClick={() => apply("+")}>
          +
        </button>
      </div>
    </div>
  );
}

function buildAnalytics(attempts: Attempt[]) {
  const attemptCount = attempts.length;
  const averageScore = attemptCount
    ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.estimatedTotalScore, 0) / attemptCount)
    : 0;
  const bestScore = attemptCount ? Math.max(...attempts.map((attempt) => attempt.estimatedTotalScore)) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayAttempts = attempts.filter((attempt) => attempt.completedAt.slice(0, 10) === today);
  const weeklyAttempts = attempts.filter((attempt) => isAttemptThisWeek(attempt));
  const topicStats = new Map<string, { correct: number; total: number; seconds: number }>();
  const sectionStats = new Map<SectionId, { correct: number; total: number; seconds: number }>();
  let slowCorrect = 0;
  let quickWrong = 0;

  for (const attempt of attempts) {
    for (const response of attempt.responses) {
      const current = topicStats.get(response.topic) ?? { correct: 0, total: 0, seconds: 0 };
      current.total += 1;
      current.correct += response.isCorrect ? 1 : 0;
      current.seconds += response.timeSpentSeconds;
      topicStats.set(response.topic, current);

      const section = sectionStats.get(response.section) ?? { correct: 0, total: 0, seconds: 0 };
      section.total += 1;
      section.correct += response.isCorrect ? 1 : 0;
      section.seconds += response.timeSpentSeconds;
      sectionStats.set(response.section, section);

      if (response.isCorrect && response.timeSpentSeconds >= 140) {
        slowCorrect += 1;
      }
      if (!response.isCorrect && response.timeSpentSeconds <= 55) {
        quickWrong += 1;
      }
    }
  }

  const topicRows = Array.from(topicStats.entries())
    .map(([topic, stat]) => ({
      topic,
      correct: stat.correct,
      total: stat.total,
      accuracy: stat.total ? stat.correct / stat.total : 0,
      averageSeconds: stat.total ? Math.round(stat.seconds / stat.total) : 0,
    }))
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.total - a.total;
    });

  const sectionRows = SECTIONS.map((section) => {
    const stat = sectionStats.get(section.id) ?? { correct: 0, total: 0, seconds: 0 };
    return {
      section: section.id,
      correct: stat.correct,
      total: stat.total,
      accuracy: stat.total ? stat.correct / stat.total : 0,
      averageSeconds: stat.total ? Math.round(stat.seconds / stat.total) : 0,
    };
  });

  const weakestTopic = topicRows.filter((row) => row.total >= 2)[0]?.topic ?? "";
  const todayQuestions = todayAttempts.reduce((sum, attempt) => sum + attempt.totalQuestions, 0);
  const todayMinutes = Math.round(
    todayAttempts.reduce(
      (sum, attempt) =>
        sum + attempt.responses.reduce((inner, response) => inner + response.timeSpentSeconds, 0),
      0,
    ) / 60,
  );
  const weeklyQuestions = weeklyAttempts.reduce((sum, attempt) => sum + attempt.totalQuestions, 0);
  const mockReports = attempts.filter((attempt) => attempt.mode === "mock").slice(0, 4);

  return {
    attemptCount,
    averageScore,
    bestScore,
    weakestTopic,
    todayQuestions,
    todayMinutes,
    weeklySessions: weeklyAttempts.length,
    weeklyQuestions,
    streakDays: computeStreakDays(attempts),
    topicStats: topicRows,
    sectionStats: sectionRows,
    slowCorrect,
    quickWrong,
    mockReports,
  };
}

function buildLeaderboard(
  accounts: AccountRecord[],
  attempts: Attempt[],
  activeProfileId: string | null,
): FriendSnapshot[] {
  const activeAccount = accounts.find((account) => account.profile.id === activeProfileId);
  const localProfiles = accounts.map((account) =>
    accountToFriendSnapshot(normalizeAccount(account), attempts, activeProfileId ?? undefined),
  );
  const manualFriends = (activeAccount?.friends ?? []).map(normalizeFriendSnapshot);

  return [...localProfiles, ...manualFriends].sort((a, b) => {
    if (b.streakDays !== a.streakDays) {
      return b.streakDays - a.streakDays;
    }
    if (b.sessions !== a.sessions) {
      return b.sessions - a.sessions;
    }
    return b.currentScore - a.currentScore;
  });
}

function sampleImportQuestion(): Question {
  return {
    id: "custom-001",
    section: "quant",
    type: "Problem Solving",
    topic: "Weighted averages",
    difficulty: 3,
    prompt: "Your original question prompt goes here.",
    choices: ["Choice A", "Choice B", "Choice C", "Choice D", "Choice E"],
    correctChoice: 2,
    explanation: "Explain the reasoning here.",
    tags: ["custom"],
    estimatedTimeSeconds: 120,
    source: "imported",
  };
}
