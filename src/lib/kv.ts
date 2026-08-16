// Jednoduchý klient pro key-value store postavený nad Upstash Redis REST API.
// Používá se pro perzistenci účtů (auth.functions.ts) a statistik
// (stats.functions.ts) napříč nasazeními/restarty serveru.
//
// Vyžaduje nastavení proměnných prostředí KV_REST_API_URL a
// KV_REST_API_TOKEN (případně UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN) na hostovaný Upstash Redis endpoint.

const KV_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvRequest(command: unknown[]): Promise<unknown> {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error(
      "Missing KV_REST_API_URL/KV_REST_API_TOKEN environment variables for kv store",
    );
  }

  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    throw new Error(`KV request failed: ${res.status}`);
  }

  const json = (await res.json()) as { result: unknown };
  return json.result;
}

export async function kvGet<T>(key: string, defaultValue: T): Promise<T> {
  const result = await kvRequest(["GET", key]);
  if (result == null) return defaultValue;
  try {
    return JSON.parse(result as string) as T;
  } catch {
    return defaultValue;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await kvRequest(["SET", key, JSON.stringify(value)]);
}
