import { useEffect, useState } from "react";

// A tiny hash router (no extra library). "#/items/abc/edit" -> ["items", "abc", "edit"]
const read = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);

export function useRoute() {
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const onChange = () => setParts(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parts;
}

export const navigate = (path) => { window.location.hash = "/" + path.replace(/^\/+/, ""); };
