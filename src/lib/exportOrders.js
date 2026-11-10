const csvCell = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';

// Turns a list of alerts into a CSV purchase order and downloads it.
export function downloadOrderCsv(alerts, filename) {
  const rows = [["Supplier", "Item", "SKU", "Current stock", "Order quantity"]].concat(
    alerts.map((a) => {
      const item = a.items || {};
      return [item.suppliers ? item.suppliers.name : "", item.name, item.sku, item.current_stock, a.suggested_reorder_qty];
    })
  );
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");

  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = filename || "order-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
