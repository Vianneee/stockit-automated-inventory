import { useState } from "react";
import { supabase, createTempClient } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { ROLE_LABELS, numberedCode } from "../lib/helpers.js";
import { Banner, Chips, Field, Page, Panel } from "../components/ui.jsx";

const ROLE_OPTIONS = [
  { key: "cashier", label: "Cashier" },
  { key: "stock", label: "Stock staff" },
  { key: "manager", label: "Manager" },
];

// Add user (no userId) or Edit user (userId given). Managers only.
export default function UserForm({ userId }) {
  const { navigate, showToast, isManager, session } = useApp();
  const editing = Boolean(userId);
  const [form, setForm] = useState({ name: "", username: "", role: "cashier", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: meta, loading } = useLoad(async () => {
    if (!editing) return null;
    const all = must(await supabase.from("profiles").select("*").order("created_at")) || [];
    const index = all.findIndex((u) => u.employee_id === userId);
    const u = all[index];
    setForm({ name: u.name, username: u.username || "", role: u.role, password: "" });
    return { code: numberedCode("EMP", index) };
  }, [userId]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(event) {
    event.preventDefault();
    setError(""); setSaving(true);
    const username = form.username.trim().toLowerCase();

    try {
      let id = userId;
      if (!editing) {
        // Create the sign-in account with a temporary client so the admin stays signed in
        const { data, error } = await createTempClient().auth.signUp({
          email: username + "@stockit.local", password: form.password, options: { data: { name: form.name.trim() } },
        });
        if (error) throw error;
        id = data.user.id;
      }
      const { error } = await supabase.from("profiles").update({ name: form.name.trim(), role: form.role, username }).eq("employee_id", id);
      if (error) throw error;

      if (editing && form.password) {
        const { error } = await supabase.rpc("admin_set_password", { p_user_id: id, p_password: form.password });
        if (error) throw error;
      }
      showToast(editing ? "Saved changes to " + form.name : "Added " + form.name);
      navigate("users");
    } catch (err) {
      setError(/already registered/i.test(err.message) ? "That username is already taken." : err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete " + form.name + "? They will no longer be able to sign in.")) return;
    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
    if (error) return setError(error.code === "23503" ? "This user has recorded sales or shipments, so they can't be deleted." : error.message);
    showToast("Deleted " + form.name);
    navigate("users");
  }

  if (!isManager) return <Page title="Users" back="users"><Banner>Only managers can add or edit users.</Banner></Page>;
  if (editing && loading) return <Page title="Edit user" back="users" />;

  return (
    <Page title={editing ? "Edit user" : "Add user"} back="users" subtitle={editing ? meta.code + " · " + form.name : "Create a sign-in for a team member"}>
      <form className="form-layout" onSubmit={submit}>
        <Panel title="User details">
          <div className="form-stack">
            <Field label="Name" htmlFor="name"><input id="name" name="name" className="input" required value={form.name} onChange={change} placeholder="Jose Reyes" /></Field>
            <Field label="Username" htmlFor="username" hint="They sign in with this (or their email).">
              <input id="username" name="username" className="input" required pattern="[a-zA-Z0-9._-]+" value={form.username} onChange={change} placeholder="jreyes" />
            </Field>
            <Field label="Role">
              <Chips options={form.role === "admin" ? [...ROLE_OPTIONS, { key: "admin", label: "Manager (admin)" }] : ROLE_OPTIONS} value={form.role} onChange={(role) => setForm({ ...form, role })} label="Role" />
            </Field>
            <Field label={editing ? "New password" : "Password"} htmlFor="password" hint={editing ? "Leave empty to keep the current password." : "At least 6 characters."}>
              <input id="password" name="password" type="password" className="input" minLength={6} required={!editing} autoComplete="new-password" value={form.password} onChange={change} />
            </Field>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            {editing && userId !== session.user.id && <button className="btn btn-danger push-left" type="button" onClick={remove}>Delete user</button>}
            <button className="btn" type="button" onClick={() => navigate("users")}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Save user"}</button>
          </div>
        </Panel>
        <aside className="side-cards">
          <Panel title="Good to know">
            <p className="muted">Cashiers record sales. Stock staff add items and receive shipments. Managers see everything, approve alerts and manage suppliers and users.</p>
          </Panel>
        </aside>
      </form>
    </Page>
  );
}
