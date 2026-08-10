import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/live")({
  component: LivePage,
});

function LivePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/" className="text-primary hover:underline">
        ← Zpět na terminál
      </Link>
      <h1 className="disp mt-4 text-xl font-semibold">Přehled živých trhů</h1>
      <p className="mt-2 text-sm text-faint">
        Tahle stránka je zatím jen placeholder — dej vědět, co by na ní mělo být
        (např. tepelná mapa sektorů, žebříček největších pohybů dne apod.).
      </p>
    </main>
  );
}
