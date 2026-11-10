import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { manilaDate, shortDate } from "../lib/helpers.js";
import { groupByItem, prioritiseAlerts } from "../lib/forecast.js";
import { downloadOrderCsv } from "../lib/exportOrders.js";
import { Banner, Chips, Empty, Icon, ManagerOnly, Page, Pill } from "../components/ui.jsx";

export default function Alerts() {
  const { session, showToast, refreshPending } = useApp();
  const [tab, setTab] = useState("pending");

  const { data, error, reload } = useLoad(async () => {
    const [alerts, daily] = await Promise.all([
      supabase.from("alerts")
        .select("alert_id, item_id, flagged_at, status, suggested_reorder_qty, profiles(name), items(name, sku, current_stock, min_reorder_threshold, suppliers(name))")
        .order("flagged_at", { ascending: false }),
      supabase.from("daily_sales").select("item_id, sale_date, units_sold").gte("sale_date", manilaDate(30)),
    ]);
    return { alerts: must(alerts) || [], daily: groupByItem(must(daily)) };
  });

  const { alerts = [], daily = {} } = data || {};
  const count = (s) => alerts.filter((a) => a.status === s).length;
  // Pending alerts: red ones first, yellow ones below. Approved / dismissed: newest first.
  const shown = tab === "pending"
    ? prioritiseAlerts(alerts.filter((a) => a.status === "pending"), daily)
    : alerts.filter((a) => a.status === tab).map((a) => ({ ...a, ...prioritiseAlerts([a], daily)[0] }));

  async function resolve(alert, action) {
    const { error } = await supabase.from("alerts").update({
      status: action === "approve" ? "approved" : "dismissed",
      reviewed_by: session.user.id, resolved_at: new Date().toISOString(),
    }).eq("alert_id", alert.alert_id);
    if (error) return showToast("Could not update alert: " + error.message);
    if (action === "approve") { downloadOrderCsv([alert]); showToast("Approved. Order exported for " + alert.items?.name); }
    else showToast("Alert dismissed");
    reload(); refreshPending();
  }

  return (
    <Page
      title="Alerts" subtitle="Items predicted to run out or below their minimum" back="dashboard">
      <Banner>{error && "Alerts could not be loaded: " + error}</Banner>
      <Chips value={tab} onChange={setTab} label="Alert status" options={[
        { key: "pending", label: "Pending", count: count("pending") },
        { key: "approved", label: "Approved" },
        { key: "dismissed", label: "Dismissed" },
      ]} />

      {shown.length === 0 && <Empty>No {tab} alerts.</Empty>}
      {shown.map((a) => {
        const item = a.items || {};
        const { velocity, daysLeft, critical } = a;
        const belowMin = item.current_stock <= item.min_reorder_threshold;
        const pillText = belowMin ? "Below minimum" : isFinite(daysLeft) ? Math.max(1, Math.ceil(daysLeft)) + " days left" : "At risk";
        return (
          <article className="alert-card" key={a.alert_id}>
            <span className={"stat-icon tone-" + (critical ? "danger" : "warn")}><Icon name="stack-2" /></span>
            <div className="alert-card-name">
              <div><strong>{item.name}</strong> <Pill tone={critical ? "danger" : "warn"}>{pillText}</Pill></div>
              <span className="muted">Flagged {shortDate(a.flagged_at)}{item.suppliers?.name ? ", " + item.suppliers.name : ""}</span>
            </div>
            <div className="alert-metric"><span>Avg velocity</span><strong>{velocity === null ? "—" : velocity.toFixed(1).replace(/\.0$/, "") + " / day"}</strong></div>
            <div className="alert-metric"><span>Stock / min</span><strong>{item.current_stock} / {item.min_reorder_threshold}</strong></div>
            <div className="alert-metric"><span>Suggested order</span><strong>{a.suggested_reorder_qty} units</strong></div>
            <div className="alert-card-actions">
              {a.status === "pending" ? (
                <ManagerOnly>
                  <button className="btn btn-primary" type="button" onClick={() => resolve(a, "approve")}>Approve and export</button>
                  <button className="btn btn-quiet" type="button" onClick={() => resolve(a, "dismiss")}>Dismiss</button>
                </ManagerOnly>
              ) : (
                <div className="alert-metric"><span>{a.status === "approved" ? "Approved" : "Dismissed"} by</span><strong>{a.profiles?.name || "—"}</strong></div>
              )}
            </div>
          </article>
        );
      })}
    </Page>
  );
}
