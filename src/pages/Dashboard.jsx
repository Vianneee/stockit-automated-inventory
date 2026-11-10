import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { DAY_MS, manilaDate, peso, startOfDay, stockStatus, timeAgo } from "../lib/helpers.js";
import { groupByItem, prioritiseAlerts, runForecastCheck } from "../lib/forecast.js";
import { downloadOrderCsv } from "../lib/exportOrders.js";
import { Banner, BarChart, Empty, Icon, ManagerOnly, Page, Panel, Pill, SearchBox, StatCard } from "../components/ui.jsx";

const ALERT_PREVIEW = 3;
const STOCK_ROWS = 6;
const ACTIVITY_ROWS = 4;

export default function Dashboard() {
  const { session, isManager, canViewItems, navigate, showToast, refreshPending } = useApp();
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);

  // One load: everything the dashboard needs, fetched at the same time
  const { data, error, reload } = useLoad(async () => {
    const weekStart = startOfDay(Date.now() - 6 * DAY_MS).toISOString();
    const [items, sales, moves, daily, alerts] = await Promise.all([
      supabase.from("items").select("item_id, name, sku, current_stock, min_reorder_threshold"),
      supabase.from("sales_transactions").select("sold_at, quantity_sold, total_value, items(name), profiles(name)")
        .gte("sold_at", weekStart).order("sold_at", { ascending: false }).limit(2000),
      supabase.from("stock_movements").select("received_at, quantity_received, items(name), profiles(name)")
        .order("received_at", { ascending: false }).limit(ACTIVITY_ROWS),
      supabase.from("daily_sales").select("item_id, sale_date, units_sold").gte("sale_date", manilaDate(30)),
      supabase.from("alerts")
        .select("alert_id, item_id, flagged_at, suggested_reorder_qty, items(name, sku, current_stock, min_reorder_threshold, suppliers(name))")
        .eq("status", "pending").order("flagged_at", { ascending: false }),
    ]);
    return {
      items: must(items) || [], sales: must(sales) || [], moves: must(moves) || [],
      daily: must(daily) || [], alerts: must(alerts) || [], loadedAt: Date.now(),
    };
  });

  const { items = [], sales = [], moves = [], daily = [], alerts = [], loadedAt } = data || {};
  const dailyByItem = groupByItem(daily);

  async function resolve(alert, action) {
    const { error } = await supabase.from("alerts").update({
      status: action === "approve" ? "approved" : "dismissed",
      reviewed_by: session.user.id,
      resolved_at: new Date().toISOString(),
    }).eq("alert_id", alert.alert_id);
    if (error) return showToast("Could not update alert: " + error.message);

    if (action === "approve") { downloadOrderCsv([alert]); showToast("Approved. Order exported for " + alert.items?.name); }
    else showToast("Alert dismissed");
    reload();
    refreshPending();
  }

  // Re-checks every item with the forecasting rules and flags the ones at risk
  async function runForecast() {
    setRunning(true);
    let added = 0;
    for (const item of items) {
      try { if (await runForecastCheck(item.item_id)) added++; } catch (err) { console.error(err); }
    }
    setRunning(false);
    showToast(added ? added + " new alert" + (added > 1 ? "s" : "") + " flagged" : "No new stockout risks found");
    reload();
    refreshPending();
  }

  function exportAll() {
    if (!alerts.length) return showToast("No pending alerts to export");
    downloadOrderCsv(alerts);
    showToast("Order exported (" + alerts.length + " item" + (alerts.length > 1 ? "s" : "") + ")");
  }

  // DERIVED data (worked out on every render, so it is never out of date)
  const sortedAlerts = prioritiseAlerts(alerts, dailyByItem);   // red first, then yellow
  const today = startOfDay(new Date());
  const salesToday = sales.filter((s) => new Date(s.sold_at) >= today).reduce((sum, s) => sum + Number(s.total_value), 0);
  const lowCount = items.filter((i) => stockStatus(i).tone !== "ok").length;

  const days = [...Array(7)].map((_, i) => startOfDay(Date.now() - (6 - i) * DAY_MS));
  const bars = days.map((day, i) => {
    const total = sales.filter((s) => startOfDay(s.sold_at).getTime() === day.getTime())
      .reduce((sum, s) => sum + Number(s.total_value), 0);
    const label = day.toLocaleDateString("en-US", { weekday: "short" });
    return { label, value: total, title: label + ": " + peso(total), highlight: i === 6 };
  });

  const term = search.trim().toLowerCase();
  const stockRows = items
    .filter((i) => !term || i.name.toLowerCase().includes(term) || String(i.sku).toLowerCase().includes(term))
    .sort((a, b) => stockStatus(a).rank - stockStatus(b).rank || a.current_stock / (a.min_reorder_threshold || 1) - b.current_stock / (b.min_reorder_threshold || 1))
    .slice(0, term ? 50 : STOCK_ROWS);

  const feed = [
    ...sales.slice(0, ACTIVITY_ROWS).map((s) => ({ at: new Date(s.sold_at), tone: "ok", icon: "shopping-cart", text: "Sold " + s.quantity_sold + " x " + (s.items?.name ?? "item"), by: s.profiles?.name })),
    ...moves.map((m) => ({ at: new Date(m.received_at), tone: "info", icon: "truck", text: "Received " + m.quantity_received + " x " + (m.items?.name ?? "item"), by: m.profiles?.name })),
    ...alerts.map((a) => ({ at: new Date(a.flagged_at), tone: "danger", icon: "alert-triangle", text: "Alert flagged: " + (a.items?.name ?? "item"), by: "StockIT" })),
  ].filter((f) => !isNaN(f.at)).sort((a, b) => b.at - a.at).slice(0, ACTIVITY_ROWS);

  const subtitle = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    + (loadedAt ? " · Last synced " + timeAgo(loadedAt) : "");

  return (
    <Page
      title="Dashboard" subtitle={subtitle} chrome={false}
      actions={
        <>
          <SearchBox id="dash-search" value={search} onChange={setSearch} />
          <ManagerOnly>
            <button className="btn" type="button" onClick={runForecast} disabled={running}><Icon name="chart-line" /> {running ? "Checking…" : "Run forecast"}</button>
            <button className="btn btn-primary" type="button" onClick={exportAll}><Icon name="download" /> Export Order</button>
          </ManagerOnly>
        </>
      }
    >
      <Banner>{error && "Some data could not be loaded: " + error}</Banner>

      <section className="stats" aria-label="Summary">
        <StatCard label="Items tracked" value={items.length} color="blue" />
        <StatCard label="Today's sales" value={peso(salesToday)} color="green" />
        <StatCard label="Low stock" value={lowCount} color="yellow" />
        <StatCard label="Pending alerts" value={alerts.length} color="red" />
      </section>

      <section className="grid-2 columns">
        <div className="col">
        <Panel title="Sales" right={<strong className="small">Last 7 days</strong>}>
          <BarChart bars={bars} />
        </Panel>

        <Panel title="Stock Levels" right={canViewItems && <a className="link" href="#/items">View all</a>}>
          <table className="table compact">
            <thead><tr><th>Item</th><th>Stock</th><th>Minimum</th><th>Status</th></tr></thead>
            <tbody>
              {stockRows.length === 0 && <tr><td colSpan="4" className="empty">No items found.</td></tr>}
              {stockRows.map((item) => {
                const s = stockStatus(item);
                return (
                  <tr key={item.item_id} className={canViewItems ? "clickable" : ""} onClick={() => canViewItems && navigate("items/" + item.item_id)}>
                    <td className="cell-strong">{item.name}</td>
                    <td>{item.current_stock}</td>
                    <td>{item.min_reorder_threshold}</td>
                    <td><span className={"status-text status-" + s.tone}>{s.action}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        </div>
        <div className="col">
        <Panel title="Stockout Alert" right={isManager && <a className="link" href="#/alerts">View all</a>}>
          {alerts.length === 0 && <Empty>No pending alerts. Alerts appear after a sale or shipment puts an item at risk.</Empty>}
          {sortedAlerts.slice(0, ALERT_PREVIEW).map((a) => {
            const item = a.items || {};
            const { daysLeft, critical } = a;
            return (
              <div className="alert-row" key={a.alert_id}>
                <div className="alert-row-top">
                  <div><strong>{item.name}</strong><span className="muted small block">Suggest Order: {a.suggested_reorder_qty}</span></div>
                  <Pill tone={critical ? "danger" : "warn"}>{isFinite(daysLeft) ? Math.max(1, Math.ceil(daysLeft)) + " days" : "Below minimum"}</Pill>
                </div>
                <ManagerOnly>
                  <div className="btn-row">
                    <button className="btn btn-wide" type="button" onClick={() => resolve(a, "approve")}>Approve</button>
                    <button className="btn btn-wide" type="button" onClick={() => resolve(a, "dismiss")}>Dismiss</button>
                  </div>
                </ManagerOnly>
              </div>
            );
          })}
          {!isManager && alerts.length > 0 && <p className="muted small">A manager reviews these alerts.</p>}
        </Panel>

        <Panel title="Recent Activity">
          {feed.length === 0 && <Empty>No activity yet.</Empty>}
          {feed.map((f, i) => (
            <div className="activity-item" key={i}>
              <span className={"activity-icon tone-" + f.tone}><Icon name={f.icon} /></span>
              <div><strong>{f.text}</strong><span className="muted small block">{f.by || "Cashier"} - {timeAgo(f.at)}</span></div>
            </div>
          ))}
        </Panel>
        </div>
      </section>
    </Page>
  );
}
