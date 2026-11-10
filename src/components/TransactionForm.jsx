import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { peso } from "../lib/helpers.js";
import { runForecastCheck } from "../lib/forecast.js";
import { Icon, Panel } from "./ui.jsx";

// "Receive shipment" and "Record sale" are almost the same form, so ONE component serves both.
// The `kind` prop picks the text, icon and database function.
const CONFIG = {
  receive: {
    title: "Receive shipment", subtitle: "Adds stock to an item", icon: "truck", tone: "info",
    buttonIcon: "package-import", buttonText: "Log shipment", qtyLabel: "Quantity received", placeholder: "40", rpc: "receive_stock",
    done: (qty) => "Added " + qty + " unit" + (qty > 1 ? "s" : ""),
  },
  sale: {
    title: "Record sale", subtitle: "Deducts stock and logs the sale", icon: "shopping-cart", tone: "ok",
    buttonIcon: "check", buttonText: "Log sale", qtyLabel: "Quantity sold", placeholder: "3", rpc: "record_sale",
    done: (qty, row) => "Sale logged: " + peso(row?.total_value, 2),
  },
};

export default function TransactionForm({ kind, items, presetItemId, onDone, showToast }) {
  const cfg = CONFIG[kind];
  const [itemId, setItemId] = useState(kind === "receive" ? presetItemId || "" : "");
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const chosenId = itemId || items[0]?.item_id || "";
  const item = items.find((i) => i.item_id === chosenId);
  const amount = parseInt(qty, 10);

  let info = "";
  let infoIsError = false;
  if (item && kind === "receive") {
    info = amount > 0 ? "In stock: " + item.current_stock + " → " + (item.current_stock + amount) + " after this shipment" : "In stock: " + item.current_stock;
  } else if (item) {
    if (amount > item.current_stock) { info = "Not enough stock: only " + item.current_stock + " left"; infoIsError = true; }
    else if (amount > 0) info = peso(item.unit_price, 2) + " each · Total " + peso(item.unit_price * amount, 2);
    else info = peso(item.unit_price, 2) + " each · " + item.current_stock + " in stock";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!chosenId || !(amount > 0)) return setError("Choose an item and enter a quantity of at least 1.");

    setBusy(true);
    // The database function updates the stock AND logs the transaction in one step.
    const { data, error } = await supabase.rpc(cfg.rpc, { p_item_id: chosenId, p_quantity: amount });
    if (error) { setBusy(false); return setError(error.message); }

    let flagged = false;
    try { flagged = await runForecastCheck(chosenId); } catch (err) { console.error(err); }   // does this put the item at risk?
    setBusy(false);
    showToast(cfg.done(amount, data) + (flagged ? ". Alert flagged for review." : ""));
    setQty("");
    onDone();
  }

  return (
    <Panel>
      <div className="panel-title">
        <span className={"stat-icon tone-" + cfg.tone}><Icon name={cfg.icon} /></span>
        <div><h2>{cfg.title}</h2><p className="muted">{cfg.subtitle}</p></div>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor={kind + "-item"}>Item</label>
          <select className="input" id={kind + "-item"} required value={chosenId} onChange={(e) => setItemId(e.target.value)}>
            {items.length === 0 && <option value="">No items yet</option>}
            {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.name} ({i.sku})</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={kind + "-qty"}>{cfg.qtyLabel}</label>
          <input className="input" type="number" id={kind + "-qty"} min="1" required placeholder={cfg.placeholder} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <p className={"info-line" + (infoIsError ? " is-error" : "")}>{info}</p>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions left">
          <button className="btn btn-primary" type="submit" disabled={busy}><Icon name={cfg.buttonIcon} /> {cfg.buttonText}</button>
        </div>
      </form>
    </Panel>
  );
}
