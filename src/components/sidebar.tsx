"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const menuItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "CRM", href: "/crm" },
  { label: "Agenda Matriz", href: "/agenda/matriz" },
  { label: "Agenda Sinos", href: "/agenda/sinos" },
  { label: "Agenda Litoral", href: "/agenda/litoral" },
  { label: "Upgrades", href: "/upgrades" },
  { label: "Metas", href: "/metas" },
  { label: "Config (Admin)", href: "/config" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-6 text-lg font-semibold">Menu</div>
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
