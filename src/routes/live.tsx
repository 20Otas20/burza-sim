import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/live")({
  component: LivePage,
});

function LivePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/" className="text-primary hover:underline">
        ← Back to terminal
      </Link>
      <h1 className="disp mt-4 text-xl font-semibold">Live markets overview</h1>
      <p className="mt-2 text-sm text-faint">
        This page is just a placeholder for now — let me know what should go
        here (e.g. a sector heatmap, a leaderboard of the day's biggest movers, etc.).
      </p>
    </main>
  );
}
