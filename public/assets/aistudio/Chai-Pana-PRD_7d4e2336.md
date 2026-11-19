# Chai Pana — Restaurant OS · Product Requirements Document (PRD)

> **How to use this file:** paste the whole document into any AI coding tool (Claude Code, Cursor, Lovable, Bolt, ChatGPT, etc.) with this instruction:
> *"Build exactly what this PRD describes. Follow the data model, business rules, design tokens and screen specs literally. Do not simplify or skip sections. When finished, run the acceptance checklist in section 16."*

---

## 1. Product summary

**Chai Pana** is a single-location café / restaurant management web app (a "Restaurant OS"). One QR code on the tables opens a mobile menu; guests order, see a live ETA and a live order-progress animation, call the waiter, split the bill and pay. Staff get a floor map, a kitchen display and an admin CRM. The owner gets live reports.

It started from two reference reels showing a restaurant system (QR menu with photos/prices/deals/allergens, kitchen display with timers and late alerts, waiter call, floor map with table status, split billing and tips, review, stock alerts, WhatsApp orders, owner dashboard with top dish and fastest staff).

- **Brand:** Chai Pana (a chai café). UI language is **Hinglish** (casual Hindi written in Latin script mixed with English). All user-facing copy in section 13 must be kept.
- **Users:** (1) Guest (phone, no login), (2) Waiter (floor tablet/phone), (3) Kitchen (wall screen), (4) Admin/owner (laptop).
- **Primary goals:** zero-install ordering from one QR; order reaches the kitchen instantly; guest always knows *how long* the food will take; admin can manage orders, menu (price + photo), stock, without a developer.
- **Non-goals (v1):** real payment gateway, real WhatsApp API, room/hotel booking, multi-branch, real authentication, printing KOT/receipts, taxes/GST.

## 2. Tech stack (must match)

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript (strict), Vite |
| Animation | `framer-motion` |
| QR codes | `qrcode` (npm) → `QRCode.toDataURL` |
| Routing | Hash routes, hand-written (no router library) |
| State | One module-level store + `useSyncExternalStore` (no Redux/Zustand) |
| Persistence | `localStorage` always; optional Supabase (Postgres) via **plain REST `fetch`** (no `supabase-js`) |
| Styling | One global `index.css` with CSS variables (no Tailwind) |
| Fonts | Google Fonts: **Baloo 2** (500–800) for headings, **Plus Jakarta Sans** (400–700) for body |
| Hosting | Vercel (static build, output `dist`) |

`package.json` dependencies: `react`, `react-dom`, `framer-motion`, `qrcode`; dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/qrcode`.
`tsconfig` uses `verbatimModuleSyntax` → use `import type` / `type` modifiers for type-only imports.

## 3. File structure

```
index.html                 // fonts, theme-color #FFB81C, title "Chai Pana"
supabase.sql               // table + open RLS policies (section 11)
.env.example               // VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_PASS
src/
  main.tsx                 // renders <App/>
  App.tsx                  // hash router
  index.css                // all styles + tokens
  data.ts                  // types, seed menu, constants, helpers (byId, fmt, catsOf…)
  store.ts                 // state, selectors, actions, persistence/sync, chime
  ui.tsx                   // Logo, ChaiGlass, CountUp, PaidCheck, spring preset
  pages/
    Landing.tsx  Customer.tsx  Staff.tsx  Kitchen.tsx  Owner.tsx  Admin.tsx  Nav.tsx
```

## 4. Routes (hash based)

| Route | Screen | Audience |
|---|---|---|
| `#/` | Landing: hero + links + per-table QR codes + "Demo data reset" | everyone |
| `#/m` | **Guest menu — the ONE QR.** If no table chosen → table picker (1–8) | guest |
| `#/t/:n` | Guest menu with table `n` pre-selected (per-table QR) | guest |
| `#/admin` | Admin CRM (password gate) | owner |
| `#/staff` | Waiter floor screen | waiter |
| `#/kitchen` | Kitchen display (KDS) | kitchen |
| `#/owner` | Reports dashboard | owner |

Router: read `location.hash`; match `^#/t/(\d+)` first, then `startsWith('#/m')`, `#/admin`, `#/staff`, `#/kitchen`, `#/owner`, else Landing. Listen to `hashchange`.

## 5. Design system

### 5.1 Concept
A chai-stall identity: **marigold yellow + indigo ink**, hand-painted-signage feel, chunky pressable buttons with a hard bottom shadow. **The one memorable element is the ChaiGlass:** a glass of chai that **fills up as the order progresses**. Everything else stays quiet. Avoid generic SaaS look (no gradient washes, no tracked-caps eyebrow labels).

### 5.2 Tokens (CSS variables on `:root`)
```
--ink:#1B1A4A   --ink2:#2B2A66   --gold:#FFB81C   --gold2:#FFD36B
--milk:#FFFBF1  --paper:#fff     --line:#F0E4C8
--brown:#8A5A33 --green:#2E7D5B  --red:#E2492F    --mute:#7A7568
--f-d:'Baloo 2'  --f-b:'Plus Jakarta Sans'        --r:18px
Dark staff panels: bg #12123A, card #1C1C52, border #2B2A66, muted text #A9A5CE
```
Status colours on dark: ordering `#7FB0FF`, cooking `--gold`, eating `#5BE39A`, bill `#C79BFF`, help `--red` (card bg `#3A1630`).

### 5.3 Component styling rules
- **Primary button (`.btn`)**: gold bg, ink text, bold, radius 14px, `box-shadow: 0 3px 0 #C98A00`; on `:active` translateY(2px) and shadow 1px. `.big` = full width, 15px padding.
- **Chip**: pill, 1.5px `--line` border, white bg; `.on` = ink bg, white text.
- **Guest header**: sticky, gold bg, bottom radius 22px, `box-shadow:0 4px 0 #E8A200`; left = Logo(40) + brand name (Baloo 800, 22px) + underlined small text "Table N · {waiter} ki table · badlo"; right = ink pill with gold text "⏱ ~X min".
- **Category tabs**: pills; active pill has an ink background that **slides between tabs** (`framer-motion layoutId="catbg"`), text turns gold.
- **Menu item card**: white, 1.5px line border, radius 18; 68px rounded thumbnail (photo `object-fit:cover`, else emoji on `#FFF0C7`); name in Baloo 700 17px; description (small, muted); price bold + "· 🌶️ x · ~N min"; right side: outlined "Add" button → turns into an ink **stepper** (− qty +) once added.
- **Bottom bar** (fixed, max-width 480): optional cart bar (ink, white text, gold circular qty badge, total on right) above a 3-tab nav (🍵 Menu · ⏱️ Mera order · 🧾 Bill) with a gold indicator that slides between tabs (`layoutId="tabdot"`).
- **Bottom sheets**: backdrop `#1B1A4A88`; sheet slides up from bottom (spring), radius 26px top, grab handle.
- **Staff/Kitchen/Admin**: dark indigo theme (tokens above), cards radius 16, gold accents, `Live` indicator = green dot blinking.
- Max width of guest app: 480px centered. Staff screens are responsive (2-column grid collapses < 820px).
- Accessibility: visible focus ring (3px gold), `aria-label`s on icon buttons, `prefers-reduced-motion` disables animation.

### 5.4 Motion spec (framer-motion)
- Spring preset: `{type:'spring', stiffness:380, damping:32}`.
- Welcome screen: logo scales/rotates in; title slides up; table "coasters" pop in with stagger (0.05s).
- Menu items: fade/slide up with stagger (max 6 items); list uses `layout`; items removed fade/scale out.
- Stepper number: scales 1.4 → 1 on change. ETA pill: scales 0.85 → 1 when value changes.
- Cart bar: slides up/down with spring; cart/item sheets: slide from `y:'100%'`; tab content cross-fades (`AnimatePresence mode="wait"`).
- Tracker: card springs in; step bar active segment `scaleY 1.6`.
- Paid: green circle scales in (spring) then check mark draws (`pathLength 0→1`).
- Wrong admin password: input label shakes (x: 0,-8,8,-6,6,0).
- Kitchen/Admin cards: `layout` + enter (scale .9→1, y 20→0) / exit.
- Late kitchen card: red border with pulsing glow (CSS `throb` 1.8s). Waiter-help table: same pulse. "Call waiter" button: expanding ring (CSS `ping` 2.4s).
- Owner: KPI numbers **count up** (`animate()` 0.9s), hourly columns grow (scaleY from bottom, staggered), top-dish bars grow width.
- Steam on logo and glass loops forever (opacity/translateY keyframes).

### 5.5 Brand assets (drawn as inline SVG, no image files)
- **Logo (48×48 viewBox)**: ink rounded square (rx 14); gold tea glass (trapezoid) with a darker-brown tea band, a handle on the right, and 3 gold steam squiggles that loop (opacity 0→.9→0, y 5→-6, staggered .5s).
- **ChaiGlass (160×220 viewBox)**: ink-outlined tapered glass with handle; clip-path interior; liquid `#B8742F` is a group whose `y` animates with a spring to `fillPct`; a wave path `#C98A3F` on top scrolls horizontally forever; 3 brown steam wisps appear when fill > 60%; soft ellipse shadow beneath; when `done` an extra white check mark draws inside. Fill is clamped 4–100.

## 6. Data model (TypeScript)

```ts
type Section = 'Chai counter' | 'Tawa' | 'Fry'          // kitchen stations
interface MenuItem {
  id: string; name: string; price: number; cat: string; emoji: string; desc: string
  allergens: string[]; spice: 0|1|2|3; prep: number      // prep = minutes
  section: Section; stock: string; use: number           // stock = stock item name ('' = none), use = qty consumed per serving
  img?: string                                           // data URL (JPEG ≤640px)
  available: boolean; pos: number                        // pos = sort order
}
type Status = 'new'|'cooking'|'ready'|'served'
interface Line { itemId: string; qty: number; size: 'full'|'half'; deal?: boolean }  // size kept for compat; only 'full' used
interface Order {
  id: number; table: number|null; channel: 'dine'|'whatsapp'; customer?: string
  lines: Line[]; status: Status
  createdAt: number; cookingAt?: number; readyAt?: number; servedAt?: number; servedBy?: string
  etaMin?: number                                        // ETA frozen at placement
  paid: boolean; paidAt?: number; method?: string; tip?: number
  by: 'guest'|'waiter'|'whatsapp'
}
interface Call { id: number; table: number; kind: string; at: number; done: boolean }   // kind: Waiter | Pani | Napkin | Bill
interface StockItem { name: string; qty: number; max: number; unit: string }
interface Review { table: number; stars: number; text: string; at: number }
interface State {
  menu: MenuItem[]; orders: Order[]; calls: Call[]; stock: StockItem[]; reviews: Review[]
  dayStart: number                                       // start of the reporting window
  billReq: Record<number, boolean>                       // table → guest asked for bill
  part: Record<number, number>                           // table → number of split payers who already paid
  lastPaid: Record<number, {total:number; at:number}>    // table → last closed bill (drives thank-you/review screen)
}
```

**IDs:** `nid() = Date.now()*100 + random(0..99)` for orders and calls (works across devices without collisions). Display id = `shortId(id) = id < 10000 ? id : id % 10000`. Menu item id for new items = `'i' + Date.now().toString(36)`.

**Constants:** `TABLES=[1..8]`; `WAITERS = {1:'Ali',2:'Ali',3:'Ali',4:'Sana',5:'Sana',6:'Sana',7:'Ali',8:'Sana'}`; `DEAL_ITEM='masala'`; `DEAL_PRICE=20`; `BRAND='Chai Pana'`; `SECTIONS=['Chai counter','Tawa','Fry']`; default category order `['Chai','Snacks','Maggi & Rolls','Cold','Meetha']` (custom categories appended after).

`byId(id)` returns the live menu item or a placeholder `{name:'(removed item)', price:0, prep:5}` so old orders never crash after a delete.

## 7. Seed data

### 7.1 Menu (exact)
| id | Name | ₹ | Cat | Emoji | Description | Allergens | Spice | Prep | Section | Stock | Use |
|---|---|---|---|---|---|---|---|---|---|---|---|
| masala | Masala Chai | 30 | Chai | 🍵 | Adrak, elaichi aur kadak patti, ubalti hui | Dairy | 1 | 4 | Chai counter | Doodh | 0.1 |
| kulhad | Kulhad Chai | 40 | Chai | 🏺 | Mitti ke kulhad mein, thodi smoky | Dairy | 1 | 5 | Chai counter | Doodh | 0.12 |
| irani | Irani Chai | 60 | Chai | ☕ | Hyderabadi style, malaidar aur meethi | Dairy | 0 | 5 | Chai counter | Doodh | 0.15 |
| tulsi | Tulsi Adrak Chai | 35 | Chai | 🌿 | Tulsi aur taza adrak, halki meethi | Dairy | 1 | 4 | Chai counter | Doodh | 0.1 |
| samosa | Samosa (2 pc) | 40 | Snacks | 🥟 | Garam aloo samosa, imli-hari chutney ke saath | Gluten | 2 | 5 | Fry | Aloo | 0.15 |
| pakoda | Onion Pakoda | 80 | Snacks | 🧅 | Crispy pyaaz ke pakode | — | 2 | 8 | Fry | Aloo | 0.1 |
| vadapav | Vada Pav | 45 | Snacks | 🍔 | Garam vada, lehsun chutney, soft pav | Gluten | 2 | 6 | Fry | Bread | 0.1 |
| bun | Bun Maska | 50 | Snacks | 🍞 | Tawa par sika bun, bhar ke makhan | Gluten, Dairy | 0 | 4 | Tawa | Bread | 0.1 |
| sandwich | Veg Grilled Sandwich | 90 | Snacks | 🥪 | Aloo, pyaaz, tamatar aur cheese | Gluten, Dairy | 1 | 8 | Tawa | Bread | 0.2 |
| maggi | Masala Maggi | 70 | Maggi & Rolls | 🍜 | Pyaaz-tamatar wali tapri style Maggi | Gluten | 2 | 7 | Tawa | Maggi | 1 |
| cheesemaggi | Cheese Maggi | 95 | Maggi & Rolls | 🧀 | Upar se pighla hua cheese | Gluten, Dairy | 1 | 8 | Tawa | Maggi | 1 |
| paneerroll | Paneer Roll | 110 | Maggi & Rolls | 🌯 | Tikka paneer, pyaaz aur mint mayo | Gluten, Dairy | 2 | 9 | Tawa | Paneer | 0.1 |
| coldcoffee | Cold Coffee | 110 | Cold | 🧊 | Thick aur chilled, upar se chocolate | Dairy | 0 | 4 | Chai counter | Doodh | 0.2 |
| nimbu | Nimbu Soda | 50 | Cold | 🍋 | Meetha ya namkeen, aap batao | — | 0 | 2 | Chai counter | — | 0 |
| jalebi | Jalebi (100 g) | 60 | Meetha | 🥨 | Garma-garam, kesar ki chashni mein | Gluten | 0 | 3 | Fry | — | 0 |
| gulab | Gulab Jamun (2 pc) | 60 | Meetha | 🍮 | Garam, elaichi wali chashni | Dairy, Gluten | 0 | 3 | Fry | — | 0 |

All `available:true`, `pos` = row index.

### 7.2 Stock
`Doodh 5/40 L` (intentionally low → triggers alert), `Bread 14/30 pkt`, `Aloo 18/25 kg`, `Maggi 40/80 pkt`, `Paneer 6/10 kg`.

### 7.3 Demo orders (local mode only; remote mode starts with no orders/calls/reviews)
- `dayStart = now − 10 h`.
- ~38 historical **paid + served** orders spread evenly across the last ~9 h, tables 1–8 round-robin, 2–4 lines each cycling through `masala, samosa, maggi, kulhad, vadapav, bun, coldcoffee, sandwich, irani, pakoda, paneerroll`; alternate `servedBy` Ali/Sana (Sana faster: ready→served 3–4 min, Ali 6–8 min); payment methods cycle Cash/Card/Bank transfer/Apple Pay; every 7th order is `whatsapp`.
- Live orders: T1 served (sandwich + 2 masala), T2 new (maggi + 2 cold coffee), T3 cooking 6 min ago (2 vada pav + 2 kulhad), **T4 cooking 17 min ago (paneer roll + pakoda) → shows LATE**, T6 ready (2 samosa).
- One open call: T6 "Water"/"Pani". Two reviews (5★ "Biryani was fantastic"/ 4★ "Great food, a bit slow" — any text).

## 8. Business rules

1. **Order lifecycle:** `new → cooking → ready → served`. Kitchen moves new→cooking ("Banana shuru") and cooking→ready ("Ready ✓"). Waiter/Admin moves ready→served (stores `servedBy`: `WAITERS[table]` or `'Admin'`). Setting a status stamps `cookingAt/readyAt/servedAt`.
2. **Placing an order** (guest, waiter, or simulated WhatsApp): create `Order{status:'new', createdAt:now, etaMin: estimateEta(state, lines), paid:false}`; **deduct stock** for every line: `stock[item.stock].qty = max(0, round2(qty − item.use × line.qty))` (skip if item has no stock link).
3. **ETA:** `estimateEta(state, lines) = round( max(5, max(item.prep for lines)) + min(queue, 8) × 1.5 )` where `queue` = count of unpaid orders with status `new` or `cooking`. Shown (a) in the guest header and menu as "⏱ ~X min" (computed with no lines → base 5), (b) in the cart sheet for the actual cart, (c) frozen on the order (`etaMin`) and used for the countdown. `orderEst(o) = o.etaMin ?? max prep of its lines`.
4. **Line price:** `item.price × qty`; if `line.deal` → `DEAL_PRICE(20) × qty`. **Order total** = sum of line prices. No tax.
5. **Deal upsell:** in the cart sheet, if cart is non-empty, contains **no item of category "Chai"**, no deal line yet, and the deal item exists → show a dashed upsell row "🍵 Saath mein Masala Chai sirf ₹20 mein? **Add**" that adds `{itemId:'masala', qty:1, deal:true}`.
6. **Table status (derived, priority order):** `help` if any un-done call with kind ≠ 'Bill'; `free` if no unpaid orders; `bill` if `billReq[table]`; `ordering` if any order `new`; `cooking` if any `cooking`/`ready`; else `eating`. Table bill = sum of totals of its unpaid orders.
7. **Kitchen timers:** elapsed = now − createdAt; est = `orderEst × 60 s`. **Late** if status ≠ ready and elapsed > est (red pulsing card + "LATE" tag); amber timer text when elapsed > 75 % of est. Progress bar = elapsed/est (max 100 %). Ready cards are dimmed (opacity .55) and show "Waiter ko alert gaya". Kitchen shows only unpaid, not-served orders, sorted oldest first, filterable by station (All / Chai counter / Tawa / Fry) — when filtered, each card lists only that station's lines and orders with no lines for that station are hidden.
8. **Waiter calls:** `callWaiter(table, kind)` replaces any open identical call for that table. Kinds: Waiter, Pani, Napkin, Bill. Requesting a bill also sets `billReq[table]=true`. Waiter resolves with "Aa raha hu".
9. **Payments (split bill):** guest chooses split 1/2/3, tip 0/5/10/15 % (default 10 %), method (UPI, Cash, Card, Google Pay, Apple Pay; default UPI). `tip = round(total × tipPct)`; `share = round((total + tip) / parts)`. Each tap of "Pay ₹share" calls `payShare(table, parts, method, tip)`: increments `part[table]`; split selector is disabled after the first payer; when `part == parts` → mark **all** the table's unpaid orders `paid=true, paidAt=now, method, tip` (tip divided across orders), set `lastPaid[table]={total,at}`, resolve all calls, clear `part` and `billReq` for the table. Staff can also "Collect · Cash/Card/Bank transfer" = full payment in one tap. **Revenue excludes tips.**
10. **Post-payment (guest Bill tab):** when the table has no unpaid orders and `lastPaid[table]` exists → show animated check, "₹X paid", optional receipt-email input (cosmetic: shows "Receipt … par bhej di gayi."), 1–5 star rating + optional text → `addReview`, then "Shukriya! Phir aana 🙏".
11. **Stock alert:** low when `qty / max < 0.25`. Shown in Admin Overview ("Dhyan do"), Admin Stock bar (red), Owner Reports (warning line + Restock button).
12. **New-order chime:** a hook counts orders with status `new`; when the count increases, play a soft two-note sine chime (660 Hz then 880 Hz, 0.16 s apart, via Web Audio, gain ramp to .25) unless `localStorage.chime === 'off'`. Used on Admin, Kitchen and Floor. Also plays once on successful admin login (unlocks audio).
13. **Reporting window:** "today" = paid orders with `paidAt ≥ dayStart`.
14. **WhatsApp/Delivery orders:** Floor screen has a "+ Simulate WhatsApp order" button that creates a `whatsapp` order (no table) with 4 masala + 2 samosa, customer "Rahul (Delivery, Naraina)". Kitchen shows them as "WhatsApp · {customer}" / "Delivery". (Real WhatsApp API is out of scope.)
15. **Menu edits are live:** hiding an item removes it from the guest menu; deleting is allowed (history shows "(removed item)"); empty categories disappear from the guest tabs; new categories appear automatically.

## 9. Screen specs

### 9.1 Landing `#/`
Gold hero (logo 96 + "Chai Pana" 58px + one-line pitch + sync status line "☁️ Cloud sync ON: sab devices live" or "💾 Local demo mode: data sirf is browser mein"). Below: 5 link cards (Guest menu `#/m`, Admin, Waiter floor, Kitchen, Reports) with hover lift, then "Table ke QR" grid — 8 QR images (URL = `origin + pathname + '#/t/N'`, width 240, margin 1), then "Demo data reset karo" button (confirm → `resetDemo()`).

### 9.2 Guest `#/m` and `#/t/:n`
1. **Table picker** (only if no table): full gold screen, logo, "Chai Pana", "Aap kis table par baithe ho? Number chuno, chai aur snacks seedha wahin aayenge.", 8 round ink coasters (gold numerals) in a 4-column grid. Choice stored in `sessionStorage['tbl']`. "badlo" in the header clears it.
2. **Menu tab:** search box ("Chai, samosa, maggi…"), category pills, list of **available** items only. Searching ignores category and filters by name (case-insensitive); empty result: "Is naam ki koi dish nahi mili. Doosra naam try karo." Tapping the card (not the button) opens the **item sheet**: large photo/emoji (springs in), name, description, Allergens (red tags or green "Koi nahi"), "Teekha" (🌶️ count or "Mild"), "Banne mein ~N min", stepper, and "Add · ₹" / "Done · ₹" button.
3. **Cart bar → Cart sheet** "Aapka order": lines with ✕, deal upsell (rule 5), Total, "⏱ Aane mein ~X min", big "Order bhejo · ₹total" → places order, clears cart, switches to the tracker tab.
4. **Mera order tab (tracker):** for every unpaid order of this table: "Order #id", headline by status (`new` "Order kitchen tak pahunch gaya", `cooking` "Aapki chai ban rahi hai", `ready` "Ready! Waiter la raha hai", `served` "Enjoy karo!"), **ChaiGlass** with fill = `ready/served ? 100 : min(92, 8 + elapsed/est × 84)`, MM:SS countdown (`est − elapsed`, label "min baaki" or "bas aane hi wala hai") while new/cooking, 4-segment progress, items list. Then: WiFi card (**ChaiPana_Guest / chai2026**), 2-player **Chai quiz** (Aman & Riya alternate turns, 5 questions, 0.9 s feedback, final "X jeeta! 🎉"/"Barabri!", "Phir se"), then the **"Kuch chahiye?"** card with a big pulsing gold "🔔 Waiter ko bulao" button + chips "Pani", "Napkin", and a green tag "Waiter aa raha hu (…)" while a call is open.
   Quiz (question → options, correct first-index shown): Chai kis paudhe ki patti se banti hai? [Camellia sinensis ✓, Coffea arabica, Mentha] · Elaichi ko English mein kya kehte hain? [Clove, Cardamom ✓, Cinnamon] · Darjeeling chai kis rajya ki hai? [West Bengal ✓, Kerala, Gujarat] · Kulhad kis cheez ka bana hota hai? [Steel, Glass, Mitti ✓] · Malaidar "Irani chai" kis sheher ki pehchaan hai? [Hyderabad ✓, Jaipur, Lucknow].
5. **Bill tab:** see rules 9–10. Empty state "Bill khaali hai. Order karne ke baad yahan bill dikhega." Also a chip "🧾 Waiter ko bulao" (= Bill call).

### 9.3 Floor `#/staff` (dark)
- Alerts panel (only when something pending): open calls ("Table N · {kind} maanga ({waiter})" → "Aa raha hu") and ready orders ("🍽️ Table N ready hai (#id)" → "Served ✓").
- Left: 8-table grid (button per table: `T{n}`, status word, bill amount if not free; coloured border by status; selected has outline) + WhatsApp/Delivery orders panel with the simulate button.
- Right: selected table detail — waiter name + status tag, its unpaid orders with lines/prices, "Served ✓" on ready orders, Total, "Collect · Cash / Card / Bank transfer" buttons, then "Add dish" chips (all **available** menu items) building a draft list (qty increments, ✕ removes) and "Send to kitchen →" (`by:'waiter'`).

### 9.4 Kitchen `#/kitchen`
Header + station filter chips + count ("N active orders · naya order aane par chime bajti hai"). Grid of order cards (rule 7): title "Table N" or "WhatsApp · name", running MM:SS timer, subtitle "#id · Dine-in/Delivery · status", line list, progress bar, buttons "Banana shuru" (new) / "Ready ✓" (cooking). Empty: "Koi active order nahi. Guest ke order ka intezaar…".

### 9.5 Reports `#/owner`
5 KPI cards (count-up): Aaj ki sale (₹), Open tables ka bill, Orders (all), Avg ticket, Rating (avg ★ with count). Panels: Hourly sales (10 columns from `dayStart`, 1 h buckets, labels "10 ghante pehle" … "abhi"); 🏆 Top dishes (top 5 by quantity, bars); ⚡ Sabse tez staff (avg minutes readyAt→servedAt per `servedBy`, fastest first with 🥇) + Payment mix (₹ per method, bars) + count of WhatsApp orders; 📦 Stock (bars, red if low, Restock button restores to `max`, warning "Khatam hone se pehle alert: X kam hai."); ⭐ Recent reviews (last 5, stars + table + text).

### 9.6 Admin `#/admin`
**Login:** dark screen, logo, "Admin login", "Chai Pana CRM", password field. Correct password = `import.meta.env.VITE_ADMIN_PASS` or default **`ChaiPana@2026`** → `sessionStorage.adm='1'`. Wrong → shake + "Password galat hai. Dobara try karo." (Client-side only — see section 15.)
**Header row:** tab chips with a live-order count badge on Orders, sync status ("☁️ Cloud sync ON"/"💾 Local mode"), Logout.
**Tabs:**
1. **🏠 Overview:** KPIs (Aaj ki sale, Live orders, Menu items, Stock kam) · "Abhi ke orders" (last 5 live) with link to Orders · "Dhyan do" (low-stock rows with Restock).
2. **🧾 Orders:** toggle Live / Paid-history (max 60, newest first). Card: table or WhatsApp name, status tag, PAID tag, "#id · X min pehle · ETA ~N min", line items with prices, total, status action buttons (Banana shuru → Ready → Served).
3. **📋 Menu:** left list (thumb, name, "cat · ₹price", Hide/Show, Edit) + "+ Naya item"; right edit form: **photo upload** (file input, client-side resize to max 640 px JPEG q .78 → data URL; "Photo hatao"), Naam, Price, Banne ka time (min), Category (select of existing + "+ Nayi category" → text field), Kitchen section, Teekha 0–3, Emoji (fallback when no photo), **Stock se jodo** (select of stock items) + "Ek serving mein use" (disabled without stock), Description, Allergens (comma separated), Save karo (needs name, price > 0, and category name if new), Cancel, Delete (confirm).
4. **📦 Stock:** rows with bar, editable quantity number input, "/ max unit", Full (restock), ✕ delete (confirm); right form to add (name, current qty, full-stock max, unit; blocks duplicates, case-insensitive).
5. **🔳 QR:** big QR of `origin + pathname + '#/m'` (width 520, margin 2, white card), URL text, Print (`window.print`, `.noprint` hides chrome), Copy link.
6. **⚙️ Settings:** chime ON/OFF (stored in `localStorage.chime`; plays a sample when turned on), sync info, note that password comes from `VITE_ADMIN_PASS`, "Clear" all orders/calls (confirm), "Reset" to demo data (confirm).

## 10. State, persistence & sync architecture

- **Store:** a module-level `state: State`; `set(fn)` = compute next state → `setMenu()` (so `byId` sees the live menu) → write `localStorage['chai-pana-v1']` → `push(prev,next)` → notify subscribers. Components use `useSyncExternalStore`. A `useNow(ms)` hook ticks clocks. `storage` events keep other tabs of the same browser in sync.
- **Local mode** (no env vars): seeds demo data; everything lives in that browser only.
- **Cloud mode** (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set): REST calls to `${URL}/rest/v1/<table>`, headers `apikey: KEY`, `Content-Type: application/json`, and `Authorization: Bearer KEY` **only if the key starts with `eyJ`** (legacy anon JWT; new publishable keys must not be sent as Bearer).
  - **Tables** (each `id text primary key, data jsonb`): `menu_items`, `orders`, `calls`, `reviews`, `stock`, `meta`.
  - **Keys:** menu_items→item id; orders/calls→String(id); reviews→`${table}-${at}`; stock→name; meta→rows `billReq`, `part`, `lastPaid`, `dayStart`.
  - **Diff-based push:** after every `set`, compare previous vs next state per table by `JSON.stringify`; upsert changed rows (`POST` array with header `Prefer: resolution=merge-duplicates`) and `DELETE ?id=eq.<id>` for removed ones. Set `busyUntil = now + 2500 ms`.
  - **Poll pull:** every 2.5 s (and on tab visibility) `GET <table>?select=id,data` for all 6 tables; skip while `now < busyUntil` (prevents flicker/revert of optimistic writes); rebuild State (menu sorted by `pos`, orders by `createdAt`, reviews by `at`, stock by name); replace state only if JSON differs. Network errors are swallowed (keep local state).
  - **First run:** if remote `menu_items` and `meta` are both empty → push the local seed (menu, stock, no demo orders).
  - Initial load: use cached localStorage state if it has a `menu`, else seed (`demo = !REMOTE`).
  - Reset: `resetDemo()` = replace state with fresh seed (diff push deletes/rewrites remote rows).

## 11. Supabase SQL (`supabase.sql`)
```sql
do $$
declare t text;
begin
  foreach t in array array['menu_items','orders','calls','reviews','stock','meta'] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "demo_all" on public.%I', t);
    execute format('create policy "demo_all" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;
```
(Open policies = demo only; see section 15.)

## 12. Environment variables
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...            # anon (eyJ…) or publishable (sb_publishable_…) key
VITE_ADMIN_PASS=ChaiPana@2026         # default if omitted
```
Set the same on Vercel (Project → Settings → Environment Variables) and redeploy.

## 13. UI copy (keep Hinglish, sentence case, active voice)
Buttons/labels: "Add", "Order bhejo · ₹X", "Order dekho", "Banana shuru", "Ready ✓", "Served ✓", "Aa raha hu", "Save karo", "Photo chuno", "+ Naya item", "Collect · Cash", "Send to kitchen →", "Review bhejo", "Pay ₹X", "Restock", "Login", "Logout".
Empty/error: "Koi active order nahi. Guest ke order ka intezaar…", "Abhi koi order nahi. Guest QR scan karke order karega to yahan turant dikhega.", "Bill khaali hai. Order karne ke baad yahan bill dikhega.", "Password galat hai. Dobara try karo.", "Is naam ki koi dish nahi mili. Doosra naam try karo."
Tabs: Menu · Mera order · Bill. Admin tabs: Overview · Orders · Menu · Stock · QR · Settings.
Rule: an action keeps the same name everywhere (e.g. "Banana shuru" in Kitchen and Admin).

## 14. Non-functional requirements
- Mobile-first guest UI (≥ 320 px wide, safe-area padding under tab bar); staff screens usable on tablet/laptop.
- Initial JS bundle ≈ < 300 kB min (≈ 90 kB gzip). No server code. No images in repo (photos stored as small data URLs).
- Works offline-tolerant: UI keeps working from local state if the network drops; syncs on recovery.
- `prefers-reduced-motion` respected; keyboard focus visible; all icon-only buttons have `aria-label`.
- TypeScript strict; `tsc -b` and `vite build` must pass with no errors.

## 15. Known limitations / recommended v2
1. **Security:** admin password is checked in the browser and `VITE_*` values ship in the JS bundle; Supabase policies are fully open. For real customers: Supabase Auth (email/magic-link) for staff/admin roles, RLS that lets anonymous guests only `insert` orders/calls/reviews and `select` available menu items, move payments server-side.
2. **Payments** are simulated (no UPI/Razorpay/Cashfree). **WhatsApp** orders are simulated.
3. Polling (2.5 s) instead of Supabase Realtime; photos as data URLs instead of Supabase Storage.
4. No GST/tax, discounts/coupons, printing, multi-branch, per-item modifiers, or table-merge.
5. ETA is a heuristic (prep + 1.5 min per queued order, max 8) — can be replaced by learned averages from `readyAt − createdAt`.

## 16. Acceptance checklist (the AI must verify each)
1. `npm install && npm run build` succeeds; app runs with no env vars (local mode) and shows demo data.
2. `#/m` shows table picker; picking 5 shows the menu with header "Table 5 · Sana ki table"; header ETA pill present.
3. Adding Masala Chai (+) shows a stepper; cart bar shows count and total; cart sheet shows total and "Aane mein ~X min"; with only a Snack in cart the ₹20 chai upsell appears and disappears once any Chai is in the cart.
4. Placing the order switches to "Mera order", shows ChaiGlass + countdown; the Kitchen screen shows the card within 1 s (same browser) and the chime plays on staff screens.
5. Kitchen "Banana shuru" → guest headline changes to "Aapki chai ban rahi hai"; "Ready ✓" → glass full and Floor alert "Table N ready hai"; Floor "Served ✓" → guest shows "Enjoy karo!".
6. Seeded T4 order shows LATE (red pulsing). Table 6 shows HELP on Floor; "Aa raha hu" clears it.
7. Guest bill: split 2 ways + 10 % tip on ₹95 shows "Pay ₹53" (tip = round(9.5) = 10; share = round((95+10)/2) = 53 — implement exactly `Math.round((total + Math.round(total*tipPct/100))/parts)`); the second payer closes the table; Bill tab shows animated check, review form; Reports rating updates.
8. Admin: wrong password → shake + error; `ChaiPana@2026` → Overview. Add item "Elaichi Special Chai" ₹55 with a photo in category Chai linked to Doodh → appears in the guest Chai tab within 3 s (cloud mode) / instantly (same browser); ordering it lowers Doodh stock.
9. Admin Stock: edit qty, add new stock item (duplicate name blocked), delete, Full. Overview shows ⚠️ for stock < 25 %.
10. Admin Orders live/history toggle works and status buttons progress the order; Settings → Clear removes all orders.
11. Cloud mode with two different browsers (guest on phone, admin on laptop): order, status change, menu add all propagate within ~3 s; first run seeds menu + stock into empty tables.
12. Reports: KPIs count up; hourly bars, top dishes, staff speed (Sana faster than Ali in seed), payment mix, stock restock all render.
13. No console errors; layout intact at 375 px width (guest) and 1200 px (admin).

## 17. Build order for the AI (recommended)
1. Scaffold Vite + React + TS; install `framer-motion`, `qrcode`. 2. `data.ts` (types, seed menu, helpers). 3. `store.ts` (state, seed, selectors, actions, ETA, chime, localStorage). 4. `index.css` tokens + components. 5. `ui.tsx` (Logo, ChaiGlass, CountUp, PaidCheck). 6. Customer flow. 7. Kitchen → Floor → Reports. 8. Admin (login, then tabs one by one). 9. Landing + router. 10. Cloud sync layer + `supabase.sql` + README. 11. Run section 16 checklist, fix, deploy to Vercel.
