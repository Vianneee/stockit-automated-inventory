import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { dateTime, manilaDate, peso, shortCode } from "../lib/helpers.js";
import { analyse } from "../lib/forecast.js";
import { Banner, DetailList, Page, Panel, Pill, StatCard } from "../components/ui.jsx";

export default function TransactionDetail({ saleId }) {
  const { navigate } = useApp();

  const { data, error } = useLoad(async () => {
    const sale = must(await supabase.from("sales_transactions")
      .select("*, items(item_id, name, sku, category, unit_price, current_stock, min_reorder_threshold), profiles(name)")
      .eq("transaction_id", saleId).single());
    const id = sale.item_id;

    // Stock before/after is not stored, so we work it out: start from today's stock and
    // undo everything that happened AFTER this sale.
    const [laterSales, laterMoves, daily, alert] = await Promise.all([
      supabase.from("sales_transactions").select("quantity_sold").eq("item_id", id).gt("sold_at", sale.sold_at),
      supabase.from("stock_movements").select("quantity_received").eq("item_id", id).gt("received_at", sale.sold_at),
      supabase.from("daily_sales").select("item_id, sale_date, units_sold").eq("item_id", id).gte("sale_date", manilaDate(30)),
      supabase.from("alerts").select("alert_id, status").eq("item_id", id).gte("flagged_at", sale.sold_at).order("flagged_at").limit(1),
    ]);
    const soldAfter = (must(laterSales) || []).reduce((s, r) => s + r.quantity_sold, 0);
    const receivedAfter = (must(laterMoves) || []).reduce((s, r) => s + r.quantity_received, 0);
    const after = sale.items.current_stock + soldAfter - receivedAfter;

    return { sale, after, before: after + sale.quantity_sold, daily: must(daily) || [], alert: (must(alert) || [])[0] };
  }, [saleId]);

  if (error) return <Page title="Transaction" back="transactions"><Banner>{"Could not load this transaction: " + error}</Banner></Page>;
  if (!data) return <Page title="Loading…" back="transactions" />;

  const { sale, before, after, daily, alert } = data;
  const item = sale.items;
  const f = analyse({ ...item, current_stock: after }, daily);

  const timeline = [
    { title: "Sale logged", text: sale.quantity_sold + " x " + item.name + " by " + (sale.profiles?.name || "cashier") },
    { title: "Inventory updated", text: "Stock " + before + " → " + after },
    { title: "Forecasting ran", text: f.velocity === null ? "Not enough history yet: minimum threshold check" : f.velocity.toFixed(1) + " / day · " + (isFinite(f.daysLeft) ? f.daysLeft.toFixed(1) + " days left" : "no sales trend") },
    alert
      ? { title: "Alert flagged", text: "Item flagged for manager review", link: "alerts" }
      : { title: "No alert", text: "Graph updated silently" },
  ];

  return (
    <Page title={shortCode("TX", sale.transaction_id)} subtitle={dateTime(sale.sold_at)} back="transactions">
      <section className="stats three">
        <StatCard label="Quantity sold" value={sale.quantity_sold} color="blue" />
        <StatCard label="Total value" value={peso(sale.total_value, 2)} color="green" />
        <StatCard label="Processed by" value={sale.profiles?.name || "—"} />
      </section>

      <section className="grid-2">
        <Panel title="Item sold">
          <DetailList rows={[["Item", item.name], ["SKU", item.sku], ["Category", item.category], ["Unit price", peso(item.unit_price, 2)]]} />
          <button className="btn" type="button" onClick={() => navigate("items/" + item.item_id)}>View item</button>
        </Panel>
        <Panel title="Stock impact">
          <DetailList rows={[["Stock before", before], ["Sold", "-" + sale.quantity_sold], ["Stock after", after]]} />
        </Panel>
      </section>

      <Panel title="Transaction timeline">
        <ol className="timeline">
          {timeline.map((step, i) => (
            <li key={i}>
              <span className="timeline-dot" />
              <div>
                <strong>{step.title}</strong>
                <span className="muted small block">{step.text}</span>
                {step.link && <a className="link small" href={"#/" + step.link}>View alert</a>}
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </Page>
  );
}
