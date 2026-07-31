import { Bell, CalendarDays, Menu } from "lucide-react";

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
        <button className="icon-button notification" aria-label="Notifications" type="button">
          <Bell size={20} />
          <span>2</span>
        </button>
        <div className="profile">
          <div className="avatar">AS</div>
          <div><strong>Anil Shetty</strong><small>Admin</small></div>
        </div>
      </div>
    </header>
  );
}
