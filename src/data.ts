export type Section = 'Chai counter' | 'Tawa' | 'Fry';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  cat: string;
  emoji: string;
  desc: string;
  allergens: string[];
  spice: 0 | 1 | 2 | 3;
  prep: number;
  section: Section;
  stock: string;
  use: number;
  img?: string;
  available: boolean;
  pos: number;
}

export type Status = 'new' | 'cooking' | 'ready' | 'served';

export interface Line {
  itemId: string;
  qty: number;
  size: 'full' | 'half';
  deal?: boolean;
}

export interface Order {
  id: number;
  table: number | null;
  channel: 'dine' | 'whatsapp';
  customer?: string;
  customerPhone?: string;
  lines: Line[];
  status: Status;
  createdAt: number;
  cookingAt?: number;
  readyAt?: number;
  servedAt?: number;
  servedBy?: string;
  etaMin?: number;
  paid: boolean;
  paidAt?: number;
  method?: string;
  tip?: number;
  by: 'guest' | 'waiter' | 'whatsapp';
}

export interface Call {
  id: number;
  table: number;
  kind: string;
  at: number;
  done: boolean;
}

export interface StockItem {
  name: string;
  qty: number;
  max: number;
  unit: string;
}

export interface Review {
  table: number;
  stars: number;
  text: string;
  at: number;
}

export interface TableConfig {
  num: number;
  waiter: string;
}

export interface CustomerRecord {
  name: string;
  phone: string;
  table: number | null;
  visits: number;
  firstVisitAt: number;
  lastVisitAt: number;
  tags?: string[];
  notes?: string;
  birthday?: string;
  loyaltyPoints?: number;
}

export interface ReceiptItem {
  name: string;
  qty: number;
  amount: number;
  deal?: boolean;
}

export type PromoPlatform = 'instagram' | 'reel' | 'google' | 'custom';

export interface PromoOffer {
  id: string;
  title: string;
  platform: PromoPlatform;
  handleOrUrl: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  minBill: number;
  description: string;
  active: boolean;
}

export interface PaidReceipt {
  total: number;
  discount?: number;
  promoTitle?: string;
  tip?: number;
  grand?: number;
  method?: string;
  txnId?: string;
  customerName?: string;
  customerPhone?: string;
  items?: ReceiptItem[];
  at: number;
}

export interface WifiConfig {
  name: string;
  password: string;
}

export interface State {
  menu: MenuItem[];
  orders: Order[];
  calls: Call[];
  stock: StockItem[];
  reviews: Review[];
  tables: TableConfig[];
  customers: CustomerRecord[];
  wifi: WifiConfig;
  promos: PromoOffer[];
  dayStart: number;
  billReq: Record<number, boolean>;
  part: Record<number, number>;
  lastPaid: Record<number, PaidReceipt>;
}

export type TableStatus = 'help' | 'free' | 'bill' | 'ordering' | 'cooking' | 'eating';

export const TABLES: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const WAITERS: Record<number, string> = {
  1: 'Ali',
  2: 'Ali',
  3: 'Ali',
  4: 'Sana',
  5: 'Sana',
  6: 'Sana',
  7: 'Ali',
  8: 'Sana',
};

export const DEFAULT_TABLES: TableConfig[] = TABLES.map((num) => ({
  num,
  waiter: WAITERS[num] || 'Ali',
}));

export const DEAL_ITEM = 'masala';
export const DEAL_PRICE = 20;
export const BRAND = 'Panda Momo';
export const DEFAULT_WIFI: WifiConfig = {
  name: 'PandaMomo_Guest',
  password: 'momo2026',
};
export const DEFAULT_PROMOS: PromoOffer[] = [
  {
    id: 'promo-insta-follow',
    title: 'Instagram Follow Offer',
    platform: 'instagram',
    handleOrUrl: '@xarvind07',
    discountType: 'percent',
    discountValue: 10,
    minBill: 0,
    description: 'Hamare Instagram page ko follow karo aur turant 10% OFF pao!',
    active: true,
  },
  {
    id: 'promo-google-review',
    title: 'Google 5★ Review Reward',
    platform: 'google',
    handleOrUrl: 'https://google.com/maps',
    discountType: 'flat',
    discountValue: 25,
    minBill: 100,
    description: 'Google par honest review likho aur ₹25 ka instant discount lo.',
    active: true,
  },
  {
    id: 'promo-insta-reel',
    title: 'Instagram Reel / Story Tag',
    platform: 'reel',
    handleOrUrl: '@xarvind07',
    discountType: 'percent',
    discountValue: 15,
    minBill: 150,
    description: 'Panda Momo ko tag karke Reel ya Story daalo aur 15% OFF pao!',
    active: true,
  },
];
export const SECTIONS: Section[] = ['Chai counter', 'Tawa', 'Fry'];
export const DEFAULT_CATS: string[] = ['Chai', 'Snacks', 'Maggi & Rolls', 'Cold', 'Meetha'];
export const PAYMENT_METHODS: string[] = ['UPI', 'Cash', 'Card', 'Google Pay', 'Apple Pay'];
export const STAFF_METHODS: string[] = ['Cash', 'Card', 'Bank transfer'];

export interface QuizQuestion {
  q: string;
  options: [string, string, string];
  correct: number;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    q: 'Chai kis paudhe ki patti se banti hai?',
    options: ['Camellia sinensis', 'Coffea arabica', 'Mentha'],
    correct: 0,
  },
  {
    q: 'Elaichi ko English mein kya kehte hain?',
    options: ['Clove', 'Cardamom', 'Cinnamon'],
    correct: 1,
  },
  {
    q: 'Darjeeling chai kis rajya ki hai?',
    options: ['West Bengal', 'Kerala', 'Gujarat'],
    correct: 0,
  },
  {
    q: 'Kulhad kis cheez ka bana hota hai?',
    options: ['Steel', 'Glass', 'Mitti'],
    correct: 2,
  },
  {
    q: 'Malaidar "Irani chai" kis sheher ki pehchaan hai?',
    options: ['Hyderabad', 'Jaipur', 'Lucknow'],
    correct: 0,
  },
];

export const SEED_MENU: MenuItem[] = [
  {
    id: 'masala',
    name: 'Masala Chai',
    price: 30,
    cat: 'Chai',
    emoji: '🍵',
    img: '/src/assets/images/dish_masala_chai_1795103490050.jpg',
    desc: 'Adrak, elaichi aur kadak patti, ubalti hui',
    allergens: ['Dairy'],
    spice: 1,
    prep: 4,
    section: 'Chai counter',
    stock: 'Doodh',
    use: 0.1,
    available: true,
    pos: 0,
  },
  {
    id: 'kulhad',
    name: 'Kulhad Chai',
    price: 40,
    cat: 'Chai',
    emoji: '🏺',
    img: '/src/assets/images/dish_kulhad_chai_1795103489812.jpg',
    desc: 'Mitti ke kulhad mein, thodi smoky',
    allergens: ['Dairy'],
    spice: 1,
    prep: 5,
    section: 'Chai counter',
    stock: 'Doodh',
    use: 0.12,
    available: true,
    pos: 1,
  },
  {
    id: 'irani',
    name: 'Irani Chai',
    price: 60,
    cat: 'Chai',
    emoji: '☕',
    img: '/src/assets/images/dish_kulhad_chai_1795103489812.jpg',
    desc: 'Hyderabadi style, malaidar aur meethi',
    allergens: ['Dairy'],
    spice: 0,
    prep: 5,
    section: 'Chai counter',
    stock: 'Doodh',
    use: 0.15,
    available: true,
    pos: 2,
  },
  {
    id: 'tulsi',
    name: 'Tulsi Adrak Chai',
    price: 35,
    cat: 'Chai',
    emoji: '🌿',
    img: '/src/assets/images/dish_masala_chai_1795103490050.jpg',
    desc: 'Tulsi aur taza adrak, halki meethi',
    allergens: ['Dairy'],
    spice: 1,
    prep: 4,
    section: 'Chai counter',
    stock: 'Doodh',
    use: 0.1,
    available: true,
    pos: 3,
  },
  {
    id: 'samosa',
    name: 'Samosa (2 pc)',
    price: 40,
    cat: 'Snacks',
    emoji: '🥟',
    img: '/src/assets/images/dish_samosa_pakoda_1795103489354.jpg',
    desc: 'Garam aloo samosa, imli-hari chutney ke saath',
    allergens: ['Gluten'],
    spice: 2,
    prep: 5,
    section: 'Fry',
    stock: 'Aloo',
    use: 0.15,
    available: true,
    pos: 4,
  },
  {
    id: 'pakoda',
    name: 'Onion Pakoda',
    price: 80,
    cat: 'Snacks',
    emoji: '🧅',
    img: '/src/assets/images/dish_samosa_pakoda_1795103489354.jpg',
    desc: 'Crispy pyaaz ke pakode',
    allergens: [],
    spice: 2,
    prep: 8,
    section: 'Fry',
    stock: 'Aloo',
    use: 0.1,
    available: true,
    pos: 5,
  },
  {
    id: 'vadapav',
    name: 'Vada Pav',
    price: 45,
    cat: 'Snacks',
    emoji: '🍔',
    img: '/src/assets/images/dish_vadapav_sandwich_1795103490000.jpg',
    desc: 'Garam vada, lehsun chutney, soft pav',
    allergens: ['Gluten'],
    spice: 2,
    prep: 6,
    section: 'Fry',
    stock: 'Bread',
    use: 0.1,
    available: true,
    pos: 6,
  },
  {
    id: 'bun',
    name: 'Bun Maska',
    price: 50,
    cat: 'Snacks',
    emoji: '🍞',
    img: '/src/assets/images/dish_vadapav_sandwich_1795103490000.jpg',
    desc: 'Tawa par sika bun, bhar ke makhan',
    allergens: ['Gluten', 'Dairy'],
    spice: 0,
    prep: 4,
    section: 'Tawa',
    stock: 'Bread',
    use: 0.1,
    available: true,
    pos: 7,
  },
  {
    id: 'sandwich',
    name: 'Veg Grilled Sandwich',
    price: 90,
    cat: 'Snacks',
    emoji: '🥪',
    img: '/src/assets/images/dish_vadapav_sandwich_1795103490000.jpg',
    desc: 'Aloo, pyaaz, tamatar aur cheese',
    allergens: ['Gluten', 'Dairy'],
    spice: 1,
    prep: 8,
    section: 'Tawa',
    stock: 'Bread',
    use: 0.2,
    available: true,
    pos: 8,
  },
  {
    id: 'maggi',
    name: 'Masala Maggi',
    price: 70,
    cat: 'Maggi & Rolls',
    emoji: '🍜',
    img: '/src/assets/images/dish_maggi_noodles_1795103491472.jpg',
    desc: 'Pyaaz-tamatar wali tapri style Maggi',
    allergens: ['Gluten'],
    spice: 2,
    prep: 7,
    section: 'Tawa',
    stock: 'Maggi',
    use: 1,
    available: true,
    pos: 9,
  },
  {
    id: 'cheesemaggi',
    name: 'Cheese Maggi',
    price: 95,
    cat: 'Maggi & Rolls',
    emoji: '🧀',
    img: '/src/assets/images/dish_maggi_noodles_1795103491472.jpg',
    desc: 'Upar se pighla hua cheese',
    allergens: ['Gluten', 'Dairy'],
    spice: 1,
    prep: 8,
    section: 'Tawa',
    stock: 'Maggi',
    use: 1,
    available: true,
    pos: 10,
  },
  {
    id: 'paneerroll',
    name: 'Paneer Roll',
    price: 110,
    cat: 'Maggi & Rolls',
    emoji: '🌯',
    img: '/src/assets/images/dish_paneer_roll_1795103490434.jpg',
    desc: 'Tikka paneer, pyaaz aur mint mayo',
    allergens: ['Gluten', 'Dairy'],
    spice: 2,
    prep: 9,
    section: 'Tawa',
    stock: 'Paneer',
    use: 0.1,
    available: true,
    pos: 11,
  },
  {
    id: 'coldcoffee',
    name: 'Cold Coffee',
    price: 110,
    cat: 'Cold',
    emoji: '🧊',
    img: '/src/assets/images/dish_cold_beverages_1795103491107.jpg',
    desc: 'Thick aur chilled, upar se chocolate',
    allergens: ['Dairy'],
    spice: 0,
    prep: 4,
    section: 'Chai counter',
    stock: 'Doodh',
    use: 0.2,
    available: true,
    pos: 12,
  },
  {
    id: 'nimbu',
    name: 'Nimbu Soda',
    price: 50,
    cat: 'Cold',
    emoji: '🍋',
    img: '/src/assets/images/dish_cold_beverages_1795103491107.jpg',
    desc: 'Meetha ya namkeen, aap batao',
    allergens: [],
    spice: 0,
    prep: 2,
    section: 'Chai counter',
    stock: '',
    use: 0,
    available: true,
    pos: 13,
  },
  {
    id: 'jalebi',
    name: 'Jalebi (100 g)',
    price: 60,
    cat: 'Meetha',
    emoji: '🥨',
    img: '/src/assets/images/dish_indian_sweets_1795103491377.jpg',
    desc: 'Garma-garam, kesar ki chashni mein',
    allergens: ['Gluten'],
    spice: 0,
    prep: 3,
    section: 'Fry',
    stock: '',
    use: 0,
    available: true,
    pos: 14,
  },
  {
    id: 'gulab',
    name: 'Gulab Jamun (2 pc)',
    price: 60,
    cat: 'Meetha',
    emoji: '🍮',
    img: '/src/assets/images/dish_indian_sweets_1795103491377.jpg',
    desc: 'Garam, elaichi wali chashni',
    allergens: ['Dairy', 'Gluten'],
    spice: 0,
    prep: 3,
    section: 'Fry',
    stock: '',
    use: 0,
    available: true,
    pos: 15,
  },
];

export const DEFAULT_MENU_IMAGES: Record<string, string> = Object.fromEntries(
  SEED_MENU.filter((m) => Boolean(m.img)).map((m) => [m.id, m.img as string])
);

const DEFAULT_CAT_IMAGES: Record<string, string> = {
  Chai: '/src/assets/images/dish_masala_chai_1795103490050.jpg',
  Snacks: '/src/assets/images/dish_samosa_pakoda_1795103489354.jpg',
  'Maggi & Rolls': '/src/assets/images/dish_maggi_noodles_1795103491472.jpg',
  Cold: '/src/assets/images/dish_cold_beverages_1795103491107.jpg',
  Meetha: '/src/assets/images/dish_indian_sweets_1795103491377.jpg',
};

export function backfillMenuImages(menu: MenuItem[]): MenuItem[] {
  return menu.map((item) => {
    const existing = typeof item.img === 'string' ? item.img.trim() : '';
    if (existing) return item;
    const fallback =
      DEFAULT_MENU_IMAGES[item.id] ??
      DEFAULT_CAT_IMAGES[item.cat] ??
      '/src/assets/images/panda_momo_menu_banner_1795084064699.jpg';
    return { ...item, img: fallback };
  });
}

export const SEED_STOCK: StockItem[] = [
  { name: 'Doodh', qty: 5, max: 40, unit: 'L' },
  { name: 'Bread', qty: 14, max: 30, unit: 'pkt' },
  { name: 'Aloo', qty: 18, max: 25, unit: 'kg' },
  { name: 'Maggi', qty: 40, max: 80, unit: 'pkt' },
  { name: 'Paneer', qty: 6, max: 10, unit: 'kg' },
];

// Live menu registry so byId() always reflects edits/deletions
let liveMenuMap = new Map<string, MenuItem>(SEED_MENU.map((m) => [m.id, m]));

export function setMenu(menu: MenuItem[]): void {
  liveMenuMap = new Map(menu.map((m) => [m.id, m]));
}

export function byId(id: string, menu?: MenuItem[]): MenuItem {
  if (menu) {
    const found = menu.find((m) => m.id === id);
    if (found) return found;
  } else {
    const found = liveMenuMap.get(id);
    if (found) return found;
  }
  return {
    id,
    name: '(removed item)',
    price: 0,
    cat: '',
    emoji: '🍽️',
    desc: '',
    allergens: [],
    spice: 0,
    prep: 5,
    section: 'Chai counter',
    stock: '',
    use: 0,
    available: false,
    pos: 999,
  };
}

export function nid(): number {
  return Date.now() * 100 + Math.floor(Math.random() * 100);
}

export function shortId(id: number): number {
  return id < 10000 ? id : id % 10000;
}

export function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function fmtMMSS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function agoMin(ts: number, now: number): number {
  return Math.max(0, Math.floor((now - ts) / 60000));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function catsOf(menu: MenuItem[], onlyAvailable = false): string[] {
  const items = onlyAvailable ? menu.filter((m) => m.available) : menu;
  const present = new Set(items.map((m) => m.cat).filter(Boolean));
  const ordered = DEFAULT_CATS.filter((c) => present.has(c));
  const custom = Array.from(present).filter((c) => !DEFAULT_CATS.includes(c));
  return [...ordered, ...custom];
}

export function linePrice(line: Line, menu?: MenuItem[]): number {
  if (line.deal) return DEAL_PRICE * line.qty;
  return byId(line.itemId, menu).price * line.qty;
}

export function orderTotal(order: Pick<Order, 'lines'>, menu?: MenuItem[]): number {
  return order.lines.reduce((sum, l) => sum + linePrice(l, menu), 0);
}

export function estimateEta(state: Pick<State, 'orders' | 'menu'>, lines: Line[] = []): number {
  const queue = state.orders.filter(
    (o) => !o.paid && (o.status === 'new' || o.status === 'cooking')
  ).length;
  const maxPrep = lines.length
    ? Math.max(...lines.map((l) => byId(l.itemId, state.menu).prep))
    : 5;
  return Math.round(Math.max(5, maxPrep) + Math.min(queue, 8) * 1.5);
}

export function orderEst(order: Order, menu?: MenuItem[]): number {
  if (typeof order.etaMin === 'number' && order.etaMin > 0) return order.etaMin;
  if (!order.lines.length) return 5;
  return Math.max(5, ...order.lines.map((l) => byId(l.itemId, menu).prep));
}

export function canShowDeal(cart: Line[], menu: MenuItem[]): boolean {
  if (cart.length === 0) return false;
  const dealItem = menu.find((m) => m.id === DEAL_ITEM && m.available);
  if (!dealItem) return false;
  if (cart.some((l) => l.deal)) return false;
  const hasChai = cart.some((l) => byId(l.itemId, menu).cat === 'Chai');
  return !hasChai;
}

export function tableOrders(state: Pick<State, 'orders'>, table: number): Order[] {
  return state.orders.filter((o) => o.table === table && !o.paid);
}

export function tableNumsOf(state: Pick<State, 'tables'>): number[] {
  const list = state.tables && state.tables.length > 0 ? state.tables : DEFAULT_TABLES;
  return [...list].sort((a, b) => a.num - b.num).map((t) => t.num);
}

export function waiterOf(state: Pick<State, 'tables'>, table: number): string {
  const found = (state.tables || DEFAULT_TABLES).find((t) => t.num === table);
  return found?.waiter || WAITERS[table] || 'Staff';
}

export function addTableToList(
  tables: TableConfig[],
  num: number,
  waiter: string
): { ok: boolean; tables: TableConfig[]; error?: string } {
  const cleanNum = Math.floor(num);
  if (!Number.isFinite(cleanNum) || cleanNum < 1 || cleanNum > 999) {
    return { ok: false, tables, error: 'Table number 1 se 999 ke beech daalo.' };
  }
  if (tables.some((t) => t.num === cleanNum)) {
    return { ok: false, tables, error: `Table ${cleanNum} pehle se bana hua hai.` };
  }
  const cleanWaiter = waiter.trim() || 'Ali';
  const next = [...tables, { num: cleanNum, waiter: cleanWaiter }].sort((a, b) => a.num - b.num);
  return { ok: true, tables: next };
}

export function deleteTableFromList(
  state: Pick<State, 'tables' | 'orders'>,
  num: number
): { ok: boolean; tables: TableConfig[]; error?: string } {
  if (state.tables.length <= 1) {
    return { ok: false, tables: state.tables, error: 'Kam se kam 1 table hona zaroori hai.' };
  }
  const hasUnpaid = state.orders.some((o) => o.table === num && !o.paid);
  if (hasUnpaid) {
    return {
      ok: false,
      tables: state.tables,
      error: `Table ${num} par active order chal raha hai, pehle bill clear karo.`,
    };
  }
  return {
    ok: true,
    tables: state.tables.filter((t) => t.num !== num),
  };
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function validateGuestProfile(
  rawName: string,
  rawPhone: string
): { ok: true; name: string; phone: string } | { ok: false; error: string } {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (name.length < 2) {
    return { ok: false, error: 'Apna naam daalo (kam se kam 2 letters).' };
  }
  const phone = normalizePhone(rawPhone);
  if (!/^[6-9]\d{9}$/.test(phone) && !/^\d{10}$/.test(phone)) {
    return { ok: false, error: '10 digit ka valid mobile number daalo.' };
  }
  return { ok: true, name, phone };
}

export function upsertCustomer(
  customers: CustomerRecord[],
  name: string,
  phone: string,
  table: number | null,
  now = Date.now(),
  incrementVisit = true
): CustomerRecord[] {
  const existingIdx = customers.findIndex((c) => c.phone === phone);
  if (existingIdx === -1) {
    return [
      {
        name,
        phone,
        table,
        visits: 1,
        firstVisitAt: now,
        lastVisitAt: now,
      },
      ...customers,
    ];
  }
  return customers.map((c, idx) =>
    idx === existingIdx
      ? {
          ...c,
          name,
          table: table ?? c.table,
          visits: incrementVisit ? c.visits + 1 : c.visits,
          lastVisitAt: now,
        }
      : c
  );
}

export function tableBill(state: Pick<State, 'orders' | 'menu'>, table: number): number {
  return tableOrders(state, table).reduce((sum, o) => sum + orderTotal(o, state.menu), 0);
}

export function tableStatus(state: Pick<State, 'orders' | 'calls' | 'billReq'>, table: number): TableStatus {
  const hasHelp = state.calls.some((c) => !c.done && c.table === table && c.kind !== 'Bill');
  if (hasHelp) return 'help';
  const unpaid = tableOrders(state, table);
  if (unpaid.length === 0) return 'free';
  if (state.billReq[table]) return 'bill';
  if (unpaid.some((o) => o.status === 'new')) return 'ordering';
  if (unpaid.some((o) => o.status === 'cooking' || o.status === 'ready')) return 'cooking';
  return 'eating';
}

export function computeBillSplit(total: number, tipPct: number, parts: number): {
  tip: number;
  grand: number;
  share: number;
} {
  const safeParts = Math.max(1, parts);
  const tip = Math.round((total * tipPct) / 100);
  const grand = total + tip;
  const share = Math.round(grand / safeParts);
  return { tip, grand, share };
}

export function isLowStock(item: StockItem): boolean {
  if (item.max <= 0) return false;
  return item.qty / item.max < 0.25;
}

export function deductStockForLines(
  stock: StockItem[],
  lines: Line[],
  menu: MenuItem[]
): StockItem[] {
  const usage = new Map<string, number>();
  for (const line of lines) {
    const item = byId(line.itemId, menu);
    if (item.stock && item.use > 0) {
      usage.set(item.stock, (usage.get(item.stock) ?? 0) + item.use * line.qty);
    }
  }
  if (usage.size === 0) return stock;
  return stock.map((s) => {
    const used = usage.get(s.name);
    if (!used) return s;
    return { ...s, qty: Math.max(0, round2(s.qty - used)) };
  });
}

export function orderFillPct(order: Order, now: number, menu?: MenuItem[]): number {
  if (order.status === 'ready' || order.status === 'served') return 100;
  const estSec = Math.max(60, orderEst(order, menu) * 60);
  const elapsedSec = Math.max(0, (now - order.createdAt) / 1000);
  const raw = 8 + (elapsedSec / estSec) * 84;
  return Math.max(4, Math.min(92, Math.round(raw)));
}

export function sanitizeWifiConfig(
  rawName: string,
  rawPassword: string
): { ok: true; wifi: WifiConfig } | { ok: false; error: string } {
  const name = rawName.trim();
  const password = rawPassword.trim();
  if (!name) {
    return { ok: false, error: 'WiFi ka naam (SSID) khali nahi ho sakta.' };
  }
  if (name.length > 48) {
    return { ok: false, error: 'WiFi ka naam 48 characters se chhota rakho.' };
  }
  if (password.length > 64) {
    return { ok: false, error: 'WiFi password 64 characters se chhota rakho.' };
  }
  return { ok: true, wifi: { name, password } };
}

export function promoActionHref(promo: Pick<PromoOffer, 'platform' | 'handleOrUrl'>): string {
  const raw = (promo.handleOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (promo.platform === 'instagram' || promo.platform === 'reel') {
    const handle = raw.replace(/^@+/, '').replace(/\s+/g, '');
    return handle ? `https://instagram.com/${handle}` : '';
  }
  return `https://${raw}`;
}

export function formatPromoBadge(promo: Pick<PromoOffer, 'discountType' | 'discountValue'>): string {
  return promo.discountType === 'percent'
    ? `${promo.discountValue}% OFF`
    : `₹${promo.discountValue} OFF`;
}

export function sanitizePromoOffer(input: {
  id?: string;
  title: string;
  platform: PromoPlatform;
  handleOrUrl: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  minBill: number;
  description: string;
  active: boolean;
}): { ok: true; promo: PromoOffer } | { ok: false; error: string } {
  const title = input.title.trim();
  const handleOrUrl = input.handleOrUrl.trim();
  const description = input.description.trim();
  const discountValue = Math.round(Number(input.discountValue));
  const minBill = Math.max(0, Math.round(Number(input.minBill) || 0));

  if (title.length < 2) {
    return { ok: false, error: 'Offer ka title daalo (kam se kam 2 akshar).' };
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { ok: false, error: 'Discount 0 se zyada hona chahiye.' };
  }
  if (input.discountType === 'percent' && discountValue > 90) {
    return { ok: false, error: 'Percent discount 90% se zyada nahi ho sakta.' };
  }
  if (input.discountType === 'flat' && discountValue > 5000) {
    return { ok: false, error: 'Flat discount ₹5000 se kam rakho.' };
  }

  const id =
    input.id && input.id.trim()
      ? input.id.trim()
      : `promo-${title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 20)}-${Date.now().toString(36).slice(-4)}`;

  return {
    ok: true,
    promo: {
      id,
      title,
      platform: input.platform,
      handleOrUrl,
      discountType: input.discountType,
      discountValue,
      minBill,
      description:
        description ||
        `Is offer ko follow karke ${formatPromoBadge({
          discountType: input.discountType,
          discountValue,
        })} discount pao!`,
      active: Boolean(input.active),
    },
  };
}

export function computePromoDiscount(
  billSubtotal: number,
  promo: PromoOffer | null | undefined
): { eligible: boolean; discount: number; reason?: string } {
  if (!promo || !promo.active || billSubtotal <= 0) {
    return { eligible: false, discount: 0 };
  }
  if (promo.minBill > 0 && billSubtotal < promo.minBill) {
    return {
      eligible: false,
      discount: 0,
      reason: `Min bill ₹${promo.minBill} chahiye (abhi ₹${billSubtotal})`,
    };
  }
  const raw =
    promo.discountType === 'percent'
      ? Math.round((billSubtotal * promo.discountValue) / 100)
      : Math.round(promo.discountValue);
  const discount = Math.max(0, Math.min(billSubtotal, raw));
  return { eligible: true, discount };
}

export interface OrderTimelineStep {
  key: Status;
  label: string;
  sub: string;
  state: 'done' | 'current' | 'pending';
  at?: number;
}

export interface OrderProgressInfo {
  estMin: number;
  estSec: number;
  elapsedSec: number;
  remainingSec: number;
  remainingMin: number;
  readyEtaAt: number;
  cookingElapsedSec: number;
  totalDurationSec: number | null;
  badgeText: string;
  headline: string;
  detailMessage: string;
  stations: Section[];
  itemCount: number;
  steps: OrderTimelineStep[];
}

export function getOrderProgressInfo(
  order: Order,
  menu: MenuItem[],
  now: number,
  waiterName: string
): OrderProgressInfo {
  const estMin = Math.max(1, order.etaMin || orderEst(order, menu));
  const estSec = estMin * 60;
  const elapsedSec = Math.max(0, Math.floor((now - order.createdAt) / 1000));
  const remainingSec =
    order.status === 'ready' || order.status === 'served'
      ? 0
      : Math.max(0, estSec - elapsedSec);
  const remainingMin = remainingSec > 0 ? Math.max(1, Math.ceil(remainingSec / 60)) : 0;
  const readyEtaAt = order.createdAt + estMin * 60_000;

  const cookingElapsedSec = order.cookingAt
    ? Math.max(0, Math.floor(((order.readyAt ?? now) - order.cookingAt) / 1000))
    : 0;

  const totalDurationSec =
    order.servedAt && order.servedAt >= order.createdAt
      ? Math.floor((order.servedAt - order.createdAt) / 1000)
      : null;

  const stationSet = new Set<Section>();
  let itemCount = 0;
  for (const l of order.lines) {
    itemCount += l.qty;
    const item = byId(l.itemId, menu);
    if (item.section) stationSet.add(item.section);
  }
  const stations = Array.from(stationSet);

  const stageIdx = (['new', 'cooking', 'ready', 'served'] as Status[]).indexOf(order.status);

  let badgeText = '📥 Kitchen Queue Mein';
  let headline = 'Order kitchen tak pahunch gaya';
  let detailMessage =
    remainingMin > 0
      ? `Approx ${estMin} min lagenge (~${remainingMin} min baaki). Jaldi hi kitchen mein banna shuru hoga.`
      : 'Aapka order queue mein sabse aage hai — bas banna shuru hone wala hai!';

  if (order.status === 'cooking') {
    badgeText = '🔥 Ban Raha Hai!';
    headline = 'Aapka order banna shuru ho gaya!';
    detailMessage =
      remainingMin > 0
        ? `Chef aapka order bana rahe hain — approx ~${remainingMin} min mein ban kar taiyaar ho jayega.`
        : 'Chef final touch de rahe hain — bas kuch hi pal mein ban jayega!';
  } else if (order.status === 'ready') {
    badgeText = '🔔 BAN GAYA! Ready';
    headline = 'Aapka order ban gaya hai!';
    detailMessage = `Garama-garam taiyaar hai! Waiter ${waiterName} abhi aapki Table${
      order.table !== null ? ` ${order.table}` : ''
    } par la raha hai.`;
  } else if (order.status === 'served') {
    badgeText = '🍽️ Serve Ho Gaya';
    headline = 'Order serve ho gaya — Enjoy karo!';
    detailMessage = `Waiter ${order.servedBy || waiterName} ne aapka order serve kar diya hai. Swadisht bhojan ka maza lo!`;
  }

  const rawSteps: Array<{ key: Status; label: string; sub: string; at?: number }> = [
    { key: 'new', label: 'Order Diya', sub: 'Kitchen ko mil gaya', at: order.createdAt },
    { key: 'cooking', label: 'Ban Raha Hai', sub: 'Chef bana rahe hain', at: order.cookingAt },
    { key: 'ready', label: 'Ban Gaya', sub: 'Serve ke liye ready', at: order.readyAt },
    { key: 'served', label: 'Serve Hua', sub: `Table par pahuncha`, at: order.servedAt },
  ];

  const steps: OrderTimelineStep[] = rawSteps.map((s, idx) => ({
    ...s,
    state: idx < stageIdx ? 'done' : idx === stageIdx ? 'current' : 'pending',
  }));

  return {
    estMin,
    estSec,
    elapsedSec,
    remainingSec,
    remainingMin,
    readyEtaAt,
    cookingElapsedSec,
    totalDurationSec,
    badgeText,
    headline,
    detailMessage,
    stations,
    itemCount,
    steps,
  };
}

export function kitchenCardTiming(
  order: Order,
  now: number,
  menu?: MenuItem[]
): {
  elapsedSec: number;
  estSec: number;
  pct: number;
  isLate: boolean;
  isAmber: boolean;
} {
  const estSec = Math.max(60, orderEst(order, menu) * 60);
  const elapsedSec = Math.max(0, Math.floor((now - order.createdAt) / 1000));
  const pct = Math.min(100, (elapsedSec / estSec) * 100);
  const isLate = order.status !== 'ready' && elapsedSec > estSec;
  const isAmber = order.status !== 'ready' && !isLate && elapsedSec > estSec * 0.75;
  return { elapsedSec, estSec, pct, isLate, isAmber };
}

export function computeStaffSpeed(orders: Order[]): Array<{ name: string; avgMin: number; count: number }> {
  const map = new Map<string, { sumMin: number; count: number }>();
  for (const o of orders) {
    if (o.servedBy && o.readyAt && o.servedAt && o.servedAt >= o.readyAt) {
      const mins = (o.servedAt - o.readyAt) / 60000;
      const cur = map.get(o.servedBy) ?? { sumMin: 0, count: 0 };
      cur.sumMin += mins;
      cur.count += 1;
      map.set(o.servedBy, cur);
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      avgMin: Math.round((v.sumMin / v.count) * 10) / 10,
      count: v.count,
    }))
    .sort((a, b) => a.avgMin - b.avgMin);
}

export function computeTopDishes(
  orders: Order[],
  menu: MenuItem[],
  limit = 5
): Array<{ id: string; name: string; emoji: string; img?: string; qty: number }> {
  const counts = new Map<string, number>();
  for (const o of orders) {
    for (const l of o.lines) {
      counts.set(l.itemId, (counts.get(l.itemId) ?? 0) + l.qty);
    }
  }
  return Array.from(counts.entries())
    .map(([id, qty]) => {
      const m = byId(id, menu);
      return { id, name: m.name, emoji: m.emoji, img: m.img, qty };
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

export function computeHourlySales(
  paidToday: Order[],
  dayStart: number,
  menu: MenuItem[]
): Array<{ hourIndex: number; label: string; amount: number }> {
  const buckets = Array.from({ length: 10 }, (_, idx) => ({
    hourIndex: idx,
    label: idx === 0 ? '10 ghante pehle' : idx === 9 ? 'abhi' : `${10 - idx}h`,
    amount: 0,
  }));
  for (const o of paidToday) {
    const ts = o.paidAt ?? o.createdAt;
    const idx = Math.floor((ts - dayStart) / 3600000);
    if (idx >= 0 && idx < 10) {
      buckets[idx].amount += orderTotal(o, menu);
    }
  }
  return buckets;
}

export function computePaymentMix(
  paidToday: Order[],
  menu: MenuItem[]
): Array<{ method: string; amount: number }> {
  const map = new Map<string, number>();
  for (const o of paidToday) {
    const m = o.method || 'Cash';
    map.set(m, (map.get(m) ?? 0) + orderTotal(o, menu));
  }
  return Array.from(map.entries())
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function makeSeed(demo: boolean, now = Date.now()): State {
  const menu = SEED_MENU.map((m) => ({ ...m, allergens: [...m.allergens] }));
  const stock = SEED_STOCK.map((s) => ({ ...s }));
  const dayStart = now - 10 * 3600 * 1000;

  if (!demo) {
    return {
      menu,
      orders: [],
      calls: [],
      stock,
      reviews: [],
      tables: DEFAULT_TABLES.map((t) => ({ ...t })),
      customers: [],
      wifi: { ...DEFAULT_WIFI },
      promos: DEFAULT_PROMOS.map((p) => ({ ...p })),
      dayStart,
      billReq: {},
      part: {},
      lastPaid: {},
    };
  }

  const cycleItems = [
    'masala',
    'samosa',
    'maggi',
    'kulhad',
    'vadapav',
    'bun',
    'coldcoffee',
    'sandwich',
    'irani',
    'pakoda',
    'paneerroll',
  ];
  const methods = ['Cash', 'Card', 'Bank transfer', 'Apple Pay'];
  const waCustomers = [
    'Priya (Delivery, Kirti Nagar)',
    'Vikas (Delivery, Patel Nagar)',
    'Neha (Delivery, Rajouri)',
    'Amit (Delivery, Naraina)',
    'Kabir (Delivery, Punjabi Bagh)',
    'Meera (Delivery, Mayapuri)',
  ];

  const orders: Order[] = [];
  const totalHistorical = 38;
  const spanMs = 9 * 3600 * 1000;
  const startHist = now - spanMs - 20 * 60 * 1000;

  const repeatDineCustomers = [
    { name: 'Aarav Verma', phone: '9876543210' },
    { name: 'Priya Singh', phone: '9811223344' },
    { name: 'Rohan Malhotra', phone: '9820456789' },
    { name: 'Sneha Kapoor', phone: '9899112233' },
    { name: 'Kabir Joshi', phone: '9711334455' },
  ];

  for (let i = 0; i < totalHistorical; i++) {
    const isWa = i % 7 === 0;
    const table = isWa ? null : (i % 8) + 1;
    const createdAt = Math.round(startHist + (i / totalHistorical) * spanMs);
    const lineCount = 2 + (i % 3); // 2-4 lines
    const lines: Line[] = [];
    for (let j = 0; j < lineCount; j++) {
      const itemId = cycleItems[(i * 3 + j * 2) % cycleItems.length];
      const existing = lines.find((l) => l.itemId === itemId);
      if (existing) {
        existing.qty += 1;
      } else {
        lines.push({ itemId, qty: j === 0 ? 2 : 1, size: 'full' });
      }
    }
    const servedBy = i % 2 === 0 ? 'Sana' : 'Ali';
    const cookDelayMin = 2;
    const readyDelayMin = 6 + (i % 4);
    const serveDelayMin = servedBy === 'Sana' ? 3 + (i % 2) * 0.8 : 6.4 + (i % 3) * 0.7;
    const cookingAt = createdAt + cookDelayMin * 60000;
    const readyAt = cookingAt + readyDelayMin * 60000;
    const servedAt = readyAt + Math.round(serveDelayMin * 60000);
    const paidAt = servedAt + 8 * 60000;
    const tot = orderTotal({ lines }, menu);
    const linkedCust =
      !isWa && i % 2 === 0
        ? repeatDineCustomers[Math.floor(i / 2) % repeatDineCustomers.length]
        : null;

    orders.push({
      id: 1001 + i,
      table,
      channel: isWa ? 'whatsapp' : 'dine',
      customer: isWa
        ? waCustomers[Math.floor(i / 7) % waCustomers.length]
        : linkedCust?.name,
      customerPhone: linkedCust?.phone,
      lines,
      status: 'served',
      createdAt,
      cookingAt,
      readyAt,
      servedAt,
      servedBy,
      etaMin: 8 + (i % 5),
      paid: true,
      paidAt: Math.min(paidAt, now - 5 * 60000),
      method: methods[i % methods.length],
      tip: i % 3 === 0 ? Math.round(tot * 0.1) : 0,
      by: isWa ? 'whatsapp' : 'guest',
    });
  }

  // Live orders per PRD section 7.3
  const liveOrders: Order[] = [
    {
      id: 2001,
      table: 1,
      channel: 'dine',
      lines: [
        { itemId: 'sandwich', qty: 1, size: 'full' },
        { itemId: 'masala', qty: 2, size: 'full' },
      ],
      status: 'served',
      createdAt: now - 22 * 60000,
      cookingAt: now - 20 * 60000,
      readyAt: now - 14 * 60000,
      servedAt: now - 10 * 60000,
      servedBy: WAITERS[1],
      etaMin: 11,
      paid: false,
      by: 'guest',
    },
    {
      id: 2002,
      table: 2,
      channel: 'dine',
      lines: [
        { itemId: 'maggi', qty: 1, size: 'full' },
        { itemId: 'coldcoffee', qty: 2, size: 'full' },
      ],
      status: 'new',
      createdAt: now - 2 * 60000,
      etaMin: 12,
      paid: false,
      by: 'guest',
    },
    {
      id: 2003,
      table: 3,
      channel: 'dine',
      lines: [
        { itemId: 'vadapav', qty: 2, size: 'full' },
        { itemId: 'kulhad', qty: 2, size: 'full' },
      ],
      status: 'cooking',
      createdAt: now - 6 * 60000,
      cookingAt: now - 5 * 60000,
      etaMin: 11,
      paid: false,
      by: 'guest',
    },
    {
      id: 2004,
      table: 4,
      channel: 'dine',
      lines: [
        { itemId: 'paneerroll', qty: 1, size: 'full' },
        { itemId: 'pakoda', qty: 1, size: 'full' },
      ],
      status: 'cooking',
      createdAt: now - 17 * 60000,
      cookingAt: now - 15 * 60000,
      etaMin: 12,
      paid: false,
      by: 'guest',
    },
    {
      id: 2005,
      table: 6,
      channel: 'dine',
      lines: [{ itemId: 'samosa', qty: 2, size: 'full' }],
      status: 'ready',
      createdAt: now - 9 * 60000,
      cookingAt: now - 7 * 60000,
      readyAt: now - 2 * 60000,
      etaMin: 9,
      paid: false,
      by: 'guest',
    },
  ];

  const calls: Call[] = [
    {
      id: 3001,
      table: 6,
      kind: 'Pani',
      at: now - 2 * 60000,
      done: false,
    },
  ];

  const reviews: Review[] = [
    {
      table: 2,
      stars: 5,
      text: 'Masala Chai aur Bun Maska ekdum kadak tha!',
      at: now - 95 * 60000,
    },
    {
      table: 5,
      stars: 4,
      text: 'Great food, a bit slow during rush hour',
      at: now - 40 * 60000,
    },
  ];

  const customers: CustomerRecord[] = [
    {
      name: 'Aarav Verma',
      phone: '9876543210',
      table: 2,
      visits: 7,
      firstVisitAt: now - 42 * 24 * 3600 * 1000,
      lastVisitAt: now - 12 * 60000,
      tags: ['VIP', 'Chai Fan'],
      notes: 'Kam cheeni wali Masala Chai aur extra hari chutney pasand hai.',
      birthday: '1997-11-24',
      loyaltyPoints: 240,
    },
    {
      name: 'Priya Singh',
      phone: '9811223344',
      table: 4,
      visits: 5,
      firstVisitAt: now - 28 * 24 * 3600 * 1000,
      lastVisitAt: now - 35 * 60000,
      tags: ['VIP', 'Spicy Lover'],
      notes: 'Instagram reel tag karti hain; Paneer Roll & Cheese Maggi regular order.',
      loyaltyPoints: 185,
    },
    {
      name: 'Rohan Malhotra',
      phone: '9820456789',
      table: 3,
      visits: 3,
      firstVisitAt: now - 19 * 24 * 3600 * 1000,
      lastVisitAt: now - 2 * 3600 * 1000,
      tags: ['Regular', 'Corporate'],
      notes: 'Office team ke saath sham ko aate hain (4-6 log).',
      loyaltyPoints: 95,
    },
    {
      name: 'Sneha Kapoor',
      phone: '9899112233',
      table: 1,
      visits: 2,
      firstVisitAt: now - 10 * 24 * 3600 * 1000,
      lastVisitAt: now - 4 * 3600 * 1000,
      tags: ['Family'],
      notes: 'Kids ke liye mild spice rakho.',
      loyaltyPoints: 60,
    },
    {
      name: 'Kabir Joshi',
      phone: '9711334455',
      table: 6,
      visits: 4,
      firstVisitAt: now - 38 * 24 * 3600 * 1000,
      lastVisitAt: now - 18 * 24 * 3600 * 1000,
      tags: ['Regular'],
      notes: '2 hafton se nahi aaye — comeback discount bhej sakte hain.',
      loyaltyPoints: 120,
    },
    {
      name: 'Ananya Sharma',
      phone: '9654889900',
      table: 5,
      visits: 1,
      firstVisitAt: now - 90 * 60000,
      lastVisitAt: now - 90 * 60000,
      tags: [],
      notes: 'First-time QR scan guest.',
      loyaltyPoints: 25,
    },
  ];

  return {
    menu,
    orders: [...orders, ...liveOrders],
    calls,
    stock,
    reviews,
    tables: DEFAULT_TABLES.map((t) => ({ ...t })),
    customers,
    wifi: { ...DEFAULT_WIFI },
    promos: DEFAULT_PROMOS.map((p) => ({ ...p })),
    dayStart,
    billReq: {},
    part: {},
    lastPaid: {},
  };
}
