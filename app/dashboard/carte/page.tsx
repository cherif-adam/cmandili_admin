export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import LiveMap from "@/components/LiveMap";
import StatsCard from "@/components/StatsCard";
import PageHeader from "@/components/PageHeader";
import { Truck, Wifi, WifiOff, Navigation, MapPin } from "lucide-react";

/**
 * Live fleet map — where every driver is right now.
 *
 * Drivers report their position to `drivers.current_lat/lng` on every GPS
 * tick. The Livreurs page already reads those columns but only prints them in
 * a table; this shows them where they mean something.
 *
 * The map is Google Maps (Maps JavaScript API), matching the three mobile
 * apps. That API must be enabled on the key in Google Cloud Console and the
 * key exposed as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — it is a browser key, so it
 * is public by design and should be restricted by HTTP referrer.
 */

/** Beyond this, a position is stale and the driver is drawn as offline. */
const STALE_AFTER_MINUTES = 10;

async function getFleet() {
  const { data: drivers, error } = await supabaseAdmin
    .from("drivers")
    .select("id, user_id, is_online, is_blocked, current_lat, current_lng, last_location_update");

  if (error || !drivers?.length) return [];

  const userIds = drivers.map((d) => d.user_id).filter(Boolean);
  const [{ data: profiles }, { data: activeOrders }] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; phone: string | null }[] }),
    supabaseAdmin
      .from("orders")
      .select("driver_id, status")
      .in("status", ["onTheWay", "pickedUp", "accepted", "preparing"]),
  ]);

  const profileById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p])
  );
  const activeByDriver: Record<string, number> = {};
  for (const o of activeOrders ?? []) {
    if (!o.driver_id) continue;
    activeByDriver[o.driver_id] = (activeByDriver[o.driver_id] ?? 0) + 1;
  }

  const now = Date.now();
  return drivers.map((d) => {
    const updated = d.last_location_update ? new Date(d.last_location_update).getTime() : 0;
    const minutesAgo = updated ? Math.round((now - updated) / 60000) : null;
    const profile = profileById[d.user_id];
    return {
      id: d.id,
      name: profile?.full_name ?? "Livreur",
      phone: profile?.phone ?? null,
      lat: d.current_lat != null ? Number(d.current_lat) : null,
      lng: d.current_lng != null ? Number(d.current_lng) : null,
      isOnline: (d.is_online ?? false) && minutesAgo !== null && minutesAgo <= STALE_AFTER_MINUTES,
      isBlocked: d.is_blocked ?? false,
      minutesAgo,
      activeOrders: activeByDriver[d.id] ?? 0,
    };
  });
}

export default async function CartePage() {
  const fleet = await getFleet();

  // A driver at exactly (0,0) has never sent a real fix — the delivery row is
  // created with placeholder zeros. Drawing them would put a pin in the
  // Atlantic, so they count as "no position".
  const located = fleet.filter(
    (d) => d.lat != null && d.lng != null && !(d.lat === 0 && d.lng === 0)
  );

  // Only drivers who are online right now go on the map. `isOnline` already
  // requires a GPS fix within the last 10 minutes, so a driver whose app was
  // killed by the OS while the flag stayed true is excluded too — plotting
  // them would show someone working at a position they left long ago.
  const online = located.filter((d) => d.isOnline);
  const delivering = online.filter((d) => d.activeOrders > 0);
  const offline = fleet.length - online.length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MapPin}
        title="Carte des livreurs"
        subtitle="Livreurs en ligne uniquement — actualisé toutes les 15 s."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatsCard title="Livreurs en ligne" value={online.length} icon={Wifi} color="green" />
        <StatsCard title="En livraison" value={delivering.length} icon={Navigation} color="orange" />
        <StatsCard title="Disponibles" value={online.length - delivering.length} icon={Truck} color="blue" />
        <StatsCard title="Hors ligne" value={offline} icon={WifiOff} color="purple" />
      </div>

      {online.length === 0 ? (
        <div
          className="rounded-lg p-10 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <WifiOff className="mx-auto mb-3" size={28} style={{ color: "var(--text-faint)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Aucun livreur en ligne pour le moment.
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-faint)" }}>
            {offline > 0
              ? `${offline} livreur(s) hors ligne. La carte s'affichera dès qu'un livreur se connecte.`
              : "La carte s'affichera dès qu'un livreur se connecte."}
          </p>
        </div>
      ) : (
        <LiveMap
          drivers={online}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
        />
      )}
    </div>
  );
}
