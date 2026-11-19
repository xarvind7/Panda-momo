import { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import Landing from './pages/Landing';
import Customer from './pages/Customer';
import Admin from './pages/Admin';
import Staff from './pages/Staff';
import Kitchen from './pages/Kitchen';
import Owner from './pages/Owner';
import { SakugaCanvas, SakugaToastHost } from './ui';
import { inferSfxFromLabel, triggerSakuga } from './sakuga';

function readHash(): string {
  if (window.location.hash) {
    return window.location.hash;
  }
  const pathname = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (pathname === '/admin' || pathname === '/admin-panel') {
    return '#/admin';
  }
  if (pathname === '/menu' || pathname === '/m') {
    return '#/m';
  }
  if (pathname === '/staff') {
    return '#/staff';
  }
  if (pathname === '/kitchen') {
    return '#/kitchen';
  }
  if (pathname === '/owner') {
    return '#/owner';
  }
  return '#/';
}

export default function App() {
  const [hash, setHash] = useState<string>(readHash);

  useEffect(() => {
    const onNavChange = () => setHash(readHash());
    window.addEventListener('hashchange', onNavChange);
    window.addEventListener('popstate', onNavChange);
    return () => {
      window.removeEventListener('hashchange', onNavChange);
      window.removeEventListener('popstate', onNavChange);
    };
  }, []);

  // Global Sakuga VFX delegation for buttons, chips, coasters, and tabs
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      const btn = target.closest(
        'button.btn, button.add-outline-btn, button.coaster-btn, button.chip, button.chip-dark, button.cat-pill, button.cart-bar, button.stepper-btn'
      ) as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;

      const label = (btn.textContent || btn.getAttribute('aria-label') || '').trim();
      const sfx = inferSfxFromLabel(label);

      if (btn.classList.contains('btn') || btn.classList.contains('coaster-btn') || btn.classList.contains('cart-bar')) {
        triggerSakuga(btn, 'primary', sfx);
      } else if (btn.classList.contains('add-outline-btn') || btn.classList.contains('stepper-btn')) {
        triggerSakuga(btn, 'spark', btn.classList.contains('add-outline-btn') ? 'ADD!' : undefined);
      } else if (btn.classList.contains('cat-pill')) {
        triggerSakuga(btn, 'slash');
      } else {
        triggerSakuga(btn, 'secondary', sfx);
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  let page;
  let routeGroup = 'landing';
  const tableMatch = hash.match(/^#\/t\/(\d+)/);
  if (tableMatch) {
    routeGroup = 'guest';
    page = <Customer key={hash} initialTable={Number(tableMatch[1])} />;
  } else if (hash.startsWith('#/m')) {
    routeGroup = 'guest';
    page = <Customer key={hash} initialTable={null} />;
  } else if (hash.startsWith('#/admin')) {
    routeGroup = 'admin';
    page = <Admin />;
  } else if (hash.startsWith('#/staff')) {
    routeGroup = 'staff';
    page = <Staff />;
  } else if (hash.startsWith('#/kitchen')) {
    routeGroup = 'kitchen';
    page = <Kitchen />;
  } else if (hash.startsWith('#/owner')) {
    routeGroup = 'owner';
    page = <Owner />;
  } else {
    routeGroup = 'landing';
    page = <Landing />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={routeGroup}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {page}
        </motion.div>
      </AnimatePresence>
      <SakugaCanvas />
      <SakugaToastHost />
    </MotionConfig>
  );
}
