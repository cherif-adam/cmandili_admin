"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Phone, Package, AlertTriangle, Route, X } from "lucide-react";

import {
  isOffRoute,
  MIN_REFETCH_INTERVAL_MS,
  type LatLngLiteral,
} from "@/lib/route-freshness";

export interface FleetPoint {
  lat: number;
  lng: number;
  label: string;
}

/**
 * The delivery a driver is on, reduced to what the map needs to draw a route.
 * `target` is the end they are heading for *now*; pickup and dropoff are both
 * carried so the map can pin the whole job for context.
 */
export interface FleetJob {
  orderId: string;
  status: string;
  leg: "pickup" | "dropoff";
  target: FleetPoint;
  pickup: FleetPoint | null;
  dropoff: FleetPoint | null;
}

export interface FleetDriver {
  id: string;
  name: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  isOnline: boolean;
  isBlocked: boolean;
  minutesAgo: number | null;
  activeOrders: number;
  job: FleetJob | null;
}

/** Decluttered basemap: POI and transit labels compete with the driver pins
 *  and mean nothing here. Two value ramps so the map follows the dashboard
 *  theme instead of staying dark on a light page. */
const DECLUTTER: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "geometry", stylers: [{ color: "#1f2430" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa4b2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#151922" }, { weight: 2 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#39404e" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#222835" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c3342" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#333b4b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3d4658" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#151c29" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#54697d" }] },
];

const LIGHT_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f6f7" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 2 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d8dce1" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eef1ed" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#fdf3e3" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe4ef" }] },
];

function currentMapStyle(): google.maps.MapTypeStyle[] {
  const dark =
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark";
  return [...DECLUTTER, ...(dark ? DARK_STYLE : LIGHT_STYLE)];
}

/** Loads the Maps JS API once per page, even across remounts. */
let mapsPromise: Promise<void> | null = null;
function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    // `routes` carries DirectionsService, used to draw the selected driver's
    // street-following route.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker,routes&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("load-failed"));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

/**
 * Every driver on this map is online, so "online vs offline" carries no
 * information here. The useful split is whether they are free to take a job
 * or already carrying one.
 */
function colorFor(d: FleetDriver) {
  if (d.isBlocked) return "#ef4444";
  if (d.activeOrders > 0) return "#f59e0b";
  return "#10b981";
}

/** The drawn route, kept distinct from the pin palette so the line never reads
 *  as another driver. */
const ROUTE_COLOR = "#2563eb";

/**
 * Stitches the per-step geometry of a Directions leg into one path.
 *
 * `routes[0].overview_path` exists and is one line of code, but it is
 * simplified for display at low zoom: it cuts corners and visibly drifts off
 * the roadway once an admin zooms in on a driver. The per-step paths are the
 * full geometry. This is the same choice RouteService makes on mobile, for the
 * same reason — and the off-route test only means anything against the real
 * line.
 */
function stitchStepPath(leg: google.maps.DirectionsLeg): LatLngLiteral[] {
  const path: LatLngLiteral[] = [];
  for (const step of leg.steps ?? []) {
    for (const p of step.path ?? []) {
      const point = { lat: p.lat(), lng: p.lng() };
      const last = path[path.length - 1];
      // Consecutive steps share their boundary vertex.
      if (last && last.lat === point.lat && last.lng === point.lng) continue;
      path.push(point);
    }
  }
  return path;
}

export default function LiveMap({
  drivers,
  apiKey,
}: {
  drivers: FleetDriver[];
  apiKey: string;
}) {
  const router = useRouter();
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  // ── Route drawing ────────────────────────────────────────────────────────
  // One route at a time, for the driver the admin selected. Drawing every
  // online driver's route at once would be a Directions request per driver per
  // redraw and an unreadable tangle of lines over one small city.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<
    { orderId: string; leg: "pickup" | "dropoff"; distance: string | null; duration: string | null } | null
  >(null);
  // Tagged with the order it belongs to, so a stale failure never sits under a
  // driver the admin has since switched to.
  const [routeError, setRouteError] = useState<{ orderId: string; message: string } | null>(null);
  const directionsRef = useRef<google.maps.DirectionsService | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const endpointsRef = useRef<google.maps.Marker[]>([]);
  /** The drawn line, in the shape RouteFreshness expects. */
  const pathRef = useRef<LatLngLiteral[] | null>(null);
  const lastTargetRef = useRef<{ orderId: string; leg: string } | null>(null);
  const lastFetchAtRef = useRef(0);
  const fetchInFlightRef = useRef(false);
  /** Guards against a slow reply overwriting a newer one. */
  const requestSeqRef = useRef(0);
  /** Frame the route once per leg, not on every 15 s redraw — otherwise the
   *  viewport is yanked out from under the admin while they are looking. */
  const fittedForRef = useRef<string | null>(null);

  // Google reports key/API problems by calling this global and painting its
  // own grey "Oops! Something went wrong" panel — the reason only ever lands
  // in the browser console. Hooking it lets the page say what is actually
  // wrong instead of leaving the admin to open devtools.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gm_authFailure = () => setAuthFailed(true);
  }, []);

  // Create the map once. Re-creating it on every driver update would throw
  // away the viewport the admin just panned to.
  useEffect(() => {
    // A missing key is not a state change to make here — it is known at render
    // time and handled by `missingKey` below.
    if (!apiKey) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapDiv.current || mapRef.current) return;
        const first = drivers[0];
        mapRef.current = new google.maps.Map(mapDiv.current, {
          center: { lat: first?.lat ?? 35.6781, lng: first?.lng ?? 10.0963 },
          zoom: 12,
          styles: currentMapStyle(),
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          // A flat delivery map gains nothing from rotation, and it is easy to
          // end up looking at a sideways city with no obvious way back.
          rotateControl: false,
        });
        infoRef.current = new google.maps.InfoWindow();
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Follow the dashboard theme: watch data-theme on <html> and restyle the
  // basemap in place, so the map does not stay dark on a light page.
  useEffect(() => {
    if (!ready) return;
    const observer = new MutationObserver(() => {
      mapRef.current?.setOptions({ styles: currentMapStyle() });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [ready]);

  const openInfo = useCallback((d: FleetDriver, marker: google.maps.Marker) => {
    if (!infoRef.current || !mapRef.current) return;
    const color = colorFor(d);
    const when =
      d.minutesAgo == null
        ? "position inconnue"
        : d.minutesAgo < 1
          ? "à l'instant"
          : `il y a ${d.minutesAgo} min`;
    // Google's InfoWindow is white in both themes, so these colours are fixed
    // dark-on-light rather than theme variables — the previous light grey was
    // invisible against it.
    infoRef.current.setContent(
      `<div style="font-family:Inter,system-ui,sans-serif;min-width:160px;color:#111827">
         <div style="font-weight:600;margin-bottom:2px">${d.name}</div>
         <div style="color:${color};font-size:12px;margin-bottom:4px">
           ${d.isBlocked ? "Bloqué" : d.activeOrders > 0 ? "En livraison" : "Disponible"}
         </div>
         ${d.phone ? `<div style="font-size:12px;color:#4b5563">${d.phone}</div>` : ""}
         ${d.activeOrders > 0 ? `<div style="font-size:12px;color:#b45309">${d.activeOrders} commande(s)</div>` : ""}
         <div style="font-size:11px;color:#6b7280;margin-top:4px">${when}</div>
       </div>`
    );
    infoRef.current.open({ map: mapRef.current, anchor: marker });
  }, []);

  /** Clicking the selected driver again hides their route. */
  const toggleSelect = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  /**
   * Take the drawn line off the map. Deliberately touches no React state: this
   * runs from an effect, and clearing state synchronously there cascades an
   * extra render every refresh. What the panel shows is derived at render time
   * from the current selection instead.
   */
  const eraseRoute = useCallback(() => {
    polylineRef.current?.setMap(null);
    for (const m of endpointsRef.current) m.setMap(null);
    endpointsRef.current = [];
    pathRef.current = null;
    lastTargetRef.current = null;
    fittedForRef.current = null;
    requestSeqRef.current += 1; // abandon any reply still in flight
  }, []);

  /**
   * Ask Google for the driver's route to whichever end of the job they are
   * heading for, and draw it.
   */
  const drawRoute = useCallback(async (driver: FleetDriver) => {
    const map = mapRef.current;
    const job = driver.job;
    if (!map || !job || driver.lat == null || driver.lng == null) return;
    if (fetchInFlightRef.current) return;
    if (!google.maps.DirectionsService) {
      setRouteError({ orderId: job.orderId, message: "Le service d'itinéraire n'est pas chargé." });
      return;
    }

    fetchInFlightRef.current = true;
    const seq = ++requestSeqRef.current;
    lastFetchAtRef.current = Date.now();
    lastTargetRef.current = { orderId: job.orderId, leg: job.leg };

    try {
      const service = (directionsRef.current ??= new google.maps.DirectionsService());
      const result = await service.route({
        origin: { lat: driver.lat, lng: driver.lng },
        destination: { lat: job.target.lat, lng: job.target.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        // departureTime is what makes Google return duration_in_traffic —
        // without it the ETA ignores live conditions. Same request shape as
        // RouteService.fetchDrivingRoute on mobile.
        drivingOptions: { departureTime: new Date() },
      });
      if (seq !== requestSeqRef.current) return;

      const leg = result.routes[0]?.legs[0];
      const path = leg ? stitchStepPath(leg) : [];
      if (path.length < 2) {
        setRouteError({ orderId: job.orderId, message: "Aucun itinéraire routier vers ce point." });
        return;
      }

      pathRef.current = path;
      const line = (polylineRef.current ??= new google.maps.Polyline({
        strokeColor: ROUTE_COLOR,
        strokeOpacity: 0.9,
        strokeWeight: 5,
        // Under the driver pins, so a marker is never hidden by its own route.
        zIndex: 1,
      }));
      line.setPath(path);
      line.setMap(map);

      // Pin both ends of the job: the one being driven to, and the other for
      // context. Without them the line just stops in the middle of a street.
      for (const m of endpointsRef.current) m.setMap(null);
      endpointsRef.current = [];
      const ends: { point: FleetPoint; active: boolean }[] = [];
      if (job.pickup) ends.push({ point: job.pickup, active: job.leg === "pickup" });
      if (job.dropoff) ends.push({ point: job.dropoff, active: job.leg === "dropoff" });
      for (const end of ends) {
        endpointsRef.current.push(
          new google.maps.Marker({
            position: { lat: end.point.lat, lng: end.point.lng },
            map,
            title: end.point.label,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: end.active ? 7 : 5.5,
              fillColor: end.active ? ROUTE_COLOR : "#94a3b8",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            zIndex: 2,
          })
        );
      }

      setRouteError(null);
      setRoute({
        orderId: job.orderId,
        leg: job.leg,
        distance: leg?.distance?.text ?? null,
        duration: leg?.duration_in_traffic?.text ?? leg?.duration?.text ?? null,
      });

      const fitKey = `${job.orderId}:${job.leg}`;
      if (fittedForRef.current !== fitKey) {
        fittedForRef.current = fitKey;
        const bounds = new google.maps.LatLngBounds();
        for (const p of path) bounds.extend(p);
        map.fitBounds(bounds, 64);
      }
    } catch {
      if (seq === requestSeqRef.current) {
        setRouteError({ orderId: job.orderId, message: "Itinéraire indisponible pour le moment." });
      }
    } finally {
      fetchInFlightRef.current = false;
    }
  }, []);

  // Sync markers to the current driver list.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const seen = new Set<string>();

    for (const d of drivers) {
      if (d.lat == null || d.lng == null) continue;
      seen.add(d.id);
      const color = colorFor(d);
      const isSelected = d.id === selectedId;

      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isSelected ? 11 : 9,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: isSelected ? ROUTE_COLOR : "#ffffff",
        strokeWeight: isSelected ? 3.5 : 2.5,
      };

      const existing = markersRef.current[d.id];
      if (existing) {
        existing.setPosition({ lat: d.lat, lng: d.lng });
        existing.setIcon(icon);
        existing.setTitle(d.name);
      } else {
        const marker = new google.maps.Marker({
          position: { lat: d.lat, lng: d.lng },
          map,
          icon,
          title: d.name,
          // Drivers carrying orders sit above idle ones when they overlap.
          zIndex: d.activeOrders > 0 ? 3 : d.isOnline ? 2 : 1,
        });
        marker.addListener("click", () => {
          openInfo(d, marker);
          toggleSelect(d.id);
        });
        markersRef.current[d.id] = marker;
      }
    }

    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    }
  }, [drivers, ready, selectedId, openInfo, toggleSelect]);

  // Draw / refresh / clear the selected driver's route.
  //
  // `drivers` is a fresh array on every 15 s server refresh, so this runs with
  // the driver's new position each time. The re-fetch rule is the mobile apps'
  // rule, imported rather than re-invented: a driver following the drawn line
  // stays within GPS noise of it however far they go and costs nothing, while
  // one who turns down a different street is off the line within a block and
  // gets a new route — throttled so a noisy track cannot spam the API.
  useEffect(() => {
    if (!ready) return;

    const driver = selectedId ? drivers.find((d) => d.id === selectedId) : undefined;
    // Nothing selected, or the selected driver went offline, finished their
    // job, or has none to draw. The selection id is left alone: if they come
    // back online on a later refresh their route simply resumes.
    if (!driver?.job || driver.lat == null || driver.lng == null) {
      eraseRoute();
      return;
    }

    const job = driver.job;
    const targetChanged =
      lastTargetRef.current?.orderId !== job.orderId ||
      lastTargetRef.current?.leg !== job.leg;
    const strayed = isOffRoute(pathRef.current, { lat: driver.lat, lng: driver.lng });
    const rateLimitPassed = Date.now() - lastFetchAtRef.current > MIN_REFETCH_INTERVAL_MS;

    // A changed destination is wrong outright, so it bypasses the rate limit.
    if (targetChanged || (strayed && rateLimitPassed)) {
      void drawRoute(driver);
    }
  }, [ready, selectedId, drivers, drawRoute, eraseRoute]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [autoRefresh, router]);

  function fitAll() {
    const map = mapRef.current;
    if (!map) return;
    const pts = drivers.filter((d) => d.lat != null && d.lng != null);
    if (!pts.length) return;
    if (pts.length === 1) {
      map.setCenter({ lat: pts[0].lat!, lng: pts[0].lng! });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const d of pts) bounds.extend({ lat: d.lat!, lng: d.lng! });
    map.fitBounds(bounds, 48);
  }

  function focus(d: FleetDriver) {
    const map = mapRef.current;
    if (!map || d.lat == null || d.lng == null) return;
    map.panTo({ lat: d.lat, lng: d.lng });
    map.setZoom(15);
    const marker = markersRef.current[d.id];
    if (marker) openInfo(d, marker);
    toggleSelect(d.id);
  }

  const missingKey = !apiKey;
  const selected = selectedId ? drivers.find((d) => d.id === selectedId) ?? null : null;
  // Only show a result that belongs to the job currently under the cursor —
  // the state itself is never cleared from an effect, so it can lag a switch
  // between two drivers by one render.
  const activeRoute =
    route && selected?.job && route.orderId === selected.job.orderId && route.leg === selected.job.leg
      ? route
      : null;
  const activeError =
    routeError && selected?.job && routeError.orderId === selected.job.orderId
      ? routeError.message
      : null;
  const buttonStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => router.refresh()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-opacity hover:opacity-80"
          style={buttonStyle}
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
        <label
          className="flex cursor-pointer items-center gap-2 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="accent-orange-500"
          />
          Auto 15 s
        </label>
        <button
          onClick={fitAll}
          className="rounded-lg px-3 py-1.5 text-sm transition-opacity hover:opacity-80"
          style={buttonStyle}
        >
          Tout voir
        </button>
        {/* The page only passes online drivers, so the legend covers what can
            actually appear: free, carrying orders, or blocked-but-connected. */}
        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> En livraison
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Bloqué
          </span>
        </div>
      </div>

      {/* Selection panel: what the drawn route is, or why there isn't one.
          Only ever describes a single driver — see the note on the route
          effect for why the fleet view stays pins-only. */}
      {selected && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span className="flex items-center gap-2 font-medium" style={{ color: "var(--text)" }}>
            <Route size={15} style={{ color: ROUTE_COLOR }} />
            {selected.name}
          </span>

          {activeRoute ? (
            <>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
              >
                {activeRoute.leg === "pickup" ? "Vers le point de retrait" : "Vers le client"}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                {[activeRoute.distance, activeRoute.duration].filter(Boolean).join(" · ")}
              </span>
              <span className="truncate" style={{ color: "var(--text-faint)" }}>
                {selected.job?.target.label}
              </span>
            </>
          ) : activeError ? (
            <span style={{ color: "var(--text-muted)" }}>{activeError}</span>
          ) : selected.job ? (
            <span style={{ color: "var(--text-muted)" }}>Calcul de l&apos;itinéraire…</span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>
              Aucune commande active — rien à tracer.
            </span>
          )}

          <button
            onClick={() => setSelectedId(null)}
            className="ml-auto flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={13} />
            Masquer
          </button>
        </div>
      )}

      {authFailed ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-300">
            <AlertTriangle size={18} />
            L&apos;API « Maps JavaScript » n&apos;est pas activée sur cette clé
          </div>
          <p className="text-sm text-gray-400">
            La clé fonctionne (Directions et Places répondent), mais une carte
            web a besoin d&apos;une API distincte. Dans{" "}
            <a
              href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 underline"
            >
              Google Cloud Console → Bibliothèque
            </a>
            , activez <strong>Maps JavaScript API</strong>, puis ajoutez-la à la
            liste « API sélectionnées » de la clé. Comptez ~1 minute avant
            que ce soit effectif.
          </p>
        </div>
      ) : failed || missingKey ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-300">
            <AlertTriangle size={18} />
            La carte Google ne peut pas se charger
          </div>
          <p className="text-sm text-gray-400">
            Vérifiez que <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> est défini dans{" "}
            <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">.env.local</code>{" "}
            et que l&apos;API <strong>Maps JavaScript</strong> est activée pour cette clé
            dans la console Google Cloud.
          </p>
        </div>
      ) : (
        <div
          ref={mapDiv}
          className="w-full overflow-hidden rounded-xl"
          style={{ height: "min(62vh, 540px)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
        />
      )}

      {/* Roster of the same online drivers, for scanning names and phones
          without hunting for pins. Clicking a row focuses its marker and
          draws that driver's route; clicking it again hides the route. */}
      <div
        className="overflow-hidden rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <tbody>
            {drivers.map((d) => (
              <tr
                key={d.id}
                onClick={() => focus(d)}
                className="cursor-pointer transition-colors"
                style={{
                  borderTop: "1px solid var(--border)",
                  background: d.id === selectedId ? "var(--brand-soft)" : undefined,
                }}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: colorFor(d) }}
                    />
                    <span className="font-medium" style={{ color: "var(--text)" }}>{d.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3" style={{ color: "var(--text-muted)" }}>
                  {d.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={12} />
                      {d.phone}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {d.activeOrders > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-amber-500">
                      <Package size={12} />
                      {d.activeOrders}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-xs" style={{ color: "var(--text-faint)" }}>
                  {d.minutesAgo == null
                    ? "—"
                    : d.minutesAgo < 1
                      ? "à l'instant"
                      : `il y a ${d.minutesAgo} min`}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
