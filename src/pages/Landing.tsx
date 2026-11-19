import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  Coffee,
  Copy,
  Download,
  Flame,
  LayoutGrid,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { BRAND } from '../data';
import { resetDemo, useStore } from '../store';
import { showSakugaToast } from '../sakuga';
import { buildMasterQrUrl, computeLandingSummary } from '../landingSummary';
import { FoodQr, renderFoodQrStandeePng } from '../components/FoodQr';
import { ConfirmDialog, CountUp, DeveloperContactButton, Logo, SPRING } from '../ui';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const HERO_FEAST_IMG = '/src/assets/images/panda_momo_hero_feast_1795084063789.jpg';
const WORKSPACE_GUEST_IMG = '/src/assets/images/panda_momo_menu_banner_1795084064699.jpg';

export default function Landing() {
  const state = useStore();
  const summary = useMemo(() => computeLandingSummary(state), [state]);

  const masterQrUrl = useMemo(() => {
    if (typeof window === 'undefined') return '#/m';
    return buildMasterQrUrl(window.location.origin, window.location.pathname);
  }, []);

  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [bannerImgFailed, setBannerImgFailed] = useState(false);

  async function handleCopyMasterLink() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(masterQrUrl);
      copied = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = masterQrUrl;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedLink(true);
      showSakugaToast('Single QR menu link copy ho gaya!', 'green', 'COPIED');
      window.setTimeout(() => setCopiedLink(false), 2200);
    } else {
      showSakugaToast(`Scan URL: ${masterQrUrl}`, 'gold', 'LINK');
    }
  }

  async function handleDownloadMasterQr() {
    try {
      const dataUrl = await renderFoodQrStandeePng(
        masterQrUrl,
        BRAND,
        'Scan for Menu & Table Order'
      );
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'panda-momo-food-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSakugaToast('Food-style Menu QR PNG download ho gaya!', 'green', 'SAVED');
    } catch {
      showSakugaToast('QR download karne mein issue aaya, phir try karo.', 'red', 'ERR');
    }
  }

  function handleConfirmReset() {
    resetDemo();
    setConfirmOpen(false);
    setResetMsg('Demo data reset ho gaya!');
    showSakugaToast('Demo data reset ho gaya!', 'gold', 'RESET!');
    window.setTimeout(() => setResetMsg(''), 2500);
  }

  const secondaryWorkspaces = useMemo(
    () => [
      {
        href: '#/staff',
        kicker: 'Floor Operations',
        title: 'Waiter Floor Map',
        sub: 'Live table status grid, call alerts, WhatsApp delivery orders & fast table settlement.',
        meta: `${summary.freeTables} free · ${summary.openHelpCalls} help calls`,
      },
      {
        href: '#/kitchen',
        kicker: 'Prep Display',
        title: 'Kitchen Display (KDS)',
        sub: 'Station filter tabs, live prep countdowns, late alerts and 1-tap ready chime.',
        meta: `${summary.activeKitchenOrders} orders in queue · ~${summary.liveEtaMin} min`,
      },
      {
        href: '#/owner',
        kicker: 'Analytics',
        title: 'Owner Reports',
        sub: 'Hourly sales trend, best-selling momos & chai, staff speed leaderboard & low stock.',
        meta: `${summary.availableDishes} active items · Live ledger`,
      },
    ],
    [summary]
  );

  return (
    <div className="landing-page">
      {/* 3-Zone Editorial Top Bar */}
      <header className="landing-topbar">
        <div className="landing-topbar-inner">
          <a href="#/" className="landing-brand">
            <Logo size={34} />
            <span>{BRAND}</span>
          </a>

          <nav className="landing-nav-links" aria-label="Primary navigation">
            <a href="#/m">Guest Menu</a>
            <a href="#/admin">Admin CRM</a>
            <a href="#/staff">Floor Map</a>
            <a href="#/kitchen">Kitchen</a>
            <a href="#/owner">Reports</a>
          </nav>

          <a href="#/m" className="btn btn-sm landing-nav-cta">
            <UtensilsCrossed size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Open Menu</span>
            <ArrowRight size={14} strokeWidth={2.3} aria-hidden="true" />
          </a>
        </div>
      </header>

      <main className="landing-body">
        {/* 2-Column Editorial Split Hero */}
        <section className="landing-hero-split" aria-label="Panda Momo overview">
          <div className="landing-hero-copy">
            <motion.span
              className="landing-kicker"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
            >
              Artisanal Momos · Kulhad Chai · Smart Cafe OS
            </motion.span>
            <motion.h1
              className="landing-title"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.04, ease: EASE_OUT }}
            >
              Har table par garma-garam swad, ek single QR ke saath.
            </motion.h1>
            <motion.p
              className="landing-pitch"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.08, ease: EASE_OUT }}
            >
              Bas ek universal QR scan karo, apna naam aur number daalo, khaali table chuno aur live
              kitchen countdown ke saath order track karo.
            </motion.p>

            <motion.div
              className="landing-hero-actions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: 0.12, ease: EASE_OUT }}
            >
              <motion.a
                href="#/m"
                className="btn landing-cta-primary"
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
              >
                <UtensilsCrossed size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>Guest Menu Kholo</span>
                <ArrowRight size={16} strokeWidth={2.3} aria-hidden="true" />
              </motion.a>
              <motion.a
                href="#/admin"
                className="chip landing-cta-secondary"
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
              >
                <ShieldCheck size={15} strokeWidth={2.2} aria-hidden="true" />
                <span>Admin CRM</span>
              </motion.a>
            </motion.div>

            <motion.div
              className="landing-hero-metrics"
              aria-label="Live cafe snapshot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.16, ease: EASE_OUT }}
            >
              <div className="landing-metric">
                <strong className="tabular-nums">
                  <CountUp value={summary.availableDishes} />
                </strong>
                <span>Fresh Dishes</span>
              </div>
              <div className="landing-metric">
                <strong className="tabular-nums">
                  <CountUp value={summary.freeTables} />/{summary.totalTables}
                </strong>
                <span>Free Tables Now</span>
              </div>
              <div className="landing-metric">
                <strong className="tabular-nums">
                  <CountUp value={summary.liveEtaMin} prefix="~" suffix=" min" />
                </strong>
                <span>Live Kitchen ETA</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            className="landing-hero-media"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.08, ease: EASE_OUT }}
          >
            {!heroImgFailed ? (
              <img
                src={HERO_FEAST_IMG}
                alt="Steaming handcrafted momos in bamboo steamer with red chili chutney and kulhad masala chai"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
              />
            ) : (
              <div className="landing-hero-fallback">
                <Logo size={72} />
                <span>{BRAND} · Steaming Fresh</span>
              </div>
            )}
            <div className="landing-hero-scrim">
              <span className="landing-hero-caption-title">Steamed Momos &amp; Kulhad Chai</span>
              <span className="landing-hero-caption-sub">
                Freshly pleated to order · Served piping hot at your table
              </span>
            </div>
          </motion.div>
        </section>

        {/* Single Master QR Standee Showcase */}
        <section aria-labelledby="single-qr-heading" className="landing-section">
          <div className="landing-section-head">
            <div>
              <h2 id="single-qr-heading">Single Cafe QR Code</h2>
              <p className="landing-section-sub">
                Poore cafe ke liye bas ek QR — scan karte hi guest naam, number aur apna table khud chunta hai.
              </p>
            </div>
          </div>

          <motion.div
            className="single-qr-showcase"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.14, ease: EASE_OUT }}
          >
            {/* Left: Food-Themed Cafe Menu QR Standee */}
            <div className="single-qr-standee single-qr-standee-food">
              <div className="standee-food-top">
                <span className="standee-food-kicker">
                  <QrCode size={12} strokeWidth={2.4} aria-hidden="true" /> STEAMED FRESH · MENU QR
                </span>
                <div className="standee-brand-head">
                  <Logo size={38} />
                  <div>
                    <div className="standee-brand-name">{BRAND}</div>
                    <div className="standee-brand-sub">Scan for Menu &amp; Table Order</div>
                  </div>
                </div>
              </div>

              <motion.a
                href="#/m"
                className="standee-qr-link standee-qr-food-plate"
                aria-label="Open Universal Guest Menu QR"
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
              >
                <FoodQr
                  value={masterQrUrl}
                  size={212}
                  className="standee-qr-img"
                  label="Panda Momo Food-Style Menu QR Code"
                />
                <span className="standee-scan-beam" aria-hidden="true" />
              </motion.a>

              <div className="standee-food-strip" aria-hidden="true">
                <span>
                  <UtensilsCrossed size={12} strokeWidth={2.3} /> Momos
                </span>
                <span>·</span>
                <span>
                  <Coffee size={12} strokeWidth={2.3} /> Kulhad Chai
                </span>
                <span>·</span>
                <span>
                  <Flame size={12} strokeWidth={2.3} /> Chutney
                </span>
              </div>

              <div className="standee-hint">
                Camera point karo ya QR tap karke Check-In &amp; Menu kholo
              </div>

              <div className="standee-actions">
                <motion.button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleDownloadMasterQr}
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING}
                >
                  <Download size={14} strokeWidth={2.3} aria-hidden="true" />
                  <span>Download Food QR PNG</span>
                </motion.button>
                <motion.button
                  type="button"
                  className="chip"
                  onClick={handleCopyMasterLink}
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING}
                >
                  {copiedLink ? (
                    <>
                      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                      <span>Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>Copy QR Link</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Right: 3-Step Flow + Live Table Availability */}
            <div className="single-qr-guide">
              <div className="single-qr-guide-head">
                <h3>Ek QR, Zero Confusion</h3>
                <p>
                  Alag-alag table stickers ki zaroorat nahi. Guests isi ek QR ko scan karke apni
                  current table choose aur change kar sakte hain.
                </p>
              </div>

              <ol className="single-qr-steps">
                {[
                  {
                    num: '01',
                    title: 'Scan the Single QR',
                    desc: 'Counter par ya har seat par yahi ek QR code rakhein — phone camera se direct khulta hai.',
                  },
                  {
                    num: '02',
                    title: 'Quick Name & Mobile Check-In',
                    desc: 'Har scan par guest ka naam aur number CRM me save hota hai, WiFi & promo offers ke saath.',
                  },
                  {
                    num: '03',
                    title: 'Pick Free Table & Track Live',
                    desc: 'Live floor status dekh kar table select karein, live prep timer dekhein aur animated bill receipt paayein.',
                  },
                ].map((step, idx) => (
                  <motion.li
                    key={step.num}
                    className="single-qr-step"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.24, delay: 0.16 + idx * 0.05, ease: EASE_OUT }}
                  >
                    <span className="step-num tabular-nums">{step.num}</span>
                    <div>
                      <div className="step-title">{step.title}</div>
                      <div className="step-desc">{step.desc}</div>
                    </div>
                  </motion.li>
                ))}
              </ol>

              <div className="single-qr-tables-bar">
                <div className="single-qr-tables-head">
                  <span className="tables-bar-title">Live Floor Snapshot</span>
                  <span className="tables-bar-summary tabular-nums">
                    {summary.freeTables} Free · {summary.busyTables} Occupied
                  </span>
                </div>
                <div className="tables-strip" aria-label="Quick table links">
                  {summary.tables.map((t, idx) => (
                    <motion.a
                      key={t.num}
                      href={`#/t/${t.num}`}
                      className={`table-strip-item ${t.isFree ? 'is-free' : 'is-busy'}`}
                      title={`Open Table ${t.num} (${t.isFree ? 'Free' : 'Occupied'})`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.18 + idx * 0.02, ease: EASE_OUT }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="table-strip-num tabular-nums">T{t.num}</span>
                      <span className="table-strip-state">
                        {t.isFree ? 'Free' : 'Busy'}
                      </span>
                    </motion.a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Asymmetric Editorial Bento: Workspaces */}
        <section aria-labelledby="workspaces-heading" className="landing-section">
          <div className="landing-section-head">
            <div>
              <h2 id="workspaces-heading">Saare Workspaces</h2>
              <p className="landing-section-sub">
                Guest ordering se lekar kitchen display aur executive CRM tak — ek tap mein kholo.
              </p>
            </div>
          </div>

          <div className="bento-grid">
            {/* Featured 1: Guest Menu with visual food preview */}
            <motion.a
              href="#/m"
              className="bento-card bento-featured bento-guest"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: 0.16, ease: EASE_OUT }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="bento-featured-copy">
                <span className="landing-card-tag">
                  <Sparkles size={12} strokeWidth={2.4} aria-hidden="true" /> Guest Experience
                </span>
                <span className="bento-title">Guest Menu &amp; QR Order</span>
                <span className="bento-desc">
                  Name &amp; phone check-in, live free/occupied table selector, social promo discounts,
                  countdown tracker aur animated thermal receipt.
                </span>
                <span className="bento-meta tabular-nums">
                  {summary.availableDishes} dishes · ~{summary.liveEtaMin} min avg prep
                </span>
                <span className="landing-card-arrow" aria-hidden="true">
                  Open Guest App <ArrowRight size={14} strokeWidth={2.3} />
                </span>
              </div>
              <div className="bento-featured-media">
                {!bannerImgFailed ? (
                  <img
                    src={WORKSPACE_GUEST_IMG}
                    alt="Steaming momos, samosa and spiced kulhad chai spread"
                    referrerPolicy="no-referrer"
                    onError={() => setBannerImgFailed(true)}
                  />
                ) : (
                  <div className="bento-media-fallback">
                    <Logo size={48} />
                  </div>
                )}
              </div>
            </motion.a>

            {/* Featured 2: Admin CRM */}
            <motion.a
              href="#/admin"
              className="bento-card bento-featured bento-admin"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: 0.2, ease: EASE_OUT }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="bento-featured-copy">
                <span className="landing-card-tag">
                  <ShieldCheck size={12} strokeWidth={2.4} aria-hidden="true" /> Management Console
                </span>
                <span className="bento-title">Admin CRM &amp; Controls</span>
                <span className="bento-desc">
                  Executive KPIs, 360° guest visit profiles, WhatsApp win-back campaigns, WiFi
                  credentials, custom promo discounts aur table management.
                </span>
                <span className="bento-meta tabular-nums">
                  {(state.customers || []).length} CRM guests · {(state.promos || []).filter((p) => p.active).length} active promos
                </span>
                <span className="landing-card-arrow" aria-hidden="true">
                  Open Admin CRM <ArrowRight size={14} strokeWidth={2.3} />
                </span>
              </div>
            </motion.a>

            {/* Row 2: 3 Operational Consoles */}
            {secondaryWorkspaces.map((ws, idx) => {
              const WsIcon =
                ws.href === '#/staff'
                  ? LayoutGrid
                  : ws.href === '#/kitchen'
                  ? Flame
                  : BarChart3;
              return (
                <motion.a
                  key={ws.href}
                  href={ws.href}
                  className="bento-card bento-ops"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: 0.24 + idx * 0.04, ease: EASE_OUT }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span className="landing-card-tag">
                    <WsIcon size={12} strokeWidth={2.4} aria-hidden="true" /> {ws.kicker}
                  </span>
                  <span className="landing-card-title">{ws.title}</span>
                  <span className="landing-card-sub">{ws.sub}</span>
                  <span className="bento-ops-foot">
                    <span className="bento-meta tabular-nums">{ws.meta}</span>
                    <span className="landing-card-arrow" aria-hidden="true">
                      Open <ArrowRight size={13} strokeWidth={2.3} />
                    </span>
                  </span>
                </motion.a>
              );
            })}
          </div>
        </section>

        {/* Quiet Footer */}
        <footer className="landing-footer">
          <div className="landing-footer-left">
            <span className="landing-footer-brand">{BRAND}</span>
            <span className="landing-footer-sep" aria-hidden="true">·</span>
            <span className="landing-footer-note">Single-QR Ordering &amp; Restaurant CRM</span>
            {resetMsg && (
              <span className="landing-reset-toast" role="status">
                {resetMsg}
              </span>
            )}
          </div>
          <div className="landing-footer-actions">
            <button
              type="button"
              className="chip"
              onClick={() => setConfirmOpen(true)}
            >
              <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>Demo data reset karo</span>
            </button>
            <DeveloperContactButton compact />
          </div>
        </footer>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        title="Demo data reset karo?"
        message="Saare orders, calls aur stock fresh demo data par wapas aa jayenge."
        confirmLabel="Haan, reset karo"
        danger
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
