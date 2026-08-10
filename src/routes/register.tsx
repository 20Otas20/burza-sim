import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { register } from "@/lib/auth.functions";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await register({ data: { name, email, password } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="disp mb-1 text-xl font-semibold">Registrace</h1>
      <p className="mb-6 text-[12.5px] text-faint">
        Už máš účet?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Přihlas se
        </Link>
      </p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          required
          placeholder="Jméno"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-[7px] border border-border bg-[var(--bg2)] px-3 py-2 text-sm text-foreground outline-none placeholder:text-faint focus:border-primary"
        />
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[7px] border border-border bg-[var(--bg2)] px-3 py-2 text-sm text-foreground outline-none placeholder:text-faint focus:border-primary"
        />
        <input
          type="password"
          required
          placeholder="Heslo (min. 6 znaků)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[7px] border border-border bg-[var(--bg2)] px-3 py-2 text-sm text-foreground outline-none placeholder:text-faint focus:border-primary"
        />
        {error && <p className="text-[12px] text-down">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-md border border-primary/40 bg-panel2 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          {busy ? "Zakládám účet…" : "Vytvořit účet"}
        </button>
      </form>
    </main>
  );
}
