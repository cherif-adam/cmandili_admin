"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, Mail, KeyRound, AlertCircle, CheckCircle } from "lucide-react";

/**
 * Password reset, code-based.
 *
 * The project's "Reset password" email template is shared by all four apps and
 * sends an 8-digit code, not a magic link — the client, partner and driver
 * apps all call verifyOtp(type: 'recovery') with it. This page used to wait
 * for a PASSWORD_RECOVERY session from a link in the URL hash, which the
 * template never produces, so the form stayed on its loading skeleton forever
 * and an admin could not reset a password at all.
 *
 * It now does what the three mobile apps do: verify the code to obtain a
 * recovery session, then update the password. The template is untouched, so
 * nothing else changes behaviour.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Prefilled from /login so the admin does not retype it, but editable —
  // they may open this page directly, or have asked for the code from a
  // different address.
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 8) {
      setError("Le code doit contenir 8 chiffres.");
      return;
    }
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
      // Step 1 — the code buys a recovery session.
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanCode,
        type: "recovery",
      });

      if (otpError) {
        // Supabase returns one message for both a wrong code and an expired
        // one, so the wording has to cover both rather than guess.
        const msg = otpError.message.toLowerCase();
        if (msg.includes("expired")) {
          setError("Ce code a expiré. Demandez-en un nouveau depuis « Mot de passe oublié ».");
        } else if (msg.includes("invalid") || msg.includes("token")) {
          setError("Code incorrect ou expiré. Vérifiez les 8 chiffres, ou demandez un nouveau code.");
        } else if (msg.includes("rate") || msg.includes("many")) {
          setError("Trop de tentatives. Patientez une minute avant de réessayer.");
        } else {
          setError(`Vérification impossible : ${otpError.message}`);
        }
        return;
      }

      // Step 2 — with that session, set the new password.
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const msg = updateError.message.toLowerCase();
        if (msg.includes("different from the old") || msg.includes("should be different")) {
          setError("Le nouveau mot de passe doit être différent de l'ancien.");
        } else if (msg.includes("weak") || msg.includes("password")) {
          setError("Mot de passe trop faible. Choisissez-en un plus long.");
        } else {
          setError(`Mise à jour impossible : ${updateError.message}`);
        }
        return;
      }

      setSuccess(true);
      // The recovery session would otherwise leave them signed in on a
      // half-authenticated session; sign out so /login is a clean start.
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Une erreur inattendue s'est produite. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors";
  const labelCls = "text-xs font-medium text-gray-400 uppercase tracking-wide";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Amana</h1>
          <p className="text-gray-400 mt-1 text-sm">Nouveau mot de passe</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          {success ? (
            <div className="flex items-start gap-2.5 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
              <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-green-400">
                Mot de passe mis à jour. Redirection vers la connexion…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                Saisissez le code à 8 chiffres reçu par email, puis votre
                nouveau mot de passe.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                  <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="admin@amana.tn"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Code reçu par email</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    required
                    autoComplete="one-time-code"
                    placeholder="12345678"
                    className={`${inputCls} tracking-[0.3em]`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Nouveau mot de passe</label>
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
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Répétez le mot de passe"
                    className={inputCls}
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

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Retour à la connexion
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary to avoid opting the whole route
  // into client-side rendering at build time.
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
