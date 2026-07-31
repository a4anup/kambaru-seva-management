import { CalendarDays, LogOut, Menu } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { useStaffSession } from "@/components/auth/StaffSessionProvider";

export function Header({
  title,
  menuOpen,
  onMenuToggle,
  className = "",
}: {
  title: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  className?: string;
}) {
  const staff = useStaffSession();
  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <header className={`topbar ${className}`.trim()}>
      <div className="topbar-title">
        <button
          className="icon-button mobile-menu-trigger"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="application-sidebar"
          onClick={onMenuToggle}
          type="button"
        >
          <Menu size={22} />
        </button>
        <h2>{title}</h2>
        <span className="ornament" aria-hidden="true">✦</span>
      </div>
      <div className="topbar-actions">
        <span className="date-label"><CalendarDays size={18} /> {formattedDate}</span>
        {staff && (
          <>
            <div className="profile">
              <div className="avatar">
                {staff.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div><strong>{staff.displayName}</strong><small>{staff.role}</small></div>
            </div>
            <form action={signOut}>
              <button className="icon-button" aria-label="Sign out" title="Sign out" type="submit">
                <LogOut size={19} />
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
