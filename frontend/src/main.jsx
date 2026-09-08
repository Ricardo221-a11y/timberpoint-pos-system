import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  Outlet,
} from "react-router-dom";
import { api, login, tk } from "./api";
import "./styles.css";

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="layout">
      <button
        className="hamburger"
        type="button"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        ☰
      </button>

      {menuOpen && <div className="overlay" onClick={closeMenu} />}

      <aside className={`side${menuOpen ? " open" : ""}`}>
        <div className="logo">
          TIMBER<b>POINT</b>
          <small style={{ display: "block" }}>SMART POS</small>
        </div>

        <nav className="nav">
          <NavLink to="/" onClick={closeMenu} end>
            Point of Sale
          </NavLink>
          <NavLink to="/dashboard" onClick={closeMenu}>
            Dashboard
          </NavLink>
          <NavLink to="/stock" onClick={closeMenu}>
            Stock
          </NavLink>
          <NavLink to="/sales" onClick={closeMenu}>
            Sales
          </NavLink>
          <NavLink to="/customers" onClick={closeMenu}>
            Debtors
          </NavLink>
          <NavLink to="/suppliers" onClick={closeMenu}>
            Creditors
          </NavLink>

          {/* Accounts module with Expenses and Ledger */}
          <NavLink to="/accounts/expenses" onClick={closeMenu}>
            Accounts
          </NavLink>

          <a
            href="#"
            onClick={() => {
              localStorage.clear();
              location.href = "/login";
            }}
          >
            Sign out
          </a>
        </nav>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function Login() {
  let [e, se] = useState("director@timberdemo.co.zw"),
    [p, sp] = useState("TimberPOS2026!"),
    [er, sr] = useState("");
  return (
    <div className="login">
      <form
        className="loginbox"
        onSubmit={async (x) => {
          x.preventDefault();
          try {
            await login(e, p);
            location.href = "/";
          } catch (z) {
            sr(z.message);
          }
        }}
      >
        <h1>TimberPoint POS</h1>
        <p>Sales, stock, profit and customer accounts.</p>
        <input value={e} onChange={(x) => se(x.target.value)} />
        <input
          type="password"
          value={p}
          onChange={(x) => sp(x.target.value)}
        />
        {er && <p>{er}</p>}
        <button className="btn" style={{ width: "100%" }}>
          Sign in
        </button>
      </form>
    </div>
  );
}

function POS() {
  let [products, setProducts] = useState([]),
    [sites, setSites] = useState([]),
    [customers, setCustomers] = useState([]),
    [site, setSite] = useState("") ,
    [cust, setCust] = useState("") ,
    [level, setLevel] = useState("retail"),
    [currency, setCurrency] = useState("USD"),
    [rate, setRate] = useState(1),
    [search, setSearch] = useState(""),
    [cart, setCart] = useState([]),
    [paid, setPaid] = useState(0),
    [method, setMethod] = useState("cash"),
    [last, setLast] = useState(null),
    [msg, setMsg] = useState("");

  let load = () =>
    Promise.all([
      api("/api/products" + (site ? `?site_id=${site}` : "")),
      api("/api/sites"),
      api("/api/customers"),
    ]).then(([p, s, c]) => {
      setProducts(p);
      setSites(s);
      setCustomers(c);
      if (!site && s[0]) setSite(String(s[0].id));
    });

  useEffect(() => {
    load();
  }, [site]);

  let shown = products.filter((x) =>
    (x.name + x.sku + x.barcode)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  let total = cart.reduce((a, x) => a + x.quantity * x.unit_price, 0);

  function add(p) {
    setCart((c) => {
      let z = c.find((x) => x.product_id === p.id);
      return z
        ? c.map((x) =>
            x.product_id === p.id
              ? { ...x, quantity: x.quantity + 1 }
              : x
          )
        : [
            ...c,
            {
              product_id: p.id,
              name: p.name,
              sku: p.sku,
              quantity: 1,
              unit_price: p[level],
            },
          ];
    });
  }

  async function complete() {
    let payload = {
      number: "SALE-" + Date.now(),
      site_id: Number(site),
      customer_id: cust ? Number(cust) : null,
      currency,
      exchange_rate: Number(rate),
      price_level: level,
      lines: cart,
      discount: 0,
      payment_method: method,
      amount_paid: Number(paid),
    };

    try {
      let s = navigator.onLine
        ? await api("/api/sales", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        : null;

      if (!navigator.onLine) {
        let q = JSON.parse(localStorage.getItem("offlineSales") || "[]");
        q.push(payload);
        localStorage.setItem("offlineSales", JSON.stringify(q));
        setMsg("Sale queued offline");
      } else {
        setLast(s);
        setMsg("Sale completed");
      }

      setCart([]);
      setPaid(0);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function sync() {
    let q = JSON.parse(localStorage.getItem("offlineSales") || "[]");
    for (let s of q)
      await api("/api/sales", {
        method: "POST",
        body: JSON.stringify(s),
      });
    localStorage.removeItem("offlineSales");
    setMsg("Offline sales synchronized");
    load();
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Timber Point of Sale</h1>
          <div>Scan barcode or select timber product</div>
        </div>
        <div className="actions">
          <button className="btn alt" onClick={sync}>
            Sync offline sales
          </button>
        </div>
      </div>

      {!navigator.onLine && (
        <div className="offline">
          Offline mode: completed sales will be queued.
        </div>
      )}

      {msg && <div className="card">{msg}</div>}

      <div className="pos">
        <div>
          <div className="card">
            <div className="actions">
              <input
                style={{ flex: 1, padding: 10 }}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Scan barcode, SKU or search timber"
              />
              <select value={site} onChange={(e) => setSite(e.target.value)}>
                {sites.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="retail">Retail</option>
                <option value="contractor">Contractor</option>
                <option value="bulk">Bulk</option>
              </select>
            </div>
          </div>

          <div className="products">
            {shown.map((p) => (
              <button
                key={p.id}
                className="product"
                onClick={() => add(p)}
              >
                <strong>{p.name}</strong>
                <small>
                  {p.dimensions} · Stock {p.quantity}
                </small>
                <h3>${p[level]}</h3>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Sale</h2>

          {cart.map((x) => (
            <div className="cartline" key={x.product_id}>
              <span>{x.name}</span>
              <input
                type="number"
                min="1"
                value={x.quantity}
                onChange={(e) =>
                  setCart((c) =>
                    c.map((y) =>
                      y.product_id === x.product_id
                        ? { ...y, quantity: Number(e.target.value) }
                        : y
                    )
                  )
                }
              />
              <span>${(x.quantity * x.unit_price).toFixed(2)}</span>
              <button
                onClick={() =>
                  setCart((c) => c.filter((y) => y.product_id !== x.product_id))
                }
              >
                ×
              </button>
            </div>
          ))}

          <h2>
            Total: {currency} {(total * rate).toFixed(2)}
          </h2>

          <div className="field">
            <label>Customer</label>
            <select value={cust} onChange={(e) => setCust(e.target.value)}>
              <option value="">Walk-in</option>
              {customers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div className="actions">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>USD</option>
              <option>ZiG</option>
            </select>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              title="Exchange rate"
            />
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>cash</option>
              <option>card</option>
              <option>mobile_money</option>
              <option>credit</option>
            </select>
          </div>

          <div className="field">
            <label>Amount paid</label>
            <input
              type="number"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>

          <button
            className="btn"
            disabled={!cart.length}
            style={{ width: "100%" }}
            onClick={complete}
          >
            Charge {currency} {(total * rate).toFixed(2)}
          </button>

          {last && (
            <div className="receipt">
              <hr />
              <h3>TIMBERPOINT</h3>
              <div>{last.number}</div>
              {last.lines.map((x, i) => (
                <div key={i}>
                  {x.name} x{x.quantity} {x.total.toFixed(2)}
                </div>
              ))}
              <b>
                Total {last.currency} {last.total.toFixed(2)}
              </b>
              <p>Reliable timber · Lasting strength</p>
              <button className="btn alt" onClick={() => print()}>
                Print receipt
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Dashboard() {
  let [d, s] = useState({});
  useEffect(() => {
    api("/api/dashboard").then(s);
  }, []);

  return (
    <>
      <div className="top">
        <h1>Business Dashboard</h1>
      </div>
      <div className="grid">
        {[
          ["Revenue", d.revenue],
          ["Gross profit", d.gross_profit],
          ["Stock value", d.stock_value],
          ["Low stock", d.low_stock],
          ["Debtors", d.debtors],
          ["Creditors", d.creditors],
          ["Direct expenses", d.direct_expenses],
          ["Indirect expenses", d.indirect_expenses],
          ["Operating profit", d.operating_profit],
        ].map(([a, b]) => (
          <div className="card stat" key={a}>
            <span>{a}</span>
            <strong>
              {a === "Low stock" ? b : "$" + Number(b || 0).toFixed(2)}
            </strong>
          </div>
        ))}
      </div>
    </>
  );
}

function TablePage({ title, path }) {
  let [r, s] = useState([]);
  useEffect(() => {
    api(path).then(s);
  }, [path]);

  return (
    <>
      <div className="top">
        <h1>{title}</h1>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Name / Details</th>
              <th>Amount / Stock</th>
            </tr>
          </thead>
          <tbody>
            {r.map((x, i) => (
              <tr key={i}>
                <td>{x.number || x.code || x.sku}</td>
                <td>{x.name || x.payment_method || x.category}</td>
                <td>{x.total ?? x.balance ?? x.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Expenses() {
  const [cats, setCats] = useState([]);
  const [exps, setExps] = useState([]);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({ category_id: "", amount: "", date: "", site_id: "", notes: "" });
  const [summary, setSummary] = useState({ direct: 0, indirect: 0 });

  async function load() {
    const [c, e, s] = await Promise.all([
      api('/api/expense-categories'),
      api('/api/expenses'),
      api('/api/sites'),
    ]);
    setCats(c);
    setExps(e);
    setSites(s);

    // compute direct/indirect totals from summary endpoint
    try {
      const sums = await api('/api/reports/expenses-summary');
      let d = 0, ii = 0;
      for (let r of sums) {
        if (r.kind === 'direct') d += Number(r.total || 0);
        else if (r.kind === 'indirect') ii += Number(r.total || 0);
      }
      setSummary({ direct: d, indirect: ii });
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api('/api/expenses', { method: 'POST', body: JSON.stringify({
        category_id: Number(form.category_id),
        amount: Number(form.amount),
        date: form.date || undefined,
        site_id: form.site_id ? Number(form.site_id) : undefined,
        notes: form.notes,
      }) });
      setForm({ category_id: '', amount: '', date: '', site_id: '', notes: '' });
      load();
    } catch (err) {
      alert(err.message || err);
    }
  }

  return (
    <>
      <div className="top">
        <h1>Accounts — Expenses</h1>
      </div>

      <div className="grid">
        <div className="card">
          <h3>New expense</h3>
          <form onSubmit={submit}>
            <div className="field">
              <label>Category</label>
              <select value={form.category_id} onChange={(e)=>setForm({...form, category_id: e.target.value})}>
                <option value="">-- pick --</option>
                {cats.map(c=> <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input type="number" value={form.amount} onChange={(e)=>setForm({...form, amount: e.target.value})} />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e)=>setForm({...form, date: e.target.value})} />
            </div>
            <div className="field">
              <label>Site</label>
              <select value={form.site_id} onChange={(e)=>setForm({...form, site_id: e.target.value})}>
                <option value="">-- none --</option>
                {sites.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Notes</label>
              <input value={form.notes} onChange={(e)=>setForm({...form, notes: e.target.value})} />
            </div>
            <div className="actions">
              <button className="btn" type="submit">Create expense</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>Summary</h3>
          <div className="stat">Direct: ${Number(summary.direct || 0).toFixed(2)}</div>
          <div className="stat">Indirect: ${Number(summary.indirect || 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <h3>Recent expenses</h3>
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Category</th><th>Kind</th><th>Amount</th><th>Site</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {exps.map((x)=> (
              <tr key={x.id}>
                <td>{new Date(x.date).toLocaleDateString()}</td>
                <td>{x.category?.name || x.category}</td>
                <td>{x.category?.kind || ''}</td>
                <td>${Number(x.amount).toFixed(2)}</td>
                <td>{x.site_id || ''}</td>
                <td>{x.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Ledger() {
  const [rows, setRows] = useState([]);
  useEffect(()=>{
    api('/api/expenses').then(setRows);
  },[]);

  return (
    <>
      <div className="top"><h1>Accounts — Ledger</h1></div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Category</th><th>Kind</th><th>Amount</th><th>Site</th><th>Ref</th></tr>
          </thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id}>
                <td>{new Date(r.date).toLocaleDateString()}</td>
                <td>{r.category?.name || r.category_id}</td>
                <td>{r.category?.kind || ''}</td>
                <td>${Number(r.amount).toFixed(2)}</td>
                <td>{r.site_id || ''}</td>
                <td>{r.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

let G = ({ children }) => (tk() ? children : <Navigate to="/login" />);

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <G>
            <Layout />
          </G>
        }
      >
        <Route path="/" element={<POS />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/stock"
          element={<TablePage title="Stock" path="/api/products" />}
        />
        <Route
          path="/sales"
          element={<TablePage title="Sales" path="/api/sales" />}
        />
        <Route
          path="/customers"
          element={
            <TablePage title="Customers & Debtors" path="/api/customers" />
          }
        />
        <Route
          path="/suppliers"
          element={
            <TablePage title="Suppliers & Creditors" path="/api/suppliers" />
          }
        />
        <Route path="/accounts/expenses" element={<Expenses />} />
        <Route path="/accounts/ledger" element={<Ledger />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
