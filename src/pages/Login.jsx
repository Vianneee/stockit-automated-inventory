import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { Icon } from "../components/ui.jsx";

// Staff can type a username (stored as username@stockit.local) or a full email.
const toEmail = (text) => { const t = text.trim(); return t.includes("@") ? t : t.toLowerCase() + "@stockit.local"; };

// The group did not design a login screen, so this uses the same colors and fonts as the rest.
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(email), password });
    if (error) {
      setError(/invalid login credentials/i.test(error.message) ? "Incorrect email or password." : error.message);
      setBusy(false);
    }
    // On success App hears about the new session and shows the app.
  }

  return (
    <div className="login">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-icon"><Icon name="box" /></span>
          <span className="brand-text"><strong>StockIt</strong><small>Inventory</small></span>
        </div>
        <div className="hero-copy">
          <h2>Know your stock before it runs out.</h2>
          <p>Track every item, spot shortages days ahead, and send reorders in one click.</p>
          <ul className="hero-points">
            <li><Icon name="chart-line" /><span>Forecasts when each item will run out</span></li>
            <li><Icon name="bell-ringing" /><span>Alerts go to the manager for approval</span></li>
            <li><Icon name="download" /><span>Approved orders export in one click</span></li>
          </ul>
        </div>
        <p className="hero-foot">Automated Inventory Tracking and Replenishment</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h1>Welcome back</h1>
          <p className="muted">Sign in to continue to StockIT.</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email or username</label>
              <input className="input" type="text" id="email" placeholder="username or name@company.com" required autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input className="input" type={showPassword ? "text" : "password"} id="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="icon-btn" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>
                  <Icon name={showPassword ? "eye-off" : "eye"} />
                </button>
              </div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="login-help">Need an account? Ask your store manager to add you.</p>
        </div>
      </section>
    </div>
  );
}
