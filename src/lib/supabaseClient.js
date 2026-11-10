import { createClient } from "@supabase/supabase-js";

// The values come from the .env file. Vite only exposes variables that start with VITE_.
// The publishable key is safe in the browser. Never put a service_role / sb_secret_ key here.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

// A second, throw-away client that does NOT keep a session. Used only when a manager
// creates a new user, so the manager is not signed out while the account is made.
export const createTempClient = () =>
  createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
