import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { CATEGORIES } from "../lib/categories.js";
import { Banner, Chips, Empty, Icon, Page, Panel, SearchBox, StatusPill } from "../components/ui.jsx";

const isWarehouse = (item) => /warehouse/i.test(item.location || "");

export default function Items() {
  const { navigate, canAddItems } = useApp();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");   // all | a category name | store | warehouse

  const { data: items = [], error } = useLoad(async () =>
    must(await supabase.from("items")
      .select("item_id, name, sku, category, unit_price, current_stock, min_reorder_threshold, location, suppliers(name)")
      .order("name")) || []
  );

  // The electronics kinds, plus any other category already saved on an item
  const categories = [...CATEGORIES, ...[...new Set(items.map((i) => i.category).filter(Boolean))].filter((c) => !CATEGORIES.includes(c)).sort()];

  const term = search.trim().toLowerCase();
  const rows = items
    .filter((i) => !term || [i.name, i.sku, i.category].some((v) => String(v ?? "").toLowerCase().includes(term)))
    .filter((i) =>
      category === "all" ? true
      : category === "store" ? !isWarehouse(i)
      : category === "warehouse" ? isWarehouse(i)
      : i.category === category
    );

  const options = [
    { key: "all", label: "All" },
    ...categories.map((c) => ({ key: c, label: c })),
    { key: "store", label: "Store Floor" },
    { key: "warehouse", label: "Warehouse" },
  ];

  return (
    <Page
      title="Items" subtitle={items.length + " items - store floor and warehouse"} back="dashboard"
      actions={
        <>
          <SearchBox id="items-search" value={search} onChange={setSearch} />
          {canAddItems && <button className="btn btn-primary" type="button" onClick={() => navigate("items/new")}><Icon name="plus" /> Add Item</button>}
        </>
      }
    >
      <Banner>{error && "Items could not be loaded: " + error}</Banner>

      <Chips options={options} value={category} onChange={setCategory} label="Filter items" />

      <Panel className="flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Item</th><th>SKU / Barcode</th><th>Category</th><th>Location</th><th>Stock</th><th>Min</th><th>Supplier</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan="8" className="empty">{items.length ? "No items match your filter." : 'No items yet. Click "Add Item" to create your first one.'}</td></tr>
              )}
              {rows.map((item) => (
                <tr key={item.item_id} className="clickable" onClick={() => navigate("items/" + item.item_id)}>
                  <td className="cell-strong">{item.name}</td>
                  <td>{item.sku}</td>
                  <td>{item.category}</td>
                  <td>{item.location}</td>
                  <td className="num cell-strong">{item.current_stock}</td>
                  <td className="num">{item.min_reorder_threshold}</td>
                  <td>{item.suppliers?.name}</td>
                  <td><StatusPill item={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  );
}
