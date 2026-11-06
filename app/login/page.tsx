"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Lock, Mail, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `/login?view=forgot` opens straight on the reset request: the expired-link
  // screen of /reset-password sends the admin here.
  const [view, setView] = useState<"login" | "forgot">(() =>
    searchParams.get("view") === "forgot" ? "forgot" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Derived, not stored: ?error=not_admin is known at render time, and
  // setting state from an effect for it cascades an extra render. `error`
  // still wins once the form produces one of its own.
  const notAdmin = searchParams.get("error") === "not_admin";
  const shownError =
    error ?? (notAdmin ? "Ce compte n'a pas les droits administrateur." : null);

  function switchView(next: "login" | "forgot") {
    setError(null);
    setSuccess(null);
    setView(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Les champs sont `required`, mais la bulle native du navigateur est
    // discrete et parfois absente : un formulaire qui PARAIT rempli (voir les
    // placeholders) donnait alors un bouton qui ne faisait visiblement rien.
    // On affiche la meme banniere rouge que les autres erreurs.
    if (!email.trim()) {
      setError("Entrez votre adresse email.");
      return;
    }
    if (!password) {
      setError("Entrez votre mot de passe.");
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Tout echec affichait « email ou mot de passe incorrect », y compris
        // une panne du service : l'administrateur retapait un mot de passe
        // pourtant juste. On distingue ce qui vient de lui de ce qui vient du
        // serveur.
        const m = signInError.message.toLowerCase();
        const status = signInError.status ?? 0;
        if (m.includes("invalid login credentials") || status === 400) {
          setError("Email ou mot de passe incorrect.");
        } else if (m.includes("email not confirmed")) {
          setError("Confirmez votre email avant de vous connecter.");
        } else if (status >= 500 || m.includes("unavailable")) {
          setError(
            "Le service est momentanement indisponible. Reessayez dans un instant."
          );
        } else if (m.includes("fetch") || m.includes("network")) {
          setError("Probleme de connexion. Verifiez votre reseau.");
        } else {
          setError(`Connexion impossible : ${signInError.message}`);
        }
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

    const address = email.trim();
    if (!address) {
      setError("Entrez votre adresse email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Cette adresse email n'est pas valide.");
      return;
    }

    setLoading(true);

    try {
      // redirectTo = this dashboard's own reset page, on whatever domain it is
      // served from. Supabase only honours it if it is in Auth > URL
      // Configuration > Redirect URLs; the "Reset password" template shows the
      // admin link only when it differs from the Site URL, so the mobile apps
      // (which pass none) keep their code-only email. See cmandili_context.md.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        // Never the raw message: say what the admin can do about it.
        const m = resetError.message.toLowerCase();
        const status = resetError.status ?? 0;
        if (status === 429 || m.includes("rate limit") || m.includes("security purposes")) {
          setError(
            "Trop de demandes d'email en peu de temps. Patientez quelques minutes avant de réessayer."
          );
        } else if (m.includes("fetch") || m.includes("network")) {
          setError("Problème de connexion. Vérifiez votre réseau et réessayez.");
        } else if (m.includes("invalid") && m.includes("email")) {
          setError("Cette adresse email n'est pas valide.");
        } else {
          setError(
            "L'email n'a pas pu être envoyé pour le moment. Réessayez dans quelques minutes."
          );
        }
        return;
      }

      // Supabase answers "ok" even for an address without an account -- on
      // purpose, so as not to reveal who is registered. Say exactly that.
      setSuccess("Si cet email existe, un lien de réinitialisation a été envoyé.");
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
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Réinitialiser le mot de passe
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {shownError && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{shownError}</p>
          </div>
        )}

        {success ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
              <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
              <p className="text-sm text-green-400">{success}</p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pensez à regarder dans le dossier spam. L&apos;email contient aussi un
              code à 8 chiffres, utilisable si le lien ne s&apos;ouvre pas.
            </p>
            <button
              type="button"
              onClick={() =>
                router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`)
              }
              className="w-full rounded px-1 py-1 text-xs underline underline-offset-2 transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              style={{ color: "var(--brand-text)" }}
            >
              Saisir le code reçu
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgot} noValidate className="space-y-4">
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
                  placeholder="vous@exemple.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Envoi…" : "Envoyer le lien"}
            </button>

            {/* Pour qui a deja recu son code et n'a pas besoin d'en redemander
                un : on saute directement a l'ecran de saisie, avec l'adresse
                deja remplie. */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/reset-password?email=${encodeURIComponent(email.trim())}`
                )
              }
              className="w-full rounded px-1 py-1 text-xs underline underline-offset-2 transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              style={{ color: "var(--text-muted)" }}
            >
              J&apos;ai déjà un code
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleLogin}
      noValidate
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4"
    >
      {/* `noValidate` : la bulle native du navigateur s'affiche hors du flux,
          disparait au moindre clic et ne se voit pratiquement pas ici. Elle
          bloquait pourtant l'envoi, donc notre propre message n'etait jamais
          atteint -- le bouton paraissait mort. La validation est faite dans le
          handler, qui affiche la meme banniere rouge que les autres erreurs.
          `required` reste sur les champs pour les lecteurs d'ecran. */}
      {shownError && (
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400">{shownError}</p>
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
            placeholder="vous@exemple.com"
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
          {/* Un placeholder fait de points est indiscernable d'un mot de
              passe deja saisi : c'est precisement ce qui a fait croire le
              champ rempli. Des mots, donc. */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <div className="flex justify-end">
          {/* Les utilitaires `gray-*` de Tailwind ne sont pas generes dans ce
              projet : un `bg-gray-900` pose sur un element neuf ressort blanc.
              Ce bouton portait `text-gray-500`, inerte, et retombait donc sur
              --text-faint (#9aa4ad) sur carte blanche -- 2.3:1 de contraste,
              soit un texte qu'on prend pour une legende desactivee. Avec 124
              x 16 px et aucun soulignement, un clic a quelques pixels pres
              tombait a cote. Couleur de marque, soulignement, zone de clic
              elargie et anneau de focus visible au clavier. */}
          <button
            type="button"
            onClick={() => switchView("forgot")}
            className="-mr-1 inline-flex min-h-[36px] items-center rounded px-2 py-2 text-xs underline underline-offset-2 transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            style={{ color: "var(--brand-text)" }}
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
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="Amana"
            width={88}
            height={88}
            className="mx-auto mb-3 object-contain"
            priority
          />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Panneau d&apos;administration
          </p>
        </div>
        <Suspense fallback={<div className="h-48 bg-gray-900 rounded-xl animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
