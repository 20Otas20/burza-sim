import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const STATS_PATH = path.join(process.cwd(), "data", "stats.json");
const USERS_PATH = path.join(process.cwd(), "data", "users.json");
const VISITOR_COOKIE = "burza_visitor";

type Stats = { totalViews: number; visitorIds: string[] };

async function readStats(): Promise<Stats> {
  try {
    return JSON.parse(await fs.readFile(STATS_PATH, "utf-8"));
  } catch {
    return { totalViews: 0, visitorIds: [] };
  }
}

async function writeStats(s: Stats) {
  await fs.mkdir(path.dirname(STATS_PATH), { recursive: true });
  await fs.writeFile(STATS_PATH, JSON.stringify(s, null, 2));
}

// Volá se při každém načtení stránky (viz __root.tsx beforeLoad). Nastaví
// dlouhodobou cookie s náhodným ID návštěvníka (pokud ještě nemá) a připočte
// zobrazení. Unikátní návštěvníci = počet různých ID, co jsme kdy viděli.
export const recordVisit = createServerFn({ method: "POST" }).handler(async () => {
  let visitorId = getCookie(VISITOR_COOKIE);
  if (!visitorId) {
    visitorId = randomBytes(12).toString("hex");
    setCookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  const stats = await readStats();
  stats.totalViews += 1;
  if (!stats.visitorIds.includes(visitorId)) stats.visitorIds.push(visitorId);
  await writeStats(stats);
  return { ok: true };
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const stats = await readStats();
  let registeredUsers = 0;
  try {
    const users = JSON.parse(await fs.readFile(USERS_PATH, "utf-8"));
    registeredUsers = Array.isArray(users) ? users.length : 0;
  } catch {
    /* soubor ještě neexistuje = 0 uživatelů */
  }
  return {
    totalViews: stats.totalViews,
    uniqueVisitors: stats.visitorIds.length,
    registeredUsers,
  };
});
