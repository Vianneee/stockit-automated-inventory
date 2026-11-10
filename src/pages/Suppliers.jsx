import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { numberedCode } from "../lib/helpers.js";
import { Banner, Icon, ManagerOnly, Page, Panel } from "../components/ui.jsx";

export default function Suppliers() {
  const { navigate } = useApp();
  const { data, error } = useLoad(async () => {
    const [suppliers, items] = await Promise.all([
      supabase.from("suppliers").select("*").order("created_at"),
      supabase.from("items").select("item_id, supplier_id"),
    ]);
    return { suppliers: must(suppliers) || [], items: must(items) || [] };
  });
  const { suppliers = [], items = [] } = data || {};

  return (
    <Page
      title="Suppliers" subtitle="Who you buy stock from" back="dashboard"
      actions={<ManagerOnly><button className="btn btn-primary" type="button" onClick={() => navigate("suppliers/new")}><Icon name="plus" /> Add Supplier</button></ManagerOnly>}
    >
      <Banner>{error && "Suppliers could not be loaded: " + error}</Banner>
      <Panel className="flush">
        <table className="table">
          <thead><tr><th>Supplier ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Items</th></tr></thead>
          <tbody>
            {suppliers.length === 0 && <tr><td colSpan="5" className="empty">No suppliers yet.</td></tr>}
            {suppliers.map((s, i) => (
              <tr key={s.supplier_id} className="clickable" onClick={() => navigate("suppliers/" + s.supplier_id)}>
                <td>{numberedCode("SUP", i)}</td>
                <td className="cell-strong">{s.name}</td>
                <td>{s.contact_email}</td>
                <td>{s.contact_phone}</td>
                <td>{items.filter((it) => it.supplier_id === s.supplier_id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Page>
  );
}
