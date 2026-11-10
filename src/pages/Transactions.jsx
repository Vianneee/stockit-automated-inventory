import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { dateTime, peso, shortCode } from "../lib/helpers.js";
import TransactionForm from "../components/TransactionForm.jsx";
import { Banner, Chips, Page, Panel, Pill } from "../components/ui.jsx";

const RECENT_ROWS = 12;

// presetItemId comes from the "Log shipment" button on an item page (#/transactions/log/<id>)
export default function Transactions({ presetItemId }) {
  const { navigate, showToast, canSell, canReceive } = useApp();
  const [type, setType] = useState("all");   // all | sale | receive

  const { data, error, reload } = useLoad(async () => {
    // Three queries at the same time; sales and shipments are merged into one list
    const [items, sales, moves] = await Promise.all([
      supabase.from("items").select("item_id, name, sku, current_stock, unit_price").order("name"),
      supabase.from("sales_transactions").select("transaction_id, sold_at, quantity_sold, total_value, items(name), profiles(name)")
        .order("sold_at", { ascending: false }).limit(RECENT_ROWS),
      supabase.from("stock_movements").select("movement_id, received_at, quantity_received, items(name), profiles(name)")
        .order("received_at", { ascending: false }).limit(RECENT_ROWS),
    ]);
    const recent = [
      ...(must(sales) || []).map((s) => ({ id: s.transaction_id, code: shortCode("TX", s.transaction_id), type: "sale", at: s.sold_at, qty: s.quantity_sold, value: s.total_value, item: s.items?.name, by: s.profiles?.name })),
      ...(must(moves) || []).map((m) => ({ id: m.movement_id, code: shortCode("MV", m.movement_id), type: "receive", at: m.received_at, qty: m.quantity_received, value: null, item: m.items?.name, by: m.profiles?.name })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));
    return { items: must(items) || [], recent };
  });

  const { items = [], recent = [] } = data || {};
  // A role only sees the kind of transaction it works with
  const allowed = recent.filter((r) => (r.type === "sale" ? canSell : canReceive));
  const rows = allowed.filter((r) => type === "all" || r.type === type).slice(0, RECENT_ROWS);

  return (
    <Page title="Transactions" subtitle={canSell && canReceive ? "Receive shipments and record sales. Stock updates automatically." : canSell ? "Record sales. Stock updates automatically." : "Receive shipments. Stock updates automatically."}>
      <Banner>{error && "Transactions could not be loaded: " + error}</Banner>

      <section className={canSell && canReceive ? "grid-2 even" : "single-form"}>
        {canReceive && <TransactionForm kind="receive" items={items} presetItemId={presetItemId} onDone={reload} showToast={showToast} />}
        {canSell && <TransactionForm kind="sale" items={items} onDone={reload} showToast={showToast} />}
      </section>

      <Panel title="Recent transactions" right={canSell && canReceive &&
        <Chips value={type} onChange={setType} label="Filter by type" options={[
          { key: "all", label: "All" }, { key: "sale", label: "Sales" }, { key: "receive", label: "Shipments" },
        ]} />
      } className="flush-body">
        <table className="table">
          <thead><tr><th>ID</th><th>Type</th><th>Item</th><th>Quantity</th><th>Value</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="7" className="empty">No transactions yet. Log a shipment or a sale above.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={r.type === "sale" ? "clickable" : ""} onClick={() => r.type === "sale" && navigate("transactions/sale/" + r.id)}>
                <td className="cell-strong">{r.code}</td>
                <td><Pill tone={r.type === "sale" ? "info" : "ok"}>{r.type === "sale" ? "Sale" : "Shipment"}</Pill></td>
                <td>{r.item}</td>
                <td className={r.type === "sale" ? "qty-out" : "qty-in"}>{r.type === "sale" ? "−" : "+"}{r.qty}</td>
                <td>{r.type === "sale" ? peso(r.value, 2) : "—"}</td>
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
