import fs from "node:fs/promises";
import path from "node:path";

// Když jsou nastavené proměnné prostředí UPSTASH_REDIS_REST_URL a
// UPSTASH_REDIS_REST_TOKEN (nastavuje se to v Railway → Variables), data se
// ukládají do Upstash Redis a přežijí každé nasazení. Bez nich (typicky
// lokální vývoj přes `npm run dev`) se použije obyčejný JSON soubor v
// data/<key>.json, jak to fungovalo předtím — žádný Upstash účet tedy není
// potřeba pro vývoj na vlastním počítači.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

let redisClient: import("@upstash/redis").Redis | null = null;

async function getRedis() {
  if (!redisClient) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! });
  }
  return redisClient;
}

function localPath(key: string) {
  return path.join(process.cwd(), "data", `${key}.json`);
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  if (hasUpstash) {
    const redis = await getRedis();
    const value = await redis.get<T>(key);
    return value ?? fallback;
  }
  try {
    return JSON.parse(await fs.readFile(localPath(key), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (hasUpstash) {
    const redis = await getRedis();
    await redis.set(key, value);
    return;
  }
  const dir = path.dirname(localPath(key));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(localPath(key), JSON.stringify(value, null, 2));
}
