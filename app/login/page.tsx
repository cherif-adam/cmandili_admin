"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, Mail, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (searchParams.get("error") === "not_admin") {
      setError("Ce compte n'a pas les droits administrateur.");
    }
  }, [searchParams]);

  function switchView(next: "login" | "forgot") {
    setError(null);
    setSuccess(null);
    setView(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Email ou mot de passe incorrect.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Une erreur inattendue s'est produite. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

      if (resetError) {
        setError("Impossible d'envoyer l'email. Vérifiez l'adresse et réessayez.");
        return;
      }

      setSuccess(
        "Lien envoyé ! Vérifiez votre boîte mail (et le dossier spam)."
      );
    } catch {
      setError("Une erreur inattendue s'est produite. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  if (view === "forgot") {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <button
          type="button"
          onClick={() => switchView("login")}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft size={13} />
          Retour à la connexion
        </button>

        <div>
          <h2 className="text-sm font-semibold text-white">
            Réinitialiser le mot de passe
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {success ? (
          <div className="flex items-start gap-2.5 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
            <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
            <p className="text-sm text-green-400">{success}</p>
          </div>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@cmandili.tn"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Envoi…" : "Envoyer le lien de réinitialisation"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleLogin}
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4"
    >
      {error && (
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Email
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="admin@cmandili.tn"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Mot de passe
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => switchView("forgot")}
            className="text-xs text-gray-500 hover:text-orange-400 transition-colors"
          >
            Mot de passe oublié ?
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2"
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Cmandili</h1>
          <p className="text-gray-400 mt-1 text-sm">Panneau d'administration</p>
        </div>
        <Suspense fallback={<div className="h-48 bg-gray-900 rounded-xl animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
