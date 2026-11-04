/**
 * Pas d'arrondi des montants, réglage `money_rounding_step` de
 * `global_settings`, en dinars.
 *
 * La base arrondit chaque montant qu'elle calcule (frais de livraison, remise
 * fidélité, commissions, prix promo) au multiple de ce pas le plus proche,
 * avec `public.round_money(x)`. 0.050 = 50 millimes : la plus petite somme
 * qu'on rend vraiment en espèces. 0.001 revient au calcul au millime.
 *
 * L'admin ne calcule aucun montant lui-même : il lit platform_fee,
 * driver_fee_cut et les règlements écrits par la base. Ce module ne sert qu'à
 * valider la saisie du pas.
 */

export const DEFAULT_MONEY_STEP = 0.05;
export const MIN_MONEY_STEP = 0.001;
export const MAX_MONEY_STEP = 1;

/**
 * Le pas saisi s'il est valable, sinon null : un nombre entre 0,001 et 1 DT,
 * fait de millimes entiers (0.050 oui, 0.0505 non). Accepte la virgule.
 */
export function parseMoneyStep(value: unknown): number | null {
  const n =
    typeof value === "string" ? Number(value.trim().replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < MIN_MONEY_STEP || n > MAX_MONEY_STEP) return null;
  const millimes = Math.round(n * 1000);
  if (Math.abs(n * 1000 - millimes) > 1e-6) return null;
  return millimes / 1000;
}

/** La valeur écrite dans global_settings : toujours 3 décimales ("0.050"). */
export function formatMoneyStep(step: number): string {
  return step.toFixed(3);
}
