import { getAccountForToken, getFriendLeaderboard } from "@/lib/server-cloud";
import { isCloudStoreConfigured, kvGetJson } from "@/lib/server-kv";
import type { CloudSnapshotResponse } from "@/lib/cloud-types";
import type { AbilityMap } from "@/lib/types";

export const runtime = "nodejs";

type SnapshotPayload = {
  token?: string;
};

export async function POST(request: Request) {
  if (!isCloudStoreConfigured()) {
    return Response.json(
      { ok: false, error: "Cloud sync is not configured yet." } satisfies CloudSnapshotResponse,
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as SnapshotPayload;
    if (!body.token) {
      throw new Error("Please log in again.");
    }

    const account = await getAccountForToken(body.token);
    const friends = await getFriendLeaderboard(account.profile.id);
    const ability = await kvGetJson<AbilityMap>(`ability:${account.profile.id}`);

    return Response.json({
      ok: true,
      profile: account.profile,
      friends,
      ability: ability ?? undefined,
    } satisfies CloudSnapshotResponse);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load cloud data." },
      { status: 400 },
    );
  }
}
