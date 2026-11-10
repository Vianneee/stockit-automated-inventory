import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { dateTime, manilaDate, peso, shortCode, startOfDay, DAY_MS, stockStatus } from "../lib/helpers.js";
import { analyse } from "../lib/forecast.js";
import { Banner, BarChart, DetailList, Icon, ManagerOnly, Page, Panel, Pill, StatCard, StatusPill } from "../components/ui.jsx";

export default function ItemDetail({ itemId }) {
  const { navigate, canReceive, canSell } = useApp();

  const { data, error } = useLoad(async () => {
    const [item, daily, sales, moves] = await Promise.all([
      supabase.from("items").select("*, suppliers(name)").eq("item_id", itemId).single(),
      supabase.from("daily_sales").select("item_id, sale_date, units_sold").eq("item_id", itemId).gte("sale_date", manilaDate(30)),
      supabase.from("sales_transactions").select("transaction_id, sold_at, quantity_sold, profiles(name)").eq("item_id", itemId).order("sold_at", { ascending: false }).limit(10),
      supabase.from("stock_movements").select("movement_id, received_at, quantity_received, profiles(name)").eq("item_id", itemId).order("received_at", { ascending: false }).limit(10),
    ]);
    return { item: must(item), daily: must(daily) || [], sales: must(sales) || [], moves: must(moves) || [] };
  }, [itemId]);

  if (error) return <Page title="Item" back="items"><Banner>{"Could not load this item: " + error}</Banner></Page>;
  if (!data) return <Page title="Loading…" back="items" />;

  const { item, daily, sales, moves } = data;
  const status = stockStatus(item);
  const { velocity, daysLeft } = analyse(item, daily);

  // 14 days of bars, oldest first
  const byDate = Object.fromEntries(daily.map((r) => [r.sale_date, r.units_sold]));
  const bars = [...Array(14)].map((_, i) => {
    const ago = 13 - i;
    const date = manilaDate(ago);
    const label = new Date(Date.now() - ago * DAY_MS).toLocaleDateString("en-US", { day: "numeric" });
    return { label, value: byDate[date] || 0, title: date + ": " + (byDate[date] || 0) + " sold", highlight: ago < 7 };
  });

  // Sales and shipments mixed into one table, newest first
  const rows = [
    ...sales.map((s) => ({ ref: shortCode("TX", s.transaction_id), type: "Sold", qty: -s.quantity_sold, by: s.profiles?.name, at: s.sold_at, to: "transactions/sale/" + s.transaction_id })),
    ...moves.map((m) => ({ ref: shortCode("MV", m.movement_id), type: "Received", qty: m.quantity_received, by: m.profiles?.name, at: m.received_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);

  const days = isFinite(daysLeft) ? daysLeft.toFixed(1) : "—";
  const atRisk = isFinite(daysLeft) && daysLeft <= 7;

  return (
    <Page
      title={item.name} back="items"
      subtitle={[item.sku, item.category, item.location].filter(Boolean).join(" - ")}
      actions={
        <>
          <ManagerOnly><button className="btn" type="button" onClick={() => navigate("items/" + itemId + "/edit")}>Edit item</button></ManagerOnly>
          {canReceive && <button className="btn btn-primary" type="button" onClick={() => navigate("transactions/log/" + itemId)}>Log shipment</button>}
        </>
      }
    >
      <section className="stats">
        <StatCard icon="stack-2" tone={status.tone} label="Current stock" value={item.current_stock} badge={<Pill tone={status.tone}>{status.label}</Pill>} />
        <StatCard icon="list-details" tone="info" label="Avg velocity" value={velocity === null ? "—" : velocity.toFixed(1).replace(/\.0$/, "") + " / day"} badge={<Pill tone="info">7-day rolling</Pill>} />
        <StatCard icon="alert-triangle" tone={atRisk ? "danger" : "ok"} label="Days until stockout" value={days} badge={<Pill tone={atRisk ? "danger" : "ok"}>{atRisk ? "At risk" : "OK"}</Pill>} />
        <StatCard icon="bell" tone="warn" label="Minimum threshold" value={item.min_reorder_threshold} badge={<StatusPill item={item} />} />
      </section>

      <section className="grid-chart">
        <Panel title="Daily sales" hint="Units sold per day - last 14 days" right={<Pill tone="info">7-day average</Pill>}>
          <BarChart bars={bars} line={velocity || 0} lineLabel={velocity ? velocity.toFixed(1).replace(/\.0$/, "") + " / day" : ""} />
          {velocity === null && <p className="muted small">Fewer than 7 days of sales so far, so alerts compare stock with the minimum only.</p>}
        </Panel>
        <Panel title="Item details">
          <DetailList rows={[
            ["Category", item.category],
            ["Location", item.location],
            ["Supplier", item.suppliers?.name],
            ["Unit price", peso(item.unit_price, 2)],
            ["Standard reorder qty", item.standard_reorder_qty],
          ]} />
        </Panel>
      </section>

      <Panel className="flush">
        <table className="table">
          <thead><tr><th>Reference</th><th>Type</th><th>Qty</th><th>Employee</th><th>Date and time</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="5" className="empty">No transactions for this item yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.ref} className={r.to && canSell ? "clickable" : ""} onClick={() => r.to && canSell && navigate(r.to)}>
                <td className="cell-strong">{r.ref}</td>
                <td><Pill tone={r.type === "Sold" ? "info" : "ok"}>{r.type}</Pill></td>
                <td>{r.qty > 0 ? "+" : ""}{r.qty}</td>
                <td>{r.by}</td>
                <td>{dateTime(r.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Page>
  );
}
