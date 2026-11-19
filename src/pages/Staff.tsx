import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  BellOff,
  Check,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  agoMin,
  byId,
  catsOf,
  fmt,
  linePrice,
  orderTotal,
  shortId,
  STAFF_METHODS,
  tableBill,
  tableNumsOf,
  tableOrders,
  tableStatus,
  waiterOf,
  type Line,
  type TableStatus,
} from '../data';
import {
  addTable,
  collectFull,
  deleteTable,
  placeOrder,
  playChime,
  resolveCall,
  setOrderStatus,
  simulateWhatsAppOrder,
  useNow,
  useOrderChime,
  useStore,
} from '../store';
import {
  appendAlertToasts,
  detectNewHelpCalls,
  dispatchBrowserNotification,
  formatHelpCallNotification,
  getBrowserNotifEnabledPref,
  getBrowserNotificationPermission,
  normalizeHelpKind,
  pruneResolvedToasts,
  requestBrowserNotificationPermission,
  setBrowserNotifEnabledPref,
  type BrowserNotifPermission,
  type StaffAlertToastItem,
} from '../staffAlerts';
import { showSakugaToast } from '../sakuga';
import { ConfirmDialog, DishThumb, SPRING } from '../ui';
import Nav from './Nav';

const STATUS_WORD: Record<TableStatus, string> = {
  free: 'Free',
  ordering: 'Ordering',
  cooking: 'Cooking',
  eating: 'Eating',
  bill: 'Bill',
  help: 'HELP',
};

export default function Staff() {
  const state = useStore();
  const now = useNow(30000);
  useOrderChime();

  const tableNums = useMemo(() => tableNumsOf(state), [state]);
  const [selectedTable, setSelectedTable] = useState<number>(() => tableNums[0] ?? 1);
  const [draft, setDraft] = useState<Line[]>([]);
  const [floorFilter, setFloorFilter] = useState<'all' | 'help' | 'free' | 'active'>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCat, setMenuCat] = useState<string>('ALL');

  // Quick add/delete table controls
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNum, setNewTableNum] = useState<string>(() =>
    String(tableNums.length > 0 ? Math.max(...tableNums) + 1 : 1)
  );
  const [newTableWaiter, setNewTableWaiter] = useState('Ali');
  const [tableErr, setTableErr] = useState('');
  const [deleteConfirmNum, setDeleteConfirmNum] = useState<number | null>(null);

  // Live help-call subtle toast & optional browser notification state
  const [helpToasts, setHelpToasts] = useState<StaffAlertToastItem[]>([]);
  const [notifPerm, setNotifPerm] = useState<BrowserNotifPermission>(() =>
    getBrowserNotificationPermission()
  );
  const [browserAlertsOn, setBrowserAlertsOn] = useState<boolean>(() =>
    getBrowserNotifEnabledPref()
  );
  const seenCallIdsRef = useRef<Set<number> | null>(null);
  const toastTimersRef = useRef<Map<number, number>>(new Map());

  const dismissHelpToast = useCallback((callId: number) => {
    const timer = toastTimersRef.current.get(callId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(callId);
    }
    setHelpToasts((prev) => prev.filter((item) => item.id !== callId));
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const scheduleToastDismiss = useCallback((callId: number, delayMs = 9000) => {
    const existingTimer = toastTimersRef.current.get(callId);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    const timerId = window.setTimeout(() => {
      toastTimersRef.current.delete(callId);
      setHelpToasts((prev) => prev.filter((item) => item.id !== callId));
    }, delayMs);
    toastTimersRef.current.set(callId, timerId);
  }, []);

  const pauseToastDismiss = useCallback((callId: number) => {
    const existingTimer = toastTimersRef.current.get(callId);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      toastTimersRef.current.delete(callId);
    }
  }, []);

  // Watch state.calls for newly triggered help requests / Call Waiter alerts
  useEffect(() => {
    if (seenCallIdsRef.current === null) {
      seenCallIdsRef.current = new Set(state.calls.map((c) => c.id));
      return;
    }

    const { newCalls, nextSeenIds } = detectNewHelpCalls(
      state.calls,
      seenCallIdsRef.current
    );
    seenCallIdsRef.current = nextSeenIds;

    // Immediately clear any floating toasts whose calls were resolved elsewhere
    setHelpToasts((prev) => pruneResolvedToasts(prev, state.calls));

    if (newCalls.length === 0) return;

    const incomingToasts: StaffAlertToastItem[] = newCalls.map((call) => ({
      id: call.id,
      table: call.table,
      kind: normalizeHelpKind(call.kind),
      waiter: waiterOf(state, call.table),
      at: call.at,
    }));

    setHelpToasts((prev) => appendAlertToasts(prev, incomingToasts, 3));
    playChime();

    for (const call of newCalls) {
      scheduleToastDismiss(call.id, 9000);

      if (browserAlertsOn && notifPerm === 'granted') {
        const payload = formatHelpCallNotification(call, waiterOf(state, call.table));
        dispatchBrowserNotification(payload, () => {
          setSelectedTable(call.table);
          setDraft([]);
          dismissHelpToast(call.id);
        });
      }
    }
  }, [state, browserAlertsOn, notifPerm, dismissHelpToast, scheduleToastDismiss]);

  async function handleToggleBrowserAlerts() {
    if (notifPerm === 'unsupported') {
      showSakugaToast('In-app alerts active hain (browser notifications unavailable).', 'gold', 'ALERTS');
      return;
    }
    if (notifPerm === 'denied') {
      showSakugaToast('Browser settings me notifications allow karein. In-app toasts active hain.', 'gold', 'BLOCKED');
      return;
    }
    if (notifPerm === 'default') {
      const nextPerm = await requestBrowserNotificationPermission();
      setNotifPerm(nextPerm);
      if (nextPerm === 'granted') {
        setBrowserAlertsOn(true);
        setBrowserNotifEnabledPref(true);
        showSakugaToast('Browser help alerts chalu ho gaye!', 'green', 'ON');
      } else {
        showSakugaToast('In-app floor alerts active rahenge.', 'gold', 'IN-APP');
      }
      return;
    }

    const next = !browserAlertsOn;
    setBrowserAlertsOn(next);
    setBrowserNotifEnabledPref(next);
    showSakugaToast(
      next ? 'Browser help alerts chalu.' : 'Browser alerts muted (in-app toasts on).',
      next ? 'green' : 'gold',
      next ? 'ON' : 'MUTED'
    );
  }

  const browserAlertActive = notifPerm === 'granted' && browserAlertsOn;

  useEffect(() => {
    if (tableNums.length > 0 && !tableNums.includes(selectedTable)) {
      setSelectedTable(tableNums[0]);
      setDraft([]);
    }
  }, [tableNums, selectedTable]);

  const activeTable = tableNums.includes(selectedTable)
    ? selectedTable
    : (tableNums[0] ?? 1);

  const openCalls = useMemo(
    () => state.calls.filter((c) => !c.done).sort((a, b) => a.at - b.at),
    [state.calls]
  );

  const readyOrders = useMemo(
    () =>
      state.orders
        .filter((o) => !o.paid && o.status === 'ready')
        .sort((a, b) => (a.readyAt ?? a.createdAt) - (b.readyAt ?? b.createdAt)),
    [state.orders]
  );

  const activeWhatsApp = useMemo(
    () =>
      state.orders
        .filter((o) => o.channel === 'whatsapp' && !o.paid)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.orders]
  );

  const availMenu = useMemo(
    () => state.menu.filter((m) => m.available).sort((a, b) => a.pos - b.pos),
    [state.menu]
  );
  const menuCats = useMemo(() => catsOf(state.menu, true), [state.menu]);
  const filteredWaiterMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return availMenu.filter((m) => {
      if (menuCat !== 'ALL' && m.cat !== menuCat) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.cat.toLowerCase().includes(q);
    });
  }, [availMenu, menuCat, menuSearch]);

  const floorCounts = useMemo(() => {
    let help = 0;
    let free = 0;
    let active = 0;
    for (const t of tableNums) {
      const st = tableStatus(state, t);
      if (st === 'help') help += 1;
      if (st === 'free') free += 1;
      else active += 1;
    }
    return { all: tableNums.length, help, free, active };
  }, [tableNums, state]);

  const visibleTableNums = useMemo(() => {
    if (floorFilter === 'all') return tableNums;
    return tableNums.filter((t) => {
      const st = tableStatus(state, t);
      if (floorFilter === 'help') return st === 'help';
      if (floorFilter === 'free') return st === 'free';
      return st !== 'free';
    });
  }, [tableNums, floorFilter, state]);

  const selOrders = useMemo(
    () => tableOrders(state, activeTable),
    [state, activeTable]
  );
  const selBill = useMemo(
    () => tableBill(state, activeTable),
    [state, activeTable]
  );
  const selStatus = tableStatus(state, activeTable);

  function addDraftItem(itemId: string) {
    setDraft((prev) => {
      const idx = prev.findIndex((l) => l.itemId === itemId);
      if (idx === -1) return [...prev, { itemId, qty: 1, size: 'full' }];
      return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
    });
  }

  function setDraftItemQty(itemId: string, nextQty: number) {
    setDraft((prev) => {
      if (nextQty <= 0) return prev.filter((l) => l.itemId !== itemId);
      const idx = prev.findIndex((l) => l.itemId === itemId);
      if (idx === -1) return [...prev, { itemId, qty: nextQty, size: 'full' }];
      return prev.map((l, i) => (i === idx ? { ...l, qty: nextQty } : l));
    });
  }

  function removeDraftItem(itemId: string) {
    setDraft((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  function handleSendDraft() {
    if (draft.length === 0) return;
    placeOrder(activeTable, draft, 'waiter', 'dine');
    showSakugaToast(`Table ${activeTable} ka order kitchen gaya!`, 'gold', 'BHEJA!');
    setDraft([]);
  }

  function handleOpenAddTable() {
    const nextNum = tableNums.length > 0 ? Math.max(...tableNums) + 1 : 1;
    setNewTableNum(String(nextNum));
    setTableErr('');
    setShowAddTable((v) => !v);
  }

  function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(newTableNum);
    const res = addTable(num, newTableWaiter);
    if (!res.ok) {
      setTableErr(res.error || 'Table add nahi ho paya.');
      return;
    }
    setTableErr('');
    setSelectedTable(num);
    setShowAddTable(false);
    setNewTableNum(String(num + 1));
    showSakugaToast(`Table ${num} add ho gaya!`, 'green', 'ADDED!');
  }

  function handleConfirmDeleteTable() {
    if (deleteConfirmNum === null) return;
    const target = deleteConfirmNum;
    const res = deleteTable(target);
    setDeleteConfirmNum(null);
    if (!res.ok) {
      showSakugaToast(res.error || 'Table delete nahi ho paya.', 'red', 'WAIT!');
      return;
    }
    showSakugaToast(`Table ${target} delete ho gaya!`, 'gold', 'REMOVED!');
  }

  return (
    <div className="dark-page">
      <Nav active="staff" />
      <main className="dark-wrap">
        <div className="dark-head">
          <div>
            <h1 className="icon-heading">
              <UtensilsCrossed size={24} strokeWidth={2.3} color="var(--gold)" aria-hidden="true" />
              <span>Waiter floor</span>
            </h1>
            <p className="dark-sub">
              Live {tableNums.length}-table map · calls aur ready orders upar dikhte hain
            </p>
          </div>
          {notifPerm !== 'unsupported' && (
            <button
              type="button"
              className={`staff-alert-toggle ${browserAlertActive ? 'is-on' : ''} ${
                notifPerm === 'denied' ? 'is-denied' : ''
              }`}
              onClick={handleToggleBrowserAlerts}
              aria-pressed={browserAlertActive}
              title={
                notifPerm === 'denied'
                  ? 'Browser notifications blocked in site settings'
                  : browserAlertActive
                  ? 'Desktop browser alerts are on (click to mute)'
                  : 'Enable desktop browser alerts for table help requests'
              }
            >
              {browserAlertActive ? (
                <Bell size={15} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <BellOff size={15} strokeWidth={2.2} aria-hidden="true" />
              )}
              <span>
                {notifPerm === 'denied'
                  ? 'Floor alerts: In-app'
                  : browserAlertActive
                  ? 'Browser alerts: On'
                  : 'Browser alerts: Off'}
              </span>
            </button>
          )}
        </div>

        {/* Alerts panel (only when something pending) */}
        <AnimatePresence>
          {(openCalls.length > 0 || readyOrders.length > 0) && (
            <motion.section
              className="alerts-box"
              aria-label="Pending alerts"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SPRING}
            >
              <AnimatePresence initial={false}>
                {openCalls.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    className="alert-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={SPRING}
                  >
                    <div>
                      <strong className="dish-inline-label">
                        <Bell size={15} strokeWidth={2.3} color="var(--gold)" aria-hidden="true" />
                        <span>
                          Table {c.table} · {c.kind} maanga ({waiterOf(state, c.table)})
                        </span>
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => resolveCall(c.id)}
                    >
                      Aa raha hu
                    </button>
                  </motion.div>
                ))}
                {readyOrders.map((o) => (
                  <motion.div
                    key={o.id}
                    layout
                    className="alert-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={SPRING}
                  >
                    <div>
                      <strong className="dish-inline-label">
                        <UtensilsCrossed size={15} strokeWidth={2.3} color="#5BE39A" aria-hidden="true" />
                        <span>
                          {o.table !== null
                            ? `Table ${o.table} ready hai (#${shortId(o.id)})`
                            : `WhatsApp · ${o.customer || 'Delivery'} ready hai (#${shortId(o.id)})`}
                        </span>
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-green"
                      onClick={() =>
                        setOrderStatus(
                          o.id,
                          'served',
                          o.table !== null ? waiterOf(state, o.table) : 'Delivery'
                        )
                      }
                    >
                      <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                      <span>Served</span>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="two-col">
          {/* Left: Dynamic table grid + WhatsApp/Delivery panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="d-card" aria-label="Tables floor map">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <h2 style={{ fontSize: 20 }}>Tables ({tableNums.length})</h2>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleOpenAddTable}
                >
                  {showAddTable ? (
                    <>
                      <X size={14} strokeWidth={2.4} aria-hidden="true" />
                      <span>Close</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
                      <span>Table</span>
                    </>
                  )}
                </button>
              </div>

              {showAddTable && (
                <form
                  onSubmit={handleAddTable}
                  style={{
                    background: '#141442',
                    border: '1.5px solid var(--gold)',
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div className="form-grid-2">
                    <div>
                      <label htmlFor="staff-tbl-num" className="d-label">
                        Table number
                      </label>
                      <input
                        id="staff-tbl-num"
                        type="number"
                        min={1}
                        max={99}
                        className="d-input"
                        value={newTableNum}
                        onChange={(e) => setNewTableNum(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="staff-tbl-waiter" className="d-label">
                        Waiter naam
                      </label>
                      <input
                        id="staff-tbl-waiter"
                        type="text"
                        className="d-input"
                        value={newTableWaiter}
                        onChange={(e) => setNewTableWaiter(e.target.value)}
                        placeholder="Ali / Sana"
                      />
                    </div>
                  </div>
                  {tableErr && (
                    <div role="alert" className="admin-error">
                      {tableErr}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      onClick={() => setShowAddTable(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm">
                      + Add Table
                    </button>
                  </div>
                </form>
              )}

              <div className="crm-seg-group" role="tablist" aria-label="Floor status filter" style={{ marginBottom: 12 }}>
                {(
                  [
                    { id: 'all', label: 'All', count: floorCounts.all },
                    { id: 'free', label: 'Khali', count: floorCounts.free },
                    { id: 'active', label: 'Active', count: floorCounts.active },
                    { id: 'help', label: 'Help', count: floorCounts.help },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={floorFilter === f.id}
                    className={`crm-seg-btn ${floorFilter === f.id ? 'on' : ''}`}
                    onClick={() => setFloorFilter(f.id)}
                  >
                    <span>{f.label}</span>
                    <span className="crm-seg-cnt tabular-nums">{f.count}</span>
                  </button>
                ))}
              </div>

              {visibleTableNums.length === 0 ? (
                <p className="dark-sub" style={{ padding: '18px 4px', textAlign: 'center' }}>
                  Is filter mein abhi koi table nahi hai.
                </p>
              ) : (
                <motion.div layout className="table-grid">
                  {visibleTableNums.map((t) => {
                    const st = tableStatus(state, t);
                    const bill = tableBill(state, t);
                    const tOrders = tableOrders(state, t);
                    const guestName = tOrders.find((o) => o.customer)?.customer;
                    const oldestAt = tOrders[0]?.createdAt;
                    const isSel = activeTable === t;
                    return (
                      <motion.button
                        key={t}
                        layout
                        type="button"
                        className={`table-tile st-border-${st} ${isSel ? 'selected' : ''}`}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        transition={SPRING}
                        onClick={() => {
                          setSelectedTable(t);
                          setDraft([]);
                        }}
                        aria-pressed={isSel}
                      >
                        <div className="table-tile-top">
                          <div className="table-tile-num tabular-nums">T{t}</div>
                          {oldestAt && (
                            <span className="table-tile-age tabular-nums">
                              {agoMin(oldestAt, now)}m
                            </span>
                          )}
                        </div>
                        <span className={`st-tag st-${st}`}>{STATUS_WORD[st]}</span>
                        <div className="table-tile-bill tabular-nums">
                          {st !== 'free' && bill > 0 ? fmt(bill) : waiterOf(state, t)}
                        </div>
                        {guestName && (
                          <div className="table-tile-guest">{guestName}</div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </section>

            <section className="d-card" aria-label="WhatsApp and Delivery orders">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                <h2 className="icon-heading" style={{ fontSize: 19 }}>
                  <MessageCircle size={18} strokeWidth={2.2} color="#5BE39A" aria-hidden="true" />
                  <span>WhatsApp / Delivery</span>
                </h2>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    simulateWhatsAppOrder();
                    showSakugaToast('WhatsApp delivery order aaya!', 'gold', 'DING!');
                  }}
                >
                  <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
                  <span>Simulate WhatsApp order</span>
                </button>
              </div>

              {activeWhatsApp.length === 0 ? (
                <p className="dark-sub">Abhi koi active WhatsApp delivery order nahi.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeWhatsApp.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        background: '#141442',
                        border: '1px solid var(--d-border)',
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <strong>
                          #{shortId(o.id)} · {o.customer || 'Delivery'}
                        </strong>
                        <span className={`st-tag st-${o.status === 'new' ? 'ordering' : o.status}`}>
                          {o.status}
                        </span>
                      </div>
                      <div className="dark-sub" style={{ marginTop: 4 }}>
                        {o.lines
                          .map((l) => `${l.qty}× ${byId(l.itemId, state.menu).name}`)
                          .join(', ')}{' '}
                        · {fmt(orderTotal(o, state.menu))}
                      </div>
                      {o.status === 'ready' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-green"
                          style={{ marginTop: 8 }}
                          onClick={() => setOrderStatus(o.id, 'served', 'Delivery')}
                        >
                          Served ✓
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: Selected table detail */}
          <section className="d-card" aria-label={`Table ${activeTable} details`}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ fontSize: 24 }}>Table {activeTable}</h2>
                <p className="dark-sub">Waiter: {waiterOf(state, activeTable)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`st-tag st-${selStatus}`}>{STATUS_WORD[selStatus]}</span>
                <button
                  type="button"
                  className="btn-ghost-dark"
                  aria-label={`Delete Table ${activeTable}`}
                  onClick={() => setDeleteConfirmNum(activeTable)}
                >
                  <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {selOrders.length === 0 ? (
              <p className="dark-sub" style={{ marginBottom: 16 }}>
                Table khaali hai. Neeche se waiter order add kar sakta hai.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {selOrders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: '#141442',
                      border: '1px solid var(--d-border)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <span className="dark-sub">Order #{shortId(o.id)}</span>
                      <span
                        className={`st-tag st-${
                          o.status === 'new'
                            ? 'ordering'
                            : o.status === 'served'
                            ? 'eating'
                            : o.status
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                    {o.lines.map((l, idx) => (
                      <div
                        key={`${l.itemId}-${idx}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 14,
                          padding: '2px 0',
                        }}
                      >
                        <span>
                          {l.qty}× {byId(l.itemId, state.menu).name}
                          {l.deal ? ' (Deal)' : ''}
                        </span>
                        <span>{fmt(linePrice(l, state.menu))}</span>
                      </div>
                    ))}
                    {o.status === 'ready' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-green"
                        style={{ marginTop: 8 }}
                        onClick={() => setOrderStatus(o.id, 'served', waiterOf(state, activeTable))}
                      >
                        Served ✓
                      </button>
                    )}
                  </div>
                ))}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 10,
                    borderTop: '1px solid var(--d-border)',
                    fontSize: 18,
                    fontFamily: 'var(--f-d)',
                    fontWeight: 800,
                  }}
                >
                  <span>Total</span>
                  <span style={{ color: 'var(--gold)' }}>{fmt(selBill)}</span>
                </div>

                <div className="chip-row" style={{ marginTop: 4 }}>
                  {STAFF_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="btn btn-sm"
                      onClick={() => collectFull(activeTable, m)}
                    >
                      Collect · {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add dish quick search & category picker */}
            <div style={{ borderTop: '1px solid var(--d-border)', paddingTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                <h3 style={{ fontSize: 17 }}>Add dish</h3>
                <div className="d-search-wrap" style={{ maxWidth: 220, width: '100%' }}>
                  <Search size={14} strokeWidth={2.2} className="d-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    className="d-input d-input-search"
                    style={{ padding: '7px 11px 7px 32px', fontSize: 13 }}
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search dish…"
                    aria-label="Waiter dish search"
                  />
                </div>
              </div>

              <div className="chip-row" style={{ marginBottom: 10 }} role="tablist" aria-label="Dish categories">
                {(['ALL', ...menuCats] as string[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={menuCat === cat}
                    className={`chip-dark ${menuCat === cat ? 'on' : ''}`}
                    onClick={() => setMenuCat(cat)}
                  >
                    {cat === 'ALL' ? 'Sabhi' : cat}
                  </button>
                ))}
              </div>

              <div className="chip-row" style={{ marginBottom: 12 }}>
                {filteredWaiterMenu.length === 0 ? (
                  <p className="dark-sub">Koi dish nahi mili.</p>
                ) : (
                  filteredWaiterMenu.map((item) => {
                    const draftQty = draft.find((d) => d.itemId === item.id)?.qty ?? 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`chip-dark chip-dark-dish ${draftQty > 0 ? 'on' : ''}`}
                        onClick={() => addDraftItem(item.id)}
                      >
                        <DishThumb
                          img={item.img}
                          emoji={item.emoji}
                          alt={item.name}
                          className="waiter-dish-thumb"
                          size={22}
                          decorative
                        />
                        <span>
                          {item.name} · {fmt(item.price)}
                          {draftQty > 0 ? ` (${draftQty})` : ''}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <AnimatePresence>
                {draft.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={SPRING}
                    style={{
                      background: '#141442',
                      border: '1px solid var(--gold)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>
                        Draft order (Table {activeTable})
                      </span>
                      <button
                        type="button"
                        className="btn-ghost-dark"
                        style={{ padding: '3px 9px', fontSize: 12 }}
                        onClick={() => setDraft([])}
                      >
                        Clear
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {draft.map((l) => {
                        const item = byId(l.itemId, state.menu);
                        return (
                          <motion.div
                            key={l.itemId}
                            layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={SPRING}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                              padding: '5px 0',
                              fontSize: 14,
                            }}
                          >
                            <span className="dish-inline-label">
                              <DishThumb
                                img={item.img}
                                emoji={item.emoji}
                                alt={item.name}
                                className="waiter-dish-thumb"
                                size={24}
                                decorative
                              />
                              <span>
                                {item.name} ({fmt(linePrice(l, state.menu))})
                              </span>
                            </span>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                className="crm-pts-btn"
                                style={{ minWidth: 28, height: 28 }}
                                aria-label={`Kam karo ${item.name}`}
                                onClick={() => setDraftItemQty(l.itemId, l.qty - 1)}
                              >
                                <Minus size={13} strokeWidth={2.5} aria-hidden="true" />
                              </button>
                              <span className="tabular-nums" style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>
                                {l.qty}
                              </span>
                              <button
                                type="button"
                                className="crm-pts-btn add"
                                style={{ minWidth: 28, height: 28 }}
                                aria-label={`Badhao ${item.name}`}
                                onClick={() => setDraftItemQty(l.itemId, l.qty + 1)}
                              >
                                <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="btn-ghost-dark"
                                style={{ padding: '4px 7px' }}
                                aria-label={`Remove ${item.name} from draft`}
                                onClick={() => removeDraftItem(l.itemId)}
                              >
                                <X size={13} strokeWidth={2.4} aria-hidden="true" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    <motion.button
                      type="button"
                      className="btn big"
                      style={{ marginTop: 10 }}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING}
                      onClick={handleSendDraft}
                    >
                      <span>
                        Send to kitchen ·{' '}
                        {fmt(draft.reduce((sum, l) => sum + linePrice(l, state.menu), 0))}
                      </span>
                      <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      <aside
        className="staff-alert-toast-host"
        aria-label="Live table help requests"
        aria-hidden={helpToasts.length === 0}
      >
        <AnimatePresence>
          {helpToasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              className="staff-alert-toast"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={SPRING}
              onMouseEnter={() => pauseToastDismiss(toast.id)}
              onMouseLeave={() => scheduleToastDismiss(toast.id, 4500)}
            >
              <div className="staff-alert-head">
                <div className="staff-alert-icon" aria-hidden="true">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div className="staff-alert-copy">
                  <div className="staff-alert-title">
                    Table {toast.table} · {toast.kind}
                  </div>
                  <div className="staff-alert-meta">
                    Guest needs help · Waiter: {toast.waiter}
                  </div>
                </div>
                <button
                  type="button"
                  className="staff-alert-close"
                  aria-label={`Dismiss Table ${toast.table} alert`}
                  onClick={() => dismissHelpToast(toast.id)}
                >
                  ✕
                </button>
              </div>
              <div className="staff-alert-actions">
                <button
                  type="button"
                  className="staff-alert-btn"
                  onClick={() => {
                    setSelectedTable(toast.table);
                    setDraft([]);
                    dismissHelpToast(toast.id);
                  }}
                >
                  View Table {toast.table}
                </button>
                <button
                  type="button"
                  className="staff-alert-btn staff-alert-btn-primary"
                  onClick={() => {
                    resolveCall(toast.id);
                    dismissHelpToast(toast.id);
                  }}
                >
                  Aa raha hu
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </aside>

      <ConfirmDialog
        open={deleteConfirmNum !== null}
        title={deleteConfirmNum !== null ? `Table ${deleteConfirmNum} delete karo?` : ''}
        message="Ye table floor map, guest picker aur QR list se hat jayegi."
        confirmLabel="Delete karo"
        danger
        dark
        onConfirm={handleConfirmDeleteTable}
        onCancel={() => setDeleteConfirmNum(null)}
      />
    </div>
  );
}
