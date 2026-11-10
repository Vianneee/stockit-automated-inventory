// Small functions used by several pages. They take values and return values (no React in here).
import { CURRENCIES, getSettings } from "./settings.js";

export const LOW_FACTOR = 1.5;   // stock up to minimum x 1.5 counts as "Low stock"
export const DAY_MS = 86400000;

// 1250 -> "₱1,250"   (decimals = 2 -> "₱1,250.00")
export const peso = (n, decimals = 0) =>
  (CURRENCIES[getSettings().currency] || "₱") +
  Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// "5 min ago", "2 hr ago", "3 d ago"
export function timeAgo(date) {
  const minutes = Math.round((Date.now() - date) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + " min ago";
  if (minutes < 1440) return Math.round(minutes / 60) + " hr ago";
  return Math.round(minutes / 1440) + " d ago";
}

// "Nov 2 9:12 AM"  (the DATE AND TIME columns)
export const dateTime = (value) =>
  new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// "Nov 2"
export const shortDate = (value) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// The calendar date N days ago in Manila time as "YYYY-MM-DD" (same day boundaries as the daily_sales view)
export function manilaDate(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * DAY_MS).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// Midnight (00:00) of the day a date falls on
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// One rule for the Healthy / Low stock / Critical pills everywhere
export function stockStatus(item) {
  if (item.current_stock <= item.min_reorder_threshold) return { tone: "danger", label: "Critical", action: "Reorder now", rank: 0 };
  if (item.current_stock <= item.min_reorder_threshold * LOW_FACTOR) return { tone: "warn", label: "Low stock", action: "Low stock", rank: 1 };
  return { tone: "ok", label: "Healthy", action: "Healthy", rank: 2 };
}

// Short readable codes made from a row's id, e.g. "TX-3F9A21"
export const shortCode = (prefix, id) => prefix + "-" + String(id).replace(/-/g, "").slice(0, 6).toUpperCase();

// Numbered codes for suppliers / employees: ("SUP", 1) -> "SUP-02"
export const numberedCode = (prefix, index) => prefix + "-" + String(index + 1).padStart(2, "0");

export const ROLE_LABELS = { cashier: "Cashier", stock: "Stock staff", manager: "Manager", admin: "Manager (admin)" };
