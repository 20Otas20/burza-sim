import { createServerFn } from "@tanstack/react-start";
import fs from "node:fs/promises";
import path from "node:path";

const LEADERBOARD_PATH = path.join(process.cwd(), "data", "leaderboard.json");

type Entry = { userId: string; name: string; value: number; updatedAt: number };

async function readBoard(): Promise<Record<string, Entry>> {
  try {
    return JSON.parse(await fs.readFile(LEADERBOARD_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function writeBoard(board: Record<string, Entry>) {
  await fs.mkdir(path.dirname(LEADERBOARD_PATH), { recursive: true });
  await fs.writeFile(LEADERBOARD_PATH, JSON.stringify(board, null, 2));
}

// Volá klient pokaždé, když se přepočítá hodnota jeho portfolia (viz
// index.tsx). Ukládáme jen poslední známou hodnotu na uživatele, ne historii.
export const reportNetWorth = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; name: string; value: number }) => data)
  .handler(async ({ data }) => {
    if (!Number.isFinite(data.value)) return { ok: false as const };
    const board = await readBoard();
    board[data.userId] = {
      userId: data.userId,
      name: data.name,
      value: data.value,
      updatedAt: Date.now(),
    };
    await writeBoard(board);
    return { ok: true as const };
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const board = await readBoard();
  return Object.values(board)
    .sort((a, b) => b.value - a.value)
    .slice(0, 100);
});
