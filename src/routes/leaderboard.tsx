import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth.functions";
import { getLeaderboard } from "@/lib/leaderboard.functions";
import { usd } from "@/lib/portfolio";

export const Route = createFileRoute("/leaderboard")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { user } = Route.useRouteContext();

  const boardQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    refetchInterval: 10000,
  });

  const board = boardQuery.data ?? [];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-primary hover:underline">
        ← Back to terminal
      </Link>
      <h1 className="disp mt-4 text-xl font-semibold">Leaderboard</h1>
      <p className="mt-1 text-[12.5px] text-faint">
        Ranked by total portfolio value (cash + holdings at current prices).
      </p>

      <div className="mt-6 overflow-hidden rounded-[9px] border border-border-soft">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-panel">
              {["#", "Trader", "Net worth"].map((h) => (
                <th
                  key={h}
                  className="border-b border-border-soft px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-faint">
                  No data yet — trade something to appear here.
                </td>
              </tr>
            )}
            {board.map((entry, i) => (
              <tr
                key={entry.userId}
                className={`border-b border-border-soft last:border-0 ${
                  entry.userId === user.id ? "bg-panel2" : ""
                }`}
              >
                <td className="num px-3 py-2 text-faint">{i + 1}</td>
                <td className="px-3 py-2 font-semibold">
                  {entry.name}
                  {entry.userId === user.id && (
                    <span className="ml-1.5 text-[10px] text-primary">(you)</span>
                  )}
                </td>
                <td className="num px-3 py-2">{usd(entry.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
