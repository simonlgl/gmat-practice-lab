export const SECTIONS = [
  {
    id: "quant",
    label: "Quantitative Reasoning",
    shortLabel: "Quant",
    questionCount: 21,
    durationSeconds: 45 * 60,
  },
  {
    id: "verbal",
    label: "Verbal Reasoning",
    shortLabel: "Verbal",
    questionCount: 23,
    durationSeconds: 45 * 60,
  },
  {
    id: "data",
    label: "Data Insights",
    shortLabel: "Data",
    questionCount: 20,
    durationSeconds: 45 * 60,
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type QuestionSource = "starter" | "imported" | "ai";

export type QuestionType =
  | "Problem Solving"
  | "Critical Reasoning"
  | "Reading Comprehension"
  | "Data Sufficiency"
  | "Table Analysis"
  | "Graphics Interpretation"
  | "Two-Part Analysis"
  | "Multi-Source Reasoning";

export type QuestionTable = {
  caption?: string;
  headers: string[];
  rows: string[][];
};

export type QuestionChart = {
  caption?: string;
  unit?: string;
  bars: Array<{ label: string; value: number }>;
};

export type Question = {
  id: string;
  section: SectionId;
  type: QuestionType;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  stimulus?: string;
  table?: QuestionTable;
  chart?: QuestionChart;
  choices: string[];
  correctChoice: number;
  explanation: string;
  tags: string[];
  estimatedTimeSeconds: number;
  source: QuestionSource;
};

export type ResponseRecord = {
  questionId: string;
  section: SectionId;
  selectedChoice: number | null;
  correctChoice: number;
  isCorrect: boolean;
  timeSpentSeconds: number;
  difficulty: Difficulty;
  topic: string;
  type: QuestionType;
  bookmarked: boolean;
  edited: boolean;
  position: number;
  answeredAt: string;
};

export type SectionScore = {
  section: SectionId;
  correct: number;
  total: number;
  accuracy: number;
  averageDifficulty: number;
  averageSeconds: number;
  estimatedScore: number;
};

export type Attempt = {
  id: string;
  profileId?: string;
  mode: "practice" | "mock";
  startedAt: string;
  completedAt: string;
  sectionOrder: SectionId[];
  responses: ResponseRecord[];
  sectionScores: SectionScore[];
  totalCorrect: number;
  totalQuestions: number;
  estimatedTotalScore: number;
};

export type AbilityMap = Record<SectionId, number>;

export type FriendSnapshot = {
  id: string;
  displayName: string;
  friendCode: string;
  avatarColor: string;
  sessions: number;
  sessionsThisWeek: number;
  questionsThisWeek: number;
  streakDays: number;
  bestScore: number;
  currentScore: number;
  scoreVisible: boolean;
  lastActiveAt: string;
};

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  friendCode: string;
  avatarColor: string;
  targetScore: number;
  dailyQuestionGoal?: number;
  weeklySessionGoal?: number;
  showScoreToFriends?: boolean;
  remindersEnabled?: boolean;
  reminderHour?: number;
  createdAt: string;
  lastLoginAt: string;
};

export type AccountRecord = {
  profile: UserProfile;
  passwordHash: string;
  salt: string;
  recoveryHash?: string;
  recoverySalt?: string;
  friends: FriendSnapshot[];
};

export type AppPersistedState = {
  version: 3;
  questions: Question[];
  attempts: Attempt[];
  ability: AbilityMap;
  accounts: AccountRecord[];
  currentProfileId: string | null;
  cloudToken?: string | null;
};

export const SECTION_BY_ID = Object.fromEntries(
  SECTIONS.map((section) => [section.id, section]),
) as Record<SectionId, (typeof SECTIONS)[number]>;

export const DEFAULT_ABILITY: AbilityMap = {
  quant: 3,
  verbal: 3,
  data: 3,
};
