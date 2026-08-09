"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Panel from "@/components/Panel";
import { createClient } from "@/lib/supabase/client";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.status === 400) {
          setError("Email ou mot de passe incorrect.");
        } else {
          setError("Une erreur est survenue, réessaie dans quelques instants.");
        }
        return;
      }

      router.push("/compte");
      router.refresh();
    } catch {
      setError("Une erreur est survenue, réessaie dans quelques instants.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up mx-auto max-w-md py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Connexion
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">
          Content de te revoir
        </h2>
      </div>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-foreground/65"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-foreground/65"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-[var(--danger-text)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground/65">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="text-[var(--link)] hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </Panel>
    </div>
  );
}
