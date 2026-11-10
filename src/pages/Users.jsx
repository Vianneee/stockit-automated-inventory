import { supabase } from "../lib/supabaseClient.js";
import { useApp } from "../lib/AppContext.js";
import { useLoad, must } from "../lib/useLoad.js";
import { ROLE_LABELS, numberedCode } from "../lib/helpers.js";
import { Banner, Icon, Page, Panel, Pill } from "../components/ui.jsx";

export default function Users() {
  const { navigate, isManager } = useApp();
  const { data: users = [], error } = useLoad(async () =>
    must(await supabase.from("profiles").select("*").order("created_at")) || []
  );

  if (!isManager) return <Page title="Users" back="dashboard"><Banner>Only managers can see users.</Banner></Page>;

  return (
    <Page
      title="Users" subtitle="People who can sign in to StockIT" back="dashboard"
      actions={isManager && <button className="btn btn-primary" type="button" onClick={() => navigate("users/new")}><Icon name="plus" /> Add user</button>}
    >
      <Banner>{error && "Users could not be loaded: " + error}</Banner>
      <Panel className="flush">
        <table className="table">
          <thead><tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Username</th></tr></thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.employee_id} className={isManager ? "clickable" : ""} onClick={() => isManager && navigate("users/" + u.employee_id)}>
                <td>{numberedCode("EMP", i)}</td>
                <td className="cell-strong">{u.name}</td>
                <td><Pill tone={u.role === "cashier" ? "info" : "ok"}>{ROLE_LABELS[u.role] || u.role}</Pill></td>
                <td>{u.username || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Page>
  );
}
