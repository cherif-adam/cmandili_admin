"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  Truck,
  MapPin,
  UtensilsCrossed,
  ShoppingCart,
  Store,
  ShoppingBag,
  BarChart3,
  Users,
  Tag,
  Settings,
  ClipboardList,
  LogOut,
  Gift,
  LifeBuoy,
  Star,
  BellOff,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

/**
 * Navigation in four short groups.
 *
 * Sixteen items in one flat column gave every destination equal weight, so
 * finding anything meant reading the whole list. Day-to-day work (orders,
 * drivers, the map) now sits at the top, unlabelled and always open; the
 * rest is grouped and collapsible, and only the group you are inside opens
 * by default.
 */
const PRIMARY = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/dashboard/commandes", label: "Commandes", icon: ShoppingBag },
  { href: "/dashboard/livreurs", label: "Livreurs", icon: Truck },
  { href: "/dashboard/carte", label: "Carte", icon: MapPin },
];

const GROUPS = [
  {
    id: "catalogue",
    label: "Catalogue",
    items: [
      { href: "/dashboard/restaurants", label: "Restaurants", icon: UtensilsCrossed },
      { href: "/dashboard/supermarkets", label: "Supermarchés", icon: ShoppingCart },
      { href: "/dashboard/vendors", label: "Boutiques", icon: Store },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    items: [
      { href: "/dashboard/clients", label: "Clients", icon: Users },
      { href: "/dashboard/finances", label: "Finances", icon: BarChart3 },
      { href: "/dashboard/fidelite", label: "Fidélité", icon: Gift },
      { href: "/dashboard/promos", label: "Promotions", icon: Tag },
    ],
  },
  {
    id: "relation",
    label: "Relation client",
    items: [
      { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
      { href: "/dashboard/avis", label: "Avis", icon: Star },
    ],
  },
  {
    id: "systeme",
    label: "Système",
    items: [
      { href: "/dashboard/appareils", label: "Notifications", icon: BellOff },
      { href: "/dashboard/audit", label: "Journal", icon: ClipboardList },
      { href: "/dashboard/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

const ALL_ITEMS = [...PRIMARY, ...GROUPS.flatMap((g) => g.items)];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Open the group containing the current page, and only that one.
  useEffect(() => {
    const match = GROUPS.find((g) => g.items.some((i) => i.href === pathname));
    setExpanded(match?.id ?? null);
  }, [pathname]);

  // Close the drawer after navigating, or it covers the page just opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const current = ALL_ITEMS.find((i) => i.href === pathname);

  function itemLink(
    { href, label, icon: Icon }: { href: string; label: string; icon: typeof Truck },
    nested = false
  ) {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        title={label}
        className={`mb-px flex items-center gap-2.5 rounded-md py-1.5 text-[13px] transition-colors md:justify-center md:px-0 md:py-2 xl:justify-start xl:py-1.5 ${
          nested ? "pl-7 pr-2.5 xl:pl-7" : "px-2.5 xl:px-2.5"
        }`}
        style={{
          background: active ? "var(--brand-soft)" : "transparent",
          color: active ? "var(--brand-text)" : "var(--text-muted)",
          fontWeight: active ? 600 : 400,
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon size={15} className="shrink-0" />
        <span className="md:hidden xl:inline">{label}</span>
      </Link>
    );
  }

  return (
    <>
      {/* Phone top bar — also names the current page, so you can tell where
          you are without opening the drawer. */}
      <div
        className="fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-2 px-3 md:hidden"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => setOpen(true)}
          className="rounded-md p-1.5"
          style={{ color: "var(--text-muted)" }}
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>
        <Image src="/logo.png" alt="" width={20} height={20} className="object-contain" />
        <span className="truncate text-sm font-semibold">
          {current?.label ?? "Amana"}
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col transition-transform md:static md:w-14 md:translate-x-0 xl:w-52 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <div
          className="flex h-12 shrink-0 items-center gap-2 px-3 md:justify-center xl:justify-start xl:px-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <Image
            src="/logo.png"
            alt="Amana"
            width={24}
            height={24}
            className="shrink-0 object-contain"
            priority
          />
          <span className="text-sm font-semibold md:hidden xl:inline">Amana</span>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto rounded-md p-1 md:hidden"
            style={{ color: "var(--text-muted)" }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
          <div className="ml-auto hidden xl:block">
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 md:px-1.5 xl:px-2">
          {PRIMARY.map((i) => itemLink(i))}

          {GROUPS.map((g) => {
            const isOpen = expanded === g.id;
            const hasActive = g.items.some((i) => i.href === pathname);
            return (
              <div key={g.id} className="mt-1.5">
                {/* On the tablet rail there is no room for a group header, so
                    the items show as a plain icon run separated by a rule. */}
                <div
                  className="mx-1 mb-1 hidden md:block xl:hidden"
                  style={{ borderTop: "1px solid var(--border)" }}
                />
                <button
                  onClick={() => setExpanded(isOpen ? null : g.id)}
                  className="flex w-full items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors md:hidden xl:flex"
                  style={{ color: hasActive ? "var(--brand-text)" : "var(--text-faint)" }}
                >
                  {g.label}
                  <ChevronDown
                    size={12}
                    className="ml-auto transition-transform"
                    style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                </button>
                <div className={isOpen ? "block" : "hidden md:block xl:hidden"}>
                  {g.items.map((i) => itemLink(i, true))}
                </div>
              </div>
            );
          })}
        </nav>

        <div
          className="shrink-0 px-2 py-2 md:px-1.5 xl:px-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="hidden md:flex md:justify-center xl:hidden">
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            title="Déconnexion"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors md:justify-center md:px-0 md:py-2 xl:justify-start xl:px-2.5"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <LogOut size={15} className="shrink-0" />
            <span className="md:hidden xl:inline">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}
