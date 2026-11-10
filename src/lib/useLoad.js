import { useCallback, useEffect, useState } from "react";

// A custom hook: runs an async `loader` when the page appears (and whenever `deps` change),
// and gives back { data, error, loading, reload }. Every page uses it so we don't repeat
// the same useEffect / try-catch code in every file.
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, error: "", loading: true });

  const run = useCallback(async () => {
    try {
      const data = await loader();
      setState({ data, error: "", loading: false });
    } catch (err) {
      console.error(err);
      setState({ data: undefined, error: err.message || String(err), loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { ...state, reload: run };
}

// Throws if a Supabase response has an error, otherwise returns its data.
export function must({ data, error }) {
  if (error) throw error;
  return data;
}
