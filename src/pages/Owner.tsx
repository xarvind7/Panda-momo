import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  BarChart3,
  MessageCircle,
  Package,
  RotateCcw,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  computeHourlySales,
  computePaymentMix,
  computeStaffSpeed,
  computeTopDishes,
  fmt,
  isLowStock,
  orderTotal,
} from '../data';
import { restockItem, useStore } from '../store';
import { showSakugaToast } from '../sakuga';
import { CountUp, DishThumb, SakugaProgress } from '../ui';
import Nav from './Nav';

export default function Owner() {
  const state = useStore();

  const paidToday = useMemo(
    () => state.orders.filter((o) => o.paid && (o.paidAt ?? 0) >= state.dayStart),
    [state.orders, state.dayStart]
  );

  const openOrders = useMemo(
    () => state.orders.filter((o) => !o.paid),
    [state.orders]
  );

  // Revenue excludes tips per PRD rule 9
  const todayRevenue = useMemo(
    () => paidToday.reduce((sum, o) => sum + orderTotal(o, state.menu), 0),
    [paidToday, state.menu]
  );

  const openBill = useMemo(
    () => openOrders.reduce((sum, o) => sum + orderTotal(o, state.menu), 0),
    [openOrders, state.menu]
  );

  const totalOrdersCount = state.orders.length;
  const avgTicket = paidToday.length > 0 ? Math.round(todayRevenue / paidToday.length) : 0;

  const avgRating = useMemo(() => {
    if (state.reviews.length === 0) return 0;
    const sum = state.reviews.reduce((acc, r) => acc + r.stars, 0);
    return Math.round((sum / state.reviews.length) * 10) / 10;
  }, [state.reviews]);

  const hourly = useMemo(
    () => computeHourlySales(paidToday, state.dayStart, state.menu),
    [paidToday, state.dayStart, state.menu]
  );
  const maxHour = Math.max(1, ...hourly.map((h) => h.amount));

  const topDishes = useMemo(
    () => computeTopDishes(state.orders, state.menu, 5),
    [state.orders, state.menu]
  );
  const maxDishQty = Math.max(1, ...topDishes.map((d) => d.qty));

  const staffSpeed = useMemo(() => computeStaffSpeed(state.orders), [state.orders]);
  const paymentMix = useMemo(
    () => computePaymentMix(paidToday, state.menu),
    [paidToday, state.menu]
  );
  const maxPayment = Math.max(1, ...paymentMix.map((p) => p.amount));
  const whatsappCount = useMemo(
    () => state.orders.filter((o) => o.channel === 'whatsapp').length,
    [state.orders]
  );

  const lowStockItems = useMemo(
    () => state.stock.filter((s) => isLowStock(s)),
    [state.stock]
  );

  const recentReviews = useMemo(
    () => [...state.reviews].sort((a, b) => b.at - a.at).slice(0, 5),
    [state.reviews]
  );

  return (
    <div className="dark-page">
      <Nav active="owner" />
      <main className="dark-wrap">
        <div className="dark-head">
          <div>
            <h1 className="icon-heading">
              <BarChart3 size={24} strokeWidth={2.3} aria-hidden="true" />
              <span>Reports</span>
            </h1>
            <p className="dark-sub">Aaj ka live business summary (tips ke bina)</p>
          </div>
        </div>

        {/* 5 KPI Cards */}
        <section className="kpi-grid" aria-label="Key metrics">
          <div className="kpi-card">
            <div className="kpi-label">Aaj ki sale</div>
            <div className="kpi-val">
              <CountUp value={todayRevenue} prefix="₹" />
            </div>
            <div className="kpi-sub">{paidToday.length} paid orders</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Open tables ka bill</div>
            <div className="kpi-val">
              <CountUp value={openBill} prefix="₹" />
            </div>
            <div className="kpi-sub">{openOrders.length} active orders</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Orders</div>
            <div className="kpi-val">
              <CountUp value={totalOrdersCount} />
            </div>
            <div className="kpi-sub">All orders</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Avg ticket</div>
            <div className="kpi-val">
              <CountUp value={avgTicket} prefix="₹" />
            </div>
            <div className="kpi-sub">Per paid order</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Rating</div>
            <div className="kpi-val">
              <CountUp value={avgRating} decimals={1} suffix=" ★" />
            </div>
            <div className="kpi-sub">{state.reviews.length} reviews</div>
          </div>
        </section>

        <div className="owner-grid">
          {/* Hourly Sales */}
          <section className="d-card">
            <h2 style={{ fontSize: 20 }}>Hourly sales</h2>
            <p className="dark-sub">Last 10 ghante (1h buckets)</p>
            <div className="hourly-chart" aria-label="Hourly sales chart">
              {hourly.map((h, i) => {
                const heightPct = Math.max(4, Math.round((h.amount / maxHour) * 100));
                return (
                  <div key={h.hourIndex} className="hourly-col" title={`${h.label}: ${fmt(h.amount)}`}>
                    <div className="hourly-bar-wrap">
                      <motion.div
                        className="hourly-bar"
                        style={{ height: `${heightPct}%` }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.55, delay: i * 0.05, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="hourly-lbl">
                      {i === 0 ? '10h' : i === 9 ? 'abhi' : `${10 - i}h`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--d-mute)',
                marginTop: 6,
              }}
            >
              <span>10 ghante pehle</span>
              <span>abhi</span>
            </div>
          </section>

          {/* Top Dishes */}
          <section className="d-card">
            <h2 className="icon-heading" style={{ fontSize: 20 }}>
              <Trophy size={19} strokeWidth={2.2} color="var(--gold)" aria-hidden="true" />
              <span>Top dishes</span>
            </h2>
            <p className="dark-sub">Sabse zyada order hone wali 5 dishes</p>
            {topDishes.length === 0 ? (
              <p className="dark-sub" style={{ marginTop: 14 }}>
                Abhi koi order data nahi.
              </p>
            ) : (
              topDishes.map((d, i) => (
                <div key={d.id} className="bar-row">
                  <div className="bar-row-head">
                    <span className="dish-inline-label">
                      <DishThumb
                        img={d.img}
                        emoji={d.emoji}
                        alt={d.name}
                        className="top-dish-thumb"
                        size={28}
                        decorative
                      />
                      <span>{d.name}</span>
                    </span>
                    <span style={{ color: 'var(--gold)' }}>{d.qty} qty</span>
                  </div>
                  <div className="bar-track">
                    <motion.div
                      className="bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((d.qty / maxDishQty) * 100)}%` }}
                      transition={{ duration: 0.65, delay: i * 0.06, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Fastest Staff + Payment Mix + WhatsApp count */}
          <section className="d-card">
            <h2 className="icon-heading" style={{ fontSize: 20 }}>
              <Zap size={19} strokeWidth={2.2} color="var(--gold)" aria-hidden="true" />
              <span>Sabse tez staff</span>
            </h2>
            <p className="dark-sub">Avg time: ready se serve tak</p>
            {staffSpeed.length === 0 ? (
              <p className="dark-sub" style={{ marginTop: 10 }}>
                Abhi served orders ka data nahi.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {staffSpeed.map((sp, i) => (
                  <div
                    key={sp.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#141442',
                      padding: '10px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <strong className="dish-inline-label">
                      {i === 0 && <Award size={16} strokeWidth={2.3} color="var(--gold)" aria-hidden="true" />}
                      <span>{sp.name}</span>
                    </strong>
                    <span style={{ color: i === 0 ? '#5BE39A' : 'var(--d-mute)', fontWeight: 700 }}>
                      {sp.avgMin} min avg ({sp.count} orders)
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--d-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 17 }}>Payment mix</h3>
                <span className="st-tag st-ordering">
                  <MessageCircle size={12} strokeWidth={2.3} aria-hidden="true" /> WhatsApp: {whatsappCount}
                </span>
              </div>
              {paymentMix.length === 0 ? (
                <p className="dark-sub" style={{ marginTop: 8 }}>
                  Abhi paid orders nahi.
                </p>
              ) : (
                paymentMix.map((p) => (
                  <div key={p.method} className="bar-row">
                    <div className="bar-row-head">
                      <span>{p.method}</span>
                      <span>{fmt(p.amount)}</span>
                    </div>
                    <div className="bar-track">
                      <motion.div
                        className="bar-fill green"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((p.amount / maxPayment) * 100)}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Stock */}
          <section className="d-card">
            <h2 className="icon-heading" style={{ fontSize: 20 }}>
              <Package size={19} strokeWidth={2.2} color="var(--gold)" aria-hidden="true" />
              <span>Stock</span>
            </h2>
            {lowStockItems.length > 0 && (
              <p
                className="dish-inline-label"
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(226, 73, 47, 0.16)',
                  color: '#FF8A75',
                  fontSize: 13.5,
                  fontWeight: 700,
                }}
              >
                <AlertTriangle size={15} strokeWidth={2.3} aria-hidden="true" />
                <span>Khatam hone se pehle alert: {lowStockItems.map((s) => s.name).join(', ')} kam hai.</span>
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {state.stock.map((st) => {
                const low = isLowStock(st);
                const pct = st.max > 0 ? Math.min(100, Math.round((st.qty / st.max) * 100)) : 0;
                return (
                  <div key={st.name}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span className="dish-inline-label" style={{ fontWeight: 700, fontSize: 14 }}>
                        {low && <AlertTriangle size={14} strokeWidth={2.3} color="#FF8A75" aria-hidden="true" />}
                        <span>{st.name}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="dark-sub">
                          {st.qty} / {st.max} {st.unit}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            restockItem(st.name);
                            showSakugaToast(`${st.name} full restock ho gaya!`, 'green', 'FULL!');
                          }}
                        >
                          <RotateCcw size={13} strokeWidth={2.3} aria-hidden="true" />
                          <span>Restock</span>
                        </button>
                      </div>
                    </div>
                    <SakugaProgress
                      pct={pct}
                      tone={low ? 'red' : 'gold'}
                      label={`${st.name} stock level`}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent Reviews */}
          <section className="d-card" style={{ gridColumn: '1 / -1' }}>
            <h2 className="icon-heading" style={{ fontSize: 20, marginBottom: 10 }}>
              <Star size={19} strokeWidth={2.2} color="var(--gold)" fill="var(--gold)" aria-hidden="true" />
              <span>Recent reviews</span>
            </h2>
            {recentReviews.length === 0 ? (
              <p className="dark-sub">Abhi koi review nahi aaya.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: 12,
                }}
              >
                {recentReviews.map((r, i) => (
                  <div
                    key={`${r.table}-${r.at}-${i}`}
                    style={{
                      background: '#141442',
                      border: '1px solid var(--d-border)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span
                        style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                        aria-label={`${r.stars} stars`}
                      >
                        {Array.from({ length: r.stars }).map((_, sIdx) => (
                          <Star
                            key={sIdx}
                            size={14}
                            strokeWidth={2}
                            fill="currentColor"
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                      <span className="dark-sub">Table {r.table}</span>
                    </div>
                    <p style={{ fontSize: 14 }}>{r.text || 'Bina comment ke rating di.'}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
