import { useState } from "react";
import { useApp } from "../lib/AppContext.js";
import { CURRENCIES, getSettings, saveSettings } from "../lib/settings.js";
import { Chips, Field, Page, Panel } from "../components/ui.jsx";

export default function Settings() {
  const { themeChoice, setThemeChoice, showToast } = useApp();
  const [form, setForm] = useState(() => ({ ...getSettings() }));
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  function save(event) {
    event.preventDefault();
    saveSettings({
      ...form,
      historyDays: Math.max(7, parseInt(form.historyDays, 10) || 30),
      minDays: Math.max(1, parseInt(form.minDays, 10) || 7),
      alertDays: Math.max(1, parseInt(form.alertDays, 10) || 7),
    });
    showToast("Settings saved");
  }

  const num = (name) => ({ id: name, name, type: "number", min: 1, className: "input", value: form[name], onChange: change });

  return (
    <Page title="Settings" subtitle="Forecasting rules and appearance">
      <form className="grid-2 even" onSubmit={save}>
        <Panel title="Forecasting">
          <div className="form-stack">
            <Field label="Sales history window (days)" htmlFor="historyDays" hint="How many days of sales the forecast looks at."><input {...num("historyDays")} /></Field>
            <Field label="Minimum days of data for forecasting" htmlFor="minDays" hint="With less history, alerts compare stock to the minimum only."><input {...num("minDays")} /></Field>
            <Field label="Alert when days until stockout is at most" htmlFor="alertDays"><input {...num("alertDays")} /></Field>
          </div>
          <div className="form-actions left"><button className="btn btn-primary" type="submit">Save settings</button></div>
        </Panel>

        <Panel title="Appearance">
          <p className="muted">Choose how StockIT looks on this device</p>
          <Chips value={themeChoice} onChange={setThemeChoice} label="Theme" options={[
            { key: "light", label: "Light" }, { key: "dark", label: "Dark" }, { key: "system", label: "System" },
          ]} />
          <h2 className="section-title">Store</h2>
          <div className="form-stack">
            <Field label="Store name" htmlFor="storeName"><input id="storeName" name="storeName" className="input" value={form.storeName} onChange={change} /></Field>
            <Field label="Currency" htmlFor="currency">
              <select id="currency" name="currency" className="input" value={form.currency} onChange={change}>
                {Object.entries(CURRENCIES).map(([code, symbol]) => <option key={code} value={code}>{code} ({symbol})</option>)}
              </select>
            </Field>
          </div>
        </Panel>
      </form>
    </Page>
  );
}
