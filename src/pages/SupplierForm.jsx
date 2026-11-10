import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { Banner, Field, Page, Panel } from "../components/ui.jsx";

// Add supplier (no supplierId) or Edit supplier (supplierId given)
export default function SupplierForm({ supplierId }) {
  const { navigate, showToast, isManager } = useApp();
  const editing = Boolean(supplierId);
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { loading } = useLoad(async () => {
    if (!editing) return null;
    const s = must(await supabase.from("suppliers").select("*").eq("supplier_id", supplierId).single());
    setForm({ name: s.name, contact_email: s.contact_email ?? "", contact_phone: s.contact_phone ?? "" });
    return s;
  }, [supplierId]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(event) {
    event.preventDefault();
    setError(""); setSaving(true);
    const row = { name: form.name.trim(), contact_email: form.contact_email.trim() || null, contact_phone: form.contact_phone.trim() || null };
    const { data, error } = await (editing
      ? supabase.from("suppliers").update(row).eq("supplier_id", supplierId).select().single()
      : supabase.from("suppliers").insert(row).select().single());
    setSaving(false);
    if (error) return setError(error.message);
    showToast(editing ? "Saved changes to " + data.name : "Added " + data.name);
    navigate("suppliers/" + data.supplier_id);
  }

  if (!isManager) return <Page title="Suppliers" back="suppliers"><Banner>Only managers can add or edit suppliers.</Banner></Page>;
  if (editing && loading) return <Page title="Edit supplier" back="suppliers" />;

  return (
    <Page title={editing ? "Edit supplier" : "Add Supplier"} back={editing ? "suppliers/" + supplierId : "suppliers"} subtitle="Contact details used when exporting orders">
      <form className="form-layout" onSubmit={submit}>
        <Panel title="Supplier details">
          <div className="form-stack">
            <Field label="Supplier name" htmlFor="name"><input id="name" name="name" className="input" required autoFocus value={form.name} onChange={change} placeholder="Supplier B" /></Field>
            <Field label="Email" htmlFor="contact_email"><input id="contact_email" name="contact_email" type="email" className="input" value={form.contact_email} onChange={change} placeholder="sales@supplier.com" /></Field>
            <Field label="Phone" htmlFor="contact_phone"><input id="contact_phone" name="contact_phone" className="input" value={form.contact_phone} onChange={change} placeholder="09123456789" /></Field>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => navigate(editing ? "suppliers/" + supplierId : "suppliers")}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Save supplier"}</button>
          </div>
        </Panel>
        <aside className="side-cards">
          <Panel title="Next step"><p className="muted">After saving, assign this supplier to items from the Add / Edit item screen. Order exports use these contact details.</p></Panel>
        </aside>
      </form>
    </Page>
  );
}
