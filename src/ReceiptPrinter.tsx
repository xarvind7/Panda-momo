import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Receipt, RotateCcw, Scissors, Volume2, VolumeX } from 'lucide-react';
import QRCode from 'qrcode';
import { BRAND, fmt, type PaidReceipt } from './data';

type PrinterPhase = 'printing' | 'printed' | 'tearing' | 'torn';

// Deterministic bar widths from txnId so the SVG barcode looks authentic
function buildBarcodeBars(seed: string): Array<{ x: number; w: number }> {
  const bars: Array<{ x: number; w: number }> = [];
  let x = 4;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let i = 0; i < 42; i++) {
    hash = Math.imul(hash ^ (i * 31 + 17), 16777619) >>> 0;
    const w = (hash % 3) + 1.5;
    const gap = ((hash >> 3) % 2) + 1.8;
    bars.push({ x, w });
    x += w + gap;
    if (x > 218) break;
  }
  return bars;
}

function playPrinterTick(enabled: boolean, kind: 'feed' | 'cut') {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (kind === 'feed') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    }
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 300);
  } catch {
    // Ignore audio errors
  }
}

export default function ReceiptPrinter({
  receipt,
  table,
  guestName,
  guestPhone,
}: {
  receipt: PaidReceipt;
  table: number;
  guestName?: string;
  guestPhone?: string;
}) {
  const [phase, setPhase] = useState<PrinterPhase>('printing');
  const [progress, setProgress] = useState<number>(0);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [printCycle, setPrintCycle] = useState<number>(0);
  const [cutting, setCutting] = useState<boolean>(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const subtotal = receipt.total;
  const discount = receipt.discount ?? 0;
  const tip = receipt.tip ?? 0;
  const grand = receipt.grand ?? Math.max(0, subtotal - discount) + tip;
  const method = receipt.method || 'UPI';
  const txnId = receipt.txnId || `TXN-${String(receipt.at).slice(-8)}`;
  const displayName = receipt.customerName || guestName || 'Guest';
  const displayPhone = receipt.customerPhone || guestPhone || '';
  const items = receipt.items || [];

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(receipt.at);
      return d
        .toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        .toUpperCase();
    } catch {
      return 'TODAY';
    }
  }, [receipt.at]);

  const formattedTime = useMemo(() => {
    try {
      const d = new Date(receipt.at);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  }, [receipt.at]);

  const barcodeBars = useMemo(() => buildBarcodeBars(txnId), [txnId]);

  useEffect(() => {
    let alive = true;
    const payload = `${BRAND} | ${txnId} | Table ${table} | ${fmt(grand)} | ${method}`;
    QRCode.toDataURL(payload, { width: 160, margin: 1 })
      .then((url) => {
        if (alive) setQrUrl(url);
      })
      .catch(() => {
        // Ignore QR generation errors
      });
    return () => {
      alive = false;
    };
  }, [txnId, table, grand, method]);

  // Run the 2.4s stepped thermal printing sequence on mount / receipt change / reprint
  useEffect(() => {
    setPhase('printing');
    setProgress(0);
    setCutting(false);

    const start = performance.now();
    const duration = 2300;
    let rafId = 0;
    let lastTickStep = -1;

    const step = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      const tickBucket = Math.floor(pct / 16);
      if (tickBucket !== lastTickStep && pct < 96) {
        lastTickStep = tickBucket;
        playPrinterTick(soundRef.current, 'feed');
      }

      if (elapsed < duration) {
        rafId = window.requestAnimationFrame(step);
      } else {
        setProgress(100);
        setPhase('printed');
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [receipt.at, printCycle]);

  function handleTearReceipt() {
    if (phase !== 'printed') return;
    setCutting(true);
    setPhase('tearing');
    playPrinterTick(soundRef.current, 'cut');
    window.setTimeout(() => {
      setCutting(false);
      setPhase('torn');
    }, 860);
  }

  function handleReprint() {
    setPrintCycle((c) => c + 1);
  }

  return (
    <section className="rcpt-stage" aria-label="Payment receipt printer">
      <div className="rcpt-top-controls noprint">
        <span className="rcpt-stage-title icon-heading">
          <Receipt size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>Digital Receipt</span>
        </span>
        <button
          type="button"
          className="rcpt-sound-btn"
          onClick={() => setSoundOn((v) => !v)}
          aria-pressed={soundOn}
        >
          {soundOn ? (
            <>
              <Volume2 size={14} strokeWidth={2.2} aria-hidden="true" /> Sound ON
            </>
          ) : (
            <>
              <VolumeX size={14} strokeWidth={2.2} aria-hidden="true" /> Sound OFF
            </>
          )}
        </button>
      </div>

      {/* Metallic Brass Printer Slot (from reference animation) */}
      <div className={`rcpt-slot-wrap ${phase === 'printing' ? 'is-printing' : ''}`}>
        <div className="rcpt-brass-bar">
          <div className="rcpt-slot-slit">
            <div className="rcpt-laser-beam" />
            <div className={`rcpt-cutter-flash ${cutting ? 'is-cutting' : ''}`} />
          </div>
          <span
            className={`rcpt-status-led ${
              phase === 'printing' ? 'is-printing' : 'is-ready'
            }`}
            aria-hidden="true"
          />
        </div>

        <div className={`rcpt-progress-wrap ${phase === 'printing' ? 'is-active' : ''}`}>
          <div className="rcpt-progress-track">
            <div className="rcpt-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="rcpt-progress-text">
            {phase === 'printing' ? `PRINTING RECEIPT… ${progress}%` : 'RECEIPT READY'}
          </div>
        </div>
      </div>

      {/* Paper Viewport */}
      {phase !== 'torn' ? (
        <div
          key={`${receipt.at}-${printCycle}`}
          className={`rcpt-viewport ${
            phase === 'printing'
              ? 'is-printing'
              : phase === 'printed'
              ? 'is-printed'
              : 'is-tearing'
          }`}
        >
          <button
            type="button"
            className="rcpt-tear-badge noprint"
            onClick={handleTearReceipt}
          >
            <Scissors size={13} strokeWidth={2.3} aria-hidden="true" /> PULL TO TEAR RECEIPT
          </button>

          <div className="rcpt-wrapper">
            <article className="rcpt-paper" aria-label="Official paid receipt">
              {/* Angled Red PAID Rubber Stamp */}
              <div
                className={`rcpt-stamp ${phase === 'printed' ? 'is-stamped' : ''}`}
                aria-label="Paid stamp"
              >
                <div className="rcpt-stamp-sub">VERIFIED</div>
                <div className="rcpt-stamp-main">★ PAID ★</div>
                <div className="rcpt-stamp-sub">OFFICIAL RECEIPT</div>
              </div>

              <div className="rcpt-header">
                <div className="rcpt-brand">{BRAND.toUpperCase()}</div>
                <div className="rcpt-meta-blue">
                  TABLE {table} · {displayName.toUpperCase()}
                  {displayPhone ? ` · +91 ${displayPhone}` : ''}
                </div>
                <div className="rcpt-meta-sub">RESTAURANT DIGITAL RECEIPT</div>
              </div>

              <div className="rcpt-big-total">{fmt(grand)}.00</div>
              <div className="rcpt-date-line">
                {formattedDate} {formattedTime ? `· ${formattedTime}` : ''} | {method.toUpperCase()} PAID
              </div>

              <div className="rcpt-divider" />

              <div className="rcpt-items">
                {items.length > 0 ? (
                  items.map((it, idx) => (
                    <div key={`${it.name}-${idx}`} className="rcpt-item-row">
                      <span className="rcpt-item-name">
                        {it.qty}X {it.name}
                        {it.deal ? ' (Deal)' : ''}
                      </span>
                      <span className="rcpt-item-amt">{fmt(it.amount)}.00</span>
                    </div>
                  ))
                ) : (
                  <div className="rcpt-item-row">
                    <span className="rcpt-item-name">1X Table {table} Order</span>
                    <span className="rcpt-item-amt">{fmt(subtotal)}.00</span>
                  </div>
                )}
              </div>

              <div className="rcpt-divider" />

              <div className="rcpt-totals">
                <div className="rcpt-tot-row">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}.00</span>
                </div>
                {discount > 0 && (
                  <div className="rcpt-tot-row" style={{ color: '#059669', fontWeight: 700 }}>
                    <span>Promo{receipt.promoTitle ? ` (${receipt.promoTitle})` : ''}</span>
                    <span>-{fmt(discount)}.00</span>
                  </div>
                )}
                {tip > 0 && (
                  <div className="rcpt-tot-row">
                    <span>Tip</span>
                    <span>{fmt(tip)}.00</span>
                  </div>
                )}
                <div className="rcpt-tot-row rcpt-tot-grand">
                  <span>TOTAL</span>
                  <span>{fmt(grand)}.00</span>
                </div>
              </div>

              <div className="rcpt-thanks">HAVE A NICE DAY!</div>

              {/* Crisp Barcode SVG */}
              <div className="rcpt-barcode-wrap" aria-label={`Transaction ${txnId}`}>
                <svg
                  viewBox="0 0 226 42"
                  className="rcpt-barcode-svg"
                  aria-hidden="true"
                >
                  {barcodeBars.map((b, i) => (
                    <rect
                      key={i}
                      x={b.x}
                      y={2}
                      width={b.w}
                      height={38}
                      fill="#0F172A"
                    />
                  ))}
                </svg>
                <div className="rcpt-txn">{txnId}</div>
              </div>

              <div className="rcpt-divider" />

              {qrUrl && (
                <div className="rcpt-qr-box">
                  <img
                    src={qrUrl}
                    alt={`Verified receipt QR ${txnId}`}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="rcpt-foot-note">
                Thank you for dining at {BRAND}
              </div>

              {/* Jagged sawtooth paper bottom */}
              <div className="rcpt-sawtooth" aria-hidden="true" />
            </article>
          </div>
        </div>
      ) : (
        <div className="rcpt-torn-state">
          <p className="rcpt-torn-msg icon-heading" style={{ justifyContent: 'center' }}>
            <Scissors size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>Receipt tear ho gayi! Dobara dekhni hai?</span>
          </p>
          <button type="button" className="btn btn-sm" onClick={handleReprint}>
            <Printer size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Reprint Receipt</span>
          </button>
        </div>
      )}

      {phase === 'printed' && (
        <div className="rcpt-bottom-actions noprint">
          <button
            type="button"
            className="chip"
            onClick={handleReprint}
          >
            <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Replay Print</span>
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => window.print()}
          >
            <Printer size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Print / Save</span>
          </button>
        </div>
      )}
    </section>
  );
}
