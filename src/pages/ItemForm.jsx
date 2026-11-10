import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { manilaDate } from "../lib/helpers.js";
import { CATEGORIES } from "../lib/categories.js";
import { analyse, runForecastCheck } from "../lib/forecast.js";
import { Banner, DetailList, Field, Page, Panel } from "../components/ui.jsx";

const EMPTY = {
  name: "", sku: "", category: "", unit_price: "", current_stock: "0",
  min_reorder_threshold: "", standard_reorder_qty: "", location: "", supplier_id: "",
};

// One form for both "Add New Product" (no itemId) and "Edit item" (itemId given).
export default function ItemForm({ itemId }) {
  const { navigate, showToast, isManager } = useApp();
  const editing = Boolean(itemId);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, error: loadError } = useLoad(async () => {
    const suppliers = must(await supabase.from("suppliers").select("supplier_id, name").order("name")) || [];
    if (!editing) return { suppliers };
    const item = must(await supabase.from("items").select("*").eq("item_id", itemId).single());
    const daily = must(await supabase.from("daily_sales").select("item_id, sale_date, units_sold").eq("item_id", itemId).gte("sale_date", manilaDate(30))) || [];
    // fill the form with the saved values (inputs hold text, so numbers become strings)
    setForm({
      name: item.name, sku: item.sku, category: item.category ?? "", unit_price: String(item.unit_price),
      current_stock: String(item.current_stock), min_reorder_threshold: String(item.min_reorder_threshold),
      standard_reorder_qty: String(item.standard_reorder_qty), location: item.location ?? "", supplier_id: item.supplier_id ?? "",
    });
    return { suppliers, item, daily };
  }, [itemId]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const row = {
      name: form.name.trim(), sku: form.sku.trim(), category: form.category.trim() || null,
      unit_price: parseFloat(form.unit_price), current_stock: parseInt(form.current_stock, 10),
      min_reorder_threshold: parseInt(form.min_reorder_threshold, 10),
      standard_reorder_qty: parseInt(form.standard_reorder_qty, 10),
      location: form.location.trim() || null, supplier_id: form.supplier_id || null,
    };

    const query = editing
      ? supabase.from("items").update(row).eq("item_id", itemId).select().single()
      : supabase.from("items").insert(row).select().single();
    const { data: saved, error } = await query;
    setSaving(false);

    if (error) {
      setError(error.code === "23505" ? "That SKU is already used by another item." : error.message);
      return;
    }

    showToast(editing ? "Saved changes to " + saved.name : "Added " + saved.name);
    try { await runForecastCheck(saved.item_id); } catch (err) { console.error(err); }   // does the new stock / minimum put it at risk?
    navigate("items/" + saved.item_id);
  }

  async function handleDelete() {
    if (!window.confirm('Delete "' + data.item.name + '"? This cannot be undone.')) return;
    const { data: gone, error } = await supabase.from("items").delete().eq("item_id", itemId).select();
    if (error) {
      setError(error.code === "23503"
        ? "This item has sales or stock history, so it can't be deleted."
        : error.message);
      return;
    }
    if (!gone || gone.length === 0) {
      setError("Delete was not allowed. Run database/figma-additions.sql in Supabase and sign in as a manager or admin.");
      return;
    }
    showToast("Deleted " + data.item.name);
    navigate("items");
  }

  if (editing && !isManager) return <Page title="Edit item" back={"items/" + itemId}><Banner>Only managers can edit items.</Banner></Page>;
  if (!data) return <Page title={editing ? "Edit item" : "Add New Product"} back="items"><Banner>{loadError}</Banner></Page>;

  const suppliers = data.suppliers;
  const f = (name, props = {}) => ({ id: name, name, value: form[name], onChange: handleChange, className: "input", ...props });
  const stats = editing ? analyse(data.item, data.daily) : null;

  return (
    <Page
      title={editing ? "Edit item" : "Add New Product"} back={editing ? "items/" + itemId : "items"}
      subtitle={editing ? data.item.sku + " · " + data.item.name : "Enter the details before logging stock"}
    >
      <form className="form-layout" onSubmit={handleSubmit}>
        <Panel title="Item details">
          <div className="form-grid">
            <Field label="Item name" htmlFor="name"><input {...f("name", { required: true, placeholder: "USB-C Cable 1 m", autoFocus: !editing })} /></Field>
            <Field label="SKU / Barcode" htmlFor="sku"><input {...f("sku", { required: true, placeholder: "CAB-USBC-1M" })} /></Field>
            <Field label="Category" htmlFor="category">
              <select {...f("category")}>
                <option value="">Choose a category</option>
                {/* keep an older category visible when editing an item that has one */}
                {[...CATEGORIES, ...(form.category && !CATEGORIES.includes(form.category) ? [form.category] : [])].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Unit price (₱)" htmlFor="unit_price"><input {...f("unit_price", { type: "number", min: 0, step: "0.01", required: true, placeholder: "199" })} /></Field>
            <Field label="Current stock quantity" htmlFor="current_stock"><input {...f("current_stock", { type: "number", min: 0, required: true })} /></Field>
            <Field label="Minimum reorder threshold" htmlFor="min_reorder_threshold" hint="An alert is flagged at or below this."><input {...f("min_reorder_threshold", { type: "number", min: 0, required: true, placeholder: "20" })} /></Field>
            <Field label="Standard reorder quantity" htmlFor="standard_reorder_qty"><input {...f("standard_reorder_qty", { type: "number", min: 0, required: true, placeholder: "40" })} /></Field>
            <Field label="Location" htmlFor="location"><input {...f("location", { placeholder: "Warehouse B, Rack 12" })} /></Field>
            <Field label="Supplier" htmlFor="supplier_id">
              <select {...f("supplier_id")}>
                <option value="">No supplier</option>
                {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            {editing && <button className="btn btn-danger push-left" type="button" onClick={handleDelete}>Delete item</button>}
            <button className="btn" type="button" onClick={() => navigate(editing ? "items/" + itemId : "items")}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Save item"}</button>
          </div>
        </Panel>

        <aside className="side-cards">
          {!editing && (
            <Panel title="How this is used">
              <p className="muted">Until an item has 7 days of sales history, alerts compare stock to the minimum threshold only. The standard reorder quantity becomes the suggested order on an alert.</p>
            </Panel>
          )}
          {editing && (
            <>
              <Panel title="Stock status">
                <DetailList rows={[
                  ["Current stock", data.item.current_stock],
                  ["Avg velocity", stats.velocity === null ? "—" : stats.velocity.toFixed(1) + " / day"],
                  ["Days until stockout", isFinite(stats.daysLeft) ? stats.daysLeft.toFixed(1) : "—"],
                ]} />
              </Panel>
              <Panel title="Delete item">
                <p className="muted">Deleting removes this item from the list. Items that already have sales or shipments can't be deleted.</p>
              </Panel>
            </>
          )}
        </aside>
      </form>
    </Page>
  );
}
