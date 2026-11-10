# StockIt Frontend

StockIt is a web-based inventory dashboard for an electronics store. It tracks sales and shipments, predicts which items will run out, and helps the manager approve reorders.

## Technologies Used

| Technology | Purpose |
|---|---|
| [React 19](https://react.dev) | Building reusable UI components |
| React DOM 19 | Rendering React components into the browser |
| [Vite](https://vite.dev) | Development server and production bundling |
| JSX | Combining JavaScript and HTML-like markup |
| CSS3 (variables) | Layout, light and dark themes, and responsiveness |
| JavaScript ES Modules | Importing and exporting application modules |
| [Supabase JS client](https://supabase.com) | Sign-in and reading and writing data |
| Tabler Icons, Inter font | Icons and the text typeface |

The application configuration is defined in [package.json](package.json).

> Data is stored in Supabase. The screens load it with the Supabase client, and the sign-in uses Supabase Auth.

## Project Structure

```
src/
├── main.jsx          starting point
├── App.jsx           shared state, roles and page selection
├── styles.css        colours (light and dark) and layout
├── pages/            one file per screen
├── components/       pieces used on many screens
└── lib/              rules and helpers (router, roles, forecast, useLoad)
```

## Main Functions and Features

### 1. Page Navigation

[router.js](src/lib/router.js) reads the address in the browser and [App.jsx](src/App.jsx) picks which screen to show. It is our own small router, without a library.

```js
export function useRoute() {
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const onChange = () => setParts(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parts;
}
```

```jsx
function pick(section, a, b) {
  switch (section) {
    case "items":
      if (a === "new") return <ItemForm />;
      if (a) return <ItemDetail itemId={a} />;
      return <Items />;
    case "alerts": return <Alerts />;
    default: return <Dashboard />;
  }
}
```

### 2. Role-Based Screens

[roles.js](src/lib/roles.js) decides which screens each role can open. The sidebar menu and the route guard both use it.

```js
const SECTIONS = {
  cashier: ["dashboard", "transactions"],
  stock: ["dashboard", "items", "transactions"],
};

export const canOpen = (role, section) =>
  !SECTIONS[role] || SECTIONS[role].includes(section);
```

```jsx
const page = canOpen(role, section) ? pick(section, a, b) : <Dashboard />;

{isManager && <button onClick={exportAll}>Export Order</button>}
```

### 3. Loading Data

[useLoad.js](src/lib/useLoad.js) is our own hook. Every page uses it to load data and handle waiting and errors.

```js
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: undefined, error: "", loading: true });
  const run = useCallback(async () => {
    try { setState({ data: await loader(), error: "", loading: false }); }
    catch (err) { setState({ data: undefined, error: err.message, loading: false }); }
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
```

```jsx
const { data, error, reload } = useLoad(async () =>
  must(await supabase.from("items").select("*").order("name"))
);
```

### 4. Search and Filter Items

[Items.jsx](src/pages/Items.jsx) stores the search text and the chosen category in state, then shows only the matching rows.

```jsx
const [search, setSearch] = useState("");
const [category, setCategory] = useState("all");

const rows = items
  .filter((i) => !term || i.name.toLowerCase().includes(term))
  .filter((i) => category === "all" || i.category === category);
```

```jsx
{rows.map((item) => (
  <tr key={item.item_id} onClick={() => navigate("items/" + item.item_id)}>
    <td>{item.name}</td>
    <td><StatusPill item={item} /></td>
  </tr>
))}
```

### 5. Forms and Validation

[ItemForm.jsx](src/pages/ItemForm.jsx) uses controlled inputs. Each value lives in state, and the form checks it before saving.

```jsx
const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

<input name="min_reorder_threshold" type="number" min="0"
       value={form.min_reorder_threshold} onChange={handleChange} required />
```

```jsx
async function handleSubmit(event) {
  event.preventDefault();
  const { error } = await supabase.from("items").insert(row);
  if (error) setError(error.code === "23505"
    ? "That SKU is already used by another item." : error.message);
}
```

### 6. Record a Sale or Receive Stock

[TransactionForm.jsx](src/components/TransactionForm.jsx) is one component used twice. The `kind` decides the text and the database function.

```jsx
const CONFIG = {
  receive: { title: "Receive shipment", rpc: "receive_stock" },
  sale:    { title: "Record sale",      rpc: "record_sale" },
};
const cfg = CONFIG[kind];

await supabase.rpc(cfg.rpc, { p_item_id: chosenId, p_quantity: amount });
```

```jsx
if (amount > item.current_stock)
  info = "Not enough stock: only " + item.current_stock + " left";

<TransactionForm kind="receive" />
<TransactionForm kind="sale" />
```

### 7. Stockout Alerts

[forecast.js](src/lib/forecast.js) works out how fast an item sells and flags the ones likely to run out. Red alerts, the most urgent, are sorted to the top.

```js
const velocity = soldLast7Days / 7;
const daysLeft = item.current_stock / velocity;
const atRisk = daysLeft <= alertDays
            || item.current_stock <= item.min_reorder_threshold;
```

```js
const critical = item.current_stock <= item.min_reorder_threshold || daysLeft <= 3;

alerts.sort((a, b) => Number(b.critical) - Number(a.critical)
                   || a.daysLeft - b.daysLeft);
```
