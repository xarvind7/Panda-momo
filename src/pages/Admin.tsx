import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Camera,
  Check,
  Coffee,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Flame,
  Gift,
  Home,
  Instagram,
  Lock,
  LogOut,
  Package,
  Pencil,
  Phone,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  UtensilsCrossed,
  Wifi,
} from 'lucide-react';
import { FoodQr, renderFoodQrStandeePng } from '../components/FoodQr';
import { buildTableQrUrl } from '../landingSummary';
import {
  agoMin,
  BRAND,
  byId,
  catsOf,
  fmt,
  formatPromoBadge,
  isLowStock,
  linePrice,
  orderEst,
  orderTotal,
  promoActionHref,
  SECTIONS,
  shortId,
  tableBill,
  tableStatus,
  type MenuItem,
  type Order,
  type PromoOffer,
  type PromoPlatform,
  type Section,
  type TableStatus,
} from '../data';
import {
  addStockItem,
  addTable,
  changeAdminPassword,
  checkAdminSession,
  clearOrdersAndCalls,
  deleteMenuItem,
  deletePromoOffer,
  deleteStockItem,
  deleteTable,
  hasStoredAdminSession,
  IS_REMOTE,
  isChimeEnabled,
  logoutAdmin,
  playChime,
  restockItem,
  saveMenuItem,
  savePromoOffer,
  setChimeEnabled,
  setOrderStatus,
  toggleMenuAvailable,
  togglePromoActive,
  triggerSupabaseSync,
  updateStockQty,
  updateWifi,
  useNow,
  useOrderChime,
  useStore,
  useSyncMeta,
  verifyAdminLogin,
} from '../store';
import { SUPABASE_SCHEMA_SQL } from '../supabaseSync';
import {
  ConfirmDialog,
  DeveloperContactButton,
  DishThumb,
  Logo,
  SakugaProgress,
  SakugaToggle,
  SPRING,
} from '../ui';
import { showSakugaToast } from '../sakuga';
import Nav from './Nav';
import CrmOverviewTab from '../components/CrmOverviewTab';
import CrmCustomersTab from '../components/CrmCustomersTab';

type AdminTab =
  | 'overview'
  | 'orders'
  | 'customers'
  | 'promos'
  | 'menu'
  | 'tables'
  | 'stock'
  | 'qr'
  | 'settings';
type StatusFilter = 'all' | Order['status'];

const PROMO_PLATFORM_META: Record<PromoPlatform, { label: string; placeholder: string }> = {
  instagram: {
    label: 'Instagram ID / Follow',
    placeholder: '@your_insta_id ya https://instagram.com/...',
  },
  reel: {
    label: 'Instagram Reel / Story',
    placeholder: '@your_insta_id ya reel link',
  },
  google: {
    label: 'Google Review',
    placeholder: 'https://g.page/r/.../review',
  },
  custom: {
    label: 'Custom Promotion',
    placeholder: 'Link, handle ya code (optional)',
  },
};

function renderPromoPlatformIcon(platform: PromoPlatform, size = 13) {
  switch (platform) {
    case 'instagram':
      return <Instagram size={size} strokeWidth={2.2} aria-hidden="true" />;
    case 'reel':
      return <Film size={size} strokeWidth={2.2} aria-hidden="true" />;
    case 'google':
      return <Star size={size} strokeWidth={2.2} aria-hidden="true" />;
    default:
      return <Gift size={size} strokeWidth={2.2} aria-hidden="true" />;
  }
}

interface PromoFormState {
  id?: string;
  title: string;
  platform: PromoPlatform;
  handleOrUrl: string;
  discountType: 'percent' | 'flat';
  discountValue: string;
  minBill: string;
  description: string;
  active: boolean;
}

function emptyPromoForm(): PromoFormState {
  return {
    title: '',
    platform: 'instagram',
    handleOrUrl: '',
    discountType: 'percent',
    discountValue: '10',
    minBill: '0',
    description: '',
    active: true,
  };
}

function promoToForm(p: PromoOffer): PromoFormState {
  return {
    id: p.id,
    title: p.title,
    platform: p.platform,
    handleOrUrl: p.handleOrUrl,
    discountType: p.discountType,
    discountValue: String(p.discountValue),
    minBill: String(p.minBill || 0),
    description: p.description,
    active: p.active,
  };
}

const TABLE_STATUS_WORD: Record<TableStatus, string> = {
  free: 'Free',
  ordering: 'Ordering',
  cooking: 'Cooking',
  eating: 'Eating',
  bill: 'Bill',
  help: 'HELP',
};

const NEW_CAT_VALUE = '__NEW_CATEGORY__';

interface MenuFormState {
  id?: string;
  name: string;
  price: string;
  prep: string;
  cat: string;
  newCat: string;
  section: Section;
  spice: 0 | 1 | 2 | 3;
  emoji: string;
  stock: string;
  use: string;
  desc: string;
  allergens: string;
  img?: string;
  available: boolean;
}

function emptyMenuForm(defaultCat: string): MenuFormState {
  return {
    name: '',
    price: '',
    prep: '5',
    cat: defaultCat || 'Chai',
    newCat: '',
    section: 'Chai counter',
    spice: 0,
    emoji: '🥟',
    stock: '',
    use: '0.1',
    desc: '',
    allergens: '',
    img: undefined,
    available: true,
  };
}

function menuToForm(m: MenuItem): MenuFormState {
  return {
    id: m.id,
    name: m.name,
    price: String(m.price),
    prep: String(m.prep),
    cat: m.cat,
    newCat: '',
    section: m.section,
    spice: m.spice,
    emoji: m.emoji,
    stock: m.stock,
    use: String(m.use || 0.1),
    desc: m.desc,
    allergens: m.allergens.join(', '),
    img: m.img,
    available: m.available,
  };
}

function resizePhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read error'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode error'));
      img.onload = () => {
        const maxDim = 640;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas error'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Admin() {
  const [authed, setAuthed] = useState<boolean>(() => hasStoredAdminSession());
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);

  useEffect(() => {
    if (!authed) return;
    let active = true;
    void checkAdminSession().then((valid) => {
      if (active && !valid) {
        setAuthed(false);
      }
    });
    return () => {
      active = false;
    };
  }, [authed]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loggingIn) return;
    setLoggingIn(true);
    const res = await verifyAdminLogin(pass);
    setLoggingIn(false);

    if (res.ok) {
      setLoginErr('');
      setPass('');
      setAuthed(true);
      playChime(true);
    } else {
      setLoginErr(res.error || 'Password galat hai. Dobara try karo.');
      setShakeCount((c) => c + 1);
    }
  }

  function handleLogout() {
    logoutAdmin();
    setAuthed(false);
  }

  if (!authed) {
    return (
      <div className="admin-login-screen">
        <div className="admin-login-card crm-login-card">
          <Logo size={72} />
          <span className="crm-eyebrow" style={{ marginTop: 4 }}>
            RESTAURANT CRM
          </span>
          <h1 style={{ fontSize: 28 }}>{BRAND} Admin</h1>
          <p className="dark-sub">
            Orders, menu, tables, inventory aur live operations control panel
          </p>
          <form className="admin-login-form" onSubmit={handleLogin}>
            <motion.div
              key={shakeCount}
              animate={shakeCount > 0 ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
              transition={{ duration: 0.4 }}
            >
              <label htmlFor="admin-pass-input" className="d-label">
                Admin Password
              </label>
              <div className="pass-input-wrap">
                <input
                  id="admin-pass-input"
                  type={showPass ? 'text' : 'password'}
                  className="d-input"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Password daalo"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="pass-eye-btn"
                  aria-label={showPass ? 'Password chhupao' : 'Password dikhao'}
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? (
                    <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" />
                  ) : (
                    <Eye size={17} strokeWidth={2.2} aria-hidden="true" />
                  )}
                </button>
              </div>
            </motion.div>
            {loginErr && (
              <div role="alert" className="admin-error">
                {loginErr}
              </div>
            )}
            <button type="submit" className="btn big" disabled={loggingIn}>
              {loggingIn ? (
                'Verifying…'
              ) : (
                <>
                  <Lock size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span>Unlock CRM</span>
                  <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="#/" className="dark-sub dish-inline-label" style={{ textDecoration: 'underline' }}>
              <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>Home par wapas</span>
            </a>
            <DeveloperContactButton dark compact />
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const state = useStore();
  const syncMeta = useSyncMeta();
  const now = useNow(15000);
  useOrderChime();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [orderView, setOrderView] = useState<'live' | 'all' | 'history'>('live');
  const [orderStatusFilter, setOrderStatusFilter] = useState<StatusFilter>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [pendingCustomerPhone, setPendingCustomerPhone] = useState<string | null>(null);
  const [pendingAddCustomer, setPendingAddCustomer] = useState<boolean>(false);

  // Menu search & category filter
  const categories = useMemo(() => catsOf(state.menu, false), [state.menu]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCatFilter, setMenuCatFilter] = useState<string>('ALL');
  const [form, setForm] = useState<MenuFormState>(() =>
    emptyMenuForm(categories[0] || 'Chai')
  );
  const [menuFormErr, setMenuFormErr] = useState('');
  const [menuSavedMsg, setMenuSavedMsg] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Tables add/delete form
  const sortedTables = useMemo(
    () => [...state.tables].sort((a, b) => a.num - b.num),
    [state.tables]
  );
  const nextSuggestedTableNum = useMemo(
    () => (sortedTables.length > 0 ? Math.max(...sortedTables.map((t) => t.num)) + 1 : 1),
    [sortedTables]
  );
  const [newTableNum, setNewTableNum] = useState<string>(() => String(nextSuggestedTableNum));
  const [newTableWaiter, setNewTableWaiter] = useState('Ali');
  const [tableErr, setTableErr] = useState('');

  // Stock add form
  const [newStockName, setNewStockName] = useState('');
  const [newStockQty, setNewStockQty] = useState('10');
  const [newStockMax, setNewStockMax] = useState('20');
  const [newStockUnit, setNewStockUnit] = useState('kg');
  const [stockErr, setStockErr] = useState('');

  // QR
  const [copied, setCopied] = useState(false);
  const [copiedTableQr, setCopiedTableQr] = useState<number | null>(null);

  // Settings
  const [chimeOn, setChimeOn] = useState(() => isChimeEnabled());
  const [wifiName, setWifiName] = useState(() => state.wifi.name);
  const [wifiPass, setWifiPass] = useState(() => state.wifi.password);
  const [wifiErr, setWifiErr] = useState('');
  const [wifiSaved, setWifiSaved] = useState(false);

  // Encrypted Admin password update state
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passErr, setPassErr] = useState('');
  const [passSaved, setPassSaved] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [syncingSupa, setSyncingSupa] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  async function handleSyncSupabase() {
    if (syncingSupa) return;
    setSyncingSupa(true);
    const res = await triggerSupabaseSync();
    setSyncingSupa(false);
    if (res.ok) {
      showSakugaToast(
        `Supabase (${res.supabase?.projectRef || 'cloud'}) ke saath sync complete ho gaya!`,
        'green',
        'SYNCED!'
      );
    } else if (res.supabase && !res.supabase.schemaReady) {
      showSakugaToast(
        'Supabase tables abhi nahi bane hain — Copy SQL dabakar Supabase SQL Editor mein run karo.',
        'gold',
        'SQL!'
      );
    } else {
      showSakugaToast(res.error || 'Supabase sync fail hua.', 'gold', 'RETRY');
    }
  }

  async function handleCopySupaSql() {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setSqlCopied(true);
      showSakugaToast('supabase.sql copy ho gaya! Supabase SQL Editor mein paste karke Run karo.', 'gold', 'COPIED!');
      window.setTimeout(() => setSqlCopied(false), 2400);
    } catch {
      showSakugaToast('Copy nahi ho paya — repo mein supabase.sql file check karo.', 'gold');
    }
  }

  useEffect(() => {
    setWifiName(state.wifi.name);
    setWifiPass(state.wifi.password);
  }, [state.wifi.name, state.wifi.password]);

  function handleSaveWifi(e: React.FormEvent) {
    e.preventDefault();
    const res = updateWifi(wifiName, wifiPass);
    if (!res.ok) {
      setWifiErr(res.error);
      setWifiSaved(false);
      return;
    }
    setWifiErr('');
    setWifiSaved(true);
    showSakugaToast(
      `WiFi "${res.wifi.name}" update ho gaya! Guest screen par live dikhega.`,
      'green',
      'WIFI!'
    );
    window.setTimeout(() => setWifiSaved(false), 2600);
  }

  async function handleUpdateAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    if (changingPass) return;
    if (!curPass) {
      setPassErr('Current password daalo.');
      return;
    }
    if (newPass.trim().length < 6) {
      setPassErr('Naya password kam se kam 6 characters ka hona chahiye.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassErr('Naya password aur Confirm password match nahi kar rahe.');
      return;
    }
    setChangingPass(true);
    const res = await changeAdminPassword(curPass, newPass);
    setChangingPass(false);
    if (!res.ok) {
      setPassErr(res.error || 'Password update nahi ho paya.');
      setPassSaved(false);
      return;
    }
    setPassErr('');
    setCurPass('');
    setNewPass('');
    setConfirmPass('');
    setPassSaved(true);
    showSakugaToast(
      'Admin password PBKDF2-SHA256 encrypted digest ke saath update ho gaya!',
      'green',
      'LOCKED!'
    );
    window.setTimeout(() => setPassSaved(false), 3000);
  }

  // Promotions form
  const [promoForm, setPromoForm] = useState<PromoFormState>(() => emptyPromoForm());
  const [promoErr, setPromoErr] = useState('');
  const [promoSavedMsg, setPromoSavedMsg] = useState('');

  function handleSavePromo(e: React.FormEvent) {
    e.preventDefault();
    const res = savePromoOffer({
      id: promoForm.id,
      title: promoForm.title,
      platform: promoForm.platform,
      handleOrUrl: promoForm.handleOrUrl,
      discountType: promoForm.discountType,
      discountValue: Number(promoForm.discountValue),
      minBill: Number(promoForm.minBill) || 0,
      description: promoForm.description,
      active: promoForm.active,
    });
    if (!res.ok) {
      setPromoErr(res.error);
      setPromoSavedMsg('');
      return;
    }
    setPromoErr('');
    const wasEdit = Boolean(promoForm.id);
    setPromoForm(emptyPromoForm());
    setPromoSavedMsg(
      wasEdit
        ? `"${res.promo.title}" update ho gaya!`
        : `"${res.promo.title}" live ho gaya! Guest bill screen par dikh raha hai.`
    );
    showSakugaToast(
      wasEdit ? 'Promo offer update ho gaya!' : 'Naya Promo offer live ho gaya!',
      'green',
      'PROMO!'
    );
    window.setTimeout(() => setPromoSavedMsg(''), 3000);
  }

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const guestUrl = useMemo(() => {
    if (typeof window === 'undefined') return '#/m';
    return window.location.origin + window.location.pathname + '#/m';
  }, []);

  const allOrdersSorted = useMemo(
    () => [...state.orders].sort((a, b) => b.createdAt - a.createdAt),
    [state.orders]
  );

  const liveOrders = useMemo(
    () =>
      state.orders
        .filter((o) => !o.paid)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.orders]
  );

  const paidHistory = useMemo(
    () =>
      state.orders
        .filter((o) => o.paid)
        .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt))
        .slice(0, 100),
    [state.orders]
  );

  const lowStock = useMemo(
    () => state.stock.filter((s) => isLowStock(s)),
    [state.stock]
  );

  const occupiedTableCount = useMemo(
    () => sortedTables.filter((t) => tableStatus(state, t.num) !== 'free').length,
    [sortedTables, state]
  );

  const sortedMenu = useMemo(
    () => [...state.menu].sort((a, b) => a.pos - b.pos),
    [state.menu]
  );

  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return sortedMenu.filter((m) => {
      if (menuCatFilter !== 'ALL' && m.cat !== menuCatFilter) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.cat.toLowerCase().includes(q);
    });
  }, [sortedMenu, menuSearch, menuCatFilter]);

  const displayedOrders = useMemo(() => {
    const base =
      orderView === 'live'
        ? liveOrders
        : orderView === 'all'
          ? allOrdersSorted
          : paidHistory;
    const q = orderSearch.trim().toLowerCase();
    return base.filter((o) => {
      if (orderView !== 'history' && orderStatusFilter !== 'all' && o.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      const tbl = o.table !== null ? `table ${o.table} t${o.table}` : 'whatsapp';
      const cust = `${o.customer || ''} ${o.customerPhone || ''}`.toLowerCase();
      return (
        tbl.toLowerCase().includes(q) ||
        cust.includes(q) ||
        String(shortId(o.id)).includes(q) ||
        o.lines.some((l) => byId(l.itemId, state.menu).name.toLowerCase().includes(q))
      );
    });
  }, [orderView, liveOrders, allOrdersSorted, paidHistory, orderStatusFilter, orderSearch, state.menu]);

  function handleExportOrdersCsv() {
    const header = ['OrderID', 'DateTime', 'Table', 'Channel', 'Source', 'Customer', 'Phone', 'Items', 'TotalINR', 'Status', 'Paid', 'PaymentMethod'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = allOrdersSorted.map((o) => {
      const itemsText = o.lines
        .map((l) => `${l.qty}x ${byId(l.itemId, state.menu).name}`)
        .join('; ');
      return [
        shortId(o.id),
        new Date(o.createdAt).toLocaleString(),
        o.table !== null ? `T${o.table}` : 'Delivery',
        o.channel,
        o.by,
        o.customer || '',
        o.customerPhone || '',
        itemsText,
        orderTotal(o, state.menu),
        o.status,
        o.paid ? 'YES' : 'NO',
        o.method || '',
      ]
        .map(esc)
        .join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panda-momo-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSakugaToast(`${allOrdersSorted.length} orders CSV export ho gayi!`, 'green', 'CSV!');
  }

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizePhotoToDataUrl(file);
      setForm((f) => ({ ...f, img: dataUrl }));
    } catch {
      setMenuFormErr('Photo load nahi ho payi.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleSaveMenu(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = form.name.trim();
    const priceNum = Number(form.price);
    const prepNum = Math.max(1, Number(form.prep) || 5);
    const finalCat =
      form.cat === NEW_CAT_VALUE ? form.newCat.trim() : form.cat.trim();

    if (!cleanName) {
      setMenuFormErr('Dish ka naam daalo.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setMenuFormErr('Price 0 se zyada hona chahiye.');
      return;
    }
    if (!finalCat) {
      setMenuFormErr('Category ka naam daalo.');
      return;
    }

    const allergens = form.allergens
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    saveMenuItem({
      id: form.id,
      name: cleanName,
      price: priceNum,
      prep: prepNum,
      cat: finalCat,
      section: form.section,
      spice: form.spice,
      emoji: form.emoji.trim() || '🥟',
      stock: form.stock,
      use: form.stock ? Math.max(0, Number(form.use) || 0) : 0,
      desc: form.desc.trim() || 'Freshly prepared at Panda Momo.',
      allergens,
      img: form.img,
      available: form.available,
    });

    setMenuFormErr('');
    const msg = form.id ? 'Dish update ho gayi!' : 'Nayi dish menu mein add ho gayi!';
    setMenuSavedMsg(msg);
    showSakugaToast(msg, 'green', 'SAVED!');
    setForm(emptyMenuForm(finalCat));
    window.setTimeout(() => setMenuSavedMsg(''), 2500);
  }

  function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    const res = addStockItem({
      name: newStockName,
      qty: Number(newStockQty) || 0,
      max: Number(newStockMax) || 0,
      unit: newStockUnit,
    });
    if (!res.ok) {
      setStockErr(res.error || 'Error');
      return;
    }
    setStockErr('');
    setNewStockName('');
    setNewStockQty('10');
    setNewStockMax('20');
    setNewStockUnit('kg');
    showSakugaToast('Naya stock item add ho gaya!', 'green', 'ADDED!');
  }

  async function handleCopyQrLink() {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      showSakugaToast('Guest menu link copy ho gaya!', 'gold', 'COPIED!');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  }

  async function handleDownloadAdminQr() {
    try {
      const dataUrl = await renderFoodQrStandeePng(
        guestUrl,
        BRAND,
        'Table par scan karo aur seedha order bhejo'
      );
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'panda-momo-food-menu-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSakugaToast('Food-style Menu QR PNG download ho gaya!', 'green', 'SAVED!');
    } catch {
      showSakugaToast('QR download karne mein issue aaya.', 'red', 'ERR');
    }
  }

  async function handleCopyTableQrLink(tableNum: number) {
    const url = buildTableQrUrl(window.location.origin, window.location.pathname, tableNum);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTableQr(tableNum);
      showSakugaToast(`Table ${tableNum} ka QR link copy ho gaya!`, 'green', 'COPIED!');
      window.setTimeout(() => setCopiedTableQr((cur) => (cur === tableNum ? null : cur)), 2000);
    } catch {
      showSakugaToast('Link copy nahi ho paya.', 'gold', 'INFO');
    }
  }

  async function handleDownloadTableQr(tableNum: number) {
    const url = buildTableQrUrl(window.location.origin, window.location.pathname, tableNum);
    try {
      const dataUrl = await renderFoodQrStandeePng(
        url,
        `${BRAND} · Table ${tableNum}`,
        `Table ${tableNum} par scan karo aur seedha order bhejo`
      );
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `panda-momo-table-${tableNum}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSakugaToast(`Table ${tableNum} QR PNG download ho gaya!`, 'green', 'SAVED!');
    } catch {
      showSakugaToast(`Table ${tableNum} QR download karne mein issue aaya.`, 'red', 'ERR');
    }
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
    const nextNum = Math.max(num, ...sortedTables.map((t) => t.num), 0) + 1;
    setNewTableNum(String(nextNum));
    showSakugaToast(`Table ${num} add ho gaya!`, 'green', 'ADDED!');
  }

  const activePromoCount = useMemo(
    () => (state.promos || []).filter((p) => p.active).length,
    [state.promos]
  );

  const navItems: Array<{
    id: AdminTab;
    icon: ReactNode;
    label: string;
    badge?: number;
    badgeTone?: 'red' | 'neutral';
  }> = [
    { id: 'overview', icon: <Home size={16} strokeWidth={2.2} />, label: 'Overview' },
    {
      id: 'orders',
      icon: <Receipt size={16} strokeWidth={2.2} />,
      label: 'Orders',
      badge: liveOrders.length,
      badgeTone: 'red',
    },
    {
      id: 'customers',
      icon: <Users size={16} strokeWidth={2.2} />,
      label: 'Customers',
      badge: (state.customers || []).length,
      badgeTone: 'neutral',
    },
    {
      id: 'promos',
      icon: <Gift size={16} strokeWidth={2.2} />,
      label: 'Promos',
      badge: activePromoCount,
      badgeTone: 'neutral',
    },
    {
      id: 'menu',
      icon: <UtensilsCrossed size={16} strokeWidth={2.2} />,
      label: 'Menu',
      badge: state.menu.length,
      badgeTone: 'neutral',
    },
    {
      id: 'tables',
      icon: <Armchair size={16} strokeWidth={2.2} />,
      label: 'Tables',
      badge: sortedTables.length,
      badgeTone: 'neutral',
    },
    {
      id: 'stock',
      icon: <Package size={16} strokeWidth={2.2} />,
      label: 'Stock',
      badge: lowStock.length > 0 ? lowStock.length : undefined,
      badgeTone: 'red',
    },
    { id: 'qr', icon: <QrCode size={16} strokeWidth={2.2} />, label: 'QR' },
    { id: 'settings', icon: <Settings size={16} strokeWidth={2.2} />, label: 'Settings' },
  ];

  return (
    <div className="dark-page">
      <Nav active="admin" />
      <div className="crm-shell">
        {/* Sidebar / Mobile Tab Rail */}
        <aside className="crm-sidebar noprint" aria-label="Admin CRM navigation">
          <div className="crm-brand-box">
            <Logo size={42} />
            <div style={{ minWidth: 0 }}>
              <div className="crm-brand-name">{BRAND}</div>
              <div className="crm-brand-sub">Admin CRM</div>
            </div>
          </div>

          <div className="crm-nav-list" role="tablist" aria-label="Admin tabs">
            {navItems.map((t) => {
              const isAct = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isAct}
                  className={`crm-nav-btn ${isAct ? 'on' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <span className="crm-nav-left">
                    <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                      {t.icon}
                    </span>
                    <span>{t.label}</span>
                  </span>
                  {typeof t.badge === 'number' && t.badge > 0 && (
                    <span
                      className={
                        t.badgeTone === 'red' ? 'count-pill' : 'count-pill count-pill-muted'
                      }
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="crm-sidebar-foot">
            <DeveloperContactButton dark compact />
            <button type="button" className="btn-ghost-dark" onClick={onLogout}>
              <LogOut size={15} strokeWidth={2.2} aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="crm-main">
          {syncMeta.supabase?.configured && !syncMeta.supabase.schemaReady && (
            <div
              className="d-card"
              style={{
                marginBottom: 16,
                borderColor: 'rgba(245, 166, 35, 0.35)',
                background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.09), rgba(17, 24, 39, 0.88))',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong className="dish-inline-label" style={{ color: '#FDE68A' }}>
                    <Database size={16} strokeWidth={2.2} aria-hidden="true" />
                    <span>
                      Supabase Project Linked ({syncMeta.supabase.projectRef}) — 1-Step Table Setup Needed
                    </span>
                  </strong>
                  <p className="dark-sub" style={{ marginTop: 4 }}>
                    Aapka Supabase connect ho chuka hai. Bas ek baar SQL Editor mein <code>supabase.sql</code> run karo taaki saare user orders aur admin data cloud mein auto-save ho sakein.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-ghost-dark"
                    onClick={handleCopySupaSql}
                  >
                    {sqlCopied ? (
                      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                    ) : (
                      <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
                    )}
                    <span>{sqlCopied ? 'SQL Copied!' : '1. Copy SQL'}</span>
                  </button>
                  {syncMeta.supabase.projectRef && (
                    <a
                      href={`https://supabase.com/dashboard/project/${syncMeta.supabase.projectRef}/sql/new`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost-dark"
                    >
                      <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>2. Open SQL Editor</span>
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={syncingSupa}
                    onClick={handleSyncSupabase}
                  >
                    <RefreshCw
                      size={14}
                      strokeWidth={2.2}
                      className={syncingSupa ? 'animate-spin' : undefined}
                      aria-hidden="true"
                    />
                    <span>{syncingSupa ? 'Syncing…' : '3. Connect & Sync'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
          {/* ============ 1. OVERVIEW ============ */}
          {tab === 'overview' && (
            <CrmOverviewTab
              state={state}
              now={now}
              onNavigateTab={setTab}
              onQuickAddMenu={() => {
                setForm(emptyMenuForm(categories[0] || 'Chai'));
                setTab('menu');
              }}
              onOpenCustomerProfile={(phone) => {
                setPendingCustomerPhone(phone);
                setTab('customers');
              }}
              onQuickAddCustomer={() => {
                setPendingAddCustomer(true);
                setTab('customers');
              }}
            />
          )}

          {/* ============ 2. ORDERS ============ */}
          {tab === 'orders' && (
            <div>
              <div className="crm-toolbar">
                <div className="chip-row" role="group" aria-label="Order view">
                  <button
                    type="button"
                    className={`chip-dark ${orderView === 'live' ? 'on' : ''}`}
                    onClick={() => setOrderView('live')}
                  >
                    Live ({liveOrders.length})
                  </button>
                  <button
                    type="button"
                    className={`chip-dark ${orderView === 'all' ? 'on' : ''}`}
                    onClick={() => setOrderView('all')}
                  >
                    All Orders ({allOrdersSorted.length})
                  </button>
                  <button
                    type="button"
                    className={`chip-dark ${orderView === 'history' ? 'on' : ''}`}
                    onClick={() => setOrderView('history')}
                  >
                    Paid ({paidHistory.length})
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 260px', justifyContent: 'flex-end' }}>
                  <div className="d-search-wrap crm-search">
                    <Search size={14} strokeWidth={2.2} className="d-search-icon" aria-hidden="true" />
                    <input
                      type="search"
                      className="d-input"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Naam, phone, table, #order ya dish…"
                      aria-label="Orders search karo"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-ghost-dark"
                    onClick={handleExportOrdersCsv}
                  >
                    <Download size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {orderView !== 'history' && (
                <div className="chip-row" style={{ marginBottom: 14 }} role="group" aria-label="Status filter">
                  {(['all', 'new', 'cooking', 'ready', 'served'] as StatusFilter[]).map((sf) => (
                    <button
                      key={sf}
                      type="button"
                      className={`chip-dark ${orderStatusFilter === sf ? 'on' : ''}`}
                      onClick={() => setOrderStatusFilter(sf)}
                    >
                      {sf === 'all' ? 'Sab status' : sf}
                    </button>
                  ))}
                </div>
              )}

              {displayedOrders.length === 0 ? (
                <div className="d-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <p className="dark-sub">
                    {orderView === 'live'
                      ? 'Is filter mein koi live order nahi hai.'
                      : 'Koi order record nahi mila.'}
                  </p>
                </div>
              ) : (
                <motion.div layout className="kds-grid">
                  <AnimatePresence mode="popLayout">
                    {displayedOrders.map((o) => {
                      const tot = orderTotal(o, state.menu);
                      const est = orderEst(o, state.menu);
                      return (
                        <motion.article
                          key={o.id}
                          layout
                          initial={{ scale: 0.9, y: 20, opacity: 0 }}
                          animate={{ scale: 1, y: 0, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          transition={SPRING}
                          className="kds-card"
                        >
                          <div className="kds-head">
                            <div>
                              <div className="kds-title">
                                {o.channel === 'whatsapp'
                                  ? `WhatsApp · ${o.customer || 'Delivery'}`
                                  : `Table ${o.table}${o.customer ? ` · ${o.customer}` : ''}`}
                              </div>
                              <div className="dark-sub">
                                #{shortId(o.id)}
                                {o.customerPhone ? (
                                  <>
                                    {' · '}
                                    <span className="dish-inline-label" style={{ gap: 4 }}>
                                      <Phone size={11} strokeWidth={2.2} aria-hidden="true" />
                                      <span>{o.customerPhone}</span>
                                    </span>
                                  </>
                                ) : (
                                  ''
                                )}{' '}
                                · {agoMin(o.createdAt, now)} min pehle · ETA ~{est} min
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                              {o.paid && <span className="st-tag st-paid">PAID</span>}
                            </div>
                          </div>

                          <div className="kds-lines">
                            {o.lines.map((l, idx) => {
                              const item = byId(l.itemId, state.menu);
                              return (
                                <div key={`${l.itemId}-${idx}`} className="kds-line">
                                  <span className="dish-inline-label">
                                    <DishThumb
                                      img={item.img}
                                      emoji={item.emoji}
                                      alt={item.name}
                                      size={24}
                                      className="kds-dish-thumb"
                                      decorative
                                    />
                                    <span>
                                      {l.qty}× {item.name}
                                      {l.deal ? ' (Deal)' : ''}
                                    </span>
                                  </span>
                                  <span>{fmt(linePrice(l, state.menu))}</span>
                                </div>
                              );
                            })}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontWeight: 800,
                              fontSize: 16,
                            }}
                          >
                            <span>Total</span>
                            <span style={{ color: 'var(--gold)' }}>{fmt(tot)}</span>
                          </div>

                          {!o.paid && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              {o.status === 'new' && (
                                <button
                                  type="button"
                                  className="btn big"
                                  onClick={() => setOrderStatus(o.id, 'cooking')}
                                >
                                  <Flame size={15} strokeWidth={2.2} aria-hidden="true" />
                                  <span>Banana shuru</span>
                                </button>
                              )}
                              {o.status === 'cooking' && (
                                <button
                                  type="button"
                                  className="btn big btn-green"
                                  onClick={() => setOrderStatus(o.id, 'ready')}
                                >
                                  <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                                  <span>Ready</span>
                                </button>
                              )}
                              {o.status === 'ready' && (
                                <button
                                  type="button"
                                  className="btn big btn-green"
                                  onClick={() => setOrderStatus(o.id, 'served', 'Admin')}
                                >
                                  <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                                  <span>Served</span>
                                </button>
                              )}
                            </div>
                          )}
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          )}

          {/* ============ CUSTOMERS CRM TAB ============ */}
          {tab === 'customers' && (
            <CrmCustomersTab
              state={state}
              now={now}
              initialSelectedPhone={pendingCustomerPhone}
              onClearInitialSelected={() => setPendingCustomerPhone(null)}
              initialOpenAddModal={pendingAddCustomer}
              onClearInitialAddModal={() => setPendingAddCustomer(false)}
              onRequestConfirm={(opts) =>
                setConfirmState({
                  ...opts,
                  onConfirm: () => {
                    opts.onConfirm();
                    setConfirmState(null);
                  },
                })
              }
            />
          )}

          {/* ============ 3. MENU ============ */}
          {tab === 'menu' && (
            <div className="two-col">
              <section className="d-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <h2 style={{ fontSize: 20 }}>
                    Menu items ({filteredMenu.length}/{sortedMenu.length})
                  </h2>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setForm(emptyMenuForm(categories[0] || 'Chai'));
                      setMenuFormErr('');
                    }}
                  >
                    <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
                    <span>Naya item</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  <div className="d-search-wrap">
                    <Search size={14} strokeWidth={2.2} className="d-search-icon" aria-hidden="true" />
                    <input
                      type="search"
                      className="d-input"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      placeholder="Dish ya category search karo…"
                      aria-label="Menu search karo"
                    />
                  </div>
                  <div className="chip-row">
                    <button
                      type="button"
                      className={`chip-dark ${menuCatFilter === 'ALL' ? 'on' : ''}`}
                      onClick={() => setMenuCatFilter('ALL')}
                    >
                      Sab
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`chip-dark ${menuCatFilter === c ? 'on' : ''}`}
                        onClick={() => setMenuCatFilter(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredMenu.length === 0 ? (
                    <p className="dark-sub" style={{ padding: '16px 4px' }}>
                      Koi dish nahi mili. Filter clear karo ya naya item add karo.
                    </p>
                  ) : (
                    filteredMenu.map((m) => (
                      <div
                        key={m.id}
                        className={`admin-menu-row ${!m.available ? 'hidden-item' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <DishThumb
                            img={m.img}
                            emoji={m.emoji}
                            alt={m.name}
                            className="admin-thumb"
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                            <div className="dark-sub">
                              {m.cat} · <strong style={{ color: 'var(--gold)' }}>{fmt(m.price)}</strong>
                              {!m.available ? ' · Hidden' : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn-ghost-dark"
                            onClick={() => toggleMenuAvailable(m.id)}
                          >
                            {m.available ? (
                              <>
                                <EyeOff size={13} strokeWidth={2.2} aria-hidden="true" />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <Eye size={13} strokeWidth={2.2} aria-hidden="true" />
                                <span>Show</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setForm(menuToForm(m));
                              setMenuFormErr('');
                            }}
                          >
                            <Pencil size={13} strokeWidth={2.2} aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="d-card">
                <h2 className="icon-heading" style={{ fontSize: 20, marginBottom: 12 }}>
                  <Pencil size={17} strokeWidth={2.2} aria-hidden="true" />
                  <span>{form.id ? `Edit: ${form.name || 'Item'}` : 'Naya item add karo'}</span>
                </h2>
                <form
                  onSubmit={handleSaveMenu}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {/* Photo upload */}
                  <div>
                    <span className="d-label">Photo (optional, JPEG ≤ 640px)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <DishThumb
                        img={form.img}
                        emoji={form.emoji || '🥟'}
                        alt="Preview"
                        size={64}
                        className="admin-thumb admin-thumb-lg"
                      />
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handlePhotoPick}
                      />
                      <button
                        type="button"
                        className="btn-ghost-dark"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Camera size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span>Photo chuno</span>
                      </button>
                      {form.img && (
                        <button
                          type="button"
                          className="btn-ghost-dark"
                          onClick={() => setForm((f) => ({ ...f, img: undefined }))}
                        >
                          <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                          <span>Photo hatao</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="m-name" className="d-label">
                      Naam
                    </label>
                    <input
                      id="m-name"
                      type="text"
                      className="d-input"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Steamed Veg Momo"
                    />
                  </div>

                  <div className="form-grid-2">
                    <div>
                      <label htmlFor="m-price" className="d-label">
                        Price (₹)
                      </label>
                      <input
                        id="m-price"
                        type="number"
                        min={1}
                        className="d-input"
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        placeholder="80"
                      />
                    </div>
                    <div>
                      <label htmlFor="m-prep" className="d-label">
                        Banne ka time (min)
                      </label>
                      <input
                        id="m-prep"
                        type="number"
                        min={1}
                        className="d-input"
                        value={form.prep}
                        onChange={(e) => setForm((f) => ({ ...f, prep: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div>
                      <label htmlFor="m-cat" className="d-label">
                        Category
                      </label>
                      <select
                        id="m-cat"
                        className="d-select"
                        value={form.cat}
                        onChange={(e) => setForm((f) => ({ ...f, cat: e.target.value }))}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value={NEW_CAT_VALUE}>+ Nayi category</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="m-sec" className="d-label">
                        Kitchen section
                      </label>
                      <select
                        id="m-sec"
                        className="d-select"
                        value={form.section}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, section: e.target.value as Section }))
                        }
                      >
                        {SECTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {form.cat === NEW_CAT_VALUE && (
                    <div>
                      <label htmlFor="m-newcat" className="d-label">
                        Nayi category ka naam
                      </label>
                      <input
                        id="m-newcat"
                        type="text"
                        className="d-input"
                        value={form.newCat}
                        onChange={(e) => setForm((f) => ({ ...f, newCat: e.target.value }))}
                        placeholder="e.g. Momos"
                      />
                    </div>
                  )}

                  <div className="form-grid-2">
                    <div>
                      <label htmlFor="m-spice" className="d-label">
                        Teekha (0–3)
                      </label>
                      <select
                        id="m-spice"
                        className="d-select"
                        value={form.spice}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            spice: Number(e.target.value) as 0 | 1 | 2 | 3,
                          }))
                        }
                      >
                        <option value={0}>0 · Mild</option>
                        <option value={1}>1 · 🌶️</option>
                        <option value={2}>2 · 🌶️🌶️</option>
                        <option value={3}>3 · 🌶️🌶️🌶️</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="m-emoji" className="d-label">
                        Emoji (fallback)
                      </label>
                      <input
                        id="m-emoji"
                        type="text"
                        className="d-input"
                        value={form.emoji}
                        onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div>
                      <label htmlFor="m-stock" className="d-label">
                        Stock se jodo
                      </label>
                      <select
                        id="m-stock"
                        className="d-select"
                        value={form.stock}
                        onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                      >
                        <option value="">Koi nahi</option>
                        {state.stock.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name} ({s.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="m-use" className="d-label">
                        Ek serving mein use
                      </label>
                      <input
                        id="m-use"
                        type="number"
                        step="0.01"
                        min={0}
                        disabled={!form.stock}
                        className="d-input"
                        value={form.use}
                        onChange={(e) => setForm((f) => ({ ...f, use: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="m-desc" className="d-label">
                      Description
                    </label>
                    <textarea
                      id="m-desc"
                      rows={2}
                      className="d-textarea"
                      value={form.desc}
                      onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                      placeholder="Short Hinglish description"
                    />
                  </div>

                  <div>
                    <label htmlFor="m-allergens" className="d-label">
                      Allergens (comma separated)
                    </label>
                    <input
                      id="m-allergens"
                      type="text"
                      className="d-input"
                      value={form.allergens}
                      onChange={(e) => setForm((f) => ({ ...f, allergens: e.target.value }))}
                      placeholder="Dairy, Gluten"
                    />
                  </div>

                  {menuFormErr && (
                    <div role="alert" className="admin-error">
                      {menuFormErr}
                    </div>
                  )}
                  {menuSavedMsg && (
                    <div className="dish-inline-label" style={{ color: '#5BE39A', fontSize: 13.5, fontWeight: 700 }}>
                      <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                      <span>{menuSavedMsg}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="submit" className="btn">
                      <Save size={15} strokeWidth={2.2} aria-hidden="true" />
                      <span>Save karo</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      onClick={() => {
                        setForm(emptyMenuForm(categories[0] || 'Chai'));
                        setMenuFormErr('');
                      }}
                    >
                      Cancel
                    </button>
                    {form.id && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => {
                          const targetId = form.id!;
                          const targetName = form.name;
                          setConfirmState({
                            title: `"${targetName}" delete karo?`,
                            message:
                              'Ye item menu se hat jayega. Purane orders mein "(removed item)" dikhega.',
                            confirmLabel: 'Delete karo',
                            onConfirm: () => {
                              deleteMenuItem(targetId);
                              setForm(emptyMenuForm(categories[0] || 'Chai'));
                              setConfirmState(null);
                            },
                          });
                        }}
                      >
                        <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* ============ 4. TABLES ============ */}
          {tab === 'tables' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="crm-mini-stats">
                <div className="crm-mini-stat">
                  <span className="dark-sub">Total Tables</span>
                  <strong>{sortedTables.length}</strong>
                </div>
                <div className="crm-mini-stat">
                  <span className="dark-sub">Occupied</span>
                  <strong style={{ color: 'var(--gold)' }}>{occupiedTableCount}</strong>
                </div>
                <div className="crm-mini-stat">
                  <span className="dark-sub">Free</span>
                  <strong style={{ color: '#5BE39A' }}>
                    {sortedTables.length - occupiedTableCount}
                  </strong>
                </div>
              </div>

              <div className="two-col">
                <section className="d-card" aria-label="Tables list">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <h2 style={{ fontSize: 20 }}>Tables ({sortedTables.length})</h2>
                    <span className="dark-sub">QR, Floor & Guest auto-sync</span>
                  </div>

                  {tableErr && (
                    <div role="alert" className="admin-error" style={{ marginBottom: 10 }}>
                      {tableErr}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sortedTables.map((t) => {
                      const st = tableStatus(state, t.num);
                      const bill = tableBill(state, t.num);
                      return (
                        <div key={t.num} className="admin-menu-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <div className="admin-thumb" style={{ fontWeight: 800, fontSize: 18 }}>
                              T{t.num}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>Table {t.num}</div>
                              <div className="dark-sub">
                                Waiter: {t.waiter}
                                {bill > 0 ? ` · Bill ${fmt(bill)}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`st-tag st-${st}`}>{TABLE_STATUS_WORD[st]}</span>
                            <button
                              type="button"
                              className="btn-ghost-dark"
                              aria-label={`Delete Table ${t.num}`}
                              onClick={() =>
                                setConfirmState({
                                  title: `Table ${t.num} delete karo?`,
                                  message:
                                    'Ye table floor map, guest table picker aur QR grid se hat jayegi.',
                                  confirmLabel: 'Delete karo',
                                  onConfirm: () => {
                                    const res = deleteTable(t.num);
                                    setConfirmState(null);
                                    if (!res.ok) {
                                      const msg = res.error || 'Table delete nahi ho paya.';
                                      setTableErr(msg);
                                      showSakugaToast(msg, 'red', 'WAIT!');
                                    } else {
                                      setTableErr('');
                                      showSakugaToast(`Table ${t.num} delete ho gaya!`, 'gold', 'REMOVED!');
                                    }
                                  },
                                })
                              }
                            >
                              <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="d-card" aria-label="Add new table">
                  <h2 style={{ fontSize: 20, marginBottom: 12 }}>Naya table add karo</h2>
                  <form
                    onSubmit={handleAddTable}
                    style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                  >
                    <div>
                      <label htmlFor="adm-tbl-num" className="d-label">
                        Table number (1–99)
                      </label>
                      <input
                        id="adm-tbl-num"
                        type="number"
                        min={1}
                        max={99}
                        className="d-input"
                        value={newTableNum}
                        onChange={(e) => setNewTableNum(e.target.value)}
                        placeholder={String(nextSuggestedTableNum)}
                      />
                    </div>
                    <div>
                      <label htmlFor="adm-tbl-waiter" className="d-label">
                        Assigned waiter
                      </label>
                      <input
                        id="adm-tbl-waiter"
                        type="text"
                        className="d-input"
                        value={newTableWaiter}
                        onChange={(e) => setNewTableWaiter(e.target.value)}
                        placeholder="e.g. Ali, Sana, Vikram"
                      />
                      <div className="chip-row" style={{ marginTop: 8 }}>
                        {['Ali', 'Sana'].map((w) => (
                          <button
                            key={w}
                            type="button"
                            className={`chip-dark ${newTableWaiter === w ? 'on' : ''}`}
                            onClick={() => setNewTableWaiter(w)}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="btn">
                      <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                      <span>Table add karo</span>
                    </button>
                  </form>
                </section>
              </div>
            </div>
          )}

          {/* ============ 5. STOCK ============ */}
          {tab === 'stock' && (
            <div className="two-col">
              <section className="d-card">
                <h2 style={{ fontSize: 20, marginBottom: 12 }}>Stock inventory</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {state.stock.map((st) => {
                    const pct = st.max > 0 ? Math.min(100, (st.qty / st.max) * 100) : 0;
                    const low = isLowStock(st);
                    return (
                      <div
                        key={st.name}
                        style={{
                          background: '#141442',
                          border: `1px solid ${low ? 'var(--red)' : 'var(--d-border)'}`,
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 8,
                          }}
                        >
                          <div className="dish-inline-label" style={{ fontWeight: 700, fontSize: 15 }}>
                            {low && (
                              <AlertTriangle
                                size={15}
                                strokeWidth={2.2}
                                style={{ color: '#FF8A75' }}
                                aria-hidden="true"
                              />
                            )}
                            <span>{st.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              aria-label={`${st.name} quantity`}
                              className="d-input"
                              style={{ width: 78, padding: '6px 8px' }}
                              value={st.qty}
                              onChange={(e) =>
                                updateStockQty(st.name, Math.max(0, Number(e.target.value) || 0))
                              }
                            />
                            <span className="dark-sub">
                              / {st.max} {st.unit}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => restockItem(st.name)}
                            >
                              Full
                            </button>
                            <button
                              type="button"
                              className="btn-ghost-dark"
                              aria-label={`Delete stock ${st.name}`}
                              onClick={() =>
                                setConfirmState({
                                  title: `"${st.name}" stock delete karo?`,
                                  message: 'Ye stock item list se hat jayega.',
                                  confirmLabel: 'Delete karo',
                                  onConfirm: () => {
                                    deleteStockItem(st.name);
                                    setConfirmState(null);
                                  },
                                })
                              }
                            >
                              <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <SakugaProgress
                          pct={pct}
                          tone={low ? 'red' : 'gold'}
                          label={`${st.name} stock`}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="d-card">
                <h2 style={{ fontSize: 20, marginBottom: 12 }}>Naya stock item jodo</h2>
                <form
                  onSubmit={handleAddStock}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div>
                    <label htmlFor="st-name" className="d-label">
                      Naam
                    </label>
                    <input
                      id="st-name"
                      type="text"
                      className="d-input"
                      value={newStockName}
                      onChange={(e) => setNewStockName(e.target.value)}
                      placeholder="e.g. Maida / Chutney"
                    />
                  </div>
                  <div className="form-grid-2">
                    <div>
                      <label htmlFor="st-qty" className="d-label">
                        Current qty
                      </label>
                      <input
                        id="st-qty"
                        type="number"
                        step="0.1"
                        min={0}
                        className="d-input"
                        value={newStockQty}
                        onChange={(e) => setNewStockQty(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="st-max" className="d-label">
                        Full-stock max
                      </label>
                      <input
                        id="st-max"
                        type="number"
                        step="0.1"
                        min={1}
                        className="d-input"
                        value={newStockMax}
                        onChange={(e) => setNewStockMax(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="st-unit" className="d-label">
                      Unit
                    </label>
                    <input
                      id="st-unit"
                      type="text"
                      className="d-input"
                      value={newStockUnit}
                      onChange={(e) => setNewStockUnit(e.target.value)}
                      placeholder="L / kg / pkt"
                    />
                  </div>
                  {stockErr && (
                    <div role="alert" className="admin-error">
                      {stockErr}
                    </div>
                  )}
                  <button type="submit" className="btn">
                    <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                    <span>Add stock item</span>
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* ============ PROMOS & DISCOUNTS ============ */}
          {tab === 'promos' && (
            <div className="admin-two-col">
              {/* Active & Saved Promotions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="d-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h2 className="icon-heading" style={{ fontSize: 22 }}>
                      <Gift size={20} strokeWidth={2.2} aria-hidden="true" />
                      <span>Promotion &amp; Discount Offers ({(state.promos || []).length})</span>
                    </h2>
                    <p className="dark-sub">
                      Instagram Follow, Reel/Story, Google Review ya apna custom offer set karo — guest bill par turant discount apply kar sakega.
                    </p>
                  </div>
                  <span className="pill-badge" style={{ background: 'rgba(34, 197, 94, 0.16)', color: '#86efac' }}>
                    {activePromoCount} Active
                  </span>
                </div>

                {(state.promos || []).length === 0 ? (
                  <div className="d-card" style={{ textAlign: 'center', padding: 32 }}>
                    <div
                      className="empty-icon-circle empty-icon-circle-dark"
                      style={{ margin: '0 auto 10px' }}
                      aria-hidden="true"
                    >
                      <Gift size={24} strokeWidth={2} />
                    </div>
                    <p className="dark-sub">
                      Abhi koi promotion offer nahi hai. Right side form se apna pehla Instagram ya Google Review offer banao!
                    </p>
                  </div>
                ) : (
                  (state.promos || []).map((promo) => {
                    const meta = PROMO_PLATFORM_META[promo.platform] || PROMO_PLATFORM_META.custom;
                    const href = promoActionHref(promo);
                    return (
                      <article
                        key={promo.id}
                        className="d-card"
                        style={{
                          opacity: promo.active ? 1 : 0.65,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                className="pill-badge dish-inline-label"
                                style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#fde68a' }}
                              >
                                {renderPromoPlatformIcon(promo.platform, 13)}
                                <span>{meta.label}</span>
                              </span>
                              <span className="pill-badge" style={{ background: 'rgba(34, 197, 94, 0.18)', color: '#86efac', fontWeight: 800 }}>
                                {formatPromoBadge(promo)}
                              </span>
                              {promo.minBill > 0 && (
                                <span className="dark-sub" style={{ fontSize: 12 }}>
                                  Min bill {fmt(promo.minBill)}
                                </span>
                              )}
                            </div>
                            <h3 style={{ fontSize: 18, marginTop: 6 }}>{promo.title}</h3>
                            <p className="dark-sub" style={{ marginTop: 2 }}>{promo.description}</p>
                            {promo.handleOrUrl && (
                              <div style={{ marginTop: 6, fontSize: 12.5 }}>
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="dish-inline-label"
                                    style={{ color: '#93c5fd', textDecoration: 'underline', wordBreak: 'break-all' }}
                                  >
                                    <span>{promo.handleOrUrl}</span>
                                    <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
                                  </a>
                                ) : (
                                  <span className="dark-sub">{promo.handleOrUrl}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="dark-sub" style={{ fontSize: 12, fontWeight: 700 }}>
                              {promo.active ? 'ON' : 'OFF'}
                            </span>
                            <SakugaToggle
                              checked={promo.active}
                              label={`Toggle ${promo.title}`}
                              onChange={() => {
                                togglePromoActive(promo.id);
                                showSakugaToast(
                                  promo.active
                                    ? `"${promo.title}" pause ho gaya`
                                    : `"${promo.title}" guest screen par live ho gaya!`,
                                  promo.active ? 'gold' : 'green',
                                  promo.active ? 'OFF' : 'LIVE!'
                                );
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--d-border)' }}>
                          <button
                            type="button"
                            className="btn-ghost-dark"
                            onClick={() => {
                              setPromoForm(promoToForm(promo));
                              setPromoErr('');
                            }}
                          >
                            <Pencil size={14} strokeWidth={2.2} aria-hidden="true" />
                            <span>Edit karo</span>
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-dark"
                            style={{ color: '#fca5a5' }}
                            onClick={() =>
                              setConfirmState({
                                title: `"${promo.title}" delete karein?`,
                                message: 'Ye promotion offer customer ke bill screen se hat jayega.',
                                confirmLabel: 'Delete karo',
                                onConfirm: () => {
                                  deletePromoOffer(promo.id);
                                  if (promoForm.id === promo.id) {
                                    setPromoForm(emptyPromoForm());
                                  }
                                  showSakugaToast('Promo offer delete ho gaya.', 'gold', 'DELETED');
                                },
                              })
                            }
                          >
                            <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              {/* Add / Customize Promo Offer Form */}
              <section className="d-card" style={{ alignSelf: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 className="icon-heading" style={{ fontSize: 20 }}>
                    {promoForm.id ? (
                      <>
                        <Pencil size={17} strokeWidth={2.2} aria-hidden="true" />
                        <span>Promo Offer Edit karo</span>
                      </>
                    ) : (
                      <>
                        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
                        <span>Naya Promo Offer banao</span>
                      </>
                    )}
                  </h3>
                  {promoForm.id && (
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      onClick={() => {
                        setPromoForm(emptyPromoForm());
                        setPromoErr('');
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleSavePromo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label htmlFor="promo-platform" className="d-label">
                      Promotion Type
                    </label>
                    <select
                      id="promo-platform"
                      className="d-input"
                      value={promoForm.platform}
                      onChange={(e) =>
                        setPromoForm((f) => ({
                          ...f,
                          platform: e.target.value as PromoPlatform,
                        }))
                      }
                    >
                      <option value="instagram">Instagram ID / Follow</option>
                      <option value="reel">Instagram Reel / Story Tag</option>
                      <option value="google">Google Review</option>
                      <option value="custom">Custom Promotion</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="promo-title" className="d-label">
                      Offer Title
                    </label>
                    <input
                      id="promo-title"
                      type="text"
                      className="d-input"
                      value={promoForm.title}
                      onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Instagram Reel banao & 20% OFF pao"
                    />
                  </div>

                  <div>
                    <label htmlFor="promo-handle" className="d-label">
                      Instagram ID / Google Review Link
                    </label>
                    <input
                      id="promo-handle"
                      type="text"
                      className="d-input"
                      value={promoForm.handleOrUrl}
                      onChange={(e) => setPromoForm((f) => ({ ...f, handleOrUrl: e.target.value }))}
                      placeholder={PROMO_PLATFORM_META[promoForm.platform].placeholder}
                    />
                  </div>

                  <div className="admin-form-grid">
                    <div>
                      <label htmlFor="promo-dtype" className="d-label">
                        Discount Type
                      </label>
                      <select
                        id="promo-dtype"
                        className="d-input"
                        value={promoForm.discountType}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            discountType: e.target.value as 'percent' | 'flat',
                          }))
                        }
                      >
                        <option value="percent">% Percent OFF</option>
                        <option value="flat">₹ Flat OFF</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="promo-dval" className="d-label">
                        Discount ({promoForm.discountType === 'percent' ? '%' : '₹'})
                      </label>
                      <input
                        id="promo-dval"
                        type="number"
                        min={1}
                        max={promoForm.discountType === 'percent' ? 90 : 5000}
                        className="d-input"
                        value={promoForm.discountValue}
                        onChange={(e) =>
                          setPromoForm((f) => ({ ...f, discountValue: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="promo-minbill" className="d-label">
                      Minimum Bill (₹ — 0 = koi limit nahi)
                    </label>
                    <input
                      id="promo-minbill"
                      type="number"
                      min={0}
                      className="d-input"
                      value={promoForm.minBill}
                      onChange={(e) => setPromoForm((f) => ({ ...f, minBill: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label htmlFor="promo-desc" className="d-label">
                      Customer ke liye instructions
                    </label>
                    <textarea
                      id="promo-desc"
                      className="d-input"
                      rows={2}
                      value={promoForm.description}
                      onChange={(e) =>
                        setPromoForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="e.g. Reel post karke @pandamomo tag karo aur counter par dikhao"
                    />
                  </div>

                  {promoErr && (
                    <div role="alert" className="admin-error">
                      {promoErr}
                    </div>
                  )}
                  {promoSavedMsg && (
                    <div
                      className="dish-inline-label"
                      style={{
                        background: 'rgba(34, 197, 94, 0.16)',
                        color: '#86efac',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                      <span>{promoSavedMsg}</span>
                    </div>
                  )}

                  <button type="submit" className="btn">
                    {promoForm.id ? (
                      <>
                        <Save size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span>Promo Update karo</span>
                      </>
                    ) : (
                      <>
                        <Gift size={15} strokeWidth={2.2} aria-hidden="true" />
                        <span>Promo Offer Save karo</span>
                      </>
                    )}
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* ============ 6. QR ============ */}
          {tab === 'qr' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div className="admin-qr-card admin-qr-food-card">
                <span className="standee-food-kicker">
                  <UtensilsCrossed size={13} strokeWidth={2.4} aria-hidden="true" />
                  <span>UNIVERSAL CAFE QR · SABHI TABLES</span>
                </span>
                <Logo size={54} />
                <h2 style={{ fontSize: 30 }}>{BRAND}</h2>
                <p style={{ fontSize: 14, color: 'rgba(255, 251, 242, 0.8)' }}>
                  Table par scan karo aur seedha order bhejo
                </p>
                <div className="admin-qr-plate">
                  <FoodQr
                    value={guestUrl}
                    size={260}
                    label={`${BRAND} Food-Style Guest Menu QR`}
                  />
                </div>
                <div className="standee-food-strip" aria-hidden="true">
                  <span>
                    <UtensilsCrossed size={13} strokeWidth={2.2} /> Momos
                  </span>
                  <span>·</span>
                  <span>
                    <Coffee size={13} strokeWidth={2.2} /> Kulhad Chai
                  </span>
                  <span>·</span>
                  <span>
                    <Flame size={13} strokeWidth={2.2} /> Chutney
                  </span>
                </div>
                <code
                  style={{
                    fontSize: 12,
                    wordBreak: 'break-all',
                    background: 'rgba(255, 251, 242, 0.1)',
                    padding: '6px 10px',
                    borderRadius: 8,
                    color: '#FDE68A',
                  }}
                >
                  {guestUrl}
                </code>
                <div className="chip-row noprint" style={{ marginTop: 6, justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleDownloadAdminQr}
                  >
                    <Download size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span>Download PNG</span>
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => window.print()}
                  >
                    <Printer size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span>Print All QRs</span>
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={handleCopyQrLink}
                  >
                    {copied ? (
                      <>
                        <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                        <span>Link copy ho gaya</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
                        <span>Copy link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Per-Table Individual QR Codes (#/t/1 .. #/t/N) */}
              <section className="d-card" aria-label="Per-table QR codes">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <h2 className="icon-heading" style={{ fontSize: 21 }}>
                      <QrCode size={19} strokeWidth={2.2} color="var(--gold)" aria-hidden="true" />
                      <span>Har Table ka Alag QR Code ({sortedTables.length} Tables)</span>
                    </h2>
                    <p className="dark-sub" style={{ marginTop: 3 }}>
                      Har table ka apna direct QR hai — scan karte hi wahi table auto-lock ho jayegi (`#/t/1`, `#/t/2`…).
                    </p>
                  </div>
                </div>

                <div className="admin-table-qr-grid" data-testid="admin-table-qr-grid">
                  {sortedTables.map((t) => {
                    const tUrl = buildTableQrUrl(
                      window.location.origin,
                      window.location.pathname,
                      t.num
                    );
                    const isCopied = copiedTableQr === t.num;
                    return (
                      <div
                        key={t.num}
                        className="admin-table-qr-card"
                        data-testid={`admin-table-qr-card-${t.num}`}
                      >
                        <div className="admin-table-qr-head">
                          <strong className="admin-table-qr-num tabular-nums">
                            Table {t.num}
                          </strong>
                          <span className="admin-table-qr-waiter">{t.waiter}</span>
                        </div>
                        <div className="admin-table-qr-plate">
                          <FoodQr
                            value={tUrl}
                            size={168}
                            label={`Table ${t.num} Direct Menu QR`}
                          />
                        </div>
                        <code className="admin-table-qr-url">
                          #/t/{t.num}
                        </code>
                        <div className="admin-table-qr-actions noprint">
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleDownloadTableQr(t.num)}
                            aria-label={`Download Table ${t.num} QR PNG`}
                          >
                            <Download size={13} strokeWidth={2.3} aria-hidden="true" />
                            <span>PNG</span>
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-dark"
                            onClick={() => handleCopyTableQrLink(t.num)}
                            aria-label={`Copy Table ${t.num} QR link`}
                          >
                            {isCopied ? (
                              <>
                                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ============ 7. SETTINGS ============ */}
          {tab === 'settings' && (
            <div className="d-card" style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <h2 className="icon-heading" style={{ fontSize: 22 }}>
                <Settings size={20} strokeWidth={2.2} aria-hidden="true" />
                <span>Settings</span>
              </h2>

              {/* Guest WiFi Settings */}
              <form
                onSubmit={handleSaveWifi}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--d-border)',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <strong className="dish-inline-label" style={{ fontSize: 16 }}>
                      <Wifi size={17} strokeWidth={2.2} aria-hidden="true" />
                      <span>Guest WiFi Settings</span>
                    </strong>
                    <div className="dark-sub">
                      Yahan jo WiFi Name aur Password daaloge, woh seedha customer ke Menu & Order screen par show hoga.
                    </div>
                  </div>
                  <span className="pill-badge" style={{ background: 'rgba(34, 197, 94, 0.16)', color: '#86efac' }}>
                    Live on Guest Screen
                  </span>
                </div>

                <div className="admin-form-grid">
                  <div>
                    <label htmlFor="wifi-name-input" className="d-label">
                      WiFi Name (SSID)
                    </label>
                    <input
                      id="wifi-name-input"
                      type="text"
                      className="d-input"
                      value={wifiName}
                      onChange={(e) => {
                        setWifiName(e.target.value);
                        if (wifiErr) setWifiErr('');
                      }}
                      placeholder="e.g. PandaMomo_FreeWiFi"
                      maxLength={48}
                    />
                  </div>
                  <div>
                    <label htmlFor="wifi-pass-input" className="d-label">
                      WiFi Password
                    </label>
                    <input
                      id="wifi-pass-input"
                      type="text"
                      className="d-input"
                      value={wifiPass}
                      onChange={(e) => {
                        setWifiPass(e.target.value);
                        if (wifiErr) setWifiErr('');
                      }}
                      placeholder="e.g. momo2026 (khali = Open WiFi)"
                      maxLength={64}
                    />
                  </div>
                </div>

                {wifiErr && (
                  <div role="alert" className="admin-error">
                    {wifiErr}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div className="dark-sub" style={{ fontSize: 12.5 }}>
                    Guest preview:{' '}
                    <strong style={{ color: '#fde68a' }}>{wifiName.trim() || '—'}</strong>
                    {' · '}
                    <span>{wifiPass.trim() ? `Pass: ${wifiPass.trim()}` : 'Open (No Password)'}</span>
                  </div>
                  <button type="submit" className="btn btn-sm">
                    {wifiSaved ? (
                      <>
                        <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                        <span>WiFi Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} strokeWidth={2.2} aria-hidden="true" />
                        <span>WiFi Save karo</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div
                style={{
                  borderTop: '1px solid var(--d-border)',
                  paddingTop: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <strong>New-order chime</strong>
                  <div className="dark-sub">
                    Naya order aane par Kitchen, Floor aur Admin par soft sound
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="dark-sub dish-inline-label" style={{ fontWeight: 700 }}>
                    {chimeOn ? (
                      <>
                        <Bell size={14} strokeWidth={2.2} aria-hidden="true" />
                        <span>ON</span>
                      </>
                    ) : (
                      <>
                        <BellOff size={14} strokeWidth={2.2} aria-hidden="true" />
                        <span>OFF</span>
                      </>
                    )}
                  </span>
                  <SakugaToggle
                    checked={chimeOn}
                    label="New-order chime toggle"
                    onChange={(next) => {
                      setChimeOn(next);
                      setChimeEnabled(next);
                      showSakugaToast(next ? 'Chime ON ho gayi!' : 'Chime OFF ho gayi.', 'gold', next ? 'DING!' : 'MUTE');
                    }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--d-border)', paddingTop: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <strong className="dish-inline-label">
                    <Database size={16} strokeWidth={2.2} style={{ color: '#93C5FD' }} aria-hidden="true" />
                    <span>Real-time &amp; Supabase Cloud Sync</span>
                  </strong>
                  {syncMeta.supabase?.configured && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!syncMeta.supabase.schemaReady && (
                        <button
                          type="button"
                          className="btn-ghost-dark"
                          onClick={handleCopySupaSql}
                        >
                          {sqlCopied ? (
                            <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                          ) : (
                            <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
                          )}
                          <span>{sqlCopied ? 'SQL Copied!' : 'Copy supabase.sql'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={syncingSupa}
                        onClick={handleSyncSupabase}
                      >
                        <RefreshCw
                          size={14}
                          strokeWidth={2.2}
                          className={syncingSupa ? 'animate-spin' : undefined}
                          aria-hidden="true"
                        />
                        <span>{syncingSupa ? 'Syncing…' : 'Sync Supabase'}</span>
                      </button>
                    </div>
                  )}
                </div>
                <p className="dark-sub dish-inline-label" style={{ marginTop: 6 }}>
                  <span
                    className={`nav-sync-dot ${syncMeta.connected ? 'is-live' : 'is-reconnecting'}`}
                    style={{
                      color: syncMeta.supabase?.connected
                        ? '#6EE7B7'
                        : syncMeta.connected
                          ? '#93C5FD'
                          : '#FDE68A',
                    }}
                    aria-hidden="true"
                  />
                  <span>
                    {syncMeta.supabase?.connected
                      ? `Supabase Cloud (${syncMeta.supabase.projectRef}) + Real-Time SSE ON · Rev #${syncMeta.rev}`
                      : syncMeta.supabase?.configured && !syncMeta.supabase.schemaReady
                        ? `Supabase (${syncMeta.supabase.projectRef || 'connected'}) ready — Supabase Dashboard SQL Editor mein supabase.sql run karke "Sync Supabase" dabao (abhi Local Server Stream Rev #${syncMeta.rev} active hai).`
                        : syncMeta.connected
                          ? `Real-Time Server Stream ON · Rev #${syncMeta.rev} (sabhi devices aur tabs mein instant sync)`
                          : IS_REMOTE
                            ? 'Cloud sync ON: Supabase ke saath sync ho raha hai.'
                            : 'Server stream reconnect ho raha hai (local persistence active hai).'}
                  </span>
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--d-border)', paddingTop: 14 }}>
                <strong className="dish-inline-label">
                  <ShieldCheck size={16} strokeWidth={2.2} style={{ color: '#6EE7B7' }} aria-hidden="true" />
                  <span>Admin password (PBKDF2-SHA256 Encrypted)</span>
                </strong>
                <p className="dark-sub" style={{ marginTop: 4, marginBottom: 10 }}>
                  Admin password code mein salted PBKDF2-SHA256 (120,000 iterations) digest ke roop mein encrypted stored hai aur server session token se verify hota hai.
                </p>

                <form
                  onSubmit={handleUpdateAdminPassword}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 10,
                    }}
                  >
                    <div>
                      <label htmlFor="admin-cur-pass" className="d-label">
                        Current Password
                      </label>
                      <input
                        id="admin-cur-pass"
                        type="password"
                        className="d-input"
                        value={curPass}
                        onChange={(e) => {
                          setCurPass(e.target.value);
                          if (passErr) setPassErr('');
                        }}
                        placeholder="Current password"
                        autoComplete="current-password"
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-new-pass" className="d-label">
                        New Password
                      </label>
                      <input
                        id="admin-new-pass"
                        type="password"
                        className="d-input"
                        value={newPass}
                        onChange={(e) => {
                          setNewPass(e.target.value);
                          if (passErr) setPassErr('');
                        }}
                        placeholder="Min 6 characters"
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-confirm-pass" className="d-label">
                        Confirm New Password
                      </label>
                      <input
                        id="admin-confirm-pass"
                        type="password"
                        className="d-input"
                        value={confirmPass}
                        onChange={(e) => {
                          setConfirmPass(e.target.value);
                          if (passErr) setPassErr('');
                        }}
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {passErr && (
                    <div role="alert" className="admin-error">
                      {passErr}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      className="btn btn-sm"
                      disabled={changingPass}
                    >
                      {changingPass ? (
                        'Encrypting…'
                      ) : passSaved ? (
                        <>
                          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                          <span>Password Updated!</span>
                        </>
                      ) : (
                        <>
                          <Lock size={14} strokeWidth={2.2} aria-hidden="true" />
                          <span>Password Update karo</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--d-border)',
                  paddingTop: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>Developer &amp; Support</strong>
                  <div className="dark-sub">
                    WhatsApp support ya GitHub details dekhne ke liye button dabao
                  </div>
                </div>
                <DeveloperContactButton dark />
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--d-border)',
                  paddingTop: 14,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    setConfirmState({
                      title: 'Saare orders aur calls clear karo?',
                      message: 'Menu aur stock rahega, par sabhi orders aur waiter calls hat jayenge.',
                      confirmLabel: 'Clear',
                      onConfirm: () => {
                        clearOrdersAndCalls();
                        setConfirmState(null);
                      },
                    })
                  }
                >
                  <Trash2 size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span>Clear orders &amp; calls</span>
                </button>
              </div>
            </div>
          )}
          </motion.div>
        </main>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirm'}
        danger
        dark
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
