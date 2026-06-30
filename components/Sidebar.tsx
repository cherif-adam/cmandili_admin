"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  BarChart3,
  Users,
  Tag,
  Settings,
  ClipboardList,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/dashboard/livreurs", label: "Livreurs", icon: Truck },
  { href: "/dashboard/restaurants", label: "Restaurants", icon: UtensilsCrossed },
  { href: "/dashboard/supermarkets", label: "Supermarchés", icon: ShoppingCart },
  { href: "/dashboard/commandes", label: "Commandes", icon: ShoppingBag },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/finances", label: "Finances", icon: BarChart3 },
  { href: "/dashboard/promos", label: "Promotions", icon: Tag },
  { href: "/dashboard/audit", label: "Journal d'activité", icon: ClipboardList },
  { href: "/dashboard/parametres", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">Cmandili</h1>
        <p className="text-xs text-gray-400 mt-0.5">Administration</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-orange-500/20 text-orange-400"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-800 space-y-1">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
        <p className="text-xs text-gray-600 px-3">v1.0.0 — Admin Panel</p>
      </div>
    </aside>
  );
}
