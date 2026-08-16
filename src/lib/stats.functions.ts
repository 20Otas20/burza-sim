import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { kvGet, kvSet } from "@/lib/kv";
import { getSessionUser } from "@/lib/auth.functions";

const VISITOR_COOKIE = "burza_visitor";

const ONLINE_WINDOW_MS = 2 * 60 * 1000; // "online now" = seen in the last 2 min
const ACTIVE_TODAY_MS = 24 * 60 * 60 * 1000;

type VisitorRecord = { firstSeen: number; lastSeen: number; views: number; name?: string };
type Stats = { totalViews: number; visitors: Record<string, VisitorRecord> };
type StoredUser = { id: string };

async function readStats(): Promise<Stats> {
  const raw = await kvGet<any>("stats", { totalViews: 0, visitors: {} });
  // Zpětná kompatibilita se starším formátem (visitorIds: string[]).
  if (Array.isArray(raw.visitorIds)) {
    return { totalViews: raw.totalViews ?? 0, visitors: {} };
  }
  return { totalViews: raw.totalViews ?? 0, visitors: raw.visitors ?? {} };
}

async function writeStats(s: Stats) {
  await kvSet("stats", s);
}

// Volá se při každém načtení stránky (viz __root.tsx beforeLoad). Nastaví
// dlouhodobou cookie s náhodným ID návštěvníka (pokud ještě nemá) a
// aktualizuje jeho poslední aktivitu. Pokud je návštěvník přihlášený, eviduje
// se pod jeho účtem (userId) i se jménem, aby šlo na /admin ukázat jmenný
// seznam lidí online — anonymní návštěvy se dál počítají jen jako číslo.
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

  const user = await getSessionUser().catch(() => null);
  const key = user ? `user:${user.id}` : visitorId;

  const stats = await readStats();
  const now = Date.now();
  const existing = stats.visitors[key];
  stats.visitors[key] = {
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
    views: (existing?.views ?? 0) + 1,
    name: user?.name,
  };
  stats.totalViews += 1;
  await writeStats(stats);
  return { ok: true };
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const stats = await readStats();
  const now = Date.now();
  const visitors = Object.values(stats.visitors);

  const users = await kvGet<StoredUser[]>("users", []);
  const registeredUsers = Array.isArray(users) ? users.length : 0;

  const onlineUsers = visitors
    .filter((v) => v.name && now - v.lastSeen <= ONLINE_WINDOW_MS)
    .map((v) => v.name as string)
    .sort();

  return {
    totalViews: stats.totalViews,
    uniqueVisitors: visitors.length,
    onlineNow: visitors.filter((v) => now - v.lastSeen <= ONLINE_WINDOW_MS).length,
    activeToday: visitors.filter((v) => now - v.lastSeen <= ACTIVE_TODAY_MS).length,
    registeredUsers,
    onlineUsers,
  };
});
