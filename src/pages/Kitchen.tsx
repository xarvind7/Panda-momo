import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, Check, Flame } from 'lucide-react';
import {
  byId,
  fmtMMSS,
  kitchenCardTiming,
  SECTIONS,
  shortId,
  type Section,
  type Status,
} from '../data';
import {
  isChimeEnabled,
  setChimeEnabled,
  setOrderStatus,
  useNow,
  useOrderChime,
  useStore,
} from '../store';
import { showSakugaToast } from '../sakuga';
import { DishThumb, SakugaProgress, SPRING } from '../ui';
import Nav from './Nav';

type Filter = 'All' | Section;
type StatusTab = 'all' | Extract<Status, 'new' | 'cooking' | 'ready'>;

export default function Kitchen() {
  const state = useStore();
  const now = useNow(1000);
  useOrderChime();

  const [station, setStation] = useState<Filter>('All');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [chimeOn, setChimeOn] = useState<boolean>(() => isChimeEnabled());

  const activeOrders = useMemo(() => {
    return state.orders
      .filter((o) => !o.paid && o.status !== 'served')
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [state.orders]);

  const statusCounts = useMemo(() => {
    const counts = { all: activeOrders.length, new: 0, cooking: 0, ready: 0 };
    for (const o of activeOrders) {
      if (o.status === 'new') counts.new += 1;
      else if (o.status === 'cooking') counts.cooking += 1;
      else if (o.status === 'ready') counts.ready += 1;
    }
    return counts;
  }, [activeOrders]);

  const visibleCards = useMemo(() => {
    return activeOrders
      .filter((order) => statusTab === 'all' || order.status === statusTab)
      .map((order) => {
        const lines =
          station === 'All'
            ? order.lines
            : order.lines.filter((l) => byId(l.itemId, state.menu).section === station);
        return { order, lines };
      })
      .filter((entry) => entry.lines.length > 0);
  }, [activeOrders, station, statusTab, state.menu]);

  function handleToggleChime() {
    const next = !chimeOn;
    setChimeOn(next);
    setChimeEnabled(next);
    showSakugaToast(
      next ? 'Kitchen chime ON ho gayi!' : 'Kitchen chime mute ho gayi.',
      next ? 'green' : 'gold',
      next ? 'DING!' : 'MUTE'
    );
  }

  return (
    <div className="dark-page">
      <Nav active="kitchen" />
      <main className="dark-wrap">
        <div className="dark-head">
          <div>
            <h1 className="icon-heading">
              <Flame size={24} strokeWidth={2.3} color="var(--gold)" aria-hidden="true" />
              <span>Kitchen display</span>
            </h1>
            <p className="dark-sub tabular-nums">
              {visibleCards.length} active orders · naya order aane par chime bajti hai
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`staff-alert-toggle ${chimeOn ? 'is-on' : ''}`}
              aria-pressed={chimeOn}
              onClick={handleToggleChime}
            >
              {chimeOn ? (
                <Bell size={15} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <BellOff size={15} strokeWidth={2.2} aria-hidden="true" />
              )}
              <span>{chimeOn ? 'Chime: On' : 'Chime: Off'}</span>
            </button>
          </div>
        </div>

        {/* Station + Order Status Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div className="chip-row" role="group" aria-label="Station filter">
            {(['All', ...SECTIONS] as Filter[]).map((st) => (
              <button
                key={st}
                type="button"
                className={`chip-dark ${station === st ? 'on' : ''}`}
                onClick={() => setStation(st)}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="crm-seg-group" role="tablist" aria-label="Order stage filter">
            {(
              [
                { id: 'all', label: 'All', count: statusCounts.all },
                { id: 'new', label: 'New', count: statusCounts.new },
                { id: 'cooking', label: 'Cooking', count: statusCounts.cooking },
                { id: 'ready', label: 'Ready', count: statusCounts.ready },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={statusTab === item.id}
                className={`crm-seg-btn ${statusTab === item.id ? 'on' : ''}`}
                onClick={() => setStatusTab(item.id)}
              >
                <span>{item.label}</span>
                <span className="crm-seg-cnt tabular-nums">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {visibleCards.length === 0 ? (
          <div className="d-card" style={{ textAlign: 'center', padding: '44px 20px' }}>
            <p style={{ fontSize: 16, color: 'var(--d-mute)' }}>
              {activeOrders.length === 0
                ? 'Koi active order nahi. Guest ke order ka intezaar…'
                : 'Is filter mein abhi koi order nahi hai.'}
            </p>
            {(station !== 'All' || statusTab !== 'all') && (
              <button
                type="button"
                className="btn-ghost-dark"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setStation('All');
                  setStatusTab('all');
                }}
              >
                Filters clear karo
              </button>
            )}
          </div>
        ) : (
          <motion.div layout className="kds-grid">
            <AnimatePresence mode="popLayout">
              {visibleCards.map(({ order, lines }) => {
                const { elapsedSec, pct, isLate, isAmber } = kitchenCardTiming(
                  order,
                  now,
                  state.menu
                );
                const isReady = order.status === 'ready';
                const title =
                  order.channel === 'whatsapp'
                    ? `WhatsApp · ${order.customer || 'Delivery'}`
                    : `Table ${order.table}${order.customer ? ` · ${order.customer}` : ''}`;
                const channelLabel = order.channel === 'whatsapp' ? 'Delivery' : 'Dine-in';

                return (
                  <motion.article
                    key={order.id}
                    layout
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: isReady ? 0.55 : 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={SPRING}
                    className={`kds-card ${isLate ? 'late' : ''} ${isReady ? 'ready' : ''}`}
                  >
                    <div className="kds-head">
                      <div>
                        <div className="kds-title">{title}</div>
                        <div className="dark-sub">
                          #{shortId(order.id)} · {channelLabel} · {order.status}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          className={`kds-timer tabular-nums ${
                            isLate ? 'late' : isAmber ? 'amber' : ''
                          }`}
                        >
                          {fmtMMSS(elapsedSec)}
                        </div>
                        {isLate && <span className="st-tag st-late">LATE</span>}
                      </div>
                    </div>

                    <SakugaProgress
                      pct={pct}
                      tone={isLate ? 'red' : isReady ? 'green' : 'gold'}
                      label={`Order #${shortId(order.id)} progress`}
                    />

                    <div className="kds-lines">
                      {lines.map((l, idx) => {
                        const item = byId(l.itemId, state.menu);
                        return (
                          <div key={`${l.itemId}-${idx}`} className="kds-line">
                            <span className="dish-inline-label">
                              <DishThumb
                                img={item.img}
                                emoji={item.emoji}
                                alt={item.name}
                                className="kds-dish-thumb"
                                size={26}
                                decorative
                              />
                              <span>
                                {l.qty}× {item.name}
                                {l.deal ? ' (Deal)' : ''}
                              </span>
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--d-mute)' }}>
                              {item.section}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div>
                      {order.status === 'new' && (
                        <motion.button
                          type="button"
                          className="btn big"
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          transition={SPRING}
                          onClick={() => {
                            setOrderStatus(order.id, 'cooking');
                            showSakugaToast(`${title} banana shuru!`, 'gold', 'SHURU!');
                          }}
                        >
                          <Flame size={16} strokeWidth={2.3} aria-hidden="true" />
                          <span>Banana shuru</span>
                        </motion.button>
                      )}
                      {order.status === 'cooking' && (
                        <motion.button
                          type="button"
                          className="btn big btn-green"
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          transition={SPRING}
                          onClick={() => {
                            setOrderStatus(order.id, 'ready');
                            showSakugaToast(`${title} ready — waiter ko alert gaya!`, 'green', 'READY!');
                          }}
                        >
                          <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                          <span>Ready</span>
                        </motion.button>
                      )}
                      {order.status === 'ready' && (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '10px 8px',
                            fontWeight: 700,
                            color: '#5BE39A',
                          }}
                        >
                          Waiter ko alert gaya
                        </div>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
}
