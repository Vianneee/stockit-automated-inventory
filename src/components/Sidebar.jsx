import { useApp } from "../lib/AppContext.js";
import { ROLE_LABELS } from "../lib/helpers.js";
import { canOpen } from "../lib/roles.js";
import { Icon } from "./ui.jsx";

const MAIN = [
  { to: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { to: "items", label: "Items", icon: "stack-2" },
  { to: "transactions", label: "Transactions", icon: "arrows-exchange" },
  { to: "alerts", label: "Alerts", icon: "bell" },
];

export default function Sidebar({ section, profile, themeIsDark, onToggleTheme, onSignOut }) {
  const { role, isManager, navigate } = useApp();
  const name = profile?.name ?? "Signed in";

  // Suppliers, Users and Settings are for managers only
  const manage = isManager ? [
    { to: "suppliers", label: "Suppliers", icon: "truck" },
    { to: "users", label: "Users", icon: "users" },
    { to: "settings", label: "Settings", icon: "settings" },
  ] : [];

  const link = (l) => (
    <a key={l.to} href={"#/" + l.to} className={"menu-link" + (section === l.to ? " is-active" : "")}>
      <Icon name={l.icon} /><span>{l.label}</span>
    </a>
  );

  return (
    <aside className="sidebar">
      <a className="brand" href="#/dashboard" onClick={() => navigate("dashboard")}>
        <span className="brand-icon"><Icon name="box" /></span>
        <span className="brand-text"><strong>StockIt</strong><small>Inventory</small></span>
      </a>

      <p className="menu-label">Main</p>
      <nav className="menu" aria-label="Main">{MAIN.filter((l) => canOpen(role, l.to)).map(link)}</nav>

      {manage.length > 0 && <p className="menu-label">Manage</p>}
      {manage.length > 0 && <nav className="menu" aria-label="Manage">{manage.map(link)}</nav>}

      {/* Signed-in user, with the theme and sign-out buttons beside each other */}
      <div className="sidebar-user">
        <span className="avatar">{name.charAt(0).toUpperCase()}</span>
        <div className="user-info">
          <strong>{name}</strong>
          <small>{ROLE_LABELS[profile?.role] ?? ""}</small>
        </div>
        <button className="side-icon-btn" type="button" onClick={onToggleTheme} aria-label="Toggle dark mode" title="Light / dark mode">
          <Icon name={themeIsDark ? "sun" : "moon"} />
        </button>
        <button className="side-icon-btn" type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out">
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  );
}
