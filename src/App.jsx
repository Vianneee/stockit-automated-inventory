import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { AppContext } from "./lib/AppContext.js";
import { navigate, useRoute } from "./lib/router.js";
import { canOpen, permissions } from "./lib/roles.js";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Items from "./pages/Items.jsx";
import ItemDetail from "./pages/ItemDetail.jsx";
import ItemForm from "./pages/ItemForm.jsx";
import Transactions from "./pages/Transactions.jsx";
import TransactionDetail from "./pages/TransactionDetail.jsx";
import Alerts from "./pages/Alerts.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import SupplierDetail from "./pages/SupplierDetail.jsx";
import SupplierForm from "./pages/SupplierForm.jsx";
import Users from "./pages/Users.jsx";
import UserForm from "./pages/UserForm.jsx";
import Settings from "./pages/Settings.jsx";

// App owns what every page needs: who is signed in, the theme, the toast, and which page to show.
export default function App() {
  const [session, setSession] = useState(undefined);   // undefined = still checking, null = signed out
  const [profile, setProfile] = useState(null);        // { name, role } from the profiles table
  const [pendingCount, setPendingCount] = useState(0); // number on the bell
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const route = useRoute();

  // Theme choice is "light" | "dark" | "system". The screen only ever shows light or dark.
  const [themeChoice, setThemeChoice] = useState(() => {
    try { return localStorage.getItem("theme") || "light"; } catch { return "light"; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const themeIsDark = themeChoice === "dark" || (themeChoice === "system" && systemDark);

  // EFFECT: follow the computer's dark/light setting (used by "System")
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // EFFECT: put the theme on <html> (CSS reads data-theme) and remember the choice
  useEffect(() => {
    document.documentElement.dataset.theme = themeIsDark ? "dark" : "light";
    try { localStorage.setItem("theme", themeChoice); } catch { /* storage unavailable */ }
  }, [themeIsDark, themeChoice]);

  // EFFECT: is someone already signed in? Then listen for sign-in / sign-out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // EFFECT: load the signed-in user's profile
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("employee_id", session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  const refreshPending = useCallback(async () => {
    const { count } = await supabase.from("alerts").select("alert_id", { count: "exact", head: true }).eq("status", "pending");
    setPendingCount(count || 0);
  }, []);

  useEffect(() => { if (session) refreshPending(); }, [session, refreshPending]);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.hash = "";
  }

  if (session === undefined) return null;
  if (!session) return <Login />;

  const role = profile?.role ?? "cashier";
  const ctx = {
    session, profile, role, navigate, showToast, pendingCount, refreshPending,
    ...permissions(role),
    themeChoice, setThemeChoice,
  };

  const [section = "dashboard", a, b] = route;
  // A role that may not open this section is sent to the Dashboard
  const page = canOpen(role, section) ? pick(section, a, b) : <Dashboard />;

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <Sidebar
          section={canOpen(role, section) ? section : "dashboard"}
          themeIsDark={themeIsDark}
          profile={profile}
          onToggleTheme={() => setThemeChoice(themeIsDark ? "light" : "dark")}
          onSignOut={signOut}
        />
        <main className="main">{page}</main>
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </AppContext.Provider>
  );
}

// Which page for which address? (key={...} makes React start a page fresh when the id changes)
function pick(section, a, b) {
  switch (section) {
    case "items":
      if (a === "new") return <ItemForm key="new" />;
      if (a && b === "edit") return <ItemForm key={a} itemId={a} />;
      if (a) return <ItemDetail key={a} itemId={a} />;
      return <Items />;
    case "transactions":
      if (a === "log") return <Transactions key={b || "log"} presetItemId={b} />;
      if (a === "sale" && b) return <TransactionDetail key={b} saleId={b} />;
      return <Transactions />;
    case "alerts": return <Alerts />;
    case "suppliers":
      if (a === "new") return <SupplierForm key="new" />;
      if (a && b === "edit") return <SupplierForm key={a} supplierId={a} />;
      if (a) return <SupplierDetail key={a} supplierId={a} />;
      return <Suppliers />;
    case "users":
      if (a === "new") return <UserForm key="new" />;
      if (a) return <UserForm key={a} userId={a} />;
      return <Users />;
    case "settings": return <Settings />;
    default: return <Dashboard />;
  }
}
