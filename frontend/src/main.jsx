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
  const [products, setProducts] = useState([]);
  const [sites, setSites] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [site, setSite] = useState("");
  const [cust, setCust] = useState("");
  const [level, setLevel] = useState("retail");
  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("cash");
  const [last, setLast] = useState(null);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState("");

  const load = () =>
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

  const shown = products.filter((x) => {
    const hay = (x.name + " " + x.sku + " " + x.barcode + " " + (x.dimensions || "")).toLowerCase();
    return (
      hay.includes(search.toLowerCase()) &&
      (category === "All" || x.category === category)
    );
  });

  const subtotal = cart.reduce((a, x) => a + x.quantity * x.unit_price, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const totalConverted = total * rate;
  const paidNum = Number(paid) || 0;
  const change = paidNum - totalConverted;

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(""), 2000);
  }

  function add(p) {
    setCart((c) => {
      const existing = c.find((x) => x.product_id === p.id);
      showToast(`+1 ${p.name}`);
      return existing
        ? c.map((x) =>
            x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x
          )
        : [
            ...c,
            {
              product_id: p.id,
              name: p.name,
              sku: p.sku,
              quantity: 1,
              unit_price: Number(p[level] || 0),
            },
          ];
    });
  }

  function setQty(pid, qty) {
    const n = Math.max(0, Number(qty) || 0);
    setCart((c) =>
      n <= 0
        ? c.filter((x) => x.product_id !== pid)
        : c.map((x) => (x.product_id === pid ? { ...x, quantity: n } : x))
    );
  }

  function removeLine(pid) {
    setCart((c) => c.filter((x) => x.product_id !== pid));
  }

  function clearAll() {
    if (cart.length && window.confirm("Clear the current ticket?")) {
      setCart([]);
      setPaid("");
    }
  }

  async function complete() {
    if (!cart.length) return;
    const payload = {
      number: "SALE-" + Date.now(),
      site_id: Number(site),
      customer_id: cust ? Number(cust) : null,
      currency,
      exchange_rate: Number(rate),
      price_level: level,
      lines: cart,
      discount: 0,
      payment_method: method,
      amount_paid: paidNum,
    };
    try {
      const s = navigator.onLine
        ? await api("/api/sales", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        : null;

      if (!navigator.onLine) {
        const q = JSON.parse(localStorage.getItem("offlineSales") || "[]");
        q.push(payload);
        localStorage.setItem("offlineSales", JSON.stringify(q));
        setMsg("Sale queued offline");
      } else {
        setLast(s);
        setMsg("Sale completed — receipt ready");
      }
      setCart([]);
      setPaid("");
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function sync() {
    const q = JSON.parse(localStorage.getItem("offlineSales") || "[]");
    for (const s of q) {
      await api("/api/sales", { method: "POST", body: JSON.stringify(s) });
    }
    localStorage.removeItem("offlineSales");
    showToast(`${q.length} offline sale(s) synced`);
    setMsg("");
    load();
  }

  const go = (path) => { location.href = path; };
  const offlineCount = JSON.parse(localStorage.getItem("offlineSales") || "[]").length;

  return (
    <div className="tp-shell">
      {/* ========== TOP NAV (replaces sidebar on this page) ========== */}
      <header className="tp-header">
        <div className="tp-header-inner">
          <div className="tp-brand">
            <div className="tp-logo">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V9l7-6 7 6v12" />
                <path d="M9 21v-6h6v6" />
              </svg>
            </div>
            <div>
              <div className="tp-brand-name">TIMBER<b>POINT</b></div>
              <div className="tp-brand-sub">Smart Point of Sale</div>
            </div>
          </div>

          <nav className="tp-modules" aria-label="Modules">
            <button className="tp-mod on" title="Point of Sale">🧾 POS</button>
            <button className="tp-mod" onClick={() => go("/dashboard")} title="Dashboard">📊 Dashboard</button>
            <button className="tp-mod" onClick={() => go("/stock")} title="Stock">📦 Stock</button>
            <button className="tp-mod" onClick={() => go("/sales")} title="Sales">💸 Sales</button>
            <button className="tp-mod" onClick={() => go("/accounts/overview")} title="Accounts">💼 Accounts</button>
            <button className="tp-mod" onClick={() => go("/customers")} title="Debtors">👥 Debtors</button>
            <button className="tp-mod" onClick={() => go("/suppliers")} title="Creditors">🏭 Creditors</button>
          </nav>

          <div className="tp-actions">
            {toast && <div className="tp-toast">{toast}</div>}
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="tp-select">
              <option value="retail">Retail Price</option>
              <option value="contractor">Contractor Price</option>
              <option value="bulk">Bulk Price</option>
            </select>
            <select value={site} onChange={(e) => setSite(e.target.value)} className="tp-select">
              {sites.map((x) => (
                <option key={x.id} value={x.id}>
                  📍 {x.name}
                </option>
              ))}
            </select>
            <button className="tp-chip tp-chip-sync" onClick={sync} title="Sync offline sales">
              🔄 Sync
              {offlineCount > 0 && <span className="tp-badge">{offlineCount}</span>}
            </button>
            <span className={"tp-pill tp-net " + (navigator.onLine ? "on" : "off")}>
              <span className="tp-dot" /> {navigator.onLine ? "Online" : "Offline"}
            </span>
            <button className="tp-logout" onClick={() => { localStorage.clear(); location.href = "/login"; }}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="tp-stage">
        {/* ============= LEFT: TICKET / CART ============= */}
        <aside className="tp-ticket">
          <div className="tp-ticket-head">
            <div className="tp-ticket-title">
              <div className="tp-ticket-icon">🧾</div>
              <div>
                <h2>Current Ticket</h2>
                <p>{cart.length} {cart.length === 1 ? "item" : "items"} in basket</p>
              </div>
              {cart.length > 0 && (
                <span className="tp-count-pill">{cart.length}</span>
              )}
            </div>
            <div className="tp-ticket-actions">
              <button className="tp-tbtn hold" onClick={() => showToast("Ticket held")} disabled={!cart.length}>Hold</button>
              <button className="tp-tbtn clear" onClick={clearAll} disabled={!cart.length}>Clear All</button>
            </div>
          </div>

          <div className="tp-cart-head">
            <span className="col-item">Product</span>
            <span className="col-qty">Qty</span>
            <span className="col-tot">Total</span>
            <span className="col-act" />
          </div>

          <div className="tp-cart-lines">
            {cart.length === 0 && (
              <div className="tp-empty">
                <div className="tp-empty-art">
                  <svg viewBox="0 0 120 120" width="100" height="100" fill="none">
                    <defs>
                      <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f1bc38" stopOpacity=".55" />
                        <stop offset="100%" stopColor="#1f7042" stopOpacity=".35" />
                      </linearGradient>
                    </defs>
                    <circle cx="60" cy="60" r="52" fill="url(#g1)" />
                    <path d="M40 52h44l-6 36H46z" stroke="#fff" strokeWidth="3" strokeLinejoin="round" opacity=".85" />
                    <circle cx="49" cy="96" r="5" fill="#fff" opacity=".85" />
                    <circle cx="83" cy="96" r="5" fill="#fff" opacity=".85" />
                  </svg>
                </div>
                <h3>Your basket is empty</h3>
                <p>Scan a barcode or tap any timber product below to add it to the ticket.</p>
              </div>
            )}

            {cart.map((x) => {
              const line = x.quantity * x.unit_price;
              return (
                <div className="tp-line" key={x.product_id}>
                  <div className="tp-line-ico">🪵</div>
                  <div className="tp-line-info">
                    <div className="tp-line-name">{x.name}</div>
                    <div className="tp-line-meta">
                      {x.sku} · ${Number(x.unit_price).toFixed(2)} each
                    </div>
                  </div>
                  <div className="tp-qty">
                    <button className="tp-qb" onClick={() => setQty(x.product_id, x.quantity - 1)}>−</button>
                    <input
                      type="number"
                      min="0"
                      value={x.quantity}
                      onChange={(e) => setQty(x.product_id, e.target.value)}
                    />
                    <button className="tp-qb plus" onClick={() => setQty(x.product_id, x.quantity + 1)}>+</button>
                  </div>
                  <div className="tp-line-total">${line.toFixed(2)}</div>
                  <button className="tp-line-del" title="Remove line" onClick={() => removeLine(x.product_id)}>✕</button>
                </div>
              );
            })}
          </div>

          <div className="tp-totals">
            <div className="tp-tot-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="tp-tot-row muted"><span>VAT / Tax (est. 8%)</span><span>${tax.toFixed(2)}</span></div>
            {currency !== "USD" && Number(rate) !== 1 && (
              <div className="tp-tot-row muted"><span>Rate (× {rate})</span><span>{currency}</span></div>
            )}
            <div className="tp-tot-row grand">
              <span>Total due</span>
              <span className="tp-grand">{currency} {totalConverted.toFixed(2)}</span>
            </div>
            <div className="tp-tot-row">
              <span>Change</span>
              <span className={change < 0 ? "neg" : "pos"}>
                {currency} {Math.max(0, change).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="tp-pay-title">Payment method</div>
          <div className="tp-pay-methods">
            {[
              { k: "cash", label: "Cash", icon: "💵" },
              { k: "card", label: "Card", icon: "💳" },
              { k: "mobile_money", label: "Mobile", icon: "📱" },
              { k: "credit", label: "Credit", icon: "📒" },
            ].map((m) => (
              <button
                key={m.k}
                className={"tp-pay-btn " + (method === m.k ? "on" : "")}
                onClick={() => setMethod(m.k)}
              >
                <span className="tp-pay-ico">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          <div className="tp-quick">
            <button className="tp-qc exact" onClick={() => setPaid(String(totalConverted.toFixed(2)))}>Exact Cash</button>
            <button className="tp-qc" onClick={() => setPaid("5")}>$5</button>
            <button className="tp-qc" onClick={() => setPaid("10")}>$10</button>
            <button className="tp-qc" onClick={() => setPaid("20")}>$20</button>
            <button className="tp-qc" onClick={() => setPaid("50")}>$50</button>
            <button className="tp-qc" onClick={() => setPaid("100")}>$100</button>
          </div>

          <div className="tp-field">
            <label>Amount tendered ({currency})</label>
            <div className="tp-input-wrap">
              <span className="tp-input-prefix">{currency === "USD" ? "$" : ""}</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
          </div>

          <div className="tp-field tp-field-half">
            <div>
              <label>Customer <span className="opt">(optional)</span></label>
              <select value={cust} onChange={(e) => setCust(e.target.value)}>
                <option value="">— Walk-in customer —</option>
                {customers.map((x) => (
                  <option key={x.id} value={x.id}>{x.name} · {x.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Currency &amp; rate</label>
              <div className="tp-cur">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option>USD</option>
                  <option>ZiG</option>
                  <option>ZAR</option>
                  <option>BWP</option>
                </select>
                <input
                  type="number"
                  step="0.0001"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  title="Exchange rate"
                />
              </div>
            </div>
          </div>

          <button
            className="tp-complete"
            onClick={complete}
            disabled={!cart.length}
          >
            <span className="tp-complete-ico">🖨️</span>
            <div>
              <div className="tp-complete-title">Complete Sale &amp; Print Receipt</div>
              <div className="tp-complete-sub">
                Tender: {currency} {(paidNum || 0).toFixed(2)} · Due: {currency} {totalConverted.toFixed(2)}
              </div>
            </div>
          </button>

          {msg && <div className="tp-msg">{msg}</div>}

          {last && (
            <div className="tp-receipt">
              <hr />
              <h3>🧾 TIMBERPOINT RECEIPT</h3>
              <div className="tp-rec-no">{last.number}</div>
              {last.lines && last.lines.map((x, i) => (
                <div key={i} className="tp-rec-line">
                  <span>{x.name} × {x.quantity}</span>
                  <span>${Number(x.total || 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="tp-rec-total">
                <span>Total</span>
                <span>{last.currency || "USD"} ${Number(last.total || 0).toFixed(2)}</span>
              </div>
              <p className="tp-rec-motto">Reliable timber · Lasting strength</p>
              <button className="tp-btn-print" onClick={() => window.print()}>🖨️ Print receipt</button>
            </div>
          )}
        </aside>

        {/* ============= RIGHT: PRODUCTS ============= */}
        <section className="tp-shop">
          <div className="tp-hero">
            <div className="tp-hero-text">
              <div className="tp-hero-badge">🌲 Timber Shop</div>
              <h1>Build with the best timber in town</h1>
              <p>
                Punch in a barcode, SKU or product name — or tap a category chip
                to browse roofing, structural timber, hardware and more.
              </p>
            </div>
            <div className="tp-hero-stats">
              <div className="tp-stat">
                <div className="tp-stat-num">{products.length}</div>
                <div className="tp-stat-lab">Products</div>
              </div>
              <div className="tp-stat">
                <div className="tp-stat-num">{categories.length - 1}</div>
                <div className="tp-stat-lab">Categories</div>
              </div>
              <div className="tp-stat">
                <div className="tp-stat-num">{sites.length}</div>
                <div className="tp-stat-lab">Sites</div>
              </div>
            </div>
          </div>

          <div className="tp-searchbar">
            <div className="tp-search">
              <span className="tp-s-ico">🔍</span>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Punch SKU / Barcode / Item name (e.g. 3838, NAIL, 0380383M)…"
              />
              {search && (
                <button className="tp-s-clear" onClick={() => setSearch("")} title="Clear search">✕</button>
              )}
            </div>
            <button className="tp-punch" onClick={() => {
              const hit = shown[0];
              if (hit) add(hit);
              else showToast("No matching product");
            }}>
              Punch ↵
            </button>
          </div>

          <div className="tp-cats">
            {categories.map((c) => {
              const count = c === "All" ? products.length : products.filter(p => p.category === c).length;
              return (
                <button
                  key={c}
                  className={"tp-cat " + (category === c ? "on" : "")}
                  onClick={() => setCategory(c)}
                >
                  {c} <span className="tp-cat-n">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="tp-grid">
            {shown.length === 0 && (
              <div className="tp-grid-empty">
                <div className="tp-grid-empty-ico">🔍</div>
                <h3>No products found</h3>
                <p>Try a different search term or category.</p>
              </div>
            )}
            {shown.map((p) => {
              const stockNum = Number(p.quantity || 0);
              const low = stockNum <= Number(p.reorder || 5);
              const price = Number(p[level] || 0);
              return (
                <button
                  key={p.id}
                  className="tp-prod"
                  onClick={() => add(p)}
                  type="button"
                >
                  <div className="tp-prod-top">
                    <span className="tp-prod-sku">{p.sku}</span>
                    <span className={"tp-prod-stk " + (low ? "low" : "")}>
                      {low ? "⚠ " : ""}{Math.round(stockNum)} left
                    </span>
                  </div>
                  <div className="tp-prod-cat">{p.category || "Timber"}</div>
                  <div className="tp-prod-name">{p.name}</div>
                  <div className="tp-prod-dim">{p.dimensions || "Premium grade timber"}</div>
                  <div className="tp-prod-bot">
                    <div className="tp-prod-price">
                      <span className="tp-price-sym">$</span>
                      <span className="tp-price-num">{price.toFixed(2)}</span>
                    </div>
                    <div className="tp-prod-add" title="Add to ticket">
                      <span>+</span>
                    </div>
                  </div>
                </button>
              );
            })}
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

      {/* POS = FULL-SCREEN, no sidebar. The POS panel has its own top bar + mini nav */}
      <Route
        path="/"
        element={
          <G>
            <POS />
          </G>
        }
      />

      {/* All other pages share the sidebar + main Layout */}
      <Route
        element={
          <G>
            <Layout />
          </G>
        }
      >
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
