import { useSyncExternalStore } from 'react';

export type ThemeMode = 'normal' | 'dark';
export type AnimeSfxType = 'confirm' | 'add' | 'alert' | 'back' | 'tab' | 'tap';

const THEME_STORAGE_KEY = 'panda-momo-theme-mode';
const SFX_STORAGE_KEY = 'panda-momo-anime-sfx';

export function normalizeThemeMode(raw: string | null | undefined): ThemeMode {
  return raw === 'dark' ? 'dark' : 'normal';
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'normal' : 'dark';
}

/**
 * Pure classifier that maps any touched UI element / label / class list to its
 * matching anime-style UI sound effect.
 */
export function classifyAnimeTouchSound(
  label: string,
  classNames = '',
  tagName = ''
): AnimeSfxType {
  const text = label.trim().toLowerCase();
  const cls = classNames.toLowerCase();
  const tag = tagName.toLowerCase();

  // Back / close / delete / minus actions -> playful downward anime "poku"
  if (
    cls.includes('sheet-close') ||
    cls.includes('sk-toast-close') ||
    cls.includes('staff-alert-close') ||
    cls.includes('btn-danger') ||
    cls.includes('cart-remove-btn') ||
    text === 'x' ||
    text === '✕' ||
    text.includes('cancel') ||
    text.includes('band karo') ||
    text.includes('delete') ||
    text.includes('remove') ||
    text.includes('clear') ||
    text.includes('kam karo') ||
    text.includes('logout')
  ) {
    return 'back';
  }

  // Waiter call / help / alert actions -> energetic anime double-bell "ting-ting!"
  if (
    cls.includes('guest-help-btn') ||
    cls.includes('quick-help-card') ||
    cls.includes('staff-call-resolve-btn') ||
    text.includes('waiter') ||
    text.includes('help') ||
    text.includes('bulao') ||
    text.includes('aa raha') ||
    text.includes('ready')
  ) {
    return 'alert';
  }

  // Primary confirm / order / pay / save / login -> heroic anime sparkle arpeggio
  if (
    cls.includes('cart-bar') ||
    cls.includes('landing-cta-primary') ||
    text.includes('order bhejo') ||
    text.includes('send to kitchen') ||
    text.includes('pay ') ||
    text.includes('collect') ||
    text.includes('save karo') ||
    text.includes('update karo') ||
    text.includes('login') ||
    text.includes('menu kholo') ||
    text.includes('served') ||
    text.includes('review bhejo') ||
    text.includes('download')
  ) {
    return 'confirm';
  }

  // Add / plus / star / coaster table pick -> upbeat anime "piko-kira!"
  if (
    cls.includes('add-outline-btn') ||
    cls.includes('stepper-btn') ||
    cls.includes('sk-star-btn') ||
    cls.includes('coaster-btn') ||
    cls.includes('crm-pts-btn') ||
    text === 'add' ||
    text.startsWith('+ ') ||
    text.includes('badhao') ||
    text.includes('star')
  ) {
    return 'add';
  }

  // Tabs / nav / filters / chips / QR / toggles -> crisp anime crystal click
  if (
    cls.includes('bottom-tab') ||
    cls.includes('nav-link') ||
    cls.includes('cat-pill') ||
    cls.includes('crm-nav-btn') ||
    cls.includes('crm-seg-btn') ||
    cls.includes('table-filter-btn') ||
    cls.includes('chip') ||
    cls.includes('sk-toggle') ||
    cls.includes('guest-qr-btn') ||
    cls.includes('coaster-qr-btn') ||
    cls.includes('theme-mode-btn') ||
    cls.includes('sfx-toggle-btn') ||
    tag === 'a'
  ) {
    return 'tab';
  }

  // General touch anywhere on screen or secondary controls -> soft anime bubble pop
  return 'tap';
}

// ============================================================================
// Reactive Theme + Anime SFX Store
// ============================================================================

let currentTheme: ThemeMode = loadInitialTheme();
let currentSfxEnabled: boolean = loadInitialSfx();
const themeListeners = new Set<() => void>();
const sfxListeners = new Set<() => void>();

function loadInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'normal';
  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'normal';
  }
}

function loadInitialSfx(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SFX_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function applyThemeToDom(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
}

export function initThemeMode(): ThemeMode {
  applyThemeToDom(currentTheme);
  return currentTheme;
}

export function getThemeMode(): ThemeMode {
  return currentTheme;
}

export function setThemeMode(mode: ThemeMode): void {
  const next = normalizeThemeMode(mode);
  if (next === currentTheme) {
    applyThemeToDom(next);
    return;
  }
  currentTheme = next;
  applyThemeToDom(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Ignore storage restriction
  }
  for (const fn of themeListeners) fn();
}

export function subscribeTheme(fn: () => void): () => void {
  themeListeners.add(fn);
  return () => {
    themeListeners.delete(fn);
  };
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, getThemeMode, getThemeMode);
}

export function getAnimeSfxEnabled(): boolean {
  return currentSfxEnabled;
}

export function setAnimeSfxEnabled(enabled: boolean): void {
  if (enabled === currentSfxEnabled) return;
  currentSfxEnabled = enabled;
  try {
    window.localStorage.setItem(SFX_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ignore storage restriction
  }
  for (const fn of sfxListeners) fn();
}

export function subscribeAnimeSfx(fn: () => void): () => void {
  sfxListeners.add(fn);
  return () => {
    sfxListeners.delete(fn);
  };
}

export function useAnimeSfxEnabled(): boolean {
  return useSyncExternalStore(subscribeAnimeSfx, getAnimeSfxEnabled, getAnimeSfxEnabled);
}

// ============================================================================
// Web Audio API Full Anime-Style Synthesizer SFX Engine
// ============================================================================

let sharedAudioCtx: AudioContext | null = null;
let lastPlayAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function scheduleTone(
  ctx: AudioContext,
  opts: {
    type: OscillatorType;
    startFreq: number;
    endFreq?: number;
    startOffset: number;
    duration: number;
    gain: number;
  }
): void {
  const now = ctx.currentTime + opts.startOffset;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.startFreq, now);
  if (opts.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), now + opts.duration);
  }
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(opts.gain, now + Math.min(0.012, opts.duration * 0.25));
  amp.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + opts.duration + 0.015);
}

/**
 * Plays a crisp, authentic anime-style synthesized UI sound matching the touch type.
 * Debounced by 45ms so touchstart/pointerdown + click never double-fire.
 */
export function playAnimeSfx(type: AnimeSfxType): AnimeSfxType | null {
  if (!currentSfxEnabled) return null;
  const nowMs = Date.now();
  if (nowMs - lastPlayAt < 45) return null;
  lastPlayAt = nowMs;

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.lastSfx = type;
  }

  const ctx = getAudioContext();
  if (!ctx) return type;

  try {
    switch (type) {
      case 'confirm': {
        // Heroic Shonen / JRPG sparkle arpeggio ("Kira-Don!")
        scheduleTone(ctx, { type: 'triangle', startFreq: 587.33, endFreq: 659.25, startOffset: 0, duration: 0.08, gain: 0.12 });
        scheduleTone(ctx, { type: 'triangle', startFreq: 880, startOffset: 0.055, duration: 0.09, gain: 0.13 });
        scheduleTone(ctx, { type: 'sine', startFreq: 1174.66, endFreq: 1318.5, startOffset: 0.11, duration: 0.18, gain: 0.14 });
        scheduleTone(ctx, { type: 'sine', startFreq: 1760, startOffset: 0.12, duration: 0.14, gain: 0.055 });
        break;
      }
      case 'add': {
        // Playful upward anime "Piko-Kira!" pop
        scheduleTone(ctx, { type: 'sine', startFreq: 620, endFreq: 980, startOffset: 0, duration: 0.075, gain: 0.11 });
        scheduleTone(ctx, { type: 'triangle', startFreq: 1318.5, endFreq: 1567.98, startOffset: 0.045, duration: 0.1, gain: 0.085 });
        break;
      }
      case 'alert': {
        // Energetic anime double crystal chime ("Ting-Ting!")
        scheduleTone(ctx, { type: 'sine', startFreq: 987.77, startOffset: 0, duration: 0.11, gain: 0.13 });
        scheduleTone(ctx, { type: 'triangle', startFreq: 1975.53, startOffset: 0, duration: 0.09, gain: 0.05 });
        scheduleTone(ctx, { type: 'sine', startFreq: 1318.51, startOffset: 0.09, duration: 0.16, gain: 0.14 });
        scheduleTone(ctx, { type: 'triangle', startFreq: 2637.02, startOffset: 0.09, duration: 0.12, gain: 0.05 });
        break;
      }
      case 'back': {
        // Soft anime downward "Poku" bubble drop
        scheduleTone(ctx, { type: 'sine', startFreq: 520, endFreq: 310, startOffset: 0, duration: 0.095, gain: 0.105 });
        scheduleTone(ctx, { type: 'triangle', startFreq: 390, endFreq: 250, startOffset: 0.03, duration: 0.08, gain: 0.045 });
        break;
      }
      case 'tab': {
        // Crisp anime "Kachi-Piko" menu crystal click
        scheduleTone(ctx, { type: 'triangle', startFreq: 740, endFreq: 1108.73, startOffset: 0, duration: 0.06, gain: 0.095 });
        scheduleTone(ctx, { type: 'sine', startFreq: 1480, startOffset: 0.02, duration: 0.06, gain: 0.045 });
        break;
      }
      case 'tap':
      default: {
        // Subtle anime "Poko" water-drop pop on any touch
        scheduleTone(ctx, { type: 'sine', startFreq: 540, endFreq: 780, startOffset: 0, duration: 0.055, gain: 0.07 });
        break;
      }
    }
  } catch {
    // Ignore Web Audio runtime restrictions
  }
  return type;
}
