// Settings screen values. They are saved in this browser (localStorage), so no new table is needed.
// Defaults come from the flowchart: pull 30 days, need 7 days of history, alert at 7 days left.
const KEY = "stockit-settings";

export const DEFAULTS = {
  historyDays: 30,   // how many days of sales the forecast pulls
  minDays: 7,        // fewer days than this -> minimum-threshold check only
  alertDays: 7,      // flag when days until stockout is at most this
  storeName: "StockIT Store",
  currency: "PHP",
};

export const CURRENCIES = { PHP: "₱", USD: "$", EUR: "€" };

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}

let current = load();   // kept in memory so every call is fast

export const getSettings = () => current;

export function saveSettings(next) {
  current = { ...DEFAULTS, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
}
