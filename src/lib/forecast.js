import { supabase } from "./supabaseClient.js";
import { manilaDate } from "./helpers.js";
import { getSettings } from "./settings.js";

// The forecasting rule from the flowchart, as ONE plain function so every screen agrees.
//   rows  = this item's daily_sales rows for the history window ({ sale_date, units_sold })
//   item  = { current_stock, min_reorder_threshold }
// Returns { mode, velocity, daysLeft, atRisk }.
export function analyse(item, rows) {
  const { minDays, alertDays } = getSettings();
  const belowMin = item.current_stock <= item.min_reorder_threshold;

  // Not enough history yet: only compare stock with the minimum threshold
  if (!rows || rows.length < minDays) {
    return { mode: "threshold", velocity: null, daysLeft: Infinity, atRisk: belowMin };
  }

  // Velocity = units sold in the last 7 calendar days (Manila) / 7
  const weekStart = manilaDate(6);
  const velocity = rows.filter((r) => r.sale_date >= weekStart).reduce((sum, r) => sum + r.units_sold, 0) / 7;
  const daysLeft = velocity > 0 ? item.current_stock / velocity : Infinity;

  return { mode: "velocity", velocity, daysLeft, atRisk: daysLeft <= alertDays || belowMin };
}

// Runs after a transaction changes an item's stock:
// pull history -> analyse -> if at risk and no pending alert yet, insert one.
// Returns true when a new alert was created.
export async function runForecastCheck(itemId) {
  const { data: item } = await supabase
    .from("items")
    .select("current_stock, min_reorder_threshold, standard_reorder_qty")
    .eq("item_id", itemId)
    .single();
  if (!item) return false;

  const since = manilaDate(getSettings().historyDays);
  const { data: history } = await supabase
    .from("daily_sales")
    .select("sale_date, units_sold")
    .eq("item_id", itemId)
    .gte("sale_date", since);

  if (!analyse(item, history).atRisk) return false;

  // Don't create a second pending alert for the same item
  const { data: existing } = await supabase
    .from("alerts").select("alert_id").eq("item_id", itemId).eq("status", "pending").maybeSingle();
  if (existing) return false;

  const { error } = await supabase.from("alerts").insert({
    item_id: itemId, status: "pending", suggested_reorder_qty: item.standard_reorder_qty,
  });
  return !error;
}

// Group daily_sales rows by item: { item_id: [rows...] }
export function groupByItem(rows) {
  const out = {};
  (rows || []).forEach((r) => (out[r.item_id] = out[r.item_id] || []).push(r));
  return out;
}

// Red (critical) = at or below the minimum, or 3 days or less of stock left. Everything else is yellow.
export const CRITICAL_DAYS = 3;

// Adds { daysLeft, critical } to each alert and sorts: red first, then yellow.
// Inside each color the most urgent comes first (fewest days left, then the oldest alert).
export function prioritiseAlerts(alerts, dailyByItem) {
  return alerts
    .map((a) => {
      const item = a.items || {};
      const { velocity, daysLeft } = analyse(item, dailyByItem[a.item_id]);
      const critical = item.current_stock <= item.min_reorder_threshold || daysLeft <= CRITICAL_DAYS;
      return { ...a, velocity, daysLeft, critical };
    })
    .sort((a, b) => Number(b.critical) - Number(a.critical)
      || (isFinite(a.daysLeft) ? a.daysLeft : 1e9) - (isFinite(b.daysLeft) ? b.daysLeft : 1e9)
      || new Date(a.flagged_at) - new Date(b.flagged_at));
}
