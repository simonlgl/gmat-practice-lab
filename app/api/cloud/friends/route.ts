import { addFriendByCode, getAccountForToken, getFriendLeaderboard } from "@/lib/server-cloud";
import { isCloudStoreConfigured } from "@/lib/server-kv";
import type { CloudFriendsResponse } from "@/lib/cloud-types";

export const runtime = "nodejs";

type FriendsPayload = {
  token?: string;
  friendCode?: string;
};

export async function POST(request: Request) {
  if (!isCloudStoreConfigured()) {
    return Response.json(
      { ok: false, error: "Cloud friends are not configured yet." } satisfies CloudFriendsResponse,
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as FriendsPayload;
    if (!body.token) {
      throw new Error("Please log in again.");
    }

    const account = await getAccountForToken(body.token);
    const friends = body.friendCode
      ? await addFriendByCode(account.profile.id, body.friendCode)
      : await getFriendLeaderboard(account.profile.id);

    return Response.json({ ok: true, friends } satisfies CloudFriendsResponse);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update friends." },
      { status: 400 },
    );
  }
}
