"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`temple-app ${className}`.trim()}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="main-content">
        <Header title={title} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((current) => !current)} />
        {children}
      </main>
    </div>
  );
}
