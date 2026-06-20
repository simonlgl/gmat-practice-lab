import { updateCloudProfile } from "@/lib/server-cloud";
import { isCloudStoreConfigured } from "@/lib/server-kv";
import type { CloudProfileResponse } from "@/lib/cloud-types";

export const runtime = "nodejs";

type ProfilePayload = {
  token?: string;
  displayName?: string;
  targetScore?: number;
  dailyQuestionGoal?: number;
  weeklySessionGoal?: number;
  showScoreToFriends?: boolean;
  remindersEnabled?: boolean;
  reminderHour?: number;
};

export async function POST(request: Request) {
  if (!isCloudStoreConfigured()) {
    return Response.json(
      { ok: false, error: "Cloud profile sync is not configured yet." } satisfies CloudProfileResponse,
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as ProfilePayload;
    if (!body.token) {
      throw new Error("Please log in again.");
    }

    const result = await updateCloudProfile(body.token, body);
    return Response.json({ ok: true, ...result } satisfies CloudProfileResponse);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update profile." },
      { status: 400 },
    );
  }
}
