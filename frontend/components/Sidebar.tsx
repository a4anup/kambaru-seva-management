"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  LogOut,
  Printer,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/devotees", label: "Devotees", icon: Users },
  { href: "/poojas", label: "Poojas", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/labels", label: "Generate Labels", icon: Printer },
  { href: "/audit", label: "Audit Log", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open = false,
  onClose,
  className = "",
}: {
  open?: boolean;
  onClose?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <>
    <button
      className={`sidebar-backdrop ${open ? "open" : ""}`}
      aria-label="Close navigation menu"
      onClick={onClose}
      type="button"
    />
    <aside id="application-sidebar" className={`sidebar ${open ? "open" : ""} ${className}`.trim()}>
      <div className="brand">
        <div className="brand-icon" aria-hidden="true">ॐ</div>
      </div>

      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`} onClick={onClose}>
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <Link className="sidebar-logout" href="/login" onClick={onClose}>
        <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
        <span>Logout</span>
      </Link>
    </aside>
    </>
  );
}
