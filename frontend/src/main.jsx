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
    [category, setCategory] = useState("All"),
    [cart, setCart] = useState([]),
    [paid, setPaid] = useState(0),
    [method, setMethod] = useState("cash"),
    [last, setLast] = useState(null),
    [msg, setMsg] = useState(""),
    [toast, setToast] = useState("");

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

  const categories = [
    "All",
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
  ];

  let shown = products.filter((x) => {
    const matchesSearch = (x.name + " " + x.sku + " " + x.barcode)
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCat = category === "All" || x.category === category;
    return matchesSearch && matchesCat;
  });

  let subtotal = cart.reduce((a, x) => a + x.quantity * x.unit_price, 0);
  let tax = subtotal * 0.08;
  let total = subtotal + tax;
  let totalConverted = total * rate;
  let change = Number(paid) - totalConverted;

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(""), 2200);
  }

  function add(p) {
    setCart((c) => {
      let z = c.find((x) => x.product_id === p.id);
      const lineTotal = (p[level] || 0).toFixed(2);
      showToast(`Added: 1x ${p.name} ($${lineTotal})`);
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

  function inc(pid, delta) {
    setCart((c) =>
      c
        .map((x) =>
          x.product_id === pid ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x
        )
        .filter((x) => x.quantity > 0)
    );
  }

  function removeLine(pid) {
    setCart((c) => c.filter((y) => y.product_id !== pid));
  }

  function clearAll() {
    if (cart.length && window.confirm("Clear the current ticket?")) {
      setCart([]);
      setPaid(0);
    }
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
    showToast("Offline sales synchronized");
    setMsg("");
    load();
  }

  function quickPay(amount) {
    setPaid(String(amount));
  }

  return (
    <div className="pos-shell">
      <header className="pos-topbar">
        <div className="pos-brand">
          <div className="pos-logo">TP</div>
          <div>
            <div className="pos-brand-name">TIMBER<b>POINT</b></div>
            <div className="pos-brand-sub">Smart POS · Timber Sales</div>
          </div>
        </div>

        <div className="pos-location">
          <select value={site} onChange={(e) => setSite(e.target.value)} className="pos-select-dark">
            {sites.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.code || "SITE-" + x.id})
              </option>
            ))}
          </select>
        </div>

        <div className="pos-utils">
          {toast && <div className="pos-toast">🛒 {toast}</div>}
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="pos-select-dark">
            <option value="retail">Retail Price</option>
            <option value="contractor">Contractor</option>
            <option value="bulk">Bulk</option>
          </select>
          <button className="pos-util-btn" onClick={sync} title="Sync offline sales">
            🔄 Sync
          </button>
          <span className={"pos-online " + (navigator.onLine ? "on" : "off")}>
            ● {navigator.onLine ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      <div className="pos-body">
        <aside className="pos-cart">
          <div className="pos-till-banner">
            <span className="till-dot"></span>
            <span className="till-label">TILL #01</span>
            <span className="till-meta">Lane {site || 1}</span>
          </div>

          <div className="pos-ticket-head">
            <div className="ticket-title">
              <span>🎟️ CURRENT TICKET</span>
              <span className="item-badge">{cart.length} items</span>
            </div>
            <div className="ticket-actions">
              <button className="ticket-btn hold" onClick={() => showToast("Ticket held")}>Hold</button>
              <button className="ticket-btn clear" onClick={clearAll} disabled={!cart.length}>Clear All</button>
            </div>
          </div>

          <div className="pos-lines-head">
            <span>ITEM DESCRIPTION</span>
            <span className="col-qty">QTY</span>
            <span className="col-tot">TOTAL</span>
          </div>

          <div className="pos-lines">
            {cart.length === 0 && (
              <div className="empty-cart">
                <div className="empty-icon">🛒</div>
                <div>Scan or add a timber product to begin the sale.</div>
              </div>
            )}
            {cart.map((x) => (
              <div className="cart-line" key={x.product_id}>
                <div className="cl-desc">
                  <div className="cl-name">{x.name}</div>
                  <div className="cl-sku">
                    {x.sku} · ${Number(x.unit_price || 0).toFixed(2)} each
                  </div>
                </div>
                <div className="cl-qty">
                  <button className="qbtn" onClick={() => inc(x.product_id, -1)}>−</button>
                  <span>{x.quantity}</span>
                  <button className="qbtn" onClick={() => inc(x.product_id, 1)}>+</button>
                </div>
                <div className="cl-total">
                  ${(x.quantity * x.unit_price).toFixed(2)}
                </div>
                <button className="cl-del" onClick={() => removeLine(x.product_id)} title="Remove line">🗑</button>
              </div>
            ))}
          </div>

          <div className="pos-totals">
            <div className="tot-row"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="tot-row"><span>Tax (Est. 8%):</span><span>${tax.toFixed(2)}</span></div>
            {currency !== "USD" && rate != 1 && (
              <div className="tot-row"><span>Rate (×{rate}):</span><span>{currency}</span></div>
            )}
            <div className="tot-row grand">
              <span>TOTAL DUE</span>
              <span className="grand-val">{currency} {totalConverted.toFixed(2)}</span>
            </div>
            <div className="tot-row change">
              <span>Change:</span>
              <span>{currency} {Math.max(0, change).toFixed(2)}</span>
            </div>
          </div>

          <div className="pay-methods">
            <button
              className={"pay-btn " + (method === "cash" ? "on" : "")}
              onClick={() => setMethod("cash")}
            >💵 Cash</button>
            <button
              className={"pay-btn " + (method === "card" ? "on" : "")}
              onClick={() => setMethod("card")}
            >💳 Card</button>
            <button
              className={"pay-btn " + (method === "mobile_money" ? "on" : "")}
              onClick={() => setMethod("mobile_money")}
            >📱 Mobile</button>
            <button
              className={"pay-btn " + (method === "credit" ? "on" : "")}
              onClick={() => setMethod("credit")}
            >📒 Credit</button>
          </div>

          <div className="quick-cash-row">
            <button className="qc" onClick={() => setPaid(String(totalConverted.toFixed(2)))}>Exact</button>
            <button className="qc" onClick={() => quickPay(5)}>$5</button>
            <button className="qc" onClick={() => quickPay(10)}>$10</button>
            <button className="qc" onClick={() => quickPay(20)}>$20</button>
            <button className="qc" onClick={() => quickPay(50)}>$50</button>
            <button className="qc" onClick={() => quickPay(100)}>$100</button>
          </div>

          <div className="field pay-amount">
            <label>Amount tendered ({currency})</label>
            <input
              type="number"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="field margin-fix">
            <label>Customer (optional)</label>
            <select value={cust} onChange={(e) => setCust(e.target.value)}>
              <option value="">— Walk-in customer —</option>
              {customers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.code}
                </option>
              ))}
            </select>
          </div>

          <div className="pos-meta-row">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>USD</option>
              <option>ZiG</option>
              <option>ZAR</option>
            </select>
            <input
              type="number"
              step="0.0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              title="Exchange rate"
              placeholder="Rate"
            />
          </div>

          <button
            className="complete-btn"
            disabled={!cart.length}
            onClick={complete}
          >
            ✅ Complete Sale &amp; Print Receipt
          </button>

          {msg && <div className="pos-msg">{msg}</div>}

          {last && (
            <div className="receipt">
              <hr />
              <h3>TIMBERPOINT</h3>
              <div>{last.number}</div>
              {last.lines && last.lines.map((x, i) => (
                <div key={i}>
                  {x.name} x{x.quantity} {Number(x.total || 0).toFixed(2)}
                </div>
              ))}
              <b>
                Total {last.currency || "USD"} {Number(last.total || 0).toFixed(2)}
              </b>
              <p>Reliable timber · Lasting strength</p>
              <button className="btn alt" onClick={() => print()}>
                Print receipt
              </button>
            </div>
          )}
        </aside>

        <section className="pos-products">
          <div className="pos-search-row">
            <div className="pos-search">
              <span className="search-ico">🔍</span>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Punch SKU / Barcode / Item name (e.g. ROOF-001)..."
              />
            </div>
            <button className="punch-btn" title="Punch / Enter">Punch ↵</button>
          </div>

          <div className="pos-cats">
            {categories.map((c) => (
              <button
                key={c}
                className={"cat-chip " + (category === c ? "on" : "")}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="pos-grid">
            {shown.length === 0 && (
              <div className="empty-prod">
                No products match your filter.
              </div>
            )}
            {shown.map((p) => (
              <div key={p.id} className="prod-card">
                <div className="prod-head">
                  <span className="prod-sku">{p.sku}</span>
                  <span className="prod-stock">{Math.round(Number(p.quantity||0))} left</span>
                </div>
                <div className="prod-name">{p.name}</div>
                <div className="prod-dims">{p.dimensions || p.category || "Timber product"}</div>
                <div className="prod-foot">
                  <span className="prod-price">${Number(p[level] || 0).toFixed(2)}</span>
                  <button className="prod-add" onClick={() => add(p)} title="Add to ticket">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>
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

function TablePage({ title, path }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api(path).then(setRows).catch(() => {});
  }, [path]);

  const cols = {
    "/api/products": [
      { k: "sku", l: "SKU" },
      { k: "barcode", l: "Barcode" },
      { k: "name", l: "Name" },
      { k: "category", l: "Category" },
      { k: "dimensions", l: "Dimensions" },
      { k: "cost", l: "Cost", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "retail", l: "Retail", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "contractor", l: "Contractor", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "bulk", l: "Bulk", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "quantity", l: "Stock", fmt: (v) => Number(v || 0).toFixed(0) },
    ],
    "/api/sales": [
      { k: "number", l: "Sale #" },
      { k: "site_id", l: "Site" },
      { k: "customer_id", l: "Customer" },
      { k: "currency", l: "Currency" },
      { k: "subtotal", l: "Subtotal", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "discount", l: "Discount", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "total", l: "Total", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "amount_paid", l: "Paid", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
    ],
    "/api/customers": [
      { k: "code", l: "Code" },
      { k: "name", l: "Name" },
      { k: "kind", l: "Kind" },
      { k: "phone", l: "Phone" },
      { k: "email", l: "Email" },
      { k: "credit_limit", l: "Credit Limit", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
      { k: "balance", l: "Balance", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
    ],
    "/api/suppliers": [
      { k: "code", l: "Code" },
      { k: "name", l: "Name" },
      { k: "phone", l: "Phone" },
      { k: "email", l: "Email" },
      { k: "balance", l: "Balance", fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
    ],
  };

  const schema = cols[path] || (rows[0]
    ? Object.keys(rows[0]).map((k) => ({ k, l: k }))
    : []);

  const shown = rows.filter((r) =>
    search
      ? Object.values(r)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      : true
  );

  return (
    <>
      <div className="top">
        <div>
          <h1>{title}</h1>
          <div>{rows.length} records</div>
        </div>
        <div className="actions">
          <input
            style={{ padding: 10, minWidth: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
          />
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              {schema.map((c) => (
                <th key={c.k}>{c.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id ?? i}>
                {schema.map((c) => (
                  <td key={c.k}>{c.fmt ? c.fmt(r[c.k]) : r[c.k] ?? ""}</td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={schema.length || 1} style={{ textAlign: "center", color: "#888", padding: 24 }}>
                  No records
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AccountsLayout() {
  return (
    <div>
      <div className="top">
        <h1>Accounts &amp; Financial Workspace</h1>
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
