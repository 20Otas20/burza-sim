import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth.functions";
import { getStats } from "@/lib/stats.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    // Zatím jednoduše: vidí to kdokoli přihlášený, ne jen správce.
    // Pro plnou soukromou verzi by šlo omezit na konkrétní e-mail.
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: AdminPage,
});

function AdminPage() {
  const { user } = Route.useRouteContext();

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: () => getStats(),
    refetchInterval: 10000,
  });

  const stats = statsQuery.data;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-primary hover:underline">
        ← Back to terminal
      </Link>
      <h1 className="disp mt-4 text-xl font-semibold">Statistics</h1>
      <p className="mt-1 text-[12.5px] text-faint">Logged in as {user.name}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatBox label="Online now" value={stats?.onlineNow} highlight />
        <StatBox label="Active today" value={stats?.activeToday} />
        <StatBox label="Unique visitors (all time)" value={stats?.uniqueVisitors} />
        <StatBox label="Registered users" value={stats?.registeredUsers} />
        <StatBox label="Total page views" value={stats?.totalViews} />
      </div>

      <div className="mt-4 rounded-[9px] border border-border-soft bg-panel px-4 py-3.5">
        <p className="mb-2 text-[11px] uppercase tracking-[0.6px] text-faint">
          Who's online now
        </p>
        {stats?.onlineUsers && stats.onlineUsers.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {stats.onlineUsers.map((name) => (
              <li
                key={name}
                className="rounded-full border border-up/35 bg-up-soft px-2.5 py-1 text-[12px] text-up"
              >
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-faint">No logged-in users online right now.</p>
        )}
      </div>

      <p className="mt-6 text-[11px] text-faint">
        "Online now" counts visitors seen in the last 2 minutes, "active
        today" in the last 24 hours — both based on an anonymous cookie, so
        they work even without registering. The name list above only shows
        people who are logged in. Refreshes every 10 seconds.
      </p>
    </main>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | undefined;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[9px] border px-4 py-3.5 ${
        highlight ? "border-up/35 bg-up-soft" : "border-border-soft bg-panel"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.6px] text-faint">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${highlight ? "text-up" : ""}`}>
        {value ?? "…"}
      </p>
    </div>
  );
}
