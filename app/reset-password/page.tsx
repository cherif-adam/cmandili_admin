"use client";

import { useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, Mail, KeyRound, AlertCircle, CheckCircle } from "lucide-react";

/**
 * Password reset. Three ways in, one form:
 *
 *   1. LINK  /reset-password?token_hash=…&type=recovery — the admin link of
 *      the "Reset password" email (shown only for requests made from this
 *      dashboard, see cmandili_context.md). Works in any browser: the token
 *      travels in the link, no PKCE verifier is needed.
 *   2. LINK  /reset-password?code=… — the PKCE form of the same link, if the
 *      template ever uses {{ .ConfirmationURL }}. Same browser only.
 *   3. CODE  the 8-digit code of the same email (the only thing the mobile
 *      apps' emails carry), typed with the address.
 *
 * The link is spent only when the form is submitted, never on page load:
 * mail scanners that pre-open links would otherwise burn it before the admin
 * clicks. A spent or expired link says so and offers a new one.
 *
 * Every message is ours, in French — no raw Supabase error reaches the page.
 */

const EXPIRED_LINK = "Ce lien a expiré. Demandez un nouveau lien.";

type Mode =
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "pkce"; code: string }
  | { kind: "otp" };

/** What the URL brings: a link token, or nothing (code entry). */
function modeFrom(params: URLSearchParams): Mode {
  const tokenHash = params.get("token_hash");
  if (tokenHash && (params.get("type") ?? "recovery") === "recovery") {
    return { kind: "token_hash", tokenHash };
  }
  const code = params.get("code");
  if (code) return { kind: "pkce", code };
  return { kind: "otp" };
}

/**
 * Supabase redirects an expired or already-used link back here with
 * `error_code=otp_expired` (or `error=access_denied`), in the query or the
 * hash depending on the flow.
 */
function linkAlreadyInvalid(params: URLSearchParams): boolean {
  const hash =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return [params, hash].some(
    (p) =>
      p.get("error_code") === "otp_expired" ||
      p.get("error") === "access_denied" ||
      p.get("error_code") === "flow_state_expired"
  );
}

function friendlyUpdateError(message: string, status?: number): string {
  const m = message.toLowerCase();
  if (m.includes("different from the old") || m.includes("should be different")) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (m.includes("weak") || m.includes("at least") || m.includes("characters")) {
    return "Mot de passe trop faible. Choisissez-en un plus long, avec chiffres et lettres.";
  }
  if (status === 429 || m.includes("rate") || m.includes("many")) {
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  }
  if (m.includes("fetch") || m.includes("network")) {
    return "Problème de connexion. Vérifiez votre réseau et réessayez.";
  }
  return "Impossible d'enregistrer le nouveau mot de passe pour le moment. Réessayez dans un instant.";
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode] = useState<Mode>(() => modeFrom(searchParams));
  const [expired, setExpired] = useState(() => linkAlreadyInvalid(searchParams));

  // Prefilled from /login so the admin does not retype it, but editable.
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Once the link or code has bought a recovery session, a second submit
  // (e.g. after "must be different from the old password") must not spend it
  // again: Supabase would answer "expired".
  const verified = useRef(false);

  // Own client: no automatic `?code=` exchange on load (detectSessionInUrl
  // false) — the link is spent on submit only — and not the shared
  // singleton, which /login creates with the defaults.
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { isSingleton: false, auth: { detectSessionInUrl: false } }
    )
  );

  const isLink = mode.kind !== "otp";

  /** Spends the link or the code. Returns an error message, or null. */
  async function openRecoverySession(): Promise<string | null> {
    if (verified.current) return null;

    if (mode.kind === "token_hash") {
      const { error: e } = await supabase.auth.verifyOtp({
        token_hash: mode.tokenHash,
        type: "recovery",
      });
      if (e) {
        setExpired(true);
        return EXPIRED_LINK;
      }
    } else if (mode.kind === "pkce") {
      const { error: e } = await supabase.auth.exchangeCodeForSession(mode.code);
      if (e) {
        setExpired(true);
        return EXPIRED_LINK;
      }
    } else {
      const { error: e } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.replace(/\D/g, ""),
        type: "recovery",
      });
      if (e) {
        const m = e.message.toLowerCase();
        if (e.status === 429 || m.includes("rate") || m.includes("many")) {
          return "Trop de tentatives. Patientez une minute avant de réessayer.";
        }
        if (m.includes("fetch") || m.includes("network")) {
          return "Problème de connexion. Vérifiez votre réseau et réessayez.";
        }
        // Wrong and expired codes get the same answer from Supabase.
        return (
          "Code incorrect ou expiré. Vérifiez les 8 chiffres et l'adresse email, " +
          "ou demandez un nouveau code."
        );
      }
    }
    verified.current = true;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isLink) {
      if (!email.trim()) {
        setError("Entrez l'adresse email de votre compte.");
        return;
      }
      if (code.replace(/\D/g, "").length !== 8) {
        setError("Le code doit contenir 8 chiffres.");
        return;
      }
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const sessionError = await openRecoverySession();
      if (sessionError) {
        setError(sessionError);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(friendlyUpdateError(updateError.message, updateError.status));
        return;
      }

      setSuccess(true);
      // Leave no half-used recovery session behind: /login is a clean start.
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

  let body: React.ReactNode;
  if (success) {
    body = (
      <div className="flex items-start gap-2.5 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
        <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
        <p className="text-sm text-green-400">
          Mot de passe mis à jour. Redirection vers la connexion…
        </p>
      </div>
    );
  } else if (expired) {
    body = (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400">{EXPIRED_LINK}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/login?view=forgot")}
          className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
        >
          Demander un nouveau lien
        </button>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Retour à la connexion
        </button>
      </div>
    );
  } else {
    body = (
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-xs text-gray-500">
          {isLink
            ? "Choisissez votre nouveau mot de passe."
            : "Saisissez le code à 8 chiffres reçu par email, puis votre nouveau mot de passe."}
        </p>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!isLink && (
          <>
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
                  placeholder="vous@exemple.com"
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
          </>
        )}

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
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Amana</h1>
          <p className="text-gray-400 mt-1 text-sm">Nouveau mot de passe</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">{body}</div>
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
