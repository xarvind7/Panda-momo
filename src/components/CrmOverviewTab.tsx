import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  Flame,
  Package,
  Plus,
  QrCode,
  RotateCcw,
  Star,
  TrendingUp,
  Trophy,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import {
  agoMin,
  BRAND,
  computeHourlySales,
  computePaymentMix,
  computeTopDishes,
  fmt,
  isLowStock,
  orderTotal,
  shortId,
  tableStatus,
  type State,
} from '../data';
import { buildCustomerInsights, computeCrmSummary, formatRelativeVisit } from '../crm';
import { resolveCall, restockItem, setOrderStatus } from '../store';
import { DishThumb } from '../ui';
import { showSakugaToast } from '../sakuga';

interface CrmOverviewTabProps {
  state: State;
  now: number;
  onNavigateTab: (
    tab: 'overview' | 'orders' | 'customers' | 'promos' | 'menu' | 'tables' | 'stock' | 'qr' | 'settings'
  ) => void;
  onQuickAddMenu: () => void;
  onOpenCustomerProfile: (phone: string) => void;
  onQuickAddCustomer: () => void;
}

export default function CrmOverviewTab({
  state,
  now,
  onNavigateTab,
  onQuickAddMenu,
  onOpenCustomerProfile,
  onQuickAddCustomer,
}: CrmOverviewTabProps) {
  const sortedTables = useMemo(
    () => [...state.tables].sort((a, b) => a.num - b.num),
    [state.tables]
  );

  const liveOrders = useMemo(
    () =>
      state.orders
        .filter((o) => !o.paid)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.orders]
  );

  const todayPaidOrders = useMemo(
    () => state.orders.filter((o) => o.paid && (o.paidAt ?? 0) >= state.dayStart),
    [state.orders, state.dayStart]
  );

  const todayRevenue = useMemo(
    () => todayPaidOrders.reduce((sum, o) => sum + orderTotal(o, state.menu), 0),
    [todayPaidOrders, state.menu]
  );

  const avgOrderValue = useMemo(
    () => (todayPaidOrders.length > 0 ? Math.round(todayRevenue / todayPaidOrders.length) : 0),
    [todayRevenue, todayPaidOrders.length]
  );

  const occupiedTableCount = useMemo(
    () => sortedTables.filter((t) => tableStatus(state, t.num) !== 'free').length,
    [sortedTables, state]
  );

  const activeCalls = useMemo(
    () => state.calls.filter((c) => !c.done).sort((a, b) => a.at - b.at),
    [state.calls]
  );

  const lowStock = useMemo(
    () => state.stock.filter((s) => isLowStock(s)),
    [state.stock]
  );

  const avgRating = useMemo(() => {
    if (state.reviews.length === 0) return 0;
    return state.reviews.reduce((s, r) => s + r.stars, 0) / state.reviews.length;
  }, [state.reviews]);

  const recentReviews = useMemo(
    () => [...state.reviews].sort((a, b) => b.at - a.at).slice(0, 3),
    [state.reviews]
  );

  const hourlySales = useMemo(
    () => computeHourlySales(todayPaidOrders, state.dayStart, state.menu),
    [todayPaidOrders, state.dayStart, state.menu]
  );

  const maxHourlyAmount = useMemo(
    () => Math.max(1, ...hourlySales.map((h) => h.amount)),
    [hourlySales]
  );

  const topDishes = useMemo(
    () => computeTopDishes(state.orders, state.menu, 5),
    [state.orders, state.menu]
  );

  const maxDishQty = useMemo(
    () => Math.max(1, ...topDishes.map((d) => d.qty)),
    [topDishes]
  );

  const paymentMix = useMemo(
    () => computePaymentMix(todayPaidOrders, state.menu),
    [todayPaidOrders, state.menu]
  );

  const paymentTotal = useMemo(
    () => Math.max(1, paymentMix.reduce((s, p) => s + p.amount, 0)),
    [paymentMix]
  );

  const customerInsights = useMemo(
    () => buildCustomerInsights(state.customers || [], state.orders, state.menu, now),
    [state.customers, state.orders, state.menu, now]
  );

  const crmSummary = useMemo(() => computeCrmSummary(customerInsights), [customerInsights]);

  const topGuests = useMemo(
    () =>
      [...customerInsights]
        .sort((a, b) => b.totalSpent - a.totalSpent || b.customer.visits - a.customer.visits)
        .slice(0, 4),
    [customerInsights]
  );

  return (
    <div className="crm-stack">
      {/* Executive Header */}
      <section className="crm-hero">
        <div style={{ minWidth: 0 }}>
          <h1 className="crm-hero-title">{BRAND} CRM &amp; Operations</h1>
          <p className="dark-sub" style={{ marginTop: 4 }}>
            <span className="tabular-nums">{occupiedTableCount}/{sortedTables.length}</span> tables active
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{liveOrders.length}</span> live orders
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{crmSummary.totalCustomers}</span> CRM guests
          </p>
        </div>
        <div className="crm-quick-actions">
          <button type="button" className="btn btn-sm" onClick={onQuickAddCustomer}>
            <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
            <span>Naya Customer</span>
          </button>
          <button type="button" className="btn-ghost-dark" onClick={onQuickAddMenu}>
            <UtensilsCrossed size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Naya Dish</span>
          </button>
          <button type="button" className="btn-ghost-dark" onClick={() => onNavigateTab('qr')}>
            <QrCode size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Menu QR</span>
          </button>
        </div>
      </section>

      {/* Active Guest Help Calls Banner */}
      {activeCalls.length > 0 && (
        <section className="crm-alert-strip" aria-label="Pending guest calls">
          <div className="crm-alert-head">
            <strong className="dish-inline-label">
              <Bell size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Table Assistance Needed ({activeCalls.length})</span>
            </strong>
            <span className="dark-sub">Guest ne waiter ko bulaya hai</span>
          </div>
          <div className="crm-alert-list">
            {activeCalls.map((call) => (
              <div key={call.id} className="crm-alert-item">
                <div className="crm-alert-info">
                  <strong>Table {call.table}</strong>
                  <span aria-hidden="true">·</span>
                  <span>{call.kind}</span>
                  <span aria-hidden="true">·</span>
                  <span className="dark-sub tabular-nums">{agoMin(call.at, now)}m pehle</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-green"
                  onClick={() => {
                    resolveCall(call.id);
                    showSakugaToast(`Table ${call.table} (${call.kind}) resolved!`, 'green', 'DONE!');
                  }}
                >
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  <span>Resolve</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4-Column Executive KPI Row */}
      <section className="crm-kpi-grid" aria-label="Executive CRM metrics">
        <div className="kpi-card">
          <div className="kpi-head-row">
            <span className="kpi-label">Aaj ki Sale</span>
            <span className="crm-kpi-tag crm-tone-gold">Revenue</span>
          </div>
          <div className="kpi-val tabular-nums">{fmt(todayRevenue)}</div>
          <div className="kpi-sub tabular-nums">
            {todayPaidOrders.length} bills · Avg {fmt(avgOrderValue)}
          </div>
        </div>

        <button
          type="button"
          className="kpi-card kpi-card-btn"
          onClick={() => onNavigateTab('orders')}
        >
          <div className="kpi-head-row">
            <span className="kpi-label">Live Operations</span>
            <span className="crm-kpi-tag crm-tone-blue">Active</span>
          </div>
          <div className="kpi-val tabular-nums">{liveOrders.length}</div>
          <div className="kpi-sub tabular-nums">
            {occupiedTableCount}/{sortedTables.length} tables occupied
          </div>
        </button>

        <button
          type="button"
          className="kpi-card kpi-card-btn"
          onClick={() => onNavigateTab('customers')}
        >
          <div className="kpi-head-row">
            <span className="kpi-label">CRM Guest Base</span>
            <span className="crm-kpi-tag crm-tone-green">{crmSummary.repeatRatePct}% Repeat</span>
          </div>
          <div className="kpi-val tabular-nums">{crmSummary.totalCustomers}</div>
          <div className="kpi-sub tabular-nums">
            {crmSummary.vipCount} VIP · {crmSummary.dormantCount} follow-up
          </div>
        </button>

        <button
          type="button"
          className="kpi-card kpi-card-btn"
          onClick={() => onNavigateTab('stock')}
        >
          <div className="kpi-head-row">
            <span className="kpi-label">Stock &amp; Rating</span>
            <span className={`crm-kpi-tag ${lowStock.length > 0 ? 'crm-tone-red' : 'crm-tone-green'}`}>
              {lowStock.length > 0 ? `${lowStock.length} Low` : 'Healthy'}
            </span>
          </div>
          <div className="kpi-val tabular-nums dish-inline-label" style={{ gap: 6 }}>
            {state.reviews.length > 0 ? (
              <>
                <span>{avgRating.toFixed(1)}</span>
                <Star size={22} fill="currentColor" strokeWidth={2} aria-hidden="true" />
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="kpi-sub tabular-nums">
            {state.reviews.length} reviews · {state.menu.length} menu items
          </div>
        </button>
      </section>

      {/* Analytics Row: Hourly Revenue Trend + Top Dishes & Payment Mix */}
      <div className="crm-analytics-grid">
        <section className="d-card" aria-label="Hourly sales trend">
          <div className="crm-section-head">
            <div>
              <h2 className="icon-heading">
                <TrendingUp size={18} strokeWidth={2.2} style={{ color: 'var(--gold)' }} aria-hidden="true" />
                <span>Hourly Revenue Trend</span>
              </h2>
              <p className="dark-sub">Pichhle 10 ghanton ka paid bill flow</p>
            </div>
            <strong className="crm-gold-num tabular-nums">{fmt(todayRevenue)}</strong>
          </div>

          <div className="crm-bar-chart" role="img" aria-label="Hourly revenue bar chart">
            {hourlySales.map((bucket) => {
              const pct = bucket.amount > 0 ? Math.max(8, Math.round((bucket.amount / maxHourlyAmount) * 100)) : 3;
              const isPeak = bucket.amount === maxHourlyAmount && bucket.amount > 0;
              return (
                <div
                  key={bucket.hourIndex}
                  className="crm-bar-col"
                  title={`${bucket.hourIndex === 0 ? '10h ago' : bucket.label}: ${fmt(bucket.amount)}`}
                >
                  <span className="crm-bar-amt tabular-nums">
                    {bucket.amount > 0 ? `₹${Math.round(bucket.amount)}` : ''}
                  </span>
                  <div className="crm-bar-track">
                    <div
                      className={`crm-bar-fill ${isPeak ? 'peak' : ''}`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="crm-bar-lbl tabular-nums">
                    {bucket.hourIndex === 0 ? '10h' : bucket.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="d-card" aria-label="Bestsellers and payment breakdown">
          <div className="crm-section-head">
            <div>
              <h2 className="icon-heading">
                <Trophy size={18} strokeWidth={2.2} style={{ color: 'var(--gold)' }} aria-hidden="true" />
                <span>Top Selling Dishes</span>
              </h2>
              <p className="dark-sub">Sabse zyada order kiye gaye items</p>
            </div>
            <button type="button" className="btn-ghost-dark" onClick={() => onNavigateTab('menu')}>
              <span>Menu</span>
              <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          {topDishes.length === 0 ? (
            <p className="dark-sub">Orders aate hi top dishes yahan rank honge.</p>
          ) : (
            <div className="crm-rank-list">
              {topDishes.map((dish, idx) => (
                <div key={dish.id} className="crm-rank-row">
                  <div className="crm-rank-top">
                    <span className="crm-rank-name dish-inline-label">
                      <span className="dark-sub tabular-nums">0{idx + 1}.</span>
                      <DishThumb
                        img={dish.img}
                        emoji={dish.emoji}
                        alt={dish.name}
                        size={26}
                        className="top-dish-thumb"
                        decorative
                      />
                      <span>{dish.name}</span>
                    </span>
                    <strong className="tabular-nums">{dish.qty} sold</strong>
                  </div>
                  <div className="crm-rank-bar-bg">
                    <div
                      className="crm-rank-bar-fill"
                      style={{ width: `${Math.max(10, Math.round((dish.qty / maxDishQty) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {paymentMix.length > 0 && (
            <div className="crm-pay-mix">
              <div className="crm-sub-label">Payment Breakdown</div>
              <div className="crm-pay-grid">
                {paymentMix.slice(0, 4).map((pm) => {
                  const pct = Math.round((pm.amount / paymentTotal) * 100);
                  return (
                    <div key={pm.method} className="crm-pay-cell">
                      <span className="dark-sub">{pm.method}</span>
                      <strong className="tabular-nums">{fmt(pm.amount)}</strong>
                      <span className="crm-pay-pct tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Operations & Guest Retention Row */}
      <div className="two-col">
        {/* Live Orders Quick-Advance */}
        <section className="d-card" aria-label="Live orders queue">
          <div className="crm-section-head">
            <div>
              <h2 className="icon-heading">
                <Flame size={18} strokeWidth={2.2} style={{ color: 'var(--gold)' }} aria-hidden="true" />
                <span>Live Orders Queue</span>
              </h2>
              <p className="dark-sub">Direct status advance karo</p>
            </div>
            <button type="button" className="btn-ghost-dark" onClick={() => onNavigateTab('orders')}>
              <span>Sab Orders ({liveOrders.length})</span>
              <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          {liveOrders.length === 0 ? (
            <p className="dark-sub">
              Abhi koi active order nahi hai. Guest QR scan karke order karega to yahan turant dikhega.
            </p>
          ) : (
            <div className="crm-list-gap">
              {liveOrders.slice(0, 6).map((o) => (
                <div key={o.id} className="crm-order-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="crm-inline-meta">
                      <strong>
                        {o.channel === 'whatsapp'
                          ? `WhatsApp · ${o.customer || 'Delivery'}`
                          : `Table ${o.table}${o.customer ? ` · ${o.customer}` : ''}`}
                      </strong>
                      <span
                        className={`crm-status-text st-txt-${
                          o.status === 'new'
                            ? 'ordering'
                            : o.status === 'served'
                            ? 'eating'
                            : o.status
                        }`}
                      >
                        {o.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="dark-sub tabular-nums" style={{ marginTop: 3 }}>
                      #{shortId(o.id)} · {o.lines.length} {o.lines.length === 1 ? 'item' : 'items'} ·{' '}
                      <strong style={{ color: 'var(--gold)' }}>
                        {fmt(orderTotal(o, state.menu))}
                      </strong>{' '}
                      · {agoMin(o.createdAt, now)}m pehle
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {o.status === 'new' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setOrderStatus(o.id, 'cooking')}
                      >
                        <span>Start</span>
                        <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                    )}
                    {o.status === 'cooking' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-green"
                        onClick={() => setOrderStatus(o.id, 'ready')}
                      >
                        <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                        <span>Ready</span>
                      </button>
                    )}
                    {o.status === 'ready' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-green"
                        onClick={() => setOrderStatus(o.id, 'served', 'Admin')}
                      >
                        <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                        <span>Served</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Top VIP Customers + Stock & Reviews */}
        <div className="crm-stack">
          <section className="d-card" aria-label="Top VIP customers">
            <div className="crm-section-head">
              <div>
                <h2 className="icon-heading">
                  <Users size={18} strokeWidth={2.2} style={{ color: 'var(--gold)' }} aria-hidden="true" />
                  <span>Top Customers</span>
                </h2>
                <p className="dark-sub">Lifetime value &amp; repeat visits</p>
              </div>
              <button type="button" className="btn-ghost-dark" onClick={() => onNavigateTab('customers')}>
                <span>CRM Directory</span>
                <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>

            {topGuests.length === 0 ? (
              <p className="dark-sub">Abhi koi customer saved nahi hai.</p>
            ) : (
              <div className="crm-list-gap">
                {topGuests.map((item) => (
                  <button
                    key={item.customer.phone}
                    type="button"
                    className="crm-vip-row"
                    onClick={() => onOpenCustomerProfile(item.customer.phone)}
                  >
                    <div className="crm-avatar-sm">{item.customer.name.charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <div className="crm-vip-name">
                        <span>{item.customer.name}</span>
                        <span className={`crm-tier-txt tier-${item.tier}`}>{item.tierLabel}</span>
                      </div>
                      <div className="dark-sub tabular-nums">
                        {item.customer.visits} visits · {item.loyaltyPoints} pts ·{' '}
                        {formatRelativeVisit(item.customer.lastVisitAt, now)}
                      </div>
                    </div>
                    <div className="crm-vip-spend tabular-nums">
                      <strong>{fmt(item.totalSpent)}</strong>
                      <span className="dark-sub dish-inline-label" style={{ gap: 4 }}>
                        <span>Profile</span>
                        <ArrowRight size={11} strokeWidth={2.2} aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="d-card" aria-label="Low stock and guest feedback">
            <div className="crm-section-head">
              <h2 className="icon-heading">
                <Package size={18} strokeWidth={2.2} style={{ color: 'var(--gold)' }} aria-hidden="true" />
                <span>Inventory &amp; Reviews</span>
              </h2>
              <button type="button" className="btn-ghost-dark" onClick={() => onNavigateTab('stock')}>
                <span>Stock</span>
                <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>

            {lowStock.length === 0 ? (
              <p className="crm-ok-line dish-inline-label">
                <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                <span>All inventory levels are healthy.</span>
              </p>
            ) : (
              <div className="crm-list-gap" style={{ marginBottom: 14 }}>
                {lowStock.map((st) => (
                  <div key={st.name} className="crm-stock-warn">
                    <div>
                      <strong className="dish-inline-label">
                        <AlertTriangle size={14} strokeWidth={2.2} style={{ color: '#FF8A75' }} aria-hidden="true" />
                        <span>{st.name} low</span>
                      </strong>
                      <div className="dark-sub tabular-nums">
                        {st.qty} / {st.max} {st.unit}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        restockItem(st.name);
                        showSakugaToast(`${st.name} full restock ho gaya!`, 'green', 'FULL!');
                      }}
                    >
                      <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
                      <span>Restock</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="crm-divider" />

            <div className="crm-sub-label" style={{ marginBottom: 8 }}>
              Recent Guest Feedback ({state.reviews.length})
            </div>
            {recentReviews.length === 0 ? (
              <p className="dark-sub">Abhi koi guest review nahi aaya.</p>
            ) : (
              <div className="crm-list-gap">
                {recentReviews.map((r, idx) => (
                  <div key={`${r.table}-${r.at}-${idx}`} className="crm-review-item">
                    <div className="crm-inline-between">
                      <strong>Table {r.table}</strong>
                      <span
                        className="tabular-nums dish-inline-label"
                        style={{ color: 'var(--gold)', gap: 2 }}
                        aria-label={`${r.stars} out of 5 stars`}
                      >
                        {Array.from({ length: r.stars }).map((_, sIdx) => (
                          <Star
                            key={sIdx}
                            size={13}
                            fill="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                    </div>
                    <p className="dark-sub" style={{ marginTop: 3 }}>
                      {r.text || 'Bina comment ke rating di.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
