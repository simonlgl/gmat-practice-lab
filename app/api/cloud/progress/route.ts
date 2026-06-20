import { getAccountForToken, getFriendLeaderboard, saveCloudProgress } from "@/lib/server-cloud";
import { isCloudStoreConfigured } from "@/lib/server-kv";
import type { CloudFriendsResponse, CloudProgressPayload } from "@/lib/cloud-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isCloudStoreConfigured()) {
    return Response.json(
      { ok: false, error: "Cloud progress is not configured yet." } satisfies CloudFriendsResponse,
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as CloudProgressPayload;
    if (!body.token || !body.attempt || !body.ability) {
      throw new Error("Missing progress payload.");
    }

    const account = await getAccountForToken(body.token);
    await saveCloudProgress(account.profile.id, body.attempt, body.ability);
    const friends = await getFriendLeaderboard(account.profile.id);

    return Response.json({ ok: true, friends } satisfies CloudFriendsResponse);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not sync progress." },
      { status: 400 },
    );
  }
}
