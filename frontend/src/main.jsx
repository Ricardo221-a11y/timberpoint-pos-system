import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  Outlet,
  Link,
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

          {/* Accounts module entry (goes to accounts overview) */}
          <NavLink to="/accounts/overview" onClick={closeMenu}>
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

function AccountsLayout({ children }) {
  return (
    <div>
      <div className="top">
        <h1>Accounts & Financial Workspace</h1>
        <p>Accounts receivable, payable liabilities, double-entry general ledger, and expenses</p>
      </div>
      <div className="tabs">
        <Link to="overview" className="tab">Overview</Link>
        <Link to="receivables" className="tab">Receivables (AR)</Link>
        <Link to="payables" className="tab">Payables (AP)</Link>
        <Link to="gl" className="tab">General Ledger (GL)</Link>
        <Link to="expenses" className="tab">Expenses</Link>
      </div>
      <div style={{ marginTop: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}

function AccountsOverview() {
  const [d, setD] = useState({});

  useEffect(() => {
    api('/api/dashboard').then(setD).catch(()=>{});
  }, []);

  return (
    <>
      <div className="grid">
        <div className="card stat">
          <span>A/R OUTSTANDING</span>
          <strong>${Number(d.debtors || d.debtors || 0).toFixed(2)}</strong>
          <div className="muted">{d.debtors ? `${d.debtors} outstanding` : '0 active corporate client accounts'}</div>
        </div>
        <div className="card stat">
          <span>A/P LIABILITIES</span>
          <strong>${Number(d.creditors || 0).toFixed(2)}</strong>
          <div className="muted">{d.creditors ? `${d.creditors} vendor invoices awaiting disbursement` : '0 vendor invoices'}</div>
        </div>
        <div className="card stat">
          <span>OPERATING EXPENSES</span>
          <strong>${Number((d.indirect_expenses||0)).toFixed(2)}</strong>
          <div className="muted">Current month verified receipts</div>
        </div>
      </div>

      <div className="card">
        <h3>Provisional Monthly Profit & Loss (P&L)</h3>
        <div className="pl-row"><span>Gross POS Retail & Beverage Revenue</span><strong className="green">${Number(d.revenue||0).toFixed(2)}</strong></div>
        <div className="pl-row"><span>Less: Cost of Goods Sold (COGS)</span><strong className="red">-${Number(d.cogs||d.cost_of_goods_sold||0).toFixed(2)}</strong></div>
        <div className="pl-row"><span>Gross Operating Margin</span><strong>${Number(d.gross_profit||0).toFixed(2)}</strong></div>
        <div className="pl-row"><span>Operating Expenses & Utilities</span><strong className="red">-${Number(d.indirect_expenses||0).toFixed(2)}</strong></div>
        <div className="pl-row total"><span>Net Estimated Operating Profit</span><strong className="green">${Number(d.operating_profit|| ( (d.gross_profit||0) - (d.indirect_expenses||0) ) ).toFixed(2)}</strong></div>
      </div>
    </>
  );
}

function AccountsReceivables() {
  const [customers, setCustomers] = useState([]);

  useEffect(()=>{
    api('/api/customers').then(setCustomers).catch(()=>{});
  },[]);

  function statusFor(c){
    if(!c.balance || c.balance<=0) return 'PAID';
    // simple heuristic: if credit_limit>0 and balance>0 return PARTIAL else OVERDUE
    if(c.credit_limit && c.balance>0) return 'PARTIAL';
    return 'OVERDUE';
  }

  return (
    <div>
      <h2>Accounts Receivable Ledger (Customer Aging)</h2>
      <div className="card">
        <table className="table">
          <thead><tr><th>Customer</th><th>Contact</th><th>Balance Due</th><th>Status</th></tr></thead>
          <tbody>
            {customers.map(c=> (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}<br/><small className="muted">{c.email}</small></td>
                <td>${Number(c.balance||0).toFixed(2)}</td>
                <td><span className={`pill ${statusFor(c).toLowerCase()}`}>{statusFor(c)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountsPayables(){
  const [suppliers, setSuppliers] = useState([]);
  useEffect(()=>{
    api('/api/suppliers').then(setSuppliers).catch(()=>{});
  },[]);

  function statusFor(s){
    if(!s.balance || s.balance<=0) return 'PAID';
    return 'UNPAID';
  }

  return (
    <div>
      <h2>Accounts Payable Ledger (Vendor Liabilities)</h2>
      <div className="card">
        <table className="table">
          <thead><tr><th>Bill #</th><th>Vendor</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {suppliers.map(s=> (
              <tr key={s.id}>
                <td>{s.code || `BILL-VEND-${s.id}`}</td>
                <td>{s.name}</td>
                <td className="muted">{s.category || 'Inventory Cost'}</td>
                <td>${Number(s.balance||0).toFixed(2)}</td>
                <td><span className={`pill ${statusFor(s).toLowerCase()}`}>{statusFor(s)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountsGL(){
  const [vouchers, setVouchers] = useState([]);

  useEffect(()=>{
    Promise.all([api('/api/sales'), api('/api/expenses')]).then(([sales, exps])=>{
      // Map sales to voucher-like entries (revenue & COGS allocation)
      let rows = [];
      for(let s of sales){
        rows.push({
          voucher_ref: `JV-SALE-${s.id || s.number}`,
          date: s.created_at || s.date || null,
          description: `Daily POS Sales ${s.number || ''}`,
          debit_account: '1010 - Operating Cash / Merchant Bank',
          credit_account: '4010 - POS Merchandise & Beverage Revenue',
          amount: s.total || 0,
          posted_by: s.cashier_id || s.cashier || ''
        });
        // COGS allocation row (if cost_total exists)
        if(s.cost_total){
          rows.push({
            voucher_ref: `JV-SALE-COGS-${s.id || s.number}`,
            date: s.created_at || s.date || null,
            description: 'Inventory Cost of Goods Sold Allocation',
            debit_account: '5010 - Cost of Goods Sold (COGS)',
            credit_account: '1200 - Merchandise Inventory Asset',
            amount: s.cost_total || 0,
            posted_by: s.cashier_id || ''
          });
        }
      }
      // Map expenses to ledger entries
      for(let e of exps){
        rows.push({
          voucher_ref: `JV-EXP-${e.id}`,
          date: e.date || null,
          description: e.notes || (e.category?.name || 'Expense'),
          debit_account: `${e.category?.name || 'Expense'} - ${e.category?.kind || ''}`,
          credit_account: '1010 - Operating Cash',
          amount: e.amount || 0,
          posted_by: ''
        });
      }
      setVouchers(rows.sort((a,b)=> (b.date||'') > (a.date||'') ? 1:-1));
    }).catch(()=>{});
  },[]);

  return (
    <div>
      <h2>General Ledger Journal Vouchers</h2>
      <div className="card">
        <table className="table">
          <thead><tr><th>Voucher Ref</th><th>Date</th><th>Description</th><th>Debit Account</th><th>Credit Account</th><th>Amount</th><th>Posted By</th></tr></thead>
          <tbody>
            {vouchers.map(v=> (
              <tr key={v.voucher_ref}>
                <td>{v.voucher_ref}</td>
                <td>{v.date ? new Date(v.date).toLocaleDateString() : ''}</td>
                <td>{v.description}</td>
                <td style={{color:'#2ed573'}}>{v.debit_account}</td>
                <td style={{color:'#2f80ed'}}>{v.credit_account}</td>
                <td><strong>${Number(v.amount||0).toFixed(2)}</strong></td>
                <td>{v.posted_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
    api('/api/expenses').then(setRows).catch(()=>{});
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
        <Route path="/dashboard" element={<AccountsOverview />} />
        <Route path="/stock" element={<TablePage title="Stock" path="/api/products" />} />
        <Route path="/sales" element={<TablePage title="Sales" path="/api/sales" />} />
        <Route path="/customers" element={<TablePage title="Customers & Debtors" path="/api/customers" />} />
        <Route path="/suppliers" element={<TablePage title="Suppliers & Creditors" path="/api/suppliers" />} />

        {/* Accounts hub */}
        <Route path="/accounts" element={<AccountsLayout />}>
          <Route path="overview" element={<AccountsOverview />} />
          <Route path="receivables" element={<AccountsReceivables />} />
          <Route path="payables" element={<AccountsPayables />} />
          <Route path="gl" element={<AccountsGL />} />
          <Route path="expenses" element={<Expenses />} />
        </Route>

        {/* keep legacy routes for direct access */}
        <Route path="/accounts/expenses" element={<Expenses />} />
        <Route path="/accounts/ledger" element={<Ledger />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
