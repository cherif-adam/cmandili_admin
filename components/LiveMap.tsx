"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Phone, Package, AlertTriangle } from "lucide-react";

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker&v=weekly`;
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
    if (!apiKey) {
      setFailed(true);
      return;
    }
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

  // Sync markers to the current driver list.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const seen = new Set<string>();

    for (const d of drivers) {
      if (d.lat == null || d.lng == null) continue;
      seen.add(d.id);
      const color = colorFor(d);

      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2.5,
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
        marker.addListener("click", () => openInfo(d, marker));
        markersRef.current[d.id] = marker;
      }
    }

    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    }
  }, [drivers, ready]);

  const openInfo = useCallback((d: FleetDriver, marker: google.maps.Marker) => {
    if (!infoRef.current || !mapRef.current) return;
    const color = colorFor(d);
    const when =
      d.minutesAgo == null
        ? "position inconnue"
        : d.minutesAgo < 1
          ? "à l'instant"
          : `il y a ${d.minutesAgo} min`;
    infoRef.current.setContent(
      `<div style="font-family:Inter,system-ui,sans-serif;min-width:160px;color:#e5e7eb">
         <div style="font-weight:600;margin-bottom:2px">${d.name}</div>
         <div style="color:${color};font-size:12px;margin-bottom:4px">
           ${d.isBlocked ? "Bloqué" : d.activeOrders > 0 ? "En livraison" : "Disponible"}
         </div>
         ${d.phone ? `<div style="font-size:12px;color:#9ca3af">${d.phone}</div>` : ""}
         ${d.activeOrders > 0 ? `<div style="font-size:12px;color:#fbbf24">${d.activeOrders} commande(s)</div>` : ""}
         <div style="font-size:11px;color:#6b7280;margin-top:4px">${when}</div>
       </div>`
    );
    infoRef.current.open({ map: mapRef.current, anchor: marker });
  }, []);

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
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => router.refresh()}
          className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-400">
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
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
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
      ) : failed ? (
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
          className="w-full overflow-hidden rounded-xl border border-gray-800"
          style={{ height: "min(62vh, 540px)", background: "#1f2430" }}
        />
      )}

      {/* Roster of the same online drivers, for scanning names and phones
          without hunting for pins. Clicking a row focuses its marker. */}
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#12151d]">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <tbody>
            {drivers.map((d) => (
              <tr
                key={d.id}
                onClick={() => focus(d)}
                className="cursor-pointer border-b border-gray-800/70 transition-colors last:border-0 hover:bg-gray-800/40"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: colorFor(d) }}
                    />
                    <span className="font-medium text-white">{d.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-400">
                  {d.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={12} />
                      {d.phone}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {d.activeOrders > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-amber-400">
                      <Package size={12} />
                      {d.activeOrders}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-xs text-gray-500">
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
