"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "@/assets/logo.png";
import { signOut } from "@/app/login/actions";
import {
  BarChart3,
  CircleDollarSign,
  ContactRound,
  Home,
  HandCoins,
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
  { href: "/donations", label: "Donations", icon: HandCoins, children: [
    { href: "/donations/360", label: "360 View", icon: ContactRound },
    { href: "/donations/list", label: "Donation List", icon: CircleDollarSign },
  ] },
  { href: "/labels", label: "Generate Labels", icon: Printer },
  { href: "/reports", label: "Reports", icon: BarChart3 },
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
        <Image
          className="brand-logo"
          src={logo}
          alt="Kambaramma"
          width={96}
          height={96}
          priority
        />
      </div>

      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon, children }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <div className={`nav-group ${active ? "active" : ""}`} key={href}>
              <Link href={children?.[0]?.href ?? href} className={`nav-item ${active ? "active" : ""}`} onClick={onClose}>
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
              {children && active && <div className="nav-children">{children.map((child) => { const ChildIcon=child.icon; return <Link key={child.href} href={child.href} className={pathname === child.href || pathname.startsWith(`${child.href}/`) ? "active" : ""} onClick={onClose}><ChildIcon size={15} aria-hidden="true"/><span>{child.label}</span></Link>})}</div>}
            </div>
          );
        })}
      </nav>

      <form className="sidebar-logout-form" action={signOut} onSubmit={onClose}>
        <button className="sidebar-logout" type="submit">
          <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </form>
    </aside>
    </>
  );
}
