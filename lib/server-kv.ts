type RedisResponse<T> = {
  result?: T;
  error?: string;
};

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

export function isCloudStoreConfigured() {
  return Boolean(kvConfig());
}

export async function kvCommand<T>(command: string, ...args: Array<string | number>) {
  const config = kvConfig();
  if (!config) {
    throw new Error("Cloud store is not configured.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command, ...args]),
    cache: "no-store",
  });

  const payload = (await response.json()) as RedisResponse<T>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Cloud store request failed.");
  }

  return payload.result as T;
}

export async function kvGetJson<T>(key: string) {
  const result = await kvCommand<string | null>("GET", key);
  return result ? (JSON.parse(result) as T) : null;
}

export async function kvSetJson(key: string, value: unknown) {
  await kvCommand<"OK">("SET", key, JSON.stringify(value));
}

export async function kvSetJsonEx(key: string, seconds: number, value: unknown) {
  await kvCommand<"OK">("SET", key, JSON.stringify(value), "EX", seconds);
}
