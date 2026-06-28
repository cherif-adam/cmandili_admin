"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, AlertCircle, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // true while we wait for the PASSWORD_RECOVERY session to be established
  const [ready, setReady] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Supabase processes the #access_token hash from the reset email and fires
    // PASSWORD_RECOVERY. We wait for that event before showing the form so that
    // updateUser() below has a valid session to work with.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError("Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Une erreur inattendue s'est produite. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Cmandili</h1>
          <p className="text-gray-400 mt-1 text-sm">Nouveau mot de passe</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          {success ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
                <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                <p className="text-sm text-green-400">
                  Mot de passe mis à jour. Redirection vers la connexion…
                </p>
              </div>
            </div>
          ) : !ready ? (
            <div className="space-y-3">
              <div className="h-4 bg-gray-800 rounded animate-pulse" />
              <div className="h-10 bg-gray-800 rounded animate-pulse" />
              <div className="h-10 bg-gray-800 rounded animate-pulse" />
              <p className="text-xs text-gray-500 text-center">
                Vérification du lien de réinitialisation…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                  <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Minimum 8 caractères"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Répétez le mot de passe"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
              >
                {loading ? "Mise à jour…" : "Définir le nouveau mot de passe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
