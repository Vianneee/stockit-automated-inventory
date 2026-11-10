import { useApp } from "../lib/AppContext.js";
import { stockStatus } from "../lib/helpers.js";

// Small reusable pieces shared by all pages.

// <i> tag for a Tabler icon: <Icon name="bell" />
export const Icon = ({ name }) => <i className={"ti ti-" + name} aria-hidden="true" />;

// Colored label: tone = ok | warn | danger | info | muted
export const Pill = ({ tone = "muted", children }) => <span className={"pill pill-" + tone}>{children}</span>;

// Healthy / Low stock / Critical pill for an item
export const StatusPill = ({ item }) => {
  const s = stockStatus(item);
  return <Pill tone={s.tone}>{s.label}</Pill>;
};

// Page title block + action buttons + bell and avatar. `back` = hash to go back to.
export function Page({ title, subtitle, back, actions, chrome = true, children }) {
  const { navigate, profile, pendingCount, isManager } = useApp();
  return (
    <div className="view">
      <header className="page-header">
        <div className="page-title">
          {back && (
            <button className="back-btn" type="button" aria-label="Go back" onClick={() => navigate(back)}>
              <Icon name="chevron-left" />
            </button>
          )}
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="page-actions">
          {actions}
          {chrome && (
            <>
              {isManager && (
                <button className="round-btn" type="button" aria-label="Alerts" title="Alerts" onClick={() => navigate("alerts")}>
                  <Icon name="bell" />
                  {pendingCount > 0 && <span className="dot" />}
                </button>
              )}
              <span className="avatar" title={profile?.name}>{(profile?.name || "?").charAt(0).toUpperCase()}</span>
            </>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

export const Panel = ({ title, hint, right, className = "", children }) => (
  <section className={"panel " + className}>
    {(title || right) && (
      <header className="panel-head">
        <div><h2>{title}</h2>{hint && <p className="muted small">{hint}</p>}</div>
        {right}
      </header>
    )}
    {children}
  </section>
);

// Summary card. `color` adds a colored bottom edge or fills the card (yellow / red).
export function StatCard({ label, value, tone, color, icon, badge }) {
  return (
    <article className={"stat" + (color ? " stat-" + color : "")}>
      {(icon || badge) && (
        <div className="stat-top">
          {icon && <span className={"stat-icon tone-" + (tone || "info")}><Icon name={icon} /></span>}
          {badge}
        </div>
      )}
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </article>
  );
}

export const Banner = ({ children }) => (children ? <p className="banner" role="alert">{children}</p> : null);

export const Empty = ({ children }) => <p className="empty">{children}</p>;

// Row of filter buttons. options = [{ key, label, count? }]
export function Chips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" className={"chip" + (value === o.key ? " is-active" : "")} onClick={() => onChange(o.key)}>
          {o.label}{o.count !== undefined && <span className="chip-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Underlined tabs (Sales | Stock movements)
export function Tabs({ options, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={value === o.key}
          className={"tab" + (value === o.key ? " is-active" : "")} onClick={() => onChange(o.key)}>
          {o.label}{o.count !== undefined && <span className="chip-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const SearchBox = ({ value, onChange, placeholder = "Search Items", id }) => (
  <label className="search" htmlFor={id}>
    <Icon name="search" />
    <input id={id} type="search" placeholder={placeholder} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
  </label>
);

// Label + input wrapper
export const Field = ({ label, htmlFor, hint, children }) => (
  <div className="field">
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <span className="hint">{hint}</span>}
  </div>
);

// - 1 + stepper
export function Stepper({ value, onChange, min = 1, max = 9999 }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <strong>{value}</strong>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

// Bar chart. bars = [{ label, value, title, highlight }]. `line` draws a dashed average line.
export function BarChart({ bars, line, lineLabel, height = 190, showValues = false }) {
  const max = Math.max(...bars.map((b) => b.value), line || 0, 1);
  return (
    <div className="bars" style={{ height }} role="img" aria-label="Bar chart">
      {line > 0 && (
        <div className="avg-line" style={{ bottom: "calc(22px + (100% - 26px) * " + line / max + ")" }}>
          <span>{lineLabel}</span>
        </div>
      )}
      {bars.map((b, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-area">
            <div className={"bar" + (b.highlight ? " is-hot" : "")} style={{ height: Math.max(3, (b.value / max) * 100) + "%" }} title={b.title} />
          </div>
          <span className="bar-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// Key/value rows for "Item details" style panels
export const DetailList = ({ rows }) => (
  <dl className="detail-list">
    {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>))}
  </dl>
);

// Managers only: wraps content that cashiers shouldn't see
export function ManagerOnly({ children }) {
  const { isManager } = useApp();
  return isManager ? children : null;
}
