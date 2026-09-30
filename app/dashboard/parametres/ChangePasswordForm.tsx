"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";

/** Le même minimum qu'à l'inscription des trois applications mobiles. */
const MIN_LENGTH = 6;

type Field = "current" | "next" | "confirm";

/**
 * Changer son mot de passe en étant connecté.
 *
 * Le tableau de bord n'offrait que « Mot de passe oublié » : recevoir un code
 * par e-mail pour changer un mot de passe qu'on connaît déjà.
 *
 * Tout se passe dans le NAVIGATEUR, avec le client utilisateur — jamais par
 * une route d'API et jamais avec `supabaseAdmin`. Deux raisons : le mot de
 * passe actuel ne transite alors par aucun serveur intermédiaire, et la
 * clé de service pourrait changer le mot de passe SANS vérifier l'ancien,
 * ce qui viderait le contrôle de son sens.
 */
export default function ChangePasswordForm() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [shown, setShown] = useState<Record<Field, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  const [canSignOutOthers, setCanSignOutOthers] = useState(false);

  function set(field: Field, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setCanSignOutOthers(false);

    if (!values.current) {
      setFeedback({ ok: false, msg: "Saisissez votre mot de passe actuel" });
      return;
    }
    if (values.next.length < MIN_LENGTH) {
      setFeedback({
        ok: false,
        msg: `Le nouveau mot de passe doit contenir au moins ${MIN_LENGTH} caractères`,
      });
      return;
    }
    if (values.next !== values.confirm) {
      setFeedback({ ok: false, msg: "Les deux mots de passe ne correspondent pas" });
      return;
    }
    if (values.next === values.current) {
      setFeedback({
        ok: false,
        msg: "Le nouveau mot de passe est identique à l'ancien",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const email = sessionData.user?.email;
      if (!email) {
        setFeedback({ ok: false, msg: "Session expirée. Reconnectez-vous." });
        return;
      }

      // Vérifier l'ancien mot de passe en se reconnectant avec : c'est la
      // seule vérification que Supabase offre. Sans elle, un poste laissé
      // ouvert suffirait à changer le mot de passe du compte.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: values.current,
      });
      if (reauthError) {
        setFeedback({ ok: false, msg: "Mot de passe actuel incorrect" });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: values.next,
      });
      if (error) {
        const m = error.message.toLowerCase();
        // Supabase répond en anglais et sans code stable : on lit le message
        // plutôt que de le montrer tel quel à l'administrateur.
        const msg = m.includes("reauthentication")
          ? "Par sécurité, confirmez à nouveau votre identité avant de changer votre mot de passe"
          : m.includes("should be different") || m.includes("same as the old")
            ? "Le nouveau mot de passe est identique à l'ancien"
            : `Impossible de changer le mot de passe : ${error.message}`;
        setFeedback({ ok: false, msg });
        return;
      }

      setValues({ current: "", next: "", confirm: "" });
      setCanSignOutOthers(true);
      setFeedback({
        ok: true,
        msg: "Mot de passe modifié. Vous restez connecté sur ce poste.",
      });
    } catch (err: unknown) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  }

  // Changer un mot de passe ne ferme PAS les sessions ouvertes ailleurs.
  // C'est exactement ce qu'on veut proposer à quelqu'un qui le change parce
  // qu'il le croit compromis.
  async function signOutOthers() {
    setLoading(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setLoading(false);
    setCanSignOutOthers(false);
    setFeedback(
      error
        ? { ok: false, msg: `Impossible : ${error.message}` }
        : { ok: true, msg: "Les autres appareils ont été déconnectés." }
    );
  }

  const inputCls =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:border-orange-500";

  function passwordField(field: Field, label: string, autoComplete: string) {
    return (
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
        <div className="relative">
          <input
            type={shown[field] ? "text" : "password"}
            value={values[field]}
            autoComplete={autoComplete}
            onChange={(e) => set(field, e.target.value)}
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShown((s) => ({ ...s, [field]: !s[field] }))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            aria-label={label}
          >
            {shown[field] ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-orange-500">
          <Lock size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-white">Changer le mot de passe</h3>
          <p className="text-xs text-gray-400 mt-1">
            Saisissez votre mot de passe actuel, puis choisissez-en un nouveau.
            Vous resterez connecté sur ce poste.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {passwordField("current", "Mot de passe actuel", "current-password")}
        {passwordField("next", "Nouveau mot de passe", "new-password")}
        {passwordField("confirm", "Confirmer", "new-password")}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Enregistrement…" : "Changer le mot de passe"}
        </button>

        {canSignOutOthers && (
          <button
            type="button"
            onClick={signOutOthers}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-700 hover:border-gray-500 disabled:opacity-50 text-gray-200 text-sm rounded-lg transition-colors"
          >
            Déconnecter les autres appareils
          </button>
        )}

        <Link
          href="/reset-password"
          className="text-sm text-orange-400 hover:text-orange-300 underline"
        >
          Mot de passe oublié ?
        </Link>

        {feedback && (
          <span
            className={`text-sm ${feedback.ok ? "text-green-400" : "text-red-400"}`}
          >
            {feedback.msg}
          </span>
        )}
      </div>
    </form>
  );
}
