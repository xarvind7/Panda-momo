import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Droplets,
  ExternalLink,
  Film,
  Flame,
  Gift,
  Instagram,
  Layers,
  Leaf,
  Minus,
  Plus,
  Receipt,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  User,
  UserCheck,
  UtensilsCrossed,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  BRAND,
  byId,
  canShowDeal,
  catsOf,
  computeBillSplit,
  computePromoDiscount,
  DEAL_ITEM,
  DEAL_PRICE,
  estimateEta,
  fmt,
  fmtMMSS,
  formatPromoBadge,
  getOrderProgressInfo,
  linePrice,
  orderFillPct,
  orderTotal,
  PAYMENT_METHODS,
  promoActionHref,
  shortId,
  tableNumsOf,
  tableStatus,
  waiterOf,
  type Line,
  type MenuItem,
  type Order,
  type PromoPlatform,
  type Status,
} from '../data';
import {
  addReview,
  callWaiter,
  payShare,
  placeOrder,
  playChime,
  registerGuest,
  useNow,
  useStore,
} from '../store';
import {
  ChaiGlass,
  DeveloperContactButton,
  DishThumb,
  Logo,
  SakugaRating,
  SPRING,
} from '../ui';
import { showSakugaToast } from '../sakuga';
import ReceiptPrinter from '../ReceiptPrinter';

type GuestTab = 'menu' | 'order' | 'bill';

const GUEST_HERO_IMG = '/src/assets/images/panda_momo_hero_feast_1795084063789.jpg';
const GUEST_MENU_BANNER_IMG = '/src/assets/images/panda_momo_menu_banner_1795084064699.jpg';

const STEP_ORDER: Order['status'][] = ['new', 'cooking', 'ready', 'served'];

function PromoPlatformIcon({ platform, size = 14 }: { platform: PromoPlatform; size?: number }) {
  if (platform === 'instagram') return <Instagram size={size} strokeWidth={2.2} aria-hidden="true" />;
  if (platform === 'reel') return <Film size={size} strokeWidth={2.2} aria-hidden="true" />;
  if (platform === 'google') return <Star size={size} strokeWidth={2.2} aria-hidden="true" />;
  return <Gift size={size} strokeWidth={2.2} aria-hidden="true" />;
}

const PROMO_CTA: Record<PromoPlatform, string> = {
  instagram: 'Instagram kholo',
  reel: 'Reel / Story lagao',
  google: 'Google Review do',
  custom: 'Offer kholo',
};

function fmtClockTime(ts?: number): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function spiceDots(spice: 0 | 1 | 2 | 3): string {
  if (spice === 0) return '';
  return '🌶️'.repeat(spice);
}

export default function Customer({ initialTable }: { initialTable: number | null }) {
  const state = useStore();
  const now = useNow(1000);

  const tableNums = useMemo(() => tableNumsOf(state), [state.tables]);

  const [table, setTable] = useState<number | null>(() => {
    const nums = tableNumsOf(state);
    if (initialTable && nums.includes(initialTable)) {
      try {
        window.sessionStorage.setItem('tbl', String(initialTable));
      } catch {
        // Ignore sessionStorage errors
      }
      return initialTable;
    }
    try {
      const saved = Number(window.sessionStorage.getItem('tbl'));
      if (nums.includes(saved)) return saved;
    } catch {
      // Ignore
    }
    return null;
  });

  useEffect(() => {
    if (initialTable && tableNums.includes(initialTable)) {
      setTable(initialTable);
      try {
        window.sessionStorage.setItem('tbl', String(initialTable));
      } catch {
        // Ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTable]);

  useEffect(() => {
    if (table !== null && !tableNums.includes(table)) {
      setTable(null);
      try {
        window.sessionStorage.removeItem('tbl');
      } catch {
        // Ignore
      }
    }
  }, [table, tableNums]);

  const [guestProfile, setGuestProfile] = useState<{ name: string; phone: string } | null>(null);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestPhoneInput, setGuestPhoneInput] = useState('');
  const [guestErr, setGuestErr] = useState('');

  // Every fresh QR scan (mount or switching table QR URL) must ask for Name & Number fresh
  const prevInitialTableRef = useRef<number | null>(initialTable);
  useEffect(() => {
    try {
      window.sessionStorage.removeItem('guest_profile');
    } catch {
      // Ignore
    }
    if (prevInitialTableRef.current !== initialTable) {
      prevInitialTableRef.current = initialTable;
      setGuestProfile(null);
      setGuestNameInput('');
      setGuestPhoneInput('');
      setGuestErr('');
      setTab('menu');
    }
  }, [initialTable]);

  const [prevTable, setPrevTable] = useState<number | null>(null);
  const [showOnlyFreeTables, setShowOnlyFreeTables] = useState<boolean>(false);
  const [tab, setTab] = useState<GuestTab>('menu');
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('ALL');
  const [tasteFilter, setTasteFilter] = useState<'all' | 'fast' | 'mild' | 'spicy'>('all');
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [heroImgErr, setHeroImgErr] = useState(false);
  const [bannerImgErr, setBannerImgErr] = useState(false);

  const [sessionStartedAt, setSessionStartedAt] = useState<number>(() => Date.now());
  const [placedOrderIds, setPlacedOrderIds] = useState<number[]>([]);
  const [hasPaidInSession, setHasPaidInSession] = useState<boolean>(false);

  // Bill tab local controls
  const [splitParts, setSplitParts] = useState<number>(1);
  const [tipPct, setTipPct] = useState<number>(10);
  const [method, setMethod] = useState<string>('UPI');
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [receiptEmail, setReceiptEmail] = useState('');
  const [receiptSentTo, setReceiptSentTo] = useState('');
  const [stars, setStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSentAt, setReviewSentAt] = useState<number | null>(null);

  const availMenu = useMemo(
    () => state.menu.filter((m) => m.available).sort((a, b) => a.pos - b.pos),
    [state.menu]
  );
  const categories = useMemo(() => catsOf(state.menu, true), [state.menu]);
  const catCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: availMenu.length };
    for (const m of availMenu) {
      map[m.cat] = (map[m.cat] || 0) + 1;
    }
    return map;
  }, [availMenu]);

  useEffect(() => {
    if (activeCat !== 'ALL' && categories.length > 0 && !categories.includes(activeCat)) {
      setActiveCat(categories[0]);
    }
  }, [categories, activeCat]);

  const headerEta = useMemo(() => estimateEta(state, []), [state]);
  const cartEta = useMemo(() => estimateEta(state, cart), [state, cart]);

  const cartQty = useMemo(() => cart.reduce((sum, l) => sum + l.qty, 0), [cart]);
  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + linePrice(l, state.menu), 0),
    [cart, state.menu]
  );

  const showDeal = useMemo(() => canShowDeal(cart, state.menu), [cart, state.menu]);

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availMenu.filter((m) => {
      if (q) {
        const hay = `${m.name} ${m.desc} ${m.cat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      } else if (activeCat !== 'ALL' && m.cat !== activeCat) {
        return false;
      }
      if (tasteFilter === 'fast') return m.prep <= 4;
      if (tasteFilter === 'mild') return m.spice === 0;
      if (tasteFilter === 'spicy') return m.spice >= 2;
      return true;
    });
  }, [availMenu, search, activeCat, tasteFilter]);

  // Active orders strictly for THIS guest ("oder kare to bus jo oder kare vahi show ho")
  const myActiveOrders = useMemo(() => {
    const phone = guestProfile?.phone;
    return state.orders
      .filter((o) => {
        if (o.paid) return false;
        if (placedOrderIds.includes(o.id)) return true;
        return (
          Boolean(phone) &&
          o.customerPhone === phone &&
          o.createdAt >= sessionStartedAt
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.orders, placedOrderIds, guestProfile?.phone, sessionStartedAt]);

  const myOrders = myActiveOrders;

  // Recent paid orders strictly for THIS guest session
  const myPastOrders = useMemo(() => {
    const phone = guestProfile?.phone;
    return state.orders
      .filter((o) => {
        if (!o.paid) return false;
        if (placedOrderIds.includes(o.id)) return true;
        return (
          Boolean(phone) &&
          o.customerPhone === phone &&
          o.createdAt >= sessionStartedAt
        );
      })
      .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt))
      .slice(0, 5);
  }, [state.orders, placedOrderIds, guestProfile?.phone, sessionStartedAt]);

  const myBillTotal = useMemo(
    () => myOrders.reduce((sum, o) => sum + orderTotal(o, state.menu), 0),
    [myOrders, state.menu]
  );
  const openCalls = useMemo(
    () => (table ? state.calls.filter((c) => !c.done && c.table === table) : []),
    [state.calls, table]
  );

  const paidParts = table ? state.part[table] ?? 0 : 0;
  const lastPaid = hasPaidInSession && table ? state.lastPaid[table] : undefined;
  const [copiedWifi, setCopiedWifi] = useState(false);

  // Live order status-transition watcher so guest is alerted when kitchen starts cooking or finishes!
  const prevOrderStatusRef = useRef<Record<number, Status>>({});
  useEffect(() => {
    const prev = prevOrderStatusRef.current;
    const nextMap: Record<number, Status> = {};
    for (const o of myActiveOrders) {
      nextMap[o.id] = o.status;
      const oldStatus = prev[o.id];
      if (oldStatus && oldStatus !== o.status) {
        if (o.status === 'cooking') {
          playChime();
          showSakugaToast(
            `🔥 Order #${shortId(o.id)} banna shuru ho gaya hai!`,
            'gold',
            'COOKING!'
          );
        } else if (o.status === 'ready') {
          playChime();
          showSakugaToast(
            `🔔 Order #${shortId(o.id)} BAN GAYA! Waiter abhi la raha hai!`,
            'green',
            'READY!'
          );
        } else if (o.status === 'served') {
          showSakugaToast(
            `🍽️ Order #${shortId(o.id)} serve ho gaya! Enjoy karo!`,
            'green',
            'ENJOY!'
          );
        }
      }
    }
    prevOrderStatusRef.current = nextMap;
  }, [myActiveOrders]);

  function handleCopyWifiPass() {
    const toCopy = state.wifi.password || state.wifi.name;
    try {
      void navigator.clipboard.writeText(toCopy);
    } catch {
      // Ignore clipboard errors
    }
    setCopiedWifi(true);
    showSakugaToast(
      state.wifi.password ? 'WiFi password copy ho gaya!' : 'WiFi naam copy ho gaya!',
      'gold',
      'COPIED!'
    );
    window.setTimeout(() => setCopiedWifi(false), 2000);
  }

  useEffect(() => {
    if (paidParts === 0 && myOrders.length === 0) {
      setSplitParts(1);
    }
  }, [paidParts, myOrders.length]);

  function chooseTable(n: number) {
    setTable(n);
    setPrevTable(null);
    setShowOnlyFreeTables(false);
    try {
      window.sessionStorage.setItem('tbl', String(n));
    } catch {
      // Ignore
    }
    if (guestProfile) {
      registerGuest(guestProfile.name, guestProfile.phone, n, false);
    }
    showSakugaToast(`Table ${n} (${waiterOf(state, n)}) select ho gaya!`, 'green', `T${n}!`);
  }

  function handleGuestCheckin(e: React.FormEvent) {
    e.preventDefault();
    const res = registerGuest(guestNameInput, guestPhoneInput, table, true);
    if (!res.ok) {
      setGuestErr(res.error);
      return;
    }
    const profile = { name: res.name, phone: res.phone };
    setSessionStartedAt(Date.now());
    setPlacedOrderIds([]);
    setHasPaidInSession(false);
    setGuestProfile(profile);
    setGuestErr('');
    showSakugaToast(`Swagat hai, ${res.name}!`, 'gold', 'WELCOME!');
  }

  function clearTable() {
    setPrevTable(table);
    setTable(null);
    setCart([]);
    setCartOpen(false);
    setTab('menu');
    setShowOnlyFreeTables(false);
    try {
      window.sessionStorage.removeItem('tbl');
    } catch {
      // Ignore
    }
  }

  function getQty(itemId: string): number {
    return cart
      .filter((l) => l.itemId === itemId && !l.deal)
      .reduce((sum, l) => sum + l.qty, 0);
  }

  function setItemQty(itemId: string, nextQty: number) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.itemId === itemId && !l.deal);
      if (nextQty <= 0) {
        if (idx === -1) return prev;
        return prev.filter((_, i) => i !== idx);
      }
      if (idx === -1) {
        return [...prev, { itemId, qty: nextQty, size: 'full' }];
      }
      return prev.map((l, i) => (i === idx ? { ...l, qty: nextQty } : l));
    });
  }

  function addDealChai() {
    setCart((prev) => {
      if (prev.some((l) => l.deal)) return prev;
      return [...prev, { itemId: DEAL_ITEM, qty: 1, size: 'full', deal: true }];
    });
  }

  function removeCartIndex(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCartIndexQty(index: number, delta: number) {
    setCart((prev) =>
      prev
        .map((line, i) => (i === index ? { ...line, qty: line.qty + delta } : line))
        .filter((line) => line.qty > 0)
    );
  }

  function handlePlaceOrder() {
    if (!table || cart.length === 0) return;
    const created = placeOrder(
      table,
      cart,
      'guest',
      'dine',
      guestProfile?.name,
      guestProfile?.phone
    );
    if (created) {
      setPlacedOrderIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
    }
    setHasPaidInSession(false);
    showSakugaToast(`Order kitchen mein bhej diya! (~${cartEta} min)`, 'gold', 'BHEJA!');
    setCart([]);
    setCartOpen(false);
    setTab('order');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePayShare() {
    if (!table || myBillTotal <= 0) return;
    const activePromo = selectedPromoId
      ? (state.promos || []).find((p) => p.id === selectedPromoId)
      : undefined;
    const promoCalc = computePromoDiscount(myBillTotal, activePromo);
    const netSubtotal = Math.max(0, myBillTotal - (promoCalc.eligible ? promoCalc.discount : 0));
    const { tip, share } = computeBillSplit(netSubtotal, tipPct, splitParts);
    const closed = payShare(
      table,
      splitParts,
      method,
      tip,
      promoCalc.eligible && activePromo ? activePromo.id : null
    );
    if (closed) {
      setHasPaidInSession(true);
      showSakugaToast(`${fmt(netSubtotal)} bill clear ho gaya!`, 'green', 'PAID!');
      setSelectedPromoId(null);
      setReceiptSentTo('');
      setReceiptEmail('');
      setReviewText('');
      setStars(5);
      setReviewSentAt(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showSakugaToast(`${fmt(share)} paid! Agla share baaki hai.`, 'gold', 'PAID!');
    }
  }

  function handleSendReview(e: React.FormEvent) {
    e.preventDefault();
    if (!table) return;
    addReview(table, stars, reviewText);
    showSakugaToast('Shukriya! Aapka review save ho gaya.', 'green', 'WAH!');
    setReviewSentAt(lastPaid?.at ?? Date.now());
  }

  // ---- Step 1: Guest Name & Mobile Number Check-in (on QR scan before menu opens) ----
  if (!guestProfile) {
    const phoneDigits = guestPhoneInput.replace(/\D/g, '').length;
    return (
      <div className="guest-welcome">
        <div className="guest-welcome-inner">
          <div className="guest-step-bar" aria-label="Onboarding progress">
            <span className="guest-step-item is-active">1. Check-In</span>
            <span aria-hidden="true">→</span>
            <span className="guest-step-item">{table ? `Table ${table}` : '2. Table'}</span>
            <span aria-hidden="true">→</span>
            <span className="guest-step-item">Menu</span>
          </div>

          <motion.div
            className="guest-checkin-hero"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {!heroImgErr ? (
              <img
                src={GUEST_HERO_IMG}
                alt="Steaming handcrafted momos and kulhad masala chai"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgErr(true)}
              />
            ) : (
              <div className="guest-checkin-hero-fallback">
                <Logo size={56} />
              </div>
            )}
            <div className="guest-checkin-hero-scrim">
              <div className="guest-checkin-brand-row">
                <Logo size={42} />
                <div>
                  <h1>{BRAND}</h1>
                  {table ? (
                    <span className="guest-checkin-table-meta">
                      Table {table} · {waiterOf(state, table)}
                    </span>
                  ) : (
                    <span className="guest-checkin-table-meta">
                      Fresh Momos · Kulhad Chai
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.form
            className="guest-checkin-card"
            onSubmit={handleGuestCheckin}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.24, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="guest-checkin-intro">
              <h2>Swagat hai!</h2>
              <p>Menu kholne ke liye apna naam aur mobile number daalo.</p>
            </div>
            <div className="guest-field">
              <label htmlFor="guest-name-input" className="field-label" style={{ marginTop: 0 }}>
                Aapka Naam
              </label>
              <input
                id="guest-name-input"
                type="text"
                className="text-input"
                value={guestNameInput}
                onChange={(e) => {
                  setGuestNameInput(e.target.value);
                  if (guestErr) setGuestErr('');
                }}
                placeholder="e.g. Rahul Sharma"
                autoComplete="name"
                required
              />
            </div>

            <div className="guest-field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <label htmlFor="guest-phone-input" className="field-label" style={{ margin: 0 }}>
                  Mobile Number
                </label>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: phoneDigits >= 10 ? 'var(--green)' : 'var(--mute)',
                  }}
                >
                  {phoneDigits >= 10 ? '✓ 10 digits ready' : `${Math.min(phoneDigits, 10)}/10 digits`}
                </span>
              </div>
              <input
                id="guest-phone-input"
                type="tel"
                inputMode="numeric"
                className="text-input"
                value={guestPhoneInput}
                onChange={(e) => {
                  setGuestPhoneInput(e.target.value);
                  if (guestErr) setGuestErr('');
                }}
                placeholder="10 digit mobile number"
                autoComplete="tel"
                required
              />
            </div>

            {guestErr && (
              <div role="alert" className="guest-checkin-err">
                {guestErr}
              </div>
            )}

            <button type="submit" className="btn big" style={{ marginTop: 4 }}>
              <span>Menu kholo</span>
              <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </motion.form>

          <footer className="guest-dev-footer" style={{ gap: 14, flexWrap: 'wrap' }} aria-label="Footer navigation">
            <a href="#/" className="chip" style={{ fontSize: 12.5, padding: '7px 13px' }}>
              <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>Home</span>
            </a>
            <DeveloperContactButton compact />
          </footer>
        </div>
      </div>
    );
  }

  // ---- Step 2: Table Picker / Change Table Screen (shows which tables are Khali vs Busy!) ----
  if (!table) {
    const tableCards = tableNums.map((n) => {
      const st = tableStatus(state, n);
      return {
        num: n,
        waiter: waiterOf(state, n),
        status: st,
        isFree: st === 'free',
        isPrev: prevTable === n,
      };
    });
    const freeTables = tableCards.filter((t) => t.isFree);
    const busyCount = tableCards.length - freeTables.length;
    const visibleTables = showOnlyFreeTables
      ? freeTables
      : [...freeTables, ...tableCards.filter((t) => !t.isFree)];

    return (
      <div className="guest-welcome">
        <div className="guest-welcome-inner">
          <div className="guest-step-bar" aria-label="Onboarding progress">
            <button
              type="button"
              className="guest-step-edit"
              onClick={() => {
                setGuestNameInput(guestProfile.name);
                setGuestPhoneInput(guestProfile.phone);
                setGuestProfile(null);
              }}
            >
              ✓ {guestProfile.name} · Edit
            </button>
            <span aria-hidden="true">→</span>
            <span className="guest-step-item is-active">2. Table</span>
            <span aria-hidden="true">→</span>
            <span className="guest-step-item">Menu</span>
          </div>
          <motion.div
            initial={{ scale: 0.5, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={SPRING}
          >
            <Logo size={74} />
          </motion.div>
          <motion.h1
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.08 }}
          >
            {prevTable ? 'Doosri Table Chuno' : BRAND}
          </motion.h1>
          <motion.p
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.14 }}
          >
            {prevTable ? (
              <>
                <strong>{guestProfile.name}</strong>, abhi <strong>{freeTables.length} tables khali</strong> hain — koi bhi khali table chuno!
              </>
            ) : (
              <>
                Swagat hai, <strong>{guestProfile.name}</strong>! Neeche dekho kaunsi table khali hai aur apni table chuno.
              </>
            )}
          </motion.p>

          {/* Live Availability Summary & Filter */}
          <div className="table-avail-bar" role="status">
            <span className="table-avail-pill is-free">
              <CheckCircle2 size={14} strokeWidth={2.3} aria-hidden="true" />
              <span>{freeTables.length} Khali</span>
            </span>
            <span className="table-avail-pill is-busy">
              <Clock size={14} strokeWidth={2.3} aria-hidden="true" />
              <span>{busyCount} Busy</span>
            </span>
          </div>

          <div className="table-filter-row" role="group" aria-label="Filter tables">
            <button
              type="button"
              className={`table-filter-btn ${!showOnlyFreeTables ? 'on' : ''}`}
              onClick={() => setShowOnlyFreeTables(false)}
            >
              Sabhi Tables ({tableCards.length})
            </button>
            <button
              type="button"
              className={`table-filter-btn ${showOnlyFreeTables ? 'on' : ''}`}
              onClick={() => setShowOnlyFreeTables(true)}
            >
              <CheckCircle2 size={14} strokeWidth={2.3} aria-hidden="true" />
              <span>Sirf Khali ({freeTables.length})</span>
            </button>
          </div>

          {visibleTables.length === 0 ? (
            <div className="table-empty-note">
              Abhi koi bhi table khali nahi hai — thodi der mein check karo ya waiter se poochho.
            </div>
          ) : (
            <div className="coaster-grid" role="group" aria-label="Table number chuno">
              {visibleTables.map((t, i) => (
                <motion.button
                  key={t.num}
                  type="button"
                  className={`coaster-btn ${t.isFree ? 'is-free' : 'is-busy'} ${t.isPrev ? 'is-prev' : ''}`}
                  aria-label={`Table ${t.num} ${t.isFree ? 'Khali' : 'Busy'}`}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...SPRING, delay: 0.12 + i * 0.04 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => chooseTable(t.num)}
                >
                  <span className={`coaster-status ${t.isFree ? 'is-free' : 'is-busy'}`}>
                    {t.isFree ? (
                      <>
                        <CheckCircle2 size={11} strokeWidth={2.6} aria-hidden="true" /> Khali
                      </>
                    ) : t.isPrev ? (
                      <>
                        <Armchair size={11} strokeWidth={2.5} aria-hidden="true" /> Pichhli
                      </>
                    ) : (
                      <>
                        <Clock size={11} strokeWidth={2.5} aria-hidden="true" /> Busy
                      </>
                    )}
                  </span>
                  <span>{t.num}</span>
                  <span className="coaster-sub">{t.waiter}</span>
                </motion.button>
              ))}
            </div>
          )}

          {prevTable && tableNums.includes(prevTable) && (
            <button
              type="button"
              className="table-back-btn"
              onClick={() => {
                setTable(prevTable);
                setPrevTable(null);
              }}
            >
              <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>Table {prevTable} par wapas jao</span>
            </button>
          )}

          <footer className="guest-dev-footer" aria-label="Contact Developer">
            <DeveloperContactButton compact />
          </footer>
        </div>
      </div>
    );
  }

  const activePromos = (state.promos || []).filter((p) => p.active);
  const selectedPromo = activePromos.find((p) => p.id === selectedPromoId) || null;
  const promoCalc = computePromoDiscount(myBillTotal, selectedPromo);
  const appliedDiscount = promoCalc.eligible ? promoCalc.discount : 0;
  const discountedSubtotal = Math.max(0, myBillTotal - appliedDiscount);
  const splitCalc = computeBillSplit(discountedSubtotal, tipPct, splitParts);

  return (
    <div className="guest-shell">
      {/* Sticky Gold Header */}
      <header className="guest-header">
        <div className="guest-head-left">
          <Logo size={38} />
          <div style={{ minWidth: 0 }}>
            <div className="guest-brand">{BRAND}</div>
            <button
              type="button"
              className="guest-table-btn"
              onClick={clearTable}
            >
              {guestProfile.name} · Table {table} ({waiterOf(state, table)}) · badlo
            </button>
          </div>
        </div>
        <div className="guest-head-right">
          <button
            type="button"
            className={`guest-help-btn ${openCalls.length > 0 ? 'has-pending' : ''}`}
            onClick={() => setHelpOpen(true)}
            aria-label="Waiter ya madad bulao"
          >
            <span className="dish-inline-label" style={{ gap: 5 }}>
              <Bell size={14} strokeWidth={2.4} className="guest-help-bell" aria-hidden="true" />
              <span>{openCalls.length > 0 ? 'Waiter On Way' : 'Help'}</span>
            </span>
          </button>
          <motion.div
            key={headerEta}
            className="eta-pill"
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={SPRING}
            aria-label={`Estimated time ${headerEta} minutes`}
          >
            <Clock size={13} strokeWidth={2.4} aria-hidden="true" />
            <span>~{headerEta}m</span>
          </motion.div>
        </div>
      </header>

      <main className="guest-content">
        <AnimatePresence mode="wait">
          {/* ============ MENU TAB ============ */}
          {tab === 'menu' && (
            <motion.div
              key="tab-menu"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {/* Editorial Cafe Banner (shown when browsing menu without search query) */}
              {!search.trim() && (
                <div className="guest-menu-hero">
                  {!bannerImgErr ? (
                    <img
                      src={GUEST_MENU_BANNER_IMG}
                      alt="Tandoori and steamed momos plated fresh with red sesame chutney"
                      referrerPolicy="no-referrer"
                      onError={() => setBannerImgErr(true)}
                    />
                  ) : (
                    <div className="guest-menu-hero-fallback" aria-hidden="true" />
                  )}
                  <div className="guest-menu-hero-scrim">
                    <span className="guest-menu-hero-kicker">FRESH FROM THE STEAMER</span>
                    <div className="guest-menu-hero-title">Hand-pleated Momos &amp; Kulhad Chai</div>
                    <div className="guest-menu-hero-sub tabular-nums">
                      Table {table} · Live prep ~{headerEta} min
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Admin-controlled Guest WiFi Strip */}
              <div className="guest-wifi-strip" aria-label="Free Guest WiFi">
                <div className="guest-wifi-strip-info">
                  <span className="guest-wifi-strip-icon" aria-hidden="true">
                    <Wifi size={18} strokeWidth={2.3} />
                  </span>
                  <div className="guest-wifi-strip-text">
                    <span className="guest-wifi-strip-ssid">{state.wifi.name}</span>
                    <span className="guest-wifi-strip-pass">
                      {state.wifi.password ? `Pass: ${state.wifi.password}` : 'Open WiFi (No Password)'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="guest-wifi-copy-btn"
                  onClick={handleCopyWifiPass}
                >
                  {copiedWifi ? (
                    <>
                      <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} strokeWidth={2.3} aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Active Order Banner (visible even while browsing Menu!) */}
              {myActiveOrders.length > 0 && (() => {
                const latest = myActiveOrders[0];
                const liveInfo = getOrderProgressInfo(
                  latest,
                  state.menu,
                  now,
                  waiterOf(state, latest.table ?? table)
                );
                return (
                  <motion.button
                    type="button"
                    className={`guest-live-banner is-${latest.status}`}
                    onClick={() => setTab('order')}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    transition={SPRING}
                  >
                    <div className="guest-live-banner-left">
                      <span className="guest-live-badge">{liveInfo.badgeText}</span>
                      <span className="guest-live-msg">
                        {latest.status === 'ready'
                          ? `Order #${shortId(latest.id)} ready hai! Waiter la raha hai`
                          : latest.status === 'served'
                          ? `Order #${shortId(latest.id)} serve ho gaya · Enjoy!`
                          : latest.status === 'cooking'
                          ? `Ban raha hai · ${liveInfo.remainingMin > 0 ? `~${liveInfo.remainingMin} min baaki` : 'bas ready hone wala hai'}`
                          : `Order #${shortId(latest.id)} · Approx ~${liveInfo.estMin} min lagenge`}
                      </span>
                    </div>
                    <span className="guest-live-cta">
                      Track <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                  </motion.button>
                );
              })()}

              {/* Admin-Customizable Social Promo Offers Strip */}
              {activePromos.length > 0 && (
                <div className="guest-promo-rail" aria-label="Special discount offers">
                  {activePromos.map((p) => (
                    <motion.button
                      key={p.id}
                      type="button"
                      className={`guest-promo-pill ${selectedPromoId === p.id ? 'is-selected' : ''}`}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      transition={SPRING}
                      onClick={() => {
                        setSelectedPromoId(p.id);
                        if (myBillTotal > 0) {
                          setTab('bill');
                          showSakugaToast(`${p.title} select ho gaya!`, 'gold', 'OFFER!');
                        } else {
                          showSakugaToast(
                            `${p.title} (${formatPromoBadge(p)}) — Order ke baad Bill par apply hoga!`,
                            'gold',
                            'OFFER!'
                          );
                        }
                      }}
                    >
                      <span className="guest-promo-pill-badge">
                        <PromoPlatformIcon platform={p.platform} size={13} />
                        <span>{formatPromoBadge(p)}</span>
                      </span>
                      <span className="guest-promo-pill-title">{p.title}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              <div className="search-wrap">
                <Search size={16} strokeWidth={2.2} className="search-leading-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Chai, momos, samosa, maggi search karo…"
                  aria-label="Dish search karo"
                />
                {search && (
                  <button
                    type="button"
                    className="search-clear"
                    aria-label="Search clear karo"
                    onClick={() => setSearch('')}
                  >
                    <X size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                )}
              </div>

              {!search.trim() && categories.length > 0 && (
                <div className="cat-bar" role="tablist" aria-label="Menu categories">
                  {['ALL', ...categories].map((cat) => {
                    const isAct = cat === activeCat;
                    const label = cat === 'ALL' ? 'Sabhi' : cat;
                    const count = catCounts[cat] ?? 0;
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={isAct}
                        className={`cat-pill ${isAct ? 'active' : ''}`}
                        onClick={() => setActiveCat(cat)}
                      >
                        {isAct && (
                          <motion.span
                            layoutId="catbg"
                            className="cat-pill-bg"
                            transition={SPRING}
                          />
                        )}
                        <span className="cat-pill-label tabular-nums">
                          {label} ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="taste-filter-bar" role="group" aria-label="Quick taste and prep filter">
                {(
                  [
                    { id: 'all', label: 'All', Icon: Sparkles },
                    { id: 'fast', label: 'Fast (≤4m)', Icon: Zap },
                    { id: 'mild', label: 'Mild', Icon: Leaf },
                    { id: 'spicy', label: 'Teekha', Icon: Flame },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <motion.button
                    key={id}
                    type="button"
                    aria-pressed={tasteFilter === id}
                    className={`taste-chip ${tasteFilter === id ? 'on' : ''}`}
                    whileTap={{ scale: 0.94 }}
                    transition={SPRING}
                    onClick={() => setTasteFilter(id)}
                  >
                    <Icon size={13} strokeWidth={2.3} aria-hidden="true" />
                    <span>{label}</span>
                  </motion.button>
                ))}
              </div>

              <motion.div layout className="menu-list">
                <AnimatePresence mode="popLayout">
                  {filteredMenu.length === 0 ? (
                    <motion.div
                      key="empty-search"
                      className="g-card empty-card"
                      style={{ gridColumn: '1 / -1' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <span className="empty-icon-circle" aria-hidden="true">
                        <Search size={24} strokeWidth={2.2} />
                      </span>
                      <p>Is filter mein koi dish nahi mili. Filter clear karke dekho!</p>
                      {(search || tasteFilter !== 'all' || activeCat !== 'ALL') && (
                        <button
                          type="button"
                          className="chip"
                          onClick={() => {
                            setSearch('');
                            setTasteFilter('all');
                            setActiveCat('ALL');
                          }}
                        >
                          Sabhi dishes dikhao
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    filteredMenu.map((item, index) => {
                      const qty = getQty(item.id);
                      const spice = spiceDots(item.spice);
                      return (
                        <motion.article
                          key={item.id}
                          layout
                          className="menu-card"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.94 }}
                          transition={{
                            duration: 0.22,
                            delay: Math.min(index, 5) * 0.04,
                          }}
                        >
                          <button
                            type="button"
                            className="menu-card-main"
                            onClick={() => setDetailItem(item)}
                            aria-label={`${item.name} details dekho`}
                          >
                            <DishThumb
                              img={item.img}
                              emoji={item.emoji}
                              alt={item.name}
                              className="menu-thumb"
                            />
                            <div className="menu-info">
                              <div className="menu-name">{item.name}</div>
                              <div className="menu-desc">{item.desc}</div>
                              <div className="menu-meta">
                                <span className="menu-price">{fmt(item.price)}</span>
                                {spice && <span>· {spice}</span>}
                                <span>· ~{item.prep} min</span>
                              </div>
                            </div>
                          </button>

                          <div className="menu-action">
                            <AnimatePresence mode="popLayout" initial={false}>
                              {qty === 0 ? (
                                <motion.button
                                  key="add-btn"
                                  type="button"
                                  className="add-outline-btn"
                                  aria-label={`Add ${item.name}`}
                                  initial={{ scale: 0.85, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.85, opacity: 0 }}
                                  transition={SPRING}
                                  whileTap={{ scale: 0.93 }}
                                  onClick={() => setItemQty(item.id, 1)}
                                >
                                  Add
                                </motion.button>
                              ) : (
                                <motion.div
                                  key="qty-stepper"
                                  className="stepper"
                                  aria-label={`${item.name} quantity`}
                                  initial={{ scale: 0.85, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.85, opacity: 0 }}
                                  transition={SPRING}
                                >
                                  <button
                                    type="button"
                                    className="stepper-btn"
                                    aria-label={`Remove one ${item.name}`}
                                    onClick={() => setItemQty(item.id, qty - 1)}
                                  >
                                    −
                                  </button>
                                  <motion.span
                                    key={qty}
                                    className="stepper-qty"
                                    initial={{ scale: 1.4 }}
                                    animate={{ scale: 1 }}
                                    transition={SPRING}
                                  >
                                    {qty}
                                  </motion.span>
                                  <button
                                    type="button"
                                    className="stepper-btn"
                                    aria-label={`Add one more ${item.name}`}
                                    onClick={() => setItemQty(item.id, qty + 1)}
                                  >
                                    +
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.article>
                      );
                    })
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}

          {/* ============ MERA ORDER TAB ============ */}
          {tab === 'order' && (
            <motion.div
              key="tab-order"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {/* Pending Cart items right inside Mera order so selected dishes always show */}
              <AnimatePresence>
                {cart.length > 0 && (
                  <motion.section
                    key="pending-cart-card"
                    className="g-card pending-cart-card"
                    aria-label="Pending cart items"
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.96 }}
                    transition={SPRING}
                  >
                    <div className="tracker-head">
                      <span className="order-stage-pill" style={{ background: '#fef08a' }}>
                        <ShoppingBag size={13} strokeWidth={2.4} aria-hidden="true" />
                        <span>Cart Mein ({cartQty} items)</span>
                      </span>
                      <span className="tag-pill tag-warm">{fmt(cartTotal)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--mute)', marginTop: 4 }}>
                      Ye items abhi kitchen mein bheje nahi gaye hain · Est. prep ~{cartEta} min
                    </p>
                    <div className="order-line-list" style={{ marginTop: 10 }}>
                      {cart.map((l, idx) => {
                        const item = byId(l.itemId, state.menu);
                        return (
                          <div key={`${l.itemId}-${idx}`} className="order-line-row">
                            <span className="dish-inline-label">
                              <DishThumb
                                img={item.img}
                                emoji={item.emoji}
                                alt={item.name}
                                className="order-thumb"
                                size={30}
                                decorative
                              />
                              <span>
                                {l.qty}× {item.name}
                                {l.deal ? ' (Deal)' : ''}
                              </span>
                            </span>
                            <strong>{fmt(linePrice(l, state.menu))}</strong>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <motion.button
                        type="button"
                        className="btn big"
                        style={{ flex: 1 }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING}
                        onClick={handlePlaceOrder}
                      >
                        <Send size={16} strokeWidth={2.3} aria-hidden="true" />
                        <span>Order bhejo · {fmt(cartTotal)}</span>
                      </motion.button>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {myActiveOrders.length === 0 && cart.length === 0 ? (
                <div className="g-card empty-card">
                  <span className="empty-icon-circle" aria-hidden="true">
                    <UtensilsCrossed size={24} strokeWidth={2.2} />
                  </span>
                  <p>Abhi koi active order nahi hai. Menu se apni pasand ki dish chuno!</p>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setTab('menu')}
                  >
                    Menu dekho
                  </button>
                </div>
              ) : (
                myActiveOrders.map((order) => {
                  const orderTable = order.table ?? table;
                  const waiterName = waiterOf(state, orderTable);
                  const info = getOrderProgressInfo(order, state.menu, now, waiterName);
                  const fill = orderFillPct(order, now, state.menu);
                  const stepIdx = STEP_ORDER.indexOf(order.status);
                  const isDone = order.status === 'ready' || order.status === 'served';

                  return (
                    <motion.section
                      key={order.id}
                      className={`g-card tracker-card is-${order.status}`}
                      initial={{ opacity: 0, scale: 0.95, y: 14 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={SPRING}
                    >
                      <div className="tracker-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className={`order-stage-pill is-${order.status}`}>
                            {info.badgeText}
                          </span>
                          <span className="tracker-id">Order #{shortId(order.id)}</span>
                        </div>
                        <span className="tag-pill tag-warm">
                          {fmt(orderTotal(order, state.menu))}
                        </span>
                      </div>

                      <h2 className="tracker-headline">{info.headline}</h2>

                      {/* Live status announcement callout */}
                      <div className={`order-status-callout is-${order.status}`} role="status">
                        {info.detailMessage}
                      </div>

                      <div className="tracker-glass-wrap">
                        <ChaiGlass fill={fill} done={isDone} />

                        {(order.status === 'new' || order.status === 'cooking') && (
                          <div className="order-eta-box">
                            <div className="tracker-countdown">{fmtMMSS(info.remainingSec)}</div>
                            <div className="tracker-countdown-label">
                              {info.remainingSec > 0
                                ? `~${info.remainingMin} min baaki (Total est. ${info.estMin} min)`
                                : 'Bas kuch hi pal mein ready hone wala hai!'}
                            </div>
                            <div className="order-eta-subrow">
                              <span className="dish-inline-label">
                                <Clock size={12} strokeWidth={2.2} aria-hidden="true" />
                                Order diya: <strong>{fmtClockTime(order.createdAt)}</strong>
                              </span>
                              <span className="dish-inline-label">
                                <Target size={12} strokeWidth={2.2} aria-hidden="true" />
                                Ready by: <strong>~{fmtClockTime(info.readyEtaAt)}</strong>
                              </span>
                            </div>
                            {order.status === 'cooking' && order.cookingAt && (
                              <div className="order-cooking-live">
                                <span className="live-dot" aria-hidden="true" />
                                Kitchen mein ban raha hai · {fmtMMSS(info.cookingElapsedSec)} se
                              </div>
                            )}
                          </div>
                        )}

                        {order.status === 'ready' && (
                          <div className="order-ready-alert">
                            <strong className="dish-inline-label">
                              <Sparkles size={15} strokeWidth={2.3} aria-hidden="true" />
                              <span>Aapka order ban kar taiyaar hai!</span>
                            </strong>
                            <span>
                              Waiter <strong>{waiterName}</strong> abhi Table {orderTable} par serve karne aa rahe hain
                              {order.readyAt ? ` · Ready at ${fmtClockTime(order.readyAt)}` : ''}
                            </span>
                          </div>
                        )}

                        {order.status === 'served' && (
                          <div className="order-served-alert">
                            <strong className="dish-inline-label">
                              <CheckCircle2 size={15} strokeWidth={2.3} aria-hidden="true" />
                              <span>Serve ho gaya!</span>
                            </strong>
                            <span>
                              {order.servedAt ? `Served at ${fmtClockTime(order.servedAt)}` : 'Enjoy your meal!'}
                              {info.totalDurationSec !== null
                                ? ` · Total time: ${Math.max(1, Math.round(info.totalDurationSec / 60))} min`
                                : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Animated 4-segment progress bar */}
                      <div className="step-bar" aria-label={`Order status ${order.status}`}>
                        {STEP_ORDER.map((st, idx) => {
                          const isCurrent = idx === stepIdx;
                          const isPast = idx < stepIdx;
                          return (
                            <motion.div
                              key={st}
                              className={`step-seg ${isCurrent ? 'current' : isPast ? 'done' : ''}`}
                              animate={{ scaleY: isCurrent ? 1.6 : 1 }}
                              transition={SPRING}
                            />
                          );
                        })}
                      </div>

                      {/* Detailed 4-Step Timeline with live timestamps */}
                      <div className="order-timeline" aria-label="Order live timeline">
                        {info.steps.map((st) => (
                          <div key={st.key} className={`order-tl-step is-${st.state}`}>
                            <span className="order-tl-dot" aria-hidden="true">
                              {st.state === 'done' ? '✓' : st.state === 'current' ? '●' : ''}
                            </span>
                            <div className="order-tl-body">
                              <div className="order-tl-label">{st.label}</div>
                              <div className="order-tl-sub">
                                {st.at ? fmtClockTime(st.at) : st.sub}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Full Order Info Grid */}
                      <div className="order-info-grid">
                        <div className="order-info-cell">
                          <span className="order-info-k dish-inline-label">
                            <Armchair size={12} strokeWidth={2.3} aria-hidden="true" /> Table &amp; Waiter
                          </span>
                          <span className="order-info-v">Table {orderTable} · {waiterName}</span>
                        </div>
                        <div className="order-info-cell">
                          <span className="order-info-k dish-inline-label">
                            <User size={12} strokeWidth={2.3} aria-hidden="true" /> Customer
                          </span>
                          <span className="order-info-v">
                            {order.customer || guestProfile.name}
                            {(order.customerPhone || guestProfile.phone)
                              ? ` · ${order.customerPhone || guestProfile.phone}`
                              : ''}
                          </span>
                        </div>
                        <div className="order-info-cell">
                          <span className="order-info-k dish-inline-label">
                            <Clock size={12} strokeWidth={2.3} aria-hidden="true" /> Est. Prep Time
                          </span>
                          <span className="order-info-v">~{info.estMin} min ({info.itemCount} items)</span>
                        </div>
                        <div className="order-info-cell">
                          <span className="order-info-k dish-inline-label">
                            <Flame size={12} strokeWidth={2.3} aria-hidden="true" /> Kitchen Station
                          </span>
                          <span className="order-info-v">
                            {info.stations.length > 0 ? info.stations.join(' · ') : 'Main Kitchen'}
                          </span>
                        </div>
                      </div>

                      {/* Itemized Dish Breakdown with per-item prep times */}
                      <div className="order-line-list">
                        {order.lines.map((l, idx) => {
                          const item = byId(l.itemId, state.menu);
                          return (
                            <div key={`${l.itemId}-${idx}`} className="order-line-row">
                              <div className="dish-inline-label" style={{ gap: 10 }}>
                                <DishThumb
                                  img={item.img}
                                  emoji={item.emoji}
                                  alt={item.name}
                                  className="order-thumb"
                                  size={34}
                                  decorative
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontWeight: 700 }}>
                                    {l.qty}× {item.name}
                                    {l.deal ? ' (Deal)' : ''}
                                  </span>
                                  <span style={{ fontSize: 11.5, color: 'var(--mute)' }}>
                                    {item.section} · ~{item.prep} min prep
                                  </span>
                                </div>
                              </div>
                              <strong>{fmt(linePrice(l, state.menu))}</strong>
                            </div>
                          );
                        })}
                        <div className="order-line-row order-line-total">
                          <span>Total ({info.itemCount} items)</span>
                          <strong>{fmt(orderTotal(order, state.menu))}</strong>
                        </div>
                      </div>
                    </motion.section>
                  );
                })
              )}

              {/* Recent Paid Orders so completed orders stay visible in Mera order */}
              {myPastOrders.length > 0 && (
                <section className="g-card" aria-label="Paid orders history">
                  <div className="tracker-head" style={{ marginBottom: 8 }}>
                    <h3 className="icon-heading" style={{ fontSize: 17 }}>
                      <CheckCircle2 size={17} strokeWidth={2.3} color="var(--green)" aria-hidden="true" />
                      <span>Pichhle / Paid Orders ({myPastOrders.length})</span>
                    </h3>
                    {lastPaid && (
                      <button
                        type="button"
                        className="guest-wifi-copy-btn"
                        onClick={() => setTab('bill')}
                      >
                        <Receipt size={13} strokeWidth={2.2} aria-hidden="true" />
                        <span>Receipt dekho</span>
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {myPastOrders.map((po) => (
                      <div key={po.id} className="past-order-item">
                        <div className="past-order-top">
                          <span>
                            <strong>Order #{shortId(po.id)}</strong>
                            {po.table ? ` · Table ${po.table}` : ''}
                            {' · '}
                            {fmtClockTime(po.paidAt ?? po.createdAt)}
                          </span>
                          <span className="tag-pill tag-green">
                            <Check size={12} strokeWidth={2.6} aria-hidden="true" /> Paid{po.method ? ` (${po.method})` : ''} · {fmt(orderTotal(po, state.menu))}
                          </span>
                        </div>
                        <div className="past-order-lines">
                          {po.lines
                            .map((l) => `${l.qty}× ${byId(l.itemId, state.menu).name}`)
                            .join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Dynamic Admin-controlled WiFi Card */}
              <section className="g-card wifi-card" aria-label="Guest WiFi">
                <div style={{ minWidth: 0 }}>
                  <h3 className="icon-heading" style={{ fontSize: 17 }}>
                    <Wifi size={17} strokeWidth={2.3} color="var(--navy)" aria-hidden="true" />
                    <span>Free WiFi</span>
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--mute)' }}>
                    Khana aate-aate mast WiFi connect karo
                  </p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div className="wifi-creds">{state.wifi.name}</div>
                  <div className="wifi-creds" style={{ color: 'var(--brown)' }}>
                    {state.wifi.password ? `Pass: ${state.wifi.password}` : 'Open (No Password)'}
                  </div>
                  <button
                    type="button"
                    className="guest-wifi-copy-btn"
                    onClick={handleCopyWifiPass}
                  >
                    {copiedWifi ? (
                      <>
                        <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} strokeWidth={2.3} aria-hidden="true" />
                        <span>Copy Password</span>
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* Kuch chahiye? Waiter Call */}
              <section className="g-card" aria-labelledby="need-help-heading">
                <h3 id="need-help-heading" style={{ fontSize: 19 }}>
                  Kuch chahiye?
                </h3>
                <p style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>
                  {waiterOf(state, table)} aapki table par aayenge
                </p>

                <div className="call-btn-wrap">
                  <span className="call-btn-ring" aria-hidden="true" />
                  <button
                    type="button"
                    className="btn big"
                    onClick={() => callWaiter(table, 'Waiter')}
                  >
                    <Bell size={17} strokeWidth={2.3} aria-hidden="true" />
                    <span>Waiter ko bulao</span>
                  </button>
                </div>

                <div className="chip-row">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => callWaiter(table, 'Pani')}
                  >
                    <Droplets size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>Pani</span>
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => callWaiter(table, 'Napkin')}
                  >
                    <Layers size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>Napkin</span>
                  </button>
                </div>

                {openCalls.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <span className="tag-pill tag-green">
                      <Check size={12} strokeWidth={2.6} aria-hidden="true" /> Waiter aa raha hu ({openCalls.map((c) => c.kind).join(', ')})
                    </span>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {/* ============ BILL TAB ============ */}
          {tab === 'bill' && (
            <motion.div
              key="tab-bill"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {myOrders.length > 0 ? (
                <section className="g-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <h2 style={{ fontSize: 22 }}>Table {table} ka bill</h2>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => callWaiter(table, 'Bill')}
                    >
                      <Receipt size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>Waiter ko bulao</span>
                    </button>
                  </div>

                  {state.billReq[table] && (
                    <div style={{ marginBottom: 10 }}>
                      <span className="tag-pill tag-green">
                        <Check size={12} strokeWidth={2.6} aria-hidden="true" /> Waiter ko bill ke liye bol diya gaya hai
                      </span>
                    </div>
                  )}

                  {myOrders.map((order) => (
                    <div key={order.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 700 }}>
                        Order #{shortId(order.id)}
                      </div>
                      {order.lines.map((l, idx) => (
                        <div key={`${l.itemId}-${idx}`} className="bill-row">
                          <span>
                            {l.qty}× {byId(l.itemId, state.menu).name}
                            {l.deal ? ' (Deal)' : ''}
                          </span>
                          <strong>{fmt(linePrice(l, state.menu))}</strong>
                        </div>
                      ))}
                    </div>
                  ))}

                  <div className="bill-row total">
                    <span>Subtotal</span>
                    <span>{fmt(myBillTotal)}</span>
                  </div>

                  {/* Admin-Customizable Promote & Get Discount Offers */}
                  {activePromos.length > 0 && (
                    <div className="bill-promo-box" aria-label="Promotion discount offers">
                      <div className="bill-promo-head">
                        <span className="dish-inline-label">
                          <Gift size={15} strokeWidth={2.3} aria-hidden="true" />
                          <span>Promote Karo &amp; Discount Pao</span>
                        </span>
                        {appliedDiscount > 0 && (
                          <span className="bill-promo-saved">-{fmt(appliedDiscount)} saved!</span>
                        )}
                      </div>
                      <div className="bill-promo-list">
                        {activePromos.map((p) => {
                          const calc = computePromoDiscount(myBillTotal, p);
                          const isApplied = selectedPromoId === p.id && calc.eligible;
                          const href = promoActionHref(p);
                          return (
                            <div
                              key={p.id}
                              className={`bill-promo-item ${isApplied ? 'is-applied' : ''}`}
                            >
                              <div className="bill-promo-item-top">
                                <span className="bill-promo-tag">
                                  <PromoPlatformIcon platform={p.platform} size={13} />
                                  <span>{formatPromoBadge(p)}</span>
                                </span>
                                <strong className="bill-promo-title">{p.title}</strong>
                              </div>
                              <p className="bill-promo-desc">{p.description}</p>
                              {!calc.eligible && calc.reason && (
                                <div className="bill-promo-min">{calc.reason}</div>
                              )}
                              <div className="bill-promo-actions">
                                {href && (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bill-promo-link"
                                  >
                                    <span>{PROMO_CTA[p.platform]}</span>
                                    <ExternalLink size={12} strokeWidth={2.3} aria-hidden="true" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  disabled={!calc.eligible || paidParts > 0}
                                  className={`bill-promo-apply ${isApplied ? 'is-applied' : ''}`}
                                  onClick={() => {
                                    if (isApplied) {
                                      setSelectedPromoId(null);
                                    } else {
                                      setSelectedPromoId(p.id);
                                      showSakugaToast(
                                        `${formatPromoBadge(p)} (-${fmt(calc.discount)}) apply ho gaya!`,
                                        'green',
                                        'SAVED!'
                                      );
                                    }
                                  }}
                                >
                                  {isApplied ? (
                                    <>
                                      <Check size={12} strokeWidth={2.6} aria-hidden="true" />
                                      <span>Applied (-{fmt(calc.discount)})</span>
                                    </>
                                  ) : calc.eligible ? (
                                    `Apply (-${fmt(calc.discount)})`
                                  ) : (
                                    `Min ${fmt(p.minBill)}`
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <span className="field-label">
                    Bill split karo {paidParts > 0 ? `(${paidParts}/${splitParts} paid)` : ''}
                  </span>
                  <div className="chip-row" role="group" aria-label="Split bill">
                    {[1, 2, 3].map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={paidParts > 0}
                        className={`chip ${splitParts === p ? 'on' : ''}`}
                        onClick={() => setSplitParts(p)}
                      >
                        {p === 1 ? '1 (Full)' : `${p} ways`}
                      </button>
                    ))}
                  </div>

                  <span className="field-label">Tip ({tipPct}%)</span>
                  <div className="chip-row" role="group" aria-label="Tip percentage">
                    {[0, 5, 10, 15].map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        className={`chip ${tipPct === tp ? 'on' : ''}`}
                        onClick={() => setTipPct(tp)}
                      >
                        {tp}%
                      </button>
                    ))}
                  </div>

                  <span className="field-label">Payment method</span>
                  <div className="chip-row" role="group" aria-label="Payment method">
                    {PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        className={`chip ${method === pm ? 'on' : ''}`}
                        onClick={() => setMethod(pm)}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 10,
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    {appliedDiscount > 0 && selectedPromo && (
                      <div className="bill-row" style={{ color: 'var(--green)', fontWeight: 700 }}>
                        <span className="dish-inline-label">
                          <Gift size={14} strokeWidth={2.2} aria-hidden="true" />
                          <span>Promo ({selectedPromo.title})</span>
                        </span>
                        <span>-{fmt(appliedDiscount)}</span>
                      </div>
                    )}
                    <div className="bill-row">
                      <span>Tip ({tipPct}%)</span>
                      <span>{fmt(splitCalc.tip)}</span>
                    </div>
                    <div className="bill-row">
                      <span>Total + Tip</span>
                      <strong>{fmt(splitCalc.grand)}</strong>
                    </div>
                    {splitParts > 1 && (
                      <div className="bill-row">
                        <span>Per person ({splitParts} ways)</span>
                        <strong>{fmt(splitCalc.share)}</strong>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn big"
                    style={{ marginTop: 12 }}
                    onClick={handlePayShare}
                  >
                    Pay {fmt(splitCalc.share)}
                  </button>
                </section>
              ) : lastPaid ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ReceiptPrinter
                    receipt={lastPaid}
                    table={table}
                    guestName={guestProfile.name}
                    guestPhone={guestProfile.phone}
                  />

                  <section className="g-card" style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        textAlign: 'left',
                      }}
                    >
                      <label htmlFor="receipt-email" className="field-label" style={{ marginTop: 0 }}>
                        Email receipt (optional)
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          id="receipt-email"
                          type="email"
                          className="text-input"
                          placeholder="aapka@email.com"
                          value={receiptEmail}
                          onChange={(e) => setReceiptEmail(e.target.value)}
                        />
                        <button
                          type="button"
                          className="chip on"
                          onClick={() => {
                            if (receiptEmail.trim()) {
                              setReceiptSentTo(receiptEmail.trim());
                            }
                          }}
                        >
                          Bhejo
                        </button>
                      </div>
                      {receiptSentTo && (
                        <p
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--green)',
                          }}
                        >
                          Receipt {receiptSentTo} par bhej di gayi.
                        </p>
                      )}
                    </div>

                    {/* Star rating + review */}
                    <div
                      style={{
                        marginTop: 18,
                        paddingTop: 14,
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      {reviewSentAt === lastPaid.at ? (
                        <div style={{ padding: '12px 0' }}>
                          <h3 style={{ fontSize: 21, color: 'var(--green)' }}>
                            Shukriya! Phir aana 🙏
                          </h3>
                        </div>
                      ) : (
                        <form onSubmit={handleSendReview}>
                          <h3 style={{ fontSize: 19 }}>Khana kaisa laga?</h3>
                          <SakugaRating value={stars} onChange={setStars} />
                          <textarea
                            className="text-area"
                            rows={2}
                            placeholder="Kuch kehna chahoge? (optional)"
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                          />
                          <button
                            type="submit"
                            className="btn big"
                            style={{ marginTop: 10 }}
                          >
                            Review bhejo
                          </button>
                        </form>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <section className="g-card empty-card">
                  <span className="empty-icon-circle" aria-hidden="true">
                    <Receipt size={24} strokeWidth={2.2} />
                  </span>
                  <p>Bill khaali hai. Order karne ke baad yahan bill dikhega.</p>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => callWaiter(table, 'Bill')}
                  >
                    <Receipt size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>Waiter ko bulao</span>
                  </button>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="guest-dev-footer" aria-label="Contact Developer">
          <DeveloperContactButton compact />
        </footer>
      </main>

      {/* Fixed bottom bar: Cart Bar + 3-Tab Nav */}
      <div className="guest-bottom">
        <AnimatePresence>
          {cartQty > 0 && (
            <motion.button
              type="button"
              className="cart-bar"
              initial={{ y: 70, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 70, opacity: 0 }}
              transition={SPRING}
              onClick={() => setCartOpen(true)}
            >
              <span className="cart-bar-left">
                <motion.span
                  key={cartQty}
                  className="cart-qty-badge"
                  initial={{ scale: 1.38 }}
                  animate={{ scale: 1 }}
                  transition={SPRING}
                >
                  {cartQty}
                </motion.span>
                <span>Order dekho</span>
              </span>
              <span className="cart-bar-total">{fmt(cartTotal)}</span>
            </motion.button>
          )}
        </AnimatePresence>

        <nav className="bottom-nav" aria-label="Guest navigation">
          {(
            [
              { key: 'menu' as const, Icon: UtensilsCrossed, label: 'Menu', badge: 0 },
              {
                key: 'order' as const,
                Icon: Clock,
                label: 'Mera order',
                badge: myActiveOrders.length > 0 ? myActiveOrders.length : cartQty,
              },
              { key: 'bill' as const, Icon: Receipt, label: 'Bill', badge: 0 },
            ] as const
          ).map(({ key, Icon, label, badge }) => {
            const isAct = tab === key;
            return (
              <button
                key={key}
                type="button"
                className={`bottom-tab ${isAct ? 'active' : ''}`}
                aria-current={isAct ? 'page' : undefined}
                onClick={() => setTab(key)}
              >
                <span className="bottom-tab-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <span>{label}</span>
                {badge > 0 && <span className="tab-badge">{badge}</span>}
                {isAct && (
                  <motion.span
                    layoutId="tabdot"
                    className="tab-dot"
                    transition={SPRING}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Item Detail Sheet */}
      <AnimatePresence>
        {detailItem && (
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetailItem(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={detailItem.name}
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="sheet-head">
                <h2>{detailItem.name}</h2>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="Band karo"
                  onClick={() => setDetailItem(null)}
                >
                  <X size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <motion.div
                className="item-sheet-hero"
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING}
              >
                <DishThumb
                  img={detailItem.img}
                  emoji={detailItem.emoji}
                  alt={detailItem.name}
                  className="item-sheet-thumb"
                />
              </motion.div>

              <p style={{ color: 'var(--mute)', fontSize: 14.5 }}>{detailItem.desc}</p>

              <div className="item-sheet-tags">
                <span className="tag-pill tag-warm">
                  <Clock size={12} strokeWidth={2.4} aria-hidden="true" /> Banne mein ~{detailItem.prep} min
                </span>
                <span className="tag-pill tag-warm">
                  Teekha: {detailItem.spice > 0 ? spiceDots(detailItem.spice) : 'Mild'}
                </span>
                {detailItem.allergens.length > 0 ? (
                  detailItem.allergens.map((a) => (
                    <span key={a} className="tag-pill tag-red">
                      Allergen: {a}
                    </span>
                  ))
                ) : (
                  <span className="tag-pill tag-green">Allergens: Koi nahi</span>
                )}
              </div>

              {(() => {
                const qty = getQty(detailItem.id);
                return (
                  <div className="sheet-footer-row">
                    <div className="stepper" aria-label="Quantity">
                      <button
                        type="button"
                        className="stepper-btn"
                        aria-label="Kam karo"
                        onClick={() => setItemQty(detailItem.id, Math.max(0, qty - 1))}
                      >
                        <Minus size={14} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      <motion.span
                        key={qty}
                        className="stepper-qty"
                        initial={{ scale: 1.4 }}
                        animate={{ scale: 1 }}
                        transition={SPRING}
                      >
                        {qty}
                      </motion.span>
                      <button
                        type="button"
                        className="stepper-btn"
                        aria-label="Badhao"
                        onClick={() => setItemQty(detailItem.id, qty + 1)}
                      >
                        <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn big"
                      onClick={() => {
                        if (qty === 0) setItemQty(detailItem.id, 1);
                        setDetailItem(null);
                      }}
                    >
                      {qty === 0
                        ? `Add · ${fmt(detailItem.price)}`
                        : `Done · ${fmt(detailItem.price * qty)}`}
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Sheet */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Aapka order"
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="sheet-head">
                <h2 className="icon-heading">
                  <ShoppingBag size={20} strokeWidth={2.3} aria-hidden="true" />
                  <span>Aapka order</span>
                </h2>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="Cart band karo"
                  onClick={() => setCartOpen(false)}
                >
                  <X size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p style={{ color: 'var(--mute)', padding: '16px 0' }}>Cart khaali hai.</p>
              ) : (
                <>
                  <div className="cart-lines">
                    {cart.map((line, idx) => {
                      const item = byId(line.itemId, state.menu);
                      return (
                        <div key={`${line.itemId}-${line.deal ? 'd' : 'r'}-${idx}`} className="cart-line">
                          <div className="dish-inline-label" style={{ minWidth: 0, flex: 1, gap: 10 }}>
                            <DishThumb
                              img={item.img}
                              emoji={item.emoji}
                              alt={item.name}
                              className="cart-thumb"
                              size={40}
                              decorative
                            />
                            <div style={{ minWidth: 0 }}>
                              <div className="cart-line-name">
                                {item.name}
                                {line.deal ? ' (Deal)' : ''}
                              </div>
                              <div className="cart-line-sub tabular-nums">
                                {fmt(linePrice(line, state.menu))} · ~{item.prep}m prep
                              </div>
                            </div>
                          </div>
                          <div className="cart-line-controls">
                            <div className="stepper" aria-label={`${item.name} quantity`}>
                              <button
                                type="button"
                                className="stepper-btn"
                                aria-label={`Remove one ${item.name}`}
                                onClick={() => updateCartIndexQty(idx, -1)}
                              >
                                <Minus size={13} strokeWidth={2.5} aria-hidden="true" />
                              </button>
                              <span className="stepper-qty tabular-nums">{line.qty}</span>
                              <button
                                type="button"
                                className="stepper-btn"
                                aria-label={`Add one more ${item.name}`}
                                onClick={() => updateCartIndexQty(idx, 1)}
                              >
                                <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="cart-remove-btn"
                              aria-label={`Remove ${item.name}`}
                              onClick={() => removeCartIndex(idx)}
                            >
                              <X size={13} strokeWidth={2.4} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {showDeal && (
                    <div className="deal-upsell">
                      <span className="dish-inline-label">
                        <Sparkles size={15} strokeWidth={2.3} color="var(--gold)" aria-hidden="true" />
                        <span>Saath mein Masala Chai sirf {fmt(DEAL_PRICE)} mein?</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={addDealChai}
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <div className="cart-summary">
                    <span style={{ fontWeight: 700, fontSize: 16 }}>Total ({cartQty} items)</span>
                    <strong className="tabular-nums" style={{ fontFamily: 'var(--f-d)', fontSize: 22 }}>
                      {fmt(cartTotal)}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span className="cart-eta-note dish-inline-label" style={{ marginBottom: 0 }}>
                      <Clock size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>Aane mein ~{cartEta} min</span>
                    </span>
                    <button
                      type="button"
                      className="chip"
                      style={{ padding: '5px 11px', fontSize: 12 }}
                      onClick={() => setCart([])}
                    >
                      Clear cart
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn big"
                    onClick={handlePlaceOrder}
                  >
                    <Send size={16} strokeWidth={2.3} aria-hidden="true" />
                    <span>Order bhejo · {fmt(cartTotal)}</span>
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Waiter & Help Sheet (accessible from any Guest tab!) */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Quick Waiter Help"
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="sheet-head">
                <h2 className="icon-heading">
                  <Bell size={20} strokeWidth={2.3} aria-hidden="true" />
                  <span>Table {table} Help</span>
                </h2>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="Band karo"
                  onClick={() => setHelpOpen(false)}
                >
                  <X size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
              <p style={{ color: 'var(--mute)', fontSize: 13.5, marginBottom: 14 }}>
                {waiterOf(state, table)} aapki table par turant aayenge. Kya chahiye?
              </p>

              <div className="quick-help-grid">
                {(
                  [
                    { kind: 'Waiter', Icon: UserCheck, label: 'Waiter Bulao' },
                    { kind: 'Pani', Icon: Droplets, label: 'Pani Chahiye' },
                    { kind: 'Napkin', Icon: Layers, label: 'Napkin / Tissue' },
                    { kind: 'Bill', Icon: Receipt, label: 'Bill Le Aao' },
                  ] as const
                ).map(({ kind, Icon, label }, idx) => (
                  <motion.button
                    key={kind}
                    type="button"
                    className="quick-help-card"
                    initial={{ opacity: 0, y: 12, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...SPRING, delay: 0.04 + idx * 0.04 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      callWaiter(table, kind);
                      showSakugaToast(
                        `${waiterOf(state, table)} ko "${kind}" request bhej di gayi!`,
                        'green',
                        'SENT!'
                      );
                      setHelpOpen(false);
                    }}
                  >
                    <span className="quick-help-icon-badge" aria-hidden="true">
                      <Icon size={22} strokeWidth={2.2} />
                    </span>
                    <span>{label}</span>
                  </motion.button>
                ))}
              </div>

              {openCalls.length > 0 && (
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <span className="tag-pill tag-green">
                    <Check size={12} strokeWidth={2.6} aria-hidden="true" /> Active request: {openCalls.map((c) => c.kind).join(', ')}
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
