import { createCloudAccount, loginCloudAccount, resetCloudPassword } from "@/lib/server-cloud";
import { isCloudStoreConfigured } from "@/lib/server-kv";
import type { CloudAuthResponse } from "@/lib/cloud-types";

export const runtime = "nodejs";

type AuthPayload = {
  mode?: "signup" | "login" | "reset";
  displayName?: string;
  email?: string;
  password?: string;
  recoveryCode?: string;
  targetScore?: number;
};

export async function POST(request: Request) {
  if (!isCloudStoreConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "Cloud accounts are not configured yet. Add Vercel Redis/KV env vars.",
        localFallback: true,
      } satisfies CloudAuthResponse,
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as AuthPayload;
    if (!body.email || !body.password || body.password.length < 6) {
      throw new Error("Use an email and a password with at least 6 characters.");
    }

    const result =
      body.mode === "signup"
        ? await createCloudAccount({
            displayName: body.displayName || "GMAT Student",
            email: body.email,
            password: body.password,
            targetScore: Number(body.targetScore) || 655,
          })
        : body.mode === "reset"
          ? await resetCloudPassword(body.email, body.recoveryCode || "", body.password)
          : await loginCloudAccount(body.email, body.password);

    return Response.json({ ok: true, ...result } satisfies CloudAuthResponse);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Authentication failed." },
      { status: 400 },
    );
  }
}
