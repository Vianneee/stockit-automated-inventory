import { createContext, useContext } from "react";

// Context = values every page can read without passing props through every level.
// App provides: { session, profile, isManager, isAdmin, navigate, showToast, pendingCount, refreshPending }
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
