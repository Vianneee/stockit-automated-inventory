// Who can open what. "manager" (and the old "admin") see everything.
//   cashier  -> Dashboard, Transactions (record sale only)
//   stock    -> Dashboard, Items, Transactions (receive shipment only)
const SECTIONS = {
  cashier: ["dashboard", "transactions"],
  stock: ["dashboard", "items", "transactions"],
};

export const canOpen = (role, section) => !SECTIONS[role] || SECTIONS[role].includes(section);

// The yes/no flags every page reads from useApp()
export function permissions(role) {
  const manager = role === "manager" || role === "admin";
  return {
    isManager: manager,
    canSell: role === "cashier" || manager,
    canReceive: role === "stock" || manager,
    canAddItems: role === "stock" || manager,
    canViewItems: role === "stock" || manager,
  };
}
