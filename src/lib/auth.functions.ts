import { createServerFn } from "@tanstack/react-start";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";

const scryptAsync = promisify(scrypt);
const DB_PATH = path.join(process.cwd(), "data", "users.json");
const SESSION_COOKIE = "burza_session";

// V paměti serveru. Pro produkci s více instancemi nahraď Redis/DB.
const SESSIONS = new Map<string, { userId: string; expires: number }>();

type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
};

export type PublicUser = { id: string; email: string; name: string };

async function readUsers(): Promise<User[]> {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
  } catch {
    return [];
  }
}

async function writeUsers(users: User[]) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(users, null, 2));
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return { hash: derived.toString("hex"), salt };
}

function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  SESSIONS.set(token, { userId, expires: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  return token;
}

function toPublic(u: User): PublicUser {
  return { id: u.id, email: u.email, name: u.name };
}

export const register = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string; name: string }) => data)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) {
      return { ok: false as const, error: "Invalid email address." };
    }
    if (data.password.length < 6) {
      return { ok: false as const, error: "Password must be at least 6 characters." };
    }

    const users = await readUsers();
    if (users.some((u) => u.email === email)) {
      return { ok: false as const, error: "An account with this email already exists." };
    }

    const { hash, salt } = await hashPassword(data.password);
    const user: User = {
      id: randomBytes(8).toString("hex"),
      email,
      name: data.name.trim() || email.split("@")[0],
      passwordHash: hash,
      salt,
    };
    users.push(user);
    await writeUsers(users);

    const token = createSession(user.id);
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { ok: true as const, user: toPublic(user) };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const users = await readUsers();
    const user = users.find((u) => u.email === email);
    const genericError = { ok: false as const, error: "Incorrect email or password." };
    if (!user) return genericError;

    const { hash } = await hashPassword(data.password, user.salt);
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(user.passwordHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return genericError;

    const token = createSession(user.id);
    setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { ok: true as const, user: toPublic(user) };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE);
  if (token) SESSIONS.delete(token);
  deleteCookie(SESSION_COOKIE);
  return { ok: true };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicUser | null> => {
    const token = getCookie(SESSION_COOKIE);
    if (!token) return null;
    const session = SESSIONS.get(token);
    if (!session || session.expires < Date.now()) return null;
    const users = await readUsers();
    const user = users.find((u) => u.id === session.userId);
    return user ? toPublic(user) : null;
  },
);
