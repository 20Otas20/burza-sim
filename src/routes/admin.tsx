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

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox label="Registered users" value={stats?.registeredUsers} />
        <StatBox label="Unique visitors" value={stats?.uniqueVisitors} />
        <StatBox label="Total page views" value={stats?.totalViews} />
      </div>

      <p className="mt-6 text-[11px] text-faint">
        A unique visitor is one device/browser (identified via cookie),
        even without registering. Page views are counted on every load of
        any page (login, terminal, and registration).
      </p>
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-[9px] border border-border-soft bg-panel px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.6px] text-faint">{label}</p>
      <p className="num mt-1 text-2xl font-semibold">{value ?? "…"}</p>
    </div>
  );
}
