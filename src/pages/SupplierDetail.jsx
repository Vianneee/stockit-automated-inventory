import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { numberedCode, shortDate, stockStatus } from "../lib/helpers.js";
import { downloadOrderCsv } from "../lib/exportOrders.js";
import { Banner, DetailList, ManagerOnly, Page, Panel, Pill, StatCard, StatusPill } from "../components/ui.jsx";

export default function SupplierDetail({ supplierId }) {
  const { navigate, showToast } = useApp();

  const { data, error } = useLoad(async () => {
    const [all, items] = await Promise.all([
      supabase.from("suppliers").select("*").order("created_at"),
      supabase.from("items").select("item_id, name, sku, current_stock, min_reorder_threshold, standard_reorder_qty, suppliers(name)").eq("supplier_id", supplierId).order("name"),
    ]);
    const list = must(all) || [];
    const itemRows = must(items) || [];
    const ids = itemRows.map((i) => i.item_id);
    const alerts = ids.length
      ? must(await supabase.from("alerts").select("alert_id, item_id, flagged_at, status, suggested_reorder_qty, items(name, sku, current_stock, suppliers(name)), profiles(name)").order("flagged_at", { ascending: false })).filter((a) => ids.includes(a.item_id))
      : [];
    const index = list.findIndex((s) => s.supplier_id === supplierId);
    return { supplier: list[index], index, items: itemRows, alerts };
  }, [supplierId]);

  if (error || (data && !data.supplier)) return <Page title="Supplier" back="suppliers"><Banner>{error || "Supplier not found."}</Banner></Page>;
  if (!data) return <Page title="Loading…" back="suppliers" />;

  const { supplier, index, items, alerts } = data;
  const toReorder = items.filter((i) => stockStatus(i).tone !== "ok");
  const pending = alerts.filter((a) => a.status === "pending");

  function exportOrder() {
    if (!pending.length) return showToast("No pending alerts for this supplier");
    downloadOrderCsv(pending, "order-" + supplier.name.replace(/\s+/g, "-").toLowerCase() + ".csv");
    showToast("Order exported (" + pending.length + " item" + (pending.length > 1 ? "s" : "") + ")");
  }

  return (
    <Page
      title={supplier.name} back="suppliers"
      subtitle={numberedCode("SUP", index) + " Supplies " + items.length + " item" + (items.length === 1 ? "" : "s")}
      actions={
        <>
          <ManagerOnly><button className="btn" type="button" onClick={() => navigate("suppliers/" + supplierId + "/edit")}>Edit supplier</button></ManagerOnly>
          <button className="btn btn-primary" type="button" onClick={exportOrder}>Export order</button>
        </>
      }
    >
      <section className="stats three">
        <StatCard icon="stack-2" tone="info" label="Items supplied" value={items.length} badge={<Pill tone="info">Linked</Pill>} />
        <StatCard icon="alert-triangle" tone="danger" label="Items to reorder" value={toReorder.length} badge={<Pill tone={toReorder.length ? "danger" : "ok"}>{toReorder.length ? "Needs reorder" : "All good"}</Pill>} />
        <StatCard icon="bell" tone="warn" label="Pending alerts" value={pending.length} badge={<Pill tone="warn">Awaiting review</Pill>} />
      </section>

      <section className="grid-2">
        <Panel className="flush">
          <table className="table">
            <thead><tr><th>Item</th><th>SKU</th><th>Stock</th><th>Min</th><th>Suggested order</th><th>Status</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan="6" className="empty">No items linked to this supplier.</td></tr>}
              {items.map((i) => (
                <tr key={i.item_id} className="clickable" onClick={() => navigate("items/" + i.item_id)}>
                  <td className="cell-strong">{i.name}</td><td>{i.sku}</td><td>{i.current_stock}</td><td>{i.min_reorder_threshold}</td>
                  <td>{stockStatus(i).tone === "ok" ? "—" : i.standard_reorder_qty + " units"}</td>
                  <td><StatusPill item={i} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Contact">
          <DetailList rows={[["Supplier ID", numberedCode("SUP", index)], ["Email", supplier.contact_email], ["Phone", supplier.contact_phone]]} />
        </Panel>
      </section>

      <Panel className="flush">
        <table className="table">
          <thead><tr><th>Date flagged</th><th>Item</th><th>Suggested qty</th><th>Status</th><th>Reviewed by</th></tr></thead>
          <tbody>
            {alerts.length === 0 && <tr><td colSpan="5" className="empty">No alerts for this supplier yet.</td></tr>}
            {alerts.map((a) => (
              <tr key={a.alert_id}>
                <td>{shortDate(a.flagged_at)}</td><td className="cell-strong">{a.items?.name}</td><td>{a.suggested_reorder_qty}</td>
                <td><Pill tone={a.status === "approved" ? "ok" : a.status === "pending" ? "warn" : "muted"}>{a.status[0].toUpperCase() + a.status.slice(1)}</Pill></td>
                <td>{a.profiles?.name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Page>
  );
}
