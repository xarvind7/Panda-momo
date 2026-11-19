import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { animate, AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Github,
  Instagram,
  MessageCircle,
  X,
} from 'lucide-react';
import {
  attachSakugaCanvas,
  dismissSakugaToast,
  getToasts,
  resizeCanvas,
  showSakugaToast,
  subscribeToasts,
  triggerSakuga,
} from './sakuga';

export const SPRING = { type: 'spring' as const, stiffness: 380, damping: 32 };
export const SAKUGA_SPRING = { type: 'spring' as const, stiffness: 520, damping: 20, mass: 0.7 };

/** Single full-viewport canvas over the page for Sakuga VFX (idle when no effects). */
export function SakugaCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    attachSakugaCanvas(ref.current);
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      attachSakugaCanvas(null);
    };
  }, []);

  return <canvas ref={ref} className="sk-canvas" aria-hidden="true" />;
}

/** Anime-styled floating toast stack (<sakuga-toast> reference). */
export function SakugaToastHost() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);

  return (
    <div className="sk-toast-host noprint" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            role="status"
            className={`sk-toast sk-toast-${t.tone}`}
            initial={{ y: -28, scale: 0.75, opacity: 0, rotate: -2 }}
            animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
            exit={{ y: -16, scale: 0.85, opacity: 0 }}
            transition={SAKUGA_SPRING}
          >
            <span className="sk-toast-sfx">{t.sfx}</span>
            <span className="sk-toast-msg">{t.message}</span>
            <button
              type="button"
              className="sk-toast-close"
              aria-label="Toast band karo"
              onClick={() => dismissSakugaToast(t.id)}
            >
              <X size={13} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Chunky ink-outlined anime toggle switch (<sakuga-toggle> reference). */
export function SakugaToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`sk-toggle ${checked ? 'on' : ''}`}
      onClick={(e) => {
        triggerSakuga(e.currentTarget, 'smoke', checked ? 'OFF!' : 'ON!');
        onChange(!checked);
      }}
    >
      <motion.span
        className="sk-toggle-knob"
        layout
        transition={SAKUGA_SPRING}
      />
    </button>
  );
}

/** Bold ink-outlined 5-star anime rating (<sakuga-rating> reference). */
export function SakugaRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (stars: number) => void;
}) {
  return (
    <div className="sk-rating" role="radiogroup" aria-label="Rating stars">
      {[1, 2, 3, 4, 5].map((st) => {
        const active = st <= value;
        return (
          <motion.button
            key={st}
            type="button"
            role="radio"
            aria-checked={st === value}
            aria-label={`${st} ${st === 1 ? 'star' : 'stars'}`}
            className={`sk-star-btn ${active ? 'on' : ''}`}
            whileHover={{ scale: 1.18, rotate: -6 }}
            whileTap={{ scale: 0.82 }}
            animate={{ scale: active ? [1.26, 1] : 1 }}
            transition={SAKUGA_SPRING}
            onClick={(e) => {
              onChange(st);
              triggerSakuga(e.currentTarget, 'star', st === 5 ? '5★!' : undefined);
            }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <path
                d="M18 3.5 L22.2 12.1 L31.6 13.4 L24.8 20 L26.4 29.4 L18 24.9 L9.6 29.4 L11.2 20 L4.4 13.4 L13.8 12.1 Z"
                fill={active ? '#FFB81C' : '#FFFFFF'}
                stroke="#1B1A4A"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Cel-shaded ink-outlined progress bar (<sakuga-progress> reference). */
export function SakugaProgress({
  pct,
  tone = 'gold',
  label,
}: {
  pct: number;
  tone?: 'gold' | 'red' | 'green';
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="sk-progress"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
    >
      <motion.div
        className={`sk-progress-fill sk-progress-${tone}`}
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={SPRING}
      />
    </div>
  );
}

/** Dish photo thumbnail with clean automatic fallback to emoji if URL is empty or fails to load. */
export function DishThumb({
  img,
  emoji,
  alt,
  className = '',
  size,
  decorative = false,
}: {
  img?: string;
  emoji?: string;
  alt: string;
  className?: string;
  size?: number;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [img]);

  const showImg = Boolean(img && img.trim()) && !failed;
  const dimStyle =
    typeof size === 'number'
      ? { width: size, height: size, minWidth: size, minHeight: size }
      : undefined;

  return (
    <span
      className={`dish-thumb-wrap ${className}`.trim()}
      style={dimStyle}
      aria-hidden={decorative ? 'true' : undefined}
    >
      {showImg ? (
        <img
          src={img}
          alt={decorative ? '' : alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="dish-thumb-emoji" aria-hidden="true">
          {emoji || '🍽️'}
        </span>
      )}
    </span>
  );
}

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="cp-logo"
    >
      <rect width="48" height="48" rx="14" fill="#1B1A4A" />
      {/* Subtle gold halo behind panda */}
      <circle cx="24" cy="25" r="16" fill="#FFB81C" opacity="0.18" />
      {/* Panda ears */}
      <circle cx="13.5" cy="14.5" r="5.2" fill="#141338" stroke="#FFB81C" strokeWidth="1.8" />
      <circle cx="34.5" cy="14.5" r="5.2" fill="#141338" stroke="#FFB81C" strokeWidth="1.8" />
      {/* Panda head (steaming momo roundness) */}
      <ellipse cx="24" cy="25.5" rx="14.2" ry="12.6" fill="#FFFDF8" stroke="#FFB81C" strokeWidth="2" />
      {/* Eye patches */}
      <ellipse cx="18.2" cy="24.4" rx="3.4" ry="4" transform="rotate(-14 18.2 24.4)" fill="#1B1A4A" />
      <ellipse cx="29.8" cy="24.4" rx="3.4" ry="4" transform="rotate(14 29.8 24.4)" fill="#1B1A4A" />
      {/* Eye highlights */}
      <circle cx="19" cy="23.4" r="1.25" fill="#FFFFFF" />
      <circle cx="29" cy="23.4" r="1.25" fill="#FFFFFF" />
      {/* Rosy gold cheeks */}
      <ellipse cx="14.2" cy="28.6" rx="2.1" ry="1.2" fill="#FFB81C" opacity="0.85" />
      <ellipse cx="33.8" cy="28.6" rx="2.1" ry="1.2" fill="#FFB81C" opacity="0.85" />
      {/* Nose & happy smile */}
      <ellipse cx="24" cy="28.2" rx="2.3" ry="1.5" fill="#1B1A4A" />
      <path
        d="M21.2 31.2 C22.5 32.8, 25.5 32.8, 26.8 31.2"
        stroke="#1B1A4A"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Steaming gold wisps above head */}
      {[
        { x: 20, delay: 0 },
        { x: 24, delay: 0.45 },
        { x: 28, delay: 0.9 },
      ].map((s, idx) => (
        <motion.path
          key={idx}
          d={`M${s.x} 11.5 C${s.x - 1.5} 9.2, ${s.x + 1.5} 7.2, ${s.x} 5`}
          stroke="#FFB81C"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: [0, 0.95, 0], y: [3, -3.5] }}
          transition={{
            duration: 1.9,
            repeat: Infinity,
            delay: s.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </svg>
  );
}

export function ChaiGlass({
  fill,
  done = false,
}: {
  fill: number;
  done?: boolean;
}) {
  const clipId = useId();
  const clamped = Math.max(4, Math.min(100, fill));
  const topY = 46;
  const bottomY = 184;
  const liquidHeight = bottomY - topY;
  const targetY = bottomY - (clamped / 100) * liquidHeight;

  return (
    <svg
      width="160"
      height="220"
      viewBox="0 0 160 220"
      fill="none"
      role="img"
      aria-label={`Chai glass ${Math.round(clamped)}% bhar gaya`}
      className="cp-glass"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M34 46 H118 L106 184 H46 L34 46 Z" />
        </clipPath>
      </defs>

      <ellipse cx="76" cy="202" rx="44" ry="8" fill="#1B1A4A" opacity="0.12" />

      <AnimatePresence>
        {clamped > 60 && (
          <g>
            {[
              { x: 54, delay: 0 },
              { x: 76, delay: 0.45 },
              { x: 98, delay: 0.9 },
            ].map((s, idx) => (
              <motion.path
                key={idx}
                d={`M${s.x} 38 C${s.x - 6} 28, ${s.x + 6} 18, ${s.x} 8`}
                stroke="#8A5A33"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: [0, 0.85, 0], y: [8, -10] }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: s.delay,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </g>
        )}
      </AnimatePresence>

      <path d="M34 46 H118 L106 184 H46 L34 46 Z" fill="#FFFBF1" />

      <g clipPath={`url(#${clipId})`}>
        <motion.g
          initial={{ y: bottomY }}
          animate={{ y: targetY }}
          transition={SPRING}
        >
          <rect x="20" y="6" width="120" height="190" fill="#B8742F" />
          <motion.path
            d="M0 8 Q 15 0, 30 8 T 60 8 T 90 8 T 120 8 T 150 8 T 180 8 T 210 8 T 240 8 L240 24 L0 24 Z"
            fill="#C98A3F"
            animate={{ x: [0, -60] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
          />
        </motion.g>
      </g>

      <path
        d="M44 60 L51 168"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.35"
      />

      <path
        d="M115 74 C144 74, 144 134, 110 138"
        stroke="#1B1A4A"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M32 46 H120 L107.5 185.5 C107.3 188 105.2 190 102.7 190 H49.3 C46.8 190 44.7 188 44.5 185.5 L32 46 Z"
        stroke="#1B1A4A"
        strokeWidth="5"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M28 46 H124"
        stroke="#1B1A4A"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {done && (
        <motion.path
          d="M58 118 L71 131 L97 101"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
        />
      )}
    </svg>
  );
}

export function CountUp({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('en-IN');

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export function PaidCheck() {
  return (
    <motion.div
      className="paid-check-wrap"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={SAKUGA_SPRING}
      aria-hidden="true"
    >
      <svg width="82" height="82" viewBox="0 0 82 82" fill="none">
        <circle cx="43" cy="43" r="35" fill="#B6B0FF" />
        <circle cx="39" cy="39" r="35" fill="#2E7D5B" stroke="#1B1A4A" strokeWidth="3.2" />
        <motion.path
          d="M23 40.5 L34 51.5 L55.5 28"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.18, ease: 'easeOut' }}
        />
      </svg>
    </motion.div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Haan, karo',
  danger = false,
  dark = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  dark?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className={`confirm-box ${dark ? 'dark' : ''}`}
            initial={{ scale: 0.88, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 14 }}
            transition={SAKUGA_SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-dialog-title">{title}</h3>
            <p className="confirm-msg">{message}</p>
            <div className="confirm-actions">
              <button
                type="button"
                className={dark ? 'btn-ghost-dark' : 'chip'}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className={danger ? 'btn btn-danger' : 'btn'}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const DEV_WHATSAPP = '9334208980';
const DEV_GITHUB = 'https://github.com/xarvind7';
const DEV_INSTAGRAM_HANDLE = '@xarvind07';
const DEV_INSTAGRAM_URL = 'https://instagram.com/xarvind07';

/** Compact Contact Developer button that opens a Developer Info modal on click. */
export function DeveloperContactButton({
  dark = false,
  compact = false,
}: {
  dark?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'wa' | 'ig' | 'gh' | null>(null);

  async function handleCopy(text: string, key: 'wa' | 'ig' | 'gh', label: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard fallback ignored
    }
    setCopiedKey(key);
    showSakugaToast(`${label} copy ho gaya!`, 'gold', 'COPIED!');
    window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
  }

  return (
    <>
      <button
        type="button"
        className={[
          'dev-trigger-btn',
          dark ? 'dev-trigger-dark' : '',
          compact ? 'dev-trigger-compact' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => setOpen(true)}
      >
        <Code2 size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>Contact Developer</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dev-modal-title"
              className={`dev-modal ${dark ? 'dark' : ''}`}
              initial={{ scale: 0.88, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 18 }}
              transition={SAKUGA_SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dev-modal-head">
                <span className="dev-badge">DEVELOPER INFO</span>
                <button
                  type="button"
                  className={dark ? 'btn-ghost-dark' : 'sheet-close'}
                  aria-label="Developer info band karo"
                  onClick={() => setOpen(false)}
                >
                  <X size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <h3 id="dev-modal-title" className="dev-modal-title">
                Developed by xarvind07
              </h3>
              <p className="dev-modal-sub">
                Custom restaurant app, setup ya support ke liye seedha connect karo.
              </p>

              <div className="dev-info-list">
                <div className="dev-info-row">
                  <div className="dev-info-meta">
                    <span className="dev-info-label">
                      <MessageCircle size={13} strokeWidth={2.2} aria-hidden="true" /> WhatsApp Number
                    </span>
                    <strong className="dev-info-val">+91 {DEV_WHATSAPP}</strong>
                  </div>
                  <div className="dev-info-actions">
                    <button
                      type="button"
                      className={dark ? 'btn-ghost-dark' : 'chip'}
                      onClick={() => handleCopy(DEV_WHATSAPP, 'wa', 'WhatsApp number')}
                    >
                      {copiedKey === 'wa' ? (
                        <>
                          <Check size={14} strokeWidth={2.4} aria-hidden="true" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={14} strokeWidth={2.2} aria-hidden="true" /> Copy
                        </>
                      )}
                    </button>
                    <a
                      href={`https://wa.me/91${DEV_WHATSAPP}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-green"
                    >
                      WhatsApp <ExternalLink size={13} strokeWidth={2.3} aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="dev-info-row">
                  <div className="dev-info-meta">
                    <span className="dev-info-label">
                      <Instagram size={13} strokeWidth={2.2} aria-hidden="true" /> Instagram
                    </span>
                    <strong className="dev-info-val">{DEV_INSTAGRAM_HANDLE}</strong>
                  </div>
                  <div className="dev-info-actions">
                    <button
                      type="button"
                      className={dark ? 'btn-ghost-dark' : 'chip'}
                      onClick={() => handleCopy(DEV_INSTAGRAM_HANDLE, 'ig', 'Instagram handle')}
                    >
                      {copiedKey === 'ig' ? (
                        <>
                          <Check size={14} strokeWidth={2.4} aria-hidden="true" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={14} strokeWidth={2.2} aria-hidden="true" /> Copy
                        </>
                      )}
                    </button>
                    <a
                      href={DEV_INSTAGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                    >
                      Instagram <ExternalLink size={13} strokeWidth={2.3} aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="dev-info-row">
                  <div className="dev-info-meta">
                    <span className="dev-info-label">
                      <Github size={13} strokeWidth={2.2} aria-hidden="true" /> GitHub Account
                    </span>
                    <strong className="dev-info-val">github.com/xarvind7</strong>
                  </div>
                  <div className="dev-info-actions">
                    <button
                      type="button"
                      className={dark ? 'btn-ghost-dark' : 'chip'}
                      onClick={() => handleCopy(DEV_GITHUB, 'gh', 'GitHub link')}
                    >
                      {copiedKey === 'gh' ? (
                        <>
                          <Check size={14} strokeWidth={2.4} aria-hidden="true" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={14} strokeWidth={2.2} aria-hidden="true" /> Copy
                        </>
                      )}
                    </button>
                    <a
                      href={DEV_GITHUB}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                    >
                      GitHub <ExternalLink size={13} strokeWidth={2.3} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

