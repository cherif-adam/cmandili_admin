export const dynamic = 'force-dynamic'
import { supabaseAdmin } from "@/lib/supabase-admin";
import LiveMap, { type FleetJob, type FleetPoint } from "@/components/LiveMap";
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

/** The statuses that mean a driver is mid-job and worth drawing a route for. */
const ACTIVE_ORDER_STATUSES = ["onTheWay", "pickedUp", "accepted", "preparing"];

/**
 * Which job to draw when a driver is carrying more than one. Lowest rank wins,
 * i.e. the one furthest along — that is the leg they are physically driving
 * right now, and the only one whose route matches where they will actually go
 * next.
 */
const STATUS_RANK: Record<string, number> = {
  onTheWay: 0,
  pickedUp: 1,
  preparing: 2,
  accepted: 3,
};

/**
 * A (0,0) coordinate is the placeholder a freshly-created row carries, not a
 * position off the coast of Africa. Treat it as missing everywhere.
 */
function usablePoint(
  lat: unknown,
  lng: unknown,
  label: string,
): FleetPoint | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln, label };
}

/** The address JSON on an order row; three shapes exist in the wild, all of
 *  which carry latitude/longitude. */
type AddressJson = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  fullAddress?: string | null;
  label?: string | null;
} | null;

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
    // Widened from `driver_id, status`: the map needs both ends of the job to
    // draw a route, not just a count of how many a driver is carrying.
    supabaseAdmin
      .from("orders")
      .select(
        "id, driver_id, status, restaurant_id, supermarket_id, delivery_address, pickup_address"
      )
      .in("status", ACTIVE_ORDER_STATUSES),
  ]);

  // Pickup coordinates for the food/grocery jobs. Courier and facture orders
  // carry their own pickup_address instead and need no lookup.
  const venueIds = [
    ...new Set(
      (activeOrders ?? [])
        .map((o) => o.restaurant_id ?? o.supermarket_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: venues } = venueIds.length
    ? await supabaseAdmin
        .from("vendors")
        .select("id, name, latitude, longitude")
        .in("id", venueIds)
    : { data: [] as { id: string; name: string; latitude: number | null; longitude: number | null }[] };
  const venueById = Object.fromEntries((venues ?? []).map((v) => [v.id, v]));

  const profileById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p])
  );
  const activeByDriver: Record<string, number> = {};
  const jobByDriver: Record<string, FleetJob> = {};
  for (const o of activeOrders ?? []) {
    if (!o.driver_id) continue;
    activeByDriver[o.driver_id] = (activeByDriver[o.driver_id] ?? 0) + 1;

    const venue = venueById[o.restaurant_id ?? o.supermarket_id ?? ""];
    const pickupAddr = o.pickup_address as AddressJson;
    const pickup = venue
      ? usablePoint(venue.latitude, venue.longitude, venue.name ?? "Point de retrait")
      : usablePoint(
          pickupAddr?.latitude,
          pickupAddr?.longitude,
          pickupAddr?.fullAddress ?? "Point de retrait"
        );
    const deliveryAddr = o.delivery_address as AddressJson;
    const dropoff = usablePoint(
      deliveryAddr?.latitude,
      deliveryAddr?.longitude,
      deliveryAddr?.fullAddress ?? deliveryAddr?.label ?? "Livraison"
    );

    // Before the parcel is in the car the driver is heading to the pickup;
    // after it, to the customer. This mirrors the driver app's `beforePickup`
    // rule (order_tracking_screen.dart) rather than the client app's, because
    // this map is watching the driver. Falling back to the other end keeps a
    // route drawable when one side has no usable coordinates.
    const beforePickup = o.status !== "pickedUp" && o.status !== "onTheWay";
    const target = (beforePickup ? pickup : dropoff) ?? dropoff ?? pickup;
    if (!target) continue;

    const job: FleetJob = {
      orderId: o.id,
      status: o.status,
      leg: target === pickup ? "pickup" : "dropoff",
      target,
      pickup,
      dropoff,
    };
    const held = jobByDriver[o.driver_id];
    const rank = STATUS_RANK[o.status] ?? 99;
    const heldRank = held ? STATUS_RANK[held.status] ?? 99 : 100;
    // Tie-break on id so a driver with two jobs at the same stage doesn't get
    // a different route drawn on every refresh.
    if (rank < heldRank || (rank === heldRank && held && o.id < held.orderId)) {
      jobByDriver[o.driver_id] = job;
    }
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
      job: jobByDriver[d.id] ?? null,
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
